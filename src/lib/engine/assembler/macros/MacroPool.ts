/*
Copyright (c) 2013.

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
// Ports mars/assembler/MacroPool.java.
// MARS copyright Pete Sanderson and Kenneth Vollmar; macro implementation by M.H. Sekhavat.

import { Macro, type MacroProgram, type MacroRegisters } from './Macro.js';
import { Token } from '../tokenization/Token.js';
import { TokenList } from '../tokenization/TokenList.js';

/** One program's macro definitions, expansion counter, and recursion-detection stack. */
export class MacroPool {
	private readonly macroList: Macro[] = [];
	private current: Macro | null = null;
	private readonly callStack: number[] = [];
	private readonly callStackOrigLines: number[] = [];
	private counter = 0;

	/** Create an empty pool owned by the supplied program and simulator session. */
	constructor(
		private readonly program: MacroProgram | null,
		private readonly registers: MacroRegisters
	) {}
	/** Begin a definition from its name token and original/expanded locations. */
	beginMacro(nameToken: Token): void {
		this.current = new Macro(this.registers);
		this.current.setName(nameToken.getValue());
		this.current.setFromLine(nameToken.getSourceLine());
		this.current.setOriginalFromLine(nameToken.getOriginalSourceLine());
		this.current.setProgram(this.program);
	}
	/** Finish and append the active definition; requires beginMacro first. */
	commitMacro(endToken: Token): void {
		if (this.current === null) throw new TypeError('No active macro definition');
		this.current.setToLine(endToken.getSourceLine());
		this.current.setOriginalToLine(endToken.getOriginalSourceLine());
		this.current.readyForCommit();
		this.macroList.push(this.current);
		this.current = null;
	}
	/** Select the latest opening-line definition with the same name and argument count; callerLine is unused in Java. */
	getMatchingMacro(tokens: TokenList, _callerLine: number): Macro | null {
		void _callerLine;
		if (tokens.size() < 1) return null;
		let result: Macro | null = null;
		const first = tokens.get(0);
		for (const macro of this.macroList) {
			if (
				macro.getName() === first.getValue() &&
				macro.getArgs().length + 1 === tokens.size() &&
				(result === null || result.getFromLine() < macro.getFromLine())
			)
				result = macro;
		}
		return result;
	}
	/** Test whether any committed definition uses this case-sensitive name. */
	matchesAnyMacroName(value: string): boolean {
		return this.macroList.some((macro) => macro.getName() === value);
	}
	/** Return the active uncommitted definition, or null. */
	getCurrent(): Macro | null {
		return this.current;
	}
	/** Replace the active definition reference. */
	setCurrent(current: Macro | null): void {
		this.current = current;
	}
	/** Return the current unique expansion number, then increment with Java int wrap. */
	getNextCounter(): number {
		const result = this.counter;
		this.counter = (this.counter + 1) | 0;
		return result;
	}
	/** Return the mutable expanded-line recursion stack, as in Java. */
	getCallStack(): number[] {
		return this.callStack;
	}
	/** Return true for a repeated expanded line; otherwise push both expanded and original lines. */
	pushOnCallStack(token: Token): boolean {
		const sourceLine = token.getSourceLine();
		if (this.callStack.includes(sourceLine)) return true;
		this.callStack.push(sourceLine);
		this.callStackOrigLines.push(token.getOriginalSourceLine());
		return false;
	}
	/** Pop the last expansion; an empty stack fails before changing the original-line stack. */
	popFromCallStack(): void {
		if (this.callStack.length === 0) throw new RangeError('Index -1 out of bounds for length 0');
		this.callStack.pop();
		if (this.callStackOrigLines.length === 0)
			throw new RangeError('Index -1 out of bounds for length 0');
		this.callStackOrigLines.pop();
	}
	/** Return original call lines joined by arrows, with no trailing arrow. */
	getExpansionHistory(): string {
		return this.callStackOrigLines.join('->');
	}
}
