import { should } from '@paulmillr/jsbt/test.js';
import { base64, hex } from '@scure/base';
import { deepStrictEqual as eql, throws } from 'node:assert';
import * as PD from '../src/debugger.ts';
import * as P from '../src/index.ts';

const testStruct = P.struct({
  a: P.U32LE,
  b: P.cstring,
  c: P.array(P.U8, P.U16BE),
});
const mute = <T>(fn: () => T): T => {
  const oldLog = console.log;
  console.log = () => {};
  try {
    return fn();
  } finally {
    console.log = oldLog;
  }
};
const capture = <T>(fn: () => T): { logs: string[]; value: T } => {
  const oldLog = console.log;
  const logs: string[] = [];
  console.log = (msg: string) => {
    logs.push(msg);
  };
  try {
    return { logs, value: fn() };
  } finally {
    console.log = oldLog;
  }
};

should('Basic', () => {
  const enc = testStruct.encode({ a: 1234, b: 'test', c: [1, 2, 3] });
  PD.decode(testStruct, enc);
});

should('Fail to decode', () => {
  const enc = testStruct.encode({ a: 1234, b: 'test', c: [1, 2, 3] });
  throws(() => PD.decode(testStruct, P.utils.concatBytes(enc, hex.decode('0102030405'))));
});

should('chrWidth tabs', () => {
  eql(PD._TESTS.chrWidth('\t\t'), PD._TESTS.chrWidth('    '));
  eql(PD._TESTS.chrWidth('a\tb\t'), PD._TESTS.chrWidth('a  b  '));
  const oldLog = console.log;
  const oldColumns = process.stdout.columns;
  let out = '';
  console.log = (msg: string) => {
    out = msg;
  };
  process.stdout.columns = 120;
  try {
    PD.table([
      { Key: '\t\t', Value: 'x' },
      { Key: '    ', Value: 'y' },
    ]);
  } finally {
    console.log = oldLog;
    process.stdout.columns = oldColumns;
  }
  const e = '\x1b';
  const bar = String.fromCharCode(0x2502);
  const line = String.fromCharCode(0x2500);
  const cross = String.fromCharCode(0x253c);
  const bottom = String.fromCharCode(0x2534);
  const gray = `${e}[90m`;
  const reset = `${e}[0m`;
  const bold = `${e}[1m`;
  const mid = `${line.repeat(6)}${cross}${line.repeat(7)}`;
  const end = `${line.repeat(6)}${bottom}${line.repeat(7)}`;
  eql(
    out,
    [
      ` ${bold}Key  ${reset}${gray}${bar}${reset} ${bold}Value${reset}`,
      `${reset}${gray}${mid}${reset}`,
      ` \t\t ${reset}${gray}${bar}${reset} x     `,
      `${reset}${gray}${mid}${reset}`,
      `      ${reset}${gray}${bar}${reset} y     `,
      `${reset}${gray}${end}${reset}`,
    ].join('\n')
  );
});

should('primitive debug map', () => {
  eql(
    mute(() => ({
      bool: PD.decode(P.bool, Uint8Array.of(1), true),
      u8: PD.decode(P.U8, Uint8Array.of(1), true),
      u16: PD.decode(P.U16BE, Uint8Array.of(1, 2), true),
      zero: PD.decode(P.constant(123), Uint8Array.of(), true),
    })),
    { bool: true, u8: 1, u16: 258, zero: 123 }
  );
  eql(
    mute(() => {
      PD.diff(P.U8, Uint8Array.of(1), Uint8Array.of(1), false);
      PD.diff(P.bool, Uint8Array.of(0), Uint8Array.of(1));
      return 'ok';
    }),
    'ok'
  );
});

should('diff empty result', () => {
  const coder = P.struct({ a: P.U8 });
  eql(
    mute(() => {
      PD.diff(P.U8, Uint8Array.of(1), Uint8Array.of(1));
      PD.diff(coder, Uint8Array.of(1), Uint8Array.of(1));
      PD.diff(coder, Uint8Array.of(1), Uint8Array.of(1), true);
      return 'ok';
    }),
    'ok'
  );
});

should('string bytes prefer lowercase hex', () => {
  const lower = hex.decode('cafebabe');
  eql(PD.decode(P.bytes(null), 'cafebabe'), lower);
  eql(
    capture(() => {
      PD.diff(P.bytes(null), 'cafebabe', lower);
      return 'ok';
    }),
    { logs: ['==== DIFF ====', '==== /DIFF ===='], value: 'ok' }
  );
  eql(PD.decode(P.bytes(null), 'CAFEBABE'), base64.decode('CAFEBABE'));
});

should('wrap unknown columns', () => {
  const oldColumns = process.stdout.columns;
  process.stdout.columns = undefined;
  try {
    const e = '\x1b';
    const line = String.fromCharCode(0x2500);
    const gray = `${e}[90m`;
    const reset = `${e}[0m`;
    const bold = `${e}[1m`;
    eql(
      capture(() => {
        PD.table([{ A: 'abc' }]);
        return 'ok';
      }),
      {
        logs: [
          [
            ` ${bold}A  ${reset}`,
            `${reset}${gray}${line.repeat(5)}${reset}`,
            ' abc ',
            `${reset}${gray}${line.repeat(5)}${reset}`,
          ].join('\n'),
        ],
        value: 'ok',
      }
    );
  } finally {
    process.stdout.columns = oldColumns;
  }
});

should('PSBT1', () => {
  const CASE1 =
    'cHNidP8BAJoCAAAAAljoeiG1ba8MI76OcHBFbDNvfLqlyHV5JPVFiHuyq911AAAAAAD/////g40EJ9DsZQpoqka7CwmK6kQiwHGyyng1Kgd5WdB86h0BAAAAAP////8CcKrwCAAAAAAWABTYXCtx0AYLCcmIauuBXlCZHdoSTQDh9QUAAAAAFgAUAK6pouXw+HaliN9VRuh0LR2HAI8AAAAAAAEAuwIAAAABqtc5MQGL0l+ErkALaISL4J23BurCrBgpi6vucatlb4sAAAAASEcwRAIgWPb8fGoz4bMVSNSByCbAFb0wE1qtQs1neQ2rZtKtJDsCIEoc7SYExnNbY5PltBaR3XiwDwxZQvufdRhW+qk4FX26Af7///8CgPD6AgAAAAAXqRQPuUY0IWlrgsgzryQceMF9295JNIfQ8gonAQAAABepFCnKdPigj4GZlCgYXJe12FLkBj9hh2UAAAAiAgKVg785rgpgl0etGZrd1jT6YQhVnWxc05tMIYPxq5bgf0cwRAIgdAGK1BgAl7hzMjwAFXILNoTMgSOJEEjn282bVa1nnJkCIHPTabdA4+tT3O+jOCPIBwUUylWn3ZVE8VfBZ5EyYRGMASICAtq2H/SaFNtqfQKwzR+7ePxLGDErW05U2uTbovv+9TbXRzBEAiBjGpif5zipKtAZhgIzEsGSFP4oArOeXLwaw2eIBsaSwwIgOdtsOHvSZ3Ft/bPU2NpQuOhdITMmunx9qqTAzkHrkiMBAQMEAQAAAAEER1IhApWDvzmuCmCXR60Zmt3WNPphCFWdbFzTm0whg/GrluB/IQLath/0mhTban0CsM0fu3j8SxgxK1tOVNrk26L7/vU211KuIgYClYO/Oa4KYJdHrRma3dY0+mEIVZ1sXNObTCGD8auW4H8Q2QxqTwAAAIAAAACAAAAAgCIGAtq2H/SaFNtqfQKwzR+7ePxLGDErW05U2uTbovv+9TbXENkMak8AAACAAAAAgAEAAIAAAQEgAMLrCwAAAAAXqRS39fr0Dj1ApaRZsds1NfK3L6kh6IciAgI63ZBPPW3PWd25BrDe4jUpt/+57VDl6GFRkmhgIh8Oc0cwRAIgZfRbpZmLWaJ//hp77QFq8fH5DVSzqo90UKpfVqJRA70CIH9yRwOtHtuWaAsoS1bU/8uI9/t1nqu+CKow8puFE4PSASICAwidwQx6xttU+RMpr2FzM9s4jOrQwjH3IzedG5kDCwLcRzBEAiBi63pVYQenxz9FrEq1od3fb3B1+xJ1lpp/OD7/94S8sgIgDAXbt0cNvy8IVX3TVscyXB7TCRPpls04QJRdsSIo2l8BAQMEAQAAAAEEIgAgjCNTFzdDtZXftKB7crqOQuN5fadOh/59nXSX47ICiQMBBUdSIQMIncEMesbbVPkTKa9hczPbOIzq0MIx9yM3nRuZAwsC3CECOt2QTz1tz1nduQaw3uI1Kbf/ue1Q5ehhUZJoYCIfDnNSriIGAjrdkE89bc9Z3bkGsN7iNSm3/7ntUOXoYVGSaGAiHw5zENkMak8AAACAAAAAgAMAAIAiBgMIncEMesbbVPkTKa9hczPbOIzq0MIx9yM3nRuZAwsC3BDZDGpPAAAAgAAAAIACAACAACICA6mkw39ZltOqJdusa1cK8GUDlEkpQkYLNUdT7Z7spYdxENkMak8AAACAAAAAgAQAAIAAIgICf2OZdX0u/1WhNq0CxoSxg4tlVuXxtrNCgqlLa1AFEJYQ2QxqTwAAAIAAAACABQAAgAA=';
  const CASE2 =
    'cHNidP8BAJoCAAAAAljoeiG1ba8MI76OcHBFbDNvfLqlyHV5JPVFiHuyq911AAAAAAD/////g40EJ9DsZQpoqka7CwmK6kQiwHGyyng1Kgd5WdB86h0BAAAAAP////8CcKrwCAAAAAAWABTYXCtx0AYLCcmIauuBXlCZHdoSTQDh9QUAAAAAFgAUAK6pouXw+HaliN9VRuh0LR2HAI8AAAAAAAEAuwIAAAABqtc5MQGL0l+ErkALaISL4J23BurCrBgpi6vucatlb4sAAAAASEcwRAIgWPb8fGoz4bMVSNSByCbAFb0wE1qtQs1neQ2rZtKtJDsCIEoc7SYExnNbY5PltBaR3XiwDwxZQvufdRhW+qk4FX26Af7///8CgPD6AgAAAAAXqRQPuUY0IWlrgsgzryQceMF9295JNIfQ8gonAQAAABepFCnKdPigj4GZlCgYXJe12FLkBj9hh2UAAAAiAgKVg785rgpgl0etGZrd1jT6YQhVnWxc05tMIYPxq5bgf0cwRAIgdAGK1BgAl7hzMjwAFXILNoTMgSOJEEjn282bVa1nnJkCIHPTabdA4+tT3O+jOCPIBwUUylWn3ZVE8VfBZ5EyYRGMASICAtq2H/SaFNtqfQKwzR+7ePxLGDErW05U2uTbovv+9TbXRzBEAiBjGpif5zipKtAZhgIzEsGSFP4oArOeXLwaw2eIBsaSwwIgOdtsOHvSZ3Ft/bPU2NpQuOhdITMmunx9qqTAzkHrkiMBAQMEAQAAAAEER1IhApWDvzmuCmCXR60Zmt3WNPphCFWdbFzTm0whg/GrluB/IQLath/0mhTban0CsM0fu3j8SxgxK1tOVNrk26L7/vU211KuIgYClYO/Oa4KYJdHrRma3dY0+mEIVZ1sXNObTCGD8auW4H8Q2QxqTwAAAIAAAACAAAAAgCIGAtq2H/SaFNtqfQKwzR+7ePxLGDErW05U2uTbovv+9TbXENkMak8AAACAAAAAgAEAAIAAAQEgAMLrCwAAAAAXqRS39fr0Dj1ApaRZsds1NfK3L6kh6IciAgMIncEMesbbVPkTKa9hczPbOIzq0MIx9yM3nRuZAwsC3EcwRAIgYut6VWEHp8c/RaxKtaHd329wdfsSdZaafzg+//eEvLICIAwF27dHDb8vCFV901bHMlwe0wkT6ZbNOECUXbEiKNpfASICAjrdkE89bc9Z3bkGsN7iNSm3/7ntUOXoYVGSaGAiHw5zRzBEAiBl9FulmYtZon/+GnvtAWrx8fkNVLOqj3RQql9WolEDvQIgf3JHA60e25ZoCyhLVtT/y4j3+3Weq74IqjDym4UTg9IBAQMEAQAAAAEEIgAgjCNTFzdDtZXftKB7crqOQuN5fadOh/59nXSX47ICiQMBBUdSIQMIncEMesbbVPkTKa9hczPbOIzq0MIx9yM3nRuZAwsC3CECOt2QTz1tz1nduQaw3uI1Kbf/ue1Q5ehhUZJoYCIfDnNSriIGAjrdkE89bc9Z3bkGsN7iNSm3/7ntUOXoYVGSaGAiHw5zENkMak8AAACAAAAAgAMAAIAiBgMIncEMesbbVPkTKa9hczPbOIzq0MIx9yM3nRuZAwsC3BDZDGpPAAAAgAAAAIACAACAACICA6mkw39ZltOqJdusa1cK8GUDlEkpQkYLNUdT7Z7spYdxENkMak8AAACAAAAAgAQAAIAAIgICf2OZdX0u/1WhNq0CxoSxg4tlVuXxtrNCgqlLa1AFEJYQ2QxqTwAAAIAAAACABQAAgAA=';

  // BTC specific variable length integer encoding
  // https://en.bitcoin.it/wiki/Protocol_documentation#Variable_length_integer
  const CSLimits = {
    0xfd: [0xfd, 2, 253n, 65535n],
    0xfe: [0xfe, 4, 65536n, 4294967295n],
    0xff: [0xff, 8, 4294967296n, 18446744073709551615n],
  };
  const CompactSize = P.wrap({
    encodeStream: (w, value) => {
      if (typeof value === 'number') value = BigInt(value);
      if (0n <= value && value <= 252n) return w.byte(Number(value));
      for (const [flag, bytes, start, stop] of Object.values(CSLimits)) {
        if (start > value || value > stop) continue;
        w.byte(flag);
        for (let i = 0; i < bytes; i++) w.byte(Number((value >> (8n * BigInt(i))) & 0xffn));
        return;
      }
      throw w.err(`VarInt too big: ${value}`);
    },
    decodeStream: (r) => {
      const b0 = r.byte();
      if (b0 <= 0xfc) return BigInt(b0);
      const [_, bytes, start] = CSLimits[b0];
      let num = 0n;
      for (let i = 0; i < bytes; i++) num |= BigInt(r.byte()) << (8n * BigInt(i));
      if (num < start) throw r.err(`Wrong CompactSize(${8 * bytes})`);
      return num;
    },
  });
  const CompactSizeLen = P.apply(CompactSize, P.coders.numberBigint);
  const PKey = P.struct({ type: CompactSizeLen, data: P.bytes(null) });
  const PSBTKeyPair = P.array(
    P.NULL,
    P.struct({
      //  <key> := <keylen> <keytype> <keydata> WHERE keylen = len(keytype)+len(keydata)
      key: P.prefix(CompactSizeLen, PKey),
      //  <value> := <valuelen> <valuedata>
      value: P.bytes(CompactSizeLen),
    })
  );
  const _DebugPSBT = P.struct({
    magic: P.magic(P.string(new Uint8Array([0xff])), 'psbt'),
    items: P.array(null, PSBTKeyPair),
  });
  PD.decode(_DebugPSBT, CASE1, true);
  PD.diff(_DebugPSBT, CASE1, CASE2);
  const C1 = '220203089dc10c7ac6db54f91329af617333db388cead0c231f723379d1b99030b02dc';
  const C2 = '2202023add904f3d6dcf59ddb906b0dee23529b7ffb9ed50e5e86151926860221f0e73';
  PD.diff(PKey, C1, C2);
});

// TODO:
// P.array(null, P.U16) -> bad error, hard to debug
should.runWhen(import.meta.url);
