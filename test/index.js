import { should } from "micro-should";
import './packed.test.js';
import './debugger.test.js';

should.runWhen(import.meta.url);
