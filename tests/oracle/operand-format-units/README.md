# Operand format oracle

`OperandFormatProbe.java` invokes the package-visible methods in the unchanged `mars.assembler.OperandFormat` class. Cases cover every token-category pair with register-name restrictions enabled and disabled, signed/unsigned integer overlap boundaries, every actual instruction specification, operand-count diagnostics, operator-to-label token mutation, and ordered overload selection. The probe initializes original descriptor example tokens through the original protected method using reflection; it does not replace tokenization or operand checks.

Run `node tests/oracle/operand-format-units/run.mjs --update` after `build-legacy` to regenerate `golden.json`; use `--check` to compare without changes. The shared runner records exact command, streams, exit status, JDK major, probe hash, and immutable legacy input digest. `tests/assembler-operands.test.ts` compares TypeScript validation, diagnostics, mutated tokens, and overload selection against those generated results. This verifies operand matching without claiming complete assembler integration.

The translated algorithms are copyright Pete Sanderson and Kenneth Vollmar under the MIT license; see [MARSlicense.txt](../../../MARSlicense.txt).
