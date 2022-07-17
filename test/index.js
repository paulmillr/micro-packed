import assert from 'assert';
import { should } from 'micro-should';
import { hex } from '@scure/base';
import * as P from '../index.js';

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
    assert.deepStrictEqual(n, P.U32BE.decode(b));
    assert.deepStrictEqual(b, P.U32BE.encode(P.U32BE.decode(b)));
  }
  assert.throws(() => P.U32BE.encode(4294967296));
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
    assert.deepStrictEqual(n, P.U32LE.decode(b));
    assert.deepStrictEqual(b, P.U32LE.encode(P.U32LE.decode(b)));
  }
  assert.throws(() => P.U32LE.encode(4294967296));
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
    assert.deepStrictEqual(n, P.I32BE.decode(b));
    assert.deepStrictEqual(b, P.I32BE.encode(P.I32BE.decode(b)));
  }
  assert.throws(() => P.I32BE.encode(-2147483649));
  assert.throws(() => P.I32BE.encode(2147483648));
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
    assert.deepStrictEqual(n, P.I32LE.decode(b));
    assert.deepStrictEqual(b, P.I32BE.encode(P.I32BE.decode(b)));
  }
  assert.throws(() => P.I32LE.encode(-2147483649));
  assert.throws(() => P.I32LE.encode(2147483648));
});

should('Map: basic', () => {
  const e = P.map(P.U8, { test: 5, other: 9 });
  assert.deepStrictEqual(e.encode('test'), new Uint8Array([5]));
  assert.deepStrictEqual(e.decode(e.encode('test')), 'test');
  assert.deepStrictEqual(e.decode(e.encode('other')), 'other');
  assert.throws(() => e.encode('anything'));
  assert.throws(() => e.decode(new Uint8Array([1])));
});

should('array', () => {
  let arr = P.array(P.U8, P.U32LE);
  assert.deepStrictEqual(
    arr.encode([1234, 5678, 9101112]),
    new Uint8Array([3, 210, 4, 0, 0, 46, 22, 0, 0, 56, 223, 138, 0])
  );
  assert.deepStrictEqual(arr.decode(arr.encode([1234, 5678, 9101112])), [1234, 5678, 9101112]);
  const big = new Array(256).fill(0);
  assert.throws(() => arr.encode(big));
  arr.encode(big.slice(0, 255));
});

should('padding', () => {
  const pL = P.padLeft(3, P.U8);
  const pR = P.padRight(3, P.string(null));
  assert.deepStrictEqual(pL.encode(97), new Uint8Array([0, 0, 97]));
  assert.deepStrictEqual(pR.encode('a'), new Uint8Array([97, 0, 0]));
  assert.deepStrictEqual(pR.encode('aa'), new Uint8Array([97, 97, 0]));
  assert.deepStrictEqual(pR.encode('aaa'), new Uint8Array([97, 97, 97]));
  assert.deepStrictEqual(pR.encode('aaaa'), new Uint8Array([97, 97, 97, 97, 0, 0]));
});

should('flags', () => {
  const s = P.struct({ f: P.flag(new Uint8Array([0x0, 0x1])), f2: P.flagged('f', P.U32BE) });
  assert.deepStrictEqual(s.encode({ f2: 1234 }), new Uint8Array([]));
  assert.deepStrictEqual(s.encode({ f: true, f2: 1234 }), new Uint8Array([0, 1, 0, 0, 4, 210]));
  // Flag but no data
  assert.throws(() => s.encode({ f: true }));
});

should('bits', () => {
  const s = P.struct({ f: P.bits(5), f1: P.bits(1), f2: P.bits(1), f3: P.bits(1) });
  assert.deepStrictEqual(s.encode({ f: 1, f1: 0, f2: 1, f3: 0 }), new Uint8Array([0b00001010]));
  assert.throws(() => s.encode({ f: 1, f1: 0, f2: 1, f3: 2 }));
  assert.throws(() => s.encode({ f: 32, f1: 0, f2: 1, f3: 1 }));
  assert.deepStrictEqual(s.encode({ f: 31, f1: 0, f2: 1, f3: 1 }), new Uint8Array([0b11111011]));
  const s2 = P.struct({ f: P.bits(5), f1: P.bits(3), f2: P.U8 });
  assert.deepStrictEqual(s2.encode({ f: 1, f1: 1, f2: 254 }), new Uint8Array([0b00001001, 254]));
  const s3 = P.struct({ a: P.magic(P.bits(1), 1), b: P.bits(7), c: P.U8 });
  assert.deepStrictEqual(s3.encode({ b: 0, c: 0 }), new Uint8Array([128, 0]));
  // wrong magic
  assert.throws(() => s3.decode([0, 0]));
});

should('tuple/struct', () => {
  const str = P.string(P.U8);
  const s = P.struct({ a: P.U8, b: P.U16LE, c: str });
  const t = P.tuple([P.U8, P.U16LE, str]);
  //                                        a   b     cLen   h    e    l    l    o
  const expBytes = new Uint8Array([31, 57, 48, 5, 104, 101, 108, 108, 111]);
  assert.deepStrictEqual(s.encode({ a: 31, b: 12345, c: 'hello' }), expBytes);
  assert.deepStrictEqual(t.encode([31, 12345, 'hello']), expBytes);
  assert.deepStrictEqual(s.decode(expBytes), { a: 31, b: 12345, c: 'hello' });
  assert.deepStrictEqual(t.decode(expBytes), [31, 12345, 'hello']);
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
  assert.deepStrictEqual(
    s1.encode({ sub1: { someLen: 5 }, f2: 'hello' }),
    new Uint8Array([5, 104, 101, 108, 108, 111])
  );
  assert.throws(() => s1.encode({ sub1: { someLen: 6 }, f2: 'hello' }));
  assert.deepStrictEqual(
    s2.encode({ sub1: { someLen: 5 }, sub2: { str: 'hello' } }),
    new Uint8Array([5, 104, 101, 108, 108, 111])
  );
  assert.throws(() => s2.encode({ sub1: { someLen: 6 }, sub2: { f2: 'hello' } }));
});

should('pointers', () => {
  let s = P.pointer(P.U8, P.U8);
  assert.deepStrictEqual(s.encode(123), new Uint8Array([1, 123]));
});

should('Reader/bits: basic', () => {
  const u = new P.Reader(new Uint8Array([152, 0]));
  assert.deepStrictEqual([u.bits(1), u.bits(1), u.bits(4), u.bits(2)], [1, 0, 6, 0]);
  assert.deepStrictEqual(u.byte(), 0);
  assert.deepStrictEqual(u.isEnd(), true);
});

should('Reader/bits: u32', () => {
  assert.deepStrictEqual(
    new P.Reader(new Uint8Array([0xff, 0xff, 0xff, 0xff])).bits(32),
    2 ** 32 - 1
  );
});

should('Reader/bits: full mask', () => {
  const u = new P.Reader(new Uint8Array([0xff]));
  assert.deepStrictEqual([u.bits(1), u.bits(1), u.bits(4), u.bits(2)], [1, 1, 15, 3]);
  assert.deepStrictEqual(u.isEnd(), true);
});

should('Reader/bits: u32 mask', () => {
  const u = new P.Reader(new Uint8Array([0b10101010, 0b10101010, 0b10101010, 0b10101010, 0]));
  for (let i = 0; i < 32; i++) assert.deepStrictEqual(u.bits(1), +!(i & 1));
  assert.deepStrictEqual(u.byte(), 0);
  assert.deepStrictEqual(u.isEnd(), true);
});

should('Reader/bits: throw on non-full (1 byte)', () => {
  const r = new P.Reader(new Uint8Array([0xff, 0]));
  r.bits(7);
  assert.throws(() => r.byte());
  assert.throws(() => r.bytes(1));
  assert.throws(() => r.bytes(1, true));
  assert.throws(() => r.byte(true));
  r.bits(1);
  assert.deepStrictEqual(r.byte(), 0);
  assert.deepStrictEqual(r.isEnd(), true);
});

should('Reader/bits: throw on non-full (4 byte)', () => {
  const r = new P.Reader(new Uint8Array([0xff, 0xff, 0xff, 0xff, 0]));
  r.bits(31);
  assert.throws(() => r.byte());
  assert.throws(() => r.bytes(1));
  assert.throws(() => r.bytes(1, true));
  assert.throws(() => r.byte(true));
  r.bits(1);
  assert.deepStrictEqual(r.byte(), 0);
  assert.deepStrictEqual(r.isEnd(), true);
});

should('Writer/bits: basic', () => {
  let w = new P.Writer();
  w.bits(1, 1);
  w.bits(0, 1);
  w.bits(6, 4);
  w.bits(0, 2);
  assert.deepStrictEqual(w.buffer, new Uint8Array([152]));
});

should('Writer/bits: full mask', () => {
  let w = new P.Writer();
  w.bits(1, 1);
  w.bits(1, 1);
  w.bits(15, 4);
  w.bits(3, 2);
  assert.deepStrictEqual(w.buffer, new Uint8Array([0xff]));
});

should('Writer/bits: u32 single', () => {
  let w = new P.Writer();
  w.bits(2 ** 32 - 1, 32);
  assert.deepStrictEqual(w.buffer, new Uint8Array([0xff, 0xff, 0xff, 0xff]));
});

should('Writer/bits: u32 partial', () => {
  let w = new P.Writer();
  w.bits(0xff, 8);
  for (let i = 0; i < 8; i++) w.bits(1, 1);
  w.bits(0xffff, 16);
  assert.deepStrictEqual(w.buffer, new Uint8Array([0xff, 0xff, 0xff, 0xff]));
});

should('Writer/bits: u32 mask', () => {
  let w = new P.Writer();
  for (let i = 0; i < 32; i++) w.bits(+!(i & 1), 1);
  assert.deepStrictEqual(
    w.buffer,
    new Uint8Array([0b10101010, 0b10101010, 0b10101010, 0b10101010])
  );
});

should('Writer/bits: throw on non-full (1 byte)', () => {
  let w = new P.Writer();
  w.bits(0, 7);
  assert.throws(() => w.buffer);
  assert.throws(() => w.byte(1));
  assert.throws(() => w.bytes(new Uint8Array([2, 3])));
  w.bits(0, 1);
  w.byte(1);
  w.bytes(new Uint8Array([2, 3]));
  assert.deepStrictEqual(w.buffer, new Uint8Array([0, 1, 2, 3]));
});

should('Writer/bits: throw on non-full (4 byte)', () => {
  let w = new P.Writer();
  w.bits(0, 31);
  assert.throws(() => w.buffer);
  assert.throws(() => w.byte(1));
  assert.throws(() => w.bytes(new Uint8Array([2, 3])));
  w.bits(0, 1);
  w.byte(1);
  w.bytes(new Uint8Array([2, 3]));
  assert.deepStrictEqual(w.buffer, new Uint8Array([0, 0, 0, 0, 1, 2, 3]));
});

should.run();
