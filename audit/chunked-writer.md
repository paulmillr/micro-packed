# Chunked writer design

## Problem

Encoding was ~10x slower than decoding on numeric workloads (10k-element
`array(U32LE, U32LE)`: 807µs encode vs 77µs decode). CPU profile of the old writer:

| self time | where | cost |
|---|---|---|
| 35% | `writeView` | per number: write into shared 8-byte scratch, `slice()` a fresh buffer, push into `buffers` + `cleanBuffers`, zero-fill the scratch |
| 25% | `finish` | concatenate ~10k tiny buffers, zeroize each `cleanBuffers` entry individually |

`byte()` had the same shape: one 1-byte `Uint8Array` allocation per call, tracked in two
arrays. The allocator and GC dominated; the actual byte stores were noise.

## Design

Writes come in two kinds, and the writer keeps them distinct:

- **Carved writes** (`byte`, `bits` flushes, `writeView`): copied into **writer-owned
  chunks**. Consecutive carved writes extend a mutable *run* — `{ chunk, start, end }` —
  so a burst of numeric writes costs one `buffers[]` entry, not one per write.
- **Caller writes** (`bytes(b)`): pushed into `buffers[]` **by reference**, unchanged
  from the old design (mutating the buffer before `finish()` still changes the output).
  A caller write closes the open run; the next carved write opens a new run, usually in
  the same chunk.

So `buffers: (Bytes | ChunkRun)[]` is an ordered mix of caller buffers and runs, and
`finish()` concatenates it discriminating with `isBytes()`.

### Core: `carve(len)`

```
private carve(len: number): number   // reserves len contiguous bytes, returns offset in this.chunk
```

If the current chunk has fewer than `len` bytes free, a new chunk is allocated and the
old chunk's tail is abandoned (it stays zero and belongs to no run, so it never reaches
the output). This guarantees a single write never straddles chunks — `writeView` can
hand the coder a `DataView` + offset and let it store directly.

### Chunk sizing

```
size = max(len, nextChunkSize, 64);  nextChunkSize = min(size * 8, 4096)
```

- **64-byte floor**: typical struct encodes fit in one chunk. This was measured, not
  guessed: sizing the first chunk to the first write (the earlier prototype's policy)
  left small structs spanning 2+ chunks, and per-chunk `DataView` creation became 21% of
  complex-struct encode. The floor costs tiny encodes one 64-byte allocation +
  zeroization instead of a 1–4-byte one, which is ~flat in measurements and still below
  the old design's cost.
- **×8 geometric growth capped at 4KB**: amortizes allocation for large encodes while
  bounding both over-allocation and the zeroization work at `finish()`.

### Lazy DataView

`chunkView` is created on first `writeView()` into a chunk and cached until the chunk is
replaced. Writers that only see `byte()`/`bits()`/`bytes()` never allocate a view. This
is what fixed the earlier prototype's U8 single-encode regression (397 → 527ns there;
~flat now).

### `finish(clean)`

Sums entry lengths (`b.length` or `end - start`), copies buffers/runs/pointer-buffers in
order into one fresh output buffer, patches pointer values — same structure as before.
Cleanup (`clean=true`) zeroizes **whole chunks** instead of individual scratch buffers,
resets all chunk state, and wipes pointer buffers exactly as before. `finish(false)`
(used by the array-terminator ambiguity check) still snapshots without cleanup; open
runs keep extending afterwards, which is safe because the snapshot is a copy.

## Preserved semantics

- Caller `bytes()` buffers by reference until `finish()`; never zeroized.
- All error messages and their ordering (`buffer: finished`, `writeByte: wrong value=`,
  `wrong writeView length=` before the callback runs, bit-buffer guards).
- `pos` accounting, pointer patching, `finish(false)` mid-stream snapshots.
- `bits()` int32-coercion behavior: `chunk[i] = bitBuf` wraps mod 256 exactly like the
  old `new Uint8Array([bitBuf])`.
- Zeroization hygiene (see below).

## Security / data-retention analysis

The design was constrained by the zeroization guarantees, reviewed explicitly:

1. **Writer-local, not pooled across writers.** Chunks are freshly allocated per writer
   and die with it. A shared/global chunk pool was rejected: it would let one encode's
   plaintext survive into another encode's address space and break the zeroization
   story entirely. "Pooling" here means only run-sharing within one writer.
2. **Zeroization is a superset of the old behavior.** Old: each writer-owned scratch
   buffer in `cleanBuffers` was `fill(0)`ed at `finish()`. New: every chunk is wiped
   whole, including unused tails — which only ever contain allocation zeros, since
   carved bytes are always part of a run and abandoned tails are never written.
   Pointer buffers are wiped as before; caller buffers are untouched as before.
3. **Exception paths unchanged.** If encode throws before `finish()`, chunks are
   GC-reclaimed without wiping — identical to the old `cleanBuffers` behavior. No
   regression, no improvement.
4. **One visibility change, not a boundary change.** `writeView` callbacks now receive
   a `DataView` over the whole current chunk (old: an 8-byte scratch zeroed between
   calls), so a custom coder's write fn can observe other bytes of the same in-progress
   encode. This crosses no trust boundary: coder callbacks already hold the writer
   object in the same realm, and TypeScript `private` is not a runtime barrier.
5. **Output aliasing.** The returned buffer is always a fresh copy; no chunk or run
   escapes the writer.

## Internal API changes (not in the public `Writer` type)

- `writeView(len, fn)` callback signature: `(view: DataView)` writing at offset 0 →
  `(view: DataView, pos: number)` writing at `pos`.
- `ViewCoder.write`: `(view, value)` → `(view, pos, value)` (all 10 int defs + f32/f64).
- `_Writer` internals: `cleanBuffers`/`viewBuf`/`view` replaced by
  `chunks`/`chunk`/`chunkView`/`chunkPos`/`run`/`nextChunkSize`; `buffers` element type
  widened to `Bytes | ChunkRun`.

## Results

Node 24 x86-64, steady-state medians (intra-process reps after warmup where noted).
Baseline = the tree immediately before this change (HEAD ca4da0f + the
enterField/exitField path-tracking change from the same session).

| bench | before | after | Δ |
|---|---|---|---|
| `array(10k×U32LE).encode` | 741µs | 196µs | **−74% (3.8x)** |
| tx-like array-of-structs encode (50 el.) | 15.1µs | 10.8µs | −28% |
| nested struct encode | ~1500ns | 1245ns | −17% |
| `U64LE.encode` (single) | 439ns | 171ns | −61% |
| `cstring.encode` (single) | 587ns | 340ns | −42% |
| `U32LE.encode` (single) | 397ns | 338ns | −15% |
| `U8.encode` (single) | 406ns | ~390ns | ~flat |

Versus the original HEAD (before both session changes), 10k-int encode is 807µs → 196µs
(**4.1x**). Decode paths are untouched by the writer.

## Rejected alternatives

- **Single realloc'd buffer with copy-on-grow**: rejected long ago in an inline comment
  (basic encode 395 → 560ns) and re-confirmed conceptually — chunking gets the
  amortization without the copies and without breaking caller-buffer-by-reference.
- **First chunk sized to the first write** (earlier prototype): superseded by the
  64-byte floor after profiling showed per-chunk `DataView` creation dominating small
  struct encodes.
- **Cross-writer chunk pool**: rejected for retention reasons (see Security §1).

## Verification

- 181 tests pass, including new ones: interleaved carved/caller buffers; chunk-boundary
  crossings (3-byte elements against 64/512/4096 chunk sizes, plus an oversized
  `bytes()` between carved writes); `finish: clean owned buffers` reworked to assert
  whole-chunk zeroization property-wise.
- `npm run build`, all 12 `npm run check` checks, and `npm run test:slow` (multi-GB
  stress) pass.
