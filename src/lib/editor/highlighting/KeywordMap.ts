/* Ports mars/venus/editors/jeditsyntax/KeywordMap.java and SyntaxUtilities.regionMatches.
 * Copyright (C) 1998, 1999 Slava Pestov; Copyright (C) 1999 Mike Dillon.
 * You may use and modify this package for any purpose. Redistribution is
 * permitted, in both source and binary form, provided that this notice
 * remains intact in all source distributions of this package. */
import data from './lexical-data.json';
import { Token } from './Token.js';
import type { Segment } from './TokenMarker.js';

type Keyword = { keyword: string; id: number; next: Keyword | undefined };

/** JDK 21 char-level uppercase mapping, preserving one UTF-16 code unit. */
export function uppercase(character: string): number {
	const code = character.charCodeAt(0);
	let low = 0,
		high = data.uppercase.length - 1;
	while (low <= high) {
		const middle = (low + high) >>> 1,
			pair = data.uppercase[middle];
		if (code < pair[0]) high = middle - 1;
		else if (code > pair[0]) low = middle + 1;
		else return pair[1];
	}
	return code;
}

/** Legacy first/last-character hash buckets with newest matching entry taking precedence. */
export class KeywordMap {
	private readonly map: (Keyword | undefined)[];
	/** Creates a map; MIPS uses case-sensitive lookups and 52 buckets. */
	constructor(
		private ignoreCase: boolean,
		private readonly mapLength = 52
	) {
		this.map = Array(mapLength);
	}
	/** Looks up a segment substring, including MARS's unconditional percent-prefix macro classification. */
	lookup(text: Segment, offset: number, length: number): number {
		if (length === 0) return Token.NULL;
		if (text.array.charAt(offset) === '%') return Token.MACRO_ARG;
		let keyword = this.map[this.key(text.array, offset, length)];
		while (keyword) {
			if (length === keyword.keyword.length && offset + length <= text.offset + text.count) {
				let matches = true;
				for (let i = 0; i < length; i++) {
					const a = text.array.charAt(offset + i),
						b = keyword.keyword.charAt(i);
					if (this.ignoreCase ? uppercase(a) !== uppercase(b) : a !== b) {
						matches = false;
						break;
					}
				}
				if (matches) return keyword.id;
			}
			keyword = keyword.next;
		}
		return Token.NULL;
	}
	/** Prepends an exact mapping to its hash bucket. */
	add(keyword: string, id: number): void {
		if (!keyword.length) throw new RangeError('Empty keyword');
		const key = this.key(keyword, 0, keyword.length);
		this.map[key] = { keyword, id, next: this.map[key] };
	}
	/** Returns whether lookup folds case. */
	getIgnoreCase(): boolean {
		return this.ignoreCase;
	}
	/** Changes lookup case folding without changing the canonical hash buckets. */
	setIgnoreCase(ignoreCase: boolean): void {
		this.ignoreCase = ignoreCase;
	}
	private key(text: string, offset: number, length: number): number {
		return (
			(uppercase(text.charAt(offset)) + uppercase(text.charAt(offset + length - 1))) %
			this.mapLength
		);
	}
}
