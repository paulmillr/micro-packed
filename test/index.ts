import { should } from '@paulmillr/jsbt/test.js';
import './debugger.test.ts';
import './packed.test.ts';
import './utils.test.ts';

should.runWhen(import.meta.url);
