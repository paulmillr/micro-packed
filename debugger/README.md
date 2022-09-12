# micro-packed-debugger

> Console debugging utilities for micro-packed

Allows you to retain a bit more sanity when debugging.

## Usage

`> npm i micro-packed-debugger`

### Decode

```ts
import * as PD from 'micro-packed-debugger';

PD.decode(<coder>, data);
```

![Decode](./screens/decode.png)

### Diff

```ts
import * as PD from 'micro-packed-debugger';

PD.diff(<coder>, actual, expected);
```

![Diff](./screens/diff.png)

## License

MIT (c) Paul Miller [(https://paulmillr.com)](https://paulmillr.com), see LICENSE file.
