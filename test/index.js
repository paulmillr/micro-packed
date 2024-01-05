import { deepStrictEqual, throws } from 'node:assert';
import { should } from 'micro-should';
import { hex } from '@scure/base';
import * as P from '../lib/esm/index.js';

should('Packed U32BE', () => {
  const be32 = [
    [0, '00000000'],
    [123, '0000007b'],
    [12312, '00003018'],
    [1231231, '0012c97f'],
    [123123123, '0756b5b3'],
    [4294967295, 'ffffffff'],
  ];
  for (const [n, hexVal] of be32) {
    const b = hex.decode(hexVal);
    deepStrictEqual(n, P.U32BE.decode(b));
    deepStrictEqual(b, P.U32BE.encode(P.U32BE.decode(b)));
  }
  throws(() => P.U32BE.encode(4294967296));
});
should('Packed U32LE', () => {
  const le32 = [
    [0, '00000000'],
    [123, '7b000000'],
    [12312, '18300000'],
    [1231231, '7fc91200'],
    [123123123, 'b3b55607'],
    [4294967295, 'ffffffff'],
  ];
  for (const [n, hexVal] of le32) {
    const b = hex.decode(hexVal);
    deepStrictEqual(n, P.U32LE.decode(b));
    deepStrictEqual(b, P.U32LE.encode(P.U32LE.decode(b)));
  }
  throws(() => P.U32LE.encode(4294967296));
});
should('Packed I32BE', () => {
  const be32 = [
    [-2147483648, '80000000'],
    [-123123123, 'f8a94a4d'],
    [-1231231, 'ffed3681'],
    [-12312, 'ffffcfe8'],
    [-123, 'ffffff85'],
    [0, '00000000'],
    [123, '0000007b'],
    [12312, '00003018'],
    [1231231, '0012c97f'],
    [123123123, '0756b5b3'],
    [2147483647, '7fffffff'],
  ];
  for (const [n, hexVal] of be32) {
    const b = hex.decode(hexVal);
    deepStrictEqual(n, P.I32BE.decode(b));
    deepStrictEqual(b, P.I32BE.encode(P.I32BE.decode(b)));
  }
  throws(() => P.I32BE.encode(-2147483649));
  throws(() => P.I32BE.encode(2147483648));
});
should('Packed I32LE', () => {
  const le32 = [
    [-2147483648, '00000080'],
    [-123123123, '4d4aa9f8'],
    [-1231231, '8136edff'],
    [-12312, 'e8cfffff'],
    [-123, '85ffffff'],
    [0, '00000000'],
    [123, '7b000000'],
    [12312, '18300000'],
    [1231231, '7fc91200'],
    [123123123, 'b3b55607'],
    [2147483647, 'ffffff7f'],
  ];
  for (const [n, hexVal] of le32) {
    const b = hex.decode(hexVal);
    deepStrictEqual(n, P.I32LE.decode(b));
    deepStrictEqual(b, P.I32BE.encode(P.I32BE.decode(b)));
  }
  throws(() => P.I32LE.encode(-2147483649));
  throws(() => P.I32LE.encode(2147483648));
});

should('Map: basic', () => {
  const e = P.map(P.U8, { test: 5, other: 9 });
  deepStrictEqual(e.encode('test'), new Uint8Array([5]));
  deepStrictEqual(e.decode(e.encode('test')), 'test');
  deepStrictEqual(e.decode(e.encode('other')), 'other');
  throws(() => e.encode('anything'));
  throws(() => e.decode(new Uint8Array([1])));
});

should('array', () => {
  let arr = P.array(P.U8, P.U32LE);
  deepStrictEqual(
    arr.encode([1234, 5678, 9101112]),
    new Uint8Array([3, 210, 4, 0, 0, 46, 22, 0, 0, 56, 223, 138, 0])
  );
  deepStrictEqual(arr.decode(arr.encode([1234, 5678, 9101112])), [1234, 5678, 9101112]);
  const big = new Array(256).fill(0);
  throws(() => arr.encode(big));
  arr.encode(big.slice(0, 255));
});

should('padding', () => {
  const pL = P.padLeft(3, P.U8);
  const pR = P.padRight(3, P.string(null));
  deepStrictEqual(pL.encode(97), new Uint8Array([0, 0, 97]));
  deepStrictEqual(pR.encode('a'), new Uint8Array([97, 0, 0]));
  deepStrictEqual(pR.encode('aa'), new Uint8Array([97, 97, 0]));
  deepStrictEqual(pR.encode('aaa'), new Uint8Array([97, 97, 97]));
  deepStrictEqual(pR.encode('aaaa'), new Uint8Array([97, 97, 97, 97, 0, 0]));
});

should('flag', () => {
  const f = P.flag(new Uint8Array([0x1, 0x2, 0x3]));
  const f2 = P.flag(new Uint8Array([0x1, 0x2, 0x3]), true);
  deepStrictEqual(f.encode(true), new Uint8Array([0x1, 0x2, 0x3]));
  deepStrictEqual(f.encode(false), new Uint8Array([]));
  deepStrictEqual(f.decode(new Uint8Array([0x1, 0x2, 0x3])), true, 'flag true');
  deepStrictEqual(f.decode(new Uint8Array([])), false, 'flag false');
  throws(() => f.decode(new Uint8Array([0x1, 0x2])));
  throws(() => f.decode(new Uint8Array([0x1])));
  throws(() => f.decode(new Uint8Array([0x1, 0x2, 0x4])));

  deepStrictEqual(f2.encode(false), new Uint8Array([0x1, 0x2, 0x3]));
  deepStrictEqual(f2.encode(true), new Uint8Array([]));

  deepStrictEqual(f2.decode(new Uint8Array([0x1, 0x2, 0x3])), false, 'flag true xor');
  deepStrictEqual(f2.decode(new Uint8Array([])), true, 'flag false xor');
  throws(() => f2.decode(new Uint8Array([0x1, 0x2])));
  throws(() => f2.decode(new Uint8Array([0x1])));
  throws(() => f2.decode(new Uint8Array([0x1, 0x2, 0x4])));
});

should('flagged', () => {
  const s = P.struct({ f: P.flag(new Uint8Array([0x0, 0x1])), f2: P.flagged('f', P.U32BE) });
  deepStrictEqual(s.encode({ f2: 1234 }), new Uint8Array([]));
  deepStrictEqual(s.encode({ f: true, f2: 1234 }), new Uint8Array([0, 1, 0, 0, 4, 210]));
  // Flag but no data
  throws(() => s.encode({ f: true }));
  const s2 = P.struct({ f: P.flag(new Uint8Array([0x0, 0x1])), f2: P.flagged('f', P.U32BE, 123) });

  // If def=true -> encode default value when flag is disabled
  // TODO: do we need that at all? Cannot remember use-case where default option was useful.
  deepStrictEqual(s2.encode({ f2: 1234 }), new Uint8Array([0, 0, 0, 123]));
  deepStrictEqual(s2.encode({ f: true, f2: 1234 }), new Uint8Array([0, 1, 0, 0, 4, 210]));
  deepStrictEqual(s2.decode(new Uint8Array([0, 1, 0, 0, 4, 210])), { f: true, f2: 1234 });
  deepStrictEqual(s2.decode(new Uint8Array([0, 0, 0, 123])), { f: false, f2: undefined });

  // Decode only if there is flag. No flag -> return undefined
  const s3 = P.flagged(P.flag(new Uint8Array([0x0, 0x1])), P.U32BE);
  deepStrictEqual(s3.encode(123), new Uint8Array([0x0, 0x1, 0x0, 0x0, 0x0, 123]));
  deepStrictEqual(s3.encode(undefined), new Uint8Array([]));
  deepStrictEqual(s3.decode(new Uint8Array([0x0, 0x1, 0x0, 0x0, 0x0, 123])), 123);
  deepStrictEqual(s3.decode(new Uint8Array([])), undefined);
  throws(() => s3.decode(new Uint8Array([0x1])));
  throws(() => s3.decode(new Uint8Array([0x1, 0x2, 0x3, 0x4, 0x5, 0x6])));
  // Decode only if thre is no flag. If flag -> return undefined
  const s4 = P.flagged(P.flag(new Uint8Array([0x0, 0x1]), true), P.U32BE);
  deepStrictEqual(s4.encode(123), new Uint8Array([0x0, 0x0, 0x0, 123]));
  deepStrictEqual(s4.encode(undefined), new Uint8Array([0x0, 0x1]));
  deepStrictEqual(s4.decode(new Uint8Array([0x0, 0x1])), undefined);
  // Decode as is, if there is no flag
  deepStrictEqual(s4.decode(new Uint8Array([0x0, 0x0, 0x0, 0x4])), 0x4);
  throws(() => s4.decode(new Uint8Array([0x0, 0x1, 0x2])));
});

should('bits', () => {
  const s = P.struct({ f: P.bits(5), f1: P.bits(1), f2: P.bits(1), f3: P.bits(1) });
  deepStrictEqual(s.encode({ f: 1, f1: 0, f2: 1, f3: 0 }), new Uint8Array([0b00001010]));
  throws(() => s.encode({ f: 1, f1: 0, f2: 1, f3: 2 }));
  throws(() => s.encode({ f: 32, f1: 0, f2: 1, f3: 1 }));
  deepStrictEqual(s.encode({ f: 31, f1: 0, f2: 1, f3: 1 }), new Uint8Array([0b11111011]));
  const s2 = P.struct({ f: P.bits(5), f1: P.bits(3), f2: P.U8 });
  deepStrictEqual(s2.encode({ f: 1, f1: 1, f2: 254 }), new Uint8Array([0b00001001, 254]));
  const s3 = P.struct({ a: P.magic(P.bits(1), 1), b: P.bits(7), c: P.U8 });
  deepStrictEqual(s3.encode({ b: 0, c: 0 }), new Uint8Array([128, 0]));
  // wrong magic
  throws(() => s3.decode([0, 0]));
});

should('tuple/struct', () => {
  const str = P.string(P.U8);
  const s = P.struct({ a: P.U8, b: P.U16LE, c: str });
  const t = P.tuple([P.U8, P.U16LE, str]);
  //                                        a   b     cLen   h    e    l    l    o
  const expBytes = new Uint8Array([31, 57, 48, 5, 104, 101, 108, 108, 111]);
  deepStrictEqual(s.encode({ a: 31, b: 12345, c: 'hello' }), expBytes);
  deepStrictEqual(t.encode([31, 12345, 'hello']), expBytes);
  deepStrictEqual(s.decode(expBytes), { a: 31, b: 12345, c: 'hello' });
  deepStrictEqual(t.decode(expBytes), [31, 12345, 'hello']);
});

should('struct path', () => {
  let s1 = P.struct({
    sub1: P.struct({ someLen: P.U8 }),
    f2: P.string('sub1/someLen'),
  });
  let s2 = P.struct({
    sub1: P.struct({ someLen: P.U8 }),
    sub2: P.struct({ str: P.string('../sub1/someLen') }),
  });
  deepStrictEqual(
    s1.encode({ sub1: { someLen: 5 }, f2: 'hello' }),
    new Uint8Array([5, 104, 101, 108, 108, 111])
  );
  throws(() => s1.encode({ sub1: { someLen: 6 }, f2: 'hello' }));
  deepStrictEqual(
    s2.encode({ sub1: { someLen: 5 }, sub2: { str: 'hello' } }),
    new Uint8Array([5, 104, 101, 108, 108, 111])
  );
  throws(() => s2.encode({ sub1: { someLen: 6 }, sub2: { f2: 'hello' } }));
});

should('pointers', () => {
  let s = P.pointer(P.U8, P.U8);
  deepStrictEqual(s.encode(123), new Uint8Array([1, 123]));
});

should('Reader/bits: basic', () => {
  const u = new P.Reader(new Uint8Array([152, 0]));
  deepStrictEqual([u.bits(1), u.bits(1), u.bits(4), u.bits(2)], [1, 0, 6, 0]);
  deepStrictEqual(u.byte(), 0);
  deepStrictEqual(u.isEnd(), true);
});

should('Reader/bits: u32', () => {
  deepStrictEqual(new P.Reader(new Uint8Array([0xff, 0xff, 0xff, 0xff])).bits(32), 2 ** 32 - 1);
});

should('Reader/bits: full mask', () => {
  const u = new P.Reader(new Uint8Array([0xff]));
  deepStrictEqual([u.bits(1), u.bits(1), u.bits(4), u.bits(2)], [1, 1, 15, 3]);
  deepStrictEqual(u.isEnd(), true);
});

should('Reader/bits: u32 mask', () => {
  const u = new P.Reader(new Uint8Array([0b10101010, 0b10101010, 0b10101010, 0b10101010, 0]));
  for (let i = 0; i < 32; i++) deepStrictEqual(u.bits(1), +!(i & 1));
  deepStrictEqual(u.byte(), 0);
  deepStrictEqual(u.isEnd(), true);
});

should('Reader/bits: throw on non-full (1 byte)', () => {
  const r = new P.Reader(new Uint8Array([0xff, 0]));
  r.bits(7);
  throws(() => r.byte());
  throws(() => r.bytes(1));
  throws(() => r.bytes(1, true));
  throws(() => r.byte(true));
  r.bits(1);
  deepStrictEqual(r.byte(), 0);
  deepStrictEqual(r.isEnd(), true);
});

should('Reader/bits: throw on non-full (4 byte)', () => {
  const r = new P.Reader(new Uint8Array([0xff, 0xff, 0xff, 0xff, 0]));
  r.bits(31);
  throws(() => r.byte());
  throws(() => r.bytes(1));
  throws(() => r.bytes(1, true));
  throws(() => r.byte(true));
  r.bits(1);
  deepStrictEqual(r.byte(), 0);
  deepStrictEqual(r.isEnd(), true);
});

should('Reader/find', () => {
  const r = new P.Reader(new Uint8Array([0xfa, 0xfb, 0xfc, 0xfd, 0]));
  // Basic
  deepStrictEqual(r.find(new Uint8Array([0xfa])), 0);
  deepStrictEqual(r.find(new Uint8Array([0xfb])), 1);
  deepStrictEqual(r.find(new Uint8Array([0xfc])), 2);
  deepStrictEqual(r.find(new Uint8Array([0xfd])), 3);
  deepStrictEqual(r.find(new Uint8Array([0])), 4);
  // Two bytes
  deepStrictEqual(r.find(new Uint8Array([0xfb, 0xfc])), 1);
  deepStrictEqual(r.find(new Uint8Array([0xfb, 0xfd])), undefined);
  deepStrictEqual(r.find(new Uint8Array([0xfc, 0xfd])), 2);
  deepStrictEqual(r.find(new Uint8Array([0xfc, 0xfe])), undefined);
  // Bigger
  deepStrictEqual(r.find(new Uint8Array([0xfa, 0xfb, 0xfc, 0xfd, 0, 1])), undefined);
  // Same
  deepStrictEqual(r.find(new Uint8Array([0xfa, 0xfb, 0xfc, 0xfd, 0])), 0);
  // Empty needle
  throws(() => r.find(new Uint8Array()));
  // Non-bytes needle
  throws(() => r.find([]));
  const r2 = new P.Reader(new Uint8Array([0xfa, 0xfb, 0xfc, 0xfd, 0, 0xfa, 0xfb, 0xfc, 0xfd]));
  deepStrictEqual(r.find(new Uint8Array([0xfb, 0xfc])), 1);
  // Second element
  deepStrictEqual(r.find(new Uint8Array([0xfb, 0xfc]), 2), undefined);
  deepStrictEqual(r2.find(new Uint8Array([0xfb, 0xfc]), 2), 6);
});

should('Writer/bits: basic', () => {
  let w = new P.Writer();
  w.bits(1, 1);
  w.bits(0, 1);
  w.bits(6, 4);
  w.bits(0, 2);
  deepStrictEqual(w.buffer, new Uint8Array([152]));
});

should('Writer/bits: full mask', () => {
  let w = new P.Writer();
  w.bits(1, 1);
  w.bits(1, 1);
  w.bits(15, 4);
  w.bits(3, 2);
  deepStrictEqual(w.buffer, new Uint8Array([0xff]));
});

should('Writer/bits: u32 single', () => {
  let w = new P.Writer();
  w.bits(2 ** 32 - 1, 32);
  deepStrictEqual(w.buffer, new Uint8Array([0xff, 0xff, 0xff, 0xff]));
});

should('Writer/bits: u32 partial', () => {
  let w = new P.Writer();
  w.bits(0xff, 8);
  for (let i = 0; i < 8; i++) w.bits(1, 1);
  w.bits(0xffff, 16);
  deepStrictEqual(w.buffer, new Uint8Array([0xff, 0xff, 0xff, 0xff]));
});

should('Writer/bits: u32 mask', () => {
  let w = new P.Writer();
  for (let i = 0; i < 32; i++) w.bits(+!(i & 1), 1);
  deepStrictEqual(w.buffer, new Uint8Array([0b10101010, 0b10101010, 0b10101010, 0b10101010]));
});

should('Writer/bits: throw on non-full (1 byte)', () => {
  let w = new P.Writer();
  w.bits(0, 7);
  throws(() => w.buffer);
  throws(() => w.byte(1));
  throws(() => w.bytes(new Uint8Array([2, 3])));
  w.bits(0, 1);
  w.byte(1);
  w.bytes(new Uint8Array([2, 3]));
  deepStrictEqual(w.buffer, new Uint8Array([0, 1, 2, 3]));
});

should('Writer/bits: throw on non-full (4 byte)', () => {
  let w = new P.Writer();
  w.bits(0, 31);
  throws(() => w.buffer);
  throws(() => w.byte(1));
  throws(() => w.bytes(new Uint8Array([2, 3])));
  w.bits(0, 1);
  w.byte(1);
  w.bytes(new Uint8Array([2, 3]));
  deepStrictEqual(w.buffer, new Uint8Array([0, 0, 0, 0, 1, 2, 3]));
});

should('prefix', () => {
  // Should be same (elm size = 1 byte)
  const arr = P.array(P.U16BE, P.U8);
  const prefixed = P.prefix(P.U16BE, P.array(null, P.U8));
  const prefixed2 = P.prefix(P.U16BE, P.array(null, P.U16BE));
  for (const t of [[], [1], [1, 2], [1, 2, 3], [1, 2, 3, 4]]) {
    const encoded = prefixed.encode(t);
    deepStrictEqual(encoded, arr.encode(t));
    deepStrictEqual(prefixed.decode(encoded), t);
    deepStrictEqual(arr.decode(encoded), t);
    deepStrictEqual(prefixed2.decode(prefixed2.encode(t)), t);
  }
  // Same as before , but size = 2*arr size
  deepStrictEqual(prefixed2.encode([]), new Uint8Array([0, 0]));
  deepStrictEqual(prefixed2.encode([1]), new Uint8Array([0, 2, 0, 1]));
  deepStrictEqual(prefixed2.encode([1, 2]), new Uint8Array([0, 4, 0, 1, 0, 2]));
  deepStrictEqual(prefixed2.encode([1, 2, 3]), new Uint8Array([0, 6, 0, 1, 0, 2, 0, 3]));
});

should('array(sz=null)', () => {
  const a = P.array(null, P.U16BE);
  const data = [1, 2, 3, 4, 5, 6, 7];
  deepStrictEqual(a.decode(a.encode(data)), data);
  deepStrictEqual(a.encode(data), new Uint8Array([0, 1, 0, 2, 0, 3, 0, 4, 0, 5, 0, 6, 0, 7]));
  // Array of unknown size should be last element or it will eat everything
  const t = P.tuple([a, a]);
  deepStrictEqual(
    t.decode(
      t.encode([
        [1, 2, 3],
        [4, 5, 6],
      ])
    ),
    [[1, 2, 3, 4, 5, 6], []]
  );
  // But what if next elm is smaller than array elm, it still should work
  const t2 = P.tuple([a, P.U8]);
  deepStrictEqual(t2.decode(t2.encode([[1, 2, 3], 4])), [[1, 2, 3], 4]);
  // But should still fail if there some bytes left
  throws(() => a.decode(t2.encode([[1, 2, 3], 4])));
  // But if last elm has same size as inner element it should be processed as is
  const t3 = P.tuple([a, P.U16BE]);
  deepStrictEqual(a.decode(t3.encode([[1, 2, 3], 4])), [1, 2, 3, 4]);
  // Prefixed unkown size arrays works as is
  const prefixed = P.prefix(P.U16BE, a);
  const t4 = P.tuple([prefixed, prefixed]);
  deepStrictEqual(
    t4.decode(
      t4.encode([
        [1, 2, 3],
        [4, 5, 6],
      ])
    ),
    [
      [1, 2, 3],
      [4, 5, 6],
    ]
  );
});

should('array(sz=fixed number)', () => {
  const a = P.array(4, P.U16BE);
  // Throws if size different
  throws(() => a.encode([1]));
  throws(() => a.encode([1, 2, 3, 4, 5]));
  const data = [1, 2, 3, 4];
  deepStrictEqual(a.decode(a.encode(data)), data);
  deepStrictEqual(a.encode(data), new Uint8Array([0, 1, 0, 2, 0, 3, 0, 4]));
});

should('array(sz=dynamic number)', () => {
  const a = P.array(P.U16LE, P.U16BE);
  // Works for different sizes
  deepStrictEqual(a.decode(a.encode([1])), [1]);
  deepStrictEqual(a.decode(a.encode([1, 2])), [1, 2]);
  deepStrictEqual(a.decode(a.encode([1, 2, 3])), [1, 2, 3]);
  deepStrictEqual(a.encode([1, 2, 3]), new Uint8Array([3, 0, 0, 1, 0, 2, 0, 3]));
});

should('array(sz=path)', () => {
  const a = P.struct({
    len: P.U16LE,
    arr: P.array('len', P.U16BE),
  });
  // Throws on argument and array size mismatch
  throws(() => a.encode({ len: 1, arr: [1, 2] }));
  // Works for different sizes
  deepStrictEqual(a.decode(a.encode({ len: 1, arr: [1] })), { len: 1, arr: [1] });
  deepStrictEqual(a.decode(a.encode({ len: 2, arr: [1, 2] })), { len: 2, arr: [1, 2] });
  deepStrictEqual(a.decode(a.encode({ len: 3, arr: [1, 2, 3] })), { len: 3, arr: [1, 2, 3] });
  // Same as array(sz=fixed number encoding)
  deepStrictEqual(
    a.encode({ len: 3, arr: [1, 2, 3] }),
    P.array(P.U16LE, P.U16BE).encode([1, 2, 3])
  );
});

should('array(sz=bytes)', () => {
  const a = P.array(new Uint8Array([0]), P.U16LE);
  // basic encode/decode
  deepStrictEqual(a.decode(a.encode([1, 2, 3])), [1, 2, 3]);
  // NOTE: LE here becase 0 is terminator
  deepStrictEqual(a.encode([1, 2, 3]), new Uint8Array([1, 0, 2, 0, 3, 0, 0]));
  // No terminator!
  throws(() => a.decode(new Uint8Array([1, 0])));
  // Early terminator
  throws(() => a.decode(new Uint8Array([1, 0, 1])));
  // Fails because 0 has same encoding as terminator
  throws(() => a.encode([0, 1, 2]));
  // Different separator, so we can encode zero
  const a2 = P.array(new Uint8Array([1, 2, 3]), P.U16LE);
  deepStrictEqual(a2.decode(a2.encode([0, 1, 2])), [0, 1, 2]);
  deepStrictEqual(a2.encode([0, 1, 2]), new Uint8Array([0, 0, 1, 0, 2, 0, 1, 2, 3]));
  // corrupted terminator
  throws(() => a.decode(new Uint8Array([1, 0, 2, 0, 1, 2])));
});

should('bytes(sz=null)', () => {
  const a = P.bytes(null);
  const data = new Uint8Array([1, 2, 3]);
  deepStrictEqual(a.decode(a.encode(data)), data);
  deepStrictEqual(a.encode(data), new Uint8Array([1, 2, 3]));
});

should('bytes(sz=fixed number)', () => {
  const a = P.bytes(4);
  // Throws if size different
  throws(() => a.encode(new Uint8Array([1])));
  throws(() => a.encode(new Uint8Array([1, 2, 3, 4, 5])));
  const data = new Uint8Array([1, 2, 3, 4]);
  deepStrictEqual(a.decode(a.encode(data)), data);
  deepStrictEqual(a.encode(data), new Uint8Array([1, 2, 3, 4]));
});

should('bytes(sz=dynamic number)', () => {
  const a = P.bytes(P.U16LE);
  // Works for different sizes
  deepStrictEqual(a.decode(a.encode(new Uint8Array([1]))), new Uint8Array([1]));
  deepStrictEqual(a.decode(a.encode(new Uint8Array([1, 2]))), new Uint8Array([1, 2]));
  deepStrictEqual(a.decode(a.encode(new Uint8Array([1, 2, 3]))), new Uint8Array([1, 2, 3]));
  deepStrictEqual(a.encode(new Uint8Array([1, 2, 3])), new Uint8Array([3, 0, 1, 2, 3]));
});

should('bytes(sz=path)', () => {
  const a = P.struct({
    len: P.U16LE,
    arr: P.bytes('len'),
  });
  // Throws on argument and array size mismatch
  throws(() => a.encode({ len: 1, arr: new Uint8Array([1, 2]) }));
  // Works for different sizes
  deepStrictEqual(a.decode(a.encode({ len: 1, arr: new Uint8Array([1]) })), {
    len: 1,
    arr: new Uint8Array([1]),
  });
  deepStrictEqual(a.decode(a.encode({ len: 2, arr: new Uint8Array([1, 2]) })), {
    len: 2,
    arr: new Uint8Array([1, 2]),
  });
  deepStrictEqual(a.decode(a.encode({ len: 3, arr: new Uint8Array([1, 2, 3]) })), {
    len: 3,
    arr: new Uint8Array([1, 2, 3]),
  });
  // Same as bytes(sz=fixed number encoding)
  deepStrictEqual(
    a.encode({ len: 3, arr: new Uint8Array([1, 2, 3]) }),
    P.bytes(P.U16LE).encode(new Uint8Array([1, 2, 3]))
  );
});

should('bytes(sz=bytes)', () => {
  const a = P.bytes(new Uint8Array([0]));
  // basic encode/decode
  deepStrictEqual(a.decode(a.encode(new Uint8Array([1, 2, 3]))), new Uint8Array([1, 2, 3]));
  // NOTE: LE here becase 0 is terminator
  deepStrictEqual(a.encode(new Uint8Array([1, 2, 3])), new Uint8Array([1, 2, 3, 0]));
  // No terminator!
  throws(() => a.decode(new Uint8Array([1, 2])));
  deepStrictEqual(a.decode(new Uint8Array([1, 2, 0])), new Uint8Array([1, 2]));
  // Early terminator
  throws(() => a.decode(new Uint8Array([1, 0, 1])));
  // Different separator, so we can encode zero
  const a2 = P.bytes(new Uint8Array([9, 8, 7]));
  deepStrictEqual(a2.decode(a2.encode(new Uint8Array([0, 1, 2]))), new Uint8Array([0, 1, 2]));
  deepStrictEqual(a2.encode(new Uint8Array([0, 1, 2])), new Uint8Array([0, 1, 2, 9, 8, 7]));
  // // corrupted terminator
  throws(() => a.decode(new Uint8Array([1, 2, 3, 9, 8])));
});

should('cstring', () => {
  deepStrictEqual(P.cstring.encode('test'), new Uint8Array([116, 101, 115, 116, 0]));
  deepStrictEqual(P.cstring.decode(P.cstring.encode('test')), 'test');
  // Early terminator
  throws(() => P.cstring.decode(new Uint8Array([116, 101, 0, 115, 116])));
});

should('hex', () => {
  const h = P.apply(P.bytes(P.U16BE), hex);
  const data = '01020304';
  deepStrictEqual(h.decode(h.encode(data)), data);
});

should('dict', () => {
  const coder = P.array(P.U16BE, P.tuple([P.cstring, P.U32LE]));
  const h = P.apply(coder, P.coders.dict());
  const data = { lol: 1, blah: 2 };
  deepStrictEqual(h.decode(h.encode(data)), data);
});

should('lazy', () => {
  // Allows creating circular structures
  const tree = P.struct({
    name: P.cstring,
    childs: P.array(
      P.U16BE,
      P.lazy(() => tree)
    ),
  });
  const CASES = [
    { name: 'a', childs: [] },
    {
      name: 'root',
      childs: [
        { name: 'a', childs: [] },
        { name: 'b', childs: [{ name: 'c', childs: [{ name: 'd', childs: [] }] }] },
      ],
    },
  ];
  for (const c of CASES) deepStrictEqual(tree.decode(tree.encode(c)), c);
});

should('validate', () => {
  let t = (n) => {
    if (n > 100) throw new Error('N > 100');
    return n;
  };
  const c = P.validate(P.U8, t);
  deepStrictEqual(c.decode(c.encode(1)), 1);
  deepStrictEqual(c.decode(c.encode(100)), 100);
  throws(() => c.encode(101));
  throws(() => c.decode(new Uint8Array([101])));
});

should('coders/number', () => {
  deepStrictEqual(P.coders.number.encode(1000n), 1000);
  deepStrictEqual(P.coders.number.encode(9007199254740991n), 9007199254740991);
  throws(() => P.coders.number.encode(9007199254740992n));
});

should('debug', () => {
  const s = P.debug(
    P.struct({
      name: P.debug(P.cstring),
      num: P.debug(P.U32LE),
      child: P.debug(
        P.struct({
          a: P.debug(P.bool),
          b: P.debug(P.U256BE),
        })
      ),
    })
  );
  const data = {
    name: 'blah',
    num: 123,
    child: {
      a: true,
      b: 123n,
    },
  };
  deepStrictEqual(s.decode(s.encode(data)), data);
});

should('coders/decimal', () => {
  const d8 = P.coders.decimal(8);
  deepStrictEqual(d8.decode('6.30880845'), 630880845n);
  deepStrictEqual(d8.decode('6.308'), 630800000n);
  deepStrictEqual(d8.decode('6.00008'), 600008000n);
  deepStrictEqual(d8.decode('10'), 1000000000n);
  deepStrictEqual(d8.decode('200'), 20000000000n);
  const cases = [
    '6.30880845',
    '6.308',
    '6.00008',
    '10',
    '200',
    '0.1',
    '0.01',
    '0.001',
    '0.0001',
    '19.0001',
    '99999999',
    '-6.30880845',
    '-6.308',
    '-6.00008',
    '-10',
    '-200',
    '-0.1',
    '-0.01',
    '-0.001',
    '-0.0001',
    '-19.0001',
    '-99999999',
  ];
  for (let c of cases) deepStrictEqual(d8.encode(d8.decode(c)), c);
  const d2 = P.coders.decimal(2);
  // Round number if precision is smaller than fraction part length
  deepStrictEqual(d2.decode('22.11111111111111111'), 2211n);
  deepStrictEqual(d2.decode('222222.11111111111111111'), 22222211n);
  deepStrictEqual(d2.encode(d2.decode('22.1111')), '22.11');
  deepStrictEqual(d2.encode(d2.decode('22.9999')), '22.99');
  // Doesn't affect integer part
  deepStrictEqual(
    d2.encode(d2.decode('222222222222222222222222222.9999')),
    '222222222222222222222222222.99'
  );
  const u64 = P.apply(P.U64BE, P.coders.decimal(18));
  deepStrictEqual(u64.decode(u64.encode('10.1')), '10.1');
  deepStrictEqual(u64.decode(u64.encode('1.1234567')), '1.1234567');
});

should('coders/match', () => {
  const m1 = {
    encode(from) {
      if (from.type === 't1') return 1;
    },
    decode(to) {
      if (to === 1) return { type: 't1' };
    },
  };
  const m2 = {
    encode(from) {
      if (from.type === 't2') return 2;
    },
    decode(to) {
      if (to === 2) return { type: 't2' };
    },
  };
  const m3 = {
    encode(from) {
      if (from.type === 't3') return 3;
    },
    decode(to) {
      if (to === 3) return { type: 't3' };
    },
  };
  const m = P.coders.match([m1, m2, m3]);
  // ^ 24 lines
  // Same as: (which is 13 lines, x2 more)
  // But:
  // - missing condition will be easier to spot
  // - significantly more easier to reason about validity of specific coder
  // NOTE: it is O(N), if enum/tag is possible, better to use them
  const mOld = {
    encode(from) {
      if (from.type === 't1') return 1;
      if (from.type === 't2') return 2;
      if (from.type === 't3') return 3;
      throw new Error();
    },
    decode(to) {
      if (to === 1) return { type: 't1' };
      if (to === 2) return { type: 't2' };
      if (to === 3) return { type: 't3' };
      throw new Error();
    },
  };
  // M1
  deepStrictEqual(m.encode({ type: 't1' }), 1);
  deepStrictEqual(m.decode(1), { type: 't1' });
  deepStrictEqual(m.decode(m.encode({ type: 't1' })), { type: 't1' });
  // M2
  deepStrictEqual(m.encode({ type: 't2' }), 2);
  deepStrictEqual(m.decode(2), { type: 't2' });
  deepStrictEqual(m.decode(m.encode({ type: 't2' })), { type: 't2' });
  // M3
  deepStrictEqual(m.encode({ type: 't3' }), 3);
  deepStrictEqual(m.decode(3), { type: 't3' });
  deepStrictEqual(m.decode(m.encode({ type: 't3' })), { type: 't3' });
  throws(() => m.encode({ type: 't4' }));
  throws(() => m.decode(4));
});

should('sizeof', () => {
  const s0 = P.array(0, P.U32LE);
  const s1 = P.array(1, P.U8);
  const s4 = P.U32LE;
  deepStrictEqual(s0.size, 0);
  deepStrictEqual(s1.size, 1);
  deepStrictEqual(s4.size, 4);
  deepStrictEqual(P.tuple([s0]).size, 0);
  deepStrictEqual(P.tuple([s1]).size, 1);
  deepStrictEqual(P.tuple([s1, s0, s1, s0, s1]).size, 3);
  deepStrictEqual(P.array(3, s1).size, 3);
  deepStrictEqual(P.array(3, s4).size, 12);
  // Size of dynamic arrays is undefined
  deepStrictEqual(P.array(null, s4).size, undefined);
  deepStrictEqual(P.array(P.U8, s4).size, undefined);
  deepStrictEqual(P.struct({ f1: s0 }).size, 0);
  deepStrictEqual(P.struct({ f1: s1 }).size, 1);
  deepStrictEqual(P.struct({ f1: s1, f2: s0, f3: s1, f4: s0, f5: s1 }).size, 3);
});

should.run();
