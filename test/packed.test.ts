import { hex } from '@scure/base';
import { describe, should } from 'micro-should';
import { deepStrictEqual as eql, throws } from 'node:assert';
import * as PD from '../src/debugger.ts';
import * as P from '../src/index.ts';

const Reader = P._TEST._Reader;
const Writer = P._TEST._Writer;

const toBytes = (s) => (typeof s === 'string' ? hex.decode(s) : s);
const test = (name, v) => {
  describe(name, () => {
    should('correct', () => {
      for (const [expVal, expHex] of v.correct || []) {
        const encoded = v.p.encode(expVal);
        eql(hex.encode(encoded), expHex, 'encode');
        eql(v.p.decode(encoded), expVal, 'decode(encode)');
        const decoded = v.p.decode(hex.decode(expHex));
        eql(decoded, expVal, 'decode');
        eql(hex.encode(v.p.encode(decoded)), expHex, 'encode(decode)');
      }
    });
    should('err values', () => {
      for (const value of v.errValues || []) throws(() => v.p.encode(value));
    });
    should('err hex', () => {
      for (const value of v.errHex || []) throws(() => v.p.decode(toBytes(value)));
    });
  });
};

describe('primitives', () => {
  test('U32BE', {
    p: P.U32BE,
    correct: [
      [0, '00000000'],
      [123, '0000007b'],
      [12312, '00003018'],
      [1231231, '0012c97f'],
      [123123123, '0756b5b3'],
      [4294967295, 'ffffffff'],
    ],
    errValues: [-1, 4294967296],
  });
  test('U32LE', {
    p: P.U32LE,
    correct: [
      [0, '00000000'],
      [123, '7b000000'],
      [12312, '18300000'],
      [1231231, '7fc91200'],
      [123123123, 'b3b55607'],
      [4294967295, 'ffffffff'],
    ],
    errValues: [-1, 4294967296],
  });
  test('I32BE', {
    p: P.I32BE,
    correct: [
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
    ],
    errValues: [-2147483649, 2147483648],
  });
  test('I32LE', {
    p: P.I32LE,
    correct: [
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
    ],
    errValues: [-2147483649, 2147483648],
  });
  test('U64BE', {
    p: P.U64BE,
    correct: [
      [0n, '0000000000000000'],
      [123n, '000000000000007b'],
      [12312n, '0000000000003018'],
      [1231231n, '000000000012c97f'],
      [123123123n, '000000000756b5b3'],
      [4294967295n, '00000000ffffffff'],
      [2n ** 64n - 1n, 'ffffffffffffffff'],
    ],
    errValues: [-1n, 2n ** 64n],
  });
  test('U64LE', {
    p: P.U64LE,
    correct: [
      [0n, '0000000000000000'],
      [123n, '7b00000000000000'],
      [12312n, '1830000000000000'],
      [1231231n, '7fc9120000000000'],
      [123123123n, 'b3b5560700000000'],
      [4294967295n, 'ffffffff00000000'],
      [2n ** 64n - 1n, 'ffffffffffffffff'],
    ],
    errValues: [-1n, 2n ** 64n],
  });
  test('F64LE', {
    p: P.F64LE,
    correct: [
      [0, '0000000000000000'],
      [1, '000000000000f03f'],
      [Infinity, '000000000000f07f'],
      [-Infinity, '000000000000f0ff'],
      [NaN, '000000000000f87f'],
    ],
    errValues: [0n],
  });
  test('F64BE', {
    p: P.F64BE,
    correct: [
      [0, '0000000000000000'],
      [1, '3ff0000000000000'],
      [Infinity, '7ff0000000000000'],
      [-Infinity, 'fff0000000000000'],
      [NaN, '7ff8000000000000'],
    ],
    errValues: [0n],
  });
  test('F32LE', {
    p: P.F32LE,
    correct: [
      [0, '00000000'],
      [1, '0000803f'],
      [16777216, '0000804b'],
      [2 ** 127, '0000007f'],
      [Infinity, '0000807f'],
      [-Infinity, '000080ff'],
      [NaN, '0000c07f'],
    ],
    errValues: [16777216 + 1, 2 ** 128],
  });
  test('F32BE', {
    p: P.F32BE,
    correct: [
      [0, '00000000'],
      [1, '3f800000'],
      [16777216, '4b800000'],
      [2 ** 127, '7f000000'],
      [Infinity, '7f800000'],
      [-Infinity, 'ff800000'],
      [NaN, '7fc00000'],
      // https://en.wikipedia.org/wiki/Single-precision_floating-point_format#Notable_single-precision_cases
      [2 ** -126 * 2 ** -23, '00000001'], // smallest positive subnormal number
      [2 ** -126 * (1 - 2 ** -23), '007fffff'], // largest subnormal number
      [2 ** -126, '00800000'], // smallest positive normal number
      [2 ** 127 * (2 - 2 ** -23), '7f7fffff'], // largest normal number
      [1 - 2 ** -24, '3f7fffff'], // largest number less than one
      [1 + 2 ** -23, '3f800001'], // smallest number larger than one
    ],
    errValues: [16777216 + 1, 2 ** 128],
  });

  should('bigint size', () => {
    // 32 bit -> 4 bytes
    throws(() => P.U32BE.decode(new Uint8Array(3)));
    P.U32BE.decode(new Uint8Array(4));
    throws(() => P.U32BE.decode(new Uint8Array(5)));
    // 64 bit -> 8 bytes
    throws(() => P.U64BE.decode(new Uint8Array(7)));
    P.U64BE.decode(new Uint8Array(8));
    throws(() => P.U64BE.decode(new Uint8Array(9)));

    const VarU64 = P.bigint(8, false, false, false);
    VarU64.decode(new Uint8Array(7));
    VarU64.decode(new Uint8Array(8));
    throws(() => VarU64.decode(new Uint8Array(9))); // left more than needed
    // encode
    eql(VarU64.encode(0n), Uint8Array.of());
    eql(VarU64.encode(10n), new Uint8Array([10]));
    eql(VarU64.encode(300n), new Uint8Array([1, 44]));
    eql(VarU64.encode(2n ** 64n - 1n), new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255]));
    throws(() => VarU64.encode(2n ** 64n));
    // decode
    eql(VarU64.decode(VarU64.encode(10n)), 10n);
    eql(VarU64.decode(VarU64.encode(300n)), 300n);
    eql(VarU64.decode(VarU64.encode(2n ** 64n - 1n)), 2n ** 64n - 1n);
  });
  should('number typecheck', () => {
    throws(() => P.U64BE.encode(1.01));
    throws(() => P.U64BE.encode(1));
    throws(() => P.U64BE.encode(true));
    throws(() => P.U64BE.encode(NaN));
    throws(() => P.U64BE.encode(null));
    P.U64BE.encode(1n);
    throws(() => P.U32BE.encode(1.01));
    throws(() => P.U32BE.encode(true));
    throws(() => P.U32BE.encode(NaN));
    throws(() => P.U32BE.encode(null));
    P.U32BE.encode(1);
    throws(() => P.U32BE.encode(1n));
  });

  describe('bits', () => {
    test('basic', {
      p: P.struct({ f: P.bits(5), f1: P.bits(1), f2: P.bits(1), f3: P.bits(1) }),
      correct: [
        [{ f: 1, f1: 0, f2: 1, f3: 0 }, hex.encode(new Uint8Array([0b00001010]))],
        [{ f: 31, f1: 0, f2: 1, f3: 1 }, hex.encode(new Uint8Array([0b11111011]))],
      ],
      errValues: [
        { f: 1, f1: 0, f2: 1, f3: 2 },
        { f: 32, f1: 0, f2: 1, f3: 1 },
      ],
    });
    test('two bytes', {
      p: P.struct({ f: P.bits(5), f1: P.bits(3), f2: P.U8 }),
      correct: [[{ f: 1, f1: 1, f2: 254 }, hex.encode(new Uint8Array([0b00001001, 254]))]],
    });
    test('magic', {
      p: P.struct({ a: P.magic(P.bits(1), 1), b: P.bits(7), c: P.U8 }),
      correct: [[{ a: undefined, b: 0, c: 0 }, hex.encode(new Uint8Array([128, 0]))]],
      errHex: [new Uint8Array([0, 0])],
    });
  });
});

describe('structures', () => {
  describe('padding', () => {
    test('left', {
      p: P.padLeft(3, P.U8),
      correct: [[97, '000061']],
    });
    test('right', {
      // TODO: this is actually pretty complex:
      // without terminator, it will encode all zeros as is
      p: P.padRight(3, P.cstring),
      correct: [
        ['a', '610000'],
        ['aa', '616100'],
        ['aaa', '616161000000'],
        ['aaaa', '616161610000'],
        ['aaaaa', '616161616100'],
        ['aaaaaa', '616161616161000000'],
      ],
    });
  });
  test('tuple', {
    p: P.tuple([P.U8, P.U16LE, P.string(P.U8)]),
    //                                                                        a      b cLen  h     e    l    l    o
    correct: [
      [[31, 12345, 'hello'], hex.encode(new Uint8Array([31, 57, 48, 5, 104, 101, 108, 108, 111]))],
    ],
  });
  test('struct', {
    p: P.struct({ a: P.U8, b: P.U16LE, c: P.string(P.U8) }),
    correct: [[{ a: 31, b: 12345, c: 'hello' }, '1f39300568656c6c6f']],
  });

  should('prefix', () => {
    // Should be same (elm size = 1 byte)
    const arr = P.array(P.U16BE, P.U8);
    const prefixed = P.prefix(P.U16BE, P.array(null, P.U8));
    const prefixed2 = P.prefix(P.U16BE, P.array(null, P.U16BE));
    for (const t of [[], [1], [1, 2], [1, 2, 3], [1, 2, 3, 4]]) {
      const encoded = prefixed.encode(t);
      eql(encoded, arr.encode(t));
      eql(prefixed.decode(encoded), t);
      eql(arr.decode(encoded), t);
      eql(prefixed2.decode(prefixed2.encode(t)), t);
    }
    // Same as before , but size = 2*arr size
    eql(prefixed2.encode([]), new Uint8Array([0, 0]));
    eql(prefixed2.encode([1]), new Uint8Array([0, 2, 0, 1]));
    eql(prefixed2.encode([1, 2]), new Uint8Array([0, 4, 0, 1, 0, 2]));
    eql(prefixed2.encode([1, 2, 3]), new Uint8Array([0, 6, 0, 1, 0, 2, 0, 3]));
  });

  describe('array', () => {
    should('basic', () => {
      let arr = P.array(P.U8, P.U32LE);
      eql(
        arr.encode([1234, 5678, 9101112]),
        new Uint8Array([3, 210, 4, 0, 0, 46, 22, 0, 0, 56, 223, 138, 0])
      );
      eql(arr.decode(arr.encode([1234, 5678, 9101112])), [1234, 5678, 9101112]);
      const big = new Array(256).fill(0);
      throws(() => arr.encode(big));
      arr.encode(big.slice(0, 255));
    });
    should('sz=null', () => {
      const a = P.array(null, P.U16BE);
      const data = [1, 2, 3, 4, 5, 6, 7];
      eql(a.decode(a.encode(data)), data);
      eql(a.encode(data), new Uint8Array([0, 1, 0, 2, 0, 3, 0, 4, 0, 5, 0, 6, 0, 7]));
      // Array of unknown size should be last element or it will eat everything
      const t = P.tuple([a, a]);
      eql(
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
      eql(t2.decode(t2.encode([[1, 2, 3], 4])), [[1, 2, 3], 4]);
      // But should still fail if there some bytes left
      throws(() => a.decode(t2.encode([[1, 2, 3], 4])));
      // But if last elm has same size as inner element it should be processed as is
      const t3 = P.tuple([a, P.U16BE]);
      eql(a.decode(t3.encode([[1, 2, 3], 4])), [1, 2, 3, 4]);
      // Prefixed unkown size arrays works as is
      const prefixed = P.prefix(P.U16BE, a);
      const t4 = P.tuple([prefixed, prefixed]);
      eql(
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

    should('sz=fixed number', () => {
      const a = P.array(4, P.U16BE);
      // Throws if size different
      throws(() => a.encode([1]));
      throws(() => a.encode([1, 2, 3, 4, 5]));
      const data = [1, 2, 3, 4];
      eql(a.decode(a.encode(data)), data);
      eql(a.encode(data), new Uint8Array([0, 1, 0, 2, 0, 3, 0, 4]));
    });

    should('sz=dynamic number', () => {
      const a = P.array(P.U16LE, P.U16BE);
      // Works for different sizes
      eql(a.decode(a.encode([1])), [1]);
      eql(a.decode(a.encode([1, 2])), [1, 2]);
      eql(a.decode(a.encode([1, 2, 3])), [1, 2, 3]);
      eql(a.encode([1, 2, 3]), new Uint8Array([3, 0, 0, 1, 0, 2, 0, 3]));
    });

    should('sz=path', () => {
      const a = P.struct({
        len: P.U16LE,
        arr: P.array('len', P.U16BE),
      });
      // Throws on argument and array size mismatch
      throws(() => a.encode({ len: 1, arr: [1, 2] }));
      // Works for different sizes
      eql(a.decode(a.encode({ len: 1, arr: [1] })), { len: 1, arr: [1] });
      eql(a.decode(a.encode({ len: 2, arr: [1, 2] })), { len: 2, arr: [1, 2] });
      eql(a.decode(a.encode({ len: 3, arr: [1, 2, 3] })), { len: 3, arr: [1, 2, 3] });
      // Same as array(sz=fixed number encoding)
      eql(a.encode({ len: 3, arr: [1, 2, 3] }), P.array(P.U16LE, P.U16BE).encode([1, 2, 3]));
    });

    should('sz=bytes', () => {
      const a = P.array(Uint8Array.of(0), P.U16LE);
      // basic encode/decode
      eql(a.decode(a.encode([1, 2, 3])), [1, 2, 3]);
      // NOTE: LE here becase 0 is terminator
      eql(a.encode([1, 2, 3]), new Uint8Array([1, 0, 2, 0, 3, 0, 0]));
      // No terminator!
      throws(() => a.decode(new Uint8Array([1, 0])));
      // Early terminator
      throws(() => a.decode(new Uint8Array([1, 0, 1])));
      // Fails because 0 has same encoding as terminator
      throws(() => a.encode([0, 1, 2]));
      // Different separator, so we can encode zero
      const a2 = P.array(new Uint8Array([1, 2, 3]), P.U16LE);

      eql(a2.decode(a2.encode([0, 1, 2])), [0, 1, 2]);
      eql(a2.encode([0, 1, 2]), new Uint8Array([0, 0, 1, 0, 2, 0, 1, 2, 3]));
      // corrupted terminator
      throws(() => a.decode(new Uint8Array([1, 0, 2, 0, 1, 2])));
    });
  });
  describe('bytes', () => {
    should('sz=null', () => {
      const a = P.bytes(null);
      const data = new Uint8Array([1, 2, 3]);
      eql(a.decode(a.encode(data)), data);
      eql(a.encode(data), new Uint8Array([1, 2, 3]));
    });

    should('sz=fixed number', () => {
      const a = P.bytes(4);
      // Throws if size different
      throws(() => a.encode(Uint8Array.of(1)));
      throws(() => a.encode(new Uint8Array([1, 2, 3, 4, 5])));
      const data = new Uint8Array([1, 2, 3, 4]);
      eql(a.decode(a.encode(data)), data);
      eql(a.encode(data), new Uint8Array([1, 2, 3, 4]));
    });

    should('sz=dynamic number', () => {
      const a = P.bytes(P.U16LE);
      // Works for different sizes
      eql(a.decode(a.encode(Uint8Array.of(1))), Uint8Array.of(1));
      eql(a.decode(a.encode(new Uint8Array([1, 2]))), new Uint8Array([1, 2]));
      eql(a.decode(a.encode(new Uint8Array([1, 2, 3]))), new Uint8Array([1, 2, 3]));
      eql(a.encode(new Uint8Array([1, 2, 3])), new Uint8Array([3, 0, 1, 2, 3]));
    });

    should('sz=path', () => {
      const a = P.struct({
        len: P.U16LE,
        arr: P.bytes('len'),
      });
      // Throws on argument and array size mismatch
      throws(() => a.encode({ len: 1, arr: new Uint8Array([1, 2]) }));
      // Works for different sizes
      eql(a.decode(a.encode({ len: 1, arr: Uint8Array.of(1) })), {
        len: 1,
        arr: Uint8Array.of(1),
      });
      eql(a.decode(a.encode({ len: 2, arr: new Uint8Array([1, 2]) })), {
        len: 2,
        arr: new Uint8Array([1, 2]),
      });
      eql(a.decode(a.encode({ len: 3, arr: new Uint8Array([1, 2, 3]) })), {
        len: 3,
        arr: new Uint8Array([1, 2, 3]),
      });
      // Same as bytes(sz=fixed number encoding)
      eql(
        a.encode({ len: 3, arr: new Uint8Array([1, 2, 3]) }),
        P.bytes(P.U16LE).encode(new Uint8Array([1, 2, 3]))
      );
    });

    should('sz=bytes', () => {
      const a = P.bytes(Uint8Array.of(0));
      // basic encode/decode
      eql(a.decode(a.encode(new Uint8Array([1, 2, 3]))), new Uint8Array([1, 2, 3]));
      // NOTE: LE here becase 0 is terminator
      eql(a.encode(new Uint8Array([1, 2, 3])), new Uint8Array([1, 2, 3, 0]));
      // No terminator!
      throws(() => a.decode(new Uint8Array([1, 2])));
      eql(a.decode(new Uint8Array([1, 2, 0])), new Uint8Array([1, 2]));
      // Early terminator
      throws(() => a.decode(new Uint8Array([1, 0, 1])));
      // Different separator, so we can encode zero
      const a2 = P.bytes(new Uint8Array([9, 8, 7]));
      eql(a2.decode(a2.encode(new Uint8Array([0, 1, 2]))), new Uint8Array([0, 1, 2]));
      eql(a2.encode(new Uint8Array([0, 1, 2])), new Uint8Array([0, 1, 2, 9, 8, 7]));
      // // corrupted terminator
      throws(() => a.decode(new Uint8Array([1, 2, 3, 9, 8])));
    });
  });

  should('cstring', () => {
    eql(P.cstring.encode('test'), new Uint8Array([116, 101, 115, 116, 0]));
    eql(P.cstring.decode(P.cstring.encode('test')), 'test');
    // Early terminator
    throws(() => P.cstring.decode(new Uint8Array([116, 101, 0, 115, 116])));
  });
  should('pathStack', () => {
    const log = [];
    // JSON as quick cloneDeep
    const addLog = (rw, name) =>
      log.push(
        JSON.stringify({
          name,
          path: rw.stack.map((i) => i.obj),
          fieldPath: rw.stack.map((i) => i.field).filter((i) => !!i),
        })
      );
    const capture = (inner) =>
      P.wrap({
        encodeStream: (w, value) => {
          addLog(w, 'before_encode');
          inner.encodeStream(w, value);
          addLog(w, 'after_encode');
        },
        decodeStream: (r) => {
          addLog(r, 'before_decode');
          const res = inner.decodeStream(r);
          addLog(r, 'after_decode');
          return res;
        },
      });
    const t = P.struct({
      data: capture(P.array(capture(P.U16BE), capture(P.U8))),
      customField: capture(P.cstring),
      deep: capture(
        P.struct({
          test: capture(P.cstring),
          test2: capture(P.U32BE),
        })
      ),
    });
    const data = {
      data: [1, 2, 3, 4, 5],
      customField: 'test',
      deep: { test: 'tmp', test2: 12354 },
    };
    eql(t.decode(t.encode(data)), data);
    eql(
      log.map((i) => JSON.parse(i)),
      [
        {
          name: 'before_encode',
          path: [
            {
              data: [1, 2, 3, 4, 5],
              customField: 'test',
              deep: { test: 'tmp', test2: 12354 },
            },
          ],
          fieldPath: ['data'],
        },
        {
          name: 'before_encode',
          path: [
            {
              data: [1, 2, 3, 4, 5],
              customField: 'test',
              deep: { test: 'tmp', test2: 12354 },
            },
            [1, 2, 3, 4, 5],
          ],
          fieldPath: ['data'],
        },
        {
          name: 'after_encode',
          path: [
            {
              data: [1, 2, 3, 4, 5],
              customField: 'test',
              deep: { test: 'tmp', test2: 12354 },
            },
            [1, 2, 3, 4, 5],
          ],
          fieldPath: ['data'],
        },
        {
          name: 'before_encode',
          path: [
            {
              data: [1, 2, 3, 4, 5],
              customField: 'test',
              deep: { test: 'tmp', test2: 12354 },
            },
            [1, 2, 3, 4, 5],
          ],
          fieldPath: ['data', '0'],
        },
        {
          name: 'after_encode',
          path: [
            {
              data: [1, 2, 3, 4, 5],
              customField: 'test',
              deep: { test: 'tmp', test2: 12354 },
            },
            [1, 2, 3, 4, 5],
          ],
          fieldPath: ['data', '0'],
        },
        {
          name: 'before_encode',
          path: [
            {
              data: [1, 2, 3, 4, 5],
              customField: 'test',
              deep: { test: 'tmp', test2: 12354 },
            },
            [1, 2, 3, 4, 5],
          ],
          fieldPath: ['data', '1'],
        },
        {
          name: 'after_encode',
          path: [
            {
              data: [1, 2, 3, 4, 5],
              customField: 'test',
              deep: { test: 'tmp', test2: 12354 },
            },
            [1, 2, 3, 4, 5],
          ],
          fieldPath: ['data', '1'],
        },
        {
          name: 'before_encode',
          path: [
            {
              data: [1, 2, 3, 4, 5],
              customField: 'test',
              deep: { test: 'tmp', test2: 12354 },
            },
            [1, 2, 3, 4, 5],
          ],
          fieldPath: ['data', '2'],
        },
        {
          name: 'after_encode',
          path: [
            {
              data: [1, 2, 3, 4, 5],
              customField: 'test',
              deep: { test: 'tmp', test2: 12354 },
            },
            [1, 2, 3, 4, 5],
          ],
          fieldPath: ['data', '2'],
        },
        {
          name: 'before_encode',
          path: [
            {
              data: [1, 2, 3, 4, 5],
              customField: 'test',
              deep: { test: 'tmp', test2: 12354 },
            },
            [1, 2, 3, 4, 5],
          ],
          fieldPath: ['data', '3'],
        },
        {
          name: 'after_encode',
          path: [
            {
              data: [1, 2, 3, 4, 5],
              customField: 'test',
              deep: { test: 'tmp', test2: 12354 },
            },
            [1, 2, 3, 4, 5],
          ],
          fieldPath: ['data', '3'],
        },
        {
          name: 'before_encode',
          path: [
            {
              data: [1, 2, 3, 4, 5],
              customField: 'test',
              deep: { test: 'tmp', test2: 12354 },
            },
            [1, 2, 3, 4, 5],
          ],
          fieldPath: ['data', '4'],
        },
        {
          name: 'after_encode',
          path: [
            {
              data: [1, 2, 3, 4, 5],
              customField: 'test',
              deep: { test: 'tmp', test2: 12354 },
            },
            [1, 2, 3, 4, 5],
          ],
          fieldPath: ['data', '4'],
        },
        {
          name: 'after_encode',
          path: [
            {
              data: [1, 2, 3, 4, 5],
              customField: 'test',
              deep: { test: 'tmp', test2: 12354 },
            },
          ],
          fieldPath: ['data'],
        },
        {
          name: 'before_encode',
          path: [
            {
              data: [1, 2, 3, 4, 5],
              customField: 'test',
              deep: { test: 'tmp', test2: 12354 },
            },
          ],
          fieldPath: ['customField'],
        },
        {
          name: 'after_encode',
          path: [
            {
              data: [1, 2, 3, 4, 5],
              customField: 'test',
              deep: { test: 'tmp', test2: 12354 },
            },
          ],
          fieldPath: ['customField'],
        },
        {
          name: 'before_encode',
          path: [
            {
              data: [1, 2, 3, 4, 5],
              customField: 'test',
              deep: { test: 'tmp', test2: 12354 },
            },
          ],
          fieldPath: ['deep'],
        },
        {
          name: 'before_encode',
          path: [
            {
              data: [1, 2, 3, 4, 5],
              customField: 'test',
              deep: { test: 'tmp', test2: 12354 },
            },
            { test: 'tmp', test2: 12354 },
          ],
          fieldPath: ['deep', 'test'],
        },
        {
          name: 'after_encode',
          path: [
            {
              data: [1, 2, 3, 4, 5],
              customField: 'test',
              deep: { test: 'tmp', test2: 12354 },
            },
            { test: 'tmp', test2: 12354 },
          ],
          fieldPath: ['deep', 'test'],
        },
        {
          name: 'before_encode',
          path: [
            {
              data: [1, 2, 3, 4, 5],
              customField: 'test',
              deep: { test: 'tmp', test2: 12354 },
            },
            { test: 'tmp', test2: 12354 },
          ],
          fieldPath: ['deep', 'test2'],
        },
        {
          name: 'after_encode',
          path: [
            {
              data: [1, 2, 3, 4, 5],
              customField: 'test',
              deep: { test: 'tmp', test2: 12354 },
            },
            { test: 'tmp', test2: 12354 },
          ],
          fieldPath: ['deep', 'test2'],
        },
        {
          name: 'after_encode',
          path: [
            {
              data: [1, 2, 3, 4, 5],
              customField: 'test',
              deep: { test: 'tmp', test2: 12354 },
            },
          ],
          fieldPath: ['deep'],
        },
        { name: 'before_decode', path: [{}], fieldPath: ['data'] },
        {
          name: 'before_decode',
          path: [{}, []],
          fieldPath: ['data', 'arrayLen'],
        },
        {
          name: 'after_decode',
          path: [{}, []],
          fieldPath: ['data', 'arrayLen'],
        },
        {
          name: 'before_decode',
          path: [{}, []],
          fieldPath: ['data', '0'],
        },
        {
          name: 'after_decode',
          path: [{}, []],
          fieldPath: ['data', '0'],
        },
        {
          name: 'before_decode',
          path: [{}, [1]],
          fieldPath: ['data', '1'],
        },
        {
          name: 'after_decode',
          path: [{}, [1]],
          fieldPath: ['data', '1'],
        },
        {
          name: 'before_decode',
          path: [{}, [1, 2]],
          fieldPath: ['data', '2'],
        },
        {
          name: 'after_decode',
          path: [{}, [1, 2]],
          fieldPath: ['data', '2'],
        },
        {
          name: 'before_decode',
          path: [{}, [1, 2, 3]],
          fieldPath: ['data', '3'],
        },
        {
          name: 'after_decode',
          path: [{}, [1, 2, 3]],
          fieldPath: ['data', '3'],
        },
        {
          name: 'before_decode',
          path: [{}, [1, 2, 3, 4]],
          fieldPath: ['data', '4'],
        },
        {
          name: 'after_decode',
          path: [{}, [1, 2, 3, 4]],
          fieldPath: ['data', '4'],
        },
        { name: 'after_decode', path: [{}], fieldPath: ['data'] },
        {
          name: 'before_decode',
          path: [{ data: [1, 2, 3, 4, 5] }],
          fieldPath: ['customField'],
        },
        {
          name: 'after_decode',
          path: [{ data: [1, 2, 3, 4, 5] }],
          fieldPath: ['customField'],
        },
        {
          name: 'before_decode',
          path: [{ data: [1, 2, 3, 4, 5], customField: 'test' }],
          fieldPath: ['deep'],
        },
        {
          name: 'before_decode',
          path: [{ data: [1, 2, 3, 4, 5], customField: 'test' }, {}],
          fieldPath: ['deep', 'test'],
        },
        {
          name: 'after_decode',
          path: [{ data: [1, 2, 3, 4, 5], customField: 'test' }, {}],
          fieldPath: ['deep', 'test'],
        },
        {
          name: 'before_decode',
          path: [{ data: [1, 2, 3, 4, 5], customField: 'test' }, { test: 'tmp' }],
          fieldPath: ['deep', 'test2'],
        },
        {
          name: 'after_decode',
          path: [{ data: [1, 2, 3, 4, 5], customField: 'test' }, { test: 'tmp' }],
          fieldPath: ['deep', 'test2'],
        },
        {
          name: 'after_decode',
          path: [{ data: [1, 2, 3, 4, 5], customField: 'test' }],
          fieldPath: ['deep'],
        },
      ]
    );
  });
  describe('control flow', () => {
    should('struct path', () => {
      let s1 = P.struct({
        sub1: P.struct({ someLen: P.U8 }),
        f2: P.string('sub1/someLen'),
      });
      let s2 = P.struct({
        sub1: P.struct({ someLen: P.U8 }),
        sub2: P.struct({ str: P.string('../sub1/someLen') }),
      });
      eql(
        s1.encode({ sub1: { someLen: 5 }, f2: 'hello' }),
        new Uint8Array([5, 104, 101, 108, 108, 111])
      );
      throws(() => s1.encode({ sub1: { someLen: 6 }, f2: 'hello' }));
      eql(
        s2.encode({ sub1: { someLen: 5 }, sub2: { str: 'hello' } }),
        new Uint8Array([5, 104, 101, 108, 108, 111])
      );
      throws(() => s2.encode({ sub1: { someLen: 6 }, sub2: { f2: 'hello' } }));
    });
    should('flag', () => {
      const f = P.flag(new Uint8Array([0x1, 0x2, 0x3]));
      const f2 = P.flag(new Uint8Array([0x1, 0x2, 0x3]), true);
      eql(f.encode(true), new Uint8Array([0x1, 0x2, 0x3]));
      eql(f.encode(false), Uint8Array.of());
      eql(f.decode(new Uint8Array([0x1, 0x2, 0x3])), true, 'flag true');
      eql(f.decode(Uint8Array.of()), false, 'flag false');
      throws(() => f.decode(new Uint8Array([0x1, 0x2])));
      throws(() => f.decode(new Uint8Array([0x1])));
      throws(() => f.decode(new Uint8Array([0x1, 0x2, 0x4])));

      eql(f2.encode(false), new Uint8Array([0x1, 0x2, 0x3]));
      eql(f2.encode(true), Uint8Array.of());

      eql(f2.decode(new Uint8Array([0x1, 0x2, 0x3])), false, 'flag true xor');
      eql(f2.decode(Uint8Array.of()), true, 'flag false xor');
      throws(() => f2.decode(new Uint8Array([0x1, 0x2])));
      throws(() => f2.decode(new Uint8Array([0x1])));
      throws(() => f2.decode(new Uint8Array([0x1, 0x2, 0x4])));
    });

    should('flagged', () => {
      const s = P.struct({ f: P.flag(new Uint8Array([0x0, 0x1])), f2: P.flagged('f', P.U32BE) });
      eql(s.encode({ f2: 1234 }), Uint8Array.of());
      eql(s.encode({ f: true, f2: 1234 }), new Uint8Array([0, 1, 0, 0, 4, 210]));
      // Flag but no data
      throws(() => s.encode({ f: true }));
      const s2 = P.struct({
        f: P.flag(new Uint8Array([0x0, 0x1])),
        f2: P.flagged('f', P.U32BE, 123),
      });

      // If def=true -> encode default value when flag is disabled
      // TODO: do we need that at all? Cannot remember use-case where default option was useful.
      eql(s2.encode({ f2: 1234 }), new Uint8Array([0, 0, 0, 123]));
      eql(s2.encode({ f: true, f2: 1234 }), new Uint8Array([0, 1, 0, 0, 4, 210]));
      eql(s2.decode(new Uint8Array([0, 1, 0, 0, 4, 210])), { f: true, f2: 1234 });
      eql(s2.decode(new Uint8Array([0, 0, 0, 123])), { f: false, f2: undefined });

      // Decode only if there is flag. No flag -> return undefined
      const s3 = P.flagged(P.flag(new Uint8Array([0x0, 0x1])), P.U32BE);
      eql(s3.encode(123), new Uint8Array([0x0, 0x1, 0x0, 0x0, 0x0, 123]));
      eql(s3.encode(undefined), Uint8Array.of());
      eql(s3.decode(new Uint8Array([0x0, 0x1, 0x0, 0x0, 0x0, 123])), 123);
      eql(s3.decode(Uint8Array.of()), undefined);
      throws(() => s3.decode(new Uint8Array([0x1])));
      throws(() => s3.decode(new Uint8Array([0x1, 0x2, 0x3, 0x4, 0x5, 0x6])));
      // Decode only if thre is no flag. If flag -> return undefined
      const s4 = P.flagged(P.flag(new Uint8Array([0x0, 0x1]), true), P.U32BE);
      eql(s4.encode(123), new Uint8Array([0x0, 0x0, 0x0, 123]));
      eql(s4.encode(undefined), new Uint8Array([0x0, 0x1]));
      eql(s4.decode(new Uint8Array([0x0, 0x1])), undefined);
      // Decode as is, if there is no flag
      eql(s4.decode(new Uint8Array([0x0, 0x0, 0x0, 0x4])), 0x4);
      throws(() => s4.decode(new Uint8Array([0x0, 0x1, 0x2])));
    });
    describe('pointer', () => {
      test('basic', {
        p: P.pointer(P.U8, P.U8),
        correct: [[123, hex.encode(new Uint8Array([1, 123]))]],
      });
      test('two', {
        p: P.pointer(P.U8, P.pointer(P.U8, P.U8)),
        // Since pointers are nested, it should be same pointer
        correct: [[123, hex.encode(new Uint8Array([1, 1, 123]))]],
      });
      test('three', {
        p: P.pointer(P.U8, P.pointer(P.U8, P.pointer(P.U8, P.U8))),
        // Since pointers are nested, it should be same pointer
        correct: [[123, hex.encode(new Uint8Array([1, 1, 1, 123]))]],
      });
      test('array', {
        p: P.array(P.U8, P.pointer(P.U16BE, P.U8)),
        correct: [
          [
            [1, 2, 3, 4, 5],
            hex.encode(new Uint8Array([5, 0, 11, 0, 12, 0, 13, 0, 14, 0, 15, 1, 2, 3, 4, 5])),
          ],
          [[3, 4], hex.encode(new Uint8Array([2, 0, 5, 0, 6, 3, 4]))],
        ],
      });
      test('array/two', {
        p: P.array(P.U8, P.pointer(P.U8, P.pointer(P.U8, P.U8))),
        correct: [
          [
            [3, 4],
            hex.encode(
              new Uint8Array([
                2, // 0: len
                3, // 1: ptr[0]
                5, // 2: ptr[1]
                1, // 3: ptr[0][0] (ptr[0] jumps here)
                3, // 4: value (ptr[0][0] jumps here)
                1, // 5: ptr[1][0] (ptr[1] jumps here)
                4, // 6: value (ptr[1][0] jumps here)
              ])
            ),
          ],
          [
            [1, 2, 3, 4, 5],
            hex.encode(
              new Uint8Array([
                5, //  0: len
                6, //  1: ptr[0]
                8, //  2: ptr[1]
                10, // 3: ptr[2]
                12, // 4: ptr[3]
                14, // 5: ptr[4]
                1, //  6: ptr[0][0] (ptr[0] jumps here)
                1, //  7: value (ptr[0][0] jumps here)
                1, //  8: ptr[1][0] (ptr[1] jumps here)
                2, //  9: value (ptr[1][0] jumps here)
                1, // 10: ptr[2][0] (ptr[2] jumps here)
                3, // 11: value (ptr[2][0] jumps here)
                1, // 12: ptr[3][0] (ptr[3] jumps here)
                4, // 13: value (ptr[3][0] jumps here)
                1, // 14: ptr[4][0] (ptr[4] jumps here)
                5, // 15: value (ptr[4][0] jumps here)
              ])
            ),
          ],
        ],
      });
    });
  });

  describe('utils', () => {
    should('map', () => {
      const e = P.map(P.U8, { test: 5, other: 9 });
      eql(e.encode('test'), new Uint8Array([5]));
      eql(e.decode(e.encode('test')), 'test');
      eql(e.decode(e.encode('other')), 'other');
      throws(() => e.encode('anything'));
      throws(() => e.decode(Uint8Array.of(1)));
    });

    should('hex', () => {
      const h = P.apply(P.bytes(P.U16BE), hex);
      const data = '01020304';
      eql(h.decode(h.encode(data)), data);
    });

    should('dict', () => {
      const coder = P.array(P.U16BE, P.tuple([P.cstring, P.U32LE]));
      const h = P.apply(coder, P.coders.dict());
      const data = { lol: 1, blah: 2 };
      eql(h.decode(h.encode(data)), data);
    });

    should('lazy', () => {
      // Allows creating circular structures
      const tree = P.struct({
        name: P.cstring,
        children: P.array(
          P.U16BE,
          P.lazy(() => tree)
        ),
      });
      const CASES = [
        { name: 'a', children: [] },
        {
          name: 'root',
          children: [
            { name: 'a', children: [] },
            { name: 'b', children: [{ name: 'c', children: [{ name: 'd', children: [] }] }] },
          ],
        },
      ];
      for (const c of CASES) eql(tree.decode(tree.encode(c)), c);
    });
    should('validate', () => {
      let t = (n) => {
        if (n > 100) throw new Error('N > 100');
        return n;
      };
      const c = P.validate(P.U8, t);
      eql(c.decode(c.encode(1)), 1);
      eql(c.decode(c.encode(100)), 100);
      throws(() => c.encode(101));
      throws(() => c.decode(new Uint8Array([101])));
    });
    should('debug', () => {
      const s = PD.debug(
        P.struct({
          name: PD.debug(P.cstring),
          num: PD.debug(P.U32LE),
          child: PD.debug(
            P.struct({
              a: PD.debug(P.bool),
              b: PD.debug(P.U256BE),
            })
          ),
        })
      );
      const data = {
        name: 'blah',
        num: 123,
        child: { a: true, b: 123n },
      };
      eql(s.decode(s.encode(data)), data);
    });
    should('isPlainObject', () => {
      eql(P.utils.isPlainObject({}), true);
      eql(P.utils.isPlainObject(null), false);
      eql(P.utils.isPlainObject([]), false);
      eql(P.utils.isPlainObject(Uint8Array.of()), false);
    });
  });
});

describe('coders', () => {
  should('number', () => {
    eql(P.coders.numberBigint.encode(1000n), 1000);
    eql(P.coders.numberBigint.encode(9007199254740991n), 9007199254740991);
    throws(() => P.coders.numberBigint.encode(9007199254740992n));
  });

  should('decimal', () => {
    const d8 = P.coders.decimal(8);
    eql(d8.decode('6.30880845'), 630880845n);
    eql(d8.decode('6.308'), 630800000n);
    eql(d8.decode('6.00008'), 600008000n);
    eql(d8.decode('10'), 1000000000n);
    eql(d8.decode('200'), 20000000000n);
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
    for (let c of cases) eql(d8.encode(d8.decode(c)), c);
    const d2 = P.coders.decimal(2, true);
    // Round number if precision is smaller than fraction part length
    eql(d2.decode('22.11111111111111111'), 2211n);
    eql(d2.decode('222222.11111111111111111'), 22222211n);
    eql(d2.encode(d2.decode('22.1111')), '22.11');
    eql(d2.encode(d2.decode('22.9999')), '22.99');
    // Doesn't affect integer part
    eql(d2.encode(d2.decode('222222222222222222222222222.9999')), '222222222222222222222222222.99');
    const i64 = P.apply(P.I64BE, P.coders.decimal(9));
    const ok = [
      '1',
      '10',
      '100',
      '0.1',
      '0.01', // leading zero in frac
      '10.2',
      '100.001',
      '1.1234567',
      '0.0000001',
      '1.9999999',
      '1000000000.000000001',
    ];
    for (const t of ok) eql(i64.decode(i64.encode(t)), t);
    for (const t of ok) eql(i64.decode(i64.encode(`-${t}`)), `-${t}`);
    eql(i64.decode(i64.encode('0.0')), '0');
    eql(i64.decode(i64.encode('0')), '0');
    eql(i64.decode(i64.encode('10.0')), '10');
    eql(i64.decode(i64.encode('1.0')), '1');
    // Input can be from user, so this is ok, but '-0' is not.
    eql(i64.decode(i64.encode('1000000000.000000000')), '1000000000');
    eql(i64.decode(i64.encode('1000000000.0000000000')), '1000000000');
    eql(i64.decode(i64.encode('1000000000.0000000000000000000000000000')), '1000000000');
    const fail = [
      true,
      1,
      1n,
      [],
      Uint8Array.of(),
      {},
      null,
      undefined,
      '01',
      '001',
      ' 010',
      '1.',
      '100.',
      '00001',
      '0001.0',
      '1.1.1',
      '100.0.0.1',
      '',
      '.',
      ' . ',
      ' 1',
      '1 ',
      ' 1.1 ',
      '1a',
      '1e10',
      '$100',
      '100%',
      '1e2',
      '1E2',
      '10²',
      '５',
      '1000000000.0000000001',
      'NaN',
      'Infinity',
      '-Infinity',
      '-0',
    ];
    for (let i = 0; i < fail.length; i++) {
      let t = fail[i];
      throws(() => i64.encode(t), `index ${i}`);
    }
    const d5 = P.coders.decimal(5);
    eql(d5.encode(123n), '0.00123');
    eql(d5.encode(-123n), '-0.00123');
    const d0 = P.coders.decimal(0);
    throws(() => P.coders.decimal(-1));
    eql(d0.encode(123n), '123');
    eql(d0.encode(-123n), '-123');
    eql(d0.decode('123.0'), 123n);
    throws(() => d0.decode('123.1'));
    throws(() => d0.decode('1.1'));
  });

  should('match', () => {
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
    eql(m.encode({ type: 't1' }), 1);
    eql(m.decode(1), { type: 't1' });
    eql(m.decode(m.encode({ type: 't1' })), { type: 't1' });
    // M2
    eql(m.encode({ type: 't2' }), 2);
    eql(m.decode(2), { type: 't2' });
    eql(m.decode(m.encode({ type: 't2' })), { type: 't2' });
    // M3
    eql(m.encode({ type: 't3' }), 3);
    eql(m.decode(3), { type: 't3' });
    eql(m.decode(m.encode({ type: 't3' })), { type: 't3' });
    throws(() => m.encode({ type: 't4' }));
    throws(() => m.decode(4));
  });
});

describe('utils', () => {
  should('sizeof', () => {
    const s0 = P.array(0, P.U32LE);
    const s1 = P.array(1, P.U8);
    const s4 = P.U32LE;
    eql(s0.size, 0);
    eql(s1.size, 1);
    eql(s4.size, 4);
    eql(P.tuple([s0]).size, 0);
    eql(P.tuple([s1]).size, 1);
    eql(P.tuple([s1, s0, s1, s0, s1]).size, 3);
    eql(P.array(3, s1).size, 3);
    eql(P.array(3, s4).size, 12);
    // Size of dynamic arrays is undefined
    eql(P.array(null, s4).size, undefined);
    eql(P.array(P.U8, s4).size, undefined);
    eql(P.struct({ f1: s0 }).size, 0);
    eql(P.struct({ f1: s1 }).size, 1);
    eql(P.struct({ f1: s1, f2: s0, f3: s1, f4: s0, f5: s1 }).size, 3);
  });
  describe('Reader', () => {
    describe('bits', () => {
      should('basic', () => {
        const u = new Reader(new Uint8Array([152, 0]));
        eql([u.bits(1), u.bits(1), u.bits(4), u.bits(2)], [1, 0, 6, 0]);
        eql(u.byte(), 0);
        eql(u.isEnd(), true);
      });

      should('u32', () => {
        eql(new Reader(new Uint8Array([0xff, 0xff, 0xff, 0xff])).bits(32), 2 ** 32 - 1);
      });

      should('full mask', () => {
        const u = new Reader(new Uint8Array([0xff]));
        eql([u.bits(1), u.bits(1), u.bits(4), u.bits(2)], [1, 1, 15, 3]);
        eql(u.isEnd(), true);
      });

      should('u32 mask', () => {
        const u = new Reader(new Uint8Array([0b10101010, 0b10101010, 0b10101010, 0b10101010, 0]));
        for (let i = 0; i < 32; i++) eql(u.bits(1), +!(i & 1));
        eql(u.byte(), 0);
        eql(u.isEnd(), true);
      });

      should('throw on non-full (1 byte)', () => {
        const r = new Reader(new Uint8Array([0xff, 0]));
        r.bits(7);
        throws(() => r.byte());
        throws(() => r.bytes(1));
        throws(() => r.bytes(1, true));
        throws(() => r.byte(true));
        r.bits(1);
        eql(r.byte(), 0);
        eql(r.isEnd(), true);
      });

      should('throw on non-full (4 byte)', () => {
        const r = new Reader(new Uint8Array([0xff, 0xff, 0xff, 0xff, 0]));
        r.bits(31);
        throws(() => r.byte());
        throws(() => r.bytes(1));
        throws(() => r.bytes(1, true));
        throws(() => r.byte(true));
        r.bits(1);
        eql(r.byte(), 0);
        eql(r.isEnd(), true);
      });

      should('empty array', () => {
        throws(() => new Reader(Uint8Array.of()).bits(1), '1');
        throws(() => new Reader(Uint8Array.of()).bits(8), '8');
        throws(() => new Reader(Uint8Array.of()).bits(32), '32');
      });
    });

    should('find', () => {
      const r = new Reader(new Uint8Array([0xfa, 0xfb, 0xfc, 0xfd, 0]));
      // Basic
      eql(r.find(new Uint8Array([0xfa])), 0);
      eql(r.find(new Uint8Array([0xfb])), 1);
      eql(r.find(new Uint8Array([0xfc])), 2);
      eql(r.find(new Uint8Array([0xfd])), 3);
      eql(r.find(Uint8Array.of(0)), 4);
      // Two bytes
      eql(r.find(new Uint8Array([0xfb, 0xfc])), 1);
      eql(r.find(new Uint8Array([0xfb, 0xfd])), undefined);
      eql(r.find(new Uint8Array([0xfc, 0xfd])), 2);
      eql(r.find(new Uint8Array([0xfc, 0xfe])), undefined);
      // Bigger
      eql(r.find(new Uint8Array([0xfa, 0xfb, 0xfc, 0xfd, 0, 1])), undefined);
      // Same
      eql(r.find(new Uint8Array([0xfa, 0xfb, 0xfc, 0xfd, 0])), 0);
      // Empty needle
      throws(() => r.find(Uint8Array.of()));
      // Non-bytes needle
      throws(() => r.find([]));
      const r2 = new Reader(new Uint8Array([0xfa, 0xfb, 0xfc, 0xfd, 0, 0xfa, 0xfb, 0xfc, 0xfd]));
      eql(r.find(new Uint8Array([0xfb, 0xfc])), 1);
      // Second element
      eql(r.find(new Uint8Array([0xfb, 0xfc]), 2), undefined);
      eql(r2.find(new Uint8Array([0xfb, 0xfc]), 2), 6);
    });
  });

  describe('Writer', () => {
    should('bits: basic', () => {
      let w = new Writer();
      w.bits(1, 1);
      w.bits(0, 1);
      w.bits(6, 4);
      w.bits(0, 2);
      eql(w.finish(), new Uint8Array([152]));
    });

    should('bits: full mask', () => {
      let w = new Writer();
      w.bits(1, 1);
      w.bits(1, 1);
      w.bits(15, 4);
      w.bits(3, 2);
      eql(w.finish(), new Uint8Array([0xff]));
    });

    should('bits: u32 single', () => {
      let w = new Writer();
      w.bits(2 ** 32 - 1, 32);
      eql(w.finish(), new Uint8Array([0xff, 0xff, 0xff, 0xff]));
    });

    should('bits: u32 partial', () => {
      let w = new Writer();
      w.bits(0xff, 8);
      for (let i = 0; i < 8; i++) w.bits(1, 1);
      w.bits(0xffff, 16);
      eql(w.finish(), new Uint8Array([0xff, 0xff, 0xff, 0xff]));
    });

    should('bits: u32 mask', () => {
      let w = new Writer();
      for (let i = 0; i < 32; i++) w.bits(+!(i & 1), 1);
      eql(w.finish(), new Uint8Array([0b10101010, 0b10101010, 0b10101010, 0b10101010]));
    });

    should('bits: throw on non-full (1 byte)', () => {
      let w = new Writer();
      w.bits(0, 7);
      throws(() => w.finish());
      throws(() => w.byte(1));
      throws(() => w.bytes(new Uint8Array([2, 3])));
      w.bits(0, 1);
      w.byte(1);
      w.bytes(new Uint8Array([2, 3]));
      eql(w.finish(), new Uint8Array([0, 1, 2, 3]));
    });

    should('bits: throw on non-full (4 byte)', () => {
      let w = new Writer();
      w.bits(0, 31);
      throws(() => w.finish());
      throws(() => w.byte(1));
      throws(() => w.bytes(new Uint8Array([2, 3])));
      w.bits(0, 1);
      w.byte(1);
      w.bytes(new Uint8Array([2, 3]));
      eql(w.finish(), new Uint8Array([0, 0, 0, 0, 1, 2, 3]));
    });
  });
  describe('BitSet', () => {
    const bitset = P._TEST._bitset;
    const setRangeBasic = (bs, bsLen, pos, len) => {
      bitset.chunkLen(bsLen, pos, len);
      for (let i = 0; i < len; i++) {
        const { chunk, mask } = bitset.pos(pos, i);
        bs[chunk] |= mask;
      }
    };
    should('new', () => {
      eql(bitset.create(0).length, 0);
      eql(bitset.create(1).length, 1);
      eql(bitset.create(32).length, 1);
      eql(bitset.create(33).length, 2);
      eql(bitset.create(64).length, 2);
      eql(bitset.create(65).length, 3);
      eql(bitset.create(95).length, 3);
      eql(bitset.create(96).length, 3);
      eql(bitset.create(97).length, 4);
    });
    should('setRangeBasic', () => {
      const LEN = 95;
      let bs = bitset.create(LEN);
      const t = (pos, len, exp) => {
        bitset.clean(bs);
        setRangeBasic(bs, LEN, pos, len);
        eql(bitset.debug(bs), exp);
      };
      t(0, 5, [
        '11111000000000000000000000000000',
        '00000000000000000000000000000000',
        '00000000000000000000000000000000',
      ]);
      t(31, 5, [
        '00000000000000000000000000000001',
        '11110000000000000000000000000000',
        '00000000000000000000000000000000',
      ]);
      t(31, 32 + 1 + 1, [
        '00000000000000000000000000000001',
        '11111111111111111111111111111111',
        '10000000000000000000000000000000',
      ]);
      t(0, 1, [
        '10000000000000000000000000000000',
        '00000000000000000000000000000000',
        '00000000000000000000000000000000',
      ]);
      t(31, 1, [
        '00000000000000000000000000000001',
        '00000000000000000000000000000000',
        '00000000000000000000000000000000',
      ]);
      t(32, 1, [
        '00000000000000000000000000000000',
        '10000000000000000000000000000000',
        '00000000000000000000000000000000',
      ]);
      t(63, 1, [
        '00000000000000000000000000000000',
        '00000000000000000000000000000001',
        '00000000000000000000000000000000',
      ]);
      t(64, 1, [
        '00000000000000000000000000000000',
        '00000000000000000000000000000000',
        '10000000000000000000000000000000',
      ]);
      t(94, 1, [
        '00000000000000000000000000000000',
        '00000000000000000000000000000000',
        '00000000000000000000000000000010',
      ]);
      throws(() =>
        t(95, 1, [
          '00000000000000000000000000000000',
          '00000000000000000000000000000000',
          '00000000000000000000000000000001',
        ])
      );
      t(0, 95, [
        '11111111111111111111111111111111',
        '11111111111111111111111111111111',
        '11111111111111111111111111111110',
      ]);
      t(1, 1, [
        '01000000000000000000000000000000',
        '00000000000000000000000000000000',
        '00000000000000000000000000000000',
      ]);
      t(1, 2, [
        '01100000000000000000000000000000',
        '00000000000000000000000000000000',
        '00000000000000000000000000000000',
      ]);
    });
    should('setRangeBasic160', () => {
      const LEN = 160;
      let bs = bitset.create(LEN);
      const t = (pos, len, exp) => {
        bitset.clean(bs);
        setRangeBasic(bs, LEN, pos, len);
        eql(bitset.debug(bs), exp);
      };
      t(0, 160, [
        '11111111111111111111111111111111',
        '11111111111111111111111111111111',
        '11111111111111111111111111111111',
        '11111111111111111111111111111111',
        '11111111111111111111111111111111',
      ]);
      t(159, 1, [
        '00000000000000000000000000000000',
        '00000000000000000000000000000000',
        '00000000000000000000000000000000',
        '00000000000000000000000000000000',
        '00000000000000000000000000000001',
      ]);
      throws(() =>
        t(160, 1, [
          '00000000000000000000000000000000',
          '00000000000000000000000000000000',
          '00000000000000000000000000000000',
          '00000000000000000000000000000000',
          '00000000000000000000000000000000',
        ])
      );
    });
    should('indices', () => {
      const LEN = 95;
      const bs = bitset.create(LEN);
      const t = (pos, len, exp) => {
        bitset.clean(bs);
        setRangeBasic(bs, LEN, pos, len);
        eql(bitset.indices(bs, LEN), exp);
      };
      t(0, 5, [0, 1, 2, 3, 4]);
      t(1, 5, [1, 2, 3, 4, 5]);
      t(3, 5, [3, 4, 5, 6, 7]);
      t(3, 2, [3, 4]);
      t(3, 3, [3, 4, 5]);
      t(3, 4, [3, 4, 5, 6]);
      t(94, 1, [94]);
      throws(() => t(94, 2, [94]));
      throws(() => t(95, 1, [94]));
    });
    should('ranges', () => {
      const LEN = 95;
      const bs = bitset.create(LEN);
      setRangeBasic(bs, LEN, 0, 5);
      eql(bitset.range(bitset.indices(bs, LEN)), [{ pos: 0, length: 5 }]);
      eql(bitset.range(bitset.indices(bs, LEN, true)), [{ pos: 5, length: 90 }]);

      setRangeBasic(bs, LEN, 5, 3);
      eql(bitset.range(bitset.indices(bs, LEN)), [{ pos: 0, length: 8 }]);
      setRangeBasic(bs, LEN, 9, 3);
      eql(bitset.range(bitset.indices(bs, LEN)), [
        { pos: 0, length: 8 },
        { pos: 9, length: 3 },
      ]);
      setRangeBasic(bs, LEN, 15, 5);
      eql(bitset.range(bitset.indices(bs, LEN)), [
        { pos: 0, length: 8 },
        { pos: 9, length: 3 },
        { pos: 15, length: 5 },
      ]);
      setRangeBasic(bs, LEN, 20, 1);
      eql(bitset.range(bitset.indices(bs, LEN)), [
        { pos: 0, length: 8 },
        { pos: 9, length: 3 },
        { pos: 15, length: 6 },
      ]);
      setRangeBasic(bs, LEN, 22, 1);
      eql(bitset.range(bitset.indices(bs, LEN)), [
        { pos: 0, length: 8 },
        { pos: 9, length: 3 },
        { pos: 15, length: 6 },
        { pos: 22, length: 1 },
      ]);
      setRangeBasic(bs, LEN, 24, 1);
      eql(bitset.range(bitset.indices(bs, LEN)), [
        { pos: 0, length: 8 },
        { pos: 9, length: 3 },
        { pos: 15, length: 6 },
        { pos: 22, length: 1 },
        { pos: 24, length: 1 },
      ]);
      setRangeBasic(bs, LEN, 26, 10);
      eql(bitset.range(bitset.indices(bs, LEN)), [
        { pos: 0, length: 8 },
        { pos: 9, length: 3 },
        { pos: 15, length: 6 },
        { pos: 22, length: 1 },
        { pos: 24, length: 1 },
        { pos: 26, length: 10 },
      ]);
      eql(bitset.rangeDebug(bs, LEN), '[(0/8), (9/3), (15/6), (22/1), (24/1), (26/10)]');
      eql(bitset.rangeDebug(bs, LEN, true), '[(8/1), (12/3), (21/1), (23/1), (25/1), (36/59)]');
      eql(
        bitset.indices(bs, LEN),
        // prettier-ignore
        [
        0, 1, 2, 3, 4, 5, 6, 7, //  pos=0 len=8
        9, 10, 11, // pos=9 len=3
        15, 16, 17, 18, 19, 20, // pos=15 len=6
        22, // pos=22 len=1
        24, // pos24 len=1
        26, 27, 28, 29, 30, 31, 32, 33, 34, 35, // pos=26 len=10
      ]
      );
      eql(
        bitset.indices(bs, LEN, true),
        // prettier-ignore
        [
          8, // pos=8
          12, 13, 14, // pos=12
          21, // pos=21
          23, // pos=23
          25, // pos=25
          // last chunks. NOTE: important that 95 is not here!
          36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51,
          52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73,
          74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94,
        ]
      );
    });
    should('setRange', () => {
      const LEN = 95;
      const bs = bitset.create(LEN);
      const t = (pos, len, exp) => {
        bitset.clean(bs);
        eql(bitset.setRange(bs, LEN, pos, len), true);
        eql(bitset.debug(bs), exp);
      };
      t(0, 5, [
        '11111000000000000000000000000000',
        '00000000000000000000000000000000',
        '00000000000000000000000000000000',
      ]);
      t(31, 5, [
        '00000000000000000000000000000001',
        '11110000000000000000000000000000',
        '00000000000000000000000000000000',
      ]);
      t(31, 32 + 1 + 1, [
        '00000000000000000000000000000001',
        '11111111111111111111111111111111',
        '10000000000000000000000000000000',
      ]);
      t(0, 1, [
        '10000000000000000000000000000000',
        '00000000000000000000000000000000',
        '00000000000000000000000000000000',
      ]);
      t(31, 1, [
        '00000000000000000000000000000001',
        '00000000000000000000000000000000',
        '00000000000000000000000000000000',
      ]);
      t(32, 1, [
        '00000000000000000000000000000000',
        '10000000000000000000000000000000',
        '00000000000000000000000000000000',
      ]);
      t(63, 1, [
        '00000000000000000000000000000000',
        '00000000000000000000000000000001',
        '00000000000000000000000000000000',
      ]);
      t(64, 1, [
        '00000000000000000000000000000000',
        '00000000000000000000000000000000',
        '10000000000000000000000000000000',
      ]);
      t(94, 1, [
        '00000000000000000000000000000000',
        '00000000000000000000000000000000',
        '00000000000000000000000000000010',
      ]);
      throws(() =>
        t(95, 1, [
          '00000000000000000000000000000000',
          '00000000000000000000000000000000',
          '00000000000000000000000000000001',
        ])
      );
      t(1, 1, [
        '01000000000000000000000000000000',
        '00000000000000000000000000000000',
        '00000000000000000000000000000000',
      ]);
      t(1, 2, [
        '01100000000000000000000000000000',
        '00000000000000000000000000000000',
        '00000000000000000000000000000000',
      ]);
    });
    should('setRange bruteforce', () => {
      const LEN = 160;
      const bs = bitset.create(LEN);
      for (let pos = 0; pos < LEN; pos++) {
        const maxLen = LEN - pos;
        for (let l = 1; l <= maxLen; l++) {
          bitset.clean(bs);
          setRangeBasic(bs, LEN, pos, l);
          eql(bitset.range(bitset.indices(bs, LEN)), [{ pos, length: l }]);
          const tmp = bs.slice();
          bitset.clean(bs);
          eql(bitset.setRange(bs, LEN, pos, l), true);
          eql(bs, tmp);
        }
      }
    });
    should('setRange rewrite', () => {
      const LEN = 95;
      const bs = bitset.create(LEN);
      eql(bitset.setRange(bs, LEN, 0, 5, false), true);
      eql(bitset.setRange(bs, LEN, 0, 5, false), false);
      eql(bitset.setRange(bs, LEN, 1, 10, false), false);
      eql(bitset.debug(bs), [
        '11111000000000000000000000000000',
        '00000000000000000000000000000000',
        '00000000000000000000000000000000',
      ]);
      eql(bitset.setRange(bs, LEN, 2, 64, false), false);
      eql(bitset.debug(bs), [
        '11111000000000000000000000000000',
        '00000000000000000000000000000000',
        '00000000000000000000000000000000',
      ]);
      eql(bitset.setRange(bs, LEN, 2, 64, true), true);
      eql(bitset.debug(bs), [
        '11111111111111111111111111111111',
        '11111111111111111111111111111111',
        '11000000000000000000000000000000',
      ]);
    });
  });
});

should.runWhen(import.meta.url);
