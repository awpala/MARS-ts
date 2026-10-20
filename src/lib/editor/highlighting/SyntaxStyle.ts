/* Ports SyntaxStyle.java and SyntaxUtilities.getDefaultSyntaxStyles from mars/venus/editors/jeditsyntax.
 * Copyright (C) 1999 Slava Pestov.
 * You may use and modify this package for any purpose. Redistribution is
 * permitted, in both source and binary form, provided that this notice
 * remains intact in all source distributions of this package. */
import data from './lexical-data.json';

/** Browser representation of a canonical editor token's foreground and font style. */
export class SyntaxStyle {
	/** Constructs an immutable style; color is a CSS RGB hexadecimal value. */
	constructor(
		/** CSS foreground color corresponding to the Java Color. */
		readonly color: string,
		/** Whether this token uses italic text. */
		readonly italic: boolean,
		/** Whether this token uses bold text. */
		readonly bold: boolean
	) {}
	/** Returns whether neither italic nor bold is enabled. */
	isPlain(): boolean {
		return !(this.italic || this.bold);
	}
	/** Returns whether italic is enabled. */
	isItalic(): boolean {
		return this.italic;
	}
	/** Returns whether bold is enabled. */
	isBold(): boolean {
		return this.bold;
	}
	/** Returns fresh style objects in the canonical persisted token-ID order. */
	static getDefaultSyntaxStyles(): readonly SyntaxStyle[] {
		return data.styles.map((style) => new SyntaxStyle(style.color, style.italic, style.bold));
	}
}
