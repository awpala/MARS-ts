/* Copyright (c) 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports console methods of mars/util/SystemIO.java; see MARSlicense.txt. */
import { JavaCharacter } from '../assembler/tokenization/JavaCharacter.js';
import { NumberFormatException } from '../formatting/Binary.js';

/** One console or same-tab input request; the owning browser adapter controls focus and cancellation. */
export interface InputRequest {
  /** Active syscall number, including configured overrides. */
  serviceNumber: number;
  /** Canonical popup prompt, or null when the Run I/O console owns input. */
  prompt: string | null;
  /** Character/string input bound; -1 means numeric input without a length bound. */
  maxLength: number;
}
/** Browser or test platform adapter; no CLI or process streams are imported by the engine. */
export interface SystemIOHost {
  /** Deliver one entered string; asynchronous adapters resolve after user submission. */
  readInput(request: InputRequest): string | Promise<string>;
  /** Append exactly this text to Run I/O, without adding a newline. */
  printString(text: string): void;
  /** Read the live session preference for popup input versus the console. */
  getPopupSyscallInput(): boolean;
  /** Release any browser file descriptors owned by the host at simulator reset; absent when no file services are installed. */
  resetFiles?(): void;
  /** Java Float.parseFloat semantics supplied by the numeric runtime adapter. */
  parseFloat(text: string): number;
  /** Java Double.parseDouble semantics supplied by the numeric runtime adapter. */
  parseDouble(text: string): number;
  /** Java Float.toString semantics supplied by the numeric runtime adapter. */
  formatFloat(value: number): string;
  /** Java Double.toString semantics supplied by the numeric runtime adapter. */
  formatDouble(value: number): string;
}

/** Session-owned GUI console I/O; ported reads suspend through the injected host instead of blocking Swing. */
export class SystemIO {
  /** Bind input, output, live preferences, and exact floating conversion services to this session. */
  constructor(private readonly host: SystemIOHost) {}
  /** Release host-owned open files at reset; console-only sessions own no descriptors. */
  resetFiles(): void {
    this.host.resetFiles?.();
  }
  /** Emit text unchanged; ownership and disposal of output sinks belong to the host. */
  printString(text: string): void {
    this.host.printString(text);
  }
  /** Format a single-precision number with the canonical Java runtime adapter. */
  formatFloat(value: number): string {
    return this.host.formatFloat(value);
  }
  /** Format a double-precision number with the canonical Java runtime adapter. */
  formatDouble(value: number): string {
    return this.host.formatDouble(value);
  }
  /** Read and parse a signed decimal int, with Java trim and BMP decimal digit semantics. */
  async readInteger(serviceNumber: number): Promise<number> {
    const input = this.trim(
      await this.request(serviceNumber, `Enter an integer value (syscall ${serviceNumber})`, -1)
    );
    let i = 0,
      sign = 1;
    if (input[0] === '-' || input[0] === '+') {
      if (input[0] === '-') sign = -1;
      i++;
    }
    if (i === input.length) throw new NumberFormatException();
    let value = 0;
    for (; i < input.length; i++) {
      const digit = JavaCharacter.decimalDigitValue(input[i]);
      if (digit < 0) throw new NumberFormatException();
      value = value * 10 + digit;
      if (value > (sign < 0 ? 2147483648 : 2147483647)) throw new NumberFormatException();
    }
    return (value * sign) | 0;
  }
  /** Read a float using Java syntax and direct single-precision rounding. */
  async readFloat(serviceNumber: number): Promise<number> {
    return this.host.parseFloat(
      this.trim(
        await this.request(serviceNumber, `Enter a float value (syscall ${serviceNumber})`, -1)
      )
    );
  }
  /** Read a double using Java syntax and binary64 rounding. */
  async readDouble(serviceNumber: number): Promise<number> {
    return this.host.parseDouble(
      this.trim(
        await this.request(serviceNumber, `Enter a double value (syscall ${serviceNumber})`, -1)
      )
    );
  }
  /** Read one UTF-16 string, remove the console's final newline, and enforce the canonical maximum. */
  async readString(serviceNumber: number, maxLength: number): Promise<string> {
    const popup = this.host.getPopupSyscallInput();
    let input = await this.host.readInput({
      serviceNumber,
      prompt: popup
        ? `Enter a string of maximum length ${maxLength} (syscall ${serviceNumber})`
        : null,
      maxLength
    });
    if (!popup && input.endsWith('\n')) input = input.slice(0, -1);
    return input.length > maxLength ? (maxLength <= 0 ? '' : input.slice(0, maxLength)) : input;
  }
  /** Read the first UTF-16 code unit; empty input raises the original index failure for the syscall to report. */
  async readChar(serviceNumber: number): Promise<number> {
    const input = await this.request(
      serviceNumber,
      `Enter a character value (syscall ${serviceNumber})`,
      1
    );
    if (input.length === 0) throw new RangeError('String index out of range: 0');
    return input.charCodeAt(0);
  }
  private request(
    serviceNumber: number,
    prompt: string,
    maxLength: number
  ): string | Promise<string> {
    return this.host.readInput({
      serviceNumber,
      prompt: this.host.getPopupSyscallInput() ? prompt : null,
      maxLength
    });
  }
  private trim(text: string): string {
    let start = 0,
      end = text.length;
    while (start < end && text.charCodeAt(start) <= 32) start++;
    while (end > start && text.charCodeAt(end - 1) <= 32) end--;
    return text.slice(start, end);
  }
}
