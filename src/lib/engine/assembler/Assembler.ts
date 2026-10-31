/* Copyright (c) 2003-2012, Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/assembler/Assembler.java; see MARSlicense.txt. */
import type { MIPSprogram } from './programs/MIPSprogram.js';
import { ErrorList } from '../diagnostics/ErrorList.js';
import { ErrorMessage } from '../diagnostics/ErrorMessage.js';
import { ProcessingException } from '../diagnostics/ProcessingException.js';
import { Binary, NumberFormatException } from '../formatting/Binary.js';
import { JavaFloatingPoint } from '../formatting/JavaFloatingPoint.js';
import { Memory } from '../hardware/memory/Memory.js';
import { AddressErrorException } from '../hardware/memory/AddressErrorException.js';
import { BasicInstruction } from '../instructions/BasicInstruction.js';
import {
  ExtendedInstruction,
  type ExtendedInstructionContext
} from '../instructions/ExtendedInstruction.js';
import { Instruction } from '../instructions/Instruction.js';
import { ProgramStatement, type ProgramStatementHost } from './programs/ProgramStatement.js';
import { Tokenizer } from './tokenization/Tokenizer.js';
import { Token } from './tokenization/Token.js';
import { TokenList } from './tokenization/TokenList.js';
import { TokenTypes, type TokenClassificationContext } from './tokenization/TokenTypes.js';
import { OperandFormat, type OperandFormatContext } from './OperandFormat.js';
import { Macro } from './macros/Macro.js';
import { MacroPool } from './macros/MacroPool.js';
import { Symbol } from './symbols/Symbol.js';
import { SymbolTable } from './symbols/SymbolTable.js';
import { DataTypes } from './directives/DataTypes.js';
import { Directives } from './directives/Directives.js';

/** Actual session hardware, symbol registry, settings, and platform file reset consumed by assembly. */
export type AssemblerHost = ProgramStatementHost &
  Omit<TokenClassificationContext, 'instructionSet'> &
  OperandFormatContext &
  ExtendedInstructionContext & {
    /** The actual session memory, also used for forward-reference backpatching. */
    memory: Memory<ProgramStatement>;
    /** Session-global symbol table shared by every file in one assembly. */
    symbolTable: SymbolTable;
    /** Real instruction lookup, preserving overload order. */
    instructionSet: {
      /** Match a mnemonic or return null. */
      matchOperator(name: string): readonly Instruction[] | null;
    };
    /** Reset platform file descriptors after code generation, as SystemIO.resetFiles does. */
    resetFiles(): void;
    /** Optional debug output sink; absent disables Java debug lines. */
    debug?: (message: string) => void;
  };

/** Complete canonical multi-file assembler; all mutable passes and address spaces are instance-owned. */
export class Assembler {
  private machineList: ProgramStatement[] = [];
  private errors: ErrorList | null = null;
  private inDataSegment = false;
  private inMacroSegment = false;
  private externAddress = 0;
  private autoAlign = false;
  private dataDirective!: Directives;
  private fileCurrentlyBeingAssembled!: MIPSprogram;
  private globalDeclarationList!: TokenList;
  private textAddress!: UserKernelAddressSpace;
  private dataAddress!: UserKernelAddressSpace;
  private currentFileDataSegmentForwardReferences!: DataSegmentForwardReferences;
  private accumulatedDataSegmentForwardReferences!: DataSegmentForwardReferences;
  private readonly floatingBits = new DataView(new ArrayBuffer(8));
  /** Bind assembler operations to one session without allocating global state. */
  constructor(private readonly host: AssemblerHost) {}
  /** Diagnostics from the latest assembly, or null before the first nonempty assembly. */
  getErrorList(): ErrorList | null {
    return this.errors;
  }
  /** Assemble already-tokenized source files using the original multi-file passes and memory writes. */
  assemble(
    programs: MIPSprogram | readonly MIPSprogram[] | null,
    extendedAssemblerEnabled: boolean,
    warningsAreErrors = false
  ): ProgramStatement[] | null {
    const tokenizedProgramFiles =
      programs === null ? null : Array.isArray(programs) ? programs : [programs as MIPSprogram];

    if (tokenizedProgramFiles == null || tokenizedProgramFiles.length == 0) return null;
    this.textAddress = new UserKernelAddressSpace(
      this.host.memory.textBaseAddress,
      this.host.memory.kernelTextBaseAddress
    );
    this.dataAddress = new UserKernelAddressSpace(
      this.host.memory.dataBaseAddress,
      this.host.memory.kernelDataBaseAddress
    );
    this.externAddress = this.host.memory.externBaseAddress;
    this.currentFileDataSegmentForwardReferences = new DataSegmentForwardReferences(
      this.host.memory
    );
    this.accumulatedDataSegmentForwardReferences = new DataSegmentForwardReferences(
      this.host.memory
    );
    this.host.symbolTable.clear();
    this.host.memory.clear();
    this.machineList = [];
    this.errors = new ErrorList();
    if (this.host.debug) this.host.debug!('Assembler first pass begins:');

    for (let fileIndex: number = 0; fileIndex < tokenizedProgramFiles.length; fileIndex++) {
      if (this.errors!.errorLimitExceeded()) break;
      this.fileCurrentlyBeingAssembled = tokenizedProgramFiles[fileIndex];

      this.globalDeclarationList = new TokenList();

      this.inDataSegment = false;

      this.inMacroSegment = false;

      this.autoAlign = true;

      this.dataDirective = Directives.WORD;

      this.fileCurrentlyBeingAssembled.getLocalSymbolTable()!.clear();
      this.currentFileDataSegmentForwardReferences.clear();

      const sourceLineList = this.fileCurrentlyBeingAssembled.getSourceLineList()!;
      const tokenList = this.fileCurrentlyBeingAssembled.getTokenList()!;
      const parsedList = this.fileCurrentlyBeingAssembled.createParsedList();

      this.fileCurrentlyBeingAssembled.createMacroPool();

      let statements: ProgramStatement[] | null;
      for (let i: number = 0; i < tokenList.length; i++) {
        if (this.errors!.errorLimitExceeded()) break;
        for (let z: number = 0; z < tokenList[i].size(); z++) {
          const t: Token = tokenList[i].get(z);

          t.setOriginal(sourceLineList[i].getMIPSprogram(), sourceLineList[i].getLineNumber());
        }
        statements = this.parseLine(
          tokenList[i],
          sourceLineList[i].getSource(),
          sourceLineList[i].getLineNumber(),
          extendedAssemblerEnabled
        );
        if (statements != null) {
          parsedList.push(...statements);
        }
      }
      if (this.inMacroSegment) {
        this.errors!.add(
          new ErrorMessage(
            this.fileCurrentlyBeingAssembled,
            this.fileCurrentlyBeingAssembled.getLocalMacroPool()!.getCurrent()!.getFromLine(),
            0,
            'Macro started but not ended (no .end_macro directive)'
          )
        );
      }

      this.transferGlobals();

      this.currentFileDataSegmentForwardReferences.resolve(
        this.fileCurrentlyBeingAssembled.getLocalSymbolTable()!
      );
      this.accumulatedDataSegmentForwardReferences.add(
        this.currentFileDataSegmentForwardReferences
      );
      this.currentFileDataSegmentForwardReferences.clear();
    }

    this.accumulatedDataSegmentForwardReferences.resolve(this.host.symbolTable);
    this.accumulatedDataSegmentForwardReferences.generateErrorMessages(this.errors!);

    if (this.errors!.errorsOccurred()) {
      throw new ProcessingException(this.errors!);
    }
    if (this.host.debug) this.host.debug!('Assembler second pass begins');

    for (let fileIndex: number = 0; fileIndex < tokenizedProgramFiles.length; fileIndex++) {
      if (this.errors!.errorLimitExceeded()) break;
      this.fileCurrentlyBeingAssembled = tokenizedProgramFiles[fileIndex];
      const parsedList = this.fileCurrentlyBeingAssembled.getParsedList()!;
      let statement: ProgramStatement;
      for (let i: number = 0; i < parsedList.length; i++) {
        statement = parsedList[i];
        statement.buildBasicStatementFromBasicInstruction(this.errors!);
        if (this.errors!.errorsOccurred()) {
          throw new ProcessingException(this.errors!);
        }
        if (statement.getInstruction() instanceof BasicInstruction) {
          this.machineList.push(statement);
        } else {
          const inst = statement.getInstruction() as ExtendedInstruction;
          const basicAssembly: string = statement.getBasicAssemblyStatement()!;
          const sourceLine: number = statement.getSourceLine();
          const theTokenList: TokenList = new Tokenizer(this.host).tokenizeLine(
            sourceLine,
            basicAssembly,
            this.errors!,
            false
          );

          let templateList: string[] | null;
          if (this.compactTranslationCanBeApplied(statement)) {
            templateList = inst.getCompactBasicIntructionTemplateList();
          } else {
            templateList = inst.getBasicIntructionTemplateList();
          }

          this.textAddress.set(statement.getAddress());

          for (let instrNumber: number = 0; instrNumber < templateList!.length; instrNumber++) {
            const instruction: string = ExtendedInstruction.makeTemplateSubstitutions(
              this.fileCurrentlyBeingAssembled,
              templateList![instrNumber],
              theTokenList,
              this.host
            );

            if (instruction == null || instruction == '') {
              continue;
            }

            if (this.host.debug) this.host.debug!('PSEUDO generated: ' + instruction);

            const newTokenList: TokenList = new Tokenizer(this.host).tokenizeLine(
              sourceLine,
              instruction,
              this.errors!,
              false
            );
            const instrMatches = this.matchInstruction(newTokenList.get(0));
            const instr: Instruction | null = OperandFormat.bestOperandMatch(
              newTokenList,
              instrMatches,
              this.host
            );

            const ps: ProgramStatement = new ProgramStatement(
              this.fileCurrentlyBeingAssembled,
              instrNumber == 0 ? statement.getSource() : '',
              newTokenList,
              newTokenList,
              instr,
              this.textAddress.get(),
              statement.getSourceLine(),
              this.host
            );
            this.textAddress.increment(Instruction.INSTRUCTION_LENGTH);
            ps.buildBasicStatementFromBasicInstruction(this.errors!);
            this.machineList.push(ps);
          }
        }
      }
    }
    if (this.host.debug) this.host.debug!('Code generation begins');

    let statement: ProgramStatement;
    for (let i: number = 0; i < this.machineList.length; i++) {
      if (this.errors!.errorLimitExceeded()) break;
      statement = this.machineList[i];
      statement.buildMachineStatementFromBasicStatement(this.errors!);
      if (this.host.debug) this.host.debug!(statement.toString());
      try {
        this.host.memory.setStatement(statement.getAddress(), statement);
      } catch (e) {
        if (!(e instanceof AddressErrorException)) throw e;
        const t: Token = statement.getOriginalTokenList()!.get(0);
        this.errors!.add(
          new ErrorMessage(
            t.getSourceMIPSprogram(),
            t.getSourceLine(),
            t.getStartPos(),
            'Invalid address for text segment: ' + e.getAddress()
          )
        );
      }
    }

    this.host.resetFiles();

    const comparator = new ProgramStatementComparator();
    this.machineList.sort((first, second) => comparator.compare(first, second));
    this.catchDuplicateAddresses(this.machineList, this.errors!);
    if (this.errors!.errorsOccurred() || (this.errors!.warningsOccurred() && warningsAreErrors)) {
      throw new ProcessingException(this.errors!);
    }
    return this.machineList;
  }

  private catchDuplicateAddresses(instructions: ProgramStatement[], errors: ErrorList): void {
    for (let i: number = 0; i < instructions.length - 1; i++) {
      const ps1: ProgramStatement = instructions[i];
      const ps2: ProgramStatement = instructions[i + 1];
      if (ps1.getAddress() == ps2.getAddress()) {
        errors.add(
          new ErrorMessage(
            ps2.getSourceMIPSprogram(),
            ps2.getSourceLine(),
            0,
            'Duplicate text segment address: ' +
              Binary.formatUnsignedInteger(
                ps2.getAddress(),
                this.host.getDisplayAddressesInHex() ? 16 : 10
              ) +
              ' already occupied by ' +
              ps1.getSourceFile() +
              ' line ' +
              ps1.getSourceLine() +
              ' (caused by use of ' +
              (this.host.memory.inTextSegment(ps2.getAddress()) ? '.text' : '.ktext') +
              ' operand)'
          )
        );
      }
    }
  }

  private parseLine(
    tokenList: TokenList,
    source: string,
    sourceLineNumber: number,
    extendedAssemblerEnabled: boolean
  ): ProgramStatement[] | null {
    const ret: ProgramStatement[] = [];

    let programStatement: ProgramStatement;
    let tokens: TokenList = this.stripComment(tokenList);

    const macroPool: MacroPool = this.fileCurrentlyBeingAssembled.getLocalMacroPool()!;
    if (this.inMacroSegment) {
      this.detectLabels(tokens, macroPool.getCurrent()!);
    } else {
      this.stripLabels(tokens);
    }
    if (tokens.isEmpty()) return null;

    const token: Token = tokens.get(0);
    const tokenType: TokenTypes = token.getType();

    if (tokenType == TokenTypes.DIRECTIVE) {
      this.executeDirective(tokens);
      return null;
    }

    if (this.inMacroSegment) return null;

    let parenFreeTokens: TokenList = tokens;
    if (
      tokens.size() > 2 &&
      tokens.get(1).getType() == TokenTypes.LEFT_PAREN &&
      tokens.get(tokens.size() - 1).getType() == TokenTypes.RIGHT_PAREN
    ) {
      parenFreeTokens = tokens.clone();
      parenFreeTokens.remove(tokens.size() - 1);
      parenFreeTokens.remove(1);
    }
    const macro: Macro | null = macroPool.getMatchingMacro(parenFreeTokens, sourceLineNumber);

    if (macro != null) {
      tokens = parenFreeTokens;

      const counter: number = macroPool.getNextCounter();
      if (macroPool.pushOnCallStack(token)) {
        this.errors!.add(
          new ErrorMessage(
            this.fileCurrentlyBeingAssembled,
            tokens.get(0).getSourceLine(),
            0,
            'Detected a macro expansion loop (recursive reference). '
          )
        );
      } else {
        for (let i: number = macro.getFromLine() + 1; i < macro.getToLine(); i++) {
          let substituted: string = macro.getSubstitutedLine(
            i,
            tokens,
            BigInt(counter),
            this.errors!
          )!;
          const tokenList2: TokenList = this.fileCurrentlyBeingAssembled
            .getTokenizer()!
            .tokenizeLine(i, substituted, this.errors!);

          if (tokenList2.getProcessedLine().length > 0) substituted = tokenList2.getProcessedLine();

          const statements: ProgramStatement[] | null = this.parseLine(
            tokenList2,
            '<' +
              (i - macro.getFromLine() + macro.getOriginalFromLine()) +
              '> ' +
              // Java String.trim removes every code unit through U+0020.
              // eslint-disable-next-line no-control-regex
              substituted.replace(/^[\x00-\x20]+|[\x00-\x20]+$/g, ''),
            sourceLineNumber,
            extendedAssemblerEnabled
          );
          if (statements != null) ret.push(...statements);
        }
        macroPool.popFromCallStack();
      }
      return ret;
    }

    if (tokenType == TokenTypes.IDENTIFIER && token.getValue().charAt(0) == '.') {
      this.errors!.add(
        new ErrorMessage(
          ErrorMessage.WARNING,
          token.getSourceMIPSprogram(),
          token.getSourceLine(),
          token.getStartPos(),
          'MARS does not recognize the ' + token.getValue() + ' directive.  Ignored.'
        )
      );
      return null;
    }

    if (
      this.inDataSegment &&
      (tokenType == TokenTypes.PLUS ||
        tokenType == TokenTypes.MINUS ||
        tokenType == TokenTypes.QUOTED_STRING ||
        tokenType == TokenTypes.IDENTIFIER ||
        TokenTypes.isIntegerTokenType(tokenType) ||
        TokenTypes.isFloatingTokenType(tokenType))
    ) {
      this.executeDirectiveContinuation(tokens);
      return null;
    }

    if (!this.inDataSegment) {
      const instrMatches = this.matchInstruction(token);
      if (instrMatches == null) return ret;

      const inst: Instruction | null = OperandFormat.bestOperandMatch(
        tokens,
        instrMatches,
        this.host
      );

      if (inst instanceof ExtendedInstruction && !extendedAssemblerEnabled) {
        this.errors!.add(
          new ErrorMessage(
            token.getSourceMIPSprogram(),
            token.getSourceLine(),
            token.getStartPos(),
            'Extended (pseudo) instruction or format not permitted.  See Settings.'
          )
        );
      }
      if (OperandFormat.tokenOperandMatch(tokens, inst!, this.errors!, this.host)) {
        programStatement = new ProgramStatement(
          this.fileCurrentlyBeingAssembled,
          source,
          tokenList,
          tokens,
          inst,
          this.textAddress.get(),
          sourceLineNumber,
          this.host
        );

        let instLength: number = inst!.getInstructionLength();
        if (this.compactTranslationCanBeApplied(programStatement)) {
          instLength = (inst as ExtendedInstruction).getCompactInstructionLength();
        }
        this.textAddress.increment(instLength);
        ret.push(programStatement);
        return ret;
      }
    }
    return null;
  }

  private detectLabels(tokens: TokenList, current: Macro): void {
    if (this.tokenListBeginsWithLabel(tokens)) current.addLabel(tokens.get(0).getValue());
  }

  private compactTranslationCanBeApplied(statement: ProgramStatement): boolean {
    return (
      statement.getInstruction() instanceof ExtendedInstruction &&
      this.host.memory.usingCompactMemoryConfiguration() &&
      (statement.getInstruction() as ExtendedInstruction).hasCompactTranslation()
    );
  }

  private stripComment(tokenList: TokenList): TokenList {
    if (tokenList.isEmpty()) return tokenList;
    const tokens: TokenList = tokenList.clone();

    const last: number = tokens.size() - 1;
    if (tokens.get(last).getType() == TokenTypes.COMMENT) {
      tokens.remove(last);
    }
    return tokens;
  }

  private stripLabels(tokens: TokenList): void {
    const thereWasLabel: boolean = this.parseAndRecordLabel(tokens);
    if (thereWasLabel) {
      tokens.remove(0);
      tokens.remove(0);
    }
  }

  private parseAndRecordLabel(tokens: TokenList): boolean {
    if (tokens.size() < 2) {
      return false;
    } else {
      const token: Token = tokens.get(0);
      if (this.tokenListBeginsWithLabel(tokens)) {
        if (token.getType() == TokenTypes.OPERATOR) {
          token.setType(TokenTypes.IDENTIFIER);
        }
        this.fileCurrentlyBeingAssembled
          .getLocalSymbolTable()!
          .addSymbol(
            token,
            this.inDataSegment ? this.dataAddress.get() : this.textAddress.get(),
            this.inDataSegment,
            this.errors!
          );
        return true;
      } else {
        return false;
      }
    }
  }

  private tokenListBeginsWithLabel(tokens: TokenList): boolean {
    if (tokens.size() < 2) return false;
    return (
      (tokens.get(0).getType() == TokenTypes.IDENTIFIER ||
        tokens.get(0).getType() == TokenTypes.OPERATOR) &&
      tokens.get(1).getType() == TokenTypes.COLON
    );
  }

  private executeDirective(tokens: TokenList): void {
    const token: Token = tokens.get(0);
    const direct: Directives | null = Directives.matchDirective(token.getValue());
    if (this.host.debug)
      this.host.debug!('line ' + token.getSourceLine() + ' is directive ' + direct);
    if (direct == null) {
      this.errors!.add(
        new ErrorMessage(
          token.getSourceMIPSprogram(),
          token.getSourceLine(),
          token.getStartPos(),
          '"' + token.getValue() + '" directive is invalid or not implemented in MARS'
        )
      );
      return;
    } else if (direct == Directives.EQV) {
      // EQV was already validated and expanded by the canonical tokenizer.
    } else if (direct == Directives.MACRO) {
      if (tokens.size() < 2) {
        this.errors!.add(
          new ErrorMessage(
            token.getSourceMIPSprogram(),
            token.getSourceLine(),
            token.getStartPos(),
            '"' + token.getValue() + '" directive requires at least one argument.'
          )
        );
        return;
      }
      if (tokens.get(1).getType() != TokenTypes.IDENTIFIER) {
        this.errors!.add(
          new ErrorMessage(
            token.getSourceMIPSprogram(),
            token.getSourceLine(),
            tokens.get(1).getStartPos(),
            'Invalid Macro name "' + tokens.get(1).getValue() + '"'
          )
        );
        return;
      }
      if (this.inMacroSegment) {
        this.errors!.add(
          new ErrorMessage(
            token.getSourceMIPSprogram(),
            token.getSourceLine(),
            token.getStartPos(),
            'Nested macros are not allowed'
          )
        );
        return;
      }
      this.inMacroSegment = true;
      const pool: MacroPool = this.fileCurrentlyBeingAssembled.getLocalMacroPool()!;
      pool.beginMacro(tokens.get(1));
      for (let i: number = 2; i < tokens.size(); i++) {
        const arg: Token = tokens.get(i);
        if (arg.getType() == TokenTypes.RIGHT_PAREN || arg.getType() == TokenTypes.LEFT_PAREN)
          continue;
        if (!Macro.tokenIsMacroParameter(arg.getValue(), true, this.host)) {
          this.errors!.add(
            new ErrorMessage(
              arg.getSourceMIPSprogram(),
              arg.getSourceLine(),
              arg.getStartPos(),
              "Invalid macro argument '" + arg.getValue() + "'"
            )
          );
          return;
        }
        pool.getCurrent()!.addArg(arg.getValue());
      }
    } else if (direct == Directives.END_MACRO) {
      if (tokens.size() > 1) {
        this.errors!.add(
          new ErrorMessage(
            token.getSourceMIPSprogram(),
            token.getSourceLine(),
            token.getStartPos(),
            'invalid text after .END_MACRO'
          )
        );
        return;
      }
      if (!this.inMacroSegment) {
        this.errors!.add(
          new ErrorMessage(
            token.getSourceMIPSprogram(),
            token.getSourceLine(),
            token.getStartPos(),
            '.END_MACRO without .MACRO'
          )
        );
        return;
      }
      this.inMacroSegment = false;
      this.fileCurrentlyBeingAssembled.getLocalMacroPool()!.commitMacro(token);
    } else if (this.inMacroSegment) {
      return;
    } else if (direct == Directives.DATA || direct == Directives.KDATA) {
      this.inDataSegment = true;
      this.autoAlign = true;
      this.dataAddress.setAddressSpace(
        direct == Directives.DATA ? this.dataAddress.USER : this.dataAddress.KERNEL
      );
      if (tokens.size() > 1 && TokenTypes.isIntegerTokenType(tokens.get(1).getType())) {
        this.dataAddress.set(Binary.stringToInt(tokens.get(1).getValue()));
      }
    } else if (direct == Directives.TEXT || direct == Directives.KTEXT) {
      this.inDataSegment = false;
      this.textAddress.setAddressSpace(
        direct == Directives.TEXT ? this.textAddress.USER : this.textAddress.KERNEL
      );
      if (tokens.size() > 1 && TokenTypes.isIntegerTokenType(tokens.get(1).getType())) {
        this.textAddress.set(Binary.stringToInt(tokens.get(1).getValue()));
      }
    } else if (
      direct == Directives.WORD ||
      direct == Directives.HALF ||
      direct == Directives.BYTE ||
      direct == Directives.FLOAT ||
      direct == Directives.DOUBLE
    ) {
      this.dataDirective = direct;
      if (this.passesDataSegmentCheck(token) && tokens.size() > 1) {
        this.storeNumeric(tokens, direct, this.errors!);
      }
    } else if (direct == Directives.ASCII || direct == Directives.ASCIIZ) {
      this.dataDirective = direct;
      if (this.passesDataSegmentCheck(token)) {
        this.storeStrings(tokens, direct, this.errors!);
      }
    } else if (direct == Directives.ALIGN) {
      if (this.passesDataSegmentCheck(token)) {
        if (tokens.size() != 2) {
          this.errors!.add(
            new ErrorMessage(
              token.getSourceMIPSprogram(),
              token.getSourceLine(),
              token.getStartPos(),
              '"' + token.getValue() + '" requires one operand'
            )
          );
          return;
        }
        if (
          !TokenTypes.isIntegerTokenType(tokens.get(1).getType()) ||
          Binary.stringToInt(tokens.get(1).getValue()) < 0
        ) {
          this.errors!.add(
            new ErrorMessage(
              token.getSourceMIPSprogram(),
              token.getSourceLine(),
              token.getStartPos(),
              '"' + token.getValue() + '" requires a non-negative integer'
            )
          );
          return;
        }
        const value: number = Binary.stringToInt(tokens.get(1).getValue());
        if (value == 0) {
          this.autoAlign = false;
        } else {
          this.dataAddress.set(
            this.alignToBoundary(
              this.dataAddress.get(),
              JavaFloatingPoint.doubleToInt(Math.pow(2, value))
            )
          );
        }
      }
    } else if (direct == Directives.SPACE) {
      if (this.passesDataSegmentCheck(token)) {
        if (tokens.size() != 2) {
          this.errors!.add(
            new ErrorMessage(
              token.getSourceMIPSprogram(),
              token.getSourceLine(),
              token.getStartPos(),
              '"' + token.getValue() + '" requires one operand'
            )
          );
          return;
        }
        if (
          !TokenTypes.isIntegerTokenType(tokens.get(1).getType()) ||
          Binary.stringToInt(tokens.get(1).getValue()) < 0
        ) {
          this.errors!.add(
            new ErrorMessage(
              token.getSourceMIPSprogram(),
              token.getSourceLine(),
              token.getStartPos(),
              '"' + token.getValue() + '" requires a non-negative integer'
            )
          );
          return;
        }
        const value: number = Binary.stringToInt(tokens.get(1).getValue());
        this.dataAddress.increment(value);
      }
    } else if (direct == Directives.EXTERN) {
      if (tokens.size() != 3) {
        this.errors!.add(
          new ErrorMessage(
            token.getSourceMIPSprogram(),
            token.getSourceLine(),
            token.getStartPos(),
            '"' + token.getValue() + '" directive requires two operands (label and size).'
          )
        );
        return;
      }
      if (
        !TokenTypes.isIntegerTokenType(tokens.get(2).getType()) ||
        Binary.stringToInt(tokens.get(2).getValue()) < 0
      ) {
        this.errors!.add(
          new ErrorMessage(
            token.getSourceMIPSprogram(),
            token.getSourceLine(),
            token.getStartPos(),
            '"' + token.getValue() + '" requires a non-negative integer size'
          )
        );
        return;
      }
      const size: number = Binary.stringToInt(tokens.get(2).getValue());

      if (this.host.symbolTable.getAddress(tokens.get(1).getValue()) == SymbolTable.NOT_FOUND) {
        this.host.symbolTable.addSymbol(
          tokens.get(1),
          this.externAddress,
          Symbol.DATA_SYMBOL,
          this.errors!
        );
        this.externAddress = (this.externAddress + size) | 0;
      }
    } else if (direct == Directives.SET) {
      this.errors!.add(
        new ErrorMessage(
          ErrorMessage.WARNING,
          token.getSourceMIPSprogram(),
          token.getSourceLine(),
          token.getStartPos(),
          'MARS currently ignores the .set directive.'
        )
      );
    } else if (direct == Directives.GLOBL) {
      if (tokens.size() < 2) {
        this.errors!.add(
          new ErrorMessage(
            token.getSourceMIPSprogram(),
            token.getSourceLine(),
            token.getStartPos(),
            '"' + token.getValue() + '" directive requires at least one argument.'
          )
        );
        return;
      }

      for (let i: number = 1; i < tokens.size(); i++) {
        const label: Token = tokens.get(i);
        if (label.getType() != TokenTypes.IDENTIFIER) {
          this.errors!.add(
            new ErrorMessage(
              token.getSourceMIPSprogram(),
              token.getSourceLine(),
              token.getStartPos(),
              '"' + token.getValue() + '" directive argument must be label.'
            )
          );
          return;
        }
        this.globalDeclarationList.add(label);
      }
    } else {
      this.errors!.add(
        new ErrorMessage(
          token.getSourceMIPSprogram(),
          token.getSourceLine(),
          token.getStartPos(),
          '"' + token.getValue() + '" directive recognized but not yet implemented.'
        )
      );
      return;
    }
  }

  private transferGlobals(): void {
    for (let i: number = 0; i < this.globalDeclarationList.size(); i++) {
      const label: Token = this.globalDeclarationList.get(i);
      const symtabEntry: Symbol | null = this.fileCurrentlyBeingAssembled
        .getLocalSymbolTable()!
        .getSymbol(label.getValue());
      if (symtabEntry == null) {
        this.errors!.add(
          new ErrorMessage(
            this.fileCurrentlyBeingAssembled,
            label.getSourceLine(),
            label.getStartPos(),
            '"' + label.getValue() + '" declared global label but not defined.'
          )
        );
      } else {
        if (this.host.symbolTable.getAddress(label.getValue()) != SymbolTable.NOT_FOUND) {
          this.errors!.add(
            new ErrorMessage(
              this.fileCurrentlyBeingAssembled,
              label.getSourceLine(),
              label.getStartPos(),
              '"' + label.getValue() + '" already defined as global in a different file.'
            )
          );
        } else {
          this.fileCurrentlyBeingAssembled.getLocalSymbolTable()!.removeSymbol(label);
          this.host.symbolTable.addSymbol(
            label,
            symtabEntry.getAddress(),
            symtabEntry.getType(),
            this.errors!
          );
        }
      }
    }
  }

  private executeDirectiveContinuation(tokens: TokenList): void {
    const direct: Directives | null = this.dataDirective;
    if (
      direct == Directives.WORD ||
      direct == Directives.HALF ||
      direct == Directives.BYTE ||
      direct == Directives.FLOAT ||
      direct == Directives.DOUBLE
    ) {
      if (tokens.size() > 0) {
        this.storeNumeric(tokens, direct, this.errors!);
      }
    } else if (direct == Directives.ASCII || direct == Directives.ASCIIZ) {
      if (this.passesDataSegmentCheck(tokens.get(0))) {
        this.storeStrings(tokens, direct, this.errors!);
      }
    }
  }

  private matchInstruction(token: Token): readonly Instruction[] | null {
    if (token.getType() != TokenTypes.OPERATOR) {
      if (
        (token.getSourceMIPSprogram() as MIPSprogram)
          .getLocalMacroPool()!
          .matchesAnyMacroName(token.getValue())
      )
        this.errors!.add(
          new ErrorMessage(
            token.getSourceMIPSprogram(),
            token.getSourceLine(),
            token.getStartPos(),
            'forward reference or invalid parameters for macro "' + token.getValue() + '"'
          )
        );
      else
        this.errors!.add(
          new ErrorMessage(
            token.getSourceMIPSprogram(),
            token.getSourceLine(),
            token.getStartPos(),
            '"' + token.getValue() + '" is not a recognized operator'
          )
        );
      return null;
    }
    const inst = this.host.instructionSet.matchOperator(token.getValue());
    if (inst == null) {
      this.errors!.add(
        new ErrorMessage(
          token.getSourceMIPSprogram(),
          token.getSourceLine(),
          token.getStartPos(),
          'Internal Assembler error: "' +
            token.getValue() +
            '" tokenized OPERATOR then not recognized'
        )
      );
    }
    return inst;
  }

  private storeNumeric(tokens: TokenList, directive: Directives, errors: ErrorList): void {
    let token: Token = tokens.get(0);

    if (!this.passesDataSegmentCheck(token)) return;

    let tokenStart: number = 0;
    if (token.getType() == TokenTypes.DIRECTIVE) tokenStart = 1;

    const lengthInBytes: number = DataTypes.getLengthInBytes(directive);

    if (tokens.size() == 4 && tokens.get(2).getType() == TokenTypes.COLON) {
      const valueToken: Token = tokens.get(1);
      const repetitionsToken: Token = tokens.get(3);

      if (
        !(
          (Directives.isIntegerDirective(directive) &&
            TokenTypes.isIntegerTokenType(valueToken.getType())) ||
          (Directives.isFloatingDirective(directive) &&
            (TokenTypes.isIntegerTokenType(valueToken.getType()) ||
              TokenTypes.isFloatingTokenType(valueToken.getType())))
        ) ||
        !TokenTypes.isIntegerTokenType(repetitionsToken.getType())
      ) {
        errors.add(
          new ErrorMessage(
            this.fileCurrentlyBeingAssembled,
            valueToken.getSourceLine(),
            valueToken.getStartPos(),
            'malformed expression'
          )
        );
        return;
      }
      const repetitions: number = Binary.stringToInt(repetitionsToken.getValue());
      if (repetitions <= 0) {
        errors.add(
          new ErrorMessage(
            this.fileCurrentlyBeingAssembled,
            repetitionsToken.getSourceLine(),
            repetitionsToken.getStartPos(),
            'repetition factor must be positive'
          )
        );
        return;
      }
      if (this.inDataSegment) {
        if (this.autoAlign) {
          this.dataAddress.set(this.alignToBoundary(this.dataAddress.get(), lengthInBytes));
        }
        for (let i: number = 0; i < repetitions; i++) {
          if (Directives.isIntegerDirective(directive)) {
            this.storeInteger(valueToken, directive, errors);
          } else {
            this.storeRealNumber(valueToken, directive, errors);
          }
        }
      }

      return;
    }

    for (let i: number = tokenStart; i < tokens.size(); i++) {
      token = tokens.get(i);
      if (Directives.isIntegerDirective(directive)) {
        this.storeInteger(token, directive, errors);
      }
      if (Directives.isFloatingDirective(directive)) {
        this.storeRealNumber(token, directive, errors);
      }
    }
    return;
  }

  private storeInteger(token: Token, directive: Directives, errors: ErrorList): void {
    const lengthInBytes: number = DataTypes.getLengthInBytes(directive);
    if (TokenTypes.isIntegerTokenType(token.getType())) {
      let value: number = Binary.stringToInt(token.getValue());
      const fullvalue: number = value;

      if (directive == Directives.BYTE) {
        value = value & 0x000000ff;
      } else if (directive == Directives.HALF) {
        value = value & 0x0000ffff;
      }

      if (DataTypes.outOfRange(directive, fullvalue)) {
        errors.add(
          new ErrorMessage(
            ErrorMessage.WARNING,
            token.getSourceMIPSprogram(),
            token.getSourceLine(),
            token.getStartPos(),
            '"' + token.getValue() + '" is out-of-range for a signed value and possibly truncated'
          )
        );
      }
      if (this.inDataSegment) {
        this.writeToDataSegment(value, lengthInBytes, token, errors);
      } else {
        try {
          this.host.memory.set(this.textAddress.get(), value, lengthInBytes);
        } catch (e) {
          if (!(e instanceof AddressErrorException)) throw e;
          errors.add(
            new ErrorMessage(
              token.getSourceMIPSprogram(),
              token.getSourceLine(),
              token.getStartPos(),
              '"' + this.textAddress.get() + '" is not a valid text segment address'
            )
          );
          return;
        }
        this.textAddress.increment(lengthInBytes);
      }
    } else if (token.getType() == TokenTypes.IDENTIFIER) {
      if (this.inDataSegment) {
        const value: number = this.fileCurrentlyBeingAssembled
          .getLocalSymbolTable()!
          .getAddressLocalOrGlobal(token.getValue());
        if (value == SymbolTable.NOT_FOUND) {
          const patchAddress: number = this.writeToDataSegment(0, lengthInBytes, token, errors);
          this.currentFileDataSegmentForwardReferences.add(patchAddress, lengthInBytes, token);
        } else {
          this.writeToDataSegment(value, lengthInBytes, token, errors);
        }
      } else {
        errors.add(
          new ErrorMessage(
            token.getSourceMIPSprogram(),
            token.getSourceLine(),
            token.getStartPos(),
            '"' + token.getValue() + '" label as directive operand not permitted in text segment'
          )
        );
      }
    } else {
      errors.add(
        new ErrorMessage(
          token.getSourceMIPSprogram(),
          token.getSourceLine(),
          token.getStartPos(),
          '"' + token.getValue() + '" is not a valid integer constant or label'
        )
      );
    }
  }

  private storeRealNumber(token: Token, directive: Directives, errors: ErrorList): void {
    const lengthInBytes: number = DataTypes.getLengthInBytes(directive);
    let value: number;

    if (
      TokenTypes.isIntegerTokenType(token.getType()) ||
      TokenTypes.isFloatingTokenType(token.getType())
    ) {
      try {
        value = JavaFloatingPoint.parseDouble(token.getValue());
      } catch (nfe) {
        if (!(nfe instanceof NumberFormatException)) throw nfe;
        errors.add(
          new ErrorMessage(
            token.getSourceMIPSprogram(),
            token.getSourceLine(),
            token.getStartPos(),
            '"' + token.getValue() + '" is not a valid floating point constant'
          )
        );
        return;
      }
      if (DataTypes.outOfRange(directive, value, true)) {
        errors.add(
          new ErrorMessage(
            token.getSourceMIPSprogram(),
            token.getSourceLine(),
            token.getStartPos(),
            '"' + token.getValue() + '" is an out-of-range value'
          )
        );
        return;
      }
    } else {
      errors.add(
        new ErrorMessage(
          token.getSourceMIPSprogram(),
          token.getSourceLine(),
          token.getStartPos(),
          '"' + token.getValue() + '" is not a valid floating point constant'
        )
      );
      return;
    }

    if (directive == Directives.FLOAT) {
      this.writeToDataSegment(
        JavaFloatingPoint.floatToIntBits(value, this.floatingBits),
        lengthInBytes,
        token,
        errors
      );
    }
    if (directive == Directives.DOUBLE) {
      this.writeDoubleToDataSegment(value, token, errors);
    }
  }

  private storeStrings(tokens: TokenList, direct: Directives, errors: ErrorList): void {
    let token: Token;

    let tokenStart: number = 0;
    if (tokens.get(0).getType() == TokenTypes.DIRECTIVE) {
      tokenStart = 1;
    }
    for (let i: number = tokenStart; i < tokens.size(); i++) {
      token = tokens.get(i);
      if (token.getType() != TokenTypes.QUOTED_STRING) {
        errors.add(
          new ErrorMessage(
            token.getSourceMIPSprogram(),
            token.getSourceLine(),
            token.getStartPos(),
            '"' + token.getValue() + '" is not a valid character string'
          )
        );
      } else {
        const quote: string = token.getValue();
        let theChar: string;
        for (let j: number = 1; j < quote.length - 1; j++) {
          theChar = quote.charAt(j);
          if (theChar == '\\') {
            theChar = quote.charAt(++j);
            switch (theChar) {
              case 'n':
                theChar = '\n';
                break;
              case 't':
                theChar = '\t';
                break;
              case 'r':
                theChar = '\r';
                break;
              case '\\':
                theChar = '\\';
                break;
              case "'":
                theChar = "'";
                break;
              case '"':
                theChar = '"';
                break;
              case 'b':
                theChar = '\b';
                break;
              case 'f':
                theChar = '\f';
                break;
              case '0':
                theChar = '\0';
                break;
            }
          }
          try {
            this.host.memory.set(
              this.dataAddress.get(),
              theChar.charCodeAt(0),
              DataTypes.CHAR_SIZE
            );
          } catch (e) {
            if (!(e instanceof AddressErrorException)) throw e;
            errors.add(
              new ErrorMessage(
                token.getSourceMIPSprogram(),
                token.getSourceLine(),
                token.getStartPos(),
                '"' + this.dataAddress.get() + '" is not a valid data segment address'
              )
            );
          }
          this.dataAddress.increment(DataTypes.CHAR_SIZE);
        }
        if (direct == Directives.ASCIIZ) {
          try {
            this.host.memory.set(this.dataAddress.get(), 0, DataTypes.CHAR_SIZE);
          } catch (e) {
            if (!(e instanceof AddressErrorException)) throw e;
            errors.add(
              new ErrorMessage(
                token.getSourceMIPSprogram(),
                token.getSourceLine(),
                token.getStartPos(),
                '"' + this.dataAddress.get() + '" is not a valid data segment address'
              )
            );
          }
          this.dataAddress.increment(DataTypes.CHAR_SIZE);
        }
      }
    }
  }

  private passesDataSegmentCheck(token: Token): boolean {
    if (!this.inDataSegment) {
      this.errors!.add(
        new ErrorMessage(
          token.getSourceMIPSprogram(),
          token.getSourceLine(),
          token.getStartPos(),
          '"' + token.getValue() + '" directive cannot appear in text segment'
        )
      );
      return false;
    } else {
      return true;
    }
  }

  private writeToDataSegment(
    value: number,
    lengthInBytes: number,
    token: Token,
    errors: ErrorList
  ): number {
    if (this.autoAlign) {
      this.dataAddress.set(this.alignToBoundary(this.dataAddress.get(), lengthInBytes));
    }
    try {
      this.host.memory.set(this.dataAddress.get(), value, lengthInBytes);
    } catch (e) {
      if (!(e instanceof AddressErrorException)) throw e;
      errors.add(
        new ErrorMessage(
          token.getSourceMIPSprogram(),
          token.getSourceLine(),
          token.getStartPos(),
          '"' + this.dataAddress.get() + '" is not a valid data segment address'
        )
      );
      return this.dataAddress.get();
    }
    const address: number = this.dataAddress.get();
    this.dataAddress.increment(lengthInBytes);
    return address;
  }

  private writeDoubleToDataSegment(value: number, token: Token, errors: ErrorList): void {
    const lengthInBytes: number = DataTypes.DOUBLE_SIZE;
    if (this.autoAlign) {
      this.dataAddress.set(this.alignToBoundary(this.dataAddress.get(), lengthInBytes));
    }
    try {
      this.host.memory.setDouble(this.dataAddress.get(), value);
    } catch (e) {
      if (!(e instanceof AddressErrorException)) throw e;
      errors.add(
        new ErrorMessage(
          token.getSourceMIPSprogram(),
          token.getSourceLine(),
          token.getStartPos(),
          '"' + this.dataAddress.get() + '" is not a valid data segment address'
        )
      );
      return;
    }
    this.dataAddress.increment(lengthInBytes);
  }

  private alignToBoundary(address: number, byteBoundary: number): number {
    const remainder: number = address % byteBoundary;
    if (remainder == 0) {
      return address;
    } else {
      const alignedAddress: number = (address + byteBoundary - remainder) | 0;
      this.fileCurrentlyBeingAssembled
        .getLocalSymbolTable()!
        .fixSymbolTableAddress(address, alignedAddress);
      return alignedAddress;
    }
  }
}

// Java's private address-space helper remains owned by the assembler implementation.
class UserKernelAddressSpace {
  readonly USER = 0;
  readonly KERNEL = 1;
  private readonly address: number[];
  private currentAddressSpace = 0;
  constructor(userBase: number, kernelBase: number) {
    this.address = [userBase, kernelBase];
  }
  get(): number {
    return this.address[this.currentAddressSpace];
  }
  set(value: number): void {
    this.address[this.currentAddressSpace] = value | 0;
  }
  increment(value: number): void {
    this.address[this.currentAddressSpace] = (this.get() + value) | 0;
  }
  setAddressSpace(space: number): void {
    if (space !== this.USER && space !== this.KERNEL)
      throw new RangeError('IllegalArgumentException');
    this.currentAddressSpace = space;
  }
}
class DataSegmentForwardReferences {
  private readonly forwardReferenceList: DataSegmentForwardReference[] = [];
  constructor(private readonly memory: Memory<ProgramStatement>) {}
  add(another: DataSegmentForwardReferences): void;
  add(patchAddress: number, length: number, token: Token): void;
  add(first: number | DataSegmentForwardReferences, length?: number, token?: Token): void {
    if (typeof first === 'number')
      this.forwardReferenceList.push(new DataSegmentForwardReference(first, length!, token!));
    else this.forwardReferenceList.push(...first.forwardReferenceList);
  }
  size(): number {
    return this.forwardReferenceList.length;
  }
  clear(): void {
    this.forwardReferenceList.length = 0;
  }
  resolve(local: SymbolTable): number {
    let count = 0;
    for (let i = 0; i < this.forwardReferenceList.length; i++) {
      const entry = this.forwardReferenceList[i],
        address = local.getAddressLocalOrGlobal(entry.token.getValue());
      if (address !== SymbolTable.NOT_FOUND) {
        try {
          this.memory.set(entry.patchAddress, address, entry.length);
        } catch (error) {
          if (!(error instanceof AddressErrorException)) throw error;
        }
        this.forwardReferenceList.splice(i, 1);
        i--;
        count++;
      }
    }
    return count;
  }
  generateErrorMessages(errors: ErrorList): void {
    for (const entry of this.forwardReferenceList)
      errors.add(
        new ErrorMessage(
          entry.token.getSourceMIPSprogram(),
          entry.token.getSourceLine(),
          entry.token.getStartPos(),
          'Symbol "' + entry.token.getValue() + '" not found in symbol table.'
        )
      );
  }
}

class DataSegmentForwardReference {
  constructor(
    readonly patchAddress: number,
    readonly length: number,
    readonly token: Token
  ) {}
}
class ProgramStatementComparator {
  compare(first: ProgramStatement, second: ProgramStatement): number {
    const addr1 = first.getAddress(),
      addr2 = second.getAddress();
    return (addr1 < 0 && addr2 >= 0) || (addr1 >= 0 && addr2 < 0) ? addr2 : (addr1 - addr2) | 0;
  }
  equals(other: unknown): boolean {
    return this === other;
  }
}
