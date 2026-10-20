/* Ports mars/venus/editors/jeditsyntax/tokenmarker/Token.java.
 * Copyright (C) 1998, 1999 Slava Pestov.
 * You may use and modify this package for any purpose. Redistribution is
 * permitted, in both source and binary form, provided that this notice
 * remains intact in all source distributions of this package. */

/** Reused linked-list token; lengths and offsets are Java UTF-16 code units. */
export class Token {
	/** Unstyled source. */ static readonly NULL = 0;
	/** Line comment. */ static readonly COMMENT1 = 1;
	/** Alternate comment style. */ static readonly COMMENT2 = 2;
	/** String literal (also used for completed character literals by MARS). */ static readonly LITERAL1 = 3;
	/** Character-literal scanner state. */ static readonly LITERAL2 = 4;
	/** Label definition. */ static readonly LABEL = 5;
	/** Instruction mnemonic. */ static readonly KEYWORD1 = 6;
	/** Assembler directive. */ static readonly KEYWORD2 = 7;
	/** Register name. */ static readonly KEYWORD3 = 8;
	/** Operator style. */ static readonly OPERATOR = 9;
	/** Unterminated literal. */ static readonly INVALID = 10;
	/** Percent-prefixed macro argument. */ static readonly MACRO_ARG = 11;
	/** Number of persisted public style IDs. */ static readonly ID_COUNT = 12;
	/** First private scanner-state ID, forbidden in painted tokens. */ static readonly INTERNAL_FIRST = 100;
	/** Last private scanner-state ID. */ static readonly INTERNAL_LAST = 126;
	/** Zero-length terminator of the reused linked list. */ static readonly END = 127;
	/** Next reused node; stop reading at END even if its next pointer is populated. */ next: Token | null =
		null;
	/** Creates a token with its UTF-16 length and persisted syntax style ID. */
	constructor(
		/** Mutable code-unit length, reset by the marker on each line. */ public length: number,
		/** Mutable syntax style ID, reset by the marker on each line. */ public id: number
	) {}
	/** Returns the Java diagnostic representation. */
	toString(): string {
		return `[id=${this.id},length=${this.length}]`;
	}
}
