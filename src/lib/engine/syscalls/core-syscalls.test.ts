import { RandomStreams } from '#lib/engine/syscalls/random/RandomStreams.js';
import { DialogIO } from '#lib/engine/io/DialogIO.js';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ProgramStatement } from '../assembler/programs/ProgramStatement.js';
import { TokenList } from '../assembler/tokenization/TokenList.js';
import { Tokenizer } from '../assembler/tokenization/Tokenizer.js';
import { Coprocessor0 } from '../hardware/registers/Coprocessor0.js';
import { Coprocessor1 } from '../hardware/registers/Coprocessor1.js';
import { RegisterFile } from '../hardware/registers/RegisterFile.js';
import { Memory } from '../hardware/memory/Memory.js';
import { DelayedBranch } from '../simulator/DelayedBranch.js';
import { Exceptions } from '../simulator/Exceptions.js';
import { ProcessingException } from '../diagnostics/ProcessingException.js';
import { InstructionSet } from '../instructions/InstructionSet.js';
import { SystemIO, type InputRequest } from '../io/SystemIO.js';
import { SyscallLoader } from './SyscallLoader.js';
import { SyscallPrintInt } from './console/SyscallPrintInt.js';
import { SyscallReadInt } from './console/SyscallReadInt.js';
import { JavaFloatingPoint } from '../formatting/JavaFloatingPoint.js';

const fixture = JSON.parse(readFileSync('tests/oracle/core-syscalls/golden.json', 'utf8')) as {
  stdout: string;
};
const rows = fixture.stdout
  .trimEnd()
  .split('\n')
  .map((row) => row.split('\t'));
const decode = (value: string) => Buffer.from(value, 'base64').toString('utf8');
function machine() {
  const registerFile = new RegisterFile(),
    coprocessor0 = new Coprocessor0(),
    coprocessor1 = new Coprocessor1(),
    delayedBranch = new DelayedBranch();
  const exceptions = new Exceptions(coprocessor0, registerFile);
  let input = '',
    output = '',
    popup = false;
  const requests: InputRequest[] = [];
  const systemIO = new SystemIO({
    readInput: (request) => {
      requests.push(request);
      return input;
    },
    printString: (text) => {
      output += text;
    },
    getPopupSyscallInput: () => popup,
    parseFloat: (text) => JavaFloatingPoint.parseFloat(text),
    parseDouble: (text) => JavaFloatingPoint.parseDouble(text),
    formatFloat: (value) => JavaFloatingPoint.formatFloat(value),
    formatDouble: (value) => JavaFloatingPoint.formatDouble(value)
  });
  const statementHost = {
    findByBinaryCode: (word: number) => set.findByBinaryCode(word),
    matchOperator: (name: string) => set.matchOperator(name),
    registerFile,
    coprocessor1,
    getDisplayAddressesInHex: () => true,
    getDisplayValuesInHex: () => true
  };
  const memory: Memory<ProgramStatement> = new Memory({
    decodeStatement: (word, address) => new ProgramStatement(word, address, statementHost)
  });
  const exceptionHost = {
    getProgramCounter: () => registerFile.getProgramCounter(),
    setRegisters: (cause: number, address?: number) => exceptions.setRegisters(cause, address)
  };
  const syscallHost = {
    registerFile,
    coprocessor1,
    memory,
    exceptionHost,
    systemIO,
    randomStreams: new RandomStreams(() => 0n),
    dialogs: new DialogIO()
  };
  const loader = new SyscallLoader(syscallHost);
  const context = {
    registerFile,
    coprocessor0,
    coprocessor1,
    instructionSet: { matchOperator: (name: string) => set.matchOperator(name) }
  };
  const set: InstructionSet = new InstructionSet({
    registerFile,
    coprocessor0,
    coprocessor1,
    memory,
    delayedBranch,
    exceptionHost,
    getDelayedBranchingEnabled: () => false,
    findSyscall: (number) => loader.findSyscall(number),
    tokenizeExampleInstruction: (example) =>
      new Tokenizer(context).tokenizeExampleInstruction(example),
    write: () => {}
  });
  set.populate();
  const statement = new ProgramStatement(
    null,
    '',
    new TokenList(),
    new TokenList(),
    set.matchOperator('syscall')![0],
    0x00400000,
    0,
    statementHost
  );
  return {
    registerFile,
    coprocessor0,
    coprocessor1,
    memory,
    loader,
    statement,
    systemIO,
    syscallHost,
    requests,
    set,
    setInput: (text: string) => {
      input = text;
      output = '';
    },
    getOutput: () => output,
    setPopup: (value: boolean) => {
      popup = value;
    }
  };
}

describe('canonical core console syscalls', () => {
  const m = machine();
  for (const [number, cases] of Map.groupBy(rows, (row) => Number(row[0]))) {
    it(`service ${number} matches Java registers, output, memory, errors, and exit across12 cases`, async () => {
      const values = [0, -1, 2147483647, -2147483648, 1, 5, 255, 256];
      for (const row of cases) {
        const n = Number(row[1]);
        m.setInput(decode(row[2]));
        m.registerFile.resetRegisters();
        m.coprocessor0.resetRegisters();
        m.coprocessor1.resetRegisters();
        m.registerFile.setProgramCounter(0x00400004);
        m.registerFile.updateRegister(4, values[n % values.length]);
        m.registerFile.updateRegister(5, [-1, 0, 1, 2, 4, 8][n % 6]);
        for (let i = 0; i < 16; i++) m.memory.setByte(0x10010000 + i, 0x7e);
        if (number === 4) {
          m.registerFile.updateRegister(4, n === 11 ? 0 : 0x10010000);
          [65, 127, 128, 255, 0].forEach((value, i) => m.memory.setByte(0x10010000 + i, value));
        }
        if (number === 8) m.registerFile.updateRegister(4, n === 11 ? 0 : 0x10010000);
        if (number === 9) m.registerFile.updateRegister(4, [0, 1, 4, -1, 2147483647, 8][n % 6]);
        if (number === 2)
          m.coprocessor1.updateRegister(
            12,
            [0, 0x80000000, 0x3fc00000, 0x7fc12345, 0x7f800000, 0xff800000, 1, 0x7f7fffff][n % 8]
          );
        if (number === 3)
          m.coprocessor1.setRegisterPairToDouble(
            12,
            [0, -0, 1.25, NaN, Infinity, -Infinity, Number.MIN_VALUE, Number.MAX_VALUE][n % 8]
          );
        let outcome = 'ok';
        try {
          await m.loader.findSyscall(number)!.simulate(m.statement);
        } catch (error) {
          if (!(error instanceof ProcessingException)) throw error;
          outcome = error.errors()?.generateErrorReport() ?? 'exit';
        }
        const state: number[] = [];
        for (const r of [2, 4, 5]) state.push(m.registerFile.getValue(r));
        for (const r of [0, 1]) state.push(m.coprocessor1.getValue(r));
        for (const r of [8, 12, 13, 14]) state.push(m.coprocessor0.getValue(r));
        for (let i = 0; i < 16; i++) state.push(m.memory.getByte(0x10010000 + i));
        expect({ output: m.getOutput(), outcome, state: state.join(',') }, `case ${n}`).toEqual({
          output: decode(row[3]),
          outcome: decode(row[4]),
          state: row[5]
        });
      }
    });
  }
  it('uses GUI popup prompts and trims only the console string newline', async () => {
    const local = machine();
    local.setInput('hello\n');
    expect(await local.systemIO.readString(8, 8)).toBe('hello');
    expect(local.requests.at(-1)).toEqual({ serviceNumber: 8, prompt: null, maxLength: 8 });
    local.setPopup(true);
    expect(await local.systemIO.readString(8, 8)).toBe('hello\n');
    expect(local.requests.at(-1)?.prompt).toBe('Enter a string of maximum length 8 (syscall 8)');
    local.setInput(' 42\n');
    expect(await local.systemIO.readInteger(105)).toBe(42);
    expect(local.requests.at(-1)).toEqual({
      serviceNumber: 105,
      prompt: 'Enter an integer value (syscall 105)',
      maxLength: -1
    });
    local.setInput('😀');
    expect(await local.systemIO.readChar(12)).toBe(0xd83d);
    expect(local.requests.at(-1)?.prompt).toBe('Enter a character value (syscall 12)');
  });
  it('loads fresh services, deduplicates class modules, applies exchanged overrides, and rejects collisions', () => {
    const local = machine();
    const registrations = [
      {
        className: 'SyscallPrintInt.class',
        create: (host: typeof local.syscallHost) => new SyscallPrintInt(host)
      },
      {
        className: 'SyscallReadInt.class',
        create: (host: typeof local.syscallHost) => new SyscallReadInt(host)
      }
    ];
    const swapped = new SyscallLoader(
      local.syscallHost,
      [...registrations, registrations[0]],
      [
        { getName: () => 'PrintInt', getNumber: () => 5 },
        { getName: () => 'ReadInt', getNumber: () => 1 }
      ]
    );
    expect(swapped.findSyscall(1)?.getName()).toBe('ReadInt');
    expect(swapped.findSyscall(5)?.getName()).toBe('PrintInt');
    expect(swapped.findSyscall(13)).toBeNull();
    expect(() =>
      new SyscallLoader(local.syscallHost, registrations, [
        { getName: () => 'PrintInt', getNumber: () => 5 }
      ]).loadSyscalls()
    ).toThrow('Invalid syscall configuration');
    expect(local.getOutput()).toBe(
      'Error: syscalls PrintInt and ReadInt are both assigned same number 5\n'
    );
    local.setInput('');
    expect(() =>
      new SyscallLoader(local.syscallHost, registrations, [
        { getName: () => 'Missing', getNumber: () => 1 }
      ]).loadSyscalls()
    ).toThrow("syscall name 'Missing'");
    expect(local.getOutput()).toBe(
      "Error: syscall name 'Missing' in config file does not match any name in syscall list\n"
    );
  });
  it('returns the asynchronous syscall completion through the basic syscall instruction', async () => {
    const local = machine();
    local.setInput('123');
    local.registerFile.updateRegister(2, 5);
    const instruction = local.set.findByBinaryCode(12)!;
    const completion = instruction.getSimulationCode().simulate(local.statement);
    expect(completion).toBeInstanceOf(Promise);
    expect(local.registerFile.getValue(2)).toBe(5);
    await completion;
    expect(local.registerFile.getValue(2)).toBe(123);
  });
});
