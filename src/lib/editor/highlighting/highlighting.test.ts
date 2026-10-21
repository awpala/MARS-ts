import { describe, expect, it } from 'vitest';
import oracle from '../../../../tests/oracle/highlighting/highlighting.json';
import { MIPSTokenMarker, highlightSource } from './MIPSTokenMarker.js';
import { Token } from './Token.js';

type OracleCase = {
  source: string;
  lines: { tokens: [number, number][]; state: number; nextLineRequested: boolean }[];
};
const captured = JSON.parse(oracle.stdout) as { cases: OracleCase[]; instructions: string[] };
class InspectableMarker extends MIPSTokenMarker {
  state(line: number): number {
    return this.lineInfo[line];
  }
}

describe('Java MIPS editor highlighting oracle', () => {
  it.each(captured.cases.map((sample, index) => ({ ...sample, index })))(
    'matches token lengths, IDs, and line states for case $index',
    ({ source, lines: expected }) => {
      const marker = new InspectableMarker(),
        lines = source.split('\n');
      marker.insertLines(0, lines.length);
      const actual = lines.map((line, index) => {
        let token = marker.markTokens(
          { array: 'prefix!' + line + '!suffix', offset: 7, count: line.length },
          index
        );
        const tokens: [number, number][] = [];
        while (true) {
          tokens.push([token.id, token.length]);
          if (token.id === Token.END) break;
          token = token.next!;
        }
        return {
          tokens,
          state: marker.state(index),
          nextLineRequested: marker.isNextLineRequested()
        };
      });
      expect(actual).toEqual(expected);
      expect(
        highlightSource(source)
          .map((span) => span.text)
          .join('')
      ).toBe(source);
    }
  );
  it('does not share painting snapshots or mutable token lists across documents', () => {
    const first = highlightSource('main: li $a0, 1 # comment');
    const saved = structuredClone(first);
    highlightSource('.data\n.asciiz "other"');
    expect(first).toEqual(saved);
    expect(captured.instructions).toContain('li');
    expect(captured.instructions).toContain('add');
  });
});
