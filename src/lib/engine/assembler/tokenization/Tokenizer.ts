/*
Copyright (c) 2003-2013,  Pete Sanderson and Kenneth Vollmar

Developed by Pete Sanderson (psanderson@otterbein.edu)
and Kenneth Vollmar (kenvollmar@missouristate.edu)

Permission is hereby granted, free of charge, to any person obtaining 
a copy of this software and associated documentation files (the 
"Software"), to deal in the Software without restriction, including 
without limitation the rights to use, copy, modify, merge, publish, 
distribute, sublicense, and/or sell copies of the Software, and to 
permit persons to whom the Software is furnished to do so, subject 
to the following conditions:

The above copyright notice and this permission notice shall be 
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, 
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF 
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. 
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR 
ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF 
CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION 
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

(MIT license, http://www.opensource.org/licenses/mit-license.html)
 */
// Ports mars/assembler/Tokenizer.java.

import { ErrorList } from '../../diagnostics/ErrorList.js';
import { ErrorMessage, type DiagnosticProgram } from '../../diagnostics/ErrorMessage.js';
import { ProcessingException } from '../../diagnostics/ProcessingException.js';
import { Directives } from '../directives/Directives.js';
import { JavaCharacter } from '../../formatting/JavaCharacter.js';
import { SourceLine } from './SourceLine.js';
import { Token } from './Token.js';
import { TokenList } from './TokenList.js';
import { TokenTypes, type TokenClassificationContext } from './TokenTypes.js';

/** MIPSprogram operations consumed by the tokenizer; the caller owns source and source maps. */
export interface TokenizerProgram extends DiagnosticProgram {
  /** Return current plain source strings in file order. */
  getSourceList(): readonly string[] | null;
  /** Retain this mutable mapping list and separately snapshot its source strings, as MIPSprogram does. */
  setSourceLineList(lines: SourceLine<TokenizerProgram>[]): void;
}

/** Injected source-file operations replace Java File and MIPSprogram.readSource. */
export interface TokenizerSourceHost {
  /** Path separator used by this source host, ordinarily '/' for browser virtual files. */
  readonly separator: string;
  /** Whether a source reference is absolute in the host's path model. */
  isAbsolute(filename: string): boolean;
  /** Return the including filename's parent, or null when it has none; preserve path spelling. */
  getParent(filename: string): string | null;
  /** Read a source file into a new caller-owned program; failures throw ProcessingException. */
  readSource(filename: string): TokenizerProgram;
}

/** Per-program lexical analysis, recursive include expansion, and ordered .eqv substitution. */
export class Tokenizer {
  private errors: ErrorList;
  private sourceMIPSprogram: TokenizerProgram | null;
  private equivalents: Map<string, string> | null = null;
  private static readonly escapedCharacters = '\'"\\ntbrf0';
  private static readonly escapedCharactersValues = [
    '39',
    '34',
    '92',
    '10',
    '9',
    '8',
    '13',
    '12',
    '0'
  ];

  /** Bind the session's classification and optional source/debug services; each instance owns its errors/equivalences. */
  constructor(
    private readonly context: TokenClassificationContext,
    program: TokenizerProgram | null = null,
    private readonly sources: TokenizerSourceHost | null = null,
    private readonly debug: ((text: string) => void) | null = null,
    maximumErrorMessages = 200
  ) {
    this.errors = new ErrorList(maximumErrorMessages);
    this.sourceMIPSprogram = program;
  }

  /** Expand includes, tokenize every source line, and throw all accumulated lexical errors after processing. */
  tokenize(program: TokenizerProgram): TokenList[] {
    this.sourceMIPSprogram = program;
    this.equivalents = new Map();
    const tokenList: TokenList[] = [];
    const source = this.processIncludes(program, new Map());
    program.setSourceLineList(source);
    for (let i = 0; i < source.length; i++) {
      const sourceLine = source[i].getSource();
      const current = this.tokenizeLine(i + 1, sourceLine);
      tokenList.push(current);
      if (sourceLine.length > 0 && sourceLine !== current.getProcessedLine()) {
        source[i] = new SourceLine(
          current.getProcessedLine(),
          source[i].getMIPSprogram(),
          source[i].getLineNumber()
        );
      }
    }
    if (this.errors.errorsOccurred()) throw new ProcessingException(this.errors);
    return tokenList;
  }

  /** Tokenize an instruction example without .eqv processing and throw if this tokenizer has lexical errors. */
  tokenizeExampleInstruction(example: string): TokenList {
    const result = this.tokenizeLine(this.sourceMIPSprogram, 0, example, false);
    if (this.errors.errorsOccurred()) throw new ProcessingException(this.errors);
    return result;
  }

  /** Tokenize one line in the current program, optionally routing diagnostics and controlling .eqv substitution. */
  tokenizeLine(
    lineNumber: number,
    line: string,
    callerErrors?: ErrorList,
    doEqvSubstitutes?: boolean
  ): TokenList;
  /** Tokenize one line for an explicit program, controlling .eqv substitution. */
  tokenizeLine(
    program: TokenizerProgram | null,
    lineNumber: number,
    line: string,
    doEqvSubstitutes: boolean
  ): TokenList;
  tokenizeLine(
    first: number | TokenizerProgram | null,
    second: string | number,
    third?: string | ErrorList,
    fourth = true
  ): TokenList {
    if (typeof first === 'number') {
      if (third instanceof ErrorList) {
        const saved = this.errors;
        this.errors = third;
        const result = this.tokenizeLineInternal(
          this.sourceMIPSprogram,
          first,
          second as string,
          fourth
        );
        this.errors = saved;
        return result;
      }
      return this.tokenizeLineInternal(this.sourceMIPSprogram, first, second as string, true);
    }
    return this.tokenizeLineInternal(first, second as number, third as string, fourth);
  }

  /** Return the mutable diagnostic list owned by this tokenizer. */
  getErrors(): ErrorList {
    return this.errors;
  }

  private processIncludes(
    program: TokenizerProgram,
    includedFiles: Map<string, string>
  ): SourceLine<TokenizerProgram>[] {
    const source = program.getSourceList()!;
    const result: SourceLine<TokenizerProgram>[] = [];
    for (let i = 0; i < source.length; i++) {
      const line = source[i];
      const tokens = this.tokenizeLine(program, i + 1, line, false);
      let hasInclude = false;
      for (let ii = 0; ii < tokens.size(); ii++) {
        if (
          Directives.matchDirective(tokens.get(ii).getValue()) === Directives.INCLUDE &&
          tokens.size() > ii + 1 &&
          tokens.get(ii + 1).getType() === TokenTypes.QUOTED_STRING
        ) {
          let filename = tokens.get(ii + 1).getValue();
          filename = this.substring(filename, 1, filename.length - 1);
          if (this.sources === null)
            throw new TypeError('Include processing requires a source host');
          if (!this.sources.isAbsolute(filename)) {
            const sourceFilename = program.getFilename();
            if (sourceFilename === null) throw new TypeError('Including program filename is null');
            filename =
              String(this.sources.getParent(sourceFilename)) + this.sources.separator + filename;
          }
          const token = tokens.get(ii + 1);
          if (includedFiles.has(filename)) {
            this.errors.add(
              new ErrorMessage(
                program,
                token.getSourceLine(),
                token.getStartPos(),
                'Recursive include of file ' + filename
              )
            );
            throw new ProcessingException(this.errors);
          }
          includedFiles.set(filename, filename);
          let included: TokenizerProgram;
          try {
            included = this.sources.readSource(filename);
          } catch (error) {
            if (!(error instanceof ProcessingException)) throw error;
            this.errors.add(
              new ErrorMessage(
                program,
                token.getSourceLine(),
                token.getStartPos(),
                'Error reading include file ' + filename
              )
            );
            throw new ProcessingException(this.errors);
          }
          result.push(...this.processIncludes(included, includedFiles));
          hasInclude = true;
          break;
        }
      }
      if (!hasInclude) result.push(new SourceLine(line, program, i + 1));
    }
    return result;
  }

  private tokenizeLineInternal(
    program: TokenizerProgram | null,
    lineNumber: number,
    theLine: string,
    doEqvSubstitutes: boolean
  ): TokenList {
    let result = new TokenList();
    if (theLine.length === 0) return result;
    const line = theLine.split('');
    const token: string[] = new Array(line.length);
    let linePosition = 0;
    let tokenPosition = 0;
    let tokenStartPosition = 1;
    let insideQuotedString = false;
    const process = () =>
      this.processCandidateToken(
        token,
        program,
        lineNumber,
        theLine,
        tokenPosition,
        tokenStartPosition,
        result
      );
    this.debug?.('source line --->' + theLine + '<---');
    while (linePosition < line.length) {
      let character = line[linePosition];
      if (insideQuotedString) {
        token[tokenPosition++] = character;
        if (character === '"' && token[tokenPosition - 2] !== '\\') {
          process();
          tokenPosition = 0;
          insideQuotedString = false;
        }
      } else {
        switch (character) {
          case '#':
            if (tokenPosition > 0) {
              process();
              tokenPosition = 0;
            }
            tokenStartPosition = linePosition + 1;
            tokenPosition = line.length - linePosition;
            for (let j = 0; j < tokenPosition; j++) token[j] = line[linePosition + j];
            process();
            linePosition = line.length;
            tokenPosition = 0;
            break;
          case ' ':
          case '\t':
          case ',':
            if (tokenPosition > 0) {
              process();
              tokenPosition = 0;
            }
            break;
          case '+':
          case '-':
            if (
              tokenPosition > 0 &&
              line.length >= linePosition + 2 &&
              JavaCharacter.isDigit(line[linePosition + 1]) &&
              (line[linePosition - 1] === 'e' || line[linePosition - 1] === 'E')
            ) {
              token[tokenPosition++] = character;
              break;
            }
            if (tokenPosition > 0) {
              process();
              tokenPosition = 0;
            }
            tokenStartPosition = linePosition + 1;
            token[tokenPosition++] = character;
            if (!(
              (result.isEmpty() ||
                result.get(result.size() - 1).getType() !== TokenTypes.IDENTIFIER) &&
              line.length >= linePosition + 2 &&
              JavaCharacter.isDigit(line[linePosition + 1])
            )) {
              process();
              tokenPosition = 0;
            }
            break;
          case ':':
          case '(':
          case ')':
            if (tokenPosition > 0) {
              process();
              tokenPosition = 0;
            }
            tokenStartPosition = linePosition + 1;
            token[tokenPosition++] = character;
            process();
            tokenPosition = 0;
            break;
          case '"':
            if (tokenPosition > 0) {
              process();
              tokenPosition = 0;
            }
            tokenStartPosition = linePosition + 1;
            token[tokenPosition++] = character;
            insideQuotedString = true;
            break;
          case "'": {
            if (tokenPosition > 0) {
              process();
              tokenPosition = 0;
            }
            tokenStartPosition = linePosition + 1;
            token[tokenPosition++] = character;
            const lookaheadCharacters = line.length - linePosition - 1;
            if (lookaheadCharacters < 2) break;
            character = line[++linePosition];
            token[tokenPosition++] = character;
            if (character === "'") break;
            character = line[++linePosition];
            token[tokenPosition++] = character;
            if ((character === "'" && token[1] !== '\\') || lookaheadCharacters === 2) {
              process();
              tokenPosition = 0;
              tokenStartPosition = linePosition + 1;
              break;
            }
            character = line[++linePosition];
            token[tokenPosition++] = character;
            if (character === "'" || lookaheadCharacters === 3) {
              process();
              tokenPosition = 0;
              tokenStartPosition = linePosition + 1;
              break;
            }
            if (lookaheadCharacters >= 5) {
              character = line[++linePosition];
              token[tokenPosition++] = character;
              if (character !== "'") {
                character = line[++linePosition];
                token[tokenPosition++] = character;
              }
            }
            process();
            tokenPosition = 0;
            tokenStartPosition = linePosition + 1;
            break;
          }
          default:
            if (tokenPosition === 0) tokenStartPosition = linePosition + 1;
            token[tokenPosition++] = character;
            break;
        }
      }
      linePosition++;
    }
    if (tokenPosition > 0) process();
    if (doEqvSubstitutes) result = this.processEqv(program, lineNumber, theLine, result);
    return result;
  }

  private processEqv(
    program: TokenizerProgram | null,
    lineNumber: number,
    theLine: string,
    tokens: TokenList
  ): TokenList {
    if (
      tokens.size() > 2 &&
      (tokens.get(0).getType() === TokenTypes.DIRECTIVE ||
        tokens.get(2).getType() === TokenTypes.DIRECTIVE)
    ) {
      const directivePosition = tokens.get(0).getType() === TokenTypes.DIRECTIVE ? 0 : 2;
      if (Directives.matchDirective(tokens.get(directivePosition).getValue()) === Directives.EQV) {
        const lastOperand =
          tokens.size() - (tokens.get(tokens.size() - 1).getType() === TokenTypes.COMMENT ? 2 : 1);
        if (lastOperand < directivePosition + 2) {
          this.errors.add(
            new ErrorMessage(
              program,
              lineNumber,
              tokens.get(directivePosition).getStartPos(),
              'Too few operands for .eqv directive'
            )
          );
          return tokens;
        }
        if (tokens.get(directivePosition + 1).getType() !== TokenTypes.IDENTIFIER) {
          this.errors.add(
            new ErrorMessage(
              program,
              lineNumber,
              tokens.get(directivePosition).getStartPos(),
              'Malformed .eqv directive'
            )
          );
          return tokens;
        }
        const symbol = tokens.get(directivePosition + 1).getValue();
        for (let i = directivePosition + 2; i < tokens.size(); i++) {
          if (tokens.get(i).getValue() === symbol) {
            this.errors.add(
              new ErrorMessage(
                program,
                lineNumber,
                tokens.get(directivePosition).getStartPos(),
                'Cannot substitute ' + symbol + ' for itself in .eqv directive'
              )
            );
            return tokens;
          }
        }
        const startExpression = tokens.get(directivePosition + 2).getStartPos();
        const endExpression =
          tokens.get(lastOperand).getStartPos() + tokens.get(lastOperand).getValue().length;
        const expression = this.substring(theLine, startExpression - 1, endExpression - 1);
        if (this.equivalents === null)
          throw new TypeError('Equivalences are not initialized before tokenize');
        if (this.equivalents.has(symbol) && this.equivalents.get(symbol) !== expression) {
          this.errors.add(
            new ErrorMessage(
              program,
              lineNumber,
              tokens.get(directivePosition + 1).getStartPos(),
              '"' + symbol + '" is already defined'
            )
          );
          return tokens;
        }
        this.equivalents.set(symbol, expression);
        return tokens;
      }
    }
    let substitutionMade = false;
    for (let i = 0; i < tokens.size(); i++) {
      const token = tokens.get(i);
      if (
        token.getType() === TokenTypes.IDENTIFIER &&
        this.equivalents !== null &&
        this.equivalents.has(token.getValue())
      ) {
        const substitution = this.equivalents.get(token.getValue())!;
        const startPosition = token.getStartPos();
        theLine =
          this.substring(theLine, 0, startPosition - 1) +
          substitution +
          this.substring(theLine, startPosition + token.getValue().length - 1);
        substitutionMade = true;
        break;
      }
    }
    tokens.setProcessedLine(theLine);
    return substitutionMade ? this.tokenizeLine(lineNumber, theLine) : tokens;
  }

  private processCandidateToken(
    token: string[],
    program: TokenizerProgram | null,
    line: number,
    theLine: string,
    tokenPosition: number,
    tokenStartPosition: number,
    tokenList: TokenList
  ): void {
    let value = token.slice(0, tokenPosition).join('');
    if (value.length > 0 && value.charAt(0) === "'") value = this.preprocessCharacterLiteral(value);
    const type = TokenTypes.matchTokenType(value, this.context);
    if (type === TokenTypes.ERROR)
      this.errors.add(
        new ErrorMessage(
          program,
          line,
          tokenStartPosition,
          theLine + '\nInvalid language element: ' + value
        )
      );
    tokenList.add(new Token(type, value, program, line, tokenStartPosition));
  }

  private preprocessCharacterLiteral(value: string): string {
    if (value.length < 3 || value.charAt(0) !== "'" || value.charAt(value.length - 1) !== "'")
      return value;
    const contents = value.substring(1, value.length - 1);
    if (contents.charAt(0) !== '\\')
      return contents.length === 1 ? String(contents.charCodeAt(0)) : value;
    if (contents.length === 2) {
      const index = Tokenizer.escapedCharacters.indexOf(contents.charAt(1));
      return index >= 0 ? Tokenizer.escapedCharactersValues[index] : value;
    }
    if (contents.length === 4) {
      const digits = contents.substring(1);
      // Integer.parseInt accepts an optional sign even in the three-character octal escape.
      let index = digits.charAt(0) === '+' || digits.charAt(0) === '-' ? 1 : 0;
      let integer = 0;
      for (; index < digits.length; index++) {
        const digit = JavaCharacter.decimalDigitValue(digits.charAt(index));
        if (digit < 0 || digit > 7) return value;
        integer = integer * 8 + digit;
      }
      if (digits.charAt(0) === '-') integer = -integer;
      if (integer >= 0 && integer <= 255) return String(integer);
    }
    return value;
  }

  private substring(value: string, start: number, end = value.length): string {
    if (start < 0 || end > value.length || start > end)
      throw new RangeError('String substring index out of bounds');
    return value.substring(start, end);
  }
}
