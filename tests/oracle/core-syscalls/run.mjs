#!/usr/bin/env node
/** Capture/check deterministic core syscall behavior with isolated Java input and output. */
import { captureProbe } from '../units/run.mjs';
const names = [
  'PrintInt',
  'PrintFloat',
  'PrintDouble',
  'PrintString',
  'ReadInt',
  'ReadFloat',
  'ReadDouble',
  'ReadString',
  'Sbrk',
  'Exit',
  'PrintChar',
  'ReadChar',
  'Exit2',
  'PrintIntHex',
  'PrintIntBinary',
  'PrintIntUnsigned'
];
if (!['--check', '--update'].includes(process.argv[2])) throw new Error('Use --check or --update');
captureProbe({
  source: 'tests/oracle/core-syscalls/CoreSyscallProbe.java',
  className: 'mars.mips.instructions.CoreSyscallProbe',
  golden: 'tests/oracle/core-syscalls/golden.json',
  check: process.argv[2] === '--check',
  legacySources: [
    'mars/util/SystemIO.java',
    'mars/mips/instructions/SyscallLoader.java',
    ...names.map((name) => `mars/mips/instructions/syscalls/Syscall${name}.java`)
  ]
});
