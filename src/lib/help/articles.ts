/**
 * Help menu catalog adapted from mars/venus/HelpHelpAction.java and help/*.html.
 * Copyright 2003–2013 Pete Sanderson and Kenneth Vollmar. MIT license; see MARSlicense.txt.
 */
import acknowledgements from './Acknowledgements.html?raw';
import exceptions from './ExceptionsHelp.html?raw';
import macros from './MacrosHelp.html?raw';
import debugging from './MarsHelpDebugging.html?raw';
import history from './MarsHelpHistory.html?raw';
import introduction from './MarsHelpIntro.html?raw';
import limitations from './MarsHelpLimits.html?raw';
import settings from './MarsHelpSettings.html?raw';
import tools from './MarsHelpTools.html?raw';
import syscalls from './SyscallHelp.html?raw';

/** Immutable menu metadata and trusted, bundled article content; never accepts user HTML. */
export type HelpArticle = {
	/** Stable desktop command and article identifier. */
	readonly id: string;
	/** Human-readable Help menu entry. */
	readonly label: string;
	/** Accessible dialog title. */
	readonly title: string;
	/** Authored HTML fragment, absent for the overview and About component content. */
	readonly html?: string;
};

/** All Help menu entries, including the existing F1 overview and About article. */
export const helpArticles: readonly HelpArticle[] = [
	{ id: 'help', label: 'Help', title: 'MARS Help' },
	{ id: 'about', label: 'About MARS', title: 'About MARS' },
	{ id: 'help-intro', label: 'Introduction', title: 'Introduction', html: introduction },
	{ id: 'help-debugging', label: 'Debugging', title: 'Interactive Debugging', html: debugging },
	{ id: 'help-settings', label: 'Settings', title: 'Configuration Settings', html: settings },
	{ id: 'help-syscalls', label: 'Syscalls', title: 'Syscalls', html: syscalls },
	{
		id: 'help-exceptions',
		label: 'Exception Handlers',
		title: 'Exception Handlers',
		html: exceptions
	},
	{ id: 'help-macros', label: 'Macros', title: 'Macros', html: macros },
	{ id: 'help-tools', label: 'Tools', title: 'Tools — Legacy Reference', html: tools },
	{
		id: 'help-limits',
		label: 'Limitations',
		title: 'Requirements and Limitations',
		html: limitations
	},
	{ id: 'help-history', label: 'Release History', title: 'Release History', html: history },
	{
		id: 'help-acknowledgements',
		label: 'Acknowledgements',
		title: 'Acknowledgements',
		html: acknowledgements
	}
];
