import { should } from 'micro-should';
import './debugger.test.ts';
import './packed.test.ts';

should.runWhen(import.meta.url);
