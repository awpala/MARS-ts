import { helpArticles, type HelpArticleId } from '#lib/help/articles.js';

/** Commands whose buffer, clipboard, and file-dialog workflows belong to SourceWorkspace. */
export type WorkspaceCommand =
  | 'new'
  | 'open'
  | 'autoSave'
  | 'close'
  | 'closeAll'
  | 'save'
  | 'saveAs'
  | 'saveAll'
  | 'undo'
  | 'redo'
  | 'cut'
  | 'copy'
  | 'paste'
  | 'selectAll'
  | 'find';

/** Commands dispatched exclusively to the simulation owner. */
export type SimulationCommand =
  | 'assemble'
  | 'go'
  | 'step'
  | 'backstep'
  | 'pause'
  | 'stop'
  | 'reset'
  | 'clearBreakpoints'
  | 'toggleBreakpoints';

/** Browser file-transfer capabilities registered by mounted behavior components. */
export type FileTransferCommand = 'import' | 'export' | 'exportAll' | 'importMars' | 'exportMars';

/** Every executable desktop command; adding one requires updating the exhaustive owner dispatch. */
export type Command =
  | WorkspaceCommand
  | SimulationCommand
  | FileTransferCommand
  | HelpArticleId
  | 'clearOutput'
  | 'clearAllOutput'
  | 'memoryConfiguration'
  | 'exceptionHandler'
  | 'dump';

/** Narrow a known desktop command to an article from the bundled Help catalog. */
export function isHelpCommand(command: Command): command is HelpArticleId {
  return helpArticles.some((article) => article.id === command);
}

/** Fail closed for an impossible command, including malformed calls from untyped JavaScript. */
export function unhandledCommand(command: never): never {
  throw new Error(`Unknown command: ${String(command)}`);
}
