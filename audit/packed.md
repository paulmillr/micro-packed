# micro-packed review — 2026-07-05

## Summary

The library is in good shape: the recent hardening pass (bounds checks, minimal-encoding
enforcement, progress checks for unbounded arrays, pointer bitset, field-name validation)
holds up under review. One remaining decode-side DoS vector was found and closed
(dynamic-length arrays with zero-size inners); a fail-fast length bound was added for
fixed-size inners; two trivial consistency fixes and two bigint hot-path optimizations
were applied. One residual (low-severity) DoS vector is documented below and left for a
deliberate decision.

## Changes made in this review

### 1. DoS fix: dynamic-length array with zero-size inner (`src/index.ts`, `array()`)

`P.array(null, zeroSizeInner)` was already rejected at construction, and terminator
arrays already have a runtime "inner decoder did not consume input" check. But the
length-prefixed branch had neither. With a stream-provided length and a zero-size inner:

```js
P.array(P.U32LE, P.constant(1)).decode(Uint8Array.of(0xff, 0xff, 0xff, 0xff))
```

previously looped 2**32−1 times pushing elements into the result array from a 4-byte
input — memory exhaustion. Lengths that come from the stream (`CoderType` length) or
from another decoded field (path string) are attacker-controlled, so these are now
rejected at construction, mirroring the `null`-length guard:

```
array: dynamic length cannot use zero-size inner
```

Fixed `number` lengths are schema constants and remain allowed (existing test
`zero-size inner` depends on `P.array(3, P.array(0, P.U8))` roundtripping).

### 2. Fail-fast bound for hostile length prefixes (`array()` decode)

For fixed-size inners, `length` elements must consume exactly `length * inner.size`
bytes from the linear stream. The decoder now rejects impossible claims before decoding
any element:

```
array: length=4294967295 elements of size=4 exceed 4 bytes left
```

Previously this failed anyway (end-of-buffer at the first element past the data), so
this is not a security fix, but it fails earlier, with a clearer error, and skips the
per-element path bookkeeping for garbage lengths. Note for reviewers: `size` hints of
built-in coders equal their linear consumption (including `pointer(..., sized=true)`,
whose pointed payload lives inside the same buffer), so the bound cannot reject valid
data.

### 3. Residual DoS vector (documented, not fixed): zero-consuming dynamic-size inners

The construction guard in (1) only catches `inner.size === 0`. Coders with
`size === undefined` that can consume zero bytes per element still bypass it, e.g.:

```js
P.array(P.U32LE, P.flag(marker))   // absent flag consumes 0 bytes
P.array(P.U32LE, P.bits(0))
```

A 4-byte hostile length yields a ~4-billion-element boolean array. The complete fix is
the same progress check used by the `null`/terminator branches, but applied to the
length-prefixed branch it would **break currently-valid schemas** (an array of flags
that are all absent legitimately consumes 0 bytes per element), so it needs a deliberate
semver decision rather than a drive-by change. Options, in order of preference:

1. Apply the progress check only when length came from the stream/path (breaks
   flag-array schemas with dynamic length; arguably those are already broken designs).
2. Cap `length` by something like `r.leftBytes + 1` when a zero-progress element is
   observed (heuristic, no principled bound).
3. Document that dynamic-length arrays of potentially-zero-size elements are unsafe
   against hostile input (status quo).

Consumers checked by grep-of-memory (btc-signer CompactSize arrays, eth ABI, SSZ) use
byte-consuming elements, so real-world exposure looks low.

### 4. Consistency fixes

- `prefix()` threw plain `Error` for a non-coder `inner`; every sibling combinator
  (`apply`, `array`, `struct`, `tuple`, `pointer`, …) uses `TypeError` per the
  documented convention (constructor mistakes → `TypeError`). Now `TypeError`; test added.
- `sizeof()` error message interpolated the accumulated `size` variable instead of the
  offending `f.size`.

### 5. Trivial speed-ups applied (bigint hot path, `Writer.finish`)

- `bigint` encode: fill a preallocated BE `Uint8Array` in place instead of building a
  JS number array, converting, and reversing (up to twice).
- `bigint` decode: accumulate `res = (res << 8n) | byte` iterating in the endianness
  of the buffer — removes the `swapEndianness` copy on the BE path and halves the
  per-byte bigint allocations.
- `Writer.finish`: replaced `.map().reduce()` length sum with a plain loop.

Measured (Node 24, x86-64; ns/op, median of 3 runs):

| bench            | before | after | Δ      |
|------------------|--------|-------|--------|
| U64LE.decode     | 304    | 169   | −44%   |
| U64BE.decode     | 390    | 165   | −58%   |
| U256LE.decode    | 598    | 392   | −34%   |
| U256BE.decode    | 697    | 400   | −43%   |
| U64LE.encode     | 834    | ~650  | ~−20% (noisy) |
| U256LE.encode    | 1271   | ~1150 | ~−10% (noisy) |

U64 decode matters for btc-signer (amounts, CompactSize fallback); U256 for eth values.
All existing bigint boundary/minimal-encoding/property tests pass unchanged.

## Larger speed-ups investigated (prototyped, measured, not landed)

### A. Chunked writer — LANDED (same day), 4.1x on numeric-heavy encode

Full design document: `audit/chunked-writer.md` (data structures, sizing policy,
retention analysis, rejected alternatives).

`_Writer.byte()` allocated a 1-byte `Uint8Array` per call; `writeView()` allocated a
fresh slice per number and zero-filled an 8-byte scratch view. Landed design: small
writes are carved out of **writer-local** chunks (min 64 bytes, growing ×8 capped at
4KB); consecutive carved writes extend a mutable `{chunk, start, end}` run in
`buffers[]`, while `bytes()` still splices caller buffers by reference between runs.
The chunk `DataView` is lazy (only `writeView` needs it; byte/bits-only writers never
allocate one), and `writeView`'s callback signature changed to `(view, pos)` so numbers
are written directly into the chunk (internal API; `ViewCoder.write` is now
`(view, pos, value)`). A 64-byte chunk floor keeps typical struct encodes inside one
chunk — per-chunk `DataView` creation was 21% of complex-struct encode when the first
chunk was sized to the first write.

Security/retention review (the design constraint that shaped this):
- Chunks are **per-writer and freshly allocated** — this is not a cross-writer/global
  pool, so no data can leak between encodes. A shared pool was rejected outright.
- `finish(clean=true)` zeroizes every chunk whole (a superset of the bytes the old
  `cleanBuffers` cleared — unused tails only ever contain allocation zeros), plus
  pointer buffers, exactly as before. Caller-provided `bytes()` buffers remain
  untouched by reference.
- An exception before `finish()` leaves chunks un-zeroized until GC — identical to the
  old behavior for `cleanBuffers`.
- `writeView` callbacks now receive a DataView over the whole current chunk (previously
  an 8-byte zeroed scratch), so a custom coder's write fn can see other bytes of the
  same in-progress encode. Not a new trust boundary: coder callbacks run in the same
  realm and could already reach everything via the writer object; TS `private` is not a
  security barrier.
- `finish(false)` (array-terminator check) still snapshots without cleanup; runs stay
  open and later writes keep extending them.

Measured (Node 24, steady-state medians; "before" = HEAD ca4da0f+path-tracking change):

| bench                          | before | after  | Δ      |
|--------------------------------|--------|--------|--------|
| array(10k×U32LE).encode        | 741µs  | 196µs  | −74%   |
| tx-like array-of-structs encode| 15.1µs | 10.8µs | −28%   |
| complex struct encode          | ~1500ns| 1245ns | −17%   |
| U64LE.encode (single)          | 439ns  | 171ns  | −61%   |
| cstring.encode (single)        | 587ns  | 340ns  | −42%   |
| U32LE.encode (single)          | 397ns  | 338ns  | −15%   |
| U8.encode (single)             | 406ns  | ~390ns | ~flat  |

Decodes unchanged (writer not involved). Tests added: interleaved carved/caller
buffers, chunk-boundary crossings (3-byte elements against 64/512/4096 chunk sizes),
oversized `bytes()` next to carved writes; the `finish: clean owned buffers` test now
checks chunk zeroization property-wise. 181 tests, `npm run check` (12), build, and
`test:slow` all pass.

### B. Per-element path-tracking allocations in `array` — LANDED (same day), ~−10%

Every array element decode/encode allocated a template string `` `${i}` `` and a closure
for `fieldFn`, purely to attribute errors/debug output to a path. Landed design:
`Reader`/`Writer` gained `enterField(field)` / `exitField()` methods that set/clear
`field` on the top `PathStack` entry (indices stay numbers, stringified lazily in
`Path.path()`); `_PathObjFn` became a plain `() => void`; struct/tuple/array loops call
the methods inline. The debugger no longer intercepts closures — `DebugReader` overrides
`enterField`/`exitField` to capture per-field byte ranges, and its table output was
verified byte-identical before/after. `enterField` keeps a cheap state guard (field
outside `pushObj` scope / nested field on one object throws); measured free vs the
guardless variant. Error message paths are unchanged (e.g. `Writer(data/1/x): …`).

Measured on realistic workloads (10k-element `array(U32LE, U32LE)`, nested struct,
50-element tx-like array of structs; ns/op, median of repeated runs):

| bench            | before | after  | Δ     |
|------------------|--------|--------|-------|
| ints.decode      | 77.1µs | 69.3µs | −10%  |
| ints.encode      | 807µs  | 741µs  | −8%   |
| complex.decode   | 799ns  | 724ns  | −9%   |
| complex.encode   | 1628ns | 1425ns | −12%  |
| tx.decode        | 9.4µs  | 8.6µs  | −9%   |
| tx.encode        | 19.9µs | 16.9µs | −15%  |

The earlier prototype's −34% array-decode figure did not reproduce in the final,
guard-preserving, debugger-compatible implementation; post-change profiles show the
remaining per-element decode cost is `wrap()`/`validate()` dispatch (try/catch + double
`decodeStream` indirection per element) and `readView`/`markBytes`, not path tracking.
Those are candidates for a separate pass. Includes a micro-fix: `Writer.finish()` skips
the `buffers.concat(ptrs.map(...))` allocation when there are no pointers.

Observable changes: `_PathObjFn` shape (internal, used only by `debugger.ts`) and
`rw.stack[i].field` now holding numbers for array/tuple indices (the `pathStack` test
was updated to normalize).

### C. Smaller candidates (measured or estimated, lower priority)

- `int()` builds on `bigint()` + `numberBigint`, paying bigint tax for ≤48-bit numbers.
  A DataView-based number path (two `getUint32` for 5–6 bytes) would help protocols
  using odd-width ints; U8–U32 already bypass this via `intView`.
- `bigint(8, …)` could special-case `DataView.getBigUint64/setBigUint64`; after the
  change in §5 the remaining win is small (~166ns → ~140ns estimated).
- `_Reader` constructs a `DataView` eagerly; decodes that never touch `readView`
  (pure byte/bits protocols) pay one allocation per decode. Lazy getter is a wash for
  number-heavy protocols; only worth bundling with other Reader changes.

## Correctness notes (reviewed, found sound)

- `Writer.bits` with values ≥ 2^31: intermediate int32 coercions (`value >> 24` etc.)
  produce negative intermediates, but `Uint8Array` construction wraps mod 256, which
  matches two's-complement — output bytes are correct. Covered by `bits: u32 single`.
- `Bitset.setRange(allowRewrite=false)` pre-checks the whole range before mutating, so a
  late overlap cannot leave earlier chunks marked. `first === last` single-chunk masks
  verified for boundary positions.
- Pointer safety: the root reader owns the bitset; child readers translate positions via
  `parentOffset` chains; `_enablePointers` seeds `[0, pos)` before the first pointed
  read. Double-read rejection verified by tests including nested pointers.
- `lengthCoder` converts bigint lengths through `Number()` then `isNum` — oversized
  bigints fail the safe-integer check rather than silently truncating.
- `Path.err` preserves `TypeError`/`RangeError` subclasses and rewrites stacks without
  attaching `cause` (intentional, per inline comment).
- `decimal` rejects negative zero and non-canonical strings; `tsEnum.decode` rejects
  numeric reverse-map keys via `hasOwn` + `isNum` check.
- `mappedTag` builds variant records via `Object.fromEntries`, which creates `__proto__`
  as an own property rather than mutating the prototype (and `map()`/`struct()` field
  validation rejects it anyway).
- `magic()` skips comparison only when both sides are non-byte objects (documented);
  byte constants compare by contents.
- KMP terminator matching (`createFindBytes`) is linear; array/bytes terminator decode
  advances the cursor between finds, so total work stays linear in input size.

