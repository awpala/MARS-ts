/* Copyright (c) 2003-2013, Pete Sanderson and Kenneth Vollmar. MIT license; see MARSlicense.txt.
 * Ports mars/mips/dump/SegmentWindowDumpFormat.java. */
import { AbstractDumpFormat } from './AbstractDumpFormat.js';
import { Binary } from '../formatting/Binary.js';
import { Settings } from '../Settings.js';
import { AddressErrorException } from '../hardware/memory/AddressErrorException.js';
import type { Globals } from '../Globals.js';

/** Legacy Text/Data Segment Window presentation, including dropping incomplete eight-word data rows. */
export class SegmentWindowDumpFormat extends AbstractDumpFormat {
  /** Attach legacy metadata; display preferences are read at dump time. */
  constructor(machine: Globals) {
    super(
      machine,
      'Text/Data Segment Window',
      'SegmentWindow',
      ' Text Segment Window or Data Segment Window format to text file',
      'txt'
    );
  }
  /** Format the selected segment using its machine's current hexadecimal/decimal preferences. */
  dumpMemoryRange(firstAddress: number, lastAddress: number): Uint8Array<ArrayBuffer> {
    const memory = this.machine.memory;
    const settings = this.machine.getSettings();
    const addressText = (address: number) =>
      Binary.formatUnsignedInteger(
        address,
        settings.getBooleanSetting(Settings.DISPLAY_ADDRESSES_IN_HEX) ? 16 : 10
      );
    const lines: string[] = [];
    if (memory.inDataSegment(firstAddress)) {
      let offset = 0;
      let row = '';
      for (const [address, word] of this.words(firstAddress, lastAddress)) {
        if (offset % 8 === 0) row = addressText(address) + '    ';
        row +=
          (settings.getBooleanSetting(Settings.DISPLAY_VALUES_IN_HEX)
            ? Binary.intToHexString(word)
            : String(word).padStart(11, ' ')) + ' ';
        if (++offset % 8 === 0) {
          lines.push(row);
          row = '';
        }
      }
      return this.text(lines);
    }
    if (!memory.inTextSegment(firstAddress)) return this.text(lines);
    lines.push(' Address    Code        Basic                     Source', '');
    for (const [address, word] of this.words(firstAddress, lastAddress)) {
      let row = addressText(address) + '  ' + Binary.intToHexString(word) + '  ';
      try {
        const statement = memory.getStatement(address)!;
        row += statement.getPrintableBasicAssemblyStatement().padEnd(22, ' ').slice(0, 22);
        row += (statement.getSource() === '' ? '' : String(statement.getSourceLine()))
          .padEnd(5, ' ')
          .slice(0, 5);
        row += statement.getSource();
      } catch (error) {
        if (!(error instanceof AddressErrorException)) throw error;
      }
      lines.push(row);
    }
    return this.text(lines);
  }
}
