/* Copyright (c) 2003-2008, Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports mars/assembler/OperandFormat.java; see MARSlicense.txt. */
import { Token } from './tokenization/Token.js';
import { TokenList } from './tokenization/TokenList.js';
import { TokenTypes } from './tokenization/TokenTypes.js';
import { DataTypes } from './directives/DataTypes.js';
import { Binary } from '../formatting/Binary.js';
import { ErrorList } from '../diagnostics/ErrorList.js';
import { ErrorMessage } from '../diagnostics/ErrorMessage.js';
import type { Instruction } from '../instructions/Instruction.js';

/** Session setting consumed by the canonical register-name operand rule. */
export interface OperandFormatContext {
  /** Return whether assembly requires numeric register names. */
  getBareMachineEnabled(): boolean;
}
/** Original operand count/type validation and ordered overload selection. */
export class OperandFormat {
  private constructor() {}
  /** Verify operand count and types, retaining the original token reclassification side effect. */
  static tokenOperandMatch(
    candidateList: TokenList,
    inst: Instruction,
    errors: ErrorList,
    context: OperandFormatContext
  ): boolean {
    if (!this.numOperandsCheck(candidateList, inst, errors)) return false;
    if (!this.operandTypeCheck(candidateList, inst, errors, context)) return false;
    return true;
  }

  /** Select the first matching overload, or the first candidate when none match; null remains null. */
  static bestOperandMatch(
    tokenList: TokenList,
    instrMatches: readonly Instruction[] | null,
    context: OperandFormatContext
  ): Instruction | null {
    if (instrMatches == null) return null;
    if (instrMatches.length == 1) return instrMatches[0];
    for (let i = 0; i < instrMatches.length; i++) {
      const potentialMatch = instrMatches[i];
      if (this.tokenOperandMatch(tokenList, potentialMatch, new ErrorList(), context))
        return potentialMatch;
    }
    if (instrMatches.length === 0) throw new RangeError('Index 0 out of bounds for length 0');
    return instrMatches[0];
  }

  private static numOperandsCheck(cand: TokenList, spec: Instruction, errors: ErrorList): boolean {
    const numOperands = cand.size() - 1;
    const reqNumOperands = spec.getTokenList()!.size() - 1;
    const operator = cand.get(0);
    if (numOperands == reqNumOperands) {
      return true;
    } else if (numOperands < reqNumOperands) {
      const mess =
        'Too few or incorrectly formatted operands. Expected: ' + spec.getExampleFormat();
      this.generateMessage(operator, mess, errors);
    } else {
      const mess =
        'Too many or incorrectly formatted operands. Expected: ' + spec.getExampleFormat();
      this.generateMessage(operator, mess, errors);
    }
    return false;
  }

  private static operandTypeCheck(
    cand: TokenList,
    spec: Instruction,
    errors: ErrorList,
    context: OperandFormatContext
  ): boolean {
    let candToken: Token, specToken: Token;
    let candType: TokenTypes, specType: TokenTypes;
    for (let i = 1; i < spec.getTokenList()!.size(); i++) {
      candToken = cand.get(i);
      specToken = spec.getTokenList()!.get(i);
      candType = candToken.getType();
      specType = specToken.getType();

      if (specType == TokenTypes.IDENTIFIER && candType == TokenTypes.OPERATOR) {
        const replacement = new Token(
          TokenTypes.IDENTIFIER,
          candToken.getValue(),
          candToken.getSourceMIPSprogram(),
          candToken.getSourceLine(),
          candToken.getStartPos()
        );
        cand.set(i, replacement);
        continue;
      }

      if (
        (specType == TokenTypes.REGISTER_NAME || specType == TokenTypes.REGISTER_NUMBER) &&
        candType == TokenTypes.REGISTER_NAME
      ) {
        if (context.getBareMachineEnabled()) {
          this.generateMessage(
            candToken,
            'Use register number instead of name.  See Settings.',
            errors
          );
          return false;
        } else {
          continue;
        }
      }
      if (specType == TokenTypes.REGISTER_NAME && candType == TokenTypes.REGISTER_NUMBER) continue;
      if (
        (specType == TokenTypes.INTEGER_16 && candType == TokenTypes.INTEGER_5) ||
        (specType == TokenTypes.INTEGER_16U && candType == TokenTypes.INTEGER_5) ||
        (specType == TokenTypes.INTEGER_32 && candType == TokenTypes.INTEGER_5) ||
        (specType == TokenTypes.INTEGER_32 && candType == TokenTypes.INTEGER_16U) ||
        (specType == TokenTypes.INTEGER_32 && candType == TokenTypes.INTEGER_16)
      )
        continue;
      if (candType == TokenTypes.INTEGER_16U || candType == TokenTypes.INTEGER_16) {
        const temp = Binary.stringToInt(candToken.getValue());
        if (
          specType == TokenTypes.INTEGER_16 &&
          candType == TokenTypes.INTEGER_16U &&
          temp >= DataTypes.MIN_HALF_VALUE &&
          temp <= DataTypes.MAX_HALF_VALUE
        )
          continue;
        if (
          specType == TokenTypes.INTEGER_16U &&
          candType == TokenTypes.INTEGER_16 &&
          temp >= DataTypes.MIN_UHALF_VALUE &&
          temp <= DataTypes.MAX_UHALF_VALUE
        )
          continue;
      }
      if (
        (specType == TokenTypes.INTEGER_5 && candType == TokenTypes.INTEGER_16) ||
        (specType == TokenTypes.INTEGER_5 && candType == TokenTypes.INTEGER_16U) ||
        (specType == TokenTypes.INTEGER_5 && candType == TokenTypes.INTEGER_32) ||
        (specType == TokenTypes.INTEGER_16 && candType == TokenTypes.INTEGER_16U) ||
        (specType == TokenTypes.INTEGER_16U && candType == TokenTypes.INTEGER_16) ||
        (specType == TokenTypes.INTEGER_16U && candType == TokenTypes.INTEGER_32) ||
        (specType == TokenTypes.INTEGER_16 && candType == TokenTypes.INTEGER_32)
      ) {
        this.generateMessage(candToken, 'operand is out of range', errors);
        return false;
      }
      if (candType != specType) {
        this.generateMessage(candToken, 'operand is of incorrect type', errors);
        return false;
      }
    }

    return true;
  }

  private static generateMessage(token: Token, mess: string, errors: ErrorList): void {
    errors.add(
      new ErrorMessage(
        token.getSourceMIPSprogram(),
        token.getSourceLine(),
        token.getStartPos(),
        '"' + token.getValue() + '": ' + mess
      )
    );
    return;
  }
}
