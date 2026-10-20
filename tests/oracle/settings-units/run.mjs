/** Capture/check canonical Settings defaults, persistence distinction, and notification counts. */
import { captureProbe } from '../units/run.mjs';
if (!['--check', '--update'].includes(process.argv[2])) throw new Error('Use --check or --update');
captureProbe({
	source: 'tests/oracle/settings-units/SettingsProbe.java',
	className: 'SettingsProbe',
	golden: 'tests/oracle/settings-units/golden.json',
	check: process.argv[2] === '--check',
	legacySources: [
		'mars/Globals.java',
		'mars/Settings.java',
		'Settings.properties',
		'Config.properties'
	]
});
