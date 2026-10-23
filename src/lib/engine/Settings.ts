/* Copyright (c) 2003-2013, Pete Sanderson and Kenneth Vollmar. MIT license.
 * Ports boolean and engine string settings from mars/Settings.java; see MARSlicense.txt. */
/** Portable engine preference snapshot, independent of browser persistence. */
export interface SettingsState {
  /** Boolean values in canonical setting-ID order. */
  booleans: boolean[];
  /** String values in canonical setting-ID order. */
  strings: string[];
}

/** Host-owned persistence replaces Java Preferences; absent callbacks keep preferences in this session. */
export interface SettingsHost {
  /** Read a saved preference, or null to use canonical defaults. */
  readPreference?(key: string): string | null;
  /** Persist a setting changed through a persistent setter. */
  writePreference?(key: string, value: string): void;
  /** Evaluate the current program's undo-history availability. */
  backSteppingEnabled?(): boolean;
}
/** Session settings used by engine and Venus workflows; font/color/syntax-style objects belong to GUI adapters. */
export class Settings {
  /** Canonical Settings.java identifier for extended assembler enabled. */
  static readonly EXTENDED_ASSEMBLER_ENABLED = 0;
  /** Canonical Settings.java identifier for bare machine enabled. */
  static readonly BARE_MACHINE_ENABLED = 1;
  /** Canonical Settings.java identifier for assemble on open enabled. */
  static readonly ASSEMBLE_ON_OPEN_ENABLED = 2;
  /** Canonical Settings.java identifier for assemble all enabled. */
  static readonly ASSEMBLE_ALL_ENABLED = 3;
  /** Canonical Settings.java identifier for label window visibility. */
  static readonly LABEL_WINDOW_VISIBILITY = 4;
  /** Canonical Settings.java identifier for display addresses in hex. */
  static readonly DISPLAY_ADDRESSES_IN_HEX = 5;
  /** Canonical Settings.java identifier for display values in hex. */
  static readonly DISPLAY_VALUES_IN_HEX = 6;
  /** Canonical Settings.java identifier for exception handler enabled. */
  static readonly EXCEPTION_HANDLER_ENABLED = 7;
  /** Canonical Settings.java identifier for delayed branching enabled. */
  static readonly DELAYED_BRANCHING_ENABLED = 8;
  /** Canonical Settings.java identifier for editor line numbers displayed. */
  static readonly EDITOR_LINE_NUMBERS_DISPLAYED = 9;
  /** Canonical Settings.java identifier for warnings are errors. */
  static readonly WARNINGS_ARE_ERRORS = 10;
  /** Canonical Settings.java identifier for runtime program arguments. */
  static readonly PROGRAM_ARGUMENTS = 11;
  /** Canonical Settings.java identifier for data segment highlighting. */
  static readonly DATA_SEGMENT_HIGHLIGHTING = 12;
  /** Canonical Settings.java identifier for registers highlighting. */
  static readonly REGISTERS_HIGHLIGHTING = 13;
  /** Canonical Settings.java identifier for start at main. */
  static readonly START_AT_MAIN = 14;
  /** Canonical Settings.java identifier for editor current line highlighting. */
  static readonly EDITOR_CURRENT_LINE_HIGHLIGHTING = 15;
  /** Canonical Settings.java identifier for popup instruction guidance. */
  static readonly POPUP_INSTRUCTION_GUIDANCE = 16;
  /** Canonical Settings.java identifier for popup syscall input. */
  static readonly POPUP_SYSCALL_INPUT = 17;
  /** Canonical Settings.java identifier for generic text editor. */
  static readonly GENERIC_TEXT_EDITOR = 18;
  /** Canonical Settings.java identifier for auto indent. */
  static readonly AUTO_INDENT = 19;
  /** Canonical Settings.java identifier for self modifying code enabled. */
  static readonly SELF_MODIFYING_CODE_ENABLED = 20;
  /** Canonical Settings.java identifier for exception handler. */
  static readonly EXCEPTION_HANDLER = 0;
  /** Canonical Settings.java identifier for text column order. */
  static readonly TEXT_COLUMN_ORDER = 1;
  /** Canonical Settings.java identifier for label sort state. */
  static readonly LABEL_SORT_STATE = 2;
  /** Canonical Settings.java identifier for memory configuration. */
  static readonly MEMORY_CONFIGURATION = 3;
  /** Canonical Settings.java identifier for caret blink rate. */
  static readonly CARET_BLINK_RATE = 4;
  /** Canonical Settings.java identifier for editor tab size. */
  static readonly EDITOR_TAB_SIZE = 5;
  /** Canonical Settings.java identifier for editor popup prefix length. */
  static readonly EDITOR_POPUP_PREFIX_LENGTH = 6;
  private static readonly booleanKeys = [
    'ExtendedAssembler',
    'BareMachine',
    'AssembleOnOpen',
    'AssembleAll',
    'LabelWindowVisibility',
    'DisplayAddressesInHex',
    'DisplayValuesInHex',
    'LoadExceptionHandler',
    'DelayedBranching',
    'EditorLineNumbersDisplayed',
    'WarningsAreErrors',
    'ProgramArguments',
    'DataSegmentHighlighting',
    'RegistersHighlighting',
    'StartAtMain',
    'EditorCurrentLineHighlighting',
    'PopupInstructionGuidance',
    'PopupSyscallInput',
    'GenericTextEditor',
    'AutoIndent',
    'SelfModifyingCode'
  ];
  private static readonly defaultBooleans = [
    true,
    false,
    false,
    false,
    false,
    true,
    true,
    false,
    false,
    true,
    false,
    false,
    true,
    true,
    false,
    true,
    true,
    false,
    false,
    true,
    false
  ];
  private static readonly stringKeys = [
    'ExceptionHandler',
    'TextColumnOrder',
    'LabelSortState',
    'MemoryConfiguration',
    'CaretBlinkRate',
    'EditorTabSize',
    'EditorPopupPrefixLength'
  ];
  private static readonly defaultStrings = ['', '0 1 2 3 4', '0', '', '500', '8', '2'];
  /** Number of boolean settings in a captured state. */
  static readonly BOOLEAN_COUNT = Settings.booleanKeys.length;
  /** Number of string settings in a captured state. */
  static readonly STRING_COUNT = Settings.stringKeys.length;
  private booleans: boolean[] = [];
  private strings: string[] = [];
  private readonly observers = new Set<() => void>();
  /** Load the checked-in default settings and optional host preferences into this instance. */
  constructor(private readonly host: SettingsHost = {}) {
    this.reset();
  }
  /** Reload canonical defaults and the host preference store, matching Java reset's persistence behavior. */
  reset(): void {
    this.booleans = Settings.booleanKeys.map((key, i) => {
      const saved = this.host.readPreference?.(key)?.toLowerCase();
      // Preferences.getBoolean accepts only case-insensitive true/false; malformed values use the default.
      return saved === 'true' ? true : saved === 'false' ? false : Settings.defaultBooleans[i];
    });
    this.strings = Settings.stringKeys.map(
      (key, i) => this.host.readPreference?.(key) ?? Settings.defaultStrings[i]
    );
  }
  /** Subscribe to persistent boolean changes in Java Observable's reverse registration order; caller owns teardown. */
  subscribe(observer: () => void): () => void {
    this.observers.add(observer);
    return () => this.observers.delete(observer);
  }
  /** Capture engine preferences without browser persistence or observers. */
  captureState(): SettingsState {
    return { booleans: [...this.booleans], strings: [...this.strings] };
  }
  /** Restore a validated engine preference snapshot without changing persisted user defaults. */
  restoreState(state: SettingsState): void {
    if (
      !Array.isArray(state.booleans) ||
      state.booleans.length !== this.booleans.length ||
      !state.booleans.every((v) => typeof v === 'boolean') ||
      !Array.isArray(state.strings) ||
      state.strings.length !== this.strings.length ||
      !state.strings.every((v) => typeof v === 'string')
    )
      throw new TypeError('Invalid settings checkpoint');
    this.booleans = [...state.booleans];
    this.strings = [...state.strings];
  }
  /** Read a boolean by its canonical ID; invalid IDs throw. */
  getBooleanSetting(id: number): boolean {
    this.checkBoolean(id);
    return this.booleans[id];
  }
  /** Persist and notify only when a boolean changes. */
  setBooleanSetting(id: number, value: boolean): void {
    this.checkBoolean(id);
    if (this.booleans[id] !== value) {
      this.booleans[id] = value;
      this.host.writePreference?.(Settings.booleanKeys[id], String(value));
      for (const observer of [...this.observers].reverse()) observer();
    }
  }
  /** Change a boolean without persistence or notification, as in the canonical nonpersistent setter. */
  setBooleanSettingNonPersistent(id: number, value: boolean): void {
    this.checkBoolean(id);
    this.booleans[id] = value;
  }
  /** Whether the current program owns enabled undo history; never a persisted preference. */
  getBackSteppingEnabled(): boolean {
    return this.host.backSteppingEnabled?.() ?? false;
  }
  /** Return the current bare machine enabled setting. */
  getBareMachineEnabled(): boolean {
    return this.booleans[Settings.BARE_MACHINE_ENABLED];
  }
  /** Return the current extended assembler enabled setting. */
  getExtendedAssemblerEnabled(): boolean {
    return this.booleans[Settings.EXTENDED_ASSEMBLER_ENABLED];
  }
  /** Return the current assemble on open enabled setting. */
  getAssembleOnOpenEnabled(): boolean {
    return this.booleans[Settings.ASSEMBLE_ON_OPEN_ENABLED];
  }
  /** Return the current display addresses in hex setting. */
  getDisplayAddressesInHex(): boolean {
    return this.booleans[Settings.DISPLAY_ADDRESSES_IN_HEX];
  }
  /** Return the current display values in hex setting. */
  getDisplayValuesInHex(): boolean {
    return this.booleans[Settings.DISPLAY_VALUES_IN_HEX];
  }
  /** Return the current assemble all enabled setting. */
  getAssembleAllEnabled(): boolean {
    return this.booleans[Settings.ASSEMBLE_ALL_ENABLED];
  }
  /** Return the current exception handler enabled setting. */
  getExceptionHandlerEnabled(): boolean {
    return this.booleans[Settings.EXCEPTION_HANDLER_ENABLED];
  }
  /** Return the current delayed branching enabled setting. */
  getDelayedBranchingEnabled(): boolean {
    return this.booleans[Settings.DELAYED_BRANCHING_ENABLED];
  }
  /** Return the current label window visibility setting. */
  getLabelWindowVisibility(): boolean {
    return this.booleans[Settings.LABEL_WINDOW_VISIBILITY];
  }
  /** Return the current editor line numbers displayed setting. */
  getEditorLineNumbersDisplayed(): boolean {
    return this.booleans[Settings.EDITOR_LINE_NUMBERS_DISPLAYED];
  }
  /** Return the current warnings are errors setting. */
  getWarningsAreErrors(): boolean {
    return this.booleans[Settings.WARNINGS_ARE_ERRORS];
  }
  /** Return the current data segment highlighting setting. */
  getDataSegmentHighlighting(): boolean {
    return this.booleans[Settings.DATA_SEGMENT_HIGHLIGHTING];
  }
  /** Return the current registers highlighting setting. */
  getRegistersHighlighting(): boolean {
    return this.booleans[Settings.REGISTERS_HIGHLIGHTING];
  }
  /** Return the current start at main setting. */
  getStartAtMain(): boolean {
    return this.booleans[Settings.START_AT_MAIN];
  }
  /** Return the current exception handler setting. */
  getExceptionHandler(): string {
    return this.strings[Settings.EXCEPTION_HANDLER];
  }
  /** Return the current memory configuration setting. */
  getMemoryConfiguration(): string {
    return this.strings[Settings.MEMORY_CONFIGURATION];
  }
  /** Return the current label sort state setting. */
  getLabelSortState(): string {
    return this.strings[Settings.LABEL_SORT_STATE];
  }
  /** Persist the exception handler's virtual filename. */
  setExceptionHandler(filename: string): void {
    this.setString(Settings.EXCEPTION_HANDLER, filename);
  }
  /** Persist the selected memory-layout identifier; the owner applies the configuration change. */
  setMemoryConfiguration(name: string): void {
    this.setString(Settings.MEMORY_CONFIGURATION, name);
  }
  private setString(id: number, value: string): void {
    this.strings[id] = value;
    this.host.writePreference?.(Settings.stringKeys[id], value);
  }
  private checkBoolean(id: number): void {
    if (!Number.isInteger(id) || id < 0 || id >= this.booleans.length)
      throw new RangeError('Invalid boolean setting ID');
  }
}
