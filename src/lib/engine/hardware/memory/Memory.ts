/* Copyright (c) 2003-2013, Pete Sanderson and Kenneth Vollmar. MIT license; see MARSlicense.txt.
 * Ports mars/mips/hardware/Memory.java. */
import { Binary } from '../../formatting/Binary.js';
import { AccessNotice, type AccessOrigin } from '../notices/AccessNotice.js';
import { AddressErrorException } from './AddressErrorException.js';
import { MemoryAccessNotice } from '../notices/MemoryAccessNotice.js';
import { MemoryConfigurations } from './MemoryConfigurations.js';

/** Portable sparse memory payload; block indices retain allocation and raw zero words. */
export interface MemoryState {
  /** Raw data, kernel data, stack, and MMIO blocks, in that order. */
  words: [number, number[]][][];
  /** User and kernel text blocks, containing instruction words or empty slots. */
  text: [number, (number | null)[]][][];
  /** Next heap allocation address. */
  heapAddress: number;
  /** Whether byte accesses use little endian ordering. */
  littleEndian: boolean;
}

/** Validate portable memory before allocating or mutating a machine. */
export function isMemoryState(value: unknown): value is MemoryState {
  if (!value || typeof value !== 'object') return false;
  const state = value as MemoryState;
  const word = (v: unknown) => typeof v === 'number' && (v | 0) === v;
  const tables = (v: unknown, counts: number[], text: boolean): boolean =>
    Array.isArray(v) &&
    v.length === counts.length &&
    v.every((table, i) => {
      if (!Array.isArray(table) || table.length > counts[i]) return false;
      const seen = new Set<number>();
      return table.every((entry) => {
        if (!Array.isArray(entry) || entry.length !== 2) return false;
        const [index, block] = entry;
        if (!Number.isInteger(index) || index < 0 || index >= counts[i] || seen.has(index))
          return false;
        seen.add(index);
        return (
          Array.isArray(block) &&
          block.length === 1024 &&
          block.every((n) => word(n) || (text && n === null))
        );
      });
    });
  return (
    word(state.heapAddress) &&
    typeof state.littleEndian === 'boolean' &&
    tables(state.words, [1024, 1024, 1024, 16], false) &&
    tables(state.text, [1024, 1024], true)
  );
}

/** The storage-facing ProgramStatement contract; instruction decoding belongs to the owning session. */
export interface MemoryStatement {
  /** Returns the exact signed machine instruction word. */
  getBinaryStatement(): number;
}

/** Injected services replacing Memory's Java Globals/settings/program dependencies. */
export interface MemoryHost<Statement extends MemoryStatement> {
  /** Constructs a real decoded statement for self-modifying code or execution from data. */
  decodeStatement(binary: number, address: number): Statement;
  /** Reads this session's self-modifying-code setting; absent means disabled. */
  isSelfModifyingCodeEnabled?: () => boolean;
  /** False suppresses access notices when a GUI has no program; absent enables headless-style notices. */
  notificationsEnabled?: () => boolean;
  /** Identifies the current access source; absent means other. */
  getAccessOrigin?: () => AccessOrigin;
  /** Receives debug lines without a newline; absence disables legacy debug output. */
  debug?: (line: string) => void;
  /** Records a raw-word restore when backstepping is enabled. */
  addMemoryRestoreRawWord?: (address: number, old: number) => void;
  /** Records a word restore when enabled and returns the previous value. */
  addMemoryRestoreWord?: (address: number, old: number) => number;
  /** Records a halfword restore when enabled and returns the previous value. */
  addMemoryRestoreHalf?: (address: number, old: number) => number;
  /** Records a byte restore when enabled and returns the previous value. */
  addMemoryRestoreByte?: (address: number, old: number) => number;
}

/** A memory observer; the registering owner must call its returned unsubscribe function. */
export type MemoryObserver = (notice: MemoryAccessNotice) => void;
type WordTable = (Int32Array | null)[];
type StatementTable<S> = ((S | null)[] | null)[];
type MemorySubscription = { observer: MemoryObserver | null; low: number; high: number };

/** Session-owned MIPS memory, retaining Java's sparse block tables and access algorithms. */
export class Memory<Statement extends MemoryStatement = MemoryStatement> {
  /** Number of bytes in one MIPS word. */
  static readonly WORD_LENGTH_BYTES = 4;
  /** Least-significant byte at the lowest address. */
  static readonly LITTLE_ENDIAN = true;
  /** Most-significant byte at the lowest address. */
  static readonly BIG_ENDIAN = false;
  private static readonly BLOCK_LENGTH_WORDS = 1024;
  private static readonly BLOCK_TABLE_LENGTH = 1024;
  private static readonly MMIO_TABLE_LENGTH = 16;
  private static readonly TEXT_BLOCK_LENGTH_WORDS = 1024;
  private static readonly TEXT_BLOCK_TABLE_LENGTH = 1024;
  private byteOrder = Memory.LITTLE_ENDIAN;
  private dataBlockTable: WordTable = [];
  private kernelDataBlockTable: WordTable = [];
  private stackBlockTable: WordTable = [];
  private memoryMapBlockTable: WordTable = [];
  private textBlockTable: StatementTable<Statement> = [];
  private kernelTextBlockTable: StatementTable<Statement> = [];
  private observables: MemorySubscription[] = [];
  private readonly floatBits = new DataView(new ArrayBuffer(8));
  /** Signed configured textBaseAddress address. */
  textBaseAddress = 0;
  /** Signed configured dataSegmentBaseAddress address. */
  dataSegmentBaseAddress = 0;
  /** Signed configured externBaseAddress address. */
  externBaseAddress = 0;
  /** Signed configured globalPointer address. */
  globalPointer = 0;
  /** Signed configured dataBaseAddress address. */
  dataBaseAddress = 0;
  /** Signed configured heapBaseAddress address. */
  heapBaseAddress = 0;
  /** Signed configured stackPointer address. */
  stackPointer = 0;
  /** Signed configured stackBaseAddress address. */
  stackBaseAddress = 0;
  /** Signed configured userHighAddress address. */
  userHighAddress = 0;
  /** Signed configured kernelBaseAddress address. */
  kernelBaseAddress = 0;
  /** Signed configured kernelTextBaseAddress address. */
  kernelTextBaseAddress = 0;
  /** Signed configured exceptionHandlerAddress address. */
  exceptionHandlerAddress = 0;
  /** Signed configured kernelDataBaseAddress address. */
  kernelDataBaseAddress = 0;
  /** Signed configured memoryMapBaseAddress address. */
  memoryMapBaseAddress = 0;
  /** Signed configured kernelHighAddress address. */
  kernelHighAddress = 0;
  /** Signed heapAddress; limits retain the canonical exclusive/inclusive segment conventions. */
  heapAddress = 0;
  /** Signed dataSegmentLimitAddress; limits retain the canonical exclusive/inclusive segment conventions. */
  dataSegmentLimitAddress = 0;
  /** Signed textLimitAddress; limits retain the canonical exclusive/inclusive segment conventions. */
  textLimitAddress = 0;
  /** Signed kernelDataSegmentLimitAddress; limits retain the canonical exclusive/inclusive segment conventions. */
  kernelDataSegmentLimitAddress = 0;
  /** Signed kernelTextLimitAddress; limits retain the canonical exclusive/inclusive segment conventions. */
  kernelTextLimitAddress = 0;
  /** Signed stackLimitAddress; limits retain the canonical exclusive/inclusive segment conventions. */
  stackLimitAddress = 0;
  /** Signed memoryMapLimitAddress; limits retain the canonical exclusive/inclusive segment conventions. */
  memoryMapLimitAddress = 0;
  /** Creates isolated memory using the supplied decoder and optional configuration collection. */
  constructor(
    private readonly host: MemoryHost<Statement>,
    private readonly configurations = new MemoryConfigurations()
  ) {
    this.clear();
  }
  /** Capture allocated blocks without notices; callers must hold an idle machine checkpoint. */
  captureState(): MemoryState {
    return {
      words: [
        this.dataBlockTable,
        this.kernelDataBlockTable,
        this.stackBlockTable,
        this.memoryMapBlockTable
      ].map((table) =>
        table.flatMap((block, i) => (block ? [[i, Array.from(block)] as [number, number[]]] : []))
      ),
      text: [this.textBlockTable, this.kernelTextBlockTable].map((table) =>
        table.flatMap((block, i) =>
          block
            ? [
                [i, Array.from(block, (ps) => ps?.getBinaryStatement() ?? null)] as [
                  number,
                  (number | null)[]
                ]
              ]
            : []
        )
      ),
      heapAddress: this.heapAddress,
      littleEndian: this.byteOrder
    };
  }
  /** Restore validated allocated blocks silently, retaining matching assembled statement objects and observers. */
  restoreState(state: MemoryState): void {
    if (!isMemoryState(state)) throw new TypeError('Invalid memory checkpoint');
    const words = state.words.map((entries, i) => {
      const table: WordTable = Array(i === 3 ? 16 : 1024).fill(null);
      for (const [index, block] of entries) table[index] = Int32Array.from(block);
      return table;
    });
    const text = state.text.map((entries, i) => {
      const old = i === 0 ? this.textBlockTable : this.kernelTextBlockTable;
      const base = i === 0 ? this.textBaseAddress : this.kernelTextBaseAddress;
      const table: StatementTable<Statement> = Array(1024).fill(null);
      for (const [index, block] of entries)
        table[index] = block.map((word, offset) => {
          if (word === null) return null;
          const original = old[index]?.[offset];
          return original?.getBinaryStatement() === word
            ? original
            : this.host.decodeStatement(word, (base + (index * 1024 + offset) * 4) | 0);
        });
      return table;
    });
    [
      this.dataBlockTable,
      this.kernelDataBlockTable,
      this.stackBlockTable,
      this.memoryMapBlockTable
    ] = words;
    [this.textBlockTable, this.kernelTextBlockTable] = text;
    this.heapAddress = state.heapAddress;
    this.byteOrder = state.littleEndian;
  }
  /** Decode a detached instruction for restoring historical statement identities without a memory write. */
  decodeCheckpointStatement(word: number, address: number): Statement {
    return this.host.decodeStatement(word, address);
  }
  /** Clears storage and heap position using the current configuration; subscriptions and byte order survive. */
  clear(): void {
    this.setConfiguration();
    this.initialize();
  }
  /** Copies the selected layout and clamps limits to the actual sparse-table capacities. */
  setConfiguration(): void {
    const configuration = this.configurations.getCurrentConfiguration();
    this.textBaseAddress = configuration.getTextBaseAddress();
    this.dataSegmentBaseAddress = configuration.getDataSegmentBaseAddress();
    this.externBaseAddress = configuration.getExternBaseAddress();
    this.globalPointer = configuration.getGlobalPointer();
    this.dataBaseAddress = configuration.getDataBaseAddress();
    this.heapBaseAddress = configuration.getHeapBaseAddress();
    this.stackPointer = configuration.getStackPointer();
    this.stackBaseAddress = configuration.getStackBaseAddress();
    this.userHighAddress = configuration.getUserHighAddress();
    this.kernelBaseAddress = configuration.getKernelBaseAddress();
    this.kernelTextBaseAddress = configuration.getKernelTextBaseAddress();
    this.exceptionHandlerAddress = configuration.getExceptionHandlerAddress();
    this.kernelDataBaseAddress = configuration.getKernelDataBaseAddress();
    this.memoryMapBaseAddress = configuration.getMemoryMapBaseAddress();
    this.kernelHighAddress = configuration.getKernelHighAddress();
    this.dataSegmentLimitAddress = Math.min(
      configuration.getDataSegmentLimitAddress(),
      (this.dataSegmentBaseAddress + 0x400000) | 0
    );
    this.textLimitAddress = Math.min(
      configuration.getTextLimitAddress(),
      (this.textBaseAddress + 0x400000) | 0
    );
    this.kernelDataSegmentLimitAddress = Math.min(
      configuration.getKernelDataSegmentLimitAddress(),
      (this.kernelDataBaseAddress + 0x400000) | 0
    );
    this.kernelTextLimitAddress = Math.min(
      configuration.getKernelTextLimitAddress(),
      (this.kernelTextBaseAddress + 0x400000) | 0
    );
    this.stackLimitAddress = Math.max(
      configuration.getStackLimitAddress(),
      (this.stackBaseAddress - 0x400000) | 0
    );
    this.memoryMapLimitAddress = Math.min(
      configuration.getMemoryMapLimitAddress(),
      (this.memoryMapBaseAddress + 0x10000) | 0
    );
  }
  /** Tests whether the configured highest kernel address fits in fifteen bits. */
  usingCompactMemoryConfiguration(): boolean {
    return (this.kernelHighAddress & 0x7fff) === this.kernelHighAddress;
  }
  private initialize(): void {
    this.heapAddress = this.heapBaseAddress;
    this.textBlockTable = Array(Memory.TEXT_BLOCK_TABLE_LENGTH).fill(null);
    this.kernelTextBlockTable = Array(Memory.TEXT_BLOCK_TABLE_LENGTH).fill(null);
    this.dataBlockTable = Array(Memory.BLOCK_TABLE_LENGTH).fill(null);
    this.kernelDataBlockTable = Array(Memory.BLOCK_TABLE_LENGTH).fill(null);
    this.stackBlockTable = Array(Memory.BLOCK_TABLE_LENGTH).fill(null);
    this.memoryMapBlockTable = Array(Memory.MMIO_TABLE_LENGTH).fill(null);
  }
  /** Bump-allocates heap bytes, rounding up to a word and preserving Java overflow behavior. */
  allocateBytesFromHeap(numBytes: number): number {
    numBytes |= 0;
    const result = this.heapAddress;
    if (numBytes < 0) throw this.illegalArgument(`request (${numBytes}) is negative heap amount`);
    let newHeapAddress = (this.heapAddress + numBytes) | 0;
    if (newHeapAddress % 4 !== 0)
      newHeapAddress = (newHeapAddress + (4 - (newHeapAddress % 4))) | 0;
    if (newHeapAddress >= this.dataSegmentLimitAddress)
      throw this.illegalArgument(`request (${numBytes}) exceeds available heap storage`);
    this.heapAddress = newHeapAddress;
    return result;
  }
  private illegalArgument(message: string): Error {
    const error = new Error(message);
    error.name = 'IllegalArgumentException';
    return error;
  }
  /** Selects little-endian (true) or big-endian (false) byte access. */
  setByteOrder(order: boolean): void {
    this.byteOrder = order;
  }
  /** Returns the session's current byte order. */
  getByteOrder(): boolean {
    return this.byteOrder;
  }
  /** Writes bytes without alignment checking, returning the previous bytes; text writes require self-modification. */
  set(address: number, value: number, length: number): number {
    address |= 0;
    value |= 0;
    this.host.debug?.(`memory[${address}] set to ${value}(${length} bytes)`);
    let oldValue = 0;
    if (this.inDataSegment(address))
      oldValue = this.storeBytesInTable(
        this.dataBlockTable,
        (address - this.dataSegmentBaseAddress) | 0,
        length,
        value
      );
    else if (address > this.stackLimitAddress && address <= this.stackBaseAddress)
      oldValue = this.storeBytesInTable(
        this.stackBlockTable,
        (this.stackBaseAddress - address) | 0,
        length,
        value
      );
    else if (this.inTextSegment(address)) {
      if (this.host.isSelfModifyingCodeEnabled?.()) {
        const old = this.getStatementNoNotify(address);
        if (old !== null) oldValue = old.getBinaryStatement();
        this.setStatement(address, this.host.decodeStatement(value, address));
      } else throw new AddressErrorException('Cannot write directly to text segment!', 5, address);
    } else if (address >= this.memoryMapBaseAddress && address < this.memoryMapLimitAddress)
      oldValue = this.storeBytesInTable(
        this.memoryMapBlockTable,
        (address - this.memoryMapBaseAddress) | 0,
        length,
        value
      );
    else if (this.inKernelDataSegment(address))
      oldValue = this.storeBytesInTable(
        this.kernelDataBlockTable,
        (address - this.kernelDataBaseAddress) | 0,
        length,
        value
      );
    else if (this.inKernelTextSegment(address))
      throw new AddressErrorException(
        'DEVELOPER: You must use setStatement() to write to kernel text segment!',
        5,
        address
      );
    else throw new AddressErrorException('address out of range ', 5, address);
    this.notifyAnyObservers(AccessNotice.WRITE, address, length, value);
    return oldValue;
  }
  /** Writes a word's raw representation without endian adjustment, notifying before recording backstep. */
  setRawWord(address: number, value: number): number {
    address |= 0;
    value |= 0;
    if (address % 4 !== 0)
      throw new AddressErrorException('store address not aligned on word boundary ', 5, address);
    let oldValue = 0;
    if (this.inDataSegment(address))
      oldValue = this.storeWordInTable(
        this.dataBlockTable,
        (address - this.dataSegmentBaseAddress) >> 2,
        value
      );
    else if (address > this.stackLimitAddress && address <= this.stackBaseAddress)
      oldValue = this.storeWordInTable(
        this.stackBlockTable,
        (this.stackBaseAddress - address) >> 2,
        value
      );
    else if (this.inTextSegment(address)) {
      if (this.host.isSelfModifyingCodeEnabled?.()) {
        const old = this.getStatementNoNotify(address);
        if (old !== null) oldValue = old.getBinaryStatement();
        this.setStatement(address, this.host.decodeStatement(value, address));
      } else throw new AddressErrorException('Cannot write directly to text segment!', 5, address);
    } else if (address >= this.memoryMapBaseAddress && address < this.memoryMapLimitAddress)
      oldValue = this.storeWordInTable(
        this.memoryMapBlockTable,
        (address - this.memoryMapBaseAddress) >> 2,
        value
      );
    else if (this.inKernelDataSegment(address))
      oldValue = this.storeWordInTable(
        this.kernelDataBlockTable,
        (address - this.kernelDataBaseAddress) >> 2,
        value
      );
    else if (this.inKernelTextSegment(address))
      throw new AddressErrorException(
        'DEVELOPER: You must use setStatement() to write to kernel text segment!',
        5,
        address
      );
    else throw new AddressErrorException('store address out of range ', 5, address);
    this.notifyAnyObservers(AccessNotice.WRITE, address, 4, value);
    this.host.addMemoryRestoreRawWord?.(address, oldValue);
    return oldValue;
  }
  /** Writes an aligned endian-aware word and records a restore through the host. */
  setWord(address: number, value: number): number {
    address |= 0;
    if (address % 4 !== 0)
      throw new AddressErrorException('store address not aligned on word boundary ', 5, address);
    const old = this.set(address, value, 4);
    return this.host.addMemoryRestoreWord?.(address, old) ?? old;
  }
  /** Writes the low halfword at an aligned address and records a restore through the host. */
  setHalf(address: number, value: number): number {
    address |= 0;
    if (address % 2 !== 0)
      throw new AddressErrorException(
        'store address not aligned on halfword boundary ',
        5,
        address
      );
    const old = this.set(address, value, 2);
    return this.host.addMemoryRestoreHalf?.(address, old) ?? old;
  }
  /** Writes the low byte and records a restore through the host. */
  setByte(address: number, value: number): number {
    address |= 0;
    const old = this.set(address, value, 1);
    return this.host.addMemoryRestoreByte?.(address, old) ?? old;
  }
  /** Stores the high double word at address+4 first; Java canonicalizes NaNs and adds no backstep entry. */
  setDouble(address: number, value: number): number {
    address |= 0;
    this.floatBits.setFloat64(0, value);
    const bits = Number.isNaN(value) ? 0x7ff8000000000000n : this.floatBits.getBigInt64(0);
    const oldHigh = this.set((address + 4) | 0, Binary.highOrderLongToInt(bits), 4);
    const oldLow = this.set(address, Binary.lowOrderLongToInt(bits), 4);
    this.floatBits.setBigInt64(0, Binary.twoIntsToLong(oldHigh, oldLow));
    return this.floatBits.getFloat64(0);
  }
  /** Stores an instruction reference, or clears its slot with null, without notifying observers. Debug formatting of a null statement fails before the slot is changed, as in Java. */
  setStatement(address: number, statement: Statement | null): void {
    address |= 0;
    if (address % 4 !== 0 || !(this.inTextSegment(address) || this.inKernelTextSegment(address)))
      throw new AddressErrorException(
        'store address to text segment out of range or not aligned to word boundary ',
        5,
        address
      );
    this.host.debug?.(`memory[${address}] set to ${statement!.getBinaryStatement()}`);
    if (this.inTextSegment(address))
      this.storeProgramStatement(address, statement, this.textBaseAddress, this.textBlockTable);
    else
      this.storeProgramStatement(
        address,
        statement,
        this.kernelTextBaseAddress,
        this.kernelTextBlockTable
      );
  }
  /** Reads up to four bytes without alignment checks and emits a read notice. */
  get(address: number, length: number): number {
    return this.readBytes(address | 0, length, true);
  }
  private readBytes(address: number, length: number, notify: boolean): number {
    let value: number;
    if (this.inDataSegment(address))
      value = this.fetchBytesFromTable(
        this.dataBlockTable,
        (address - this.dataSegmentBaseAddress) | 0,
        length
      );
    else if (address > this.stackLimitAddress && address <= this.stackBaseAddress)
      value = this.fetchBytesFromTable(
        this.stackBlockTable,
        (this.stackBaseAddress - address) | 0,
        length
      );
    else if (address >= this.memoryMapBaseAddress && address < this.memoryMapLimitAddress)
      value = this.fetchBytesFromTable(
        this.memoryMapBlockTable,
        (address - this.memoryMapBaseAddress) | 0,
        length
      );
    else if (this.inTextSegment(address)) {
      if (this.host.isSelfModifyingCodeEnabled?.())
        value = this.getStatementNoNotify(address)?.getBinaryStatement() ?? 0;
      else throw new AddressErrorException('Cannot read directly from text segment!', 4, address);
    } else if (this.inKernelDataSegment(address))
      value = this.fetchBytesFromTable(
        this.kernelDataBlockTable,
        (address - this.kernelDataBaseAddress) | 0,
        length
      );
    else if (this.inKernelTextSegment(address))
      throw new AddressErrorException(
        'DEVELOPER: You must use getStatement() to read from kernel text segment!',
        4,
        address
      );
    else throw new AddressErrorException('address out of range ', 4, address);
    if (notify) this.notifyAnyObservers(AccessNotice.READ, address, length, value);
    return value;
  }
  /** Reads an aligned raw word, ignoring byte order and returning zero for unallocated storage. */
  getRawWord(address: number): number {
    address |= 0;
    if (address % 4 !== 0)
      throw new AddressErrorException('address for fetch not aligned on word boundary', 4, address);
    let value: number;
    if (this.inDataSegment(address))
      value = this.fetchWordFromTable(
        this.dataBlockTable,
        (address - this.dataSegmentBaseAddress) >> 2
      );
    else if (address > this.stackLimitAddress && address <= this.stackBaseAddress)
      value = this.fetchWordFromTable(this.stackBlockTable, (this.stackBaseAddress - address) >> 2);
    else if (address >= this.memoryMapBaseAddress && address < this.memoryMapLimitAddress)
      value = this.fetchWordFromTable(
        this.memoryMapBlockTable,
        (address - this.memoryMapBaseAddress) >> 2
      );
    else if (this.inTextSegment(address)) {
      if (this.host.isSelfModifyingCodeEnabled?.())
        value = this.getStatementNoNotify(address)?.getBinaryStatement() ?? 0;
      else throw new AddressErrorException('Cannot read directly from text segment!', 4, address);
    } else if (this.inKernelDataSegment(address))
      value = this.fetchWordFromTable(
        this.kernelDataBlockTable,
        (address - this.kernelDataBaseAddress) >> 2
      );
    else if (this.inKernelTextSegment(address))
      throw new AddressErrorException(
        'DEVELOPER: You must use getStatement() to read from kernel text segment!',
        4,
        address
      );
    else throw new AddressErrorException('address out of range ', 4, address);
    this.notifyAnyObservers(AccessNotice.READ, address, 4, value);
    return value;
  }
  /** Reads dump data silently; returns null for unallocated blocks/instructions and deliberately rejects MMIO. */
  getRawWordOrNull(address: number): number | null {
    address |= 0;
    if (address % 4 !== 0)
      throw new AddressErrorException('address for fetch not aligned on word boundary', 4, address);
    if (this.inDataSegment(address))
      return this.fetchWordOrNullFromTable(
        this.dataBlockTable,
        (address - this.dataSegmentBaseAddress) >> 2
      );
    if (address > this.stackLimitAddress && address <= this.stackBaseAddress)
      return this.fetchWordOrNullFromTable(
        this.stackBlockTable,
        (this.stackBaseAddress - address) >> 2
      );
    if (this.inTextSegment(address) || this.inKernelTextSegment(address)) {
      try {
        return this.getStatementNoNotify(address) === null
          ? null
          : this.getStatementNoNotify(address)!.getBinaryStatement();
      } catch (error) {
        if (error instanceof AddressErrorException) return null;
        throw error;
      }
    }
    if (this.inKernelDataSegment(address))
      return this.fetchWordOrNullFromTable(
        this.kernelDataBlockTable,
        (address - this.kernelDataBaseAddress) >> 2
      );
    throw new AddressErrorException('address out of range ', 4, address);
  }
  /** Finds the first null instruction/unallocated block at a word address below the exclusive limit. */
  getAddressOfFirstNull(baseAddress: number, limitAddress: number): number {
    let address = baseAddress | 0;
    for (; address < (limitAddress | 0); address = (address + 4) | 0)
      if (this.getRawWordOrNull(address) === null) break;
    return address;
  }
  /** Reads an aligned endian-aware word with notification. */
  getWord(address: number): number {
    address |= 0;
    if (address % 4 !== 0)
      throw new AddressErrorException('fetch address not aligned on word boundary ', 4, address);
    return this.readBytes(address, 4, true);
  }
  /** Reads an aligned endian-aware word without notification. */
  getWordNoNotify(address: number): number {
    address |= 0;
    if (address % 4 !== 0)
      throw new AddressErrorException('fetch address not aligned on word boundary ', 4, address);
    return this.readBytes(address, 4, false);
  }
  /** Reads an unsigned aligned halfword into the low sixteen bits. */
  getHalf(address: number): number {
    address |= 0;
    if (address % 2 !== 0)
      throw new AddressErrorException(
        'fetch address not aligned on halfword boundary ',
        4,
        address
      );
    return this.get(address, 2);
  }
  /** Reads an unsigned byte into the low eight bits. */
  getByte(address: number): number {
    return this.get(address, 1);
  }
  /** Fetches a text instruction with notification, or decodes a data word when self-modification permits it. */
  getStatement(address: number): Statement | null {
    return this.readStatement(address | 0, true);
  }
  /** Fetches text silently; Java still notifies for data-segment instruction decoding. */
  getStatementNoNotify(address: number): Statement | null {
    return this.readStatement(address | 0, false);
  }
  private readStatement(address: number, notify: boolean): Statement | null {
    if (!Memory.wordAligned(address))
      throw new AddressErrorException(
        'fetch address for text segment not aligned to word boundary ',
        4,
        address
      );
    if (
      !this.host.isSelfModifyingCodeEnabled?.() &&
      !(this.inTextSegment(address) || this.inKernelTextSegment(address))
    )
      throw new AddressErrorException('fetch address for text segment out of range ', 4, address);
    if (this.inTextSegment(address))
      return this.readProgramStatement(address, this.textBaseAddress, this.textBlockTable, notify);
    if (this.inKernelTextSegment(address))
      return this.readProgramStatement(
        address,
        this.kernelTextBaseAddress,
        this.kernelTextBlockTable,
        notify
      );
    return this.host.decodeStatement(this.get(address, 4), address);
  }
  /** Tests word alignment using signed Java integer arithmetic. */
  static wordAligned(address: number): boolean {
    return (address | 0) % 4 === 0;
  }
  /** Tests eight-byte alignment. */
  static doublewordAligned(address: number): boolean {
    return (address | 0) % 8 === 0;
  }
  /** Retains the legacy negative-address rounding formula, including its unusual results. */
  static alignToWordBoundary(address: number): number {
    address |= 0;
    if (!Memory.wordAligned(address))
      address = (address > 0 ? address + (4 - (address % 4)) : address - (4 - (address % 4))) | 0;
    return address;
  }
  /** Tests membership in the allocated user text address range. */
  inTextSegment(address: number): boolean {
    address |= 0;
    return address >= this.textBaseAddress && address < this.textLimitAddress;
  }
  /** Tests membership in the allocated kernel text address range. */
  inKernelTextSegment(address: number): boolean {
    address |= 0;
    return address >= this.kernelTextBaseAddress && address < this.kernelTextLimitAddress;
  }
  /** Tests membership in the allocated user data address range. */
  inDataSegment(address: number): boolean {
    address |= 0;
    return address >= this.dataSegmentBaseAddress && address < this.dataSegmentLimitAddress;
  }
  /** Tests membership in the allocated kernel data address range. */
  inKernelDataSegment(address: number): boolean {
    address |= 0;
    return address >= this.kernelDataBaseAddress && address < this.kernelDataSegmentLimitAddress;
  }
  /** Tests configured MMIO membership; Java excludes the highest kernel address. */
  inMemoryMapSegment(address: number): boolean {
    address |= 0;
    return address >= this.memoryMapBaseAddress && address < this.kernelHighAddress;
  }
  /** Registers all memory, one word, or an inclusive word-address range; caller must release the returned teardown. */
  addObserver(observer: MemoryObserver, startAddress?: number, endAddress?: number): () => void {
    if (startAddress === undefined) {
      const low = this.addObserver(observer, 0, 0x7ffffffc);
      const high = this.addObserver(observer, -2147483648, -4);
      return () => {
        low();
        high();
      };
    }
    const start = startAddress | 0;
    const end = (endAddress ?? start) | 0;
    if (start % 4 !== 0 || (end !== start && end % 4 !== 0))
      throw new AddressErrorException('address not aligned on word boundary ', 4, start);
    if (start >= 0 && end < 0)
      throw new AddressErrorException('range cannot cross 0x8000000; please split it up', 4, start);
    if (end < start)
      throw new AddressErrorException('end address of range < start address of range ', 4, start);
    const subscription: MemorySubscription = { observer, low: start, high: end };
    this.observables.push(subscription);
    return () => {
      subscription.observer = null;
    };
  }
  /** Returns range-record count, including records whose observer has been removed, as Java does. */
  countObservers(): number {
    return this.observables.length;
  }
  /** Releases every registration of the given callback while retaining Java's range records. */
  deleteObserver(observer: MemoryObserver): void {
    for (const record of this.observables) if (record.observer === observer) record.observer = null;
  }
  /** Discards all registrations and their address ranges. */
  deleteObservers(): void {
    this.observables = [];
  }
  /** Direct notification is unsupported: access methods notify matching delegates. */
  notifyObservers(notice?: unknown): never {
    void notice;
    const error = new Error();
    error.name = 'UnsupportedOperationException';
    throw error;
  }
  private notifyAnyObservers(type: number, address: number, length: number, value: number): void {
    if (this.host.notificationsEnabled?.() === false || this.observables.length === 0) return;
    const records = this.observables;
    const originalLength = records.length;
    for (let index = 0; index < records.length; index++) {
      if (records.length !== originalLength) {
        const error = new Error();
        error.name = 'ConcurrentModificationException';
        throw error;
      }
      const record = records[index];
      if (address >= record.low && address <= ((record.high - 1 + 4) | 0)) {
        const notice = new MemoryAccessNotice(
          type,
          address,
          length,
          value,
          this.host.getAccessOrigin?.() ?? 'other'
        );
        record.observer?.(notice);
      }
    }
  }
  private arrayIndex(index: number, length: number): void {
    if (index < 0 || index >= length) {
      const error = new RangeError(`Index ${index} out of bounds for length ${length}`);
      error.name = 'ArrayIndexOutOfBoundsException';
      throw error;
    }
  }
  private storeBytesInTable(
    table: WordTable,
    relative: number,
    length: number,
    value: number
  ): number {
    return this.storeOrFetchBytesInTable(table, relative, length, value, true);
  }
  private fetchBytesFromTable(table: WordTable, relative: number, length: number): number {
    return this.storeOrFetchBytesInTable(table, relative, length, 0, false);
  }
  private storeOrFetchBytesInTable(
    table: WordTable,
    relative: number,
    length: number,
    value: number,
    store: boolean
  ): number {
    let oldValue = 0;
    const loopStopper = (3 - length) | 0;
    // The canonical stack correction preserves byte offsets while relative words run downward.
    if (table === this.stackBlockTable) {
      const delta = relative % 4;
      if (delta !== 0) relative = (relative + ((4 - delta) << 1)) | 0;
    }
    for (let valueByte = 3; valueByte > loopStopper; valueByte--) {
      let memoryByte = relative % 4;
      const word = relative >> 2;
      const block = Math.trunc(word / Memory.BLOCK_LENGTH_WORDS);
      const offset = word % Memory.BLOCK_LENGTH_WORDS;
      this.arrayIndex(block, table.length);
      if (table[block] === null) {
        if (store) table[block] = new Int32Array(Memory.BLOCK_LENGTH_WORDS);
        else return 0;
      }
      this.arrayIndex(offset, Memory.BLOCK_LENGTH_WORDS);
      const words = table[block]!;
      if (this.byteOrder === Memory.LITTLE_ENDIAN) memoryByte = 3 - memoryByte;
      if (store) {
        oldValue = this.replaceByte(words[offset], memoryByte, oldValue, valueByte);
        words[offset] = this.replaceByte(value, valueByte, words[offset], memoryByte);
      } else value = this.replaceByte(words[offset], memoryByte, value, valueByte);
      relative = (relative + 1) | 0;
    }
    return store ? oldValue : value;
  }
  private storeWordInTable(table: WordTable, relative: number, value: number): number {
    const block = Math.trunc(relative / Memory.BLOCK_LENGTH_WORDS);
    const offset = relative % Memory.BLOCK_LENGTH_WORDS;
    this.arrayIndex(block, table.length);
    if (table[block] === null) table[block] = new Int32Array(Memory.BLOCK_LENGTH_WORDS);
    this.arrayIndex(offset, Memory.BLOCK_LENGTH_WORDS);
    const words = table[block]!;
    const oldValue = words[offset];
    words[offset] = value;
    return oldValue;
  }
  private fetchWordFromTable(table: WordTable, relative: number): number {
    return this.fetchWordOrNullFromTable(table, relative) ?? 0;
  }
  private fetchWordOrNullFromTable(table: WordTable, relative: number): number | null {
    const block = Math.trunc(relative / Memory.BLOCK_LENGTH_WORDS);
    const offset = relative % Memory.BLOCK_LENGTH_WORDS;
    this.arrayIndex(block, table.length);
    const words = table[block];
    if (words === null) return null;
    this.arrayIndex(offset, Memory.BLOCK_LENGTH_WORDS);
    return words[offset];
  }
  private replaceByte(
    source: number,
    sourceByte: number,
    destination: number,
    destinationByte: number
  ): number {
    return (
      (((source >> (24 - (sourceByte << 3))) & 255) << (24 - (destinationByte << 3))) |
      (destination & ~(255 << (24 - (destinationByte << 3))))
    );
  }
  private storeProgramStatement(
    address: number,
    statement: Statement | null,
    base: number,
    table: StatementTable<Statement>
  ): void {
    const relative = (address - base) >> 2;
    const block = Math.trunc(relative / Memory.BLOCK_LENGTH_WORDS);
    const offset = relative % Memory.BLOCK_LENGTH_WORDS;
    if (block < Memory.TEXT_BLOCK_TABLE_LENGTH) {
      this.arrayIndex(block, table.length);
      if (table[block] === null)
        table[block] = Array<Statement | null>(Memory.BLOCK_LENGTH_WORDS).fill(null);
      this.arrayIndex(offset, Memory.BLOCK_LENGTH_WORDS);
      table[block]![offset] = statement;
    }
  }
  private readProgramStatement(
    address: number,
    base: number,
    table: StatementTable<Statement>,
    notify: boolean
  ): Statement | null {
    const relative = (address - base) >> 2;
    const block = Math.trunc(relative / Memory.TEXT_BLOCK_LENGTH_WORDS);
    const offset = relative % Memory.TEXT_BLOCK_LENGTH_WORDS;
    if (block < Memory.TEXT_BLOCK_TABLE_LENGTH) {
      this.arrayIndex(block, table.length);
      if (table[block] !== null) this.arrayIndex(offset, Memory.TEXT_BLOCK_LENGTH_WORDS);
      if (table[block] === null || table[block]![offset] === null) {
        if (notify) this.notifyAnyObservers(AccessNotice.READ, address, 4, 0);
        return null;
      }
      if (notify)
        this.notifyAnyObservers(
          AccessNotice.READ,
          address,
          4,
          table[block]![offset]!.getBinaryStatement()
        );
      return table[block]![offset];
    }
    if (notify) this.notifyAnyObservers(AccessNotice.READ, address, 4, 0);
    return null;
  }
}
