/** Capture/check automatic handler workflow observations against the immutable Java oracle. */
import { captureProbe } from '../units/run.mjs';
if (!['--check', '--update'].includes(process.argv[2])) throw new Error('Use --check or --update');
captureProbe({
  source: 'tests/oracle/exception-handler/ExceptionHandlerProbe.java',
  className: 'ExceptionHandlerProbe',
  golden: 'tests/oracle/exception-handler/golden.json',
  check: process.argv[2] === '--check',
  legacySources: [
    'mars/venus/RunAssembleAction.java',
    'mars/venus/SettingsExceptionHandlerAction.java',
    'mars/MIPSprogram.java',
    'mars/Settings.java',
    'tests/oracle/exception-handler/sources/lead.asm',
    'tests/oracle/exception-handler/sources/handler.asm'
  ]
});
