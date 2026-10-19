/** Capture/check complete assembly, source diagnostics, symbols, and data writes. */
import { readdirSync } from 'node:fs';
import { captureProbe } from '../units/run.mjs';
if (!['--check', '--update'].includes(process.argv[2])) throw new Error('Use --check or --update');
captureProbe({source:'tests/oracle/assembler-programs/AssemblerProgramProbe.java',className:'AssemblerProgramProbe',golden:'tests/oracle/assembler-programs/golden.json',check:process.argv[2]==='--check',legacySources:['mars/assembler/Assembler.java','mars/MIPSprogram.java','mars/ProgramStatement.java',...readdirSync('tests/oracle/programs').map(name=>'tests/oracle/programs/'+name)]});
