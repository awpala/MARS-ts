import { captureProbe } from '../units/run.mjs';
captureProbe({
	source: 'tests/oracle/simulator-units/SimulatorProbe.java',
	className: 'mars.simulator.SimulatorProbe',
	golden: 'tests/oracle/simulator-units/golden.json',
	check: process.argv.includes('--check'),
	legacySources: ['mars/simulator/Simulator.java', 'mars/simulator/SimulatorNotice.java', 'mars/simulator/DelayedBranch.java', 'mars/simulator/BackStepper.java', 'mars/mips/instructions/InstructionSet.java']
});
