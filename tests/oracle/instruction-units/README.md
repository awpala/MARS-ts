# Instruction descriptor probe

The probe reads every `BasicInstruction` from the canonical Java instruction set and captures its example, description, operation mask, format, opcode mask/match, width, mnemonic, and tokenized example values/types. It also constructs the legacy no-description overload. Text fields use UTF-8 Base64 to preserve tabs and newlines without changing the records.

Run `build-legacy`, then `node tests/oracle/instruction-units/run.mjs --update` to capture or `--check` to compare. The shared method-probe runner enforces JDK 21 and an up-to-date Java build, isolates preferences, and records canonical source hashes. Vitest consumes `golden.json` without Java. This probe establishes descriptor behavior only; it does not execute instructions or establish whole-program parity.
