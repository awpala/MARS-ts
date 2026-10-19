/** Capture/check Tokenizer observations against the already-built immutable Java oracle. */
import { captureProbe } from '../units/run.mjs';

captureProbe({
  source: 'tests/oracle/tokenizer-units/TokenizerProbe.java',
  className: 'TokenizerProbe',
  golden: 'tests/oracle/tokenizer-units/golden.json',
  check: process.argv.includes('--check'),
  legacySources: [
    'mars/assembler/Tokenizer.java', 'mars/assembler/TokenTypes.java',
    'mars/assembler/Token.java', 'mars/assembler/TokenList.java',
    'mars/assembler/SourceLine.java', 'mars/assembler/Directives.java',
    'mars/MIPSprogram.java', 'mars/ErrorMessage.java', 'mars/ErrorList.java',
    'tests/oracle/tokenizer-units/inputs/main.asm',
    'tests/oracle/tokenizer-units/inputs/nested/one.inc',
    'tests/oracle/tokenizer-units/inputs/nested/two.inc',
    'tests/oracle/tokenizer-units/inputs/duplicate.asm',
    'tests/oracle/tokenizer-units/inputs/recursive.asm',
    'tests/oracle/tokenizer-units/inputs/missing.asm',
    'tests/oracle/tokenizer-units/inputs/bad.inc',
    'tests/oracle/tokenizer-units/inputs/include-errors.asm',
    'tests/oracle/tokenizer-units/inputs/include-trailing.asm',
  ],
});
