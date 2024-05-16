import * as P from './index.js';
import * as base from '@scure/base';
// Should not be included in npm package. For typescript testing only
const assertType = <T>(_value: T) => {};

// Writable
const wt1 = [1] as const;
const wt2 = ['string'] as const;
const wt3 = [new Uint8Array()] as const;
const wt4 = [[1, 2, 3]] as const;
const wt5 = [['1', '2', '3']] as const;
const wt6 = [new Uint32Array()] as const;
const wt7 = [true] as const;

assertType<[1]>(1 as any as P.Writable<typeof wt1>);
assertType<['string']>(1 as any as P.Writable<typeof wt2>);
assertType<[Uint8Array]>(1 as any as P.Writable<typeof wt3>);
assertType<[[1, 2, 3]]>(1 as any as P.Writable<typeof wt4>);
assertType<[['1', '2', '3']]>(1 as any as P.Writable<typeof wt5>);
assertType<[Uint32Array]>(1 as any as P.Writable<typeof wt6>);
assertType<[true]>(1 as any as P.Writable<typeof wt7>);

// Basic types
assertType<P.CoderType<boolean>>(P.bool);
assertType<P.CoderType<number>>(P.U8);
assertType<P.CoderType<number>>(P.U16BE);
assertType<P.CoderType<number>>(P.U16LE);
assertType<P.CoderType<number>>(P.U32BE);
assertType<P.CoderType<number>>(P.U32LE);
assertType<P.CoderType<bigint>>(P.U64BE);
assertType<P.CoderType<bigint>>(P.U64LE);
assertType<P.CoderType<bigint>>(P.U128BE);
assertType<P.CoderType<bigint>>(P.U128LE);
assertType<P.CoderType<bigint>>(P.U256BE);
assertType<P.CoderType<bigint>>(P.U256LE);
assertType<P.CoderType<string>>(P.string(null));
assertType<P.CoderType<string>>(P.cstring);
assertType<P.CoderType<P.Bytes>>(P.bytes(null));
assertType<P.CoderType<string>>(P.hex(null));

// Complex types

// Arrays
assertType<P.CoderType<string[]>>(P.array(null, P.cstring));
// Struct
assertType<P.CoderType<{ a: number; b: string }>>(P.struct({ a: P.U8, b: P.cstring }));
assertType<P.CoderType<{ a: number; b: string }>>(P.struct({ a: P.U8, b: P.cstring } as const));
// Magic is empty
assertType<P.CoderType<{ a: number }>>(P.struct({ a: P.U8, b: P.magic(P.bytes(null), P.NULL) }));
// Tuples. Unfortunately requires 'as const' to get nice types
assertType<P.CoderType<[number, string]>>(P.tuple([P.U8, P.cstring] as const));
assertType<P.CoderType<[number, Uint8Array]>>(P.tuple([P.U8, P.bytes(null)] as const));
assertType<P.CoderType<[number, Uint8Array[]]>>(
  P.tuple([P.U8, P.array(null, P.bytes(null))] as const)
);

assertType<P.CoderType<[number, string, boolean]>>(P.tuple([P.U8, P.cstring, P.bool] as const));
assertType<P.CoderType<(number | string)[]>>(P.tuple([P.U8, P.cstring]));
assertType<P.CoderType<(string | number | boolean)[]>>(P.tuple([P.U8, P.cstring, P.bool]));
// Map
assertType<P.CoderType<string>>(P.map(P.U8, { l: 0x00 }));
assertType<P.CoderType<string>>(P.map(P.U64BE, { l: 0x00n }));
assertType<P.CoderType<string>>(P.map(P.cstring, { l: 'test' }));
// Tag
assertType<P.CoderType<{ TAG: 1; data: string } | { TAG: 2; data: boolean }>>(
  P.tag(P.U8, { 1: P.cstring, 2: P.bool })
);
assertType<P.CoderType<{ TAG: 'a'; data: string } | { TAG: 'b'; data: boolean }>>(
  P.tag(P.cstring, { a: P.cstring, b: P.bool })
);
// NOTE: U256 is bigint by default, but we can cast it to number
assertType<P.CoderType<{ TAG: 1; data: string } | { TAG: 2; data: boolean }>>(
  P.tag(P.apply(P.U256BE, P.coders.numberBigint), { 1: P.cstring, 2: P.bool })
);
// MappedTag
assertType<P.CoderType<{ TAG: 'a'; data: string } | { TAG: 'b'; data: boolean }>>(
  P.mappedTag(P.U8, { a: [1, P.cstring], b: [2, P.bool] })
);
assertType<
  P.CoderType<{ TAG: 'a'; data: string } | { TAG: 'b'; data: boolean } | { TAG: 'c'; data: number }>
>(P.mappedTag(P.U8, { a: [1, P.cstring], b: [2, P.bool], c: [3, P.U8] }));
// Apply
assertType<P.CoderType<string>>(P.apply(P.bytes(null), base.base16));
// Validate
assertType<P.CoderType<string>>(P.validate(P.cstring, (a) => a));
// Dict
const d1 = P.array(P.U16BE, P.tuple([P.cstring, P.U32LE] as const));
assertType<P.CoderType<[string, number][]>>(d1);
assertType<P.CoderType<Record<string, number>>>(P.apply(d1, P.coders.dict()));

// Lazy
assertType<P.CoderType<boolean>>(P.lazy(() => P.bool));
type Tree = { name: string; children: Tree[] };
const tree = P.struct({
  name: P.cstring,
  children: P.array(
    P.U16BE,
    P.lazy((): P.CoderType<Tree> => tree)
  ),
});
assertType<P.CoderType<Tree>>(tree);

// tsEnum
enum Test {
  a = 0x00,
  b = 0x01,
  c = 0x02,
}
assertType<base.Coder<number, 'a' | 'b' | 'c'>>(P.coders.tsEnum(Test));
const e = P.apply(P.U8, P.coders.tsEnum(Test));
assertType<P.CoderType<'a' | 'b' | 'c'>>(e);
// TODO: remove map && replace with this?

// match
assertType<base.Coder<bigint | [string, unknown][], number | Record<string, unknown>>>(
  P.coders.match([P.coders.numberBigint, P.coders.dict()])
);

const m1: base.Coder<number | undefined, string> = 1 as any;
const m2: base.Coder<bigint | undefined, boolean> = 1 as any;
const m3: base.Coder<[bigint] | undefined, 'omg'> = 1 as any;
assertType<base.Coder<number | bigint | [bigint], string | boolean>>(P.coders.match([m1, m2, m3]));
