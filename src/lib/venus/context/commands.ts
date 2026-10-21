import { createContext } from 'svelte';
import type { Action } from '../utils/commands.js';

/** Desktop-owned command capabilities; consumers never own the editor or machine. */
export type DesktopCommands = {
  /** Read current enablement, tracking the provider's reactive session state. */
  isEnabled: (action: Action) => boolean;
  /** Execute a command through the provider, including menu dismissal and async work. */
  execute: (command: string) => void | Promise<void>;
  /** Read toggle state for a command, or undefined for a momentary action. */
  isPressed: (command: string) => boolean | undefined;
};

/** Install during desktop initialization; read in descendants. Missing providers throw. No global session state or teardown resources are stored here. */
export const [getDesktopCommands, setDesktopCommands] = createContext<DesktopCommands>();
