# Changelog for micro-packed

## 0.11.1 (2026-08-29)

- Update scure-base to 2.4

## 0.11.0 (2026-08-08)

- Update scure-base to 2.3

## 0.10.2 (2026-07-21)

Re-publishing failed 0.10.x (we're debugging trusted publishing via github):

- Implement chunked writer: 3.8x speed-up for `array(10k×U32LE).encode`, 28% for `array-of-structs`, 61% for `U64LE.encode`, 42% for `cstring.encode`, 15% for `U32LE.encode`
- Harden primitives: use strict validation

## 0.10.1 (2026-07-20)

Re-publishing failed 0.10.0:

- Implement chunked writer: 3.8x speed-up for `array(10k×U32LE).encode`, 28% for `array-of-structs`, 61% for `U64LE.encode`, 42% for `cstring.encode`, 15% for `U32LE.encode`
- Harden primitives: use strict validation

## 0.10.0 (2026-07-20)

- Implement chunked writer: 3.8x speed-up for `array(10k×U32LE).encode`, 28% for `array-of-structs`, 61% for `U64LE.encode`, 42% for `cstring.encode`, 15% for `U32LE.encode`
- Harden primitives: use strict validation

## 0.9.0 (2026-04-28)

- **April 2026 self-audit** (all files): no major issues found
  - Audited for security
  - Hardened all the loose bits
- Fix all Byte Array types, to ensure proper work in both TypeScript 5.6 & TypeScript 5.9+
  - TS 5.6 has `Uint8Array`, while TS 5.9+ made it generic `Uint8Array<ArrayBuffer>`
  - This creates incompatibility of code between versions
  - Previously, it was hard to use and constantly emitted errors similar to `TS2345`
  - See [typescript#62240](https://github.com/microsoft/TypeScript/issues/62240) for more context
- Fix compilation issues on TypeScript v6

## 0.8.0 (2025-08-25)

- The package is now ESM-only. ESM can finally be loaded from common.js on node v20.19+
  - Node v20.19 is now the minimum required version
  - Package imports now work correctly in bundler-less environments, such as browsers

## 0.7.3 (2025-04-24)

- Bump devdeps and typescript compiler version to 5.8
- Typescript source can now be used without compilation in node.js v24, due to [erasableSyntaxOnly](https://devblogs.microsoft.com/typescript/announcing-typescript-5-8/#the---erasablesyntaxonly-option)
- Single-file build is now available

## 0.7.2 (2025-01-18)

- Use typescript verbatimModuleSyntax to support future node.js type stripping

## 0.7.1 (2025-01-07)

- Publish [to jsr](https://jsr.io/@paulmillr/micro-packed)
- Use typescript isolatedDeclarations.

## 0.7.0 (2024-11-23)

- Speed-up hex check
- Make package sideEffects: false
- Rename some methods to be minifier-friendly
- Remove unnecessary PURE annotation. Closes gh-10
- Update scure-base to 1.2.1

## 0.6.3 (2024-05-22)

Fix stack overflow

## 0.6.2 (2024-05-16)

- Export `utils.checkBounds`
- Fix type of `hex`

## 0.6.1 (2024-05-16)

- Remove unnecessary dependency that is just devDependency

## 0.6.0 (2024-05-16)

Rewrite module. Add many safety checks and massively upgrade documentation.

- Move concatBytes and isBytes to `utils`
- Rename coders.number to coders.numberBigint
- Remove bytesFormatted coder
- Remove base64armor coder

## 0.5.3 (2024-03-14)

Tree-shaking improvements.

## 0.5.2 (2024-02-10)

- Add reverse coder, sized ints, fix bigint behavior
- concatBytes, isBytes: copy new versions from noble

## 0.5.1 (2024-01-09)

Improve security. Add bitsets. Add opts allowUnreadBytes, allowMultipleReads

## 0.5.0 (2024-01-05)

- Switch to hybrid common.js-ESM package.
- Integrate debugger, in separate file `micro-packed/debugger`.
- Fix `sizeof`

## 0.4.0 (2023-12-11)

- Improve tree-shaking support
- Export missing types
- Bump scure-base and typescript used to build the package

## 0.3.2 (2023-02-02)

- Fixes broken type definition. by @MicahZoltu in https://github.com/paulmillr/micro-packed/pull/4

## 0.3.1 (2023-02-02)

Improve debugging

## 0.3.0 (2022-08-25)

New primitives: Array, Bytes, String, Lazy, Dict, Validate, Debug

## 0.2.0 (2022-07-17)

- Drop common.js support, only ESM is now supported
- Add declaration maps for simple debugging

## 0.1.0 (2022-06-20)

Initial release
