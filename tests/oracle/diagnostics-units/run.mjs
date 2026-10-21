#!/usr/bin/env node
/** Captures or checks diagnostics against the existing isolated Java oracle build. */
import { captureProbe } from '../units/run.mjs';
if (!['--check', '--update'].includes(process.argv[2])) throw new Error('Use --check or --update');
captureProbe({
  source: 'tests/oracle/diagnostics-units/DiagnosticsProbe.java',
  className: 'DiagnosticsProbe',
  golden: 'tests/oracle/diagnostics-units/golden.json',
  check: process.argv[2] === '--check',
  legacySources: [
    'mars/ErrorMessage.java',
    'mars/ErrorList.java',
    'mars/ProcessingException.java',
    'mars/Globals.java',
    'Config.properties'
  ]
});
