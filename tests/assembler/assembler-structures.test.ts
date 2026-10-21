import { readOracleJson, parseTabRows } from '../oracle/fixtures.js';
import { describe, expect, it } from 'vitest';
import { SourceLine } from '#lib/engine/assembler/tokenization/SourceLine.js';
import { Token } from '#lib/engine/assembler/tokenization/Token.js';
import { TokenTypes } from '#lib/engine/assembler/tokenization/TokenTypes.js';
import { TokenList } from '#lib/engine/assembler/tokenization/TokenList.js';
import { SymbolTable } from '#lib/engine/assembler/symbols/SymbolTable.js';
import { ErrorList } from '#lib/engine/diagnostics/ErrorList.js';
import type { DiagnosticProgram } from '#lib/engine/diagnostics/ErrorMessage.js';

const fixture: { stdout: string } = readOracleJson('assembler-units/golden.json');
const lines = parseTabRows(fixture.stdout);
function program(filename: string): DiagnosticProgram & { filename: string } {
  return {
    filename,
    getFilename() {
      return this.filename;
    },
    getSourceLineList: () => null,
    getLocalMacroPool: () => null
  };
}

describe('source and token structures Java oracle', () => {
  it('retains source identity, snapshots filenames, and tracks original token locations', () => {
    const sourceProgram = program('original.asm');
    const source = new SourceLine('label: nop', sourceProgram, 8);
    sourceProgram.filename = 'renamed.asm';
    expect([
      'source',
      source.getSource(),
      source.getFilename(),
      String(source.getLineNumber()),
      String(source.getMIPSprogram() === sourceProgram)
    ]).toEqual(lines.find((line) => line[0] === 'source'));
    const unknown = new SourceLine('', null, -1);
    expect([
      'source-null',
      String(unknown.getFilename()),
      String(unknown.getLineNumber()),
      String(unknown.getMIPSprogram())
    ]).toEqual(lines.find((line) => line[0] === 'source-null'));
    const token = new Token(TokenTypes.OPERATOR, 'add', sourceProgram, 11, 4);
    expect([
      'token',
      token.getValue(),
      token.toString(),
      String(token.getType()),
      String(token.getSourceLine()),
      String(token.getStartPos()),
      String(token.getOriginalSourceLine()),
      String(token.getOriginalProgram() === sourceProgram)
    ]).toEqual(lines.find((line) => line[0] === 'token'));
    const included = program('included.asm');
    token.setOriginal(included, 2);
    token.setType(TokenTypes.IDENTIFIER);
    expect([
      'token-original',
      String(token.getType()),
      String(token.getOriginalSourceLine()),
      String(token.getSourceMIPSprogram() === sourceProgram),
      String(token.getOriginalProgram() === included)
    ]).toEqual(lines.find((line) => line[0] === 'token-original'));
  });

  it('preserves list formatting, shallow-clone aliasing, mutation, and bounds failures', () => {
    const token = new Token(TokenTypes.IDENTIFIER, 'add', null, 11, 4);
    const tokens = new TokenList();
    const observed: string[][] = [];
    const record = (label: string, list: TokenList) =>
      observed.push([
        'list',
        label,
        String(list.size()),
        String(list.isEmpty()),
        list.getProcessedLine(),
        list.toString(),
        list.toTypeString()
      ]);
    record('empty', tokens);
    tokens.setProcessedLine('add $t0');
    tokens.add(token);
    tokens.add(new Token(TokenTypes.REGISTER_NAME, '$t0', null, 11, 8));
    record('added', tokens);
    const clone = tokens.clone();
    token.setType(TokenTypes.OPERATOR);
    record('shared', clone);
    clone.remove(0);
    clone.setProcessedLine('clone');
    record('clone-removed', clone);
    record('original', tokens);
    clone.set(0, token);
    record('replaced', clone);
    expect(observed).toEqual(lines.filter((line) => line[0] === 'list'));
    expect(clone.get(0)).toBe(tokens.get(0));
    for (const [, method, rawPosition, message] of lines.filter(
      (line) => line[0] === 'list-error'
    )) {
      const position = Number(rawPosition);
      expect(() =>
        method === 'set'
          ? tokens.set(position, token)
          : method === 'get'
            ? tokens.get(position)
            : tokens.remove(position)
      ).toThrow(message);
    }
  });
});

describe('symbol-table Java oracle', () => {
  it('matches duplicate diagnostics, global fallback, signed addresses, relocation, and debug output', () => {
    const errors = new ErrorList();
    const global = new SymbolTable('global', null);
    const debug: string[] = [];
    const local = new SymbolTable('local.asm', global, (message) => debug.push(message));
    const token = (name: string) => new Token(TokenTypes.IDENTIFIER, name, null, 3, 7);
    const observed: string[][] = [];
    const record = (label: string) =>
      observed.push([
        'table',
        label,
        String(local.getSize()),
        local
          .getAllSymbols()
          .map((symbol) => `${symbol.getName()}:${symbol.getAddress()}:${symbol.getType()}`)
          .join(',')
      ]);
    global.addSymbol(token('global'), 64, false, errors);
    global.addSymbol(token('minus'), 128, false, errors);
    local.addSymbol(token('local'), 0x80000000, true, errors);
    local.addSymbol(token('alias'), 0x80000000, false, errors);
    local.addSymbol(token('minus'), -1, true, errors);
    local.addSymbol(token('local'), 32, false, errors);
    record('added');
    expect([
      'lookup',
      String(local.getAddress('local')),
      String(local.getAddress('LOCAL')),
      String(local.getAddressLocalOrGlobal('global')),
      String(local.getAddressLocalOrGlobal('minus'))
    ]).toEqual(lines.find((line) => line[0] === 'lookup'));
    for (const [, address, expectedLocal, expectedGlobal] of lines.filter(
      (line) => line[0] === 'address'
    )) {
      expect(local.getSymbolGivenAddress(address)?.getName() ?? 'null').toBe(expectedLocal);
      expect(local.getSymbolGivenAddressLocalOrGlobal(address)?.getName() ?? 'null').toBe(
        expectedGlobal
      );
    }
    expect([
      'segments',
      String(local.getDataSymbols().length),
      String(local.getTextSymbols().length),
      SymbolTable.getStartLabel()
    ]).toEqual(lines.find((line) => line[0] === 'segments'));
    const detached = local.getAllSymbols();
    detached.length = 0;
    expect(['detached', String(local.getSize())]).toEqual(
      lines.find((line) => line[0] === 'detached')
    );
    local.fixSymbolTableAddress(0x80000000, 0x10010000);
    record('relocated');
    local.removeSymbol(token('absent'));
    local.removeSymbol(token('alias'));
    record('removed');
    const error = errors.getErrorMessages()[0];
    expect([
      'duplicate',
      String(errors.errorCount()),
      error.getFilename(),
      String(error.getLine()),
      String(error.getPosition()),
      error.getMessage()
    ]).toEqual(lines.find((line) => line[0] === 'duplicate'));
    local.clear();
    record('cleared');
    expect(observed).toEqual(lines.filter((line) => line[0] === 'table'));
    expect(debug).toEqual(
      lines.filter((line) => line[0].startsWith('The symbol ')).map((line) => line[0])
    );
  });

  it('keeps global tables scoped to their injected sessions and returns shared symbol objects', () => {
    const errors = new ErrorList();
    const firstGlobal = new SymbolTable('global', null);
    const secondGlobal = new SymbolTable('global', null);
    firstGlobal.addSymbol(new Token(TokenTypes.IDENTIFIER, 'entry', null, 1, 1), 16, false, errors);
    const first = new SymbolTable('local', firstGlobal);
    const second = new SymbolTable('local', secondGlobal);
    expect(first.getAddressLocalOrGlobal('entry')).toBe(16);
    expect(second.getAddressLocalOrGlobal('entry')).toBe(SymbolTable.NOT_FOUND);
    firstGlobal.getAllSymbols()[0].setAddress(32);
    expect(first.getAddressLocalOrGlobal('entry')).toBe(32);
  });
});
