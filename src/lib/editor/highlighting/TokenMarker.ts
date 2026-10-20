/* Ports mars/venus/editors/jeditsyntax/tokenmarker/TokenMarker.java.
 * Copyright (C) 1998, 1999 Slava Pestov.
 * You may use and modify this package for any purpose. Redistribution is
 * permitted, in both source and binary form, provided that this notice
 * remains intact in all source distributions of this package. */
import { Token } from './Token.js';

/** String-backed equivalent of Swing Segment, indexed by UTF-16 code units. */
export interface Segment {
	/** Full backing string, including any text outside this segment. */
	readonly array: string;
	/** First included code-unit index in array. */
	readonly offset: number;
	/** Included code-unit count. */
	readonly count: number;
}

/** One document's incremental line states and reusable linked token nodes. */
export abstract class TokenMarker {
	protected firstToken: Token | null = null;
	protected lastToken: Token | null = null;
	protected lineInfo: number[] = [];
	private lastLine = -1;
	private nextLineRequested = false;

	/** Tokenizes an existing document line; consume the returned nodes before the next markTokens call. */
	markTokens(line: Segment, lineIndex: number): Token {
		if (lineIndex < 0 || lineIndex >= this.lineInfo.length)
			throw new RangeError(`Tokenizing invalid line: ${lineIndex}`);
		this.lastToken = null;
		const oldToken = this.lineInfo[lineIndex];
		const token = this.markTokensImpl(
			lineIndex === 0 ? Token.NULL : this.lineInfo[lineIndex - 1],
			line,
			lineIndex
		);
		this.lineInfo[lineIndex] = token;
		if (!(this.lastLine === lineIndex && this.nextLineRequested))
			this.nextLineRequested = oldToken !== token;
		this.lastLine = lineIndex;
		this.addToken(0, Token.END);
		return this.firstToken!;
	}
	/** Scanner implementation appends tokens and returns the next line's initial state. */
	protected abstract markTokensImpl(token: number, line: Segment, lineIndex: number): number;
	/** The generic marker requires ordered line-state propagation. */
	supportsMultilineTokens(): boolean {
		return true;
	}
	/** Adds unstyled line states at the insertion position; nonpositive counts do nothing. */
	insertLines(index: number, lines: number): void {
		if (lines <= 0) return;
		if (index < 0 || index > this.lineInfo.length) throw new RangeError('Invalid line insertion');
		this.lineInfo = [
			...this.lineInfo.slice(0, index),
			...Array<number>(lines).fill(Token.NULL),
			...this.lineInfo.slice(index)
		];
	}
	/** Removes document line states; nonpositive counts do nothing. */
	deleteLines(index: number, lines: number): void {
		if (lines <= 0) return;
		if (index < 0 || index + lines > this.lineInfo.length)
			throw new RangeError('Invalid line deletion');
		this.lineInfo.splice(index, lines);
	}
	/** Returns the number of registered document lines. */
	getLineCount(): number {
		return this.lineInfo.length;
	}
	/** Returns whether a changed end state requires painting the following line. */
	isNextLineRequested(): boolean {
		return this.nextLineRequested;
	}
	/** Appends or reuses a node, ignoring empty non-END tokens as in Java. */
	protected addToken(length: number, id: number): void {
		if (id >= Token.INTERNAL_FIRST && id <= Token.INTERNAL_LAST)
			throw new Error(`Invalid id: ${id}`);
		if (length === 0 && id !== Token.END) return;
		if (this.firstToken === null) this.lastToken = this.firstToken = new Token(length, id);
		else if (this.lastToken === null) {
			this.lastToken = this.firstToken;
			this.firstToken.length = length;
			this.firstToken.id = id;
		} else if (this.lastToken.next === null) {
			this.lastToken.next = new Token(length, id);
			this.lastToken = this.lastToken.next;
		} else {
			this.lastToken = this.lastToken.next;
			this.lastToken.length = length;
			this.lastToken.id = id;
		}
	}
}
