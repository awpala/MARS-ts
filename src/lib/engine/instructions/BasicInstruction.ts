/* Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/BasicInstruction.java; see MARSlicense.txt. */
import { NumberFormatException } from '../formatting/Binary.js';
import { BasicInstructionFormat } from './BasicInstructionFormat.js';
import { Instruction, type InstructionHost } from './Instruction.js';
import type { SimulationCode } from './SimulationCode.js';

/** A single machine instruction's format, decode masks, and simulation callback. */
export class BasicInstruction<Statement> extends Instruction {
	private readonly operationMask: string;
	private readonly opcodeMask: number;
	private readonly opcodeMatch: number;
	private readonly instructionFormat: BasicInstructionFormat;
	private readonly simulationCode: SimulationCode<Statement>;

	/** Construct metadata with the canonical mask algorithm and an explicit session host. */
	constructor(
		example: string,
		description: string,
		instructionFormat: BasicInstructionFormat,
		operationMask: string,
		simulationCode: SimulationCode<Statement>,
		host: InstructionHost
	);
	/** Legacy overload for an instruction with no user-facing description. */
	constructor(
		example: string,
		instructionFormat: BasicInstructionFormat,
		operationMask: string,
		simulationCode: SimulationCode<Statement>,
		host: InstructionHost
	);
	constructor(
		example: string,
		descriptionOrFormat: string | BasicInstructionFormat,
		formatOrMask: BasicInstructionFormat | string,
		maskOrSimulation: string | SimulationCode<Statement>,
		simulationOrHost: SimulationCode<Statement> | InstructionHost,
		explicitHost?: InstructionHost
	) {
		const described = typeof descriptionOrFormat === 'string';
		const description = described ? descriptionOrFormat : '';
		const host = (described ? explicitHost : simulationOrHost) as InstructionHost;
		const operationMask = (described ? maskOrSimulation : formatOrMask) as string;
		super(example, description, host);
		this.instructionFormat = (
			described ? formatOrMask : descriptionOrFormat
		) as BasicInstructionFormat;
		this.simulationCode = (
			described ? simulationOrHost : maskOrSimulation
		) as SimulationCode<Statement>;
		this.operationMask = operationMask.replaceAll(' ', '');
		if (this.operationMask.length !== Instruction.INSTRUCTION_LENGTH_BITS)
			host.write(`${example} mask not ${Instruction.INSTRUCTION_LENGTH_BITS} bits!\n`);
		this.opcodeMask = this.parseMask(
			this.operationMask.replace(/[01]/g, '1').replace(/[^01]/g, '0')
		);
		this.opcodeMatch = this.parseMask(this.operationMask.replace(/[^1]/g, '0'));
	}
	/** Bit-pattern template with f/s/t operand positions and ignored c fields. */
	getOperationMask(): string {
		return this.operationMask;
	}
	/** Canonical format identity used for immediate/address interpretation. */
	getInstructionFormat(): BasicInstructionFormat {
		return this.instructionFormat;
	}
	/** The supplied implementation; this descriptor does not substitute execution behavior. */
	getSimulationCode(): SimulationCode<Statement> {
		return this.simulationCode;
	}
	/** Signed word with ones at every fixed opcode position. */
	getOpcodeMask(): number {
		return this.opcodeMask;
	}
	/** Signed word containing required opcode bits at fixed positions. */
	getOpcodeMatch(): number {
		return this.opcodeMatch;
	}
	private parseMask(bits: string): number {
		if (!bits) throw new NumberFormatException();
		const value = BigInt(`0b${bits}`);
		if (value > 0x7fffffffffffffffn) throw new NumberFormatException();
		return Number(BigInt.asIntN(32, value));
	}
}
