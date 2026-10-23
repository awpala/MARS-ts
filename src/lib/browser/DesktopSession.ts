import type { Editor } from '#lib/editor/Editor.js';
import { isRunCheckpoint, type RunCheckpoint } from '#lib/venus/RunCheckpoint.js';

/** Versioned browser-local recovery record, independent of committed source files. */
export const DESKTOP_SESSION_STORAGE_KEY = 'mars-ts:desktop-session:v1';

/** Primary workspaces, in tab order. */
export const MAIN_VIEWS = ['Edit', 'Execute'] as const;
/** Register banks, in tab order. */
export const REGISTER_BANKS = ['Registers', 'Coproc 1', 'Coproc 0'] as const;
/** Message consoles, in tab order. */
export const MESSAGE_TABS = ['Mars Messages', 'Run I/O'] as const;
/** Ranges the Data Segment selector can show. */
export const MEMORY_SEGMENTS = [
  'data',
  'extern',
  'heap',
  'gp',
  'sp',
  'text',
  'kernel',
  'mmio'
] as const;

/** Selected primary workspace. */
export type MainView = (typeof MAIN_VIEWS)[number];
/** Selected register bank. */
export type RegisterBank = (typeof REGISTER_BANKS)[number];
/** Selected message console. */
export type MessageTab = (typeof MESSAGE_TABS)[number];
/** Selected Data Segment range. */
export type MemorySegment = (typeof MEMORY_SEGMENTS)[number];

/** Identity of one selected label within its loaded program's symbol tables. */
export interface SavedLabelSelection {
  /** Owning source filename; null identifies the global symbol table. */
  filename: string | null;
  /** Exact case-sensitive label name, distinguishing aliases at the same address. */
  name: string;
  /** Signed address captured with the loaded assembly. */
  address: number;
}

/** Stable program plus captured source dependencies; independent of the current Edit tab. */
export interface SavedExecution {
  /** Exact idle hardware and bounded debugger history. */
  machine: RunCheckpoint;
  /** Original virtual source texts, including explicit includes. */
  sources: Record<string, string>;
  /** Selected label for this program; absent in older recovery records, or null when unselected. */
  labelSelection?: SavedLabelSelection | null;
}

/** Tabbed Help browser presentation; IDs are opaque here and fall back to the overview when unknown. */
export interface SavedHelpBrowser {
  /** Whether the tabbed Help browser was open. */
  open: boolean;
  /** Selected top-level tab ID. */
  tab: string;
  /** Selected nested article ID per top-level tab ID. */
  articles: Record<string, string>;
}

/** Restorable desktop presentation and last stable execution; no live promises, timers, or dialogs other than the Help browser. */
export interface DesktopSession {
  /** Argument draft for the next initial Go/Step; absent in older records, defaulting to empty. */
  programArguments?: string;
  /** Selected primary workspace. */
  view: MainView;
  /** Selected register bank. */
  registerTab: RegisterBank;
  /** Selected message console. */
  messageTab: MessageTab;
  /** Help browser visibility and selection; absent in older records, leaving Help closed on its overview. */
  help?: SavedHelpBrowser;
  /** Undo/redo branches matched to recovered source identity and contents. */
  editHistory: ReturnType<Editor['captureHistory']>;
  /** Data Segment range and aligned relative page offset. */
  dataView: {
    /** Named memory range used by the Data Segment selector. */
    segment: MemorySegment;
    /** Signed aligned byte offset relative to that range's base. */
    pageOffset: number;
  };
  /** Current source identity anchoring caret recovery. */
  source: string | null;
  /** Selected source range, clamped when restored. */
  selection: [number, number];
  /** Source viewport offsets in pixels. */
  scroll: [number, number];
  /** Configured instruction breakpoints. */
  breakpoints: number[];
  /** Whether configured breakpoints are active. */
  breakpointsEnabled: boolean;
  /** Retained assembler/debugger console. */
  messages: string;
  /** Retained program console, captured with stable execution. */
  runIO: string;
  /** Last stable program, or null after invalidation or failed assembly. */
  execution: SavedExecution | null;
  /** Preserve a visible assembly error even without a loaded program. */
  unloadedError: boolean;
}

function isLabelSelection(value: unknown): value is SavedLabelSelection {
  if (!value || typeof value !== 'object') return false;
  const selection = value as SavedLabelSelection;
  return (
    (selection.filename === null || typeof selection.filename === 'string') &&
    typeof selection.name === 'string' &&
    selection.name.length > 0 &&
    typeof selection.address === 'number' &&
    (selection.address | 0) === selection.address
  );
}

/** Validate recovery before it can affect the desktop or allocate machine blocks. */
export function isDesktopSession(value: unknown): value is DesktopSession {
  if (!value || typeof value !== 'object') return false;
  const s = value as DesktopSession;
  const pair = (v: unknown) =>
    Array.isArray(v) && v.length === 2 && v.every((n) => Number.isInteger(n) && n >= 0);
  return (
    (s.programArguments === undefined || typeof s.programArguments === 'string') &&
    MAIN_VIEWS.includes(s.view) &&
    REGISTER_BANKS.includes(s.registerTab) &&
    MESSAGE_TABS.includes(s.messageTab) &&
    (s.help === undefined ||
      (!!s.help &&
        typeof s.help.open === 'boolean' &&
        typeof s.help.tab === 'string' &&
        !!s.help.articles &&
        typeof s.help.articles === 'object' &&
        !Array.isArray(s.help.articles) &&
        Object.values(s.help.articles).every((article) => typeof article === 'string'))) &&
    Array.isArray(s.editHistory) &&
    s.editHistory.every(
      (r) =>
        !!r &&
        typeof r.name === 'string' &&
        typeof r.text === 'string' &&
        Array.isArray(r.undo) &&
        r.undo.every((t) => typeof t === 'string') &&
        Array.isArray(r.redo) &&
        r.redo.every((t) => typeof t === 'string')
    ) &&
    !!s.dataView &&
    MEMORY_SEGMENTS.includes(s.dataView.segment) &&
    Number.isInteger(s.dataView.pageOffset) &&
    (s.dataView.pageOffset | 0) === s.dataView.pageOffset &&
    s.dataView.pageOffset % 4 === 0 &&
    (s.source === null || typeof s.source === 'string') &&
    pair(s.selection) &&
    pair(s.scroll) &&
    Array.isArray(s.breakpoints) &&
    s.breakpoints.every((n) => typeof n === 'number' && (n | 0) === n) &&
    typeof s.breakpointsEnabled === 'boolean' &&
    typeof s.messages === 'string' &&
    typeof s.runIO === 'string' &&
    typeof s.unloadedError === 'boolean' &&
    (s.execution === null ||
      (!!s.execution &&
        isRunCheckpoint(s.execution.machine) &&
        (s.execution.labelSelection === undefined ||
          s.execution.labelSelection === null ||
          isLabelSelection(s.execution.labelSelection)) &&
        !!s.execution.sources &&
        typeof s.execution.sources === 'object' &&
        !Array.isArray(s.execution.sources) &&
        Object.values(s.execution.sources).every((source) => typeof source === 'string') &&
        Object.hasOwn(s.execution.sources, s.execution.machine.filename)))
  );
}

/** Read validated browser recovery; malformed or unavailable storage leaves normal initialization usable. */
export function loadDesktopSession(): DesktopSession | undefined {
  try {
    const raw = localStorage.getItem(DESKTOP_SESSION_STORAGE_KEY);
    if (raw === null) return;
    const value: unknown = JSON.parse(raw);
    return isDesktopSession(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

/** Atomically replace a validated recovery record; report quota/access failures to the desktop. */
export function saveDesktopSession(session: DesktopSession): void {
  if (!isDesktopSession(session)) throw new TypeError('Invalid desktop recovery state');
  localStorage.setItem(DESKTOP_SESSION_STORAGE_KEY, JSON.stringify(session));
}
