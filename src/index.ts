import { base64, hex as baseHex, utf8 } from '@scure/base';
import type { Coder as BaseCoder } from '@scure/base';

/**
 * Define complex binary structures using composable primitives.
 * TODO:
 * - Holes, simplify pointers. Hole is some sized element which is skipped at encoding,
 *   but later other elements can write to it by path
 * - Composite / tuple keys for dict
 * - Web UI for easier debugging. We can wrap every coder to something that would write
 *   start & end positions to; and we can colorize specific bytes used by specific coder
 * @module
 * @example
 * import * as P from 'micro-packed';
 * let s = P.struct({
 *   field1: P.U32BE, // 32-bit unsigned big-endian integer
 *   field2: P.string(P.U8), // String with U8 length prefix
 *   field3: P.bytes(32), // 32 bytes
 *   field4: P.array(P.U16BE, P.struct({ // Array of structs with U16BE length
 *     subField1: P.U64BE, // 64-bit unsigned big-endian integer
 *     subField2: P.string(10) // 10-byte string
 *   }))
 * });
 */

/**
 * Zero-length empty byte array.
 */
export const EMPTY = /* @__PURE__ */ new Uint8Array();
/**
 * NULL byte array.
 */
export const NULL = /* @__PURE__ */ new Uint8Array([0]);

/**
 * Checks if two Uint8Arrays are equal. Not constant-time.
 */
function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
/**
 * Checks if the given value is a Uint8Array.
 */
function isBytes(a: unknown): a is Bytes {
  return (
    a instanceof Uint8Array ||
    (a != null && typeof a === 'object' && a.constructor.name === 'Uint8Array')
  );
}

/**
 * Concatenates multiple Uint8Arrays.
 */
function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  let sum = 0;
  for (let i = 0; i < arrays.length; i++) {
    const a = arrays[i];
    if (!isBytes(a)) throw new Error('Uint8Array expected');
    sum += a.length;
  }
  const res = new Uint8Array(sum);
  for (let i = 0, pad = 0; i < arrays.length; i++) {
    const a = arrays[i];
    res.set(a, pad);
    pad += a.length;
  }
  return res;
}

export const utils = { equalBytes, isBytes, concatBytes };

// Types
export type Bytes = Uint8Array;
export type Option<T> = T | undefined;
/**
 * Interface for a coder that encodes and decodes between two types.
 * @property {(from: F) => T} encode - Encodes a value of type F to type T.
 * @property {(to: T) => F} decode - Decodes a value of type T to type F.
 */
export interface Coder<F, T> {
  encode(from: F): T;
  decode(to: T): F;
}
/**
 * Interface for a bytes coder that encodes and decodes between a type and a byte array.
 * @property {number} [size] - Size hint for the element.
 * @property {(data: T) => Bytes} encode - Encodes a value of type T to a byte array.
 * @property {(data: Bytes) => T} decode - Decodes a byte array to a value of type T.
 */
export interface BytesCoder<T> extends Coder<T, Bytes> {
  size?: number; // Size hint element
  encode: (data: T) => Bytes;
  decode: (data: Bytes) => T;
}
/**
 * Interface for a bytes coder stream that encodes and decodes between a type and a byte array using streams.
 * @property {number} [size] - Size hint for the element.
 * @property {(w: Writer, value: T) => void} encodeStream - Encodes a value of type T to a byte array using a Writer stream.
 * @property {(r: Reader) => T} decodeStream - Decodes a byte array to a value of type T using a Reader stream.
 */
export interface BytesCoderStream<T> {
  size?: number;
  encodeStream: (w: Writer, value: T) => void;
  decodeStream: (r: Reader) => T;
}
export type CoderType<T> = BytesCoderStream<T> & BytesCoder<T>;
export type Sized<T> = CoderType<T> & { size: number };
export type UnwrapCoder<T> = T extends CoderType<infer U> ? U : T;

// NOTE: we can't have terminator separate function, since it won't know about boundaries
// E.g. array of U16LE ([1,2,3]) would be [1, 0, 2, 0, 3, 0]
// But terminator will find array at index '1', which happens to be inside of an element itself
/**
 * Can be:
 * - Dynamic (CoderType)
 * - Fixed (number)
 * - Terminated (usually zero): Uint8Array with terminator
 * - Field path to field with length (string)
 * - Infinity (null) - decodes until end of buffer
 */
export type Length = CoderType<number> | CoderType<bigint> | number | Bytes | string | null;

type ArrLike<T> = Array<T> | ReadonlyArray<T>;
// prettier-ignore
export type TypedArray =
  | Uint8Array  | Int8Array | Uint8ClampedArray
  | Uint16Array | Int16Array
  | Uint32Array | Int32Array;

/**
 * Writable version of a type, where readonly properties are made writable.
 */
export type Writable<T> = T extends {}
  ? T extends TypedArray
    ? T
    : {
        -readonly [P in keyof T]: Writable<T[P]>;
      }
  : T;
export type Values<T> = T[keyof T];
export type NonUndefinedKey<T, K extends keyof T> = T[K] extends undefined ? never : K;
export type NullableKey<T, K extends keyof T> = T[K] extends NonNullable<T[K]> ? never : K;
// Opt: value !== undefined, but value === T|undefined
export type OptKey<T, K extends keyof T> = NullableKey<T, K> & NonUndefinedKey<T, K>;
export type ReqKey<T, K extends keyof T> = T[K] extends NonNullable<T[K]> ? K : never;

export type OptKeys<T> = Pick<T, { [K in keyof T]: OptKey<T, K> }[keyof T]>;
export type ReqKeys<T> = Pick<T, { [K in keyof T]: ReqKey<T, K> }[keyof T]>;
export type StructInput<T extends Record<string, any>> = { [P in keyof ReqKeys<T>]: T[P] } & {
  [P in keyof OptKeys<T>]?: T[P];
};
export type StructRecord<T extends Record<string, any>> = {
  [P in keyof T]: CoderType<T[P]>;
};

export type StructOut = Record<string, any>;
/**
 * Padding function that takes an index and returns a padding value.
 */
export type PadFn = (i: number) => number;

/**
 * Small bitset structure to store position of ranges that have been read.
 * Possible can be even more efficient by using some interval trees, but would be more complex
 * Needs `O(N/8)` memory for parsing.
 * Purpose: if there are pointers in parsed structure,
 * they can cause read of two distinct ranges:
 * [0-32, 64-128], which means 'pos' is not enough to handle them
 */
const Bitset = {
  BITS: 32,
  FULL_MASK: -1 >>> 0, // 1<<32 will overflow
  len: (len: number) => Math.ceil(len / 32),
  create: (len: number) => new Uint32Array(Bitset.len(len)),
  clean: (bs: Uint32Array) => bs.fill(0),
  debug: (bs: Uint32Array) => Array.from(bs).map((i) => (i >>> 0).toString(2).padStart(32, '0')),
  checkLen: (bs: Uint32Array, len: number) => {
    if (Bitset.len(len) === bs.length) return;
    throw new Error(`bitSet: wrong length=${bs.length}. Expected: ${Bitset.len(len)}`);
  },
  chunkLen: (bsLen: number, pos: number, len: number) => {
    if (pos < 0) throw new Error(`bitset: wrong pos=${pos}`);
    if (pos + len > bsLen) throw new Error(`bitSet: wrong range=${pos}/${len} of ${bsLen}`);
  },
  set: (bs: Uint32Array, chunk: number, value: number, allowRewrite = true) => {
    if (!allowRewrite && (bs[chunk] & value) !== 0) return false;
    bs[chunk] |= value;
    return true;
  },
  pos: (pos: number, i: number) => ({
    chunk: Math.floor((pos + i) / 32),
    mask: 1 << (32 - ((pos + i) % 32) - 1),
  }),
  indices: (bs: Uint32Array, len: number, invert = false) => {
    Bitset.checkLen(bs, len);
    const { FULL_MASK, BITS } = Bitset;
    const left = BITS - (len % BITS);
    const lastMask = left ? (FULL_MASK >>> left) << left : FULL_MASK;
    const res = [];
    for (let i = 0; i < bs.length; i++) {
      let c = bs[i];
      if (invert) c = ~c; // allows to gen unset elements
      // apply mask to last element, so we won't iterate non-existent items
      if (i === bs.length - 1) c &= lastMask;
      if (c === 0) continue; // fast-path
      for (let j = 0; j < BITS; j++) {
        const m = 1 << (BITS - j - 1);
        if (c & m) res.push(i * BITS + j);
      }
    }
    return res;
  },
  range: (arr: number[]) => {
    const res = [];
    let cur;
    for (const i of arr) {
      if (cur === undefined || i !== cur.pos + cur.length) res.push((cur = { pos: i, length: 1 }));
      else cur.length += 1;
    }
    return res;
  },
  rangeDebug: (bs: Uint32Array, len: number, invert = false) =>
    `[${Bitset.range(Bitset.indices(bs, len, invert))
      .map((i) => `(${i.pos}/${i.length})`)
      .join(', ')}]`,
  setRange: (bs: Uint32Array, bsLen: number, pos: number, len: number, allowRewrite = true) => {
    Bitset.chunkLen(bsLen, pos, len);
    const { FULL_MASK, BITS } = Bitset;
    // Try to set range with maximum efficiency:
    // - first chunk is always    '0000[1111]' (only right ones)
    // - middle chunks are set to '[1111 1111]' (all ones)
    // - last chunk is always     '[1111]0000' (only left ones)
    // - max operations:          (N/32) + 2 (first and last)
    const first = pos % BITS ? Math.floor(pos / BITS) : undefined;
    const lastPos = pos + len;
    const last = lastPos % BITS ? Math.floor(lastPos / BITS) : undefined;
    // special case, whole range inside single chunk
    if (first !== undefined && first === last)
      return Bitset.set(
        bs,
        first,
        (FULL_MASK >>> (BITS - len)) << (BITS - len - pos),
        allowRewrite
      );
    if (first !== undefined) {
      if (!Bitset.set(bs, first, FULL_MASK >>> pos % BITS, allowRewrite)) return false; // first chunk
    }
    // middle chunks
    const start = first !== undefined ? first + 1 : pos / BITS;
    const end = last !== undefined ? last : lastPos / BITS;
    for (let i = start; i < end; i++) if (!Bitset.set(bs, i, FULL_MASK, allowRewrite)) return false;
    if (last !== undefined && first !== last)
      if (!Bitset.set(bs, last, FULL_MASK << (BITS - (lastPos % BITS)), allowRewrite)) return false; // last chunk
    return true;
  },
};

/**
 * Options for the Reader class.
 * @property {boolean} [allowUnreadBytes: false] - If there are remaining unparsed bytes, the decoding is probably wrong.
 * @property {boolean} [allowMultipleReads: false] - The check enforces parser termination. If pointers can read the same region of memory multiple times, you can cause combinatorial explosion by creating an array of pointers to the same address and cause DoS.
 */
export type ReaderOpts = {
  allowUnreadBytes?: boolean;
  allowMultipleReads?: boolean;
};

/**
 * Internal structure. Reader class for reading from a byte array.
 * @class Reader
 */
export class Reader {
  pos = 0;
  bitBuf = 0;
  bitPos = 0;
  private bs: Uint32Array | undefined;
  constructor(
    readonly data: Bytes,
    readonly opts: ReaderOpts = {},
    public path: StructOut[] = [],
    public fieldPath: string[] = [],
    private parent: Reader | undefined = undefined,
    public parentOffset: number = 0
  ) {}
  enablePtr(): void {
    if (this.parent) return this.parent.enablePtr();
    if (this.bs) return;
    this.bs = Bitset.create(this.data.length);
    Bitset.setRange(this.bs, this.data.length, 0, this.pos, this.opts.allowMultipleReads);
  }
  private markBytesBS(pos: number, len: number): boolean {
    if (this.parent) return this.parent.markBytesBS(this.parentOffset + pos, len);
    if (!len) return true;
    if (!this.bs) return true;
    return Bitset.setRange(this.bs, this.data.length, pos, len, false);
  }
  private markBytes(len: number): boolean {
    const pos = this.pos;
    this.pos += len;
    const res = this.markBytesBS(pos, len);
    if (!this.opts.allowMultipleReads && !res)
      throw this.err(`multiple read pos=${this.pos} len=${len}`);
    return res;
  }
  err(msg: string) {
    return new Error(`Reader(${this.fieldPath.join('/')}): ${msg}`);
  }
  // read bytes by absolute offset
  absBytes(n: number) {
    if (n > this.data.length) throw new Error('absBytes: Unexpected end of buffer');
    return this.data.subarray(n);
  }
  // return reader using offset
  offsetReader(n: number) {
    return new Reader(this.absBytes(n), this.opts, this.path, this.fieldPath, this, n);
  }
  bytes(n: number, peek = false) {
    if (this.bitPos) throw this.err('readBytes: bitPos not empty');
    if (!Number.isFinite(n)) throw this.err(`readBytes: wrong length=${n}`);
    if (this.pos + n > this.data.length) throw this.err('readBytes: Unexpected end of buffer');
    const slice = this.data.subarray(this.pos, this.pos + n);
    if (!peek) this.markBytes(n);
    return slice;
  }
  byte(peek = false): number {
    if (this.bitPos) throw this.err('readByte: bitPos not empty');
    if (this.pos + 1 > this.data.length) throw this.err('readBytes: Unexpected end of buffer');
    const data = this.data[this.pos];
    if (!peek) this.markBytes(1);
    return data;
  }
  get leftBytes(): number {
    return this.data.length - this.pos;
  }
  isEnd(): boolean {
    return this.pos >= this.data.length && !this.bitPos;
  }
  length(len: Length): number {
    let byteLen;
    if (isCoder(len)) byteLen = Number(len.decodeStream(this));
    else if (typeof len === 'number') byteLen = len;
    else if (typeof len === 'string') byteLen = getPath(this.path, len.split('/'));
    if (typeof byteLen === 'bigint') byteLen = Number(byteLen);
    if (typeof byteLen !== 'number') throw this.err(`Wrong length: ${byteLen}`);
    return byteLen;
  }
  // bits are read in BE mode (left to right): (0b1000_0000).readBits(1) == 1
  bits(bits: number) {
    if (bits > 32) throw this.err('BitReader: cannot read more than 32 bits in single call');
    let out = 0;
    while (bits) {
      if (!this.bitPos) {
        this.bitBuf = this.byte();
        this.bitPos = 8;
      }
      const take = Math.min(bits, this.bitPos);
      this.bitPos -= take;
      out = (out << take) | ((this.bitBuf >> this.bitPos) & (2 ** take - 1));
      this.bitBuf &= 2 ** this.bitPos - 1;
      bits -= take;
    }
    // Fix signed integers
    return out >>> 0;
  }
  find(needle: Bytes, pos = this.pos) {
    if (!isBytes(needle)) throw this.err(`find: needle is not bytes! ${needle}`);
    if (this.bitPos) throw this.err('findByte: bitPos not empty');
    if (!needle.length) throw this.err(`find: needle is empty`);
    // indexOf should be faster than full equalBytes check
    for (let idx = pos; (idx = this.data.indexOf(needle[0], idx)) !== -1; idx++) {
      if (idx === -1) return;
      const leftBytes = this.data.length - idx;
      if (leftBytes < needle.length) return;
      if (equalBytes(needle, this.data.subarray(idx, idx + needle.length))) return idx;
    }
    return;
  }
  finish() {
    if (this.opts.allowUnreadBytes) return;
    if (this.bitPos) {
      throw this.err(
        `${this.bitPos} bits left after unpack: ${baseHex.encode(this.data.slice(this.pos))}`
      );
    }
    if (this.bs && !this.parent) {
      const notRead = Bitset.indices(this.bs, this.data.length, true);
      if (notRead.length) {
        const formatted = Bitset.range(notRead)
          .map(
            ({ pos, length }) =>
              `(${pos}/${length})[${baseHex.encode(this.data.subarray(pos, pos + length))}]`
          )
          .join(', ');
        throw this.err(`unread byte ranges: ${formatted} (total=${this.data.length})`);
      } else return; // all bytes read, everything is ok
    }
    // Default: no pointers enabled
    if (!this.isEnd()) {
      throw this.err(
        `${this.leftBytes} bytes ${this.bitPos} bits left after unpack: ${baseHex.encode(
          this.data.slice(this.pos)
        )}`
      );
    }
  }
  fieldPathPush(s: string) {
    this.fieldPath.push(s);
  }
  fieldPathPop() {
    this.fieldPath.pop();
  }
}
/**
 * Internal structure. Writer class for writing to a byte array.
 * @class Writer
 */
export class Writer {
  private buffers: Bytes[] = [];
  pos: number = 0;
  ptrs: { pos: number; ptr: CoderType<number>; buffer: Bytes }[] = [];
  bitBuf = 0;
  bitPos = 0;
  constructor(
    public path: StructOut[] = [],
    public fieldPath: string[] = []
  ) {}
  err(msg: string) {
    return new Error(`Writer(${this.fieldPath.join('/')}): ${msg}`);
  }
  bytes(b: Bytes) {
    if (this.bitPos) throw this.err('writeBytes: ends with non-empty bit buffer');
    this.buffers.push(b);
    this.pos += b.length;
  }
  byte(b: number) {
    if (this.bitPos) throw this.err('writeByte: ends with non-empty bit buffer');
    this.buffers.push(new Uint8Array([b]));
    this.pos++;
  }
  get buffer(): Bytes {
    if (this.bitPos) throw this.err('buffer: ends with non-empty bit buffer');
    let buf = concatBytes(...this.buffers);
    for (let ptr of this.ptrs) {
      const pos = buf.length;
      buf = concatBytes(buf, ptr.buffer);
      const val = ptr.ptr.encode(pos);
      for (let i = 0; i < val.length; i++) buf[ptr.pos + i] = val[i];
    }
    return buf;
  }
  length(len: Length, value: number) {
    if (len === null) return;
    if (isCoder(len)) return len.encodeStream(this, value);
    let byteLen;
    if (typeof len === 'number') byteLen = len;
    else if (typeof len === 'string') byteLen = getPath(this.path, len.split('/'));
    if (typeof byteLen === 'bigint') byteLen = Number(byteLen);
    if (byteLen === undefined || byteLen !== value)
      throw this.err(`Wrong length: ${byteLen} len=${len} exp=${value}`);
  }
  bits(value: number, bits: number) {
    if (bits > 32) throw this.err('writeBits: cannot write more than 32 bits in single call');
    if (value >= 2 ** bits) throw this.err(`writeBits: value (${value}) >= 2**bits (${bits})`);
    while (bits) {
      const take = Math.min(bits, 8 - this.bitPos);
      this.bitBuf = (this.bitBuf << take) | (value >> (bits - take));
      this.bitPos += take;
      bits -= take;
      value &= 2 ** bits - 1;
      if (this.bitPos === 8) {
        this.bitPos = 0;
        this.buffers.push(new Uint8Array([this.bitBuf]));
        this.pos++;
      }
    }
  }
  fieldPathPush(s: string) {
    this.fieldPath.push(s);
  }
  fieldPathPop() {
    this.fieldPath.pop();
  }
}
// Immutable LE<->BE
const swap = (b: Bytes): Bytes => Uint8Array.from(b).reverse();
/**
 * Internal function for checking bit bounds of bigint in signed/unsinged form
 */
export function checkBounds(p: Writer | Reader, value: bigint, bits: bigint, signed: boolean) {
  if (signed) {
    // [-(2**(32-1)), 2**(32-1)-1]
    const signBit = 2n ** (bits - 1n);
    if (value < -signBit || value >= signBit) throw p.err('sInt: value out of bounds');
  } else {
    // [0, 2**32-1]
    if (0n > value || value >= 2n ** bits) throw p.err('uInt: value out of bounds');
  }
}

/**
 * Wraps a stream encoder into a generic encoder.
 * @param inner - The inner BytesCoderStream.
 * @returns The wrapped CoderType.
 * @example
 * const U8 = P.wrap({
 *   encodeStream: (w: Writer, value: number) => w.byte(value),
 *   decodeStream: (r: Reader): number => r.byte()
 * });
 */
export function wrap<T>(inner: BytesCoderStream<T>): BytesCoderStream<T> & BytesCoder<T> {
  return {
    ...inner,
    encode: (value: T): Bytes => {
      const w = new Writer();
      inner.encodeStream(w, value);
      return w.buffer;
    },
    decode: (data: Bytes, opts: ReaderOpts = {}): T => {
      const r = new Reader(data, opts);
      const res = inner.decodeStream(r);
      r.finish();
      return res;
    },
  };
}

function getPath(objPath: Record<string, any>[], path: string[]): Option<any> {
  objPath = Array.from(objPath);
  let i = 0;
  for (; i < path.length; i++) {
    if (path[i] === '..') objPath.pop();
    else break;
  }
  let cur = objPath.pop();
  for (; i < path.length; i++) {
    if (!cur || cur[path[i]] === undefined) return undefined;
    cur = cur[path[i]];
  }
  return cur;
}
/**
 * Checks if the given value is a CoderType.
 * @param elm - The value to check.
 * @returns True if the value is a CoderType, false otherwise.
 */
export function isCoder<T>(elm: any): elm is CoderType<T> {
  return (
    elm !== null &&
    typeof elm === 'object' &&
    typeof (elm as CoderType<T>).encode === 'function' &&
    typeof (elm as CoderType<T>).encodeStream === 'function' &&
    typeof (elm as CoderType<T>).decode === 'function' &&
    typeof (elm as CoderType<T>).decodeStream === 'function'
  );
}

// Coders (like in @scure/base) for common operations
// TODO:
// - move to base? very generic converters, not releated to base and packed
// - encode/decode -> from/to? coder->convert?
/**
 * Base coder for working with dictionaries (records, objects, key-value map)
 * Dictionary is dynamic type like: `[key: string, value: any][]`
 * @returns base coder that encodes/decodes between arrays of key-value tuples and dictionaries.
 * @example
 * const dict: P.CoderType<Record<string, number>> = P.apply(
 *  P.array(P.U16BE, P.tuple([P.cstring, P.U32LE] as const)),
 *  P.coders.dict()
 * );
 */
function dict<T>(): BaseCoder<[string, T][], Record<string, T>> {
  return {
    encode: (from: [string, T][]): Record<string, T> => {
      const to: Record<string, T> = {};
      for (const [name, value] of from) {
        if (to[name] !== undefined)
          throw new Error(`coders.dict: same key(${name}) appears twice in struct`);
        to[name] = value;
      }
      return to;
    },
    decode: (to: Record<string, T>): [string, T][] => Object.entries(to),
  };
}
/**
 * Safely converts bigint to number.
 * Sometimes pointers / tags use u64 or other big numbers which cannot be represented by number,
 * but we still can use them since real value will be smaller than u32
 */
const number: BaseCoder<bigint, number> = {
  encode: (from: bigint): number => {
    if (from > BigInt(Number.MAX_SAFE_INTEGER))
      throw new Error(`coders.number: element bigger than MAX_SAFE_INTEGER=${from}`);
    return Number(from);
  },
  decode: (to: number): bigint => {
    if (!Number.isSafeInteger(to)) throw new Error('coders.number: element is not safe integer');
    return BigInt(to);
  },
};
// TODO: replace map with this?
type Enum = { [k: string]: number | string } & { [k: number]: string };
// Doesn't return numeric keys, so it's fine
type EnumKeys<T extends Enum> = keyof T;
/**
 * Base coder for working with TypeScript enums.
 * @param e - TypeScript enum.
 * @returns base coder that encodes/decodes between numbers and enum keys.
 * @example
 * enum Color { Red, Green, Blue }
 * const colorCoder = P.coders.tsEnum(Color);
 * colorCoder.encode(Color.Red); // 'Red'
 * colorCoder.decode('Green'); // 1
 */
function tsEnum<T extends Enum>(e: T): BaseCoder<number, EnumKeys<T>> {
  return {
    encode: (from: number): string => e[from],
    decode: (to: string): number => e[to] as number,
  };
}
/**
 * Base coder for working with decimal numbers.
 * @param precision - Number of decimal places.
 * @returns base coder that encodes/decodes between bigints and decimal strings.
 * @example
 * const decimal8 = P.coders.decimal(8);
 * decimal8.encode(630880845n); // '6.30880845'
 * decimal8.decode('6.30880845'); // 630880845n
 */
function decimal(precision: number) {
  const decimalMask = 10n ** BigInt(precision);
  return {
    encode: (from: bigint): string => {
      let s = (from < 0n ? -from : from).toString(10);
      let sep = s.length - precision;
      if (sep < 0) {
        s = s.padStart(s.length - sep, '0');
        sep = 0;
      }
      let i = s.length - 1;
      for (; i >= sep && s[i] === '0'; i--);
      let [int, frac] = [s.slice(0, sep), s.slice(sep, i + 1)];
      if (!int) int = '0';
      if (from < 0n) int = '-' + int;
      if (!frac) return int;
      return `${int}.${frac}`;
    },
    decode: (to: string): bigint => {
      let neg = false;
      if (to.startsWith('-')) {
        neg = true;
        to = to.slice(1);
      }
      let sep = to.indexOf('.');
      sep = sep === -1 ? to.length : sep;
      const [intS, fracS] = [to.slice(0, sep), to.slice(sep + 1)];
      const int = BigInt(intS) * decimalMask;
      const fracLen = Math.min(fracS.length, precision);
      const frac = BigInt(fracS.slice(0, fracLen)) * 10n ** BigInt(precision - fracLen);
      const value = int + frac;
      return neg ? -value : value;
    },
  };
}

// TODO: export from @scure/base?
type BaseInput<F> = F extends BaseCoder<infer T, any> ? T : never;
type BaseOutput<F> = F extends BaseCoder<any, infer T> ? T : never;

/**
 * Combines multiple coders into a single coder, allowing conditional encoding/decoding based on input.
 * Acts as a parser combinator, splitting complex conditional coders into smaller parts.
 *
 *   `encode = [Ae, Be]; decode = [Ad, Bd]`
 *   ->
 *   `match([{encode: Ae, decode: Ad}, {encode: Be; decode: Bd}])`
 *
 * @param lst - Array of coders to match.
 * @returns Combined coder for conditional encoding/decoding.
 */
function match<
  L extends BaseCoder<unknown | undefined, unknown | undefined>[],
  I = { [K in keyof L]: NonNullable<BaseInput<L[K]>> }[number],
  O = { [K in keyof L]: NonNullable<BaseOutput<L[K]>> }[number],
>(lst: L): BaseCoder<I, O> {
  return {
    encode: (from: I): O => {
      for (const c of lst) {
        const elm = c.encode(from);
        if (elm !== undefined) return elm as O;
      }
      throw new Error(`match/encode: cannot find match in ${from}`);
    },
    decode: (to: O): I => {
      for (const c of lst) {
        const elm = c.decode(to);
        if (elm !== undefined) return elm as I;
      }
      throw new Error(`match/decode: cannot find match in ${to}`);
    },
  };
}
/**
 * Reverses direction of coder
 */
const reverse = <F, T>(coder: Coder<F, T>): Coder<T, F> => ({
  encode: coder.decode,
  decode: coder.encode,
});

export const coders = { dict, number, tsEnum, decimal, match, reverse };

/**
 * CoderType for parsing individual bits.
 * NOTE: Structure should parse whole amount of bytes before it can start parsing byte-level elements.
 * @param len - Number of bits to parse.
 * @returns CoderType representing the parsed bits.
 * @example
 * let s = P.struct({ magic: P.bits(1), version: P.bits(1), tag: P.bits(4), len: P.bits(2) });
 */
export const bits = (len: number): CoderType<number> =>
  wrap({
    encodeStream: (w: Writer, value: number) => w.bits(value, len),
    decodeStream: (r: Reader): number => r.bits(len),
  });

/**
 * CoderType for working with bigint values.
 * Unsized bigint values should be wrapped in a container (e.g., bytes or string).
 *
 * `0n = new Uint8Array([])`
 *
 * `1n = new Uint8Array([1n])`
 *
 * Please open issue, if you need different behavior for zero.
 *
 * @param size - Size of the bigint in bytes.
 * @param le - Whether to use little-endian byte order.
 * @param signed - Whether the bigint is signed.
 * @param sized - Whether the bigint should have a fixed size.
 * @returns CoderType representing the bigint value.
 * @example
 * const uint64BE = P.bigint(8, false, true); // Define a CoderType for a 64-bit unsigned big-endian integer
 */
export const bigint = (size: number, le = false, signed = false, sized = true): CoderType<bigint> =>
  wrap({
    size: sized ? size : undefined,
    encodeStream: (w: Writer, value: bigint) => {
      if (typeof value !== 'bigint') throw w.err(`bigint: invalid value: ${value}`);
      let _value = BigInt(value);
      const bLen = BigInt(size);
      checkBounds(w, _value, 8n * bLen, !!signed);
      const signBit = 2n ** (8n * bLen - 1n);
      if (signed && _value < 0) _value = _value | signBit;
      let b = [];
      for (let i = 0; i < size; i++) {
        b.push(Number(_value & 255n));
        _value >>= 8n;
      }
      let res = new Uint8Array(b).reverse();
      if (!sized) {
        let pos = 0;
        for (pos = 0; pos < res.length; pos++) if (res[pos] !== 0) break;
        res = res.subarray(pos); // remove leading zeros
      }
      w.bytes(le ? res.reverse() : res);
    },
    decodeStream: (r: Reader): bigint => {
      const bLen = BigInt(size);
      // TODO: for le we can read until first zero?
      const value = r.bytes(sized ? size : Math.min(size, r.leftBytes));
      const b = le ? value : swap(value);
      const signBit = 2n ** (8n * bLen - 1n);
      let res = 0n;
      for (let i = 0; i < b.length; i++) res |= BigInt(b[i]) << (8n * BigInt(i));
      if (signed && res & signBit) res = (res ^ signBit) - signBit;
      checkBounds(r, res, 8n * bLen, !!signed);
      return res;
    },
  });
/**
 * Unsigned 256-bit little-endian integer CoderType.
 */
export const U256LE = /* @__PURE__ */ bigint(32, true);
/**
 * Unsigned 256-bit big-endian integer CoderType.
 */
export const U256BE = /* @__PURE__ */ bigint(32, false);
/**
 * Signed 256-bit little-endian integer CoderType.
 */
export const I256LE = /* @__PURE__ */ bigint(32, true, true);
/**
 * Signed 256-bit big-endian integer CoderType.
 */
export const I256BE = /* @__PURE__ */ bigint(32, false, true);
/**
 * Unsigned 128-bit little-endian integer CoderType.
 */
export const U128LE = /* @__PURE__ */ bigint(16, true);
/**
 * Unsigned 128-bit big-endian integer CoderType.
 */
export const U128BE = /* @__PURE__ */ bigint(16, false);
/**
 * Signed 128-bit little-endian integer CoderType.
 */
export const I128LE = /* @__PURE__ */ bigint(16, true, true);
/**
 * Signed 128-bit big-endian integer CoderType.
 */
export const I128BE = /* @__PURE__ */ bigint(16, false, true);
/**
 * Unsigned 64-bit little-endian integer CoderType.
 */
export const U64LE = /* @__PURE__ */ bigint(8, true);
/**
 * Unsigned 64-bit big-endian integer CoderType.
 */
export const U64BE = /* @__PURE__ */ bigint(8, false);
/**
 * Signed 64-bit little-endian integer CoderType.
 */
export const I64LE = /* @__PURE__ */ bigint(8, true, true);
/**
 * Signed 64-bit big-endian integer CoderType.
 */
export const I64BE = /* @__PURE__ */ bigint(8, false, true);

// TODO: we can speed-up if integers are used. Unclear if it's worth to increase code size.
// Also, numbers can't use >= 32 bits.
export const int = (size: number, le = false, signed = false, sized = true): CoderType<number> => {
  if (size > 6) throw new Error('int supports size up to 6 bytes (48 bits), for other use bigint');
  return apply(bigint(size, le, signed, sized), coders.number);
};
/**
 * Unsigned 32-bit little-endian integer CoderType.
 */
export const U32LE = /* @__PURE__ */ int(4, true);
/**
 * Unsigned 32-bit big-endian integer CoderType.
 */
export const U32BE = /* @__PURE__ */ int(4, false);
/**
 * Signed 32-bit little-endian integer CoderType.
 */
export const I32LE = /* @__PURE__ */ int(4, true, true);
/**
 * Signed 32-bit big-endian integer CoderType.
 */
export const I32BE = /* @__PURE__ */ int(4, false, true);
/**
 * Unsigned 16-bit little-endian integer CoderType.
 */
export const U16LE = /* @__PURE__ */ int(2, true);
/**
 * Unsigned 16-bit big-endian integer CoderType.
 */
export const U16BE = /* @__PURE__ */ int(2, false);
/**
 * Signed 16-bit little-endian integer CoderType.
 */
export const I16LE = /* @__PURE__ */ int(2, true, true);
/**
 * Signed 16-bit big-endian integer CoderType.
 */
export const I16BE = /* @__PURE__ */ int(2, false, true);
/**
 * Unsigned 8-bit integer CoderType.
 */
export const U8 = /* @__PURE__ */ int(1, false);
/**
 * Signed 8-bit integer CoderType.
 */
export const I8 = /* @__PURE__ */ int(1, false, true);
/**
 * Boolean CoderType.
 */
export const bool: CoderType<boolean> = /* @__PURE__ */ wrap({
  size: 1,
  encodeStream: (w: Writer, value: boolean) => w.byte(value ? 1 : 0),
  decodeStream: (r: Reader): boolean => {
    const value = r.byte();
    if (value !== 0 && value !== 1) throw r.err(`bool: invalid value ${value}`);
    return value === 1;
  },
});

/**
 * Bytes CoderType with a specified length and endianness.
 * The bytes can have:
 * - Dynamic size (prefixed with a length CoderType like U16BE)
 * - Fixed size (specified by a number)
 * - Unknown size (null, will parse until end of buffer)
 * - Zero-terminated (terminator can be any Uint8Array)
 * @param len - Length CoderType, number, Uint8Array (for terminator), or null.
 * @param le - Whether to use little-endian byte order.
 * @returns CoderType representing the bytes.
 * @example
 * // Dynamic size bytes (prefixed with P.U16BE number of bytes length)
 * const dynamicBytes = P.bytes(P.U16BE, false);
 *
 * @example
 * const fixedBytes = P.bytes(32, false); // Fixed size bytes
 * @example
 * const unknownBytes = P.bytes(null, false); // Unknown size bytes, will parse until end of buffer
 * @example
 * const zeroTerminatedBytes = P.bytes(new Uint8Array([0]), false); // Zero-terminated bytes
 */
export const bytes = (len: Length, le = false): CoderType<Bytes> =>
  wrap({
    size: typeof len === 'number' ? len : undefined,
    encodeStream: (w: Writer, value: Bytes) => {
      if (!isBytes(value)) throw w.err(`bytes: invalid value ${value}`);
      if (!isBytes(len)) w.length(len, value.length);
      w.bytes(le ? swap(value) : value);
      if (isBytes(len)) w.bytes(len);
    },
    decodeStream: (r: Reader): Bytes => {
      let bytes: Bytes;
      if (isBytes(len)) {
        const tPos = r.find(len);
        if (!tPos) throw r.err(`bytes: cannot find terminator`);
        bytes = r.bytes(tPos - r.pos);
        r.bytes(len.length);
      } else bytes = r.bytes(len === null ? r.leftBytes : r.length(len));
      return le ? swap(bytes) : bytes;
    },
  });

/**
 * String CoderType with a specified length and endianness.
 * The string can have:
 * - Dynamic size (prefixed with a length CoderType like U16BE)
 * - Fixed size (specified by a number)
 * - Unknown size (null, will parse until end of buffer)
 * - Zero-terminated (terminator can be any Uint8Array)
 * @param len - Length CoderType, number, Uint8Array (for terminator), or null.
 * @param le - Whether to use little-endian byte order.
 * @returns CoderType representing the string.
 * @example
 * const dynamicString = P.string(P.U16BE, false); // Dynamic size string (prefixed with P.U16BE number of string length)
 * @example
 * const fixedString = P.string(10, false); // Fixed size string
 * @example
 * const unknownString = P.string(null, false); // Unknown size string, will parse until end of buffer
 * @example
 * const nullTerminatedString = P.cstring;  * // NUL-terminated string
 */
export const string = (len: Length, le = false): CoderType<string> => {
  const inner = bytes(len, le);
  return wrap({
    size: inner.size,
    encodeStream: (w: Writer, value: string) => inner.encodeStream(w, utf8.decode(value)),
    decodeStream: (r: Reader): string => utf8.encode(inner.decodeStream(r)),
  });
};
/**
 * NUL-terminated string CoderType.
 */
export const cstring = /* @__PURE__ */ string(NULL);
/**
 * Hexadecimal string CoderType with a specified length, endianness, and optional 0x prefix.
 * @param len - Length CoderType (dynamic size), number (fixed size), Uint8Array (for terminator), or null (will parse until end of buffer)
 * @param le - Whether to use little-endian byte order.
 * @param withZero - Whether to include the 0x prefix.
 * @returns CoderType representing the hexadecimal string.
 * @example
 * const dynamicHex = P.hex(P.U16BE, false, true); // Hex string with 0x prefix and U16BE length
 * const fixedHex = P.hex(32, false, false); // Fixed-length 32-byte hex string without 0x prefix
 */
export const hex = (len: Length, le = false, withZero = false): CoderType<string> => {
  const inner = bytes(len, le);
  return wrap({
    size: inner.size,
    encodeStream: (w: Writer, value: string) => {
      if (withZero && !value.startsWith('0x'))
        throw new Error('hex(withZero=true).encode input should start with 0x');
      const bytes = baseHex.decode(withZero ? value.slice(2) : value);
      return inner.encodeStream(w, bytes);
    },
    decodeStream: (r: Reader): string =>
      (withZero ? '0x' : '') + baseHex.encode(inner.decodeStream(r)),
  });
};

/**
 * Applies a base coder to a CoderType.
 * @param inner - The inner CoderType.
 * @param b - The base coder to apply.
 * @returns CoderType representing the transformed value.
 * @example
 * import {hex} from '@scure/base';
 * const hex = P.apply(P.bytes(32), hex); // will decode bytes into a hex string
 */
export function apply<T, F>(inner: CoderType<T>, b: BaseCoder<T, F>): CoderType<F> {
  if (!isCoder(inner)) throw new Error(`apply: invalid inner value ${inner}`);
  return wrap({
    size: inner.size,
    encodeStream: (w: Writer, value: F) => {
      let innerValue;
      try {
        innerValue = b.decode(value);
      } catch (e) {
        throw w.err('' + e);
      }
      return inner.encodeStream(w, innerValue);
    },
    decodeStream: (r: Reader): F => {
      const innerValue = inner.decodeStream(r);
      try {
        return b.encode(innerValue);
      } catch (e) {
        throw r.err('' + e);
      }
    },
  });
}
/**
 * Validates a value before encoding and after decoding using a provided function.
 * @param inner - The inner CoderType.
 * @param fn - The validation function.
 * @returns CoderType which check value with validation function.
 * @example
 * const val = (n: number) => {
 *   if (n > 10) throw new Error(`${n} > 10`);
 *   return n;
 * };
 *
 * const RangedInt = P.validate(P.U32LE, val); // Will check if value is <= 10 during encoding and decoding
 */
export function validate<T>(inner: CoderType<T>, fn: (elm: T) => T): CoderType<T> {
  if (!isCoder(inner)) throw new Error(`validate: invalid inner value ${inner}`);
  return wrap({
    size: inner.size,
    encodeStream: (w: Writer, value: T) => inner.encodeStream(w, fn(value)),
    decodeStream: (r: Reader): T => fn(inner.decodeStream(r)),
  });
}
/**
 * Lazy CoderType that is evaluated at runtime.
 * @param fn - A function that returns the CoderType.
 * @returns CoderType representing the lazy value.
 * @example
 * type Tree = { name: string; childs: Tree[] };
 * const tree = P.struct({
 *   name: P.cstring,
 *   childs: P.array(
 *     P.U16BE,
 *     P.lazy((): P.CoderType<Tree> => tree)
 *   ),
 * });
 */
export function lazy<T>(fn: () => CoderType<T>): CoderType<T> {
  return wrap({
    encodeStream: (w: Writer, value: T) => fn().encodeStream(w, value),
    decodeStream: (r: Reader): T => fn().decodeStream(r),
  });
}

/**
 * Flag CoderType that encodes/decodes a boolean value based on the presence of a marker.
 * @param flagValue - Marker value.
 * @param xor - Whether to invert the flag behavior.
 * @returns CoderType representing the flag value.
 * @example
 * const flag = P.flag(new Uint8Array([0x01, 0x02])); // Encodes true as u8a([0x01, 0x02]), false as u8a([])
 * @example
 * const flagXor = P.flag(new Uint8Array([0x01, 0x02]), true); // Encodes true as u8a([]), false as u8a([0x01, 0x02])
 * @example
 * // Conditional encoding with flagged
 * const s = P.struct({ f: P.flag(new Uint8Array([0x0, 0x1])), f2: P.flagged('f', P.U32BE) });
 */
export const flag = (flagValue: Bytes, xor = false): CoderType<boolean> =>
  wrap({
    size: flagValue.length,
    encodeStream: (w: Writer, value: boolean) => {
      if (!!value !== xor) w.bytes(flagValue);
    },
    decodeStream: (r: Reader): boolean => {
      let hasFlag = r.leftBytes >= flagValue.length;
      if (hasFlag) {
        hasFlag = equalBytes(r.bytes(flagValue.length, true), flagValue);
        // Found flag, advance cursor position
        if (hasFlag) r.bytes(flagValue.length);
      }
      // hasFlag ^ xor
      return hasFlag !== xor;
    },
  });

/**
 * Conditional CoderType that encodes/decodes a value only if a flag is present.
 * @param path - Path to the flag value or a CoderType for the flag.
 * @param inner - Inner CoderType for the value.
 * @param def - Optional default value to use if the flag is not present.
 * @returns CoderType representing the conditional value.
 * @example
 * const s = P.struct({
 *   f: P.flag(new Uint8Array([0x0, 0x1])),
 *   f2: P.flagged('f', P.U32BE)
 * });
 *
 * @example
 * const s2 = P.struct({
 *   f: P.flag(new Uint8Array([0x0, 0x1])),
 *   f2: P.flagged('f', P.U32BE, 123)
 * });
 */
export function flagged<T>(
  path: string | BytesCoderStream<boolean>,
  inner: BytesCoderStream<T>,
  def?: T
): CoderType<Option<T>> {
  if (!isCoder(inner)) throw new Error(`flagged: invalid inner value ${inner}`);
  return wrap({
    encodeStream: (w: Writer, value: Option<T>) => {
      if (typeof path === 'string') {
        if (getPath(w.path, path.split('/'))) inner.encodeStream(w, value);
        else if (def) inner.encodeStream(w, def);
      } else {
        path.encodeStream(w, !!value);
        if (!!value) inner.encodeStream(w, value);
        else if (def) inner.encodeStream(w, def);
      }
    },
    decodeStream: (r: Reader): Option<T> => {
      let hasFlag = false;
      if (typeof path === 'string') hasFlag = getPath(r.path, path.split('/'));
      else hasFlag = path.decodeStream(r);
      // If there is a flag -- decode and return value
      if (hasFlag) return inner.decodeStream(r);
      else if (def) inner.decodeStream(r);
      return;
    },
  });
}
/**
 * Optional CoderType that encodes/decodes a value based on a flag.
 * @param flag - CoderType for the flag value.
 * @param inner - Inner CoderType for the value.
 * @param def - Optional default value to use if the flag is not present.
 * @returns CoderType representing the optional value.
 * @example
 * // Will decode into P.U32BE only if flag present
 * const optional = P.optional(P.flag(new Uint8Array([0x0, 0x1])), P.U32BE);
 *
 * @example
 * // If no flag present, will decode into default value
 * const optionalWithDefault = P.optional(P.flag(new Uint8Array([0x0, 0x1])), P.U32BE, 123);
 */
export function optional<T>(
  flag: BytesCoderStream<boolean>,
  inner: BytesCoderStream<T>,
  def?: T
): CoderType<Option<T>> {
  if (!isCoder(flag) || !isCoder(inner))
    throw new Error(`optional: invalid flag or inner value flag=${flag} inner=${inner}`);
  return wrap({
    size: def !== undefined && flag.size && inner.size ? flag.size + inner.size : undefined,
    encodeStream: (w: Writer, value: Option<T>) => {
      flag.encodeStream(w, !!value);
      if (value) inner.encodeStream(w, value);
      else if (def !== undefined) inner.encodeStream(w, def);
    },
    decodeStream: (r: Reader): Option<T> => {
      if (flag.decodeStream(r)) return inner.decodeStream(r);
      else if (def !== undefined) inner.decodeStream(r);
      return;
    },
  });
}
/**
 * Magic value CoderType that encodes/decodes a constant value.
 * This can be used to check for a specific magic value or sequence of bytes at the beginning of a data structure.
 * @param inner - Inner CoderType for the value.
 * @param constant - Constant value.
 * @param check - Whether to check the decoded value against the constant.
 * @returns CoderType representing the magic value.
 * @example
 * // Always encodes constant as bytes using inner CoderType, throws if encoded value is not present
 * const magicU8 = P.magic(P.U8, 0x42);
 */
export function magic<T>(inner: CoderType<T>, constant: T, check = true): CoderType<undefined> {
  if (!isCoder(inner)) throw new Error(`flagged: invalid inner value ${inner}`);
  return wrap({
    size: inner.size,
    encodeStream: (w: Writer, _value: undefined) => inner.encodeStream(w, constant),
    decodeStream: (r: Reader): undefined => {
      const value = inner.decodeStream(r);
      if (
        (check && typeof value !== 'object' && value !== constant) ||
        (isBytes(constant) && !equalBytes(constant, value as any))
      ) {
        throw r.err(`magic: invalid value: ${value} !== ${constant}`);
      }
      return;
    },
  });
}
/**
 * Magic bytes CoderType that encodes/decodes a constant byte array or string.
 * @param constant - Constant byte array or string.
 * @returns CoderType representing the magic bytes.
 * @example
 * // Always encodes undefined into byte representation of string 'MAGIC'
 * const magicBytes = P.magicBytes('MAGIC');
 */
export const magicBytes = (constant: Bytes | string): CoderType<undefined> => {
  const c = typeof constant === 'string' ? utf8.decode(constant) : constant;
  return magic(bytes(c.length), c);
};

/**
 * Constant value CoderType that always encodes and decodes the same value.
 * @param c - Constant value.
 * @returns CoderType representing the constant value.
 * @example
 * // Always return 123 on decode, throws on encoding anything other than 123
 * const constantU8 = P.constant(123);
 */
export function constant<T>(c: T): CoderType<T> {
  return wrap({
    encodeStream: (_w: Writer, value: T) => {
      if (value !== c) throw new Error(`constant: invalid value ${value} (exp: ${c})`);
    },
    decodeStream: (_r: Reader): T => c,
  });
}

function sizeof(fields: CoderType<any>[]): Option<number> {
  let size: Option<number> = 0;
  for (let f of fields) {
    if (f.size === undefined) return;
    if (!Number.isSafeInteger(f.size)) throw new Error(`sizeof: wrong element size=${size}`);
    size += f.size;
  }
  return size;
}
/**
 * Structure of composable primitives (C/Rust struct)
 * @param fields - Object mapping field names to CoderTypes.
 * @returns CoderType representing the structure.
 * @example
 * // Define a structure with a 32-bit big-endian unsigned integer, a string, and a nested structure
 * const myStruct = P.struct({
 *   id: P.U32BE,
 *   name: P.string(P.U8),
 *   nested: P.struct({
 *     flag: P.bool,
 *     value: P.I16LE
 *   })
 * });
 */
export function struct<T extends Record<string, any>>(
  fields: StructRecord<T>
): CoderType<StructInput<T>> {
  if (Array.isArray(fields)) throw new Error('Packed.Struct: got array instead of object');
  return wrap({
    size: sizeof(Object.values(fields)),
    encodeStream: (w: Writer, value: StructInput<T>) => {
      if (typeof value !== 'object' || value === null)
        throw w.err(`struct: invalid value ${value}`);
      w.path.push(value);
      for (let name in fields) {
        w.fieldPathPush(name);
        let field = fields[name];
        field.encodeStream(w, (value as T)[name]);
        w.fieldPathPop();
      }
      w.path.pop();
    },
    decodeStream: (r: Reader): StructInput<T> => {
      let res: Partial<T> = {};
      r.path.push(res);
      for (let name in fields) {
        r.fieldPathPush(name);
        res[name] = fields[name].decodeStream(r);
        r.fieldPathPop();
      }
      r.path.pop();
      return res as T;
    },
  });
}
/**
 * Tuple (unnamed structure) of CoderTypes.
 * @param fields - Array of CoderTypes.
 * @returns CoderType representing the tuple.
 * @example
 * const myTuple = P.tuple([P.U8, P.U16LE, P.string(P.U8)]);
 */
export function tuple<
  T extends ArrLike<CoderType<any>>,
  O = Writable<{ [K in keyof T]: UnwrapCoder<T[K]> }>,
>(fields: T): CoderType<O> {
  if (!Array.isArray(fields))
    throw new Error(`Packed.Tuple: got ${typeof fields} instead of array`);
  return wrap({
    size: sizeof(fields),
    encodeStream: (w: Writer, value: O) => {
      if (!Array.isArray(value)) throw w.err(`tuple: invalid value ${value}`);
      w.path.push(value);
      for (let i = 0; i < fields.length; i++) {
        w.fieldPathPush('' + i);
        fields[i].encodeStream(w, value[i]);
        w.fieldPathPop();
      }
      w.path.pop();
    },
    decodeStream: (r: Reader): O => {
      let res: any = [];
      r.path.push(res);
      for (let i = 0; i < fields.length; i++) {
        r.fieldPathPush('' + i);
        res.push(fields[i].decodeStream(r));
        r.fieldPathPop();
      }
      r.path.pop();
      return res;
    },
  });
}

type PrefixLength = string | number | CoderType<number> | CoderType<bigint>;
/**
 * Prefix-encoded value using a length prefix and an inner CoderType.
 * @param len - Dynamic length via CoderType (number | bigint) or number for fixed size
 * @param inner - CoderType for the actual value to be prefix-encoded.
 * @returns CoderType representing the prefix-encoded value.
 * @example
 * const dynamicPrefix = P.prefix(P.U16BE, P.bytes(null)); // Dynamic size prefix (prefixed with P.U16BE number of bytes length)
 *
 * @example
 * const fixedPrefix = P.prefix(10, P.bytes(null)); // Fixed size prefix (always 10 bytes)
 */
export function prefix<T>(len: PrefixLength, inner: CoderType<T>): CoderType<T> {
  if (!isCoder(inner)) throw new Error(`prefix: invalid inner value ${inner}`);
  if (isBytes(len)) throw new Error(`prefix: len cannot be Uint8Array`);
  const b = bytes(len);
  return wrap({
    size: typeof len === 'number' ? len : undefined,
    encodeStream: (w: Writer, value: T) => {
      const wChild = new Writer(w.path, w.fieldPath);
      inner.encodeStream(wChild, value);
      b.encodeStream(w, wChild.buffer);
    },
    decodeStream: (r: Reader): T => {
      const data = b.decodeStream(r);
      const ir = new Reader(data, r.opts, r.path, r.fieldPath);
      const res = inner.decodeStream(ir);
      ir.finish();
      return res;
    },
  });
}
/**
 * Array of items (inner type) with a specified length.
 * @param len - Length CoderType (dynamic size), number (fixed size), Uint8Array (terminator), or null (will parse until end of buffer)
 * @param inner - CoderType for encoding/decoding each array item.
 * @returns CoderType representing the array.
 * @example
 * let a1 = P.array(P.U16BE, child); // Dynamic size array (prefixed with P.U16BE number of array length)
 * let a2 = P.array(4, child); // Fixed size array
 * let a3 = P.array(null, child); // Unknown size array, will parse until end of buffer
 * let a4 = P.array(new Uint8Array([0]), child); // zero-terminated array (NOTE: terminator can be any buffer)
 */
export function array<T>(len: Length, inner: CoderType<T>): CoderType<T[]> {
  if (!isCoder(inner)) throw new Error(`array: invalid inner value ${inner}`);
  return wrap({
    size: typeof len === 'number' && inner.size ? len * inner.size : undefined,
    encodeStream: (w: Writer, value: T[]) => {
      if (!Array.isArray(value)) throw w.err(`array: invalid value ${value}`);
      if (!isBytes(len)) w.length(len, value.length);
      w.path.push(value);
      for (let i = 0; i < value.length; i++) {
        w.fieldPathPush('' + i);
        const elm = value[i];
        const startPos = w.pos;
        inner.encodeStream(w, elm);
        if (isBytes(len)) {
          // Terminator is bigger than elm size, so skip
          if (len.length > w.pos - startPos) continue;
          const data = w.buffer.subarray(startPos, w.pos);
          // There is still possible case when multiple elements create terminator,
          // but it is hard to catch here, will be very slow
          if (equalBytes(data.subarray(0, len.length), len))
            throw w.err(`array: inner element encoding same as separator. elm=${elm} data=${data}`);
        }
        w.fieldPathPop();
      }
      w.path.pop();
      if (isBytes(len)) w.bytes(len);
    },
    decodeStream: (r: Reader): T[] => {
      let res: T[] = [];
      if (len === null) {
        let i = 0;
        r.path.push(res);
        while (!r.isEnd()) {
          r.fieldPathPush('' + i++);
          res.push(inner.decodeStream(r));
          r.fieldPathPop();
          if (inner.size && r.leftBytes < inner.size) break;
        }
        r.path.pop();
      } else if (isBytes(len)) {
        let i = 0;
        r.path.push(res);
        while (true) {
          if (equalBytes(r.bytes(len.length, true), len)) {
            // Advance cursor position if terminator found
            r.bytes(len.length);
            break;
          }
          r.fieldPathPush('' + i++);
          res.push(inner.decodeStream(r));
          r.fieldPathPop();
        }
        r.path.pop();
      } else {
        r.fieldPathPush('arrayLen');
        const length = r.length(len);
        r.fieldPathPop();

        r.path.push(res);
        for (let i = 0; i < length; i++) {
          r.fieldPathPush('' + i);
          res.push(inner.decodeStream(r));
          r.fieldPathPop();
        }
        r.path.pop();
      }
      return res;
    },
  });
}
/**
 * Mapping between encoded values and string representations.
 * @param inner - CoderType for encoded values.
 * @param variants - Object mapping string representations to encoded values.
 * @returns CoderType representing the mapping.
 * @example
 * // Map between numbers and strings
 * const numberMap = P.map(P.U8, {
 *   'one': 1,
 *   'two': 2,
 *   'three': 3
 * });
 *
 * @example
 * // Map between byte arrays and strings
 * const byteMap = P.map(P.bytes(2, false), {
 *   'ab': Uint8Array.from([0x61, 0x62]),
 *   'cd': Uint8Array.from([0x63, 0x64])
 * });
 */
export function map<T>(inner: CoderType<T>, variants: Record<string, T>): CoderType<string> {
  if (!isCoder(inner)) throw new Error(`map: invalid inner value ${inner}`);
  const variantNames: Map<T, string> = new Map();
  for (const k in variants) variantNames.set(variants[k], k);
  return wrap({
    size: inner.size,
    encodeStream: (w: Writer, value: string) => {
      if (typeof value !== 'string') throw w.err(`map: invalid value ${value}`);
      if (!(value in variants)) throw w.err(`Map: unknown variant: ${value}`);
      inner.encodeStream(w, variants[value]);
    },
    decodeStream: (r: Reader): string => {
      const variant = inner.decodeStream(r);
      const name = variantNames.get(variant);
      if (name === undefined)
        throw r.err(`Enum: unknown value: ${variant} ${Array.from(variantNames.keys())}`);
      return name;
    },
  });
}
/**
 * Tagged union of CoderTypes, where the tag value determines which CoderType to use.
 * The decoded value will have the structure `{ TAG: number, data: ... }`.
 * @param tag - CoderType for the tag value.
 * @param variants - Object mapping tag values to CoderTypes.
 * @returns CoderType representing the tagged union.
 * @example
 * // Tagged union of array, string, and number
 * // Depending on the value of the first byte, it will be decoded as an array, string, or number.
 * const taggedUnion = P.tag(P.U8, {
 *   0x01: P.array(P.U16LE, P.U8),
 *   0x02: P.string(P.U8),
 *   0x03: P.U32BE
 * });
 *
 * const encoded = taggedUnion.encode({ TAG: 0x01, data: 'hello' }); // Encodes the string 'hello' with tag 0x01
 * const decoded = taggedUnion.decode(encoded); // Decodes the encoded value back to { TAG: 0x01, data: 'hello' }
 */
export function tag<
  T extends Values<{
    [P in keyof Variants]: { TAG: P; data: UnwrapCoder<Variants[P]> };
  }>,
  TagValue extends string | number,
  Variants extends Record<TagValue, CoderType<any>>,
>(tag: CoderType<TagValue>, variants: Variants): CoderType<T> {
  if (!isCoder(tag)) throw new Error(`tag: invalid tag value ${tag}`);
  return wrap({
    size: tag.size,
    encodeStream: (w: Writer, value: T) => {
      const { TAG, data } = value;
      const dataType = variants[TAG];
      if (!dataType) throw w.err(`Tag: invalid tag ${TAG.toString()}`);
      tag.encodeStream(w, TAG as any);
      dataType.encodeStream(w, data);
    },
    decodeStream: (r: Reader): T => {
      const TAG = tag.decodeStream(r);
      const dataType = variants[TAG];
      if (!dataType) throw r.err(`Tag: invalid tag ${TAG}`);
      return { TAG, data: dataType.decodeStream(r) } as any;
    },
  });
}

/**
 * Mapping between encoded values, string representations, and CoderTypes using a tag CoderType.
 * @param tagCoder - CoderType for the tag value.
 * @param variants - Object mapping string representations to [tag value, CoderType] pairs.
 *  * @returns CoderType representing the mapping.
 * @example
 * const cborValue: P.CoderType<CborValue> = P.mappedTag(P.bits(3), {
 *   uint: [0, cborUint], // An unsigned integer in the range 0..264-1 inclusive.
 *   negint: [1, cborNegint], // A negative integer in the range -264..-1 inclusive
 *   bytes: [2, P.lazy(() => cborLength(P.bytes, cborValue))], // A byte string.
 *   string: [3, P.lazy(() => cborLength(P.string, cborValue))], // A text string (utf8)
 *   array: [4, cborArrLength(P.lazy(() => cborValue))], // An array of data items
 *   map: [5, P.lazy(() => cborArrLength(P.tuple([cborValue, cborValue])))], // A map of pairs of data items
 *   tag: [6, P.tuple([cborUint, P.lazy(() => cborValue)] as const)], // A tagged data item ("tag") whose tag number
 *   simple: [7, cborSimple], // Floating-point numbers and simple values, as well as the "break" stop code
 * });
 */
export function mappedTag<
  T extends Values<{
    [P in keyof Variants]: { TAG: P; data: UnwrapCoder<Variants[P][1]> };
  }>,
  TagValue extends string | number,
  Variants extends Record<string, [TagValue, CoderType<any>]>,
>(tagCoder: CoderType<TagValue>, variants: Variants): CoderType<T> {
  if (!isCoder(tagCoder)) throw new Error(`mappedTag: invalid tag value ${tag}`);
  const mapValue: Record<string, TagValue> = {};
  const tagValue: Record<string, CoderType<any>> = {};
  for (const key in variants) {
    const v = variants[key];
    mapValue[key] = v[0];
    tagValue[key] = v[1];
  }
  return tag(map(tagCoder, mapValue), tagValue) as any as CoderType<T>;
}

/**
 * Bitset of boolean values with optional padding.
 * @param names - An array of string names for the bitset values.
 * @param pad - Whether to pad the bitset to a multiple of 8 bits.
 * @returns CoderType representing the bitset.
 * @template Names
 * @example
 * const myBitset = P.bitset(['flag1', 'flag2', 'flag3', 'flag4'], true);
 */
export function bitset<Names extends readonly string[]>(
  names: Names,
  pad = false
): CoderType<Record<Names[number], boolean>> {
  return wrap({
    encodeStream: (w: Writer, value: Record<Names[number], boolean>) => {
      if (typeof value !== 'object' || value === null)
        throw w.err(`bitset: invalid value ${value}`);
      for (let i = 0; i < names.length; i++) w.bits(+(value as any)[names[i]], 1);
      if (pad && names.length % 8) w.bits(0, 8 - (names.length % 8));
    },
    decodeStream: (r: Reader): Record<Names[number], boolean> => {
      let out: Record<string, boolean> = {};
      for (let i = 0; i < names.length; i++) out[names[i]] = !!r.bits(1);
      if (pad && names.length % 8) r.bits(8 - (names.length % 8));
      return out;
    },
  });
}
/**
 * Padding function which always returns zero
 */
export const ZeroPad: PadFn = (_) => 0;

function padLength(blockSize: number, len: number): number {
  if (len % blockSize === 0) return 0;
  return blockSize - (len % blockSize);
}
/**
 * Pads a CoderType with a specified block size and padding function on the left side.
 * @param blockSize - Block size for padding.
 * @param inner - Inner CoderType to pad.
 * @param padFn - Padding function to use. If not provided, zero padding is used.
 * @returns CoderType representing the padded value.
 * @example
 * // Pad a U32BE with a block size of 4 and zero padding
 * const paddedU32BE = P.padLeft(4, P.U32BE);
 *
 * @example
 * // Pad a string with a block size of 16 and custom padding
 * const paddedString = P.padLeft(16, P.string(P.U8), (i) => i + 1);
 */
export function padLeft<T>(
  blockSize: number,
  inner: CoderType<T>,
  padFn: Option<PadFn>
): CoderType<T> {
  if (!isCoder(inner)) throw new Error(`padLeft: invalid inner value ${inner}`);
  const _padFn = padFn || ZeroPad;
  if (!inner.size) throw new Error('padLeft with dynamic size argument is impossible');
  return wrap({
    size: inner.size + padLength(blockSize, inner.size),
    encodeStream: (w: Writer, value: T) => {
      const padBytes = padLength(blockSize, inner.size!);
      for (let i = 0; i < padBytes; i++) w.byte(_padFn(i));
      inner.encodeStream(w, value);
    },
    decodeStream: (r: Reader): T => {
      r.bytes(padLength(blockSize, inner.size!));
      return inner.decodeStream(r);
    },
  });
}
/**
 * Pads a CoderType with a specified block size and padding function on the right side.
 * @param blockSize - Block size for padding.
 * @param inner - Inner CoderType to pad.
 * @param padFn - Padding function to use. If not provided, zero padding is used.
 * @returns CoderType representing the padded value.
 * @example
 * // Pad a U16BE with a block size of 2 and zero padding
 * const paddedU16BE = P.padRight(2, P.U16BE);
 *
 * @example
 * // Pad a bytes with a block size of 8 and custom padding
 * const paddedBytes = P.padRight(8, P.bytes(null), (i) => i + 1);
 */
export function padRight<T>(
  blockSize: number,
  inner: CoderType<T>,
  padFn: Option<PadFn>
): CoderType<T> {
  if (!isCoder(inner)) throw new Error(`padRight: invalid inner value ${inner}`);
  const _padFn = padFn || ZeroPad;
  return wrap({
    size: inner.size ? inner.size + padLength(blockSize, inner.size) : undefined,
    encodeStream: (w: Writer, value: T) => {
      const pos = w.pos;
      inner.encodeStream(w, value);
      const padBytes = padLength(blockSize, w.pos - pos);
      for (let i = 0; i < padBytes; i++) w.byte(_padFn(i));
    },
    decodeStream: (r: Reader): T => {
      const start = r.pos;
      const res = inner.decodeStream(r);
      r.bytes(padLength(blockSize, r.pos - start));
      return res;
    },
  });
}

/**
 * Pointer to a value using a pointer CoderType and an inner CoderType.
 * Pointers are scoped, and the next pointer in the dereference chain is offset by the previous one.
 * @param ptr - CoderType for the pointer value.
 * @param inner - CoderType for encoding/decoding the pointed value.
 * @param sized - Whether the pointer should have a fixed size.
 * @returns CoderType representing the pointer to the value.
 * @example
 * const pointerToU8 = P.pointer(P.U16BE, P.U8); // Pointer to a single U8 value
 */
export function pointer<T>(
  ptr: CoderType<number>,
  inner: CoderType<T>,
  sized = false
): CoderType<T> {
  if (!isCoder(ptr)) throw new Error(`pointer: invalid ptr value ${ptr}`);
  if (!isCoder(inner)) throw new Error(`pointer: invalid inner value ${inner}`);
  if (!ptr.size) throw new Error('Pointer: unsized ptr');
  return wrap({
    size: sized ? ptr.size : undefined,
    encodeStream: (w: Writer, value: T) => {
      // TODO: by some reason it encodes array of pointers as [(ptr,val), (ptr, val)]
      // instead of [ptr, ptr][val, val]
      const start = w.pos;
      ptr.encodeStream(w, 0);
      w.ptrs.push({ pos: start, ptr, buffer: inner.encode(value) });
    },
    decodeStream: (r: Reader): T => {
      const ptrVal = ptr.decodeStream(r);
      r.enablePtr();
      return inner.decodeStream(r.offsetReader(ptrVal));
    },
  });
}

/**
 * Base64-armored values are commonly used in cryptographic applications, such as PGP and SSH.
 * @param name - The name of the armored value.
 * @param lineLen - Maximum line length for the armored value (e.g., 64 for GPG, 70 for SSH).
 * @param inner - Inner CoderType for the value.
 * @param checksum - Optional checksum function.
 * @returns Coder representing the base64-armored value.
 * @example
 * // Base64-armored value without checksum
 * const armoredValue = P.base64armor('EXAMPLE', 64, P.bytes(null));
 */
export function base64armor<T>(
  name: string,
  lineLen: number,
  inner: Coder<T, Bytes>,
  checksum?: (data: Bytes) => Bytes
): Coder<T, string> {
  const markBegin = `-----BEGIN ${name.toUpperCase()}-----`;
  const markEnd = `-----END ${name.toUpperCase()}-----`;
  return {
    encode(value: T) {
      const data = inner.encode(value);
      const encoded = base64.encode(data);
      let lines = [];
      for (let i = 0; i < encoded.length; i += lineLen) {
        const s = encoded.slice(i, i + lineLen);
        if (s.length) lines.push(`${encoded.slice(i, i + lineLen)}\n`);
      }
      let body = lines.join('');
      if (checksum) body += `=${base64.encode(checksum(data))}\n`;
      return `${markBegin}\n\n${body}${markEnd}\n`;
    },
    decode(s: string): T {
      let lines = s.replace(markBegin, '').replace(markEnd, '').trim().split('\n');
      lines = lines.map((l) => l.replace('\r', '').trim());
      const last = lines.length - 1;
      if (checksum && lines[last].startsWith('=')) {
        const body = base64.decode(lines.slice(0, -1).join(''));
        const cs = lines[last].slice(1);
        const realCS = base64.encode(checksum(body));
        if (realCS !== cs)
          throw new Error(`Base64Armor: invalid checksum ${cs} instead of ${realCS}`);
        return inner.decode(body);
      }
      return inner.decode(base64.decode(lines.join('')));
    },
  };
}

/**
 * A CoderType that does nothing and always encodes/decodes an empty byte array.
 */
export const nothing = /* @__PURE__ */ magic(/* @__PURE__ */ bytes(0), EMPTY);

/**
 * Wraps a CoderType with debug logging for encoding and decoding operations.
 * @param inner - Inner CoderType to wrap.
 * @returns Inner wrapped in debug prints via console.log.
 * @example
 * const debugInt = P.debug(P.U32LE); // Will print info to console on encoding/decoding
 */
export function debug<T>(inner: CoderType<T>): CoderType<T> {
  if (!isCoder(inner)) throw new Error(`debug: invalid inner value ${inner}`);
  const log = (name: string, rw: Reader | Writer, value: any) => {
    // @ts-ignore
    console.log(`DEBUG/${name}(${rw.fieldPath.join('/')}):`, { type: typeof value, value });
    return value;
  };
  return wrap({
    size: inner.size,
    encodeStream: (w: Writer, value: T) => inner.encodeStream(w, log('encode', w, value)),
    decodeStream: (r: Reader): T => log('decode', r, inner.decodeStream(r)),
  });
}

// Internal methods for test purposes only
export const _TEST = /* @__PURE__ */ { _bitset: Bitset };
