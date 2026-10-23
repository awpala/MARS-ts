import { createContext } from 'svelte';
import type { Action } from '../utils/commands/actions.js';
import type { DisplayToggle, EngineMenuToggle } from '../utils/commands/settings.js';

/** Desktop-owned command capabilities; consumers never own the editor or machine. */
export type DesktopCommands = {
  /** Read current enablement, tracking the provider's reactive session state. */
  isEnabled: (action: Action) => boolean;
  /** Execute a command through the provider, including menu dismissal and async work. */
  execute: (command: string) => void | Promise<void>;
  /** Read toggle state for a command, or undefined for a momentary action. */
  isPressed: (command: string) => boolean | undefined;
  /** Read the live preference toggles shared by the toolbar and the Settings menu. */
  displayToggles: () => readonly DisplayToggle[];
  /** Read the live engine-setting checkboxes that only the Settings menu offers. */
  engineToggles: () => readonly EngineMenuToggle[];
};

/** Install during desktop initialization; read in descendants. Missing providers throw. No global session state or teardown resources are stored here. */
export const [getDesktopCommands, setDesktopCommands] = createContext<DesktopCommands>();
