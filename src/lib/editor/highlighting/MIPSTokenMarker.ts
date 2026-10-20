/* Ports lexical methods of mars/venus/editors/jeditsyntax/tokenmarker/MIPSTokenMarker.java.
 * Copyright (C) 1998, 1999 Slava Pestov, 2010 Pete Sanderson.
 * You may use and modify this package for any purpose. Redistribution is
 * permitted, in both source and binary form, provided that this notice
 * remains intact in all source distributions of this package.
 * MARS data copyright Pete Sanderson and Kenneth Vollmar, MIT license. */
import { Directives } from '#lib/engine/assembler/Directives.js';
import { TokenTypes } from '#lib/engine/assembler/TokenTypes.js';
import { RegisterFile } from '#lib/engine/hardware/RegisterFile.js';
import { Coprocessor1 } from '#lib/engine/hardware/Coprocessor1.js';
import { KeywordMap } from './KeywordMap.js';
import { JavaCharacter } from '#lib/engine/assembler/JavaCharacter.js';
import { Token } from './Token.js';
import { TokenMarker, type Segment } from './TokenMarker.js';
import data from './lexical-data.json';

/** Canonical MIPS editor scanner; it classifies source for painting, never for assembly. */
export class MIPSTokenMarker extends TokenMarker {
	private lastOffset = 0;
	private lastKeyword = 0;
	/** Creates a document-owned marker, optionally with a caller-owned keyword map. */
	constructor(private readonly keywords = MIPSTokenMarker.getKeywords()) {
		super();
	}
	/** Builds the complete, case-sensitive instruction/directive/register map with legacy instruction/directive/register precedence. */
	static getKeywords(): KeywordMap {
		const keywords = new KeywordMap(false);
		for (const instruction of data.instructions) keywords.add(instruction, Token.KEYWORD1);
		for (const directive of Directives.getDirectiveList())
			keywords.add(directive.getName(), Token.KEYWORD2);
		for (const register of new RegisterFile().getRegisters()) {
			keywords.add(register.getName(), Token.KEYWORD3);
			keywords.add(`$${register.getNumber()}`, Token.KEYWORD3);
		}
		for (const register of new Coprocessor1().getRegisters())
			keywords.add(register.getName(), Token.KEYWORD3);
		return keywords;
	}
	/** Labels indexed by the stable persisted token IDs; unused entries are null. */
	static getMIPSTokenLabels(): readonly (string | null)[] {
		return [
			null,
			'Comment',
			null,
			'String literal',
			'Character literal',
			'Label',
			'MIPS instruction',
			'Assembler directive',
			'Register',
			null,
			'In-progress, invalid',
			'Macro parameter'
		];
	}
	/** Canonical example text for editor syntax-style preferences. */
	static getMIPSTokenExamples(): readonly (string | null)[] {
		return [
			null,
			'# Load',
			null,
			'"First"',
			"'\\n'",
			'main:',
			'lui',
			'.text',
			'$zero',
			null,
			'"Regi',
			'%arg'
		];
	}
	/** Translates the original state machine, including label heuristics, escaped quotes, and invalid literals. */
	markTokensImpl(token: number, line: Segment): number {
		const array = line.array,
			offset = line.offset,
			length = line.count + offset;
		this.lastOffset = offset;
		this.lastKeyword = offset;
		let backslash = false;
		loop: for (let i = offset; i < length; i++) {
			const i1 = i + 1,
				c = array.charAt(i);
			if (c === '\\') {
				backslash = !backslash;
				continue;
			}
			switch (token) {
				case Token.NULL:
					switch (c) {
						case '"':
							this.doKeyword(line, i);
							if (backslash) backslash = false;
							else {
								this.addToken(i - this.lastOffset, token);
								token = Token.LITERAL1;
								this.lastOffset = this.lastKeyword = i;
							}
							break;
						case "'":
							this.doKeyword(line, i);
							if (backslash) backslash = false;
							else {
								this.addToken(i - this.lastOffset, token);
								token = Token.LITERAL2;
								this.lastOffset = this.lastKeyword = i;
							}
							break;
						case ':': {
							backslash = false;
							let validIdentifier = false;
							// Java String.trim removes only code units <= U+0020.
							let start = this.lastOffset,
								end = i;
							while (start < end && array.charCodeAt(start) <= 32) start++;
							while (end > start && array.charCodeAt(end - 1) <= 32) end--;
							try {
								validIdentifier = TokenTypes.isValidIdentifier(array.slice(start, end));
							} catch (error) {
								if (!(error instanceof RangeError)) throw error;
							}
							if (validIdentifier) {
								this.addToken(i1 - this.lastOffset, Token.LABEL);
								this.lastOffset = this.lastKeyword = i1;
							}
							break;
						}
						case '#':
							backslash = false;
							this.doKeyword(line, i);
							if (length - i >= 1) {
								this.addToken(i - this.lastOffset, token);
								this.addToken(length - i, Token.COMMENT1);
								this.lastOffset = this.lastKeyword = length;
								break loop;
							}
							break;
						default:
							backslash = false;
							if (
								!JavaCharacter.isLetterOrDigit(c) &&
								c !== '_' &&
								c !== '.' &&
								c !== '$' &&
								c !== '%'
							)
								this.doKeyword(line, i);
							break;
					}
					break;
				case Token.LITERAL1:
					if (backslash) backslash = false;
					else if (c === '"') {
						this.addToken(i1 - this.lastOffset, token);
						token = Token.NULL;
						this.lastOffset = this.lastKeyword = i1;
					}
					break;
				case Token.LITERAL2:
					if (backslash) backslash = false;
					else if (c === "'") {
						this.addToken(i1 - this.lastOffset, Token.LITERAL1);
						token = Token.NULL;
						this.lastOffset = this.lastKeyword = i1;
					}
					break;
				default:
					throw new Error(`Invalid state: ${token}`);
			}
		}
		if (token === Token.NULL) this.doKeyword(line, length);
		switch (token) {
			case Token.LITERAL1:
			case Token.LITERAL2:
				this.addToken(length - this.lastOffset, Token.INVALID);
				token = Token.NULL;
				break;
			case Token.KEYWORD2:
				this.addToken(length - this.lastOffset, token);
				if (!backslash) token = Token.NULL;
				// Retain the legacy switch fallthrough's second addToken call.
				this.addToken(length - this.lastOffset, token);
				break;
			default:
				this.addToken(length - this.lastOffset, token);
				break;
		}
		return token;
	}
	private doKeyword(line: Segment, i: number): boolean {
		const length = i - this.lastKeyword,
			id = this.keywords.lookup(line, this.lastKeyword, length);
		if (id !== Token.NULL) {
			if (this.lastKeyword !== this.lastOffset)
				this.addToken(this.lastKeyword - this.lastOffset, Token.NULL);
			this.addToken(length, id);
			this.lastOffset = i;
		}
		this.lastKeyword = i + 1;
		return false;
	}
}

/** Stable painting snapshot detached from the marker's reused linked nodes. */
export interface HighlightSpan {
	/** UTF-16 start offset in the full source, unique within a snapshot. */
	readonly start: number;
	/** Original source substring; renderer must escape it as text, never inject HTML. */
	readonly text: string;
	/** Canonical syntax style ID. */
	readonly id: number;
}

/** Highlights all lines through a fresh document-owned marker and preserves every original code unit. */
export function highlightSource(source: string): readonly HighlightSpan[] {
	const marker = new MIPSTokenMarker(),
		lines = source.split('\n'),
		spans: HighlightSpan[] = [];
	marker.insertLines(0, lines.length);
	let start = 0;
	for (let index = 0; index < lines.length; index++) {
		const line = lines[index];
		let offset = 0,
			token = marker.markTokens({ array: line, offset: 0, count: line.length }, index);
		while (token.id !== Token.END) {
			spans.push({
				start: start + offset,
				text: line.slice(offset, offset + token.length),
				id: token.id
			});
			offset += token.length;
			token = token.next!;
		}
		if (index < lines.length - 1)
			spans.push({ start: start + line.length, text: '\n', id: Token.NULL });
		start += line.length + 1;
	}
	return spans;
}
