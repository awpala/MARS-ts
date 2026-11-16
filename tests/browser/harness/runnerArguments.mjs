// Value-taking options of the pinned Playwright test CLI. Discovery validates the original arguments first.
const requiredValues = new Set([
  '--add-reporter',
  '--browser',
  '--config',
  '-c',
  '--global-timeout',
  '--grep',
  '-g',
  '--grep-invert',
  '-G',
  '--last-failed-file',
  '--max-failures',
  '--output',
  '--project',
  '--repeat-each',
  '--reporter',
  '--retries',
  '--run-agents',
  '--shard',
  '--test-list',
  '--test-list-invert',
  '--timeout',
  '--trace',
  '--tsconfig',
  '--ui-host',
  '--ui-port',
  '--update-source-method',
  '--workers',
  '-j'
]);
const optionalValues = new Set([
  '--debug',
  '--only-changed',
  '--shuffle',
  '--update-snapshots',
  '-u'
]);

/**
 * Retain execution/reporting options, consuming each option's own value; frozen case lists replace project and file selection.
 * @param {readonly string[]} args Original, discovery-validated CLI arguments.
 * @returns {string[]} Options forwarded to each isolated group runner.
 */
export function runnerArguments(args) {
  const result = [];
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === '--') break;
    if (!argument.startsWith('-')) continue;
    const option = argument.split('=', 1)[0];
    const removed = option === '--project' || option === '--last-failed';
    if (!removed) result.push(argument);
    if (argument.includes('=')) continue;
    const takesValue =
      requiredValues.has(option) ||
      (optionalValues.has(option) &&
        args[index + 1] !== undefined &&
        !args[index + 1].startsWith('-'));
    if (takesValue) {
      const value = args[++index];
      if (!removed) result.push(value);
    }
  }
  return result;
}
