#!/usr/bin/env node
/** Capture the canonical seeded-random, actual Swing dialog, and MIDI services without changing legacy sources. */
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
captureProbe({
  source: 'tests/oracle/platform-syscalls/MidiSyscallProbe.java',
  className: 'mars.mips.instructions.MidiSyscallProbe',
  golden: 'tests/oracle/platform-syscalls/midi.json',
  check: process.argv[2] === '--check',
  legacySources: [
    'mars/mips/instructions/SyscallLoader.java',
    'mars/mips/instructions/syscalls/SyscallMidiOut.java',
    'mars/mips/instructions/syscalls/SyscallMidiOutSync.java',
    'mars/mips/instructions/syscalls/ToneGenerator.java'
  ]
});
