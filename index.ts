import * as base from '@scure/base';

/**
 * TODO:
 * - Holes, simplify pointers. Hole is some sized element which is skipped at encoding,
 *   but later other elements can write to it by path
 * - Composite / tuple keys for dict
 * - Web UI for easier debugging. We can wrap every coder to something that would write
 *   start & end positions to; and we can colorize specific bytes used by specific coder
 */

// Useful default values
export const EMPTY = new Uint8Array(); // Empty bytes array
export const NULL = new Uint8Array([0]); // NULL

export function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  if (arrays.length === 1) return arrays[0];
  const length = arrays.reduce((a, arr) => a + arr.length, 0);
  const result = new Uint8Array(length);
  for (let i = 0, pad = 0; i < arrays.length; i++) {
    const arr = arrays[i];
    result.set(arr, pad);
    pad += arr.length;
  }
  return result;
}

export const isBytes = (b: unknown): b is Bytes => b instanceof Uint8Array;

// Types
export type Bytes = Uint8Array;
export type Option<T> = T | undefined;

export interface Coder<F, T> {
  encode(from: F): T;
  decode(to: T): F;
}

export interface BytesCoder<T> extends Coder<T, Bytes> {
  size?: number; // Size hint element
  encode: (data: T) => Bytes;
  decode: (data: Bytes) => T;
}

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
export type Length = CoderType<number> | CoderType<bigint> | number | Bytes | string | null;

type ArrLike<T> = Array<T> | ReadonlyArray<T>;
// prettier-ignore
export type TypedArray =
  | Uint8Array  | Int8Array | Uint8ClampedArray
  | Uint16Array | Int16Array
  | Uint32Array | Int32Array;

// as const returns readonly stuff, remove readonly property
export type Writable<T> = T extends {}
  ? T extends TypedArray
    ? T
    : {
        -readonly [P in keyof T]: Writable<T[P]>;
      }
  : T;

type Values<T> = T[keyof T];
type NonUndefinedKey<T, K extends keyof T> = T[K] extends undefined ? never : K;
type NullableKey<T, K extends keyof T> = T[K] extends NonNullable<T[K]> ? never : K;
// Opt: value !== undefined, but value === T|undefined
type OptKey<T, K extends keyof T> = NullableKey<T, K> & NonUndefinedKey<T, K>;
type ReqKey<T, K extends keyof T> = T[K] extends NonNullable<T[K]> ? K : never;

type OptKeys<T> = Pick<T, { [K in keyof T]: OptKey<T, K> }[keyof T]>;
type ReqKeys<T> = Pick<T, { [K in keyof T]: ReqKey<T, K> }[keyof T]>;

type StructInput<T extends Record<string, any>> = { [P in keyof ReqKeys<T>]: T[P] } & {
  [P in keyof OptKeys<T>]?: T[P];
};

type StructRecord<T extends Record<string, any>> = {
  [P in keyof T]: CoderType<T[P]>;
};

type StructOut = Record<string, any>;
type PadFn = (i: number) => number;

// Utils
export class Reader {
  pos = 0;
  hasPtr: boolean = false;
  bitBuf = 0;
  bitPos = 0;
  constructor(
    readonly data: Bytes,
    public path: StructOut[] = [],
    public fieldPath: string[] = []
  ) {}
  err(msg: string) {
    return new Error(`Reader(${this.fieldPath.join('/')}): ${msg}`);
  }
  // read bytes by absolute offset
  absBytes(n: number) {
    if (n > this.data.length) throw new Error('absBytes: Unexpected end of buffer');
    return this.data.subarray(n);
  }
  bytes(n: number, peek = false) {
    if (this.bitPos) throw this.err('readBytes: bitPos not empty');
    if (!Number.isFinite(n)) throw this.err(`readBytes: wrong length=${n}`);
    if (this.pos + n > this.data.length) throw this.err('readBytes: Unexpected end of buffer');
    const slice = this.data.subarray(this.pos, this.pos + n);
    if (!peek) this.pos += n;
    return slice;
  }
  byte(peek = false): number {
    if (this.bitPos) throw this.err('readByte: bitPos not empty');
    return this.data[peek ? this.pos : this.pos++];
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
  // Note: bits reads in BE (left to right) mode: (0b1000_0000).readBits(1) == 1
  bits(bits: number) {
    if (bits > 32) throw this.err('BitReader: cannot read more than 32 bits in single call');
    let out = 0;
    while (bits) {
      if (!this.bitPos) {
        this.bitBuf = this.data[this.pos++];
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
  }
  finish() {
    if (this.isEnd() || this.hasPtr) return;
    throw this.err(
      `${this.leftBytes} bytes ${this.bitPos} bits left after unpack: ${base.hex.encode(
        this.data.slice(this.pos)
      )}`
    );
  }
  fieldPathPush(s: string) {
    this.fieldPath.push(s);
  }
  fieldPathPop() {
    this.fieldPath.pop();
  }
}

export class Writer {
  private buffers: Bytes[] = [];
  pos: number = 0;
  ptrs: { pos: number; ptr: CoderType<number>; buffer: Bytes }[] = [];
  bitBuf = 0;
  bitPos = 0;
  constructor(public path: StructOut[] = [], public fieldPath: string[] = []) {}
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

// Wrap stream encoder into generic encoder
export function wrap<T>(inner: BytesCoderStream<T>): BytesCoderStream<T> & BytesCoder<T> {
  return {
    ...inner,
    encode: (value: T): Bytes => {
      const w = new Writer();
      inner.encodeStream(w, value);
      return w.buffer;
    },
    decode: (data: Bytes): T => {
      const r = new Reader(data);
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

export function isCoder<T>(elm: any): elm is CoderType<T> {
  return (
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
function dict<T>(): base.Coder<[string, T][], Record<string, T>> {
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
// Safely converts bigint to number
// Sometimes pointers / tags use u64 or other big numbers which cannot be represented by number,
// but we still can use them since real value will be smaller than u32
const number: base.Coder<bigint, number> = {
  encode: (from: bigint): number => {
    if (from > BigInt(Number.MAX_SAFE_INTEGER))
      throw new Error(`coders.number: element bigger than MAX_SAFE_INTEGER=${from}`);
    return Number(from);
  },
  decode: (to: number): bigint => BigInt(to),
};
// TODO: replace map with this?
type Enum = { [k: string]: number | string } & { [k: number]: string };
// Doesn't return numeric keys, so it's fine
type EnumKeys<T extends Enum> = keyof T;
function tsEnum<T extends Enum>(e: T): base.Coder<number, EnumKeys<T>> {
  return {
    encode: (from: number): string => e[from],
    decode: (to: string): number => e[to] as number,
  };
}

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
type BaseInput<F> = F extends base.Coder<infer T, any> ? T : never;
type BaseOutput<F> = F extends base.Coder<any, infer T> ? T : never;

/**
 * Allows to split big conditional coders into a small one; also sort of parser combinator:
 *
 *   `encode = [Ae, Be]; decode = [Ad, Bd]`
 *   ->
 *   `match([{encode: Ae, decode: Ad}, {encode: Be; decode: Bd}])`
 *
 * 1. It is easier to reason: encode/decode of specific part are closer to each other
 * 2. Allows composable coders and ability to add conditions on runtime
 * @param lst
 * @returns
 */
function match<
  L extends base.Coder<unknown | undefined, unknown | undefined>[],
  I = { [K in keyof L]: NonNullable<BaseInput<L[K]>> }[number],
  O = { [K in keyof L]: NonNullable<BaseOutput<L[K]>> }[number]
>(lst: L): base.Coder<I, O> {
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

export const coders = { dict, number, tsEnum, decimal, match };

// PackedCoders
export const bits = (len: number): CoderType<number> =>
  wrap({
    encodeStream: (w: Writer, value: number) => w.bits(value, len),
    decodeStream: (r: Reader): number => r.bits(len),
  });

export const bigint = (size: number, le = false, signed = false): CoderType<bigint> =>
  wrap({
    size,
    encodeStream: (w: Writer, value: bigint | number) => {
      if (typeof value !== 'number' && typeof value !== 'bigint')
        throw w.err(`bigint: invalid value: ${value}`);
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
      w.bytes(le ? res.reverse() : res);
    },
    decodeStream: (r: Reader): bigint => {
      const bLen = BigInt(size);
      let value = r.bytes(size);
      if (le) value = swap(value);
      const b = swap(value);
      const signBit = 2n ** (8n * bLen - 1n);
      let res = 0n;
      for (let i = 0; i < b.length; i++) res |= BigInt(b[i]) << (8n * BigInt(i));
      if (signed && res & signBit) res = (res ^ signBit) - signBit;
      checkBounds(r, res, 8n * bLen, !!signed);
      return res;
    },
  });

export const U256LE = bigint(32, true);
export const U256BE = bigint(32, false);
export const I256LE = bigint(32, true, true);
export const I256BE = bigint(32, false, true);

export const U128LE = bigint(16, true);
export const U128BE = bigint(16, false);
export const I128LE = bigint(16, true, true);
export const I128BE = bigint(16, false, true);

export const U64LE = bigint(8, true);
export const U64BE = bigint(8, false);
export const I64LE = bigint(8, true, true);
export const I64BE = bigint(8, false, true);

export const int = (size: number, le = false, signed = false): CoderType<number> => {
  if (size > 6) throw new Error('int supports size up to 6 bytes (48 bits), for other use bigint');
  return apply(bigint(size, le, signed), coders.number);
};

export const U32LE = int(4, true);
export const U32BE = int(4, false);
export const I32LE = int(4, true, true);
export const I32BE = int(4, false, true);

export const U16LE = int(2, true);
export const U16BE = int(2, false);
export const I16LE = int(2, true, true);
export const I16BE = int(2, false, true);

export const U8 = int(1, false);
export const I8 = int(1, false, true);

export const bool: CoderType<boolean> = wrap({
  size: 1,
  encodeStream: (w: Writer, value: boolean) => w.byte(value ? 1 : 0),
  decodeStream: (r: Reader): boolean => {
    const value = r.byte();
    if (value !== 0 && value !== 1) throw r.err(`bool: invalid value ${value}`);
    return value === 1;
  },
});

// Can be done w array, but specific implementation should be
// faster: no need to create js array of numbers.
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

export const string = (len: Length, le = false): CoderType<string> => {
  const inner = bytes(len, le);
  return wrap({
    size: inner.size,
    encodeStream: (w: Writer, value: string) => inner.encodeStream(w, base.utf8.decode(value)),
    decodeStream: (r: Reader): string => base.utf8.encode(inner.decodeStream(r)),
  });
};

export const cstring = string(NULL);

export const hex = (len: Length, le = false, withZero = false): CoderType<string> => {
  const inner = bytes(len, le);
  return wrap({
    size: inner.size,
    encodeStream: (w: Writer, value: string) => {
      if (withZero && !value.startsWith('0x'))
        throw new Error('hex(withZero=true).encode input should start with 0x');
      const bytes = base.hex.decode(withZero ? value.slice(2) : value);
      return inner.encodeStream(w, bytes);
    },
    decodeStream: (r: Reader): string =>
      (withZero ? '0x' : '') + base.hex.encode(inner.decodeStream(r)),
  });
};

// Interoperability with base
export function apply<T, F>(inner: CoderType<T>, b: base.Coder<T, F>): CoderType<F> {
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
// Additional check of values both on encode and decode steps.
// E.g. to force uint32 to be 1..10
export function validate<T>(inner: CoderType<T>, fn: (elm: T) => T): CoderType<T> {
  if (!isCoder(inner)) throw new Error(`validate: invalid inner value ${inner}`);
  return wrap({
    size: inner.size,
    encodeStream: (w: Writer, value: T) => inner.encodeStream(w, fn(value)),
    decodeStream: (r: Reader): T => fn(inner.decodeStream(r)),
  });
}

export function lazy<T>(fn: () => CoderType<T>): CoderType<T> {
  return wrap({
    encodeStream: (w: Writer, value: T) => fn().encodeStream(w, value),
    decodeStream: (r: Reader): T => fn().decodeStream(r),
  });
}

// TODO: export from base? Must support 0x in micro-base
type baseFmt =
  | 'utf8'
  | 'hex'
  | 'base16'
  | 'base32'
  | 'base64'
  | 'base64url'
  | 'base58'
  | 'base58xmr';
export const bytesFormatted = (len: Length, fmt: baseFmt, le = false) => {
  const inner = bytes(len, le);
  return wrap({
    size: inner.size,
    encodeStream: (w: Writer, value: string) => inner.encodeStream(w, base.bytes(fmt, value)),
    decodeStream: (r: Reader): string => base.str(fmt, inner.decodeStream(r)),
  });
};

// Returns true if some marker exists, otherwise false. Xor argument flips behaviour
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

// Decode/encode only if flag found
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
    },
  });
}

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
    },
  });
}

export function magic<T>(inner: CoderType<T>, constant: T, check = true): CoderType<undefined> {
  if (!isCoder(inner)) throw new Error(`flagged: invalid inner value ${inner}`);
  return wrap({
    size: inner.size,
    encodeStream: (w: Writer, value: undefined) => inner.encodeStream(w, constant),
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

export const magicBytes = (constant: Bytes | string): CoderType<undefined> => {
  const c = typeof constant === 'string' ? base.utf8.decode(constant) : constant;
  return magic(bytes(c.length), c);
};

export function constant<T>(c: T): CoderType<T> {
  return wrap({
    encodeStream: (w: Writer, value: T) => {
      if (value !== c) throw new Error(`constant: invalid value ${value} (exp: ${c})`);
    },
    decodeStream: (r: Reader): T => c,
  });
}

function sizeof(fields: CoderType<any>[]): Option<number> {
  let size: Option<number> = 0;
  for (let f of fields) {
    if (!f.size) return;
    size += f.size;
  }
  return size;
}

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

export function tuple<
  T extends ArrLike<CoderType<any>>,
  O = Writable<{ [K in keyof T]: UnwrapCoder<T[K]> }>
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
      return inner.decodeStream(new Reader(data, r.path, r.fieldPath));
    },
  });
}

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

export function tag<
  T extends Values<{
    [P in keyof Variants]: { TAG: P; data: UnwrapCoder<Variants[P]> };
  }>,
  TagValue extends string | number,
  Variants extends Record<TagValue, CoderType<any>>
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
// Takes {name: [value, coder]}
export function mappedTag<
  T extends Values<{
    [P in keyof Variants]: { TAG: P; data: UnwrapCoder<Variants[P][1]> };
  }>,
  TagValue extends string | number,
  Variants extends Record<string, [TagValue, CoderType<any>]>
>(tagCoder: CoderType<TagValue>, variants: Variants): CoderType<T> {
  if (!isCoder(tagCoder)) throw new Error(`mappedTag: invalid tag value ${tag}`);
  const mapValue: Record<string, TagValue> = {};
  const tagValue: Record<string, CoderType<any>> = {};
  for (const key in variants) {
    mapValue[key] = variants[key][0];
    tagValue[key] = variants[key][1];
  }
  return tag(map(tagCoder, mapValue), tagValue) as any as CoderType<T>;
}

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

export const ZeroPad: PadFn = (_) => 0;

function padLength(blockSize: number, len: number): number {
  if (len % blockSize === 0) return 0;
  return blockSize - (len % blockSize);
}

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
      const start = w.pos;
      ptr.encodeStream(w, 0);
      w.ptrs.push({ pos: start, ptr, buffer: inner.encode(value) });
    },
    decodeStream: (r: Reader): T => {
      const ptrVal = ptr.decodeStream(r);
      // This check enforces termination of parser, if there is backwards pointers,
      // then it is possible to create loop and cause DoS.
      if (ptrVal < r.pos) throw new Error('pointer.decodeStream pointer less than position');
      r.hasPtr = true;
      const rChild = new Reader(r.absBytes(ptrVal), r.path, r.fieldPath);
      return inner.decodeStream(rChild);
    },
  });
}

// lineLen: gpg=64, ssh=70
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
      const encoded = base.base64.encode(data);
      let lines = [];
      for (let i = 0; i < encoded.length; i += lineLen) {
        const s = encoded.slice(i, i + lineLen);
        if (s.length) lines.push(`${encoded.slice(i, i + lineLen)}\n`);
      }
      let body = lines.join('');
      if (checksum) body += `=${base.base64.encode(checksum(data))}\n`;
      return `${markBegin}\n\n${body}${markEnd}\n`;
    },
    decode(s: string): T {
      let lines = s.replace(markBegin, '').replace(markEnd, '').trim().split('\n');
      lines = lines.map((l) => l.replace('\r', '').trim());
      if (checksum && lines[lines.length - 1].startsWith('=')) {
        const body = base.base64.decode(lines.slice(0, -1).join(''));
        const cs = lines[lines.length - 1].slice(1);
        const realCS = base.base64.encode(checksum(body));
        if (realCS !== cs)
          throw new Error(`Base64Armor: invalid checksum ${cs} instead of ${realCS}`);
        return inner.decode(body);
      }
      return inner.decode(base.base64.decode(lines.join('')));
    },
  };
}

// Does nothing at all
export const nothing = magic(bytes(0), EMPTY);

export function debug<T>(inner: CoderType<T>): CoderType<T> {
  if (!isCoder(inner)) throw new Error(`debug: invalid inner value ${inner}`);
  const log = (name: string, rw: Reader | Writer, value: any) => {
    console.log(`DEBUG/${name}(${rw.fieldPath.join('/')}):`, { type: typeof value, value });
    return value;
  };
  return wrap({
    size: inner.size,
    encodeStream: (w: Writer, value: T) => inner.encodeStream(w, log('encode', w, value)),
    decodeStream: (r: Reader): T => log('decode', r, inner.decodeStream(r)),
  });
}
