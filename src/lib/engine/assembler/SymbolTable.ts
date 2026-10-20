/*
Copyright (c) 2003-2006,  Pete Sanderson and Kenneth Vollmar

Developed by Pete Sanderson (psanderson@otterbein.edu)
and Kenneth Vollmar (kenvollmar@missouristate.edu)

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
// Ports mars/assembler/SymbolTable.java.

import { ErrorList } from '../diagnostics/ErrorList.js';
import { ErrorMessage } from '../diagnostics/ErrorMessage.js';
import { Binary, NumberFormatException } from '../formatting/Binary.js';
import { Symbol } from './Symbol.js';
import { Token } from './Token.js';

/** A program's ordered labels with access to its session's global symbol table. */
export class SymbolTable {
	/** Legacy missing-address marker; also a legal kernel address. */
	static readonly NOT_FOUND = -1;
	private table: Symbol[] = [];

	/** Inject the session's global table (null for the global table itself) and optional debug sink. */
	constructor(
		private readonly filename: string | null,
		private readonly globalSymbolTable: SymbolTable | null,
		private readonly debug: ((message: string) => void) | null = null
	) {}

	/** Append a unique label, or add the canonical duplicate-label diagnostic. */
	addSymbol(token: Token, address: number, data: boolean, errors: ErrorList): void {
		const label = token.getValue();
		if (this.getSymbol(label) !== null) {
			errors.add(
				new ErrorMessage(
					token.getSourceMIPSprogram(),
					token.getSourceLine(),
					token.getStartPos(),
					`label "${label}" already defined`
				)
			);
		} else {
			this.table.push(new Symbol(label, address, data));
			this.debug?.(
				`The symbol ${label} with address ${address | 0} has been added to the ${this.filename} symbol table.`
			);
		}
	}

	/** Remove the matching label, doing nothing when it is absent. */
	removeSymbol(token: Token): void {
		const index = this.table.findIndex((symbol) => symbol.getName() === token.getValue());
		if (index >= 0) {
			this.table.splice(index, 1);
			this.debug?.(
				`The symbol ${token.getValue()} has been removed from the ${this.filename} symbol table.`
			);
		}
	}
	/** Return a label's signed address or NOT_FOUND. */
	getAddress(name: string): number {
		return this.getSymbol(name)?.getAddress() ?? SymbolTable.NOT_FOUND;
	}
	/** Search local labels first, then this session's global table. */
	getAddressLocalOrGlobal(name: string): number {
		const address = this.getAddress(name);
		return address === SymbolTable.NOT_FOUND
			? (this.globalSymbolTable?.getAddress(name) ?? SymbolTable.NOT_FOUND)
			: address;
	}
	/** Return the first case-sensitive label match, or null. */
	getSymbol(name: string): Symbol | null {
		return this.table.find((symbol) => symbol.getName() === name) ?? null;
	}
	/** Parse Java/MARS integer syntax and return the first symbol at that address. */
	getSymbolGivenAddress(value: string): Symbol | null {
		let address: number;
		try {
			address = Binary.stringToInt(value);
		} catch (error) {
			if (error instanceof NumberFormatException) return null;
			throw error;
		}
		return this.table.find((symbol) => symbol.getAddress() === address) ?? null;
	}
	/** Search this table then the injected global table for an address. */
	getSymbolGivenAddressLocalOrGlobal(value: string): Symbol | null {
		return (
			this.getSymbolGivenAddress(value) ??
			this.globalSymbolTable?.getSymbolGivenAddress(value) ??
			null
		);
	}
	/** Return a new list sharing this table's data-symbol objects. */
	getDataSymbols(): Symbol[] {
		return this.table.filter((symbol) => symbol.getType());
	}
	/** Return a new list sharing this table's text-symbol objects. */
	getTextSymbols(): Symbol[] {
		return this.table.filter((symbol) => !symbol.getType());
	}
	/** Return a new list sharing all symbol objects in insertion order. */
	getAllSymbols(): Symbol[] {
		return this.table.slice();
	}
	/** Return the number of labels. */
	getSize(): number {
		return this.table.length;
	}
	/** Replace the table with an empty list. */
	clear(): void {
		this.table = [];
	}
	/** Relocate every matching label; callers must use a distinct replacement address when matches exist. */
	fixSymbolTableAddress(originalAddress: number, replacementAddress: number): void {
		let label = this.getSymbolGivenAddress(String(originalAddress | 0));
		while (label !== null) {
			label.setAddress(replacementAddress);
			label = this.getSymbolGivenAddress(String(originalAddress | 0));
		}
	}
	/** Return the conventional global entry label. */
	static getStartLabel(): string {
		return 'main';
	}
}
