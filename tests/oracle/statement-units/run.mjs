import { captureProbe } from '../units/run.mjs';
captureProbe({
  source: 'tests/oracle/statement-units/StatementProbe.java',
  className: 'StatementProbe',
  golden: 'tests/oracle/statement-units/golden.json',
  check: process.argv.includes('--check'),
  legacySources: [
    'mars/ProgramStatement.java',
    'mars/mips/instructions/InstructionSet.java',
    'mars/mips/instructions/BasicInstruction.java'
  ]
});
