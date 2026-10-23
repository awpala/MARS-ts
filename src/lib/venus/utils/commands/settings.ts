/* Copyright (c) 2003-2013, Pete Sanderson and Kenneth Vollmar. MIT license.
 * Setting labels and descriptions derive from mars/venus/VenusUI.java. */
import { Settings } from '#lib/engine/Settings.js';
import type { ToolbarIconName } from '../../components/shell/ToolbarIcon.svelte';

/** Preference identity, label, and description of one engine setting shown in the Settings menu. */
export type EngineOption = {
  /** Canonical Settings.java identifier. */
  id: number;
  /** Visible label. */
  label: string;
  /** Legacy hover description. */
  description: string;
  /** True when changing it discards a loaded assembly; false when only host or later-run behavior changes. */
  invalidatesAssembly: boolean;
  /** Toolbar glyph for settings that also appear as a toolbar toggle; omitted for menu-only settings. */
  toolbarIcon?: ToolbarIconName;
};

/** Engine settings exposed by the desktop, in Settings menu order. */
export const engineOptions: readonly EngineOption[] = [
  {
    id: Settings.POPUP_SYSCALL_INPUT,
    label: 'Popup dialog for input syscalls',
    description:
      'If set, use popup dialog for input syscalls (5,6,7,8,12) instead of cursor in Run I/O window',
    invalidatesAssembly: false,
    toolbarIcon: 'input'
  },
  {
    id: Settings.PROGRAM_ARGUMENTS,
    label: 'Program arguments provided to MIPS program',
    description:
      'If set, program arguments for MIPS program can be entered in border of Text Segment window.',
    invalidatesAssembly: false,
    toolbarIcon: 'args'
  },
  {
    id: Settings.ASSEMBLE_ON_OPEN_ENABLED,
    label: 'Assemble file on open',
    description:
      'If set, a file will be automatically assembled as soon as it is opened.  File Open dialog will show most recently opened file.',
    invalidatesAssembly: false
  },
  {
    id: Settings.WARNINGS_ARE_ERRORS,
    label: 'Assembler warnings are considered errors',
    description:
      'If set, assembler warnings will be interpreted as errors and prevent successful assembly.',
    invalidatesAssembly: true
  },
  {
    id: Settings.START_AT_MAIN,
    label: 'Initialize Program Counter to global main if defined',
    description:
      "If set, assembler will initialize Program Counter to text address globally labeled 'main', if defined.",
    invalidatesAssembly: true
  },
  {
    id: Settings.EXTENDED_ASSEMBLER_ENABLED,
    label: 'Permit extended (pseudo) instructions and formats',
    description: 'If set, MIPS extended (pseudo) instructions are formats are permitted.',
    invalidatesAssembly: true
  },
  {
    id: Settings.DELAYED_BRANCHING_ENABLED,
    label: 'Delayed branching',
    description: 'If set, delayed branching will occur during MIPS execution.',
    invalidatesAssembly: true
  },
  {
    id: Settings.SELF_MODIFYING_CODE_ENABLED,
    label: 'Self-modifying code',
    description: 'If set, the MIPS program can write and branch to both text and data segments.',
    invalidatesAssembly: false
  }
];

/** Engine settings that appear only in the Settings menu, in menu order. */
export const menuEngineOptions: readonly EngineOption[] = engineOptions.filter(
  (option) => option.toolbarIcon === undefined
);

/** Look up an engine option by its Settings identifier. */
export function engineOption(id: number): EngineOption | undefined {
  return engineOptions.find((option) => option.id === id);
}

/** Browser-specific Settings entry that clears both consoles when Go starts a fresh run ([ADR 0008](../../../docs/adrs/0008-clear-outputs-on-go.md)). */
export const clearAllOutputsOnGoOption = {
  label: 'Clear all outputs on Go',
  description:
    'If set, clear Mars Messages and Run I/O when Go starts a fresh program run; resuming preserves output.'
};

/** Hover description of the Settings entry that opens the memory-layout dialog. */
export const memoryConfigurationDescription =
  'View and modify memory segment base addresses for simulated MIPS.';

/** Settings entries whose dialogs are not implemented. */
export const pendingSettings: readonly { label: string; description: string }[] = [
  {
    label: 'Exception Handler ...',
    description:
      'If set, the specified exception handler file will be included in all Assemble operations.'
  }
];

/** DisplayPreferences booleans that can back a display toggle. */
export type DisplayToggleKey = 'showLabels' | 'hexAddresses' | 'hexValues' | 'ascii';

/** Source of a display toggle's value: a display preference or an engine setting. */
export type ToggleTarget = { display: DisplayToggleKey } | { engine: number };

/** Presentation and target of one preference shown as a toolbar toggle and, usually, a Settings menu checkbox. */
export type ToggleSpec = {
  /** Stable SVG glyph and preference identity. */
  icon: ToolbarIconName;
  /** Accessible name and toolbar tooltip. */
  label: string;
  /** Settings menu label when it differs from the toolbar label. */
  menuLabel?: string;
  /** Legacy hover description shown in the Settings menu. */
  description?: string;
  /** Whether the Settings menu lists this toggle. */
  inSettings: boolean;
  /** The preference or engine setting this toggle reads and flips. */
  target: ToggleTarget;
};

function engineToggle(id: number, menuLabel?: string): ToggleSpec {
  const option = engineOption(id)!;
  return {
    icon: option.toolbarIcon!,
    label: option.label,
    menuLabel,
    description: option.description,
    inSettings: true,
    target: { engine: id }
  };
}

/** Toggles in toolbar order. The Settings menu lists those with `inSettings`, in this order, ahead of the other engine settings. */
export const toggleSpecs: readonly ToggleSpec[] = [
  {
    icon: 'labels',
    label: 'Show Labels Window',
    description: 'Toggle visibility of Labels window (symbol table) in the Execute tab',
    inSettings: true,
    target: { display: 'showLabels' }
  },
  engineToggle(Settings.PROGRAM_ARGUMENTS),
  engineToggle(
    Settings.POPUP_SYSCALL_INPUT,
    `${engineOption(Settings.POPUP_SYSCALL_INPUT)!.label} (5,6,7,8,12)`
  ),
  {
    icon: 'addresses',
    label: 'Addresses displayed in hexadecimal',
    description: 'Toggle between hexadecimal and decimal display of memory addresses',
    inSettings: true,
    target: { display: 'hexAddresses' }
  },
  {
    icon: 'values',
    label: 'Values displayed in hexadecimal',
    description: 'Toggle between hexadecimal and decimal display of memory/register values',
    inSettings: true,
    target: { display: 'hexValues' }
  },
  {
    icon: 'ascii',
    label: 'Display Data Segment values as ASCII',
    inSettings: false,
    target: { display: 'ascii' }
  }
];

/** A live engine-setting checkbox for the Settings menu: a setting that has no toolbar toggle. */
export type EngineMenuToggle = Pick<EngineOption, 'id' | 'label' | 'description'> & {
  /** Current value of the setting. */
  active: boolean;
  /** True when execution blocks changes. */
  disabled: boolean;
  /** Request that the owner invert the setting. */
  toggle: () => void;
};

/** A live preference toggle shared by Settings and toolbar rendering. */
export type DisplayToggle = Omit<ToggleSpec, 'target'> & {
  /** Current parent-owned value. */
  active: boolean;
  /** True when the parent disallows changes. */
  disabled: boolean;
  /** Request that the parent invert the preference. */
  toggle: () => void;
};
