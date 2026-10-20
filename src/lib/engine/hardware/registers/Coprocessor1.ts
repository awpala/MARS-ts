/* Copyright (c) 2003-2013, Pete Sanderson and Kenneth Vollmar. MIT license; see MARSlicense.txt.
 * Ports mars/mips/hardware/Coprocessor1.java. */
import { Binary } from '../../formatting/Binary.js';
import type { AccessOrigin } from '../notices/AccessNotice.js';
import { InvalidRegisterAccessException } from './InvalidRegisterAccessException.js';
import { Register, type RegisterObserver } from './Register.js';

/** Session-owned backstep and access services for the floating-point register file. */
export interface Coprocessor1Host {
	/** Records raw register restores when backstepping is enabled. */
	addCoprocessor1Restore?: (number: number, old: number) => number;
	/** Records an old clear flag when backstepping is enabled. */
	addConditionFlagClear?: (flag: number) => void;
	/** Records an old set flag when backstepping is enabled. */
	addConditionFlagSet?: (flag: number) => void;
	/** Supplies execution origin for access notices. */
	getAccessOrigin?: () => AccessOrigin;
}

/** Raw floating-point register storage; double pairs store the low word in the even register. */
export class Coprocessor1 {
	private readonly registers: Register[];
	private readonly condition: Register;
	private readonly bits = new DataView(new ArrayBuffer(8));
	/** Creates a fresh FPU; the host owns any backstep records. */
	constructor(private readonly host: Coprocessor1Host = {}) {
		const origin = () => host.getAccessOrigin?.() ?? 'other';
		this.registers = Array.from({ length: 32 }, (_, i) => new Register(`$f${i}`, i, 0, origin));
		this.condition = new Register('cf', 32, 0, origin);
	}
	/** Emits the canonical diagnostic register lines through injected output. */
	showRegisters(write: (text: string) => void): void {
		for (const r of this.registers)
			write(`Name: ${r.getName()}\nNumber: ${r.getNumber()}\nValue: ${r.getValue()}\n\n`);
	}
	private number(register: number | string): number {
		return typeof register === 'number' ? register : this.getRegisterNumber(register);
	}
	private even(register: number | string): number {
		const n = this.number(register);
		if (n % 2 !== 0) throw new InvalidRegisterAccessException();
		return n;
	}
	/** Stores a float's raw 32-bit representation; unknown names/numbers are ignored. */
	setRegisterToFloat(register: number | string, value: number): void {
		this.bits.setFloat32(0, value);
		this.setRegisterToInt(register, this.bits.getInt32(0));
	}
	/** Stores raw word bits without adding a backstep record. */
	setRegisterToInt(register: number | string, value: number): void {
		this.registers[this.number(register)]?.setValue(value);
	}
	/** Stores a double's raw bits, writing the odd high register first. */
	setRegisterPairToDouble(register: number | string, value: number): void {
		this.bits.setFloat64(0, value);
		this.setRegisterPairToLong(register, this.bits.getBigInt64(0));
	}
	/** Stores exact 64-bit pair bits; odd register numbers throw. */
	setRegisterPairToLong(register: number | string, value: bigint): void {
		const n = this.even(register);
		this.registers[n + 1].setValue(Binary.highOrderLongToInt(value));
		this.registers[n].setValue(Binary.lowOrderLongToInt(value));
	}
	/** Returns a float for UI display without emitting register access notices. */
	getFloatFromRegisterNoNotify(register: number): number {
		this.bits.setInt32(0, this.registers[register]?.getValueNoNotify() ?? 0);
		return this.bits.getFloat32(0);
	}
	/** Returns a double for UI display without emitting access notices; requires an even valid register. */
	getDoubleFromRegisterPairNoNotify(register: number): number {
		const n = this.even(register);
		this.bits.setBigInt64(
			0,
			Binary.twoIntsToLong(
				this.registers[n + 1].getValueNoNotify(),
				this.registers[n].getValueNoNotify()
			)
		);
		return this.bits.getFloat64(0);
	}
	/** Returns condition bits for UI display without emitting access notices. */
	getConditionFlagsNoNotify(): number {
		return this.condition.getValueNoNotify();
	}
	/** Reads a single precision value, returning zero for unknown registers. */
	getFloatFromRegister(register: number | string): number {
		this.bits.setInt32(0, this.getIntFromRegister(register));
		return this.bits.getFloat32(0);
	}
	/** Reads raw bits, returning zero for unknown registers. */
	getIntFromRegister(register: number | string): number {
		return this.registers[this.number(register)]?.getValue() ?? 0;
	}
	/** Reads an even/odd pair as a double. */
	getDoubleFromRegisterPair(register: number | string): number {
		this.bits.setBigInt64(0, this.getLongFromRegisterPair(register));
		return this.bits.getFloat64(0);
	}
	/** Reads a pair's raw bits, reading the odd high register first. */
	getLongFromRegisterPair(register: number | string): bigint {
		const n = this.even(register);
		return Binary.twoIntsToLong(this.registers[n + 1].getValue(), this.registers[n].getValue());
	}
	/** Updates raw bits and adds a restore through the session host. */
	updateRegister(number: number, value: number): number {
		const r = this.registers[number];
		if (!r) return 0;
		const old = r.setValue(value);
		return this.host.addCoprocessor1Restore?.(number, old) ?? old;
	}
	/** Reads a valid register's raw bits with notification. */
	getValue(number: number): number {
		return this.registers[number].getValue();
	}
	/** Looks up exact $f0 through $f31 names, returning -1 if unknown. */
	getRegisterNumber(name: string): number {
		return this.registers.find((r) => r.getName() === name)?.getNumber() ?? -1;
	}
	/** Returns this session's register objects in numeric order. */
	getRegisters(): readonly Register[] {
		return this.registers;
	}
	/** Parses a dollar-f-prefixed number using Binary's legacy integer rules. */
	getRegister(name: string): Register | null {
		if (!name.length) throw new RangeError('StringIndexOutOfBoundsException');
		if (!name.startsWith('$f')) return null;
		try {
			return this.registers[Binary.stringToInt(name.slice(2))] ?? null;
		} catch {
			return null;
		}
	}
	/** Resets register bits silently, then writes zero to the condition register. */
	resetRegisters(): void {
		this.registers.forEach((r) => r.resetValue());
		this.clearConditionFlags();
	}
	/** Subscribes to the 32 floating registers; caller owns teardown. */
	addRegistersObserver(observer: RegisterObserver): () => void {
		const releases = this.registers.map((r) => r.subscribe(observer));
		return () => releases.forEach((release) => release());
	}
	/** Sets one valid condition flag and records the prior state, returning that state. */
	setConditionFlag(flag: number): number {
		return this.changeFlag(flag, true);
	}
	/** Clears one valid condition flag and records the prior state, returning that state. */
	clearConditionFlag(flag: number): number {
		return this.changeFlag(flag, false);
	}
	private changeFlag(flag: number, set: boolean): number {
		if (flag < 0 || flag >= 8) return 0;
		const old = this.getConditionFlag(flag);
		this.condition.setValue(
			set
				? Binary.setBit(this.condition.getValue(), flag)
				: Binary.clearBit(this.condition.getValue(), flag)
		);
		if (old === 0) this.host.addConditionFlagClear?.(flag);
		else this.host.addConditionFlagSet?.(flag);
		return old;
	}
	/** Reads a flag; invalid flag numbers fall back to flag zero. */
	getConditionFlag(flag: number): number {
		return Binary.bitValue(this.condition.getValue(), flag < 0 || flag >= 8 ? 0 : flag);
	}
	/** Returns the entire signed condition word, including unused high bits. */
	getConditionFlags(): number {
		return this.condition.getValue();
	}
	/** Writes zero to all 32 condition bits without backstep recording. */
	clearConditionFlags(): void {
		this.condition.setValue(0);
	}
	/** Writes -1 to all 32 condition bits without backstep recording. */
	setConditionFlags(): void {
		this.condition.setValue(-1);
	}
	/** Returns the architectural condition flag count. */
	getConditionFlagCount(): number {
		return 8;
	}
}
