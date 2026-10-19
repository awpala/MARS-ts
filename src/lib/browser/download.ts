/** Initiates a source download in this tab, then releases its temporary URL. Does not overwrite an opened native file. */
export function downloadSource(name: string, source: string): void {
	const url = URL.createObjectURL(new Blob([source], { type: 'text/plain;charset=utf-8' }));
	const link = document.createElement('a');
	link.href = url;
	link.download = name;
	document.body.append(link);
	try {
		link.click();
	} finally {
		link.remove();
		URL.revokeObjectURL(url);
	}
}
