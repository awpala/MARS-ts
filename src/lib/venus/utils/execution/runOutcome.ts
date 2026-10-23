/* Copyright (c) 2003-2013, Pete Sanderson and Kenneth Vollmar. MIT license.
 * Completion messages derive from mars/venus/RunGoAction.java and RunStepAction.java. */
import type { MessageTab, RegisterBank } from '#lib/browser/DesktopSession.js';
import { Simulator } from '#lib/engine/simulator/Simulator.js';
import type { RunState } from '../../RunController.js';

/** Run commands that report an outcome after the controller settles. */
export type RunCommand = 'go' | 'step';

/** Console text and view changes that follow a settled Go or Step. */
export type RunOutcome = {
  /** Text appended to Mars Messages; empty when none. */
  messages: string;
  /** Text appended to Run I/O; empty when none. */
  runIO: string;
  /** Console tab to select, or undefined to leave the selection unchanged. */
  messageTab?: MessageTab;
  /** Register bank to select, or undefined to leave the selection unchanged. */
  registerTab?: RegisterBank;
};

/** Describe how a settled Go or Step ends, from the controller's final state; `filename` names the program in the pause notice. */
export function describeRunOutcome(
  command: RunCommand,
  result: RunState,
  filename: string
): RunOutcome {
  if (result.error) {
    const name = command === 'step' ? 'Step' : 'Go';
    return {
      messages: `${result.error.errors()?.generateErrorReport() ?? ''}\n${name}: execution terminated with errors.\n\n`,
      runIO: '',
      messageTab: 'Mars Messages',
      registerTab: 'Coproc 0'
    };
  }
  if (result.status === 'terminated') {
    if (command === 'step') {
      const cliff = result.reason === Simulator.CLIFF_TERMINATION;
      return {
        messages: `\nStep: execution ${cliff ? 'terminated due to null instruction.' : 'completed successfully.'}\n\n`,
        runIO: `\n-- program is finished running ${cliff ? '(dropped off bottom)' : ''} --\n\n`,
        messageTab: 'Run I/O'
      };
    }
    if (result.reason === Simulator.NORMAL_TERMINATION)
      return {
        messages: '\nGo: execution completed successfully.\n\n',
        runIO: '\n-- program is finished running --\n\n',
        messageTab: 'Run I/O'
      };
    if (result.reason === Simulator.CLIFF_TERMINATION)
      return {
        messages: '\nGo: execution terminated by null instruction.\n\n',
        runIO: '\n-- program is finished running (dropped off bottom) --\n\n',
        messageTab: 'Run I/O'
      };
    if (result.reason === Simulator.PAUSE_OR_STOP)
      return {
        messages: '\nGo: execution terminated by user.\n\n',
        runIO: '',
        messageTab: 'Mars Messages'
      };
  } else if (command === 'go' && result.status === 'paused') {
    return {
      messages: `Go: execution paused ${result.reason === Simulator.BREAKPOINT ? 'at breakpoint' : 'by user'}: ${filename}\n\n`,
      runIO: '',
      messageTab: 'Mars Messages'
    };
  }
  return { messages: '', runIO: '' };
}
