/* Copyright (c) 2003-2013, Pete Sanderson and Kenneth Vollmar. MIT license; see MARSlicense.txt.
 * Ports mars/mips/hardware/MemoryConfiguration.java. */

/** One memory layout; addresses are signed 32-bit word patterns. */
export class MemoryConfiguration {
  /** Creates a session-owned configuration from parallel names and values. */
  constructor(
    private readonly identifier: string,
    private readonly name: string,
    private readonly names: readonly string[],
    private readonly values: readonly number[]
  ) {}
  /** Returns the persistent identifier. */
  getConfigurationIdentifier(): string {
    return this.identifier;
  }
  /** Returns the display name. */
  getConfigurationName(): string {
    return this.name;
  }
  /** Returns the address table; callers must not mutate it. */
  getConfigurationItemValues(): readonly number[] {
    return this.values;
  }
  /** Returns labels in address-table order. */
  getConfigurationItemNames(): readonly string[] {
    return this.names;
  }
  /** Returns the signed TextBaseAddress address value. */
  getTextBaseAddress(): number {
    return this.values[0];
  }
  /** Returns the signed DataSegmentBaseAddress address value. */
  getDataSegmentBaseAddress(): number {
    return this.values[1];
  }
  /** Returns the signed ExternBaseAddress address value. */
  getExternBaseAddress(): number {
    return this.values[2];
  }
  /** Returns the signed GlobalPointer address value. */
  getGlobalPointer(): number {
    return this.values[3];
  }
  /** Returns the signed DataBaseAddress address value. */
  getDataBaseAddress(): number {
    return this.values[4];
  }
  /** Returns the signed HeapBaseAddress address value. */
  getHeapBaseAddress(): number {
    return this.values[5];
  }
  /** Returns the signed StackPointer address value. */
  getStackPointer(): number {
    return this.values[6];
  }
  /** Returns the signed StackBaseAddress address value. */
  getStackBaseAddress(): number {
    return this.values[7];
  }
  /** Returns the signed UserHighAddress address value. */
  getUserHighAddress(): number {
    return this.values[8];
  }
  /** Returns the signed KernelBaseAddress address value. */
  getKernelBaseAddress(): number {
    return this.values[9];
  }
  /** Returns the signed KernelTextBaseAddress address value. */
  getKernelTextBaseAddress(): number {
    return this.values[10];
  }
  /** Returns the signed ExceptionHandlerAddress address value. */
  getExceptionHandlerAddress(): number {
    return this.values[11];
  }
  /** Returns the signed KernelDataBaseAddress address value. */
  getKernelDataBaseAddress(): number {
    return this.values[12];
  }
  /** Returns the signed MemoryMapBaseAddress address value. */
  getMemoryMapBaseAddress(): number {
    return this.values[13];
  }
  /** Returns the signed KernelHighAddress address value. */
  getKernelHighAddress(): number {
    return this.values[14];
  }
  /** Returns the signed DataSegmentLimitAddress address value. */
  getDataSegmentLimitAddress(): number {
    return this.values[15];
  }
  /** Returns the signed TextLimitAddress address value. */
  getTextLimitAddress(): number {
    return this.values[16];
  }
  /** Returns the signed KernelDataSegmentLimitAddress address value. */
  getKernelDataSegmentLimitAddress(): number {
    return this.values[17];
  }
  /** Returns the signed KernelTextLimitAddress address value. */
  getKernelTextLimitAddress(): number {
    return this.values[18];
  }
  /** Returns the signed StackLimitAddress address value. */
  getStackLimitAddress(): number {
    return this.values[19];
  }
  /** Returns the signed MemoryMapLimitAddress address value. */
  getMemoryMapLimitAddress(): number {
    return this.values[20];
  }
}
