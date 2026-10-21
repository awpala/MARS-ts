/*
 * Copyright (c) 2003–2012 Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/ErrorMessage.java. See MARSlicense.txt at the repository root.
 */

/** Source mapping needed by diagnostics; implemented by assembler SourceLine. */
export interface DiagnosticSourceLine {
  /** Original source filename, before include expansion. */
  getFilename(): string | null;
  /** One-based line in the original file. */
  getLineNumber(): number;
}

/** Narrow MIPSprogram contract used by diagnostics; the caller owns its state. */
export interface DiagnosticProgram {
  /** Source filename supplied by the host. */
  getFilename(): string | null;
  /** Expanded source mapping, or null before tokenization. */
  getSourceLineList(): readonly DiagnosticSourceLine[] | null;
  /** Local macro expansion history, or null before macro processing. */
  getLocalMacroPool(): { getExpansionHistory(): string } | null;
}

/** Narrow ProgramStatement contract used to reconstruct runtime source locations. */
export interface DiagnosticStatement {
  /** Source program, or null for a statement without source. */
  getSourceMIPSprogram(): DiagnosticProgram | null;
  /** One-based source line of the macro invocation or instruction. */
  getSourceLine(): number;
  /** Source text, possibly prefixed by macro definition line markers. */
  getSource(): string;
}

/** One immutable assembly/runtime diagnostic; ports mars/ErrorMessage.java. */
export class ErrorMessage {
  /** Marks a warning. */
  static readonly WARNING = true;
  /** Marks an error. */
  static readonly ERROR = false;
  private readonly warning: boolean;
  private readonly filename: string | null;
  private readonly line: number;
  private readonly position: number;
  private readonly message: string;
  private readonly macroExpansionHistory: string | null;

  /** Construct an error from a filename or a source program. */
  constructor(
    source: string | DiagnosticProgram | null,
    line: number,
    position: number,
    message: string,
    history?: string | null
  );
  /** Construct an error or warning with the legacy explicit severity argument. */
  constructor(
    warning: boolean,
    source: string | DiagnosticProgram | null,
    line: number,
    position: number,
    message: string,
    history?: string | null
  );
  /** Construct a runtime error from an instruction's source and macro markers. */
  constructor(statement: DiagnosticStatement, message: string);
  constructor(
    first: boolean | string | DiagnosticProgram | DiagnosticStatement | null,
    second: string | DiagnosticProgram | number | null,
    third?: number,
    fourth?: number | string,
    fifth?: string | null,
    sixth?: string | null
  ) {
    if (typeof first === 'object' && first !== null && 'getSourceMIPSprogram' in first) {
      this.warning = ErrorMessage.ERROR;
      const program = first.getSourceMIPSprogram();
      this.filename = program === null ? '' : program.getFilename();
      this.position = 0;
      this.message = second as string;
      const definitions = this.parseMacroHistory(first.getSource());
      this.line = definitions.length === 0 ? first.getSourceLine() : definitions[0];
      this.macroExpansionHistory = definitions.length === 0 ? '' : String(first.getSourceLine());
      return;
    }
    const explicitSeverity = typeof first === 'boolean';
    const source = (explicitSeverity ? second : first) as string | DiagnosticProgram | null;
    const line = (explicitSeverity ? third : second) as number;
    this.warning = explicitSeverity ? first : ErrorMessage.ERROR;
    this.position = (explicitSeverity ? fourth : third) as number;
    this.message = (explicitSeverity ? fifth : fourth) as string;
    if (typeof source === 'string') {
      this.filename = source;
      this.line = line;
      this.macroExpansionHistory = (explicitSeverity ? sixth : fifth) ?? '';
    } else {
      const lines = source?.getSourceLineList();
      if (lines != null) {
        if (line < 1 || line > lines.length)
          throw new RangeError('Source line index out of bounds');
        this.filename = lines[line - 1].getFilename();
        this.line = lines[line - 1].getLineNumber();
      } else {
        this.filename = source === null ? '' : source.getFilename();
        this.line = line;
      }
      this.macroExpansionHistory = source?.getLocalMacroPool()?.getExpansionHistory() ?? '';
    }
  }

  /** Original filename of the diagnostic. */
  getFilename(): string | null {
    return this.filename;
  }
  /** One-based source line, or the supplied nonpositive unknown location. */
  getLine(): number {
    return this.line;
  }
  /** One-based source column, or zero when unavailable. */
  getPosition(): number {
    return this.position;
  }
  /** Diagnostic text without its location prefix. */
  getMessage(): string {
    return this.message;
  }
  /** True for a warning, false for an error. */
  isWarning(): boolean {
    return this.warning;
  }
  /** Expansion history with a trailing arrow, or empty when absent. */
  getMacroExpansionHistory(): string {
    return this.macroExpansionHistory ? `${this.macroExpansionHistory}->` : '';
  }

  private trimJava(source: string): string {
    let start = 0;
    let end = source.length;
    while (start < end && source.charCodeAt(start) <= 32) start++;
    while (end > start && source.charCodeAt(end - 1) <= 32) end--;
    return source.slice(start, end);
  }

  private parseMacroHistory(source: string): number[] {
    let verify = this.trimJava(source);
    const history: number[] = [];
    for (const match of source.matchAll(/<\d+>/g)) {
      if (!verify.startsWith(match[0])) break;
      const line = Number(match[0].slice(1, -1));
      if (line > 2147483647) break;
      history.push(line);
      verify = this.trimJava(verify.slice(match[0].length));
    }
    return history;
  }
}
