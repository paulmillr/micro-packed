import { mark, compare, utils as butils } from 'micro-bmark';
import * as P from 'micro-packed';

const SAMPLES = 1000;

const BUF = new Array(10_000).fill(5);
const oU32LE = P.int(4, true, false, true);
const STRUCTS = {
  complex: {
    coder: P.struct({
      data: P.array(P.U16BE, P.U8),
      customField: P.cstring,
      deep: P.struct({
        test: P.cstring,
        test2: P.U32BE,
      }),
    }),
    value: {
      data: [1, 2, 3, 4, 5],
      customField: 'test',
      deep: { test: 'tmp', test2: 12354 },
    },
  },
  oldInts: { coder: P.array(oU32LE, oU32LE), value: BUF },
  ints: { coder: P.array(P.U32LE, P.U32LE), value: BUF },
  floats32: { coder: P.array(P.U32LE, P.F32LE), value: BUF },
  floats64: { coder: P.array(P.U32LE, P.F64LE), value: BUF },
};

export async function main() {
  const encoded = P.U8.encode(5);
  await mark('basic encode', 10_000_000, () => P.U8.encode(5));
  await mark('basic decode', 10_000_000, () => P.U8.decode(encoded));
  for (let [name, { coder, value }] of Object.entries(STRUCTS)) {
    const encoded = coder.encode(value);
    await compare(name, name === 'complex' ? 1_000_000 : SAMPLES, {
      encode: () => coder.encode(value),
      decode: () => coder.decode(encoded),
    });
  }
  // Log current RAM
  butils.logMem();
}

// ESM is broken.
import url from 'url';
if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  main();
}
