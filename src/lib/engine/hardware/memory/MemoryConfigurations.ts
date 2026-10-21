/* Copyright (c) 2003-2013, Pete Sanderson and Kenneth Vollmar. MIT license; see MARSlicense.txt.
 * Ports mars/mips/hardware/MemoryConfigurations.java. */

import { MemoryConfiguration } from './MemoryConfiguration.js';

/** Session-owned memory configuration collection; the owner applies changes through its callback. */
export class MemoryConfigurations {
  private readonly configurations: MemoryConfiguration[];
  private current: MemoryConfiguration;
  /** Creates all three canonical layouts; onChange clears memory and resets the owner's register file. */
  constructor(
    private readonly onChange: (configuration: MemoryConfiguration) => void = () => {},
    initial = 'Default'
  ) {
    const names = [
      '.text base address',
      'data segment base address',
      '.extern base address',
      'global pointer $gp',
      '.data base address',
      'heap base address',
      'stack pointer $sp',
      'stack base address',
      'user space high address',
      'kernel space base address',
      '.ktext base address',
      'exception handler address',
      '.kdata base address',
      'MMIO base address',
      'kernel space high address',
      'data segment limit address',
      'text limit address',
      'kernel data segment limit address',
      'kernel text limit address',
      'stack limit address',
      'memory map limit address'
    ];
    this.configurations = [
      new MemoryConfiguration(
        'Default',
        'Default',
        names,
        [
          0x00400000, 0x10000000, 0x10000000, 0x10008000, 0x10010000, 0x10040000, 0x7fffeffc,
          0x7ffffffc, 0x7fffffff, 0x80000000, 0x80000000, 0x80000180, 0x90000000, 0xffff0000,
          0xffffffff, 0x7fffffff, 0x0ffffffc, 0xfffeffff, 0x8ffffffc, 0x10040000, 0xffffffff
        ].map((value) => value | 0)
      ),
      new MemoryConfiguration(
        'CompactDataAtZero',
        'Compact, Data at Address 0',
        names,
        [
          0x00003000, 0x00000000, 0x00001000, 0x00001800, 0x00000000, 0x00002000, 0x00002ffc,
          0x00002ffc, 0x00003fff, 0x00004000, 0x00004000, 0x00004180, 0x00005000, 0x00007f00,
          0x00007fff, 0x00002fff, 0x00003ffc, 0x00007eff, 0x00004ffc, 0x00002000, 0x00007fff
        ].map((value) => value | 0)
      ),
      new MemoryConfiguration(
        'CompactTextAtZero',
        'Compact, Text at Address 0',
        names,
        [
          0x00000000, 0x00001000, 0x00001000, 0x00001800, 0x00002000, 0x00003000, 0x00003ffc,
          0x00003ffc, 0x00003fff, 0x00004000, 0x00004000, 0x00004180, 0x00005000, 0x00007f00,
          0x00007fff, 0x00003fff, 0x00000ffc, 0x00007eff, 0x00004ffc, 0x00003000, 0x00007fff
        ].map((value) => value | 0)
      )
    ];
    this.current = this.configurations[0];
    this.setCurrentConfiguration(this.getConfigurationByName(initial));
  }
  /** Returns layouts in canonical order. */
  getConfigurationsIterator(): IterableIterator<MemoryConfiguration> {
    return this.configurations.values();
  }
  /** Finds the persistent identifier, or null. */
  getConfigurationByName(name: string): MemoryConfiguration | null {
    return this.configurations.find((c) => c.getConfigurationIdentifier() === name) ?? null;
  }
  /** Returns the SPIM default layout. */
  getDefaultConfiguration(): MemoryConfiguration {
    return this.configurations[0];
  }
  /** Returns this session's active layout. */
  getCurrentConfiguration(): MemoryConfiguration {
    return this.current;
  }
  /** Switches by identity and invokes the owner's reset callback exactly once when changed. */
  setCurrentConfiguration(configuration: MemoryConfiguration | null): boolean {
    if (configuration === null || configuration === this.current) return false;
    this.current = configuration;
    this.onChange(configuration);
    return true;
  }
  /** Returns the default layout's TextBaseAddress value. */
  getDefaultTextBaseAddress(): number {
    return this.configurations[0].getTextBaseAddress();
  }
  /** Returns the default layout's DataSegmentBaseAddress value. */
  getDefaultDataSegmentBaseAddress(): number {
    return this.configurations[0].getDataSegmentBaseAddress();
  }
  /** Returns the default layout's ExternBaseAddress value. */
  getDefaultExternBaseAddress(): number {
    return this.configurations[0].getExternBaseAddress();
  }
  /** Returns the default layout's GlobalPointer value. */
  getDefaultGlobalPointer(): number {
    return this.configurations[0].getGlobalPointer();
  }
  /** Returns the default layout's DataBaseAddress value. */
  getDefaultDataBaseAddress(): number {
    return this.configurations[0].getDataBaseAddress();
  }
  /** Returns the default layout's HeapBaseAddress value. */
  getDefaultHeapBaseAddress(): number {
    return this.configurations[0].getHeapBaseAddress();
  }
  /** Returns the default layout's StackPointer value. */
  getDefaultStackPointer(): number {
    return this.configurations[0].getStackPointer();
  }
  /** Returns the default layout's StackBaseAddress value. */
  getDefaultStackBaseAddress(): number {
    return this.configurations[0].getStackBaseAddress();
  }
  /** Returns the default layout's UserHighAddress value. */
  getDefaultUserHighAddress(): number {
    return this.configurations[0].getUserHighAddress();
  }
  /** Returns the default layout's KernelBaseAddress value. */
  getDefaultKernelBaseAddress(): number {
    return this.configurations[0].getKernelBaseAddress();
  }
  /** Returns the default layout's KernelTextBaseAddress value. */
  getDefaultKernelTextBaseAddress(): number {
    return this.configurations[0].getKernelTextBaseAddress();
  }
  /** Returns the default layout's ExceptionHandlerAddress value. */
  getDefaultExceptionHandlerAddress(): number {
    return this.configurations[0].getExceptionHandlerAddress();
  }
  /** Returns the default layout's KernelDataBaseAddress value. */
  getDefaultKernelDataBaseAddress(): number {
    return this.configurations[0].getKernelDataBaseAddress();
  }
  /** Returns the default layout's MemoryMapBaseAddress value. */
  getDefaultMemoryMapBaseAddress(): number {
    return this.configurations[0].getMemoryMapBaseAddress();
  }
  /** Returns the default layout's KernelHighAddress value. */
  getDefaultKernelHighAddress(): number {
    return this.configurations[0].getKernelHighAddress();
  }
  /** Returns the default layout's DataSegmentLimitAddress value. */
  getDefaultDataSegmentLimitAddress(): number {
    return this.configurations[0].getDataSegmentLimitAddress();
  }
  /** Returns the default layout's TextLimitAddress value. */
  getDefaultTextLimitAddress(): number {
    return this.configurations[0].getTextLimitAddress();
  }
  /** Returns the default layout's KernelDataSegmentLimitAddress value. */
  getDefaultKernelDataSegmentLimitAddress(): number {
    return this.configurations[0].getKernelDataSegmentLimitAddress();
  }
  /** Returns the default layout's KernelTextLimitAddress value. */
  getDefaultKernelTextLimitAddress(): number {
    return this.configurations[0].getKernelTextLimitAddress();
  }
  /** Returns the default layout's StackLimitAddress value. */
  getDefaultStackLimitAddress(): number {
    return this.configurations[0].getStackLimitAddress();
  }
  /** Returns the default layout's MemoryMapLimitAddress value. */
  getMemoryMapLimitAddress(): number {
    return this.configurations[0].getMemoryMapLimitAddress();
  }
}
