/** Capture/check all six dump encoders and GUI range discovery against the immutable Java oracle. */
import { captureProbe } from '../units/run.mjs';
if (!['--check', '--update'].includes(process.argv[2])) throw new Error('Use --check or --update');
captureProbe({
  source: 'tests/oracle/dump-units/DumpProbe.java',
  className: 'DumpProbe',
  golden: 'tests/oracle/dump-units/golden.json',
  check: process.argv[2] === '--check',
  legacySources: [
    ...[
      'AbstractDumpFormat',
      'AsciiTextDumpFormat',
      'BinaryDumpFormat',
      'BinaryTextDumpFormat',
      'DumpFormat',
      'DumpFormatLoader',
      'HexTextDumpFormat',
      'IntelHexDumpFormat',
      'SegmentWindowDumpFormat',
      'MIFDumpFormat'
    ].map((name) => `mars/mips/dump/${name}.java`),
    'mars/util/MemoryDump.java',
    'mars/venus/FileDumpMemoryAction.java',
    'mars/mips/hardware/Memory.java'
  ]
});
