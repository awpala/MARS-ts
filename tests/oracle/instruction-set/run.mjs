#!/usr/bin/env node
/** Capture/check full instruction callback states using the isolated Java oracle. */
import { captureProbe } from '../units/run.mjs';
if (!['--check', '--update'].includes(process.argv[2])) throw new Error('Use --check or --update');
captureProbe({
  source: 'tests/oracle/instruction-set/InstructionSetProbe.java',
  className: 'mars.simulator.InstructionSetProbe',
  golden: 'tests/oracle/instruction-set/golden.json',
  check: process.argv[2] === '--check',
  legacySources: ['mars/mips/instructions/InstructionSet.java', 'PseudoOps.txt']
});
