import { describe, should } from 'micro-should';
import { deepStrictEqual } from 'node:assert';
import * as P from '../src/index.ts';

const KB = 1024;
const MB = 1024 * KB;
const GB = 1024 * MB;

describe('slow', () => {
  should('5gb', () => {
    const ptr = P.apply(P.U64LE, P.coders.numberBigint);
    const complex = P.struct({
      a: P.U16BE,
      b: P.pointer(ptr, P.U8),
    });

    const complexArr = P.array(ptr, complex);
    // 10M bigints crashing node
    const elm = {
      a: 1234,
      b: 3,
      //b: [3, 4],
    };
    const arrSmall = [elm];
    deepStrictEqual(complexArr.decode(complexArr.encode(arrSmall)), arrSmall);
    const arrMedium = new Array(100).fill(elm);
    deepStrictEqual(complexArr.decode(complexArr.encode(arrMedium)), arrMedium);
    // this creates 100M js objects which is not re-used and causes OOM
    // const arrBig = new Array(100 * MB).fill(elm);
    // console.log('PRE ENCODE');
    // const encoded = complexArr.encode(arrBig);
    // console.log('T', encoded.length / MB);
    // deepStrictEqual(complexArr.decode(encoded), arrBig);
    const Bitset = P._TEST._bitset;
    const LEN = 9 * 5 * GB;
    const bs = Bitset.create(9 * 5 * GB);
    Bitset.setRange(bs, LEN, 0, 1024);
    deepStrictEqual(Bitset.rangeDebug(bs, LEN), '[(0/1024)]');
    Bitset.setRange(bs, LEN, 0, 9 * 5 * GB);
    for (const i of bs) deepStrictEqual(i, Bitset.FULL_MASK);
    // Kinda works, but unclear
  });
});

should.runWhen(import.meta.url);
