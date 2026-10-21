#!/usr/bin/env node
/** Captures or checks instruction metadata against the already-built Java oracle. */
import { captureProbe } from '../units/run.mjs';
if (!['--check', '--update'].includes(process.argv[2])) throw new Error('Use --check or --update');
captureProbe({
  source: 'tests/oracle/instruction-units/InstructionProbe.java',
  className: 'mars.mips.instructions.InstructionProbe',
  golden: 'tests/oracle/instruction-units/golden.json',
  check: process.argv[2] === '--check',
  legacySources: [
    'mars/mips/instructions/Instruction.java',
    'mars/mips/instructions/BasicInstruction.java',
    'mars/mips/instructions/BasicInstructionFormat.java',
    'mars/mips/instructions/InstructionSet.java'
  ]
});
