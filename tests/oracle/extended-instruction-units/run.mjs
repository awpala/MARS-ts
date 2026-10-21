/** Capture/check original pseudo-instruction descriptors and expansion algorithms. */
import { captureProbe } from '../units/run.mjs';
if (!['--check', '--update'].includes(process.argv[2])) throw new Error('Use --check or --update');
captureProbe({
  source: 'tests/oracle/extended-instruction-units/ExtendedInstructionProbe.java',
  className: 'ExtendedInstructionProbe',
  golden: 'tests/oracle/extended-instruction-units/golden.json',
  check: process.argv[2] === '--check',
  legacySources: [
    'mars/mips/instructions/ExtendedInstruction.java',
    'mars/mips/instructions/Instruction.java',
    'PseudoOps.txt',
    'mars/assembler/SymbolTable.java',
    'mars/util/Binary.java'
  ]
});
