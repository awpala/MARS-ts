#!/usr/bin/env node
/** Capture the canonical seeded-random and actual Swing dialog services without changing legacy sources. */
import { captureProbe } from '../units/run.mjs';
if (!['--check', '--update'].includes(process.argv[2])) throw new Error('Use --check or --update');
const random = ['RandSeed', 'RandInt', 'RandIntRange', 'RandFloat', 'RandDouble'];
const dialogs = [
  'ConfirmDialog',
  'InputDialogInt',
  'InputDialogFloat',
  'InputDialogDouble',
  'InputDialogString',
  'MessageDialog',
  'MessageDialogInt',
  'MessageDialogFloat',
  'MessageDialogDouble',
  'MessageDialogString'
];
for (const gui of [false, true])
  captureProbe({
    source: 'tests/oracle/platform-syscalls/PlatformSyscallProbe.java',
    className: 'mars.mips.instructions.PlatformSyscallProbe',
    golden: `tests/oracle/platform-syscalls/${gui ? 'dialogs' : 'random'}.json`,
    check: process.argv[2] === '--check',
    gui,
    legacySources: [
      'mars/mips/instructions/SyscallLoader.java',
      ...(!gui ? ['mars/mips/instructions/syscalls/RandomStreams.java'] : []),
      ...(gui ? dialogs : random).map(
        (name) => `mars/mips/instructions/syscalls/Syscall${name}.java`
      )
    ]
  });
