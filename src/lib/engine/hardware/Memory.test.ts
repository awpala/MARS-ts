import { expect, it } from 'vitest';
import golden from '../../../../tests/oracle/memory-units/golden.json';
import { Memory, type MemoryHost, type MemoryStatement } from './Memory.js';
import { MemoryConfigurations } from './MemoryConfigurations.js';

function doubleBits(value: number): string {
	const bits = new DataView(new ArrayBuffer(8));
	bits.setFloat64(0, value);
	return String(Number.isNaN(value) ? 0x7ff8000000000000n : bits.getBigInt64(0));
}
// This storage-only test double deliberately does not decode or execute instructions.
function statement(binary: number): MemoryStatement {
	return { getBinaryStatement: () => binary | 0 };
}

it('matches every Java Memory probe across layouts, endian modes, boundaries, heap, statements, and observers', () => {
	const expected = new Map(
		golden.stdout
			.trimEnd()
			.split('\n')
			.map((row) => {
				const [key, value] = row.split('\t');
				return [key, Buffer.from(value, 'base64').toString()];
			})
	);
	const visited = new Set<string>();
	const out = (key: string, value: unknown) => {
		visited.add(key);
		expect(String(value), key).toBe(expected.get(key));
	};
	const attempt = (key: string, operation: () => unknown) => {
		let result: unknown;
		try {
			result = operation();
		} catch (error) {
			if (!(error instanceof Error)) throw error;
			result = `!${error.name}:${error.message || 'null'}`;
		}
		out(key, result);
	};
	const configurations = new MemoryConfigurations();
	let selfModifying = false;
	const host: MemoryHost<MemoryStatement> = {
		decodeStatement: statement,
		isSelfModifyingCodeEnabled: () => selfModifying
	};
	const m = new Memory(host, configurations);
	const readStatement = (value: MemoryStatement | null) =>
		value === null ? 'null' : String(value.getBinaryStatement());
	for (const config of ['Default', 'CompactDataAtZero', 'CompactTextAtZero']) {
		configurations.setCurrentConfiguration(configurations.getConfigurationByName(config));
		m.clear();
		m.deleteObservers();
		m.setByteOrder(true);
		selfModifying = false;
		out(
			config + ':limits',
			[
				m.textBaseAddress,
				m.textLimitAddress,
				m.dataSegmentBaseAddress,
				m.dataSegmentLimitAddress,
				m.stackBaseAddress,
				m.stackLimitAddress,
				m.kernelTextBaseAddress,
				m.kernelTextLimitAddress,
				m.kernelDataBaseAddress,
				m.kernelDataSegmentLimitAddress,
				m.memoryMapBaseAddress,
				m.memoryMapLimitAddress,
				m.usingCompactMemoryConfiguration()
			].join(',')
		);
		const boundaries = [
			m.textBaseAddress - 1,
			m.textBaseAddress,
			m.textLimitAddress - 1,
			m.textLimitAddress,
			m.dataSegmentBaseAddress - 1,
			m.dataSegmentBaseAddress,
			m.dataSegmentLimitAddress - 1,
			m.dataSegmentLimitAddress,
			m.stackLimitAddress,
			m.stackLimitAddress + 1,
			m.stackBaseAddress,
			m.stackBaseAddress + 1,
			m.kernelTextBaseAddress,
			m.kernelTextLimitAddress,
			m.kernelDataBaseAddress,
			m.kernelDataSegmentLimitAddress,
			m.memoryMapBaseAddress,
			m.memoryMapLimitAddress - 1,
			m.memoryMapLimitAddress,
			-1
		].map((a) => a | 0);
		boundaries.forEach((a, i) => {
			const k = `${config}:bound:${i}`;
			out(
				k,
				[
					m.inTextSegment(a),
					m.inDataSegment(a),
					m.inKernelTextSegment(a),
					m.inKernelDataSegment(a),
					m.inMemoryMapSegment(a)
				].join(',')
			);
			attempt(k + ':read', () => m.get(a, 1));
			attempt(k + ':raw', () => m.getRawWordOrNull(a));
		});
		const bases = [
			m.dataSegmentBaseAddress,
			m.stackBaseAddress - 16,
			m.kernelDataBaseAddress,
			m.memoryMapBaseAddress
		];
		for (const little of [true, false]) {
			m.clear();
			m.setByteOrder(little);
			bases.forEach((b, segment) => {
				const k = `${config}:${little}:${segment}`;
				attempt(k + ':initial', () => m.getRawWordOrNull(b));
				attempt(k + ':setWord', () => m.setWord(b, 0x12345678));
				for (let j = 0; j < 4; j++) attempt(`${k}:byte:${j}`, () => m.getByte(b + j));
				attempt(k + ':word', () => m.getWord(b));
				attempt(k + ':raw', () => m.getRawWord(b));
				attempt(k + ':setHalf', () => m.setHalf(b + 2, 0xabcd));
				attempt(k + ':half', () => m.getHalf(b + 2));
				attempt(k + ':setByte', () => m.setByte(b + 1, 0x1ff));
				attempt(k + ':after', () => m.getWordNoNotify(b));
				attempt(k + ':unalignedSet', () => m.set(b + 3, 0x11223344, 4));
				attempt(k + ':unalignedGet', () => m.get(b + 3, 4));
				attempt(k + ':next', () => m.getWord(b + 4));
				attempt(k + ':setRaw', () => m.setRawWord(b, 0x01020304));
				attempt(k + ':rawAfter', () => m.getRawWord(b));
				attempt(k + ':wordAfterRaw', () => m.getWord(b));
				attempt(k + ':setDouble', () => doubleBits(m.setDouble(b + 8, -0)));
				attempt(k + ':doubleLow', () => m.getWord(b + 8));
				attempt(k + ':doubleHigh', () => m.getWord(b + 12));
				const bits = new DataView(new ArrayBuffer(8));
				bits.setBigInt64(0, 0x7ff123456789abcdn);
				attempt(k + ':nan', () => doubleBits(m.setDouble(b + 8, bits.getFloat64(0))));
				attempt(k + ':nanHigh', () => m.getWord(b + 12));
				attempt(k + ':badWord', () => m.getWord(b + 1));
				attempt(k + ':badHalf', () => m.getHalf(b + 1));
				attempt(k + ':badRaw', () => m.getRawWord(b + 1));
				attempt(k + ':badStoreWord', () => m.setWord(b + 1, 1));
				attempt(k + ':badStoreHalf', () => m.setHalf(b + 1, 1));
				attempt(k + ':badStoreRaw', () => m.setRawWord(b + 1, 1));
			});
		}
		m.clear();
		m.setByteOrder(true);
		for (const little of [true, false]) {
			bases.forEach((base, segment) => {
				m.clear();
				m.setByteOrder(little);
				const a = segment === 1 ? m.stackBaseAddress - 4094 : base + 4094;
				const k = `${config}:cross:${little}:${segment}`;
				attempt(k + ':write', () => m.set(a, 0x89abcdef, 4));
				attempt(k + ':read', () => m.get(a, 4));
				for (let j = 0; j < 4; j++) attempt(k + ':byte:' + j, () => m.getByte(a + j));
			});
		}
		m.clear();
		m.setByteOrder(true);
		const d = m.dataSegmentBaseAddress;
		attempt(config + ':block:write', () => m.setWord(d + 4092, 0x11223344));
		attempt(config + ':block:partialRead', () => m.get(d + 4094, 4));
		attempt(config + ':block:crossWrite', () => m.set(d + 4094, 0x55667788, 4));
		attempt(config + ':block:crossRead', () => m.get(d + 4094, 4));
		attempt(config + ':block:next', () => m.getRawWordOrNull(d + 4096));
		attempt(config + ':block:firstNull', () => m.getAddressOfFirstNull(d, d + 12288));
		const edge = m.dataSegmentLimitAddress - 2;
		attempt(config + ':edge:write', () => m.set(edge, 0x12345678, 4));
		attempt(config + ':edge:read', () => m.get(edge, 4));
		m.clear();
		for (const size of [0, 1, 2, 3, 4, 7, -1, 0x7fffffff]) {
			attempt(config + ':heap:' + size, () => m.allocateBytesFromHeap(size));
			out(config + ':heapAt:' + size, m.heapAddress);
		}
		m.clear();
		const capacity = m.dataSegmentLimitAddress - m.heapAddress;
		attempt(config + ':heap:capacity', () => m.allocateBytesFromHeap(capacity));
		m.clear();
		const t = m.textBaseAddress,
			kt = m.kernelTextBaseAddress;
		attempt(config + ':text:empty', () => readStatement(m.getStatement(t)));
		m.setStatement(t, statement(0x2408002a));
		m.setStatement(kt, statement(0));
		attempt(config + ':text:stored', () => readStatement(m.getStatementNoNotify(t)));
		attempt(config + ':text:dump', () => m.getRawWordOrNull(t));
		attempt(config + ':kernel:stored', () => readStatement(m.getStatement(kt)));
		m.setStatement(t, null);
		out(config + ':text:nullClears', readStatement(m.getStatementNoNotify(t)));
		m.setStatement(t, statement(0x2408002a));
		host.debug = () => {};
		let debugNullFailure = false;
		try {
			m.setStatement(t, null);
		} catch (error) {
			if (!(error instanceof TypeError)) throw error;
			debugNullFailure = true;
		} finally {
			host.debug = undefined;
		}
		out(config + ':text:debugNullFailure', debugNullFailure);
		out(config + ':text:debugNullUnchanged', readStatement(m.getStatementNoNotify(t)));
		attempt(config + ':text:readDisabled', () => m.getWord(t));
		attempt(config + ':text:writeDisabled', () => m.setWord(t, 0));
		attempt(config + ':kernel:read', () => m.getWord(kt));
		attempt(config + ':kernel:write', () => m.setWord(kt, 0));
		attempt(config + ':text:unaligned', () => readStatement(m.getStatement(t + 1)));
		attempt(config + ':text:outside', () => readStatement(m.getStatement(d)));
		attempt(config + ':text:storeOutside', () => {
			m.setStatement(d, statement(0));
			return 'ok';
		});
		selfModifying = true;
		attempt(config + ':text:writeEnabled', () => m.setRawWord(t, 0));
		attempt(config + ':text:readEnabled', () => m.getWord(t));
		attempt(config + ':text:byteWrite', () => m.setByte(t, 0x2408002a));
		attempt(config + ':text:byteRead', () => m.getByte(t));
		m.setWord(d, 0x2408002a);
		attempt(config + ':data:statement', () => readStatement(m.getStatement(d)));
		const notices: string[] = [];
		m.addObserver((n) => notices.push(String(n)), d);
		attempt(config + ':data:silentStatement', () => readStatement(m.getStatementNoNotify(d)));
		out(config + ':data:silentNotices', notices.join('|'));
		m.deleteObservers();
	}
	configurations.setCurrentConfiguration(configurations.getDefaultConfiguration());
	m.clear();
	m.setByteOrder(true);
	m.deleteObservers();
	for (const a of [0, 1, 2, 3, 4, -1, -2, -3, -4, 2147483647, -2147483648])
		out(
			'align:' + a,
			`${Memory.wordAligned(a)},${Memory.doublewordAligned(a)},${Memory.alignToWordBoundary(a)}`
		);
	const d = m.dataBaseAddress;
	const notices: string[] = [];
	const a = (n: { toString(): string }) => {
		notices.push('a:' + n);
	};
	const b = (n: { toString(): string }) => {
		notices.push('b:' + n);
	};
	m.addObserver(a, d);
	m.addObserver(b, d, d + 4);
	m.addObserver(a, d);
	out('observers:count', m.countObservers());
	m.setByte(d + 3, 99);
	m.getByte(d + 4);
	m.getWordNoNotify(d);
	m.getRawWordOrNull(d);
	out('observers:sequence', notices.join('|'));
	m.deleteObserver(a);
	out('observers:afterDelete', m.countObservers());
	notices.length = 0;
	m.getByte(d);
	out('observers:remaining', notices.join('|'));
	m.clear();
	notices.length = 0;
	m.getByte(d);
	out('observers:afterClear', notices.join('|'));
	m.deleteObservers();
	out('observers:empty', m.countObservers());
	m.addObserver(a);
	out('observers:all', m.countObservers());
	attempt('observers:badStart', () => {
		m.addObserver(a, d + 1, d + 4);
		return 'ok';
	});
	attempt('observers:badEnd', () => {
		m.addObserver(a, d, d + 1);
		return 'ok';
	});
	attempt('observers:crossSign', () => {
		m.addObserver(a, 0x7ffffffc, 0x80000000);
		return 'ok';
	});
	attempt('observers:reversed', () => {
		m.addObserver(a, d + 4, d);
		return 'ok';
	});
	attempt('observers:notify', () => {
		m.notifyObservers();
		return 'ok';
	});
	m.deleteObservers();
	m.addObserver(() => {
		m.addObserver(a, d);
	}, d);
	attempt('observers:mutating', () => m.getByte(d));
	m.deleteObservers();
	notices.length = 0;
	m.addObserver(a, d + 4);
	m.set(d + 3, 0x12345678, 4);
	out('observers:startOnly', notices.join('|'));
	m.deleteObservers();
	notices.length = 0;
	m.addObserver(a);
	m.setRawWord(-4, 1);
	m.getByte(-2);
	m.getStatement(m.kernelTextBaseAddress);
	out('observers:signedRanges', notices.join('|'));
	expect(golden.stderr).toBe('');
	expect(golden.status).toBe(0);
	expect(visited.size).toBe(expected.size);
});

it('isolates sessions, injects decoding/backstep/debug services, and releases observers', () => {
	const records: string[] = [];
	const decoded: [number, number][] = [];
	const host = {
		origin: 'mips' as const,
		enabled: true,
		getAccessOrigin() {
			return this.origin;
		},
		notificationsEnabled() {
			return this.enabled;
		},
		isSelfModifyingCodeEnabled: () => true,
		decodeStatement(binary: number, address: number) {
			decoded.push([binary, address]);
			return statement(binary);
		},
		addMemoryRestoreRawWord: (address: number, old: number) => {
			records.push(`raw:${address}:${old}`);
		},
		addMemoryRestoreWord: (address: number, old: number) => {
			records.push(`word:${address}:${old}`);
			return old;
		},
		addMemoryRestoreHalf: (address: number, old: number) => {
			records.push(`half:${address}:${old}`);
			return old;
		},
		addMemoryRestoreByte: (address: number, old: number) => {
			records.push(`byte:${address}:${old}`);
			return old;
		}
	};
	const one = new Memory(host);
	const two = new Memory({ decodeStatement: statement });
	const address = one.dataBaseAddress;
	const events: string[] = [];
	const release = one.addObserver((notice) => events.push(notice.getOrigin()));
	one.setWord(address, 42);
	one.setHalf(address, 99);
	one.setByte(address, 3);
	one.setRawWord(address, 7);
	expect(records).toEqual([
		`word:${address}:0`,
		`half:${address}:42`,
		`byte:${address}:99`,
		`raw:${address}:3`
	]);
	expect(two.getWord(address)).toBe(0);
	expect(events).toEqual(Array(4).fill('mips'));
	host.enabled = false;
	one.getWord(address);
	expect(events).toHaveLength(4);
	host.enabled = true;
	release();
	one.getWord(address);
	expect(events).toHaveLength(4);
	one.getStatementNoNotify(address);
	one.setWord(one.textBaseAddress, 0);
	expect(decoded).toEqual([
		[7, address],
		[0, one.textBaseAddress]
	]);
	one.setByteOrder(false);
	one.clear();
	expect(one.getByteOrder()).toBe(false);
	expect(one.getWord(address)).toBe(0);
});
