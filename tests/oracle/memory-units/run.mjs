/** Capture/check public Memory methods against the existing JDK 21 oracle jar. */
import { captureProbe } from '../units/run.mjs';
captureProbe({
  source: 'tests/oracle/memory-units/MemoryProbe.java',
  className: 'MemoryProbe',
  golden: 'tests/oracle/memory-units/golden.json',
  check: process.argv.includes('--check'),
  legacySources: [
    'mars/mips/hardware/Memory.java',
    'mars/mips/hardware/MemoryConfigurations.java',
    'mars/mips/hardware/MemoryConfiguration.java',
    'mars/mips/hardware/MemoryAccessNotice.java',
    'mars/mips/hardware/AddressErrorException.java',
    'mars/ProgramStatement.java'
  ]
});
