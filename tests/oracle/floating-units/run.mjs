import { captureProbe } from '../units/run.mjs';
captureProbe({
  source: 'tests/oracle/floating-units/FloatingProbe.java',
  className: 'FloatingProbe',
  golden: 'tests/oracle/floating-units/golden.json',
  check: process.argv.includes('--check')
});
