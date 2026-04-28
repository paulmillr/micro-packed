import { describe, should } from '@paulmillr/jsbt/test.js';
import { hex } from '@scure/base';
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
    throws(() => P.bigint(0, false, false, true), {
      name: 'Error',
      message: 'bigint/size: wrong value 0',
    });
    throws(() => P.bigint(-1, true, true, false), {
      name: 'Error',
      message: 'bigint/size: wrong value -1',
    });
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
  should('int size', () => {
    throws(() => P.int(0, true, false, false), {
      name: 'Error',
      message: 'int/size: wrong value 0',
    });
    throws(() => P.int(-1, true, false, false), {
      name: 'Error',
      message: 'int/size: wrong value -1',
    });
  });
  should('sized bigint boundaries', () => {
    const run = (name: string, coder: P.CoderType<bigint>, values: bigint[]) =>
      values.map((value) => {
        const encoded = coder.encode(value);
        return {
          name,
          value: String(value),
          size: coder.size,
          encoded: hex.encode(encoded),
          encodedLen: encoded.length,
          decoded: String(coder.decode(encoded)),
        };
      });
    const u64 = [0n, 1n, 127n, 128n, 255n, 256n, 2n ** 64n - 1n];
    const i64 = [-(2n ** 63n), -129n, -128n, -1n, 0n, 1n, 127n, 128n, 2n ** 63n - 1n];
    const i128 = [-(2n ** 127n), -1n, 0n, 1n, 2n ** 127n - 1n];
    const i256 = [-(2n ** 255n), -1n, 0n, 1n, 2n ** 255n - 1n];
    eql(
      {
        u64be: run('U64BE', P.U64BE, u64),
        u64le: run('U64LE', P.U64LE, u64),
        i64be: run('I64BE', P.I64BE, i64),
        i64le: run('I64LE', P.I64LE, i64),
        i128be: run('I128BE', P.I128BE, i128),
        i128le: run('I128LE', P.I128LE, i128),
        i256be: run('I256BE', P.I256BE, i256),
        i256le: run('I256LE', P.I256LE, i256),
      },
      {
        u64be: [
          {
            name: 'U64BE',
            value: '0',
            size: 8,
            encoded: '0000000000000000',
            encodedLen: 8,
            decoded: '0',
          },
          {
            name: 'U64BE',
            value: '1',
            size: 8,
            encoded: '0000000000000001',
            encodedLen: 8,
            decoded: '1',
          },
          {
            name: 'U64BE',
            value: '127',
            size: 8,
            encoded: '000000000000007f',
            encodedLen: 8,
            decoded: '127',
          },
          {
            name: 'U64BE',
            value: '128',
            size: 8,
            encoded: '0000000000000080',
            encodedLen: 8,
            decoded: '128',
          },
          {
            name: 'U64BE',
            value: '255',
            size: 8,
            encoded: '00000000000000ff',
            encodedLen: 8,
            decoded: '255',
          },
          {
            name: 'U64BE',
            value: '256',
            size: 8,
            encoded: '0000000000000100',
            encodedLen: 8,
            decoded: '256',
          },
          {
            name: 'U64BE',
            value: '18446744073709551615',
            size: 8,
            encoded: 'ffffffffffffffff',
            encodedLen: 8,
            decoded: '18446744073709551615',
          },
        ],
        u64le: [
          {
            name: 'U64LE',
            value: '0',
            size: 8,
            encoded: '0000000000000000',
            encodedLen: 8,
            decoded: '0',
          },
          {
            name: 'U64LE',
            value: '1',
            size: 8,
            encoded: '0100000000000000',
            encodedLen: 8,
            decoded: '1',
          },
          {
            name: 'U64LE',
            value: '127',
            size: 8,
            encoded: '7f00000000000000',
            encodedLen: 8,
            decoded: '127',
          },
          {
            name: 'U64LE',
            value: '128',
            size: 8,
            encoded: '8000000000000000',
            encodedLen: 8,
            decoded: '128',
          },
          {
            name: 'U64LE',
            value: '255',
            size: 8,
            encoded: 'ff00000000000000',
            encodedLen: 8,
            decoded: '255',
          },
          {
            name: 'U64LE',
            value: '256',
            size: 8,
            encoded: '0001000000000000',
            encodedLen: 8,
            decoded: '256',
          },
          {
            name: 'U64LE',
            value: '18446744073709551615',
            size: 8,
            encoded: 'ffffffffffffffff',
            encodedLen: 8,
            decoded: '18446744073709551615',
          },
        ],
        i64be: [
          {
            name: 'I64BE',
            value: '-9223372036854775808',
            size: 8,
            encoded: '8000000000000000',
            encodedLen: 8,
            decoded: '-9223372036854775808',
          },
          {
            name: 'I64BE',
            value: '-129',
            size: 8,
            encoded: 'ffffffffffffff7f',
            encodedLen: 8,
            decoded: '-129',
          },
          {
            name: 'I64BE',
            value: '-128',
            size: 8,
            encoded: 'ffffffffffffff80',
            encodedLen: 8,
            decoded: '-128',
          },
          {
            name: 'I64BE',
            value: '-1',
            size: 8,
            encoded: 'ffffffffffffffff',
            encodedLen: 8,
            decoded: '-1',
          },
          {
            name: 'I64BE',
            value: '0',
            size: 8,
            encoded: '0000000000000000',
            encodedLen: 8,
            decoded: '0',
          },
          {
            name: 'I64BE',
            value: '1',
            size: 8,
            encoded: '0000000000000001',
            encodedLen: 8,
            decoded: '1',
          },
          {
            name: 'I64BE',
            value: '127',
            size: 8,
            encoded: '000000000000007f',
            encodedLen: 8,
            decoded: '127',
          },
          {
            name: 'I64BE',
            value: '128',
            size: 8,
            encoded: '0000000000000080',
            encodedLen: 8,
            decoded: '128',
          },
          {
            name: 'I64BE',
            value: '9223372036854775807',
            size: 8,
            encoded: '7fffffffffffffff',
            encodedLen: 8,
            decoded: '9223372036854775807',
          },
        ],
        i64le: [
          {
            name: 'I64LE',
            value: '-9223372036854775808',
            size: 8,
            encoded: '0000000000000080',
            encodedLen: 8,
            decoded: '-9223372036854775808',
          },
          {
            name: 'I64LE',
            value: '-129',
            size: 8,
            encoded: '7fffffffffffffff',
            encodedLen: 8,
            decoded: '-129',
          },
          {
            name: 'I64LE',
            value: '-128',
            size: 8,
            encoded: '80ffffffffffffff',
            encodedLen: 8,
            decoded: '-128',
          },
          {
            name: 'I64LE',
            value: '-1',
            size: 8,
            encoded: 'ffffffffffffffff',
            encodedLen: 8,
            decoded: '-1',
          },
          {
            name: 'I64LE',
            value: '0',
            size: 8,
            encoded: '0000000000000000',
            encodedLen: 8,
            decoded: '0',
          },
          {
            name: 'I64LE',
            value: '1',
            size: 8,
            encoded: '0100000000000000',
            encodedLen: 8,
            decoded: '1',
          },
          {
            name: 'I64LE',
            value: '127',
            size: 8,
            encoded: '7f00000000000000',
            encodedLen: 8,
            decoded: '127',
          },
          {
            name: 'I64LE',
            value: '128',
            size: 8,
            encoded: '8000000000000000',
            encodedLen: 8,
            decoded: '128',
          },
          {
            name: 'I64LE',
            value: '9223372036854775807',
            size: 8,
            encoded: 'ffffffffffffff7f',
            encodedLen: 8,
            decoded: '9223372036854775807',
          },
        ],
        i128be: [
          {
            name: 'I128BE',
            value: String(i128[0]),
            size: 16,
            encoded: '80' + '00'.repeat(15),
            encodedLen: 16,
            decoded: String(i128[0]),
          },
          {
            name: 'I128BE',
            value: '-1',
            size: 16,
            encoded: 'ff'.repeat(16),
            encodedLen: 16,
            decoded: '-1',
          },
          {
            name: 'I128BE',
            value: '0',
            size: 16,
            encoded: '00'.repeat(16),
            encodedLen: 16,
            decoded: '0',
          },
          {
            name: 'I128BE',
            value: '1',
            size: 16,
            encoded: '00'.repeat(15) + '01',
            encodedLen: 16,
            decoded: '1',
          },
          {
            name: 'I128BE',
            value: String(i128[4]),
            size: 16,
            encoded: '7f' + 'ff'.repeat(15),
            encodedLen: 16,
            decoded: String(i128[4]),
          },
        ],
        i128le: [
          {
            name: 'I128LE',
            value: String(i128[0]),
            size: 16,
            encoded: '00'.repeat(15) + '80',
            encodedLen: 16,
            decoded: String(i128[0]),
          },
          {
            name: 'I128LE',
            value: '-1',
            size: 16,
            encoded: 'ff'.repeat(16),
            encodedLen: 16,
            decoded: '-1',
          },
          {
            name: 'I128LE',
            value: '0',
            size: 16,
            encoded: '00'.repeat(16),
            encodedLen: 16,
            decoded: '0',
          },
          {
            name: 'I128LE',
            value: '1',
            size: 16,
            encoded: '01' + '00'.repeat(15),
            encodedLen: 16,
            decoded: '1',
          },
          {
            name: 'I128LE',
            value: String(i128[4]),
            size: 16,
            encoded: 'ff'.repeat(15) + '7f',
            encodedLen: 16,
            decoded: String(i128[4]),
          },
        ],
        i256be: [
          {
            name: 'I256BE',
            value: String(i256[0]),
            size: 32,
            encoded: '80' + '00'.repeat(31),
            encodedLen: 32,
            decoded: String(i256[0]),
          },
          {
            name: 'I256BE',
            value: '-1',
            size: 32,
            encoded: 'ff'.repeat(32),
            encodedLen: 32,
            decoded: '-1',
          },
          {
            name: 'I256BE',
            value: '0',
            size: 32,
            encoded: '00'.repeat(32),
            encodedLen: 32,
            decoded: '0',
          },
          {
            name: 'I256BE',
            value: '1',
            size: 32,
            encoded: '00'.repeat(31) + '01',
            encodedLen: 32,
            decoded: '1',
          },
          {
            name: 'I256BE',
            value: String(i256[4]),
            size: 32,
            encoded: '7f' + 'ff'.repeat(31),
            encodedLen: 32,
            decoded: String(i256[4]),
          },
        ],
        i256le: [
          {
            name: 'I256LE',
            value: String(i256[0]),
            size: 32,
            encoded: '00'.repeat(31) + '80',
            encodedLen: 32,
            decoded: String(i256[0]),
          },
          {
            name: 'I256LE',
            value: '-1',
            size: 32,
            encoded: 'ff'.repeat(32),
            encodedLen: 32,
            decoded: '-1',
          },
          {
            name: 'I256LE',
            value: '0',
            size: 32,
            encoded: '00'.repeat(32),
            encodedLen: 32,
            decoded: '0',
          },
          {
            name: 'I256LE',
            value: '1',
            size: 32,
            encoded: '01' + '00'.repeat(31),
            encodedLen: 32,
            decoded: '1',
          },
          {
            name: 'I256LE',
            value: String(i256[4]),
            size: 32,
            encoded: 'ff'.repeat(31) + '7f',
            encodedLen: 32,
            decoded: String(i256[4]),
          },
        ],
      }
    );
    throws(() => P.I64BE.encode(-(2n ** 63n) - 1n));
    throws(() => P.I64BE.encode(2n ** 63n));
    throws(() => P.I128BE.encode(-(2n ** 127n) - 1n));
    throws(() => P.I128BE.encode(2n ** 127n));
    throws(() => P.I256BE.encode(-(2n ** 255n) - 1n));
    throws(() => P.I256BE.encode(2n ** 255n));
    throws(() => P.U64BE.encode(-1n));
    throws(() => P.I64BE.decode(new Uint8Array(7)));
    throws(() => P.I128BE.decode(new Uint8Array(15)));
    throws(() => P.I256BE.decode(new Uint8Array(31)));
    throws(() => P.U64BE.decode(new Uint8Array(7)));
  });
  should('signed unsized bigint', () => {
    const run = (le: boolean) => {
      const coder = P.bigint(8, le, true, false);
      const values = [
        -(2n ** 63n),
        -32769n,
        -32768n,
        -129n,
        -128n,
        -1n,
        0n,
        1n,
        127n,
        128n,
        255n,
        256n,
        32767n,
        32768n,
        65535n,
        65536n,
        2n ** 63n - 1n,
      ];
      return values.map((value) => {
        const encoded = coder.encode(value);
        return {
          value: String(value),
          encoded: hex.encode(encoded),
          decoded: String(coder.decode(encoded)),
        };
      });
    };
    const decode = (le: boolean, bytes: Uint8Array) =>
      String(P.bigint(8, le, true, false).decode(bytes));
    eql(
      {
        be: run(false),
        le: run(true),
        shortBE: [
          decode(false, Uint8Array.of(0x80)),
          decode(false, Uint8Array.of(0xff)),
          decode(false, Uint8Array.of(0xff, 0xff)),
        ],
        shortLE: [
          decode(true, Uint8Array.of(0x80)),
          decode(true, Uint8Array.of(0xff)),
          decode(true, Uint8Array.of(0xff, 0xff)),
        ],
      },
      {
        be: [
          {
            value: '-9223372036854775808',
            encoded: '8000000000000000',
            decoded: '-9223372036854775808',
          },
          { value: '-32769', encoded: 'ff7fff', decoded: '-32769' },
          { value: '-32768', encoded: '8000', decoded: '-32768' },
          { value: '-129', encoded: 'ff7f', decoded: '-129' },
          { value: '-128', encoded: '80', decoded: '-128' },
          { value: '-1', encoded: 'ff', decoded: '-1' },
          { value: '0', encoded: '', decoded: '0' },
          { value: '1', encoded: '01', decoded: '1' },
          { value: '127', encoded: '7f', decoded: '127' },
          { value: '128', encoded: '0080', decoded: '128' },
          { value: '255', encoded: '00ff', decoded: '255' },
          { value: '256', encoded: '0100', decoded: '256' },
          { value: '32767', encoded: '7fff', decoded: '32767' },
          { value: '32768', encoded: '008000', decoded: '32768' },
          { value: '65535', encoded: '00ffff', decoded: '65535' },
          { value: '65536', encoded: '010000', decoded: '65536' },
          {
            value: '9223372036854775807',
            encoded: '7fffffffffffffff',
            decoded: '9223372036854775807',
          },
        ],
        le: [
          {
            value: '-9223372036854775808',
            encoded: '0000000000000080',
            decoded: '-9223372036854775808',
          },
          { value: '-32769', encoded: 'ff7fff', decoded: '-32769' },
          { value: '-32768', encoded: '0080', decoded: '-32768' },
          { value: '-129', encoded: '7fff', decoded: '-129' },
          { value: '-128', encoded: '80', decoded: '-128' },
          { value: '-1', encoded: 'ff', decoded: '-1' },
          { value: '0', encoded: '', decoded: '0' },
          { value: '1', encoded: '01', decoded: '1' },
          { value: '127', encoded: '7f', decoded: '127' },
          { value: '128', encoded: '8000', decoded: '128' },
          { value: '255', encoded: 'ff00', decoded: '255' },
          { value: '256', encoded: '0001', decoded: '256' },
          { value: '32767', encoded: 'ff7f', decoded: '32767' },
          { value: '32768', encoded: '008000', decoded: '32768' },
          { value: '65535', encoded: 'ffff00', decoded: '65535' },
          { value: '65536', encoded: '000001', decoded: '65536' },
          {
            value: '9223372036854775807',
            encoded: 'ffffffffffffff7f',
            decoded: '9223372036854775807',
          },
        ],
        shortBE: ['-128', '-1', '-1'],
        shortLE: ['-128', '-1', '-1'],
      }
    );
  });
  should('signed unsized int', () => {
    const run = (le: boolean) => {
      const coder = P.int(6, le, true, false);
      const values = [-(2 ** 47), -32768, -128, -1, 0, 127, 128, 255, 32767, 32768, 2 ** 47 - 1];
      return values.map((value) => {
        const encoded = coder.encode(value);
        return { value, encoded: hex.encode(encoded), decoded: coder.decode(encoded) };
      });
    };
    const decode = (le: boolean, bytes: Uint8Array) => P.int(6, le, true, false).decode(bytes);
    eql(
      {
        be: run(false),
        le: run(true),
        shortBE: [
          decode(false, Uint8Array.of(0x80)),
          decode(false, Uint8Array.of(0xff)),
          decode(false, Uint8Array.of(0xff, 0xff)),
        ],
        shortLE: [
          decode(true, Uint8Array.of(0x80)),
          decode(true, Uint8Array.of(0xff)),
          decode(true, Uint8Array.of(0xff, 0xff)),
        ],
      },
      {
        be: [
          { value: -140737488355328, encoded: '800000000000', decoded: -140737488355328 },
          { value: -32768, encoded: '8000', decoded: -32768 },
          { value: -128, encoded: '80', decoded: -128 },
          { value: -1, encoded: 'ff', decoded: -1 },
          { value: 0, encoded: '', decoded: 0 },
          { value: 127, encoded: '7f', decoded: 127 },
          { value: 128, encoded: '0080', decoded: 128 },
          { value: 255, encoded: '00ff', decoded: 255 },
          { value: 32767, encoded: '7fff', decoded: 32767 },
          { value: 32768, encoded: '008000', decoded: 32768 },
          { value: 140737488355327, encoded: '7fffffffffff', decoded: 140737488355327 },
        ],
        le: [
          { value: -140737488355328, encoded: '000000000080', decoded: -140737488355328 },
          { value: -32768, encoded: '0080', decoded: -32768 },
          { value: -128, encoded: '80', decoded: -128 },
          { value: -1, encoded: 'ff', decoded: -1 },
          { value: 0, encoded: '', decoded: 0 },
          { value: 127, encoded: '7f', decoded: 127 },
          { value: 128, encoded: '8000', decoded: 128 },
          { value: 255, encoded: 'ff00', decoded: 255 },
          { value: 32767, encoded: 'ff7f', decoded: 32767 },
          { value: 32768, encoded: '008000', decoded: 32768 },
          { value: 140737488355327, encoded: 'ffffffffff7f', decoded: 140737488355327 },
        ],
        shortBE: [-128, -1, -1],
        shortLE: [-128, -1, -1],
      }
    );
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
    should('length config', () => {
      const zero = P.bits(0);
      eql(zero.encode(0), Uint8Array.of());
      eql(zero.decode(Uint8Array.of()), 0);
      const max = P.bits(32);
      eql(max.encode(2 ** 32 - 1), Uint8Array.of(0xff, 0xff, 0xff, 0xff));
      eql(max.decode(Uint8Array.of(0xff, 0xff, 0xff, 0xff)), 2 ** 32 - 1);
      throws(() => P.bits(-1), {
        name: 'Error',
        message: 'bits: wrong length -1 (number)',
      });
      throws(() => P.bits(33), {
        name: 'Error',
        message: 'bits: wrong length 33 (number)',
      });
    });
  });
});

describe('structures', () => {
  describe('padding', () => {
    test('left', {
      p: P.padLeft(3, P.U8),
      correct: [[97, '000061']],
    });
    should('left zero-size', () => {
      const constant = P.padLeft(4, P.constant(1));
      const bytes = P.padLeft(4, P.bytes(0));
      eql(
        {
          constantSize: constant.size,
          constantEncoded: constant.encode(1),
          constantDecoded: constant.decode(Uint8Array.of()),
          bytesSize: bytes.size,
          bytesEncoded: bytes.encode(Uint8Array.of()),
          bytesDecoded: bytes.decode(Uint8Array.of()),
        },
        {
          constantSize: 0,
          constantEncoded: Uint8Array.of(),
          constantDecoded: 1,
          bytesSize: 0,
          bytesEncoded: Uint8Array.of(),
          bytesDecoded: Uint8Array.of(),
        }
      );
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
    should('right zero-size', () => {
      const constant = P.padRight(4, P.constant(1));
      const bytes = P.padRight(4, P.bytes(0));
      eql(
        {
          constantSize: constant.size,
          constantEncoded: constant.encode(1),
          constantDecoded: constant.decode(Uint8Array.of()),
          bytesSize: bytes.size,
          bytesEncoded: bytes.encode(Uint8Array.of()),
          bytesDecoded: bytes.decode(Uint8Array.of()),
        },
        {
          constantSize: 0,
          constantEncoded: Uint8Array.of(),
          constantDecoded: 1,
          bytesSize: 0,
          bytesEncoded: Uint8Array.of(),
          bytesDecoded: Uint8Array.of(),
        }
      );
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
  should('struct inherited fields', () => {
    const fixed = Object.create({ inherited: P.U8 }) as {
      own: typeof P.U8;
      inherited: typeof P.U8;
    };
    fixed.own = P.U8;
    const fixedStruct = P.struct(fixed);
    eql(
      {
        size: fixedStruct.size,
        encoded: fixedStruct.encode({ own: 2, inherited: 1 }),
        decoded: fixedStruct.decode(Uint8Array.of(2, 1)),
      },
      {
        size: 2,
        encoded: Uint8Array.of(2, 1),
        decoded: { own: 2, inherited: 1 },
      }
    );

    const dynamic = Object.create({ inherited: P.bytes(null) }) as {
      own: typeof P.U8;
      inherited: ReturnType<typeof P.bytes>;
    };
    dynamic.own = P.U8;
    eql(P.struct(dynamic).size, undefined);
  });
  should('struct restricted field names', () => {
    const proto = {};
    Object.defineProperty(proto, '__proto__', { value: P.U8, enumerable: true });
    for (const [name, fields] of [
      ['__proto__', proto],
      ['constructor', { constructor: P.U8 }],
      ['prototype', { prototype: P.U8 }],
    ] as const)
      throws(() => P.struct(fields as any), {
        name: 'Error',
        message: `struct: field ${name} is reserved`,
      });
  });
  describe('bitset', () => {
    should('basic', () => {
      const flags = P.bitset(['a', 'b', 'c'], true);
      const value = { a: true, b: false, c: true };
      eql(flags.encode(value), Uint8Array.of(0b10100000));
      eql(flags.decode(Uint8Array.of(0b10100000)), value);
    });
    should('invalid args', () => {
      throws(() => P.bitset(['a'], 1 as any), {
        name: 'TypeError',
        message: 'bitset/pad: expected boolean, got number',
      });
      throws(() => P.bitset(['a'], true, 1 as any), {
        name: 'TypeError',
        message: 'bitset/strict: expected boolean, got number',
      });
      throws(() => P.bitset('a' as any, true), {
        name: 'TypeError',
        message: 'bitset/names: expected array',
      });
      throws(() => P.bitset(['a', 1] as any, true), {
        name: 'TypeError',
        message: 'bitset/names: expected array of strings',
      });
    });
    should('names and values', () => {
      const repeated = P.bitset(['_r', '_r', 'a'], true);
      eql(repeated.decode(Uint8Array.of(0x20)), { _r: false, a: true });
      throws(() => P.bitset(['a', 'a'], true, true), {
        name: 'Error',
        message: 'bitset/names: duplicate name a',
      });
      const flags = P.bitset(['a', 'b'], true);
      eql(flags.encode({ a: true } as any), Uint8Array.of(0x80));
      const strictFlags = P.bitset(['a', 'b'], true, true);
      eql(strictFlags.encode({ a: true } as any), Uint8Array.of(0x80));
      throws(() => flags.encode({ a: true, b: 0 } as any), {
        name: 'Error',
        message: 'Writer(): bitset: expected boolean for b',
      });
      eql(flags.encode({ a: false, b: false }), Uint8Array.of(0));
    });
    should('restricted names', () => {
      for (const name of ['__proto__', 'constructor', 'prototype'])
        throws(() => P.bitset([name], true), {
          name: 'Error',
          message: `bitset/names: name ${name} is reserved`,
        });
      throws(() => P.bitset(['a/b'], true), {
        name: 'TypeError',
        message: 'bitset/names: name a/b cannot contain path separator /',
      });
      throws(() => P.bitset(['a..b'], true), {
        name: 'TypeError',
        message: 'bitset/names: name a..b cannot contain path parent ..',
      });
    });
    should('padding bits', () => {
      const one = P.bitset(['a'], true);
      eql(one.decode(Uint8Array.of(0x80)), { a: true });
      eql(one.decode(Uint8Array.of(0xff)), { a: true });
      const strictOne = P.bitset(['a'], true, true);
      throws(() => strictOne.decode(Uint8Array.of(0xff)), {
        name: 'Error',
        message: 'Reader(): bitset: non-zero padding bits',
      });

      const three = P.bitset(['a', 'b', 'c'], true, true);
      eql(three.decode(Uint8Array.of(0xa0)), { a: true, b: false, c: true });
      throws(() => three.decode(Uint8Array.of(0xa1)), {
        name: 'Error',
        message: 'Reader(): bitset: non-zero padding bits',
      });

      const aligned = P.bitset(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], true, true);
      eql(aligned.decode(Uint8Array.of(0xff)), {
        a: true,
        b: true,
        c: true,
        d: true,
        e: true,
        f: true,
        g: true,
        h: true,
      });
    });
    should('size', () => {
      const padded = P.bitset(['a', 'b', 'c', 'd'], true);
      const aligned = P.bitset(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
      const unaligned = P.bitset(['a', 'b', 'c', 'd']);
      const empty = P.bitset([]);
      eql(
        {
          paddedSize: padded.size,
          paddedEncoded: padded.encode({ a: true, b: false, c: false, d: true }),
          alignedSize: aligned.size,
          alignedEncoded: aligned.encode({
            a: true,
            b: false,
            c: true,
            d: false,
            e: true,
            f: false,
            g: true,
            h: false,
          }),
          unalignedSize: unaligned.size,
          emptySize: empty.size,
          emptyEncoded: empty.encode({}),
          structSize: P.struct({ padded, aligned }).size,
          arraySize: P.array(2, padded).size,
        },
        {
          paddedSize: 1,
          paddedEncoded: Uint8Array.of(0x90),
          alignedSize: 1,
          alignedEncoded: Uint8Array.of(0xaa),
          unalignedSize: undefined,
          emptySize: 0,
          emptyEncoded: Uint8Array.of(),
          structSize: 2,
          arraySize: 2,
        }
      );
    });
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
    should('invalid args', () => {
      throws(() => P.array(1, 1 as any), {
        name: 'TypeError',
        message: 'array: invalid inner value 1',
      });
      throws(() => P.array({} as any, P.U8), {
        name: 'TypeError',
        message:
          'lengthCoder: expected null | number | Uint8Array | CoderType, got [object Object] (object)',
      });
      throws(() => P.array(-1, P.U8), {
        name: 'Error',
        message: 'lengthCoder: wrong length=-1',
      });
      throws(() => P.array(P.I8, P.U8).decode(Uint8Array.of(0xff)), {
        name: 'Error',
        message: 'Reader(arrayLen): Wrong length: -1',
      });
    });
    should('zero-size inner', () => {
      const inner = P.array(0, P.U8);
      const outer = P.array(3, inner);
      const tuple = P.tuple([inner, outer]);
      const struct = P.struct({ inner, outer });
      eql(
        {
          innerSize: inner.size,
          innerEncoded: inner.encode([]),
          outerSize: outer.size,
          outerEncoded: outer.encode([[], [], []]),
          outerDecoded: outer.decode(Uint8Array.of()),
          tupleSize: tuple.size,
          tupleEncoded: tuple.encode([[], [[], [], []]]),
          tupleDecoded: tuple.decode(Uint8Array.of()),
          structSize: struct.size,
          structEncoded: struct.encode({ inner: [], outer: [[], [], []] }),
          structDecoded: struct.decode(Uint8Array.of()),
        },
        {
          innerSize: 0,
          innerEncoded: Uint8Array.of(),
          outerSize: 0,
          outerEncoded: Uint8Array.of(),
          outerDecoded: [[], [], []],
          tupleSize: 0,
          tupleEncoded: Uint8Array.of(),
          tupleDecoded: [[], [[], [], []]],
          structSize: 0,
          structEncoded: Uint8Array.of(),
          structDecoded: { inner: [], outer: [[], [], []] },
        }
      );
      throws(() => P.array(null, P.constant(1)), {
        name: 'Error',
        message: 'array: null length cannot use zero-size inner',
      });
      throws(() => P.array(null, inner), {
        name: 'Error',
        message: 'array: null length cannot use zero-size inner',
      });
      const noProgress = () => {
        let reads = 0;
        return P.wrap({
          encodeStream() {},
          decodeStream(r) {
            if (++reads > 1) throw r.err('array: regression zero-progress loop');
            return 0;
          },
        });
      };
      throws(() => P.array(null, noProgress()).decode(Uint8Array.of(1)), {
        name: 'Error',
        message: 'Reader(0): array: inner decoder did not consume input',
      });
      throws(() => P.array(P.NULL, noProgress()).decode(Uint8Array.of(1, 0)), {
        name: 'Error',
        message: 'Reader(0): array: inner decoder did not consume input',
      });
      eql(P.array(null, P.bits(1)).decode(Uint8Array.of(0b10100000)), [1, 0, 1, 0, 0, 0, 0, 0]);
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
      throws(() => P.array(Uint8Array.of(), P.U8), {
        name: 'Error',
        message: 'lengthCoder: empty terminator',
      });
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
      throws(() => P.bytes(-1), {
        name: 'Error',
        message: 'lengthCoder: wrong length=-1',
      });
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
      throws(() => P.bytes(Uint8Array.of()), {
        name: 'Error',
        message: 'lengthCoder: empty terminator',
      });
      throws(() => P.string(Uint8Array.of()), {
        name: 'Error',
        message: 'lengthCoder: empty terminator',
      });
      throws(() => P.hex(Uint8Array.of()), {
        name: 'Error',
        message: 'lengthCoder: empty terminator',
      });
      const a = P.bytes(Uint8Array.of(0));
      // basic encode/decode
      eql(a.decode(a.encode(new Uint8Array([1, 2, 3]))), new Uint8Array([1, 2, 3]));
      // NOTE: LE here becase 0 is terminator
      eql(a.encode(new Uint8Array([1, 2, 3])), new Uint8Array([1, 2, 3, 0]));
      throws(() => a.encode(new Uint8Array([1, 0, 2])), /bytes: value contains terminator/);
      eql(a.decode(Uint8Array.of(0)), Uint8Array.of());
      // No terminator!
      throws(() => a.decode(new Uint8Array([1, 2])));
      eql(a.decode(new Uint8Array([1, 2, 0])), new Uint8Array([1, 2]));
      // Early terminator
      throws(() => a.decode(new Uint8Array([1, 0, 1])));
      // Different separator, so we can encode zero
      const a2 = P.bytes(new Uint8Array([9, 8, 7]));
      eql(a2.decode(a2.encode(new Uint8Array([0, 1, 2]))), new Uint8Array([0, 1, 2]));
      eql(a2.encode(new Uint8Array([0, 1, 2])), new Uint8Array([0, 1, 2, 9, 8, 7]));
      const repeated = P.bytes(Uint8Array.of(1, 1, 1, 2));
      eql(repeated.encode(Uint8Array.of(3, 4)), Uint8Array.of(3, 4, 1, 1, 1, 2));
      throws(() => repeated.encode(Uint8Array.of(1, 1, 1, 1, 2)), /value contains terminator/);
      const terminator = Buffer.from([5, 6]);
      const snapshot = P.bytes(terminator);
      terminator.fill(9);
      eql(snapshot.encode(Uint8Array.of(1)), Uint8Array.of(1, 5, 6));
      // // corrupted terminator
      throws(() => a.decode(new Uint8Array([1, 2, 3, 9, 8])));
    });
  });

  should('cstring', () => {
    eql(P.cstring.encode('test'), new Uint8Array([116, 101, 115, 116, 0]));
    eql(P.cstring.decode(P.cstring.encode('test')), 'test');
    eql(P.cstring.decode(Uint8Array.of(0)), '');
    throws(() => P.cstring.decode(Uint8Array.of(0xc0, 0x80, 0)), /valid for encoding utf-8/);
    throws(() => P.cstring.encode('\ud800'), /utf8 expected well-formed string/);
    throws(() => P.cstring.encode('a\0b'), /bytes: value contains terminator/);
    // Early terminator
    throws(() => P.cstring.decode(new Uint8Array([116, 101, 0, 115, 116])));
  });
  should('string terminator', () => {
    const nul = P.string(Uint8Array.of(0));
    eql(nul.decode(nul.encode('test')), 'test');
    throws(() => nul.encode('\0'), /bytes: value contains terminator/);
    throws(() => nul.encode('a\0b'), /bytes: value contains terminator/);

    const multi = P.string(Uint8Array.of(98, 99));
    eql(multi.decode(multi.encode('abd')), 'abd');
    throws(() => multi.encode('abc'), /bytes: value contains terminator/);

    const le = P.string(Uint8Array.of(0), true);
    eql(le.decode(le.encode('test')), 'test');
    throws(() => le.encode('a\0'), /bytes: value contains terminator/);
  });
  should('path empty fields', () => {
    const path = P._TEST.Path;
    eql([path.path([]), path.path([{ obj: {}, field: '' }])], ['', '""']);
    const inner = P.validate(P.U8, () => {
      throw new Error('leaf');
    });
    const empty = P.struct({ '': inner });
    throws(() => empty.decode(Uint8Array.of(1)), {
      name: 'Error',
      message: 'Reader(""): leaf',
    });
  });
  should('path field separators', () => {
    throws(() => P.struct({ 'a/b': P.U8 }), {
      name: 'TypeError',
      message: 'struct: field a/b cannot contain path separator /',
    });
    throws(() => P.struct({ nested: P.struct({ 'a/b': P.U8 }) }), {
      name: 'TypeError',
      message: 'struct: field a/b cannot contain path separator /',
    });
    throws(() => P.struct({ 'a..b': P.U8 }), {
      name: 'TypeError',
      message: 'struct: field a..b cannot contain path parent ..',
    });
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
      throws(() => P.flag(Uint8Array.of()), {
        name: 'Error',
        message: 'flag/flagValue: empty marker',
      });
      throws(() => P.flag(Uint8Array.of(), true), {
        name: 'Error',
        message: 'flag/flagValue: empty marker',
      });
      const f = P.flag(new Uint8Array([0x1, 0x2, 0x3]));
      const f2 = P.flag(new Uint8Array([0x1, 0x2, 0x3]), true);
      eql(f.size, undefined);
      eql(f2.size, undefined);
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
      const z1 = P.struct({ f: P.flag(new Uint8Array([0x0, 0x1])), f2: P.flagged('f', P.U8, 0) });
      eql(z1.encode({ f2: 1234 }), new Uint8Array([0]));
      eql(z1.decode(new Uint8Array([0])), { f: false, f2: undefined });

      // Decode only if there is flag. No flag -> return undefined
      const s3 = P.flagged(P.flag(new Uint8Array([0x0, 0x1])), P.U32BE);
      eql(s3.encode(123), new Uint8Array([0x0, 0x1, 0x0, 0x0, 0x0, 123]));
      eql(s3.encode(undefined), Uint8Array.of());
      eql(s3.decode(new Uint8Array([0x0, 0x1, 0x0, 0x0, 0x0, 123])), 123);
      eql(s3.decode(Uint8Array.of()), undefined);
      throws(() => s3.decode(new Uint8Array([0x1])));
      throws(() => s3.decode(new Uint8Array([0x1, 0x2, 0x3, 0x4, 0x5, 0x6])));
      const z2 = P.flagged(P.flag(new Uint8Array([0x0, 0x1])), P.U8);
      eql(z2.encode(0), new Uint8Array([0x0, 0x1, 0]));
      eql(z2.decode(new Uint8Array([0x0, 0x1, 0])), 0);
      const z3 = P.flagged(P.flag(new Uint8Array([0x0, 0x1])), P.U8, 0);
      eql(z3.encode(undefined), new Uint8Array([0]));
      eql(z3.decode(new Uint8Array([0])), undefined);
      // Decode only if thre is no flag. If flag -> return undefined
      const s4 = P.flagged(P.flag(new Uint8Array([0x0, 0x1]), true), P.U32BE);
      eql(s4.encode(123), new Uint8Array([0x0, 0x0, 0x0, 123]));
      eql(s4.encode(undefined), new Uint8Array([0x0, 0x1]));
      eql(s4.decode(new Uint8Array([0x0, 0x1])), undefined);
      // Decode as is, if there is no flag
      eql(s4.decode(new Uint8Array([0x0, 0x0, 0x0, 0x4])), 0x4);
      throws(() => s4.decode(new Uint8Array([0x0, 0x1, 0x2])));
    });
    should('optional', () => {
      const flag = P.flag(new Uint8Array([0x0, 0x1]));
      const u8 = P.optional(flag, P.U8);
      eql(u8.encode(0), new Uint8Array([0x0, 0x1, 0x0]));
      eql(u8.decode(new Uint8Array([0x0, 0x1, 0x0])), 0);
      eql(u8.encode(undefined), Uint8Array.of());
      eql(u8.decode(Uint8Array.of()), undefined);
      const withDef = P.optional(flag, P.U8, 123);
      eql(withDef.size, undefined);
      eql([withDef.encode(undefined).length, withDef.encode(0).length], [1, 3]);
      eql(withDef.encode(0), new Uint8Array([0x0, 0x1, 0x0]));
      eql(withDef.decode(new Uint8Array([123])), undefined);
      const withDefXor = P.optional(P.flag(new Uint8Array([0x0, 0x1]), true), P.U8, 123);
      eql(withDefXor.size, undefined);
      eql([withDefXor.encode(undefined).length, withDefXor.encode(0).length], [3, 1]);
      const fixed = P.optional(P.bool, P.U8, 123);
      eql(fixed.size, 2);
      eql([fixed.encode(undefined).length, fixed.encode(0).length], [2, 2]);
      const zero = P.optional(P.bool, P.constant(123), 123);
      eql(zero.size, 1);
      eql(zero.encode(undefined), Uint8Array.of(0));
      eql(zero.encode(123), Uint8Array.of(1));
      const bool = P.optional(flag, P.bool);
      eql(bool.encode(false), new Uint8Array([0x0, 0x1, 0x0]));
      eql(bool.decode(new Uint8Array([0x0, 0x1, 0x0])), false);
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
      const byteMap = P.map(P.hex(2), {
        ab: '6162',
        cd: '6364',
      });
      const pathMap = P.struct({ len: P.U8, value: P.map(P.hex('len'), { one: '01' }) });
      eql(
        {
          abEncoded: byteMap.encode('ab'),
          abDecoded: byteMap.decode(Uint8Array.from([0x61, 0x62])),
          cdEncoded: byteMap.encode('cd'),
          cdDecoded: byteMap.decode(Uint8Array.from([0x63, 0x64])),
          pathEncoded: pathMap.encode({ len: 1, value: 'one' }),
          pathDecoded: pathMap.decode(Uint8Array.of(1, 1)),
        },
        {
          abEncoded: Uint8Array.from([0x61, 0x62]),
          abDecoded: 'ab',
          cdEncoded: Uint8Array.from([0x63, 0x64]),
          cdDecoded: 'cd',
          pathEncoded: Uint8Array.of(1, 1),
          pathDecoded: { len: 1, value: 'one' },
        }
      );
      throws(() => P.map(P.U8, { one: 1, uno: 1, two: 2 }), {
        name: 'Error',
        message: 'map: duplicate value for uno and one',
      });
      throws(() => P.map(P.bytes(2, false), { ab: Uint8Array.of(0x61, 0x62) }), {
        name: 'TypeError',
        message: 'map: variant ab should be primitive',
      });
      throws(() => P.map(P.U8, { bad: 300 }).encode('bad'), {
        name: 'RangeError',
        message: 'Writer(): uintView: value out of bounds. Expected 0 <= 300 < 256',
      });
      throws(() => P.map(P.bits(3), { bad: 8 }).encode('bad'), {
        name: 'Error',
        message: 'Writer(): writeBits: value (8) >= 2**bits (3)',
      });
      throws(() => P.map(P.U8, {}).encode('toString'), {
        name: 'Error',
        message: 'Writer(): Map: unknown variant: toString',
      });
    });
    should('mappedTag', () => {
      const value = P.mappedTag(P.U8, { one: [1, P.U8], two: [2, P.U16BE] });
      eql(value.encode({ TAG: 'one', data: 5 }), Uint8Array.of(1, 5));
      eql(value.decode(Uint8Array.of(2, 0, 5)), { TAG: 'two', data: 5 });
      const protoName = P.mappedTag(P.U8, { ['__proto__']: [0, P.U8] });
      eql(protoName.encode({ TAG: '__proto__', data: 7 }), Uint8Array.of(0, 7));
      eql(protoName.decode(Uint8Array.of(0, 7)), { TAG: '__proto__', data: 7 });
      const identity = { encode: (value: string) => value, decode: (value: string) => value };
      const pathTag = P.struct({
        len: P.U8,
        value: P.tag(P.apply(P.hex('len'), identity), { ff: P.U8 }),
      });
      const pathMapped = P.struct({
        len: P.U8,
        value: P.mappedTag(P.hex('len'), { one: ['01', P.U8] }),
      });
      const single = P.mappedTag(P.U8, { uint: [0, P.U8] });
      const same = P.mappedTag(P.U8, { uint: [1, P.U8], int: [2, P.I8] });
      const different = P.mappedTag(P.U8, { one: [1, P.U8], two: [2, P.U16BE] });
      const dynamic = P.mappedTag(P.U8, { text: [1, P.string(P.U8)] });
      const tagSame = P.tag(P.U8, { 1: P.U8, 2: P.I8 });
      const tagDifferent = P.tag(P.U8, { 1: P.U8, 2: P.U16BE });
      const bitMapped = P.mappedTag(P.bits(3), { zero: [0, P.bits(5)] });
      const bitTag = P.tag(P.bits(3), { 0: P.bits(5) });
      eql(
        {
          singleSize: single.size,
          singleEncoded: single.encode({ TAG: 'uint', data: 7 }),
          sameSize: same.size,
          sameEncoded: same.encode({ TAG: 'int', data: -7 }),
          differentSize: different.size,
          dynamicSize: dynamic.size,
          tagSameSize: tagSame.size,
          tagDifferentSize: tagDifferent.size,
          pathTagEncoded: pathTag.encode({ len: 1, value: { TAG: 'ff', data: 7 } }),
          pathTagDecoded: pathTag.decode(Uint8Array.of(1, 0xff, 7)),
          pathMappedEncoded: pathMapped.encode({ len: 1, value: { TAG: 'one', data: 7 } }),
          pathMappedDecoded: pathMapped.decode(Uint8Array.of(1, 1, 7)),
          bitMappedEncoded: bitMapped.encode({ TAG: 'zero', data: 31 }),
          bitMappedDecoded: bitMapped.decode(Uint8Array.of(31)),
          bitTagEncoded: bitTag.encode({ TAG: 0, data: 31 }),
          bitTagDecoded: bitTag.decode(Uint8Array.of(31)),
        },
        {
          singleSize: 2,
          singleEncoded: Uint8Array.of(0, 7),
          sameSize: 2,
          sameEncoded: Uint8Array.of(2, 0xf9),
          differentSize: undefined,
          dynamicSize: undefined,
          tagSameSize: 2,
          tagDifferentSize: undefined,
          pathTagEncoded: Uint8Array.of(1, 0xff, 7),
          pathTagDecoded: { len: 1, value: { TAG: 'ff', data: 7 } },
          pathMappedEncoded: Uint8Array.of(1, 1, 7),
          pathMappedDecoded: { len: 1, value: { TAG: 'one', data: 7 } },
          bitMappedEncoded: Uint8Array.of(31),
          bitMappedDecoded: { TAG: 'zero', data: 31 },
          bitTagEncoded: Uint8Array.of(31),
          bitTagDecoded: { TAG: 0, data: 31 },
        }
      );
      throws(
        () =>
          P.mappedTag(P.U8, { tooLarge: [300, P.U8] }).encode({
            TAG: 'tooLarge',
            data: 0,
          }),
        {
          name: 'RangeError',
          message: 'Writer(): uintView: value out of bounds. Expected 0 <= 300 < 256',
        }
      );
      throws(() => P.tag(P.U8, { 300: P.U8 }).encode({ TAG: 300, data: 0 }), {
        name: 'RangeError',
        message: 'Writer(): uintView: value out of bounds. Expected 0 <= 300 < 256',
      });
      throws(() => P.mappedTag(P.U8, { one: [1, P.U8], uno: [1, P.U16BE] }), {
        name: 'Error',
        message: 'map: duplicate value for uno and one',
      });
      throws(() => P.tag(P.cstring, {}).encode({ TAG: 'constructor', data: 1 }), {
        name: 'Error',
        message: 'Writer(): Tag: invalid tag constructor',
      });
      throws(() => P.tag(P.cstring, {}).decode(P.cstring.encode('constructor')), {
        name: 'Error',
        message: 'Reader(): Tag: invalid tag constructor',
      });
    });

    should('hex', () => {
      const h = P.apply(P.bytes(P.U16BE), hex);
      const data = '01020304';
      eql(h.decode(h.encode(data)), data);
      const emptyOpts = P.hex(2, {});
      eql(emptyOpts.decode(Uint8Array.of(1, 2)), '0102');
      eql(emptyOpts.encode('0102'), Uint8Array.of(1, 2));
      const little = P.hex(2, { isLE: true });
      eql(little.decode(Uint8Array.of(1, 2)), '0201');
      eql(little.encode('0201'), Uint8Array.of(1, 2));
      const prefixed = P.hex(2, { with0x: true });
      eql(prefixed.decode(Uint8Array.of(1, 2)), '0x0102');
      eql(prefixed.encode('0x0102'), Uint8Array.of(1, 2));
      throws(() => P.hex(2, { isLE: 'true' as any }), {
        name: 'Error',
        message: 'hex/isLE: expected boolean, got string',
      });
      throws(() => P.hex(2, { with0x: 'true' as any }), {
        name: 'Error',
        message: 'hex/with0x: expected boolean, got string',
      });
    });

    should('dict', () => {
      const coder = P.array(P.U16BE, P.tuple([P.cstring, P.U32LE]));
      const h = P.apply(coder, P.coders.dict());
      const data = { lol: 1, blah: 2 };
      eql(h.decode(h.encode(data)), data);
      const dict = P.coders.dict<number | undefined>();
      throws(() => dict.encode([[1 as any, 1]]), {
        name: 'Error',
        message: 'dict: key should be string, got number',
      });
      throws(
        () =>
          dict.encode([
            ['a', undefined],
            ['a', 1],
          ]),
        {
          name: 'Error',
          message: 'key(a) appears twice in struct',
        }
      );
      throws(
        () =>
          dict.encode([
            ['a', undefined],
            ['a', undefined],
          ]),
        {
          name: 'Error',
          message: 'key(a) appears twice in struct',
        }
      );
      for (const name of ['__proto__', 'constructor', 'prototype'])
        throws(() => dict.encode([[name, 1]]), {
          name: 'Error',
          message: `dict: key ${name} is reserved`,
        });
      throws(() => dict.encode([['a/b', 1]]), {
        name: 'TypeError',
        message: 'dict: key a/b cannot contain path separator /',
      });
      throws(() => dict.encode([['a..b', 1]]), {
        name: 'TypeError',
        message: 'dict: key a..b cannot contain path parent ..',
      });
      throws(() => dict.decode({ 'a/b': 1 }), {
        name: 'TypeError',
        message: 'dict: key a/b cannot contain path separator /',
      });
      throws(() => dict.decode({ 'a..b': 1 }), {
        name: 'TypeError',
        message: 'dict: key a..b cannot contain path parent ..',
      });
      throws(() => h.encode({ 'a/b': 1 } as any), {
        name: 'Error',
        message: 'Writer(): TypeError: dict: key a/b cannot contain path separator /',
      });
      throws(() => h.encode({ 'a..b': 1 } as any), {
        name: 'Error',
        message: 'Writer(): TypeError: dict: key a..b cannot contain path parent ..',
      });
      throws(
        () =>
          h.decode(
            coder.encode([
              ['a', 1],
              ['a', 2],
            ])
          ),
        {
          name: 'Error',
          message: 'Reader(): Error: key(a) appears twice in struct',
        }
      );
      throws(() => h.decode(coder.encode([['__proto__', 1]])), {
        name: 'Error',
        message: 'Reader(): Error: dict: key __proto__ is reserved',
      });
      throws(() => h.decode(coder.encode([['a/b', 1]])), {
        name: 'Error',
        message: 'Reader(): TypeError: dict: key a/b cannot contain path separator /',
      });
      throws(() => h.decode(coder.encode([['a..b', 1]])), {
        name: 'Error',
        message: 'Reader(): TypeError: dict: key a..b cannot contain path parent ..',
      });
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
    should('validator constructors', () => {
      throws(() => P.apply(123 as any, hex), {
        name: 'TypeError',
        message: 'apply: invalid inner value 123',
      });
      throws(() => P.apply(P.U8, 123 as any), {
        name: 'TypeError',
        message: 'apply: invalid base value 123',
      });
      throws(() => P.wrap(123 as any), {
        name: 'TypeError',
        message: 'wrap: invalid inner value 123',
      });
      throws(() => P.wrap({ decodeStream: () => 1 } as any), {
        name: 'TypeError',
        message: 'wrap: encodeStream should be function',
      });
      throws(() => P.wrap({ encodeStream: () => {} } as any), {
        name: 'TypeError',
        message: 'wrap: decodeStream should be function',
      });
      throws(() => P.wrap({ encodeStream: () => {}, decodeStream: () => 1, size: '1' } as any), {
        name: 'TypeError',
        message: 'wrap: invalid size 1',
      });
      throws(() => P.wrap({ encodeStream: () => {}, decodeStream: () => 1, validate: 0 } as any), {
        name: 'TypeError',
        message: 'wrap: validate should be function',
      });
      throws(() => P.validate(P.U8, 1 as any), TypeError);
      throws(() => P.U8.encode('x' as any), TypeError);
      throws(() => P.U8.encode(256), RangeError);
      throws(() => P.bool.encode(1 as any), TypeError);
      throws(() => P.bytes(1, 1 as any), TypeError);
      throws(() => P.bytes(null).encode('x' as any), TypeError);
    });
    should('constant size', () => {
      const constant = P.constant(123);
      const struct = P.struct({ a: constant, b: P.U8 });
      const tuple = P.tuple([constant, P.U8]);
      const array = P.array(2, constant);
      eql(
        {
          constantSize: constant.size,
          constantEncoded: constant.encode(123),
          structSize: struct.size,
          structEncoded: struct.encode({ a: 123, b: 7 }),
          tupleSize: tuple.size,
          tupleEncoded: tuple.encode([123, 7]),
          arraySize: array.size,
          arrayEncoded: array.encode([123, 123]),
        },
        {
          constantSize: 0,
          constantEncoded: Uint8Array.of(),
          structSize: 1,
          structEncoded: Uint8Array.of(7),
          tupleSize: 1,
          tupleEncoded: Uint8Array.of(7),
          arraySize: 0,
          arrayEncoded: Uint8Array.of(),
        }
      );
    });
    should('magic check flag', () => {
      const scalar = P.magic(P.U8, 1, false);
      const bytes = P.magic(P.bytes(2), Uint8Array.of(1, 2), false);
      const object = { a: 1 };
      const objectRef = P.magic(P.constant(object), object);
      const objectStruct = P.magic(P.struct({ a: P.U8 }), object);
      eql(
        {
          scalarDecoded: scalar.decode(Uint8Array.of(2)),
          scalarEncoded: scalar.encode(undefined),
          bytesDecoded: bytes.decode(Uint8Array.of(1, 3)),
          bytesEncoded: bytes.encode(undefined),
          objectRefDecoded: objectRef.decode(P.EMPTY),
          objectRefEncoded: objectRef.encode(undefined),
          objectStructDecoded: objectStruct.decode(Uint8Array.of(2)),
          objectStructEncoded: objectStruct.encode(undefined),
        },
        {
          scalarDecoded: undefined,
          scalarEncoded: Uint8Array.of(1),
          bytesDecoded: undefined,
          bytesEncoded: Uint8Array.of(1, 2),
          objectRefDecoded: undefined,
          objectRefEncoded: Uint8Array.of(),
          objectStructDecoded: undefined,
          objectStructEncoded: Uint8Array.of(1),
        }
      );
      throws(() => P.magic(P.U8, 1).decode(Uint8Array.of(2)), {
        name: 'Error',
        message: 'Reader(): magic: invalid value: 2 !== 1',
      });
      throws(() => P.magic(P.bytes(2), Uint8Array.of(1, 2)).decode(Uint8Array.of(1, 3)), {
        name: 'Error',
        message: 'Reader(): magic: invalid value: 1,3 !== 1,2',
      });
      throws(() => P.magic(P.U8 as any, object as any).decode(Uint8Array.of(7)), {
        name: 'Error',
        message: 'Reader(): magic: invalid value: 7 !== [object Object]',
      });
      throws(() => P.magic(P.constant(object) as any, 7 as any).decode(P.EMPTY), {
        name: 'Error',
        message: 'Reader(): magic: invalid value: [object Object] !== 7',
      });
    });
    should('constructor type errors', () => {
      const marker = Uint8Array.of(0, 1);
      throws(() => P.constant(123).encode(124), {
        name: 'TypeError',
        message: 'constant: invalid value 124 (exp: 123)',
      });
      throws(() => P.flag([1, 2, 3] as any), {
        name: 'TypeError',
        message: 'flag/flagValue: expected Uint8Array, got object',
      });
      throws(() => P.flag(Uint8Array.of(1), 1 as any), {
        name: 'TypeError',
        message: 'flag/xor: expected boolean, got number',
      });
      throws(() => P.flagged(123 as any, P.U8), {
        name: 'TypeError',
        message: 'flagged: wrong path=123',
      });
      throws(() => P.flagged('f', 123 as any), {
        name: 'TypeError',
        message: 'flagged: invalid inner value 123',
      });
      throws(() => P.lazy(123 as any), {
        name: 'TypeError',
        message: 'lazy: expected function, got number',
      });
      throws(() => P.magic(123 as any, 1), {
        name: 'TypeError',
        message: 'magic: invalid inner value 123',
      });
      throws(() => P.magic(P.U8, 1, 1 as any), {
        name: 'TypeError',
        message: 'magic: expected boolean, got number',
      });
      throws(() => P.magicBytes([1, 2] as any), {
        name: 'TypeError',
        message: 'magicBytes: expected Uint8Array or string, got object',
      });
      throws(() => P.magicBytes(123 as any), {
        name: 'TypeError',
        message: 'magicBytes: expected Uint8Array or string, got number',
      });
      throws(() => P.map(1 as any, { a: 1 }), {
        name: 'TypeError',
        message: 'map: invalid inner value 1',
      });
      throws(() => P.map(P.U8, 1 as any), {
        name: 'TypeError',
        message: 'map: variants should be plain object',
      });
      throws(() => P.mappedTag(1 as any, { one: [1, P.U8] }), {
        name: 'TypeError',
        message: 'mappedTag: invalid tag value 1',
      });
      throws(() => P.mappedTag(P.U8, 1 as any), {
        name: 'TypeError',
        message: 'mappedTag: variants should be plain object',
      });
      throws(() => P.optional(123 as any, P.U8), {
        name: 'TypeError',
        message: 'optional: invalid flag or inner value flag=123 inner=[object Object]',
      });
      throws(() => P.optional(P.flag(marker), 123 as any), {
        name: 'TypeError',
        message: 'optional: invalid flag or inner value flag=[object Object] inner=123',
      });
      throws(() => P.padLeft('x' as any, P.U8), {
        name: 'TypeError',
        message: 'padLeft: wrong blockSize=x',
      });
      throws(() => P.padLeft(1, 1 as any), {
        name: 'TypeError',
        message: 'padLeft: invalid inner value 1',
      });
      throws(() => P.padLeft(1, P.U8, 1 as any), {
        name: 'TypeError',
        message: 'padLeft: wrong padFn=number',
      });
      throws(() => P.padRight('x' as any, P.U8), {
        name: 'TypeError',
        message: 'padRight: wrong blockSize=x',
      });
      throws(() => P.padRight(1, 1 as any), {
        name: 'TypeError',
        message: 'padRight: invalid inner value 1',
      });
      throws(() => P.padRight(1, P.U8, 1 as any), {
        name: 'TypeError',
        message: 'padRight: wrong padFn=number',
      });
      throws(() => P.pointer(1 as any, P.U8), {
        name: 'TypeError',
        message: 'pointer: invalid ptr value 1',
      });
      throws(() => P.pointer(P.U8, 1 as any), {
        name: 'TypeError',
        message: 'pointer: invalid inner value 1',
      });
      throws(() => P.pointer(P.U8, P.U8, 1 as any), {
        name: 'TypeError',
        message: 'pointer/sized: expected boolean, got number',
      });
      throws(() => P.struct(123 as any), {
        name: 'TypeError',
        message: 'struct: expected plain object, got 123',
      });
      throws(() => P.struct({ a: 1 as any }), {
        name: 'TypeError',
        message: 'struct: field a is not CoderType',
      });
      throws(() => P.tag(1 as any, { 1: P.U8 }), {
        name: 'TypeError',
        message: 'tag: invalid tag value 1',
      });
      throws(() => P.tag(P.U8, 1 as any), {
        name: 'TypeError',
        message: 'tag: variants should be plain object',
      });
      throws(() => P.tuple(123 as any), {
        name: 'TypeError',
        message: 'Packed.Tuple: got number instead of array',
      });
      throws(() => P.tuple([P.U8, 1 as any]), {
        name: 'TypeError',
        message: 'tuple: field 1 is not CoderType',
      });
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
    eql(P.coders.numberBigint.encode(-9007199254740991n), -9007199254740991);
    throws(() => P.coders.numberBigint.encode(9007199254740992n), {
      name: 'Error',
      message: 'element bigger than MAX_SAFE_INTEGER=9007199254740992',
    });
    throws(() => P.coders.numberBigint.encode(-9007199254740992n), {
      name: 'Error',
      message: 'element smaller than MIN_SAFE_INTEGER=-9007199254740992',
    });
    throws(() => P.coders.numberBigint.encode(-9007199254740993n), {
      name: 'Error',
      message: 'element smaller than MIN_SAFE_INTEGER=-9007199254740993',
    });
    for (const inner of [P.I64BE, P.I64LE]) {
      const coder = P.apply(inner, P.coders.numberBigint);
      eql(coder.decode(inner.encode(-9007199254740991n)), -9007199254740991);
      throws(() => coder.decode(inner.encode(-9007199254740992n)), {
        name: 'Error',
        message: 'Reader(): Error: element smaller than MIN_SAFE_INTEGER=-9007199254740992',
      });
    }
  });

  should('tsEnum', () => {
    const Color = { 0: 'Red', 1: 'Green', Red: 0, Green: 1 };
    const base = P.coders.tsEnum(Color);
    const coder = P.apply(P.U8, base);
    eql(base.encode(0), 'Red');
    eql(base.decode('Green'), 1);
    eql(coder.encode('Green'), Uint8Array.of(1));
    eql(coder.decode(Uint8Array.of(0)), 'Red');
    for (const key of ['Missing', '0', 'constructor']) {
      throws(() => base.decode(key), {
        name: 'Error',
        message: `wrong value ${key}`,
      });
    }
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
      '-0.0',
      '-0.00',
    ];
    for (let i = 0; i < fail.length; i++) {
      let t = fail[i];
      throws(() => i64.encode(t), `index ${i}`);
    }
    const d5 = P.coders.decimal(5);
    eql(d5.encode(123n), '0.00123');
    eql(d5.encode(-123n), '-0.00123');
    const d0 = P.coders.decimal(0);
    throws(() => P.coders.decimal(-1), {
      name: 'Error',
      message: 'decimal/precision: wrong value -1',
    });
    throws(() => P.coders.decimal(-2), {
      name: 'Error',
      message: 'decimal/precision: wrong value -2',
    });
    eql(d0.encode(123n), '123');
    eql(d0.encode(-123n), '-123');
    eql(d0.decode('123.0'), 123n);
    throws(() => d0.decode('-0'));
    throws(() => d0.decode('-0.0'));
    throws(() => d0.decode('-0.00'));
    throws(() => d0.decode('123.1'));
    throws(() => d0.decode('1.1'));
  });

  should('reverse', () => {
    const coder = {
      n: 7,
      encode(v: number) {
        return this.n + v;
      },
      decode(v: number) {
        return this.n - v;
      },
    };
    const rev = P.coders.reverse(coder);
    eql(
      {
        origEncode: coder.encode(2),
        origDecode: coder.decode(2),
        revEncode: rev.encode(2),
        revDecode: rev.decode(2),
      },
      {
        origEncode: 9,
        origDecode: 5,
        revEncode: 5,
        revDecode: 9,
      }
    );
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
    const total = P.coders.match([P.coders.numberBigint, P.coders.dict<number>()]);
    eql(
      {
        encodeBigint: total.encode(5n),
        encodeDict: total.encode([
          ['a', 1],
          ['b', 2],
        ]),
        decodeNumber: total.decode(5),
        decodeDict: total.decode({ a: 1, b: 2 }),
      },
      {
        encodeBigint: 5,
        encodeDict: { a: 1, b: 2 },
        decodeNumber: 5n,
        decodeDict: [
          ['a', 1],
          ['b', 2],
        ],
      }
    );
    throws(() => total.encode('x' as any), {
      name: 'Error',
      message: 'match/encode: cannot find match in x',
    });
    throws(() => total.decode(true as any), {
      name: 'Error',
      message: 'match/decode: cannot find match in true',
    });
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
  should('numeric guards', () => {
    const malformed = {
      size: -1,
      encode: (value: number) => Uint8Array.of(value),
      decode: (bytes: Uint8Array) => bytes[0],
      encodeStream: (w: P.Writer, value: number) => w.byte(value),
      decodeStream: (r: P.Reader) => r.byte(),
    };
    eql(P.utils.isCoder(malformed), false);
    throws(() => P.validate(malformed as any, (value: number) => value), {
      name: 'TypeError',
      message: 'validate: invalid inner value [object Object]',
    });
    for (const bits of [0n, -8n])
      throws(() => P.utils.checkBounds(0n, bits, true), {
        name: 'Error',
        message: `checkBounds: signed bits must be positive, got ${bits}`,
      });
    eql(
      {
        zero: P._TEST._padLength(4, 0),
        partial: P._TEST._padLength(4, 3),
        aligned: P._TEST._padLength(4, 4),
        next: P._TEST._padLength(8, 15),
      },
      {
        zero: 0,
        partial: 1,
        aligned: 0,
        next: 1,
      }
    );
    throws(() => P._TEST._padLength(8, -1));
    throws(() => P._TEST._padLength(8, -8));
  });
  should('findBytes', () => {
    const find = P._TEST._findBytes;
    const repeated = Uint8Array.of(1, 1, 1, 2);
    eql(
      {
        single: find(Uint8Array.of(0), Uint8Array.of(1, 0, 2)),
        singleOffsetMiss: find(Uint8Array.of(0), Uint8Array.of(1, 0, 2), 2),
        multi: find(Uint8Array.of(2, 3), Uint8Array.of(1, 2, 3, 4)),
        repeatedPrefix: find(repeated, Uint8Array.of(1, 1, 1, 1, 2)),
        repeatedPrefixMiss: find(repeated, Uint8Array.of(1, 1, 1, 1, 1)),
        offset: find(Uint8Array.of(1, 2), Uint8Array.of(1, 2, 1, 2), 1),
        offsetMiss: find(Uint8Array.of(1, 2), Uint8Array.of(1, 2, 1, 2), 3),
        longerNeedle: find(Uint8Array.of(1, 2, 3), Uint8Array.of(1, 2)),
      },
      {
        single: 1,
        singleOffsetMiss: undefined,
        multi: 1,
        repeatedPrefix: 1,
        repeatedPrefixMiss: undefined,
        offset: 2,
        offsetMiss: undefined,
        longerNeedle: undefined,
      }
    );
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
      should('byte empty label', () => {
        throws(() => new Reader(Uint8Array.of()).byte(), {
          name: 'Error',
          message: 'Reader(): readByte: Unexpected end of buffer',
        });
        throws(() => P.bool.decode(Uint8Array.of()), {
          name: 'Error',
          message: 'Reader(): readByte: Unexpected end of buffer',
        });
      });
      should('invalid lengths', () => {
        for (const bits of [-1, 1.5]) {
          const r = new Reader(Uint8Array.of(0xff, 0));
          throws(() => r.bits(bits), {
            name: 'Error',
            message: `Reader(): BitReader: wrong length=${bits}`,
          });
          eql({ pos: r.pos, left: r.leftBytes }, { pos: 0, left: 2 });
        }
      });
      should('multiple read position', () => {
        const r = new Reader(Uint8Array.of(1, 2, 3, 4), {});
        r._enablePointers();
        r.markBytes(2);
        r.pos = 0;
        throws(() => r.markBytes(2), {
          name: 'Error',
          message: 'Reader(): multiple read pos=0 len=2',
        });
        eql(r.pos, 0);

        const s = P.struct({ p: P.pointer(P.U8, P.U8) });
        throws(() => s.decode(Uint8Array.of(0, 7)), {
          name: 'Error',
          message: 'Reader(p): multiple read pos=0 len=1',
        });
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
      for (const pos of [-2, 1.5])
        throws(() => r.find(new Uint8Array([0xfb, 0xfc]), pos), {
          name: 'Error',
          message: `Reader(): find: wrong pos=${pos}`,
        });
      const bits = new Reader(Uint8Array.of(0xff));
      bits.bits(1);
      throws(() => bits.find(Uint8Array.of(0xff)), {
        name: 'Error',
        message: 'Reader(): find: bitPos not empty',
      });
    });
    should('invalid lengths and offsets', () => {
      {
        const r = new Reader(Uint8Array.of(10, 11, 12));
        throws(() => r.absBytes(-1), {
          name: 'Error',
          message: 'Unexpected end of buffer',
        });
        eql(r.pos, 0);
      }
      {
        const r = new Reader(Uint8Array.of(10, 11, 12));
        throws(() => r.offsetReader(-1), {
          name: 'Error',
          message: 'Reader(): offsetReader: Unexpected end of buffer',
        });
        eql(r.pos, 0);
      }
      {
        const r = new Reader(Uint8Array.of(1, 2, 3));
        throws(() => r.bytes(-1), {
          name: 'Error',
          message: 'Reader(): readBytes: wrong length=-1',
        });
        eql(r.pos, 0);
      }
      {
        const r = new Reader(Uint8Array.of(1, 2, 3));
        let called = false;
        throws(
          () =>
            r.readView(-1, () => {
              called = true;
              return 0;
            }),
          {
            name: 'Error',
            message: 'Reader(): readView: wrong length=-1',
          }
        );
        eql({ called, pos: r.pos }, { called: false, pos: 0 });
      }
      throws(() => P.bytes(P.I8).decode(Uint8Array.of(0xff, 1, 2, 3), { allowUnreadBytes: true }), {
        name: 'Error',
        message: 'Reader(): Wrong length: -1',
      });
      throws(() => P.pointer(P.I8, P.U8).decode(Uint8Array.of(0xff, 7)), {
        name: 'Error',
        message: 'Reader(): offsetReader: Unexpected end of buffer',
      });
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
    should('bits: invalid input', () => {
      for (const [value, bits] of [
        [0, -1],
        [1, 1.5],
      ]) {
        const w = new Writer();
        throws(() => w.bits(value, bits));
        eql(
          { pos: w.pos, bitPos: (w as any).bitPos, bitBuf: (w as any).bitBuf },
          {
            pos: 0,
            bitPos: 0,
            bitBuf: 0,
          }
        );
      }
      const coder = P.wrap({
        encodeStream: (w, value: number) => w.bits(value, 8),
        decodeStream: (r) => r.bits(8),
      });
      for (const value of [-1, 1.5]) {
        const w = new Writer();
        throws(() => w.bits(value, 8));
        eql(w.pos, 0);
        throws(() => coder.encode(value));
      }
    });
    should('byte: invalid input', () => {
      const coder = P.wrap({
        encodeStream: (w, value: number) => w.byte(value),
        decodeStream: (r) => r.byte(),
      });
      for (const value of [256, -1, 1.5]) {
        const w = new Writer();
        throws(() => w.byte(value));
        eql(w.pos, 0);
        throws(() => coder.encode(value));
      }
    });
    should('error prefix and finished state', () => {
      const err = new Writer().err('boom');
      eql({ name: err.name, message: err.message }, { name: 'Error', message: 'Writer(): boom' });
      const coder = P.wrap({
        encodeStream: (w) => {
          throw w.err('leaf');
        },
        decodeStream: () => 0,
      });
      throws(() => coder.encode(1), {
        name: 'Error',
        message: 'Writer(): leaf',
      });
      const calls = [
        (w: InstanceType<typeof Writer>) => w.byte(1),
        (w: InstanceType<typeof Writer>) => w.bytes(Uint8Array.of(1)),
        (w: InstanceType<typeof Writer>) => w.bits(1, 1),
        (w: InstanceType<typeof Writer>) => w.writeView(1, () => {}),
        (w: InstanceType<typeof Writer>) => w.finish(),
      ];
      for (const call of calls) {
        const w = new Writer();
        w.finish();
        throws(() => call(w), {
          name: 'Error',
          message: 'Writer(): buffer: finished',
        });
      }
    });
    should('finish: clean owned buffers', () => {
      const byte = new Writer();
      byte.byte(0xaa);
      const byteRef = (byte as any).buffers[0];
      const byteOut = byte.finish();
      const bits = new Writer();
      bits.bits(0b10101010, 8);
      const bitsRef = (bits as any).buffers[0];
      const bitsOut = bits.finish();
      const view = new Writer();
      view.writeView(4, (v) => v.setUint32(0, 0x11223344, false));
      const viewRef = (view as any).buffers[0];
      const viewOut = view.finish();
      const ptr = new Writer();
      P.pointer(P.U8, P.bytes(2)).encodeStream(ptr, Uint8Array.of(7, 8));
      const ptrRef = (ptr as any).ptrs[0].buffer;
      const ptrOut = ptr.finish();
      const externalRef = Uint8Array.of(9, 8);
      const external = new Writer();
      external.bytes(externalRef);
      const externalOut = external.finish();
      eql(
        {
          out: [byteOut, bitsOut, viewOut, ptrOut, externalOut],
          refs: [
            Array.from(byteRef),
            Array.from(bitsRef),
            Array.from(viewRef),
            Array.from(ptrRef),
            Array.from(externalRef),
          ],
        },
        {
          out: [
            Uint8Array.of(0xaa),
            Uint8Array.of(0xaa),
            Uint8Array.of(0x11, 0x22, 0x33, 0x44),
            Uint8Array.of(1, 7, 8),
            Uint8Array.of(9, 8),
          ],
          refs: [[0], [0], [0, 0, 0, 0], [0, 0], [9, 8]],
        }
      );
    });
    should('writeView: invalid length', () => {
      const w = new Writer();
      let called = false;
      throws(
        () =>
          w.writeView(-1, (view) => {
            called = true;
            view.setUint32(0, 0x11223344, false);
          }),
        {
          name: 'Error',
          message: 'wrong writeView length=-1',
        }
      );
      eql({ called, pos: w.pos }, { called: false, pos: 0 });
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
    should('invalid numeric input', () => {
      const bs = bitset.create(10);
      throws(() => bitset.chunkLen(10, 5, -1));
      throws(() => bitset.setRange(bs, 10, 5, -1));
      eql(bitset.debug(bs), ['00000000000000000000000000000000']);
      eql(bitset.set(new Uint32Array(1), 1, 1, true), false);
      throws(() => bitset.indices(new Uint32Array(0), -1));
      throws(() => bitset.rangeDebug(new Uint32Array(0), -1));
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
    should('setRange zero length', () => {
      const LEN = 33;
      const initial = Uint32Array.of(0x80000000, 0x80000000);
      for (const pos of [0, 5, 32, 33]) {
        for (const allowRewrite of [true, false]) {
          const bs = Uint32Array.from(initial);
          eql(bitset.setRange(bs, LEN, pos, 0, allowRewrite), true);
          eql(bs, initial);
        }
      }
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
          const tmp = Uint32Array.from(bs);
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
      const boundary = bitset.create(33);
      eql(bitset.setRange(boundary, 33, 32, 1), true);
      eql(boundary, Uint32Array.of(0, 0x80000000));
      eql(bitset.setRange(boundary, 33, 28, 5, false), false);
      eql(boundary, Uint32Array.of(0, 0x80000000));
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
