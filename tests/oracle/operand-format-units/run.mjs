/** Capture/check canonical operand validation against the immutable Java oracle. */
import { captureProbe } from '../units/run.mjs';
if (!['--check', '--update'].includes(process.argv[2])) throw new Error('Use --check or --update');
captureProbe({source:'tests/oracle/operand-format-units/OperandFormatProbe.java',className:'mars.assembler.OperandFormatProbe',golden:'tests/oracle/operand-format-units/golden.json',check:process.argv[2]==='--check',legacySources:['mars/assembler/OperandFormat.java','mars/assembler/TokenTypes.java','mars/assembler/DataTypes.java','mars/mips/instructions/InstructionSet.java']});
