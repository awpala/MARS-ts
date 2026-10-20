import { Binary } from '#lib/engine/formatting/Binary.js';

/** Format a machine word using the selected UI base; decimal addresses use unsigned=true, while register/data values remain signed. No machine state is read or changed. */
export function formatInteger(value: number, hexadecimal: boolean, unsigned = false): string {
	return hexadecimal ? Binary.intToHexString(value) : String(unsigned ? value >>> 0 : value);
}

/** Commit a focused numeric cell with Enter by blurring it, allowing its existing change handler to validate and write the value. */
export function commitOnEnter(event: KeyboardEvent): void {
	if (event.key === 'Enter' && event.currentTarget instanceof HTMLInputElement)
		event.currentTarget.blur();
}
