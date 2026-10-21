/** Capture or check canonical GUI argument tokenization and runtime stack initialization. */
import { captureProbe } from '../units/run.mjs';
if (!['--check', '--update'].includes(process.argv[2])) throw new Error('Use --check or --update');
captureProbe({
  source: 'tests/oracle/program-arguments-units/ProgramArgumentsProbe.java',
  className: 'ProgramArgumentsProbe',
  golden: 'tests/oracle/program-arguments-units/golden.json',
  check: process.argv[2] === '--check',
  legacySources: [
    'mars/simulator/ProgramArgumentList.java',
    'mars/mips/hardware/Memory.java',
    'mars/mips/hardware/MemoryConfigurations.java',
    'mars/mips/hardware/RegisterFile.java',
    'mars/venus/RunGoAction.java',
    'mars/venus/RunStepAction.java'
  ]
});
captureProbe({
  source: 'tests/oracle/program-arguments-units/ProgramArgumentsFailureProbe.java',
  className: 'ProgramArgumentsFailureProbe',
  golden: 'tests/oracle/program-arguments-units/failure.json',
  check: process.argv[2] === '--check',
  legacySources: ['mars/simulator/ProgramArgumentList.java', 'mars/mips/hardware/Memory.java']
});
