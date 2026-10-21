import { readOracleJson, parseJsonRows } from '../oracle/fixtures.js';
import { describe, expect, it } from 'vitest';
import {
  ExtendedInstruction,
  type ExtendedInstructionHost
} from '#lib/engine/instructions/ExtendedInstruction.js';
import { Tokenizer } from '#lib/engine/assembler/tokenization/Tokenizer.js';
import { Token } from '#lib/engine/assembler/tokenization/Token.js';
import { TokenList } from '#lib/engine/assembler/tokenization/TokenList.js';
import { TokenTypes } from '#lib/engine/assembler/tokenization/TokenTypes.js';
import { SymbolTable } from '#lib/engine/assembler/symbols/SymbolTable.js';
import { ErrorList } from '#lib/engine/diagnostics/ErrorList.js';
import { RegisterFile } from '#lib/engine/hardware/registers/RegisterFile.js';
import { Coprocessor0 } from '#lib/engine/hardware/registers/Coprocessor0.js';
import { Coprocessor1 } from '#lib/engine/hardware/registers/Coprocessor1.js';

interface Metadata {
  kind: 'metadata';
  overload: number;
  translation: string | null;
  compact: string | null;
  example: string;
  name: string;
  description: string;
  templates: string[] | null;
  compactTemplates: string[] | null;
  hasCompact: boolean;
  length: number;
  compactLength: number;
  delayedLength: number;
  delayedCompactLength: number;
  tokens: string;
  types: string;
}
interface Expansion {
  kind: 'expansion';
  template: string;
  values: string[];
  delayed: boolean;
  result: string | null;
  failure: string | null;
}
interface Operators {
  kind: 'operators';
  names: string[];
}
const captured = readOracleJson('extended-instruction-units/golden.json') as {
  stdout: string;
  stderr: string;
  status: number;
};
const rows = parseJsonRows<Metadata | Expansion | Operators>(captured.stdout);
const operators = new Set((rows[0] as Operators).names);
const metadata = rows.filter((row): row is Metadata => row.kind === 'metadata');
const expansions = rows.filter((row): row is Expansion => row.kind === 'expansion');
function setup() {
  let delayed = false;
  const context = {
    registerFile: new RegisterFile(),
    coprocessor0: new Coprocessor0(),
    coprocessor1: new Coprocessor1(),
    instructionSet: {
      matchOperator: (name: string) => (operators.has(name.toLowerCase()) ? [] : null)
    },
    getDelayedBranchingEnabled: () => delayed
  };
  const diagnostics: string[] = [];
  const host: ExtendedInstructionHost = {
    getDelayedBranchingEnabled: () => delayed,
    tokenizeExampleInstruction: (example) =>
      new Tokenizer(context).tokenizeExampleInstruction(example),
    write: (message) => diagnostics.push(message)
  };
  const global = new SymbolTable('global', null),
    local = new SymbolTable('probe.asm', global);
  local.addSymbol(
    new Token(TokenTypes.IDENTIFIER, 'LABEL_local', null, 1, 1),
    268468224,
    false,
    new ErrorList()
  );
  global.addSymbol(
    new Token(TokenTypes.IDENTIFIER, 'global_target', null, 1, 1),
    4194304,
    false,
    new ErrorList()
  );
  return {
    context,
    host,
    diagnostics,
    setDelayed: (value: boolean) => {
      delayed = value;
    },
    program: { getLocalSymbolTable: () => local }
  };
}
describe('ExtendedInstruction Java oracle', () => {
  it('captures successful isolated Java execution', () => {
    expect(captured.status).toBe(0);
    expect(captured.stderr).toBe('');
    expect(metadata.length).toBeGreaterThan(300);
    expect(expansions.length).toBeGreaterThan(2000);
  });
  it('matches every pseudo descriptor, constructor overload, token list, and live length setting', () => {
    const session = setup();
    for (const row of metadata) {
      const translation =
        row.overload === 0 ? (row.templates?.join('\n') ?? null) : row.translation;
      const compact = row.overload === 0 ? (row.compactTemplates?.join('\n') ?? null) : row.compact;
      const instruction =
        row.overload === 2
          ? new ExtendedInstruction(row.example, translation, session.host)
          : row.overload === 3
            ? new ExtendedInstruction(row.example, translation, row.description, session.host)
            : new ExtendedInstruction(
                row.example,
                translation,
                compact,
                row.description,
                session.host
              );
      expect(
        [
          instruction.getName(),
          instruction.getDescription(),
          instruction.getExampleFormat(),
          instruction.getBasicIntructionTemplateList(),
          instruction.getCompactBasicIntructionTemplateList(),
          instruction.hasCompactTranslation(),
          instruction.getTokenList()?.toString(),
          instruction.getTokenList()?.toTypeString()
        ],
        row.example
      ).toEqual([
        row.name,
        row.description,
        row.example,
        row.templates,
        row.compactTemplates,
        row.hasCompact,
        row.tokens,
        row.types
      ]);
      session.setDelayed(false);
      expect(
        [instruction.getInstructionLength(), instruction.getCompactInstructionLength()],
        row.example
      ).toEqual([row.length, row.compactLength]);
      session.setDelayed(true);
      expect(
        [instruction.getInstructionLength(), instruction.getCompactInstructionLength()],
        row.example
      ).toEqual([row.delayedLength, row.delayedCompactLength]);
    }
    expect(session.diagnostics).toEqual([]);
  });
  it('matches all catalog expansions and every marker at signed boundaries and malformed inputs', () => {
    const session = setup();
    for (const row of expansions) {
      session.setDelayed(row.delayed);
      const tokens = new TokenList();
      for (const value of row.values)
        tokens.add(new Token(TokenTypes.IDENTIFIER, value, null, 1, 1));
      const expand = () =>
        ExtendedInstruction.makeTemplateSubstitutions(
          session.program,
          row.template,
          tokens,
          session.context
        );
      if (row.failure !== null) {
        expect(row.failure).toBe('StringIndexOutOfBoundsException');
        expect(expand, row.template).toThrow(RangeError);
      } else expect(expand(), JSON.stringify(row)).toBe(row.result);
    }
  });
  it('returns owned mutable template lists and retains constructor tokenizer diagnostics', () => {
    const session = setup();
    const instruction = new ExtendedInstruction('custom $1', 'nop', session.host);
    instruction.getBasicIntructionTemplateList()!.push('DBNOP');
    expect(instruction.getInstructionLength()).toBe(4);
    session.setDelayed(true);
    expect(instruction.getInstructionLength()).toBe(8);
    const invalid = new ExtendedInstruction('custom @', 'nop', session.host);
    expect(invalid.getTokenList()).toBeNull();
    expect(session.diagnostics).toHaveLength(1);
  });
});
