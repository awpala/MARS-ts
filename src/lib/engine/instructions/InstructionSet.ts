/* Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/mips/instructions/InstructionSet.java; see MARSlicense.txt. */
import type { ProgramStatement } from '../assembler/programs/ProgramStatement.js';
import {
  ProcessingException,
  type ProcessingExceptionHost
} from '../diagnostics/ProcessingException.js';
import { Binary } from '../formatting/Binary.js';
import { JavaFloatingPoint } from '../formatting/JavaFloatingPoint.js';
import { AddressErrorException } from '../hardware/memory/AddressErrorException.js';
import { Coprocessor0 } from '../hardware/registers/Coprocessor0.js';
import type { Coprocessor1 } from '../hardware/registers/Coprocessor1.js';
import { Memory } from '../hardware/memory/Memory.js';
import type { RegisterFile } from '../hardware/registers/RegisterFile.js';
import type { DelayedBranch } from '../simulator/DelayedBranch.js';
import { Exceptions } from '../simulator/Exceptions.js';
import { BasicInstruction } from './BasicInstruction.js';
import { BasicInstructionFormat } from './BasicInstructionFormat.js';
import { ExtendedInstruction, type ExtendedInstructionHost } from './ExtendedInstruction.js';
import { Instruction } from './Instruction.js';
import type { SimulationCode } from './SimulationCode.js';
import pseudoOperations from './pseudo-operations.json';

/** All mutable hardware and platform services belong to the instruction set's session. */
export interface InstructionSetHost extends ExtendedInstructionHost {
  /** Session's general registers, HI/LO, and PC. */
  readonly registerFile: RegisterFile;
  /** Session's exception registers. */
  readonly coprocessor0: Coprocessor0;
  /** Session's floating registers and condition flags. */
  readonly coprocessor1: Coprocessor1;
  /** Session's byte-addressed memory and notifications. */
  readonly memory: Memory<ProgramStatement>;
  /** Session's delayed branch state machine. */
  readonly delayedBranch: DelayedBranch;
  /** Runtime diagnostic and exception-register owner. */
  readonly exceptionHost: ProcessingExceptionHost;
  /** Resolve a service from the session's syscall dispatcher, or null if unimplemented. */
  findSyscall(number: number): SimulationCode<ProgramStatement> | null;
}

/** Full instruction registry, decoder, and basic simulation callbacks; no process-global state. */
export class InstructionSet {
  private readonly instructionList: Instruction[] = [];
  private opcodeMatchMaps: {
    mask: number;
    length: number;
    matches: Map<number, BasicInstruction<ProgramStatement>>;
  }[] = [];
  private readonly bits = new DataView(new ArrayBuffer(8));
  /** Bind canonical operations to one machine; call populate once before assembly or decoding. */
  constructor(private readonly host: InstructionSetHost) {}
  /** Return the ordered live instruction definitions, including overloads and pseudoinstructions. */
  getInstructionList(): readonly Instruction[] {
    return this.instructionList;
  }
  /** Append every canonical basic and pseudo definition, tokenize examples, and build decode maps. */
  populate(): void {
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'nop',
        'Null operation : machine code is all zeroes',
        BasicInstructionFormat.R_FORMAT,
        '000000 00000 00000 00000 00000 000000',
        { simulate: () => {} },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'add $t1,$t2,$t3',
        'Addition with overflow : set $t1 to ($t2 plus $t3)',
        BasicInstructionFormat.R_FORMAT,
        '000000 sssss ttttt fffff 00000 100000',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            const add1 = this.host.registerFile.getValue(operands[1]) | 0;
            const add2 = this.host.registerFile.getValue(operands[2]) | 0;
            const sum = (add1 + add2) | 0;
            if ((add1 >= 0 && add2 >= 0 && sum < 0) || (add1 < 0 && add2 < 0 && sum >= 0)) {
              throw this.failure(
                statement,
                'arithmetic overflow',
                Exceptions.ARITHMETIC_OVERFLOW_EXCEPTION
              );
            }
            this.host.registerFile.updateRegister(operands[0], sum);
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'sub $t1,$t2,$t3',
        'Subtraction with overflow : set $t1 to ($t2 minus $t3)',
        BasicInstructionFormat.R_FORMAT,
        '000000 sssss ttttt fffff 00000 100010',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            const sub1 = this.host.registerFile.getValue(operands[1]) | 0;
            const sub2 = this.host.registerFile.getValue(operands[2]) | 0;
            const dif = (sub1 - sub2) | 0;
            if ((sub1 >= 0 && sub2 < 0 && dif < 0) || (sub1 < 0 && sub2 >= 0 && dif >= 0)) {
              throw this.failure(
                statement,
                'arithmetic overflow',
                Exceptions.ARITHMETIC_OVERFLOW_EXCEPTION
              );
            }
            this.host.registerFile.updateRegister(operands[0], dif);
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'addi $t1,$t2,-100',
        'Addition immediate with overflow : set $t1 to ($t2 plus signed 16-bit immediate)',
        BasicInstructionFormat.I_FORMAT,
        '001000 sssss fffff tttttttttttttttt',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            const add1 = this.host.registerFile.getValue(operands[1]) | 0;
            const add2 = Binary.signExtend16(operands[2]) | 0;
            const sum = (add1 + add2) | 0;
            if ((add1 >= 0 && add2 >= 0 && sum < 0) || (add1 < 0 && add2 < 0 && sum >= 0)) {
              throw this.failure(
                statement,
                'arithmetic overflow',
                Exceptions.ARITHMETIC_OVERFLOW_EXCEPTION
              );
            }
            this.host.registerFile.updateRegister(operands[0], sum);
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'addu $t1,$t2,$t3',
        'Addition unsigned without overflow : set $t1 to ($t2 plus $t3), no overflow',
        BasicInstructionFormat.R_FORMAT,
        '000000 sssss ttttt fffff 00000 100001',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            this.host.registerFile.updateRegister(
              operands[0],
              this.host.registerFile.getValue(operands[1]) +
                this.host.registerFile.getValue(operands[2])
            );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'subu $t1,$t2,$t3',
        'Subtraction unsigned without overflow : set $t1 to ($t2 minus $t3), no overflow',
        BasicInstructionFormat.R_FORMAT,
        '000000 sssss ttttt fffff 00000 100011',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            this.host.registerFile.updateRegister(
              operands[0],
              this.host.registerFile.getValue(operands[1]) -
                this.host.registerFile.getValue(operands[2])
            );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'addiu $t1,$t2,-100',
        'Addition immediate unsigned without overflow : set $t1 to ($t2 plus signed 16-bit immediate), no overflow',
        BasicInstructionFormat.I_FORMAT,
        '001001 sssss fffff tttttttttttttttt',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            this.host.registerFile.updateRegister(
              operands[0],
              this.host.registerFile.getValue(operands[1]) + Binary.signExtend16(operands[2])
            );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'mult $t1,$t2',
        'Multiplication : Set hi to high-order 32 bits, lo to low-order 32 bits of the product of $t1 and $t2 (use mfhi to access hi, mflo to access lo)',
        BasicInstructionFormat.R_FORMAT,
        '000000 fffff sssss 00000 00000 011000',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            const product = BigInt.asIntN(
              64,
              BigInt(this.host.registerFile.getValue(operands[0])) *
                BigInt(this.host.registerFile.getValue(operands[1]))
            );
            this.host.registerFile.updateRegister(33, Binary.highOrderLongToInt(product));
            this.host.registerFile.updateRegister(34, Binary.lowOrderLongToInt(product));
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'multu $t1,$t2',
        'Multiplication unsigned : Set HI to high-order 32 bits, LO to low-order 32 bits of the product of unsigned $t1 and $t2 (use mfhi to access HI, mflo to access LO)',
        BasicInstructionFormat.R_FORMAT,
        '000000 fffff sssss 00000 00000 011001',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            const product = BigInt.asIntN(
              64,
              BigInt(this.host.registerFile.getValue(operands[0]) >>> 0) *
                BigInt(this.host.registerFile.getValue(operands[1]) >>> 0)
            );
            this.host.registerFile.updateRegister(33, Binary.highOrderLongToInt(product));
            this.host.registerFile.updateRegister(34, Binary.lowOrderLongToInt(product));
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'mul $t1,$t2,$t3',
        'Multiplication without overflow  : Set HI to high-order 32 bits, LO and $t1 to low-order 32 bits of the product of $t2 and $t3 (use mfhi to access HI, mflo to access LO)',
        BasicInstructionFormat.R_FORMAT,
        '011100 sssss ttttt fffff 00000 000010',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            const product = BigInt.asIntN(
              64,
              BigInt(this.host.registerFile.getValue(operands[1])) *
                BigInt(this.host.registerFile.getValue(operands[2]))
            );
            this.host.registerFile.updateRegister(operands[0], Binary.lowOrderLongToInt(product));
            this.host.registerFile.updateRegister(33, Binary.highOrderLongToInt(product));
            this.host.registerFile.updateRegister(34, Binary.lowOrderLongToInt(product));
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'madd $t1,$t2',
        'Multiply add : Multiply $t1 by $t2 then increment HI by high-order 32 bits of product, increment LO by low-order 32 bits of product (use mfhi to access HI, mflo to access LO)',
        BasicInstructionFormat.R_FORMAT,
        '011100 fffff sssss 00000 00000 000000',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            const product = BigInt.asIntN(
              64,
              BigInt(this.host.registerFile.getValue(operands[0])) *
                BigInt(this.host.registerFile.getValue(operands[1]))
            );
            const contentsHiLo = Binary.twoIntsToLong(
              this.host.registerFile.getValue(33),
              this.host.registerFile.getValue(34)
            );
            const result = BigInt.asIntN(64, contentsHiLo + product);
            this.host.registerFile.updateRegister(33, Binary.highOrderLongToInt(result));
            this.host.registerFile.updateRegister(34, Binary.lowOrderLongToInt(result));
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'maddu $t1,$t2',
        'Multiply add unsigned : Multiply $t1 by $t2 then increment HI by high-order 32 bits of product, increment LO by low-order 32 bits of product, unsigned (use mfhi to access HI, mflo to access LO)',
        BasicInstructionFormat.R_FORMAT,
        '011100 fffff sssss 00000 00000 000001',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            const product = BigInt.asIntN(
              64,
              BigInt(this.host.registerFile.getValue(operands[0]) >>> 0) *
                BigInt(this.host.registerFile.getValue(operands[1]) >>> 0)
            );
            const contentsHiLo = Binary.twoIntsToLong(
              this.host.registerFile.getValue(33),
              this.host.registerFile.getValue(34)
            );
            const result = BigInt.asIntN(64, contentsHiLo + product);
            this.host.registerFile.updateRegister(33, Binary.highOrderLongToInt(result));
            this.host.registerFile.updateRegister(34, Binary.lowOrderLongToInt(result));
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'msub $t1,$t2',
        'Multiply subtract : Multiply $t1 by $t2 then decrement HI by high-order 32 bits of product, decrement LO by low-order 32 bits of product (use mfhi to access HI, mflo to access LO)',
        BasicInstructionFormat.R_FORMAT,
        '011100 fffff sssss 00000 00000 000100',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            const product = BigInt.asIntN(
              64,
              BigInt(this.host.registerFile.getValue(operands[0])) *
                BigInt(this.host.registerFile.getValue(operands[1]))
            );
            const contentsHiLo = Binary.twoIntsToLong(
              this.host.registerFile.getValue(33),
              this.host.registerFile.getValue(34)
            );
            const result = BigInt.asIntN(64, contentsHiLo - product);
            this.host.registerFile.updateRegister(33, Binary.highOrderLongToInt(result));
            this.host.registerFile.updateRegister(34, Binary.lowOrderLongToInt(result));
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'msubu $t1,$t2',
        'Multiply subtract unsigned : Multiply $t1 by $t2 then decrement HI by high-order 32 bits of product, decement LO by low-order 32 bits of product, unsigned (use mfhi to access HI, mflo to access LO)',
        BasicInstructionFormat.R_FORMAT,
        '011100 fffff sssss 00000 00000 000101',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            const product = BigInt.asIntN(
              64,
              BigInt(this.host.registerFile.getValue(operands[0]) >>> 0) *
                BigInt(this.host.registerFile.getValue(operands[1]) >>> 0)
            );
            const contentsHiLo = Binary.twoIntsToLong(
              this.host.registerFile.getValue(33),
              this.host.registerFile.getValue(34)
            );
            const result = BigInt.asIntN(64, contentsHiLo - product);
            this.host.registerFile.updateRegister(33, Binary.highOrderLongToInt(result));
            this.host.registerFile.updateRegister(34, Binary.lowOrderLongToInt(result));
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'div $t1,$t2',
        'Division with overflow : Divide $t1 by $t2 then set LO to quotient and HI to remainder (use mfhi to access HI, mflo to access LO)',
        BasicInstructionFormat.R_FORMAT,
        '000000 fffff sssss 00000 00000 011010',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (this.host.registerFile.getValue(operands[1]) == 0) {
              return;
            }
            this.host.registerFile.updateRegister(
              33,
              this.host.registerFile.getValue(operands[0]) %
                this.host.registerFile.getValue(operands[1])
            );
            this.host.registerFile.updateRegister(
              34,
              this.host.registerFile.getValue(operands[0]) /
                this.host.registerFile.getValue(operands[1])
            );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'divu $t1,$t2',
        'Division unsigned without overflow : Divide unsigned $t1 by $t2 then set LO to quotient and HI to remainder (use mfhi to access HI, mflo to access LO)',
        BasicInstructionFormat.R_FORMAT,
        '000000 fffff sssss 00000 00000 011011',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (this.host.registerFile.getValue(operands[1]) === 0) return;
            const oper1 = BigInt(this.host.registerFile.getValue(operands[0]) >>> 0);
            const oper2 = BigInt(this.host.registerFile.getValue(operands[1]) >>> 0);
            this.host.registerFile.updateRegister(33, Number(BigInt.asIntN(32, oper1 % oper2)));
            this.host.registerFile.updateRegister(34, Number(BigInt.asIntN(32, oper1 / oper2)));
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'mfhi $t1',
        'Move from HI register : Set $t1 to contents of HI (see multiply and divide operations)',
        BasicInstructionFormat.R_FORMAT,
        '000000 00000 00000 fffff 00000 010000',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            this.host.registerFile.updateRegister(operands[0], this.host.registerFile.getValue(33));
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'mflo $t1',
        'Move from LO register : Set $t1 to contents of LO (see multiply and divide operations)',
        BasicInstructionFormat.R_FORMAT,
        '000000 00000 00000 fffff 00000 010010',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            this.host.registerFile.updateRegister(operands[0], this.host.registerFile.getValue(34));
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'mthi $t1',
        'Move to HI registerr : Set HI to contents of $t1 (see multiply and divide operations)',
        BasicInstructionFormat.R_FORMAT,
        '000000 fffff 00000 00000 00000 010001',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            this.host.registerFile.updateRegister(33, this.host.registerFile.getValue(operands[0]));
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'mtlo $t1',
        'Move to LO register : Set LO to contents of $t1 (see multiply and divide operations)',
        BasicInstructionFormat.R_FORMAT,
        '000000 fffff 00000 00000 00000 010011',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            this.host.registerFile.updateRegister(34, this.host.registerFile.getValue(operands[0]));
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'and $t1,$t2,$t3',
        'Bitwise AND : Set $t1 to bitwise AND of $t2 and $t3',
        BasicInstructionFormat.R_FORMAT,
        '000000 sssss ttttt fffff 00000 100100',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            this.host.registerFile.updateRegister(
              operands[0],
              this.host.registerFile.getValue(operands[1]) &
                this.host.registerFile.getValue(operands[2])
            );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'or $t1,$t2,$t3',
        'Bitwise OR : Set $t1 to bitwise OR of $t2 and $t3',
        BasicInstructionFormat.R_FORMAT,
        '000000 sssss ttttt fffff 00000 100101',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            this.host.registerFile.updateRegister(
              operands[0],
              this.host.registerFile.getValue(operands[1]) |
                this.host.registerFile.getValue(operands[2])
            );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'andi $t1,$t2,100',
        'Bitwise AND immediate : Set $t1 to bitwise AND of $t2 and zero-extended 16-bit immediate',
        BasicInstructionFormat.I_FORMAT,
        '001100 sssss fffff tttttttttttttttt',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            this.host.registerFile.updateRegister(
              operands[0],
              this.host.registerFile.getValue(operands[1]) & (operands[2] & 0x0000ffff)
            );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'ori $t1,$t2,100',
        'Bitwise OR immediate : Set $t1 to bitwise OR of $t2 and zero-extended 16-bit immediate',
        BasicInstructionFormat.I_FORMAT,
        '001101 sssss fffff tttttttttttttttt',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            this.host.registerFile.updateRegister(
              operands[0],
              this.host.registerFile.getValue(operands[1]) | (operands[2] & 0x0000ffff)
            );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'nor $t1,$t2,$t3',
        'Bitwise NOR : Set $t1 to bitwise NOR of $t2 and $t3',
        BasicInstructionFormat.R_FORMAT,
        '000000 sssss ttttt fffff 00000 100111',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            this.host.registerFile.updateRegister(
              operands[0],
              ~(
                this.host.registerFile.getValue(operands[1]) |
                this.host.registerFile.getValue(operands[2])
              )
            );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'xor $t1,$t2,$t3',
        'Bitwise XOR (exclusive OR) : Set $t1 to bitwise XOR of $t2 and $t3',
        BasicInstructionFormat.R_FORMAT,
        '000000 sssss ttttt fffff 00000 100110',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            this.host.registerFile.updateRegister(
              operands[0],
              this.host.registerFile.getValue(operands[1]) ^
                this.host.registerFile.getValue(operands[2])
            );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'xori $t1,$t2,100',
        'Bitwise XOR immediate : Set $t1 to bitwise XOR of $t2 and zero-extended 16-bit immediate',
        BasicInstructionFormat.I_FORMAT,
        '001110 sssss fffff tttttttttttttttt',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            this.host.registerFile.updateRegister(
              operands[0],
              this.host.registerFile.getValue(operands[1]) ^ (operands[2] & 0x0000ffff)
            );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'sll $t1,$t2,10',
        'Shift left logical : Set $t1 to result of shifting $t2 left by number of bits specified by immediate',
        BasicInstructionFormat.R_FORMAT,
        '000000 00000 sssss fffff ttttt 000000',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            this.host.registerFile.updateRegister(
              operands[0],
              this.host.registerFile.getValue(operands[1]) << operands[2]
            );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'sllv $t1,$t2,$t3',
        'Shift left logical variable : Set $t1 to result of shifting $t2 left by number of bits specified by value in low-order 5 bits of $t3',
        BasicInstructionFormat.R_FORMAT,
        '000000 ttttt sssss fffff 00000 000100',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            this.host.registerFile.updateRegister(
              operands[0],
              this.host.registerFile.getValue(operands[1]) <<
                (this.host.registerFile.getValue(operands[2]) & 0x0000001f)
            );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'srl $t1,$t2,10',
        'Shift right logical : Set $t1 to result of shifting $t2 right by number of bits specified by immediate',
        BasicInstructionFormat.R_FORMAT,
        '000000 00000 sssss fffff ttttt 000010',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            this.host.registerFile.updateRegister(
              operands[0],
              this.host.registerFile.getValue(operands[1]) >>> operands[2]
            );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'sra $t1,$t2,10',
        'Shift right arithmetic : Set $t1 to result of sign-extended shifting $t2 right by number of bits specified by immediate',
        BasicInstructionFormat.R_FORMAT,
        '000000 00000 sssss fffff ttttt 000011',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            this.host.registerFile.updateRegister(
              operands[0],
              this.host.registerFile.getValue(operands[1]) >> operands[2]
            );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'srav $t1,$t2,$t3',
        'Shift right arithmetic variable : Set $t1 to result of sign-extended shifting $t2 right by number of bits specified by value in low-order 5 bits of $t3',
        BasicInstructionFormat.R_FORMAT,
        '000000 ttttt sssss fffff 00000 000111',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            this.host.registerFile.updateRegister(
              operands[0],
              this.host.registerFile.getValue(operands[1]) >>
                (this.host.registerFile.getValue(operands[2]) & 0x0000001f)
            );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'srlv $t1,$t2,$t3',
        'Shift right logical variable : Set $t1 to result of shifting $t2 right by number of bits specified by value in low-order 5 bits of $t3',
        BasicInstructionFormat.R_FORMAT,
        '000000 ttttt sssss fffff 00000 000110',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            this.host.registerFile.updateRegister(
              operands[0],
              this.host.registerFile.getValue(operands[1]) >>>
                (this.host.registerFile.getValue(operands[2]) & 0x0000001f)
            );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'lw $t1,-100($t2)',
        'Load word : Set $t1 to contents of effective memory word address',
        BasicInstructionFormat.I_FORMAT,
        '100011 ttttt fffff ssssssssssssssss',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            try {
              this.host.registerFile.updateRegister(
                operands[0],
                this.host.memory.getWord(this.host.registerFile.getValue(operands[2]) + operands[1])
              );
            } catch (e) {
              if (!(e instanceof AddressErrorException)) throw e;
              throw this.failure(statement, e);
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'll $t1,-100($t2)',
        'Load linked : Paired with Store Conditional (sc) to perform atomic read-modify-write.  Treated as equivalent to Load Word (lw) because MARS does not simulate multiple processors.',
        BasicInstructionFormat.I_FORMAT,
        '110000 ttttt fffff ssssssssssssssss',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            try {
              this.host.registerFile.updateRegister(
                operands[0],
                this.host.memory.getWord(this.host.registerFile.getValue(operands[2]) + operands[1])
              );
            } catch (e) {
              if (!(e instanceof AddressErrorException)) throw e;
              throw this.failure(statement, e);
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'lwl $t1,-100($t2)',
        'Load word left : Load from 1 to 4 bytes left-justified into $t1, starting with effective memory byte address and continuing through the low-order byte of its word',
        BasicInstructionFormat.I_FORMAT,
        '100010 ttttt fffff ssssssssssssssss',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            try {
              const address = (this.host.registerFile.getValue(operands[2]) + operands[1]) | 0;
              let result = this.host.registerFile.getValue(operands[0]) | 0;
              for (let i = 0 | 0; i <= address % Memory.WORD_LENGTH_BYTES; i++) {
                result = Binary.setByte(result, 3 - i, this.host.memory.getByte(address - i));
              }
              this.host.registerFile.updateRegister(operands[0], result);
            } catch (e) {
              if (!(e instanceof AddressErrorException)) throw e;
              throw this.failure(statement, e);
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'lwr $t1,-100($t2)',
        'Load word right : Load from 1 to 4 bytes right-justified into $t1, starting with effective memory byte address and continuing through the high-order byte of its word',
        BasicInstructionFormat.I_FORMAT,
        '100110 ttttt fffff ssssssssssssssss',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            try {
              const address = (this.host.registerFile.getValue(operands[2]) + operands[1]) | 0;
              let result = this.host.registerFile.getValue(operands[0]) | 0;
              for (let i = 0 | 0; i <= 3 - (address % Memory.WORD_LENGTH_BYTES); i++) {
                result = Binary.setByte(result, i, this.host.memory.getByte(address + i));
              }
              this.host.registerFile.updateRegister(operands[0], result);
            } catch (e) {
              if (!(e instanceof AddressErrorException)) throw e;
              throw this.failure(statement, e);
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'sw $t1,-100($t2)',
        'Store word : Store contents of $t1 into effective memory word address',
        BasicInstructionFormat.I_FORMAT,
        '101011 ttttt fffff ssssssssssssssss',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            try {
              this.host.memory.setWord(
                this.host.registerFile.getValue(operands[2]) + operands[1],
                this.host.registerFile.getValue(operands[0])
              );
            } catch (e) {
              if (!(e instanceof AddressErrorException)) throw e;
              throw this.failure(statement, e);
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'sc $t1,-100($t2)',
        'Store conditional : Paired with Load Linked (ll) to perform atomic read-modify-write.  Stores $t1 value into effective address, then sets $t1 to 1 for success.  Always succeeds because MARS does not simulate multiple processors.',
        BasicInstructionFormat.I_FORMAT,
        '111000 ttttt fffff ssssssssssssssss',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            try {
              this.host.memory.setWord(
                this.host.registerFile.getValue(operands[2]) + operands[1],
                this.host.registerFile.getValue(operands[0])
              );
            } catch (e) {
              if (!(e instanceof AddressErrorException)) throw e;
              throw this.failure(statement, e);
            }
            this.host.registerFile.updateRegister(operands[0], 1);
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'swl $t1,-100($t2)',
        'Store word left : Store high-order 1 to 4 bytes of $t1 into memory, starting with effective byte address and continuing through the low-order byte of its word',
        BasicInstructionFormat.I_FORMAT,
        '101010 ttttt fffff ssssssssssssssss',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            try {
              const address = (this.host.registerFile.getValue(operands[2]) + operands[1]) | 0;
              const source = this.host.registerFile.getValue(operands[0]) | 0;
              for (let i = 0 | 0; i <= address % Memory.WORD_LENGTH_BYTES; i++) {
                this.host.memory.setByte(address - i, Binary.getByte(source, 3 - i));
              }
            } catch (e) {
              if (!(e instanceof AddressErrorException)) throw e;
              throw this.failure(statement, e);
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'swr $t1,-100($t2)',
        'Store word right : Store low-order 1 to 4 bytes of $t1 into memory, starting with high-order byte of word containing effective byte address and continuing through that byte address',
        BasicInstructionFormat.I_FORMAT,
        '101110 ttttt fffff ssssssssssssssss',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            try {
              const address = (this.host.registerFile.getValue(operands[2]) + operands[1]) | 0;
              const source = this.host.registerFile.getValue(operands[0]) | 0;
              for (let i = 0 | 0; i <= 3 - (address % Memory.WORD_LENGTH_BYTES); i++) {
                this.host.memory.setByte(address + i, Binary.getByte(source, i));
              }
            } catch (e) {
              if (!(e instanceof AddressErrorException)) throw e;
              throw this.failure(statement, e);
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'lui $t1,100',
        'Load upper immediate : Set high-order 16 bits of $t1 to 16-bit immediate and low-order 16 bits to 0',
        BasicInstructionFormat.I_FORMAT,
        '001111 00000 fffff ssssssssssssssss',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            this.host.registerFile.updateRegister(operands[0], operands[1] << 16);
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'beq $t1,$t2,label',
        "Branch if equal : Branch to statement at label's address if $t1 and $t2 are equal",
        BasicInstructionFormat.I_BRANCH_FORMAT,
        '000100 fffff sssss tttttttttttttttt',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (
              this.host.registerFile.getValue(operands[0]) ==
              this.host.registerFile.getValue(operands[1])
            ) {
              this.processBranch(operands[2]);
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'bne $t1,$t2,label',
        "Branch if not equal : Branch to statement at label's address if $t1 and $t2 are not equal",
        BasicInstructionFormat.I_BRANCH_FORMAT,
        '000101 fffff sssss tttttttttttttttt',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (
              this.host.registerFile.getValue(operands[0]) !=
              this.host.registerFile.getValue(operands[1])
            ) {
              this.processBranch(operands[2]);
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'bgez $t1,label',
        "Branch if greater than or equal to zero : Branch to statement at label's address if $t1 is greater than or equal to zero",
        BasicInstructionFormat.I_BRANCH_FORMAT,
        '000001 fffff 00001 ssssssssssssssss',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (this.host.registerFile.getValue(operands[0]) >= 0) {
              this.processBranch(operands[1]);
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'bgezal $t1,label',
        "Branch if greater then or equal to zero and link : If $t1 is greater than or equal to zero, then set $ra to the Program Counter and branch to statement at label's address",
        BasicInstructionFormat.I_BRANCH_FORMAT,
        '000001 fffff 10001 ssssssssssssssss',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (this.host.registerFile.getValue(operands[0]) >= 0) {
              this.processReturnAddress(31);
              this.processBranch(operands[1]);
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'bgtz $t1,label',
        "Branch if greater than zero : Branch to statement at label's address if $t1 is greater than zero",
        BasicInstructionFormat.I_BRANCH_FORMAT,
        '000111 fffff 00000 ssssssssssssssss',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (this.host.registerFile.getValue(operands[0]) > 0) {
              this.processBranch(operands[1]);
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'blez $t1,label',
        "Branch if less than or equal to zero : Branch to statement at label's address if $t1 is less than or equal to zero",
        BasicInstructionFormat.I_BRANCH_FORMAT,
        '000110 fffff 00000 ssssssssssssssss',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (this.host.registerFile.getValue(operands[0]) <= 0) {
              this.processBranch(operands[1]);
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'bltz $t1,label',
        "Branch if less than zero : Branch to statement at label's address if $t1 is less than zero",
        BasicInstructionFormat.I_BRANCH_FORMAT,
        '000001 fffff 00000 ssssssssssssssss',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (this.host.registerFile.getValue(operands[0]) < 0) {
              this.processBranch(operands[1]);
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'bltzal $t1,label',
        "Branch if less than zero and link : If $t1 is less than or equal to zero, then set $ra to the Program Counter and branch to statement at label's address",
        BasicInstructionFormat.I_BRANCH_FORMAT,
        '000001 fffff 10000 ssssssssssssssss',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (this.host.registerFile.getValue(operands[0]) < 0) {
              this.processReturnAddress(31);
              this.processBranch(operands[1]);
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'slt $t1,$t2,$t3',
        'Set less than : If $t2 is less than $t3, then set $t1 to 1 else set $t1 to 0',
        BasicInstructionFormat.R_FORMAT,
        '000000 sssss ttttt fffff 00000 101010',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            this.host.registerFile.updateRegister(
              operands[0],
              this.host.registerFile.getValue(operands[1]) <
                this.host.registerFile.getValue(operands[2])
                ? 1
                : 0
            );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'sltu $t1,$t2,$t3',
        'Set less than unsigned : If $t2 is less than $t3 using unsigned comparision, then set $t1 to 1 else set $t1 to 0',
        BasicInstructionFormat.R_FORMAT,
        '000000 sssss ttttt fffff 00000 101011',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            const first = this.host.registerFile.getValue(operands[1]) | 0;
            const second = this.host.registerFile.getValue(operands[2]) | 0;
            if ((first >= 0 && second >= 0) || (first < 0 && second < 0)) {
              this.host.registerFile.updateRegister(operands[0], first < second ? 1 : 0);
            } else {
              this.host.registerFile.updateRegister(operands[0], first >= 0 ? 1 : 0);
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'slti $t1,$t2,-100',
        'Set less than immediate : If $t2 is less than sign-extended 16-bit immediate, then set $t1 to 1 else set $t1 to 0',
        BasicInstructionFormat.I_FORMAT,
        '001010 sssss fffff tttttttttttttttt',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            this.host.registerFile.updateRegister(
              operands[0],
              this.host.registerFile.getValue(operands[1]) < Binary.signExtend16(operands[2])
                ? 1
                : 0
            );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'sltiu $t1,$t2,-100',
        'Set less than immediate unsigned : If $t2 is less than  sign-extended 16-bit immediate using unsigned comparison, then set $t1 to 1 else set $t1 to 0',
        BasicInstructionFormat.I_FORMAT,
        '001011 sssss fffff tttttttttttttttt',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            const first = this.host.registerFile.getValue(operands[1]) | 0;
            const second = Binary.signExtend16(operands[2]) | 0;
            if ((first >= 0 && second >= 0) || (first < 0 && second < 0)) {
              this.host.registerFile.updateRegister(operands[0], first < second ? 1 : 0);
            } else {
              this.host.registerFile.updateRegister(operands[0], first >= 0 ? 1 : 0);
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'movn $t1,$t2,$t3',
        'Move conditional not zero : Set $t1 to $t2 if $t3 is not zero',
        BasicInstructionFormat.R_FORMAT,
        '000000 sssss ttttt fffff 00000 001011',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (this.host.registerFile.getValue(operands[2]) != 0)
              this.host.registerFile.updateRegister(
                operands[0],
                this.host.registerFile.getValue(operands[1])
              );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'movz $t1,$t2,$t3',
        'Move conditional zero : Set $t1 to $t2 if $t3 is zero',
        BasicInstructionFormat.R_FORMAT,
        '000000 sssss ttttt fffff 00000 001010',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (this.host.registerFile.getValue(operands[2]) == 0)
              this.host.registerFile.updateRegister(
                operands[0],
                this.host.registerFile.getValue(operands[1])
              );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'movf $t1,$t2',
        'Move if FP condition flag 0 false : Set $t1 to $t2 if FPU (Coprocessor 1) condition flag 0 is false (zero)',
        BasicInstructionFormat.R_FORMAT,
        '000000 sssss 000 00 fffff 00000 000001',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (this.host.coprocessor1.getConditionFlag(0) == 0)
              this.host.registerFile.updateRegister(
                operands[0],
                this.host.registerFile.getValue(operands[1])
              );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'movf $t1,$t2,1',
        'Move if specified FP condition flag false : Set $t1 to $t2 if FPU (Coprocessor 1) condition flag specified by the immediate is false (zero)',
        BasicInstructionFormat.R_FORMAT,
        '000000 sssss ttt 00 fffff 00000 000001',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (this.host.coprocessor1.getConditionFlag(operands[2]) == 0)
              this.host.registerFile.updateRegister(
                operands[0],
                this.host.registerFile.getValue(operands[1])
              );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'movt $t1,$t2',
        'Move if FP condition flag 0 true : Set $t1 to $t2 if FPU (Coprocessor 1) condition flag 0 is true (one)',
        BasicInstructionFormat.R_FORMAT,
        '000000 sssss 000 01 fffff 00000 000001',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (this.host.coprocessor1.getConditionFlag(0) == 1)
              this.host.registerFile.updateRegister(
                operands[0],
                this.host.registerFile.getValue(operands[1])
              );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'movt $t1,$t2,1',
        'Move if specfied FP condition flag true : Set $t1 to $t2 if FPU (Coprocessor 1) condition flag specified by the immediate is true (one)',
        BasicInstructionFormat.R_FORMAT,
        '000000 sssss ttt 01 fffff 00000 000001',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (this.host.coprocessor1.getConditionFlag(operands[2]) == 1)
              this.host.registerFile.updateRegister(
                operands[0],
                this.host.registerFile.getValue(operands[1])
              );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'break 100',
        'Break execution with code : Terminate program execution with specified exception code',
        BasicInstructionFormat.R_FORMAT,
        '000000 ffffffffffffffffffff 001101',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            throw this.failure(
              statement,
              'break instruction executed; code = ' + operands[0] + '.',
              Exceptions.BREAKPOINT_EXCEPTION
            );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'break',
        'Break execution : Terminate program execution with exception',
        BasicInstructionFormat.R_FORMAT,
        '000000 00000 00000 00000 00000 001101',
        {
          simulate: (statement) => {
            throw this.failure(
              statement,
              'break instruction executed; no code given.',
              Exceptions.BREAKPOINT_EXCEPTION
            );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'syscall',
        'Issue a system call : Execute the system call specified by value in $v0',
        BasicInstructionFormat.R_FORMAT,
        '000000 ccccc ccccc ccccc ccccc 001100',
        {
          simulate: (statement) => {
            return this.findAndSimulateSyscall(this.host.registerFile.getValue(2), statement);
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'j target',
        'Jump unconditionally : Jump to statement at target address',
        BasicInstructionFormat.J_FORMAT,
        '000010 ffffffffffffffffffffffffff',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            this.processJump(
              (this.host.registerFile.getProgramCounter() & 0xf0000000) | (operands[0] << 2)
            );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'jr $t1',
        'Jump register unconditionally : Jump to statement whose address is in $t1',
        BasicInstructionFormat.R_FORMAT,
        '000000 fffff 00000 00000 00000 001000',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            this.processJump(this.host.registerFile.getValue(operands[0]));
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'jal target',
        'Jump and link : Set $ra to Program Counter (return address) then jump to statement at target address',
        BasicInstructionFormat.J_FORMAT,
        '000011 ffffffffffffffffffffffffff',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            this.processReturnAddress(31);
            this.processJump(
              (this.host.registerFile.getProgramCounter() & 0xf0000000) | (operands[0] << 2)
            );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'jalr $t1,$t2',
        'Jump and link register : Set $t1 to Program Counter (return address) then jump to statement whose address is in $t2',
        BasicInstructionFormat.R_FORMAT,
        '000000 sssss 00000 fffff 00000 001001',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            this.processReturnAddress(operands[0]);
            this.processJump(this.host.registerFile.getValue(operands[1]));
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'jalr $t1',
        'Jump and link register : Set $ra to Program Counter (return address) then jump to statement whose address is in $t1',
        BasicInstructionFormat.R_FORMAT,
        '000000 fffff 00000 11111 00000 001001',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            this.processReturnAddress(31);
            this.processJump(this.host.registerFile.getValue(operands[0]));
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'lb $t1,-100($t2)',
        'Load byte : Set $t1 to sign-extended 8-bit value from effective memory byte address',
        BasicInstructionFormat.I_FORMAT,
        '100000 ttttt fffff ssssssssssssssss',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            try {
              this.host.registerFile.updateRegister(
                operands[0],
                (this.host.memory.getByte(
                  this.host.registerFile.getValue(operands[2]) + Binary.signExtend16(operands[1])
                ) <<
                  24) >>
                  24
              );
            } catch (e) {
              if (!(e instanceof AddressErrorException)) throw e;
              throw this.failure(statement, e);
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'lh $t1,-100($t2)',
        'Load halfword : Set $t1 to sign-extended 16-bit value from effective memory halfword address',
        BasicInstructionFormat.I_FORMAT,
        '100001 ttttt fffff ssssssssssssssss',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            try {
              this.host.registerFile.updateRegister(
                operands[0],
                Binary.signExtend16(
                  this.host.memory.getHalf(
                    this.host.registerFile.getValue(operands[2]) + Binary.signExtend16(operands[1])
                  )
                )
              );
            } catch (e) {
              if (!(e instanceof AddressErrorException)) throw e;
              throw this.failure(statement, e);
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'lhu $t1,-100($t2)',
        'Load halfword unsigned : Set $t1 to zero-extended 16-bit value from effective memory halfword address',
        BasicInstructionFormat.I_FORMAT,
        '100101 ttttt fffff ssssssssssssssss',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            try {
              this.host.registerFile.updateRegister(
                operands[0],
                this.host.memory.getHalf(
                  this.host.registerFile.getValue(operands[2]) + Binary.signExtend16(operands[1])
                ) & 0x0000ffff
              );
            } catch (e) {
              if (!(e instanceof AddressErrorException)) throw e;
              throw this.failure(statement, e);
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'lbu $t1,-100($t2)',
        'Load byte unsigned : Set $t1 to zero-extended 8-bit value from effective memory byte address',
        BasicInstructionFormat.I_FORMAT,
        '100100 ttttt fffff ssssssssssssssss',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            try {
              this.host.registerFile.updateRegister(
                operands[0],
                this.host.memory.getByte(
                  this.host.registerFile.getValue(operands[2]) + Binary.signExtend16(operands[1])
                ) & 0x000000ff
              );
            } catch (e) {
              if (!(e instanceof AddressErrorException)) throw e;
              throw this.failure(statement, e);
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'sb $t1,-100($t2)',
        'Store byte : Store the low-order 8 bits of $t1 into the effective memory byte address',
        BasicInstructionFormat.I_FORMAT,
        '101000 ttttt fffff ssssssssssssssss',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            try {
              this.host.memory.setByte(
                this.host.registerFile.getValue(operands[2]) + Binary.signExtend16(operands[1]),
                this.host.registerFile.getValue(operands[0]) & 0x000000ff
              );
            } catch (e) {
              if (!(e instanceof AddressErrorException)) throw e;
              throw this.failure(statement, e);
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'sh $t1,-100($t2)',
        'Store halfword : Store the low-order 16 bits of $t1 into the effective memory halfword address',
        BasicInstructionFormat.I_FORMAT,
        '101001 ttttt fffff ssssssssssssssss',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            try {
              this.host.memory.setHalf(
                this.host.registerFile.getValue(operands[2]) + Binary.signExtend16(operands[1]),
                this.host.registerFile.getValue(operands[0]) & 0x0000ffff
              );
            } catch (e) {
              if (!(e instanceof AddressErrorException)) throw e;
              throw this.failure(statement, e);
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'clo $t1,$t2',
        'Count number of leading ones : Set $t1 to the count of leading one bits in $t2 starting at most significant bit position',
        BasicInstructionFormat.R_FORMAT,
        '011100 sssss 00000 fffff 00000 100001',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            const value = this.host.registerFile.getValue(operands[1]) | 0;
            let leadingOnes = 0 | 0;
            let bitPosition = 31 | 0;
            while (Binary.bitValue(value, bitPosition) == 1 && bitPosition >= 0) {
              leadingOnes++;
              bitPosition--;
            }
            this.host.registerFile.updateRegister(operands[0], leadingOnes);
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'clz $t1,$t2',
        'Count number of leading zeroes : Set $t1 to the count of leading zero bits in $t2 starting at most significant bit positio',
        BasicInstructionFormat.R_FORMAT,
        '011100 sssss 00000 fffff 00000 100000',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            const value = this.host.registerFile.getValue(operands[1]) | 0;
            let leadingZeros = 0 | 0;
            let bitPosition = 31 | 0;
            while (Binary.bitValue(value, bitPosition) == 0 && bitPosition >= 0) {
              leadingZeros++;
              bitPosition--;
            }
            this.host.registerFile.updateRegister(operands[0], leadingZeros);
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'mfc0 $t1,$8',
        'Move from Coprocessor 0 : Set $t1 to the value stored in Coprocessor 0 register $8',
        BasicInstructionFormat.R_FORMAT,
        '010000 00000 fffff sssss 00000 000000',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            this.host.registerFile.updateRegister(
              operands[0],
              this.host.coprocessor0.getValue(operands[1])
            );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'mtc0 $t1,$8',
        'Move to Coprocessor 0 : Set Coprocessor 0 register $8 to value stored in $t1',
        BasicInstructionFormat.R_FORMAT,
        '010000 00100 fffff sssss 00000 000000',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            this.host.coprocessor0.updateRegister(
              operands[1],
              this.host.registerFile.getValue(operands[0])
            );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'add.s $f0,$f1,$f3',
        'Floating point addition single precision : Set $f0 to single-precision floating point value of $f1 plus $f3',
        BasicInstructionFormat.R_FORMAT,
        '010001 10000 ttttt sssss fffff 000000',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            const add1 = Math.fround(
              this.intBitsToFloat(this.host.coprocessor1.getValue(operands[1]))
            );
            const add2 = Math.fround(
              this.intBitsToFloat(this.host.coprocessor1.getValue(operands[2]))
            );
            const sum = Math.fround(add1 + add2);
            this.host.coprocessor1.updateRegister(
              operands[0],
              JavaFloatingPoint.floatToIntBits(sum, this.bits)
            );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'sub.s $f0,$f1,$f3',
        'Floating point subtraction single precision : Set $f0 to single-precision floating point value of $f1  minus $f3',
        BasicInstructionFormat.R_FORMAT,
        '010001 10000 ttttt sssss fffff 000001',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            const sub1 = Math.fround(
              this.intBitsToFloat(this.host.coprocessor1.getValue(operands[1]))
            );
            const sub2 = Math.fround(
              this.intBitsToFloat(this.host.coprocessor1.getValue(operands[2]))
            );
            const diff = Math.fround(sub1 - sub2);
            this.host.coprocessor1.updateRegister(
              operands[0],
              JavaFloatingPoint.floatToIntBits(diff, this.bits)
            );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'mul.s $f0,$f1,$f3',
        'Floating point multiplication single precision : Set $f0 to single-precision floating point value of $f1 times $f3',
        BasicInstructionFormat.R_FORMAT,
        '010001 10000 ttttt sssss fffff 000010',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            const mul1 = Math.fround(
              this.intBitsToFloat(this.host.coprocessor1.getValue(operands[1]))
            );
            const mul2 = Math.fround(
              this.intBitsToFloat(this.host.coprocessor1.getValue(operands[2]))
            );
            const prod = Math.fround(mul1 * mul2);
            this.host.coprocessor1.updateRegister(
              operands[0],
              JavaFloatingPoint.floatToIntBits(prod, this.bits)
            );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'div.s $f0,$f1,$f3',
        'Floating point division single precision : Set $f0 to single-precision floating point value of $f1 divided by $f3',
        BasicInstructionFormat.R_FORMAT,
        '010001 10000 ttttt sssss fffff 000011',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            const div1 = Math.fround(
              this.intBitsToFloat(this.host.coprocessor1.getValue(operands[1]))
            );
            const div2 = Math.fround(
              this.intBitsToFloat(this.host.coprocessor1.getValue(operands[2]))
            );
            const quot = Math.fround(div1 / div2);
            this.host.coprocessor1.updateRegister(
              operands[0],
              JavaFloatingPoint.floatToIntBits(quot, this.bits)
            );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'sqrt.s $f0,$f1',
        'Square root single precision : Set $f0 to single-precision floating point square root of $f1',
        BasicInstructionFormat.R_FORMAT,
        '010001 10000 00000 sssss fffff 000100',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            const value = Math.fround(
              this.intBitsToFloat(this.host.coprocessor1.getValue(operands[1]))
            );
            let floatSqrt: number;
            if (value < 0.0) {
              floatSqrt = JavaFloatingPoint.floatToIntBits(NaN, this.bits);
            } else {
              floatSqrt = JavaFloatingPoint.floatToIntBits(
                Math.fround(Math.sqrt(value)),
                this.bits
              );
            }
            this.host.coprocessor1.updateRegister(operands[0], floatSqrt);
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'floor.w.s $f0,$f1',
        'Floor single precision to word : Set $f0 to 32-bit integer floor of single-precision float in $f1',
        BasicInstructionFormat.R_FORMAT,
        '010001 10000 00000 sssss fffff 001111',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            const floatValue = Math.fround(
              this.intBitsToFloat(this.host.coprocessor1.getValue(operands[1]))
            );
            let floor = JavaFloatingPoint.doubleToInt(Math.floor(floatValue)) | 0;
            if (
              Number.isNaN(floatValue) ||
              this.isInfinite(floatValue) ||
              floatValue < Math.fround(-2147483648) ||
              floatValue > Math.fround(2147483647)
            ) {
              floor = 2147483647;
            }
            this.host.coprocessor1.updateRegister(operands[0], floor);
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'ceil.w.s $f0,$f1',
        'Ceiling single precision to word : Set $f0 to 32-bit integer ceiling of single-precision float in $f1',
        BasicInstructionFormat.R_FORMAT,
        '010001 10000 00000 sssss fffff 001110',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            const floatValue = Math.fround(
              this.intBitsToFloat(this.host.coprocessor1.getValue(operands[1]))
            );
            let ceiling = JavaFloatingPoint.doubleToInt(Math.ceil(floatValue)) | 0;
            if (
              Number.isNaN(floatValue) ||
              this.isInfinite(floatValue) ||
              floatValue < Math.fround(-2147483648) ||
              floatValue > Math.fround(2147483647)
            ) {
              ceiling = 2147483647;
            }
            this.host.coprocessor1.updateRegister(operands[0], ceiling);
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'round.w.s $f0,$f1',
        'Round single precision to word : Set $f0 to 32-bit integer round of single-precision float in $f1',
        BasicInstructionFormat.R_FORMAT,
        '010001 10000 00000 sssss fffff 001100',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            const floatValue = Math.fround(
              this.intBitsToFloat(this.host.coprocessor1.getValue(operands[1]))
            );
            let below: number, above: number;
            let round = JavaFloatingPoint.doubleToInt(Math.round(floatValue));
            if (
              Number.isNaN(floatValue) ||
              this.isInfinite(floatValue) ||
              floatValue < Math.fround(-2147483648) ||
              floatValue > Math.fround(2147483647)
            ) {
              round = 2147483647;
            } else {
              if (floatValue < 0.0) {
                above = JavaFloatingPoint.doubleToInt(floatValue);
                below = (above - 1) | 0;
              } else {
                below = JavaFloatingPoint.doubleToInt(floatValue);
                above = (below + 1) | 0;
              }
              if (
                Math.fround(floatValue - Math.fround(below)) ==
                Math.fround(Math.fround(above) - floatValue)
              ) {
                round = above % 2 == 0 ? above : below;
              }
            }
            this.host.coprocessor1.updateRegister(operands[0], round);
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'trunc.w.s $f0,$f1',
        'Truncate single precision to word : Set $f0 to 32-bit integer truncation of single-precision float in $f1',
        BasicInstructionFormat.R_FORMAT,
        '010001 10000 00000 sssss fffff 001101',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            const floatValue = Math.fround(
              this.intBitsToFloat(this.host.coprocessor1.getValue(operands[1]))
            );
            let truncate = JavaFloatingPoint.doubleToInt(floatValue) | 0;
            if (
              Number.isNaN(floatValue) ||
              this.isInfinite(floatValue) ||
              floatValue < Math.fround(-2147483648) ||
              floatValue > Math.fround(2147483647)
            ) {
              truncate = 2147483647;
            }
            this.host.coprocessor1.updateRegister(operands[0], truncate);
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'add.d $f2,$f4,$f6',
        'Floating point addition double precision : Set $f2 to double-precision floating point value of $f4 plus $f6',
        BasicInstructionFormat.R_FORMAT,
        '010001 10001 ttttt sssss fffff 000000',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (operands[0] % 2 == 1 || operands[1] % 2 == 1 || operands[2] % 2 == 1) {
              throw this.failure(statement, 'all registers must be even-numbered');
            }
            const add1 = this.longBitsToDouble(
              Binary.twoIntsToLong(
                this.host.coprocessor1.getValue(operands[1] + 1),
                this.host.coprocessor1.getValue(operands[1])
              )
            );
            const add2 = this.longBitsToDouble(
              Binary.twoIntsToLong(
                this.host.coprocessor1.getValue(operands[2] + 1),
                this.host.coprocessor1.getValue(operands[2])
              )
            );
            const sum = add1 + add2;
            const longSum = this.doubleToLongBits(sum);
            this.host.coprocessor1.updateRegister(
              operands[0] + 1,
              Binary.highOrderLongToInt(longSum)
            );
            this.host.coprocessor1.updateRegister(operands[0], Binary.lowOrderLongToInt(longSum));
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'sub.d $f2,$f4,$f6',
        'Floating point subtraction double precision : Set $f2 to double-precision floating point value of $f4 minus $f6',
        BasicInstructionFormat.R_FORMAT,
        '010001 10001 ttttt sssss fffff 000001',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (operands[0] % 2 == 1 || operands[1] % 2 == 1 || operands[2] % 2 == 1) {
              throw this.failure(statement, 'all registers must be even-numbered');
            }
            const sub1 = this.longBitsToDouble(
              Binary.twoIntsToLong(
                this.host.coprocessor1.getValue(operands[1] + 1),
                this.host.coprocessor1.getValue(operands[1])
              )
            );
            const sub2 = this.longBitsToDouble(
              Binary.twoIntsToLong(
                this.host.coprocessor1.getValue(operands[2] + 1),
                this.host.coprocessor1.getValue(operands[2])
              )
            );
            const diff = sub1 - sub2;
            const longDiff = this.doubleToLongBits(diff);
            this.host.coprocessor1.updateRegister(
              operands[0] + 1,
              Binary.highOrderLongToInt(longDiff)
            );
            this.host.coprocessor1.updateRegister(operands[0], Binary.lowOrderLongToInt(longDiff));
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'mul.d $f2,$f4,$f6',
        'Floating point multiplication double precision : Set $f2 to double-precision floating point value of $f4 times $f6',
        BasicInstructionFormat.R_FORMAT,
        '010001 10001 ttttt sssss fffff 000010',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (operands[0] % 2 == 1 || operands[1] % 2 == 1 || operands[2] % 2 == 1) {
              throw this.failure(statement, 'all registers must be even-numbered');
            }
            const mul1 = this.longBitsToDouble(
              Binary.twoIntsToLong(
                this.host.coprocessor1.getValue(operands[1] + 1),
                this.host.coprocessor1.getValue(operands[1])
              )
            );
            const mul2 = this.longBitsToDouble(
              Binary.twoIntsToLong(
                this.host.coprocessor1.getValue(operands[2] + 1),
                this.host.coprocessor1.getValue(operands[2])
              )
            );
            const prod = mul1 * mul2;
            const longProd = this.doubleToLongBits(prod);
            this.host.coprocessor1.updateRegister(
              operands[0] + 1,
              Binary.highOrderLongToInt(longProd)
            );
            this.host.coprocessor1.updateRegister(operands[0], Binary.lowOrderLongToInt(longProd));
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'div.d $f2,$f4,$f6',
        'Floating point division double precision : Set $f2 to double-precision floating point value of $f4 divided by $f6',
        BasicInstructionFormat.R_FORMAT,
        '010001 10001 ttttt sssss fffff 000011',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (operands[0] % 2 == 1 || operands[1] % 2 == 1 || operands[2] % 2 == 1) {
              throw this.failure(statement, 'all registers must be even-numbered');
            }
            const div1 = this.longBitsToDouble(
              Binary.twoIntsToLong(
                this.host.coprocessor1.getValue(operands[1] + 1),
                this.host.coprocessor1.getValue(operands[1])
              )
            );
            const div2 = this.longBitsToDouble(
              Binary.twoIntsToLong(
                this.host.coprocessor1.getValue(operands[2] + 1),
                this.host.coprocessor1.getValue(operands[2])
              )
            );
            const quot = div1 / div2;
            const longQuot = this.doubleToLongBits(quot);
            this.host.coprocessor1.updateRegister(
              operands[0] + 1,
              Binary.highOrderLongToInt(longQuot)
            );
            this.host.coprocessor1.updateRegister(operands[0], Binary.lowOrderLongToInt(longQuot));
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'sqrt.d $f2,$f4',
        'Square root double precision : Set $f2 to double-precision floating point square root of $f4',
        BasicInstructionFormat.R_FORMAT,
        '010001 10001 00000 sssss fffff 000100',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (operands[0] % 2 == 1 || operands[1] % 2 == 1 || operands[2] % 2 == 1) {
              throw this.failure(statement, 'both registers must be even-numbered');
            }
            const value = this.longBitsToDouble(
              Binary.twoIntsToLong(
                this.host.coprocessor1.getValue(operands[1] + 1),
                this.host.coprocessor1.getValue(operands[1])
              )
            );
            let longSqrt: bigint;
            if (value < 0.0) {
              longSqrt = this.doubleToLongBits(NaN);
            } else {
              longSqrt = this.doubleToLongBits(Math.sqrt(value));
            }
            this.host.coprocessor1.updateRegister(
              operands[0] + 1,
              Binary.highOrderLongToInt(longSqrt)
            );
            this.host.coprocessor1.updateRegister(operands[0], Binary.lowOrderLongToInt(longSqrt));
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'floor.w.d $f1,$f2',
        'Floor double precision to word : Set $f1 to 32-bit integer floor of double-precision float in $f2',
        BasicInstructionFormat.R_FORMAT,
        '010001 10001 00000 sssss fffff 001111',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (operands[1] % 2 == 1) {
              throw this.failure(statement, 'second register must be even-numbered');
            }
            const doubleValue = this.longBitsToDouble(
              Binary.twoIntsToLong(
                this.host.coprocessor1.getValue(operands[1] + 1),
                this.host.coprocessor1.getValue(operands[1])
              )
            );
            let floor = JavaFloatingPoint.doubleToInt(Math.floor(doubleValue)) | 0;
            if (
              Number.isNaN(doubleValue) ||
              this.isInfinite(doubleValue) ||
              doubleValue < Number(-2147483648) ||
              doubleValue > Number(2147483647)
            ) {
              floor = 2147483647;
            }
            this.host.coprocessor1.updateRegister(operands[0], floor);
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'ceil.w.d $f1,$f2',
        'Ceiling double precision to word : Set $f1 to 32-bit integer ceiling of double-precision float in $f2',
        BasicInstructionFormat.R_FORMAT,
        '010001 10001 00000 sssss fffff 001110',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (operands[1] % 2 == 1) {
              throw this.failure(statement, 'second register must be even-numbered');
            }
            const doubleValue = this.longBitsToDouble(
              Binary.twoIntsToLong(
                this.host.coprocessor1.getValue(operands[1] + 1),
                this.host.coprocessor1.getValue(operands[1])
              )
            );
            let ceiling = JavaFloatingPoint.doubleToInt(Math.ceil(doubleValue)) | 0;
            if (
              Number.isNaN(doubleValue) ||
              this.isInfinite(doubleValue) ||
              doubleValue < Number(-2147483648) ||
              doubleValue > Number(2147483647)
            ) {
              ceiling = 2147483647;
            }
            this.host.coprocessor1.updateRegister(operands[0], ceiling);
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'round.w.d $f1,$f2',
        'Round double precision to word : Set $f1 to 32-bit integer round of double-precision float in $f2',
        BasicInstructionFormat.R_FORMAT,
        '010001 10001 00000 sssss fffff 001100',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (operands[1] % 2 == 1) {
              throw this.failure(statement, 'second register must be even-numbered');
            }
            const doubleValue = this.longBitsToDouble(
              Binary.twoIntsToLong(
                this.host.coprocessor1.getValue(operands[1] + 1),
                this.host.coprocessor1.getValue(operands[1])
              )
            );
            let below: number, above: number;
            let round = JavaFloatingPoint.doubleToInt(Math.round(doubleValue)) | 0;
            if (
              Number.isNaN(doubleValue) ||
              this.isInfinite(doubleValue) ||
              doubleValue < Number(-2147483648) ||
              doubleValue > Number(2147483647)
            ) {
              round = 2147483647;
            } else {
              if (doubleValue < 0.0) {
                above = JavaFloatingPoint.doubleToInt(doubleValue);
                below = (above - 1) | 0;
              } else {
                below = JavaFloatingPoint.doubleToInt(doubleValue);
                above = (below + 1) | 0;
              }
              if (doubleValue - below == above - doubleValue) {
                round = above % 2 == 0 ? above : below;
              }
            }
            this.host.coprocessor1.updateRegister(operands[0], round);
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'trunc.w.d $f1,$f2',
        'Truncate double precision to word : Set $f1 to 32-bit integer truncation of double-precision float in $f2',
        BasicInstructionFormat.R_FORMAT,
        '010001 10001 00000 sssss fffff 001101',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (operands[1] % 2 == 1) {
              throw this.failure(statement, 'second register must be even-numbered');
            }
            const doubleValue = this.longBitsToDouble(
              Binary.twoIntsToLong(
                this.host.coprocessor1.getValue(operands[1] + 1),
                this.host.coprocessor1.getValue(operands[1])
              )
            );
            let truncate = JavaFloatingPoint.doubleToInt(doubleValue) | 0;
            if (
              Number.isNaN(doubleValue) ||
              this.isInfinite(doubleValue) ||
              doubleValue < Number(-2147483648) ||
              doubleValue > Number(2147483647)
            ) {
              truncate = 2147483647;
            }
            this.host.coprocessor1.updateRegister(operands[0], truncate);
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'bc1t label',
        "Branch if FP condition flag 0 true (BC1T, not BCLT) : If Coprocessor 1 condition flag 0 is true (one) then branch to statement at label's address",
        BasicInstructionFormat.I_BRANCH_FORMAT,
        '010001 01000 00001 ffffffffffffffff',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (this.host.coprocessor1.getConditionFlag(0) == 1) {
              this.processBranch(operands[0]);
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'bc1t 1,label',
        "Branch if specified FP condition flag true (BC1T, not BCLT) : If Coprocessor 1 condition flag specified by immediate is true (one) then branch to statement at label's address",
        BasicInstructionFormat.I_BRANCH_FORMAT,
        '010001 01000 fff 01 ssssssssssssssss',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (this.host.coprocessor1.getConditionFlag(operands[0]) == 1) {
              this.processBranch(operands[1]);
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'bc1f label',
        "Branch if FP condition flag 0 false (BC1F, not BCLF) : If Coprocessor 1 condition flag 0 is false (zero) then branch to statement at label's address",
        BasicInstructionFormat.I_BRANCH_FORMAT,
        '010001 01000 00000 ffffffffffffffff',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (this.host.coprocessor1.getConditionFlag(0) == 0) {
              this.processBranch(operands[0]);
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'bc1f 1,label',
        "Branch if specified FP condition flag false (BC1F, not BCLF) : If Coprocessor 1 condition flag specified by immediate is false (zero) then branch to statement at label's address",
        BasicInstructionFormat.I_BRANCH_FORMAT,
        '010001 01000 fff 00 ssssssssssssssss',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (this.host.coprocessor1.getConditionFlag(operands[0]) == 0) {
              this.processBranch(operands[1]);
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'c.eq.s $f0,$f1',
        'Compare equal single precision : If $f0 is equal to $f1, set Coprocessor 1 condition flag 0 true else set it false',
        BasicInstructionFormat.R_FORMAT,
        '010001 10000 sssss fffff 00000 110010',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            const op1 = Math.fround(
              this.intBitsToFloat(this.host.coprocessor1.getValue(operands[0]))
            );
            const op2 = Math.fround(
              this.intBitsToFloat(this.host.coprocessor1.getValue(operands[1]))
            );
            if (op1 == op2) this.host.coprocessor1.setConditionFlag(0);
            else this.host.coprocessor1.clearConditionFlag(0);
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'c.eq.s 1,$f0,$f1',
        'Compare equal single precision : If $f0 is equal to $f1, set Coprocessor 1 condition flag specied by immediate to true else set it to false',
        BasicInstructionFormat.R_FORMAT,
        '010001 10000 ttttt sssss fff 00 11 0010',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            const op1 = Math.fround(
              this.intBitsToFloat(this.host.coprocessor1.getValue(operands[1]))
            );
            const op2 = Math.fround(
              this.intBitsToFloat(this.host.coprocessor1.getValue(operands[2]))
            );
            if (op1 == op2) this.host.coprocessor1.setConditionFlag(operands[0]);
            else this.host.coprocessor1.clearConditionFlag(operands[0]);
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'c.le.s $f0,$f1',
        'Compare less or equal single precision : If $f0 is less than or equal to $f1, set Coprocessor 1 condition flag 0 true else set it false',
        BasicInstructionFormat.R_FORMAT,
        '010001 10000 sssss fffff 00000 111110',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            const op1 = Math.fround(
              this.intBitsToFloat(this.host.coprocessor1.getValue(operands[0]))
            );
            const op2 = Math.fround(
              this.intBitsToFloat(this.host.coprocessor1.getValue(operands[1]))
            );
            if (op1 <= op2) this.host.coprocessor1.setConditionFlag(0);
            else this.host.coprocessor1.clearConditionFlag(0);
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'c.le.s 1,$f0,$f1',
        'Compare less or equal single precision : If $f0 is less than or equal to $f1, set Coprocessor 1 condition flag specified by immediate to true else set it to false',
        BasicInstructionFormat.R_FORMAT,
        '010001 10000 ttttt sssss fff 00 111110',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            const op1 = Math.fround(
              this.intBitsToFloat(this.host.coprocessor1.getValue(operands[1]))
            );
            const op2 = Math.fround(
              this.intBitsToFloat(this.host.coprocessor1.getValue(operands[2]))
            );
            if (op1 <= op2) this.host.coprocessor1.setConditionFlag(operands[0]);
            else this.host.coprocessor1.clearConditionFlag(operands[0]);
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'c.lt.s $f0,$f1',
        'Compare less than single precision : If $f0 is less than $f1, set Coprocessor 1 condition flag 0 true else set it false',
        BasicInstructionFormat.R_FORMAT,
        '010001 10000 sssss fffff 00000 111100',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            const op1 = Math.fround(
              this.intBitsToFloat(this.host.coprocessor1.getValue(operands[0]))
            );
            const op2 = Math.fround(
              this.intBitsToFloat(this.host.coprocessor1.getValue(operands[1]))
            );
            if (op1 < op2) this.host.coprocessor1.setConditionFlag(0);
            else this.host.coprocessor1.clearConditionFlag(0);
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'c.lt.s 1,$f0,$f1',
        'Compare less than single precision : If $f0 is less than $f1, set Coprocessor 1 condition flag specified by immediate to true else set it to false',
        BasicInstructionFormat.R_FORMAT,
        '010001 10000 ttttt sssss fff 00 111100',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            const op1 = Math.fround(
              this.intBitsToFloat(this.host.coprocessor1.getValue(operands[1]))
            );
            const op2 = Math.fround(
              this.intBitsToFloat(this.host.coprocessor1.getValue(operands[2]))
            );
            if (op1 < op2) this.host.coprocessor1.setConditionFlag(operands[0]);
            else this.host.coprocessor1.clearConditionFlag(operands[0]);
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'c.eq.d $f2,$f4',
        'Compare equal double precision : If $f2 is equal to $f4 (double-precision), set Coprocessor 1 condition flag 0 true else set it false',
        BasicInstructionFormat.R_FORMAT,
        '010001 10001 sssss fffff 00000 110010',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (operands[0] % 2 == 1 || operands[1] % 2 == 1) {
              throw this.failure(statement, 'both registers must be even-numbered');
            }
            const op1 = this.longBitsToDouble(
              Binary.twoIntsToLong(
                this.host.coprocessor1.getValue(operands[0] + 1),
                this.host.coprocessor1.getValue(operands[0])
              )
            );
            const op2 = this.longBitsToDouble(
              Binary.twoIntsToLong(
                this.host.coprocessor1.getValue(operands[1] + 1),
                this.host.coprocessor1.getValue(operands[1])
              )
            );
            if (op1 == op2) this.host.coprocessor1.setConditionFlag(0);
            else this.host.coprocessor1.clearConditionFlag(0);
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'c.eq.d 1,$f2,$f4',
        'Compare equal double precision : If $f2 is equal to $f4 (double-precision), set Coprocessor 1 condition flag specified by immediate to true else set it to false',
        BasicInstructionFormat.R_FORMAT,
        '010001 10001 ttttt sssss fff 00 110010',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (operands[1] % 2 == 1 || operands[2] % 2 == 1) {
              throw this.failure(statement, 'both registers must be even-numbered');
            }
            const op1 = this.longBitsToDouble(
              Binary.twoIntsToLong(
                this.host.coprocessor1.getValue(operands[1] + 1),
                this.host.coprocessor1.getValue(operands[1])
              )
            );
            const op2 = this.longBitsToDouble(
              Binary.twoIntsToLong(
                this.host.coprocessor1.getValue(operands[2] + 1),
                this.host.coprocessor1.getValue(operands[2])
              )
            );
            if (op1 == op2) this.host.coprocessor1.setConditionFlag(operands[0]);
            else this.host.coprocessor1.clearConditionFlag(operands[0]);
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'c.le.d $f2,$f4',
        'Compare less or equal double precision : If $f2 is less than or equal to $f4 (double-precision), set Coprocessor 1 condition flag 0 true else set it false',
        BasicInstructionFormat.R_FORMAT,
        '010001 10001 sssss fffff 00000 111110',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (operands[0] % 2 == 1 || operands[1] % 2 == 1) {
              throw this.failure(statement, 'both registers must be even-numbered');
            }
            const op1 = this.longBitsToDouble(
              Binary.twoIntsToLong(
                this.host.coprocessor1.getValue(operands[0] + 1),
                this.host.coprocessor1.getValue(operands[0])
              )
            );
            const op2 = this.longBitsToDouble(
              Binary.twoIntsToLong(
                this.host.coprocessor1.getValue(operands[1] + 1),
                this.host.coprocessor1.getValue(operands[1])
              )
            );
            if (op1 <= op2) this.host.coprocessor1.setConditionFlag(0);
            else this.host.coprocessor1.clearConditionFlag(0);
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'c.le.d 1,$f2,$f4',
        'Compare less or equal double precision : If $f2 is less than or equal to $f4 (double-precision), set Coprocessor 1 condition flag specfied by immediate true else set it false',
        BasicInstructionFormat.R_FORMAT,
        '010001 10001 ttttt sssss fff 00 111110',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (operands[1] % 2 == 1 || operands[2] % 2 == 1) {
              throw this.failure(statement, 'both registers must be even-numbered');
            }
            const op1 = this.longBitsToDouble(
              Binary.twoIntsToLong(
                this.host.coprocessor1.getValue(operands[1] + 1),
                this.host.coprocessor1.getValue(operands[1])
              )
            );
            const op2 = this.longBitsToDouble(
              Binary.twoIntsToLong(
                this.host.coprocessor1.getValue(operands[2] + 1),
                this.host.coprocessor1.getValue(operands[2])
              )
            );
            if (op1 <= op2) this.host.coprocessor1.setConditionFlag(operands[0]);
            else this.host.coprocessor1.clearConditionFlag(operands[0]);
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'c.lt.d $f2,$f4',
        'Compare less than double precision : If $f2 is less than $f4 (double-precision), set Coprocessor 1 condition flag 0 true else set it false',
        BasicInstructionFormat.R_FORMAT,
        '010001 10001 sssss fffff 00000 111100',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (operands[0] % 2 == 1 || operands[1] % 2 == 1) {
              throw this.failure(statement, 'both registers must be even-numbered');
            }
            const op1 = this.longBitsToDouble(
              Binary.twoIntsToLong(
                this.host.coprocessor1.getValue(operands[0] + 1),
                this.host.coprocessor1.getValue(operands[0])
              )
            );
            const op2 = this.longBitsToDouble(
              Binary.twoIntsToLong(
                this.host.coprocessor1.getValue(operands[1] + 1),
                this.host.coprocessor1.getValue(operands[1])
              )
            );
            if (op1 < op2) this.host.coprocessor1.setConditionFlag(0);
            else this.host.coprocessor1.clearConditionFlag(0);
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'c.lt.d 1,$f2,$f4',
        'Compare less than double precision : If $f2 is less than $f4 (double-precision), set Coprocessor 1 condition flag specified by immediate to true else set it to false',
        BasicInstructionFormat.R_FORMAT,
        '010001 10001 ttttt sssss fff 00 111100',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (operands[1] % 2 == 1 || operands[2] % 2 == 1) {
              throw this.failure(statement, 'both registers must be even-numbered');
            }
            const op1 = this.longBitsToDouble(
              Binary.twoIntsToLong(
                this.host.coprocessor1.getValue(operands[1] + 1),
                this.host.coprocessor1.getValue(operands[1])
              )
            );
            const op2 = this.longBitsToDouble(
              Binary.twoIntsToLong(
                this.host.coprocessor1.getValue(operands[2] + 1),
                this.host.coprocessor1.getValue(operands[2])
              )
            );
            if (op1 < op2) this.host.coprocessor1.setConditionFlag(operands[0]);
            else this.host.coprocessor1.clearConditionFlag(operands[0]);
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'abs.s $f0,$f1',
        'Floating point absolute value single precision : Set $f0 to absolute value of $f1, single precision',
        BasicInstructionFormat.R_FORMAT,
        '010001 10000 00000 sssss fffff 000101',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            this.host.coprocessor1.updateRegister(
              operands[0],
              this.host.coprocessor1.getValue(operands[1]) & 2147483647
            );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'abs.d $f2,$f4',
        'Floating point absolute value double precision : Set $f2 to absolute value of $f4, double precision',
        BasicInstructionFormat.R_FORMAT,
        '010001 10001 00000 sssss fffff 000101',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (operands[0] % 2 == 1 || operands[1] % 2 == 1) {
              throw this.failure(statement, 'both registers must be even-numbered');
            }
            this.host.coprocessor1.updateRegister(
              operands[0] + 1,
              this.host.coprocessor1.getValue(operands[1] + 1) & 2147483647
            );
            this.host.coprocessor1.updateRegister(
              operands[0],
              this.host.coprocessor1.getValue(operands[1])
            );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'cvt.d.s $f2,$f1',
        'Convert from single precision to double precision : Set $f2 to double precision equivalent of single precision value in $f1',
        BasicInstructionFormat.R_FORMAT,
        '010001 10000 00000 sssss fffff 100001',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (operands[0] % 2 == 1) {
              throw this.failure(statement, 'first register must be even-numbered');
            }
            const result = this.doubleToLongBits(
              Number(this.intBitsToFloat(this.host.coprocessor1.getValue(operands[1])))
            );
            this.host.coprocessor1.updateRegister(
              operands[0] + 1,
              Binary.highOrderLongToInt(result)
            );
            this.host.coprocessor1.updateRegister(operands[0], Binary.lowOrderLongToInt(result));
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'cvt.d.w $f2,$f1',
        'Convert from word to double precision : Set $f2 to double precision equivalent of 32-bit integer value in $f1',
        BasicInstructionFormat.R_FORMAT,
        '010001 10100 00000 sssss fffff 100001',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (operands[0] % 2 == 1) {
              throw this.failure(statement, 'first register must be even-numbered');
            }
            const result = this.doubleToLongBits(
              Number(this.host.coprocessor1.getValue(operands[1]))
            );
            this.host.coprocessor1.updateRegister(
              operands[0] + 1,
              Binary.highOrderLongToInt(result)
            );
            this.host.coprocessor1.updateRegister(operands[0], Binary.lowOrderLongToInt(result));
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'cvt.s.d $f1,$f2',
        'Convert from double precision to single precision : Set $f1 to single precision equivalent of double precision value in $f2',
        BasicInstructionFormat.R_FORMAT,
        '010001 10001 00000 sssss fffff 100000',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (operands[1] % 2 == 1) {
              throw this.failure(statement, 'second register must be even-numbered');
            }
            const val = this.longBitsToDouble(
              Binary.twoIntsToLong(
                this.host.coprocessor1.getValue(operands[1] + 1),
                this.host.coprocessor1.getValue(operands[1])
              )
            );
            this.host.coprocessor1.updateRegister(
              operands[0],
              JavaFloatingPoint.floatToIntBits(Math.fround(val), this.bits)
            );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'cvt.s.w $f0,$f1',
        'Convert from word to single precision : Set $f0 to single precision equivalent of 32-bit integer value in $f2',
        BasicInstructionFormat.R_FORMAT,
        '010001 10100 00000 sssss fffff 100000',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            this.host.coprocessor1.updateRegister(
              operands[0],
              JavaFloatingPoint.floatToIntBits(
                Math.fround(this.host.coprocessor1.getValue(operands[1])),
                this.bits
              )
            );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'cvt.w.d $f1,$f2',
        'Convert from double precision to word : Set $f1 to 32-bit integer equivalent of double precision value in $f2',
        BasicInstructionFormat.R_FORMAT,
        '010001 10001 00000 sssss fffff 100100',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (operands[1] % 2 == 1) {
              throw this.failure(statement, 'second register must be even-numbered');
            }
            const val = this.longBitsToDouble(
              Binary.twoIntsToLong(
                this.host.coprocessor1.getValue(operands[1] + 1),
                this.host.coprocessor1.getValue(operands[1])
              )
            );
            this.host.coprocessor1.updateRegister(operands[0], JavaFloatingPoint.doubleToInt(val));
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'cvt.w.s $f0,$f1',
        'Convert from single precision to word : Set $f0 to 32-bit integer equivalent of single precision value in $f1',
        BasicInstructionFormat.R_FORMAT,
        '010001 10000 00000 sssss fffff 100100',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            this.host.coprocessor1.updateRegister(
              operands[0],
              JavaFloatingPoint.doubleToInt(
                this.intBitsToFloat(this.host.coprocessor1.getValue(operands[1]))
              )
            );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'mov.d $f2,$f4',
        'Move floating point double precision : Set double precision $f2 to double precision value in $f4',
        BasicInstructionFormat.R_FORMAT,
        '010001 10001 00000 sssss fffff 000110',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (operands[0] % 2 == 1 || operands[1] % 2 == 1) {
              throw this.failure(statement, 'both registers must be even-numbered');
            }
            this.host.coprocessor1.updateRegister(
              operands[0],
              this.host.coprocessor1.getValue(operands[1])
            );
            this.host.coprocessor1.updateRegister(
              operands[0] + 1,
              this.host.coprocessor1.getValue(operands[1] + 1)
            );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'movf.d $f2,$f4',
        'Move floating point double precision : If condition flag 0 false, set double precision $f2 to double precision value in $f4',
        BasicInstructionFormat.R_FORMAT,
        '010001 10001 000 00 sssss fffff 010001',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (operands[0] % 2 == 1 || operands[1] % 2 == 1) {
              throw this.failure(statement, 'both registers must be even-numbered');
            }
            if (this.host.coprocessor1.getConditionFlag(0) == 0) {
              this.host.coprocessor1.updateRegister(
                operands[0],
                this.host.coprocessor1.getValue(operands[1])
              );
              this.host.coprocessor1.updateRegister(
                operands[0] + 1,
                this.host.coprocessor1.getValue(operands[1] + 1)
              );
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'movf.d $f2,$f4,1',
        'Move floating point double precision : If condition flag specified by immediate is false, set double precision $f2 to double precision value in $f4',
        BasicInstructionFormat.R_FORMAT,
        '010001 10001 ttt 00 sssss fffff 010001',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (operands[0] % 2 == 1 || operands[1] % 2 == 1) {
              throw this.failure(statement, 'both registers must be even-numbered');
            }
            if (this.host.coprocessor1.getConditionFlag(operands[2]) == 0) {
              this.host.coprocessor1.updateRegister(
                operands[0],
                this.host.coprocessor1.getValue(operands[1])
              );
              this.host.coprocessor1.updateRegister(
                operands[0] + 1,
                this.host.coprocessor1.getValue(operands[1] + 1)
              );
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'movt.d $f2,$f4',
        'Move floating point double precision : If condition flag 0 true, set double precision $f2 to double precision value in $f4',
        BasicInstructionFormat.R_FORMAT,
        '010001 10001 000 01 sssss fffff 010001',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (operands[0] % 2 == 1 || operands[1] % 2 == 1) {
              throw this.failure(statement, 'both registers must be even-numbered');
            }
            if (this.host.coprocessor1.getConditionFlag(0) == 1) {
              this.host.coprocessor1.updateRegister(
                operands[0],
                this.host.coprocessor1.getValue(operands[1])
              );
              this.host.coprocessor1.updateRegister(
                operands[0] + 1,
                this.host.coprocessor1.getValue(operands[1] + 1)
              );
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'movt.d $f2,$f4,1',
        'Move floating point double precision : If condition flag specified by immediate is true, set double precision $f2 to double precision value in $f4e',
        BasicInstructionFormat.R_FORMAT,
        '010001 10001 ttt 01 sssss fffff 010001',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (operands[0] % 2 == 1 || operands[1] % 2 == 1) {
              throw this.failure(statement, 'both registers must be even-numbered');
            }
            if (this.host.coprocessor1.getConditionFlag(operands[2]) == 1) {
              this.host.coprocessor1.updateRegister(
                operands[0],
                this.host.coprocessor1.getValue(operands[1])
              );
              this.host.coprocessor1.updateRegister(
                operands[0] + 1,
                this.host.coprocessor1.getValue(operands[1] + 1)
              );
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'movn.d $f2,$f4,$t3',
        'Move floating point double precision : If $t3 is not zero, set double precision $f2 to double precision value in $f4',
        BasicInstructionFormat.R_FORMAT,
        '010001 10001 ttttt sssss fffff 010011',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (operands[0] % 2 == 1 || operands[1] % 2 == 1) {
              throw this.failure(statement, 'both registers must be even-numbered');
            }
            if (this.host.registerFile.getValue(operands[2]) != 0) {
              this.host.coprocessor1.updateRegister(
                operands[0],
                this.host.coprocessor1.getValue(operands[1])
              );
              this.host.coprocessor1.updateRegister(
                operands[0] + 1,
                this.host.coprocessor1.getValue(operands[1] + 1)
              );
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'movz.d $f2,$f4,$t3',
        'Move floating point double precision : If $t3 is zero, set double precision $f2 to double precision value in $f4',
        BasicInstructionFormat.R_FORMAT,
        '010001 10001 ttttt sssss fffff 010010',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (operands[0] % 2 == 1 || operands[1] % 2 == 1) {
              throw this.failure(statement, 'both registers must be even-numbered');
            }
            if (this.host.registerFile.getValue(operands[2]) == 0) {
              this.host.coprocessor1.updateRegister(
                operands[0],
                this.host.coprocessor1.getValue(operands[1])
              );
              this.host.coprocessor1.updateRegister(
                operands[0] + 1,
                this.host.coprocessor1.getValue(operands[1] + 1)
              );
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'mov.s $f0,$f1',
        'Move floating point single precision : Set single precision $f0 to single precision value in $f1',
        BasicInstructionFormat.R_FORMAT,
        '010001 10000 00000 sssss fffff 000110',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            this.host.coprocessor1.updateRegister(
              operands[0],
              this.host.coprocessor1.getValue(operands[1])
            );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'movf.s $f0,$f1',
        'Move floating point single precision : If condition flag 0 is false, set single precision $f0 to single precision value in $f1',
        BasicInstructionFormat.R_FORMAT,
        '010001 10000 000 00 sssss fffff 010001',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (this.host.coprocessor1.getConditionFlag(0) == 0)
              this.host.coprocessor1.updateRegister(
                operands[0],
                this.host.coprocessor1.getValue(operands[1])
              );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'movf.s $f0,$f1,1',
        'Move floating point single precision : If condition flag specified by immediate is false, set single precision $f0 to single precision value in $f1e',
        BasicInstructionFormat.R_FORMAT,
        '010001 10000 ttt 00 sssss fffff 010001',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (this.host.coprocessor1.getConditionFlag(operands[2]) == 0)
              this.host.coprocessor1.updateRegister(
                operands[0],
                this.host.coprocessor1.getValue(operands[1])
              );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'movt.s $f0,$f1',
        'Move floating point single precision : If condition flag 0 is true, set single precision $f0 to single precision value in $f1e',
        BasicInstructionFormat.R_FORMAT,
        '010001 10000 000 01 sssss fffff 010001',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (this.host.coprocessor1.getConditionFlag(0) == 1)
              this.host.coprocessor1.updateRegister(
                operands[0],
                this.host.coprocessor1.getValue(operands[1])
              );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'movt.s $f0,$f1,1',
        'Move floating point single precision : If condition flag specified by immediate is true, set single precision $f0 to single precision value in $f1e',
        BasicInstructionFormat.R_FORMAT,
        '010001 10000 ttt 01 sssss fffff 010001',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (this.host.coprocessor1.getConditionFlag(operands[2]) == 1)
              this.host.coprocessor1.updateRegister(
                operands[0],
                this.host.coprocessor1.getValue(operands[1])
              );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'movn.s $f0,$f1,$t3',
        'Move floating point single precision : If $t3 is not zero, set single precision $f0 to single precision value in $f1',
        BasicInstructionFormat.R_FORMAT,
        '010001 10000 ttttt sssss fffff 010011',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (this.host.registerFile.getValue(operands[2]) != 0)
              this.host.coprocessor1.updateRegister(
                operands[0],
                this.host.coprocessor1.getValue(operands[1])
              );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'movz.s $f0,$f1,$t3',
        'Move floating point single precision : If $t3 is zero, set single precision $f0 to single precision value in $f1',
        BasicInstructionFormat.R_FORMAT,
        '010001 10000 ttttt sssss fffff 010010',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (this.host.registerFile.getValue(operands[2]) == 0)
              this.host.coprocessor1.updateRegister(
                operands[0],
                this.host.coprocessor1.getValue(operands[1])
              );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'mfc1 $t1,$f1',
        'Move from Coprocessor 1 (FPU) : Set $t1 to value in Coprocessor 1 register $f1',
        BasicInstructionFormat.R_FORMAT,
        '010001 00000 fffff sssss 00000 000000',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            this.host.registerFile.updateRegister(
              operands[0],
              this.host.coprocessor1.getValue(operands[1])
            );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'mtc1 $t1,$f1',
        'Move to Coprocessor 1 (FPU) : Set Coprocessor 1 register $f1 to value in $t1',
        BasicInstructionFormat.R_FORMAT,
        '010001 00100 fffff sssss 00000 000000',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            this.host.coprocessor1.updateRegister(
              operands[1],
              this.host.registerFile.getValue(operands[0])
            );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'neg.d $f2,$f4',
        'Floating point negate double precision : Set double precision $f2 to negation of double precision value in $f4',
        BasicInstructionFormat.R_FORMAT,
        '010001 10001 00000 sssss fffff 000111',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (operands[0] % 2 == 1 || operands[1] % 2 == 1) {
              throw this.failure(statement, 'both registers must be even-numbered');
            }
            const value = this.host.coprocessor1.getValue(operands[1] + 1) | 0;
            this.host.coprocessor1.updateRegister(
              operands[0] + 1,
              value < 0 ? value & 2147483647 : value | -2147483648
            );
            this.host.coprocessor1.updateRegister(
              operands[0],
              this.host.coprocessor1.getValue(operands[1])
            );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'neg.s $f0,$f1',
        'Floating point negate single precision : Set single precision $f0 to negation of single precision value in $f1',
        BasicInstructionFormat.R_FORMAT,
        '010001 10000 00000 sssss fffff 000111',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            const value = this.host.coprocessor1.getValue(operands[1]) | 0;
            this.host.coprocessor1.updateRegister(
              operands[0],
              value < 0 ? value & 2147483647 : value | -2147483648
            );
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'lwc1 $f1,-100($t2)',
        'Load word into Coprocessor 1 (FPU) : Set $f1 to 32-bit value from effective memory word address',
        BasicInstructionFormat.I_FORMAT,
        '110001 ttttt fffff ssssssssssssssss',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            try {
              this.host.coprocessor1.updateRegister(
                operands[0],
                this.host.memory.getWord(this.host.registerFile.getValue(operands[2]) + operands[1])
              );
            } catch (e) {
              if (!(e instanceof AddressErrorException)) throw e;
              throw this.failure(statement, e);
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'ldc1 $f2,-100($t2)',
        'Load double word Coprocessor 1 (FPU)) : Set $f2 to 64-bit value from effective memory doubleword address',
        BasicInstructionFormat.I_FORMAT,
        '110101 ttttt fffff ssssssssssssssss',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (operands[0] % 2 == 1) {
              throw this.failure(statement, 'first register must be even-numbered');
            }
            if (
              !Memory.doublewordAligned(this.host.registerFile.getValue(operands[2]) + operands[1])
            ) {
              throw this.failure(
                statement,
                new AddressErrorException(
                  'address not aligned on doubleword boundary ',
                  Exceptions.ADDRESS_EXCEPTION_LOAD,
                  this.host.registerFile.getValue(operands[2]) + operands[1]
                )
              );
            }
            try {
              this.host.coprocessor1.updateRegister(
                operands[0],
                this.host.memory.getWord(this.host.registerFile.getValue(operands[2]) + operands[1])
              );
              this.host.coprocessor1.updateRegister(
                operands[0] + 1,
                this.host.memory.getWord(
                  this.host.registerFile.getValue(operands[2]) + operands[1] + 4
                )
              );
            } catch (e) {
              if (!(e instanceof AddressErrorException)) throw e;
              throw this.failure(statement, e);
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'swc1 $f1,-100($t2)',
        'Store word from Coprocesor 1 (FPU) : Store 32 bit value in $f1 to effective memory word address',
        BasicInstructionFormat.I_FORMAT,
        '111001 ttttt fffff ssssssssssssssss',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            try {
              this.host.memory.setWord(
                this.host.registerFile.getValue(operands[2]) + operands[1],
                this.host.coprocessor1.getValue(operands[0])
              );
            } catch (e) {
              if (!(e instanceof AddressErrorException)) throw e;
              throw this.failure(statement, e);
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'sdc1 $f2,-100($t2)',
        'Store double word from Coprocessor 1 (FPU)) : Store 64 bit value in $f2 to effective memory doubleword address',
        BasicInstructionFormat.I_FORMAT,
        '111101 ttttt fffff ssssssssssssssss',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (operands[0] % 2 == 1) {
              throw this.failure(statement, 'first register must be even-numbered');
            }
            if (
              !Memory.doublewordAligned(this.host.registerFile.getValue(operands[2]) + operands[1])
            ) {
              throw this.failure(
                statement,
                new AddressErrorException(
                  'address not aligned on doubleword boundary ',
                  Exceptions.ADDRESS_EXCEPTION_STORE,
                  this.host.registerFile.getValue(operands[2]) + operands[1]
                )
              );
            }
            try {
              this.host.memory.setWord(
                this.host.registerFile.getValue(operands[2]) + operands[1],
                this.host.coprocessor1.getValue(operands[0])
              );
              this.host.memory.setWord(
                this.host.registerFile.getValue(operands[2]) + operands[1] + 4,
                this.host.coprocessor1.getValue(operands[0] + 1)
              );
            } catch (e) {
              if (!(e instanceof AddressErrorException)) throw e;
              throw this.failure(statement, e);
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'teq $t1,$t2',
        'Trap if equal : Trap if $t1 is equal to $t2',
        BasicInstructionFormat.R_FORMAT,
        '000000 fffff sssss ccccc ccccc 110100',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (
              this.host.registerFile.getValue(operands[0]) ==
              this.host.registerFile.getValue(operands[1])
            ) {
              throw this.failure(statement, 'trap', Exceptions.TRAP_EXCEPTION);
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'teqi $t1,-100',
        'Trap if equal to immediate : Trap if $t1 is equal to sign-extended 16 bit immediate',
        BasicInstructionFormat.I_FORMAT,
        '000001 fffff 01100 ssssssssssssssss',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (this.host.registerFile.getValue(operands[0]) == Binary.signExtend16(operands[1])) {
              throw this.failure(statement, 'trap', Exceptions.TRAP_EXCEPTION);
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'tne $t1,$t2',
        'Trap if not equal : Trap if $t1 is not equal to $t2',
        BasicInstructionFormat.R_FORMAT,
        '000000 fffff sssss ccccc ccccc 110110',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (
              this.host.registerFile.getValue(operands[0]) !=
              this.host.registerFile.getValue(operands[1])
            ) {
              throw this.failure(statement, 'trap', Exceptions.TRAP_EXCEPTION);
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'tnei $t1,-100',
        'Trap if not equal to immediate : Trap if $t1 is not equal to sign-extended 16 bit immediate',
        BasicInstructionFormat.I_FORMAT,
        '000001 fffff 01110 ssssssssssssssss',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (this.host.registerFile.getValue(operands[0]) != Binary.signExtend16(operands[1])) {
              throw this.failure(statement, 'trap', Exceptions.TRAP_EXCEPTION);
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'tge $t1,$t2',
        'Trap if greater or equal : Trap if $t1 is greater than or equal to $t2',
        BasicInstructionFormat.R_FORMAT,
        '000000 fffff sssss ccccc ccccc 110000',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (
              this.host.registerFile.getValue(operands[0]) >=
              this.host.registerFile.getValue(operands[1])
            ) {
              throw this.failure(statement, 'trap', Exceptions.TRAP_EXCEPTION);
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'tgeu $t1,$t2',
        'Trap if greater or equal unsigned : Trap if $t1 is greater than or equal to $t2 using unsigned comparision',
        BasicInstructionFormat.R_FORMAT,
        '000000 fffff sssss ccccc ccccc 110001',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            const first = this.host.registerFile.getValue(operands[0]) | 0;
            const second = this.host.registerFile.getValue(operands[1]) | 0;
            if (
              (first >= 0 && second >= 0) || (first < 0 && second < 0) ? first >= second : first < 0
            ) {
              throw this.failure(statement, 'trap', Exceptions.TRAP_EXCEPTION);
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'tgei $t1,-100',
        'Trap if greater than or equal to immediate : Trap if $t1 greater than or equal to sign-extended 16 bit immediate',
        BasicInstructionFormat.I_FORMAT,
        '000001 fffff 01000 ssssssssssssssss',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (this.host.registerFile.getValue(operands[0]) >= Binary.signExtend16(operands[1])) {
              throw this.failure(statement, 'trap', Exceptions.TRAP_EXCEPTION);
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'tgeiu $t1,-100',
        'Trap if greater or equal to immediate unsigned : Trap if $t1 greater than or equal to sign-extended 16 bit immediate, unsigned comparison',
        BasicInstructionFormat.I_FORMAT,
        '000001 fffff 01001 ssssssssssssssss',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            const first = this.host.registerFile.getValue(operands[0]) | 0;
            const second = Binary.signExtend16(operands[1]) | 0;
            if (
              (first >= 0 && second >= 0) || (first < 0 && second < 0) ? first >= second : first < 0
            ) {
              throw this.failure(statement, 'trap', Exceptions.TRAP_EXCEPTION);
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'tlt $t1,$t2',
        'Trap if less than: Trap if $t1 less than $t2',
        BasicInstructionFormat.R_FORMAT,
        '000000 fffff sssss ccccc ccccc 110010',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (
              this.host.registerFile.getValue(operands[0]) <
              this.host.registerFile.getValue(operands[1])
            ) {
              throw this.failure(statement, 'trap', Exceptions.TRAP_EXCEPTION);
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'tltu $t1,$t2',
        'Trap if less than unsigned : Trap if $t1 less than $t2, unsigned comparison',
        BasicInstructionFormat.R_FORMAT,
        '000000 fffff sssss ccccc ccccc 110011',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            const first = this.host.registerFile.getValue(operands[0]) | 0;
            const second = this.host.registerFile.getValue(operands[1]) | 0;
            if (
              (first >= 0 && second >= 0) || (first < 0 && second < 0) ? first < second : first >= 0
            ) {
              throw this.failure(statement, 'trap', Exceptions.TRAP_EXCEPTION);
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'tlti $t1,-100',
        'Trap if less than immediate : Trap if $t1 less than sign-extended 16-bit immediate',
        BasicInstructionFormat.I_FORMAT,
        '000001 fffff 01010 ssssssssssssssss',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            if (this.host.registerFile.getValue(operands[0]) < Binary.signExtend16(operands[1])) {
              throw this.failure(statement, 'trap', Exceptions.TRAP_EXCEPTION);
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'tltiu $t1,-100',
        'Trap if less than immediate unsigned : Trap if $t1 less than sign-extended 16-bit immediate, unsigned comparison',
        BasicInstructionFormat.I_FORMAT,
        '000001 fffff 01011 ssssssssssssssss',
        {
          simulate: (statement) => {
            const operands = statement.getOperands()!;
            const first = this.host.registerFile.getValue(operands[0]) | 0;
            const second = Binary.signExtend16(operands[1]) | 0;
            if (
              (first >= 0 && second >= 0) || (first < 0 && second < 0) ? first < second : first >= 0
            ) {
              throw this.failure(statement, 'trap', Exceptions.TRAP_EXCEPTION);
            }
          }
        },
        this.host
      )
    );
    this.instructionList.push(
      new BasicInstruction<ProgramStatement>(
        'eret',
        'Exception return : Set Program Counter to Coprocessor 0 EPC register value, set Coprocessor Status register bit 1 (exception level) to zero',
        BasicInstructionFormat.R_FORMAT,
        '010000 1 0000000000000000000 011000',
        {
          simulate: () => {
            this.host.coprocessor0.updateRegister(
              Coprocessor0.STATUS,
              Binary.clearBit(
                this.host.coprocessor0.getValue(Coprocessor0.STATUS),
                Coprocessor0.EXCEPTION_LEVEL
              )
            );
            this.host.registerFile.setProgramCounter(
              this.host.coprocessor0.getValue(Coprocessor0.EPC)
            );
          }
        },
        this.host
      )
    );
    this.addPseudoInstructions();
    for (const instruction of this.instructionList) instruction.createExampleTokenList();
    const masks = new Map<number, Map<number, BasicInstruction<ProgramStatement>>>();
    for (const instruction of this.instructionList) {
      if (!(instruction instanceof BasicInstruction)) continue;
      const mask = instruction.getOpcodeMask();
      let matches = masks.get(mask);
      if (!matches) {
        matches = new Map();
        masks.set(mask, matches);
      }
      matches.set(instruction.getOpcodeMatch(), instruction);
    }
    this.opcodeMatchMaps = [...masks].map(([mask, matches]) => {
      let length = 0,
        n = mask;
      while (n !== 0) {
        length++;
        n &= n - 1;
      }
      return { mask, length, matches };
    });
    this.opcodeMatchMaps.sort((a, b) => b.length - a.length || (a.mask - b.mask) | 0);
  }
  /** Decode by decreasing mask specificity, retaining Java's signed mask tie-break and last match. */
  findByBinaryCode(binaryInstruction: number): BasicInstruction<ProgramStatement> | null {
    for (const map of this.opcodeMatchMaps) {
      const instruction = map.matches.get(binaryInstruction & map.mask);
      if (instruction) return instruction;
    }
    return null;
  }
  /** Find every exact mnemonic match, case-insensitively, in canonical registration order. */
  matchOperator(name: string | null): Instruction[] | null {
    if (name === null) return null;
    const matches = this.instructionList.filter((instruction) =>
      this.equalsIgnoreCase(instruction.getName(), name)
    );
    return matches.length ? matches : null;
  }
  /** Find every mnemonic prefix match; null input or no matches returns null. */
  prefixMatchOperator(name: string | null): Instruction[] | null {
    if (name === null) return null;
    const matches = this.instructionList.filter((instruction) =>
      instruction.getName().toLowerCase().startsWith(name.toLowerCase())
    );
    return matches.length ? matches : null;
  }
  private equalsIgnoreCase(left: string, right: string): boolean {
    if (left.length !== right.length) return false;
    for (let i = 0; i < left.length; i++) {
      const a = left[i],
        b = right[i];
      if (a === b || a.toUpperCase() === b.toUpperCase()) continue;
      // Java's char case mapping is one UTF-16 unit: dotted capital I lowers to i.
      if (a.toLowerCase() !== (b === '\u0130' ? 'i' : b.toLowerCase())) return false;
    }
    return true;
  }

  private addPseudoInstructions(): void {
    for (const line of pseudoOperations.split(/\r\n|\n|\r/)) {
      if (line.startsWith('#') || line.startsWith(' ') || line.length === 0) continue;
      const tokens = line.split('\t').filter((token) => token.length !== 0);
      const pseudoOp = tokens.shift()!;
      let template = '',
        firstTemplate: string | null = null,
        description = '';
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (token.startsWith('#')) {
          description = token.slice(1);
          break;
        }
        if (token.startsWith('COMPACT')) {
          firstTemplate = template;
          template = '';
          continue;
        }
        template += token;
        if (i < tokens.length - 1) template += '\n';
      }
      this.instructionList.push(
        firstTemplate === null
          ? new ExtendedInstruction(pseudoOp, template, description, this.host)
          : new ExtendedInstruction(pseudoOp, firstTemplate, template, description, this.host)
      );
    }
  }
  private findAndSimulateSyscall(
    number: number,
    statement: ProgramStatement
  ): void | Promise<void> {
    const service = this.host.findSyscall(number);
    if (service) {
      return service.simulate(statement);
    }
    throw this.failure(
      statement,
      `invalid or unimplemented syscall service: ${number} `,
      Exceptions.SYSCALL_EXCEPTION
    );
  }
  private processBranch(displacement: number): void {
    const address = (this.host.registerFile.getProgramCounter() + (displacement << 2)) | 0;
    if (this.host.getDelayedBranchingEnabled()) this.host.delayedBranch.register(address);
    else this.host.registerFile.setProgramCounter(address);
  }
  private processJump(targetAddress: number): void {
    if (this.host.getDelayedBranchingEnabled()) this.host.delayedBranch.register(targetAddress);
    else this.host.registerFile.setProgramCounter(targetAddress);
  }
  private processReturnAddress(register: number): void {
    this.host.registerFile.updateRegister(
      register,
      (this.host.registerFile.getProgramCounter() +
        (this.host.getDelayedBranchingEnabled() ? Instruction.INSTRUCTION_LENGTH : 0)) |
        0
    );
  }
  private failure(
    statement: ProgramStatement,
    message: string | AddressErrorException,
    cause?: number
  ): ProcessingException {
    return message instanceof AddressErrorException
      ? new ProcessingException(statement, message, this.host.exceptionHost)
      : new ProcessingException(statement, message, this.host.exceptionHost, cause);
  }
  private intBitsToFloat(value: number): number {
    this.bits.setInt32(0, value);
    return this.bits.getFloat32(0);
  }
  private longBitsToDouble(value: bigint): number {
    this.bits.setBigInt64(0, value);
    return this.bits.getFloat64(0);
  }
  private doubleToLongBits(value: number): bigint {
    if (Number.isNaN(value)) return 0x7ff8000000000000n;
    this.bits.setFloat64(0, value);
    return this.bits.getBigInt64(0);
  }
  private isInfinite(value: number): boolean {
    return value === Infinity || value === -Infinity;
  }
}
