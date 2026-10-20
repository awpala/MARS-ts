import { captureProbe } from '../units/run.mjs';
captureProbe({
	source: 'tests/oracle/backstep-units/BackstepProbe.java',
	className: 'mars.simulator.BackstepProbe',
	golden: 'tests/oracle/backstep-units/golden.json',
	check: process.argv.includes('--check'),
	legacySources: ['mars/simulator/BackStepper.java', 'mars/simulator/DelayedBranch.java', 'mars/mips/hardware/RegisterFile.java', 'mars/mips/hardware/Memory.java', 'mars/mips/hardware/Coprocessor0.java', 'mars/mips/hardware/Coprocessor1.java', 'Config.properties']
});
