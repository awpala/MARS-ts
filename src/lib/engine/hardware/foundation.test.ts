import { describe, expect, it } from 'vitest';
import golden from '../../../../tests/oracle/units/foundation.json';
import { Binary } from '../formatting/Binary.js';
import { DataTypes } from '../assembler/directives/DataTypes.js';
import { Directives } from '../assembler/directives/Directives.js';
import { Register } from './registers/Register.js';
import { RegisterFile } from './registers/RegisterFile.js';
import { Coprocessor0 } from './registers/Coprocessor0.js';
import { Coprocessor1 } from './registers/Coprocessor1.js';
import { MemoryConfigurations } from './memory/MemoryConfigurations.js';
import { MemoryAccessNotice } from './notices/MemoryAccessNotice.js';
import { AddressErrorException } from './memory/AddressErrorException.js';
import { Exceptions } from '../simulator/Exceptions.js';

const expected = new Map(
  golden.stdout
    .trimEnd()
    .split('\n')
    .map((line) => {
      const separator = line.indexOf('=');
      return [line.slice(0, separator), line.slice(separator + 1)];
    })
);
function check(key: string, value: unknown): void {
  expect(String(value), key).toBe(expected.get(key));
}
function attempt(key: string, run: () => unknown): void {
  let result: unknown;
  try {
    result = run();
  } catch (error) {
    result =
      '!' +
      (error instanceof RangeError && error.message === 'StringIndexOutOfBoundsException'
        ? error.message
        : error instanceof Error
          ? error.name
          : 'unknown');
  }
  check(key, result);
}

describe('Java foundation method-probe parity', () => {
  it('uses a successful oracle capture with empty stderr', () => {
    expect(golden.status).toBe(0);
    expect(golden.stderr).toBe('');
  });
  it('matches all JDK BMP hexadecimal digit mappings and Unicode parsing rules', () => {
    for (const [key, value] of expected) {
      if (key.startsWith('digit:'))
        expect(Binary.stringToInt('0x' + String.fromCharCode(Number(key.slice(6))))).toBe(
          Number(value)
        );
    }
    for (const value of [
      '١٢٣',
      '１２３',
      '0xＡＢ',
      '०१२',
      '-١٢',
      '+१२',
      '0xＦＦＦＦＦＦＦＦ',
      '𝟙'
    ]) {
      attempt('unicodeInt:' + value, () => Binary.stringToInt(value));
      attempt('unicodeLong:' + value, () => Binary.stringToLong(value));
    }
  });
  it('recognizes integer candidates using the oracle digit grammar without parsing nonnumeric tokens', () => {
    for (const [key, value] of expected) {
      if (key.startsWith('digit:')) {
        const character = String.fromCharCode(Number(key.slice(6)));
        expect(Binary.isIntegerCandidate(character + 'not-a-number'), key).toBe(Number(value) < 10);
      }
      if (key.startsWith('unicodeInt:') && !value.startsWith('!'))
        expect(Binary.isIntegerCandidate(key.slice('unicodeInt:'.length)), key).toBe(true);
    }
    for (const value of ['', '+1', '-1', '#ff', '0x80000000', '4294967296'])
      expect(Binary.isIntegerCandidate(value), JSON.stringify(value)).toBe(true);
    for (const value of ['add', '.data', '$t0', '$f2', 'NaN', 'Infinity', '"text"', '𝟙'])
      expect(Binary.isIntegerCandidate(value), value).toBe(false);
  });
  it('preserves exception register cause masks, PC wrap, write order, and address diagnostics', () => {
    const cp0 = new Coprocessor0();
    const registers = new RegisterFile();
    const exceptions = new Exceptions(cp0, registers);
    for (const cause of [4, 5, 8, 9, 10, 12, 13, 15, 16, 17, 64, 128]) {
      cp0.resetRegisters();
      cp0.updateRegister(13, -1);
      registers.initializeProgramCounter(-2147483648);
      const events: string[] = [];
      const release = cp0.addRegistersObserver((n) => events.push(String(n)));
      exceptions.setRegisters(cause, 0xabcdef01);
      release();
      check('exception:' + cause, [8, 12, 13, 14].map((n) => cp0.getValue(n)).join(','));
      check('exceptionEvents:' + cause, events.join('|'));
    }
    for (const address of [0, -2147483648, -1, 0x10010003]) {
      const error = new AddressErrorException('bad address ', 4, address);
      check('addressError:' + address, `${error.message}|${error.getAddress()}|${error.getType()}`);
      const n = new MemoryAccessNotice(1, address, -1);
      check(
        'memoryNotice:' + address,
        `${n}|${n.getAddress()}|${n.getLength()}|${n.getValue()}|${n.accessIsFromGUI()}|${n.accessIsFromMIPS()}`
      );
    }
  });
  it('compares every integer formatting, parsing, bit, byte, and long probe', () => {
    for (const v of [0, 1, -1, -2147483648, 2147483647, 0x12345678, 0x000a2080]) {
      const key = `word:${v}`;
      check(
        key,
        [
          Binary.intToBinaryString(v),
          Binary.intToHexString(v),
          Binary.intToHalfHexString(v),
          Binary.unsignedIntToIntString(v),
          Binary.intToAscii(v)
        ].join(',')
      );
      for (const b of [0, 1, 7, 31, 32, -1])
        check(
          `${key}:bit:${b}`,
          [Binary.bitValue(v, b), Binary.setBit(v, b), Binary.clearBit(v, b)].join(',')
        );
      for (let b = 0; b < 4; b++)
        check(`${key}:byte:${b}`, [Binary.getByte(v, b), Binary.setByte(v, b, 0x1ab)].join(','));
    }
    check('wide32', Binary.intToBinaryString(1, 36));
    check('wide64', Binary.longToBinaryString(1n, 68));
    for (const v of [
      '',
      '0',
      '-0',
      '+1',
      '42',
      '077',
      '08',
      '-077',
      '0x7fffffff',
      '0x80000000',
      '0xffffffff',
      '0xFFFFFFFF',
      '-0x80000000',
      '-0x1',
      '#ff',
      '2147483648',
      '4294967295',
      '4294967296',
      '18446744073709551616',
      '-2147483649',
      ' 1',
      '1 ',
      '0x100000000',
      '0xffffffffffffffff',
      '9223372036854775807',
      '-9223372036854775808',
      '+0x1',
      '0x',
      '++1'
    ]) {
      attempt(`parseInt:${v}`, () => Binary.stringToInt(v));
      attempt(`parseLong:${v}`, () => Binary.stringToLong(v));
      check(`classify:${v}`, `${Binary.isHex(v)},${Binary.isOctal(v)}`);
    }
    for (const v of ['', '1', '0000', '1111', '10000', '102x', '1'.repeat(32), '1'.repeat(64)]) {
      attempt(`bitsInt:${v}`, () => Binary.binaryStringToInt(v));
      attempt(`bitsLong:${v}`, () => Binary.binaryStringToLong(v));
      check(
        `bitsHex:${v}`,
        `${Binary.binaryStringToHexString(v)},${Binary.binaryStringToHexDigit(v)}`
      );
    }
    check('hexBits', Binary.hexStringToBinaryString('0XAf-012x'));
    for (const v of [0n, 1n, -1n, -9223372036854775808n, 9223372036854775807n, 0x123456789abcdef0n])
      check(
        `long:${v}`,
        [
          Binary.longToBinaryString(v),
          Binary.longToHexString(v),
          Binary.highOrderLongToInt(v),
          Binary.lowOrderLongToInt(v),
          Binary.twoIntsToLong(Binary.highOrderLongToInt(v), Binary.lowOrderLongToInt(v))
        ].join(',')
      );
  });
  it('compares storage widths, signed bounds, and floating range special values', () => {
    for (const d of Directives.getDirectiveList()) {
      check(`size:${d}`, DataTypes.getLengthInBytes(d));
      for (const v of [-32769, -32768, -129, -128, 0, 127, 128, 32767, 32768])
        check(`range:${d}:${v}`, DataTypes.outOfRange(d, v));
      const values: [string, number][] = [
        ['-0x1.fffffffffffffp1023', -Number.MAX_VALUE],
        ['-0x1.fffffep127', -DataTypes.MAX_FLOAT_VALUE],
        ['0x0.0p0', 0],
        ['0x1.fffffep127', DataTypes.MAX_FLOAT_VALUE],
        ['0x1.fffffffffffffp1023', Number.MAX_VALUE],
        ['NaN', NaN],
        ['Infinity', Infinity]
      ];
      for (const [label, v] of values)
        check(`floatRange:${d}:${label}`, DataTypes.outOfRange(d, v, true));
    }
  });
  it('preserves reverse observer order, duplicate subscription identity, and silent reset', () => {
    const register = new Register('test', 7, -1);
    const events: string[] = [];
    const first = (notice: { toString(): string }) => events.push('first:' + notice);
    const second = (notice: { toString(): string }) => events.push('second:' + notice);
    register.subscribe(first);
    const release = register.subscribe(second);
    register.subscribe(first);
    check('register:get', register.getValue());
    check('register:set', register.setValue(12));
    check('register:peek', register.getValueNoNotify());
    register.changeResetValue(99);
    register.resetValue();
    check('register:reset', register.getValueNoNotify());
    release();
    register.getValue();
    check('register:events', events.join('|'));
  });
  it('matches general register access, zero protection, numeric aliases, and PC wrap', () => {
    const registers = new RegisterFile();
    const events: string[] = [];
    const release = registers.addRegistersObserver((n) => events.push(String(n)));
    check('rf:zero', registers.updateRegister(0, 5));
    check('rf:t0', registers.updateRegister(8, -1));
    check('rf:t0read', registers.getValue(8));
    check('rf:hi', registers.updateRegister(33, 123));
    check('rf:lo', registers.updateRegister(34, -456));
    check('rf:hiRead', registers.getValue(33));
    check('rf:loRead', registers.getValue(34));
    check('rf:unknown', registers.updateRegister(35, 99));
    for (const name of ['$zero', '$0', '$08', '$0x1f', '$', '$32', 'zero', '$s8', ''])
      attempt(`rf:lookup:${name}`, () => registers.getUserRegister(name)?.getName() ?? 'null');
    for (const register of registers.getRegisters()) {
      expect(registers.getUserRegister(register.getName())).toBe(register);
      expect(registers.getUserRegister(`$${register.getNumber()}`)).toBe(register);
    }
    registers.initializeProgramCounter(0x7ffffffc);
    registers.incrementPC();
    check('rf:pc', registers.getProgramCounter());
    check('rf:pcOld', registers.setProgramCounter(4));
    check('rf:events', events.join('|'));
    release();
    registers.resetRegisters();
    check(
      'rf:reset',
      [
        registers.getValue(8),
        registers.getValue(28),
        registers.getValue(29),
        registers.getProgramCounter(),
        registers.getValue(33)
      ].join(',')
    );
  });
  it('matches coprocessor register notification order and raw floating bit patterns', () => {
    const cp0 = new Coprocessor0();
    const cp1 = new Coprocessor1();
    const events: string[] = [];
    const release = cp0.addRegistersObserver((n) => events.push(String(n)));
    check('cp0:status', cp0.getValue(12));
    check('cp0:update', cp0.updateRegister(8, 42));
    check('cp0:string', cp0.updateRegister('$8', 43));
    check('cp0:unknown', cp0.getValue(7));
    check('cp0:events', events.join('|'));
    release();
    cp0.resetRegisters();
    events.length = 0;
    const release1 = cp1.addRegistersObserver((n) => events.push(String(n)));
    cp1.setRegisterPairToLong(2, 0x123456789abcdef0n);
    check('cp1:pair', cp1.getLongFromRegisterPair(2));
    check('cp1:events', events.join('|'));
    release1();
    const bits = new DataView(new ArrayBuffer(8));
    for (const v of [0n, -9223372036854775808n, 0x7ff0000000000000n, 0x7ff8123456789abcn, 1n]) {
      cp1.setRegisterPairToLong(0, v);
      check(`cp1:raw:${v}`, cp1.getLongFromRegisterPair(0));
      bits.setBigInt64(0, v);
      cp1.setRegisterPairToDouble(2, bits.getFloat64(0));
      check(`cp1:double:${v}`, cp1.getLongFromRegisterPair(2));
    }
    for (const v of [0, -2147483648, 0x3f800000, 0x7f800000, 0x7fc12345, 1]) {
      cp1.setRegisterToInt(0, v);
      bits.setInt32(0, v);
      cp1.setRegisterToFloat(1, bits.getFloat32(0));
      check(`cp1:float:${v}`, cp1.getIntFromRegister(1));
    }
    for (const n of [1, -1, 31]) attempt(`cp1:odd:${n}`, () => cp1.getLongFromRegisterPair(n));
    cp1.setConditionFlags();
    check('cp1:all', cp1.getConditionFlags());
    check('cp1:clear7', cp1.clearConditionFlag(7));
    check('cp1:flags', cp1.getConditionFlags());
    check('cp1:invalid', cp1.getConditionFlag(99));
    cp1.clearConditionFlags();
    check('cp1:set3', cp1.setConditionFlag(3));
    check('cp1:one', cp1.getConditionFlags());
    cp1.resetRegisters();
    check('cp1:reset', `${cp1.getConditionFlags()},${cp1.getValue(0)}`);
  });
  it('matches all memory layout address tables and configuration register resets', () => {
    const registers = new RegisterFile();
    const configurations = new MemoryConfigurations((c) => {
      registers.getUserRegister('$gp')!.changeResetValue(c.getGlobalPointer());
      registers.getUserRegister('$sp')!.changeResetValue(c.getStackPointer());
      registers.getProgramCounterRegister().changeResetValue(c.getTextBaseAddress());
      registers.initializeProgramCounter(c.getTextBaseAddress());
      registers.resetRegisters();
    });
    for (const c of configurations.getConfigurationsIterator()) {
      const id = c.getConfigurationIdentifier();
      check(
        `config:${id}`,
        `${c.getConfigurationName()}|[${c.getConfigurationItemValues().join(', ')}]`
      );
      check(`configChange:${id}`, configurations.setCurrentConfiguration(c));
      check(
        `configRegs:${id}`,
        `${registers.getValue(28)},${registers.getValue(29)},${registers.getProgramCounter()}`
      );
    }
    check('config:null', configurations.setCurrentConfiguration(null));
    check(
      'config:same',
      configurations.setCurrentConfiguration(configurations.getCurrentConfiguration())
    );
  });
});

it('keeps sessions isolated and returns teardown for access notices', () => {
  const first = new RegisterFile();
  const second = new RegisterFile();
  let writes = 0;
  const release = first.addRegistersObserver(() => writes++);
  first.updateRegister(8, 42);
  expect(second.getValue(8)).toBe(0);
  expect(writes).toBe(1);
  release();
  first.updateRegister(8, 43);
  expect(writes).toBe(1);
  const a = new Coprocessor1();
  const b = new Coprocessor1();
  a.setConditionFlags();
  a.setRegisterToInt(0, 1);
  expect(b.getConditionFlags()).toBe(0);
  expect(b.getValue(0)).toBe(0);
});
it('FPU display snapshots are silent and retain raw stored NaN payloads', () => {
  const cp = new Coprocessor1();
  cp.setRegisterPairToLong(0, 0x7ff8123456789abcn);
  let notices = 0;
  const release = cp.addRegistersObserver(() => notices++);
  expect(Number.isNaN(cp.getDoubleFromRegisterPairNoNotify(0))).toBe(true);
  cp.getFloatFromRegisterNoNotify(0);
  cp.getConditionFlagsNoNotify();
  expect(notices).toBe(0);
  expect(cp.getRegisters()[0].getValueNoNotify()).toBe(0x56789abc);
  release();
});

it('records backstep collaborator values and releases origin-aware observers', () => {
  const records: string[] = [];
  const registers = new RegisterFile(undefined, {
    getAccessOrigin: () => 'mips',
    addRegisterFileRestore: (number, old) => {
      records.push(`r:${number}:${old}`);
      return old;
    },
    addPCRestore: (old) => records.push(`pc:${old}`),
    getStartAtMain: () => true,
    getStartAddress: () => 0x400010
  });
  const release = registers.addRegistersObserver((notice) => {
    expect(notice.accessIsFromMIPS()).toBe(true);
    expect(notice.accessIsFromGUI()).toBe(false);
  });
  registers.updateRegister(8, 42);
  registers.updateRegister(8, 43);
  registers.setProgramCounter(8);
  registers.resetRegisters();
  release();
  expect(registers.getProgramCounter()).toBe(0x400010);
  expect(records).toEqual(['r:8:0', 'r:8:42', 'pc:4194304']);
  const cp1 = new Coprocessor1({
    addCoprocessor1Restore: (number, old) => {
      records.push(`f:${number}:${old}`);
      return old;
    },
    addConditionFlagClear: (flag) => records.push(`clear:${flag}`),
    addConditionFlagSet: (flag) => records.push(`set:${flag}`)
  });
  cp1.updateRegister(0, 99);
  cp1.setConditionFlag(3);
  cp1.clearConditionFlag(3);
  cp1.clearConditionFlag(3);
  expect(records.slice(3)).toEqual(['f:0:0', 'clear:3', 'set:3', 'clear:3']);
  const guiNotice = new MemoryAccessNotice(0, 0, 2, 12, 'gui');
  expect(guiNotice.accessIsFromGUI()).toBe(true);
  expect(guiNotice.getLength()).toBe(2);
  expect(() => new MemoryAccessNotice(2, 0, 0)).toThrow('IllegalArgumentException');
});

it('retains method-style host receivers and observes context changes in every register bank', () => {
  const host = {
    context: 'mips' as 'mips' | 'gui',
    getAccessOrigin() {
      return this.context;
    }
  };
  const registers = new RegisterFile(undefined, host);
  const cp1 = new Coprocessor1(host);
  // CP0 accepts standalone callbacks, so the caller supplies the owner binding.
  const cp0 = new Coprocessor0(undefined, host.getAccessOrigin.bind(host));
  const events: string[] = [];
  const releases = [
    registers.addRegistersObserver((notice) => events.push(notice.getOrigin())),
    registers.getProgramCounterRegister().subscribe((notice) => events.push(notice.getOrigin())),
    cp0.addRegistersObserver((notice) => events.push(notice.getOrigin())),
    cp1.addRegistersObserver((notice) => events.push(notice.getOrigin()))
  ];
  const writeAll = () => {
    registers.updateRegister(8, 1);
    registers.updateRegister(33, 1);
    registers.updateRegister(34, 1);
    registers.initializeProgramCounter(4);
    cp0.updateRegister(8, 1);
    cp1.updateRegister(0, 1);
  };
  writeAll();
  expect(events).toEqual(Array(6).fill('mips'));
  host.context = 'gui';
  writeAll();
  expect(events.slice(6)).toEqual(Array(6).fill('gui'));
  releases.forEach((release) => release());
  writeAll();
  expect(events).toHaveLength(12);
});
