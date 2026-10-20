import { loadPaneLayout, savePaneLayout } from '#lib/browser/PaneLayout.js';
import { loadDisplaySettings, saveDisplaySettings } from '#lib/browser/DisplaySettings.js';
/** Per-desktop display selection, preferences, and measured pane geometry. Storage is accessed only by explicit browser lifecycle calls. */
export class DisplayPreferences {
	/** Selected main pane; Edit by default. */
	view = $state('Edit');
	/** Selected register bank; Registers by default. */
	registerTab = $state('Registers');
	/** Whether Execute shows the Labels pane. */
	showLabels = $state(false);
	/** Include data labels in the Labels pane. */
	showDataLabels = $state(true);
	/** Include text labels in the Labels pane. */
	showTextLabels = $state(true);
	/** Legacy eight-state label sorting selection. */
	labelSortState = $state(0);
	/** Whether the source editor shows line numbers. */
	showLines = $state(true);
	/** Whether memory values display as ASCII. */
	ascii = $state(false);
	/** Whether register and memory values display in hexadecimal. */
	hexValues = $state(true);
	/** Whether addresses display in hexadecimal. */
	hexAddresses = $state(true);
	/** Legacy run-speed slider position from zero through forty. */
	speed = $state(40);
	/** Measured available width supplied by the workspace element. */
	workspaceWidth = $state(1000);
	/** Requested register pane width in pixels. */
	registerWidth = $state(310);
	/** Measured height of the left pane container. */
	leftPaneHeight = $state(700);
	/** Requested editor fraction of the left pane height. */
	editorFraction = $state(0.75);
	/** Largest editor height retaining usable messages. */
	maxEditorHeight = $derived(Math.max(150, this.leftPaneHeight - 85));
	/** Clamped editor height derived from its container and saved fraction. */
	displayedEditorHeight = $derived(
		Math.max(
			150,
			Math.min(this.maxEditorHeight, Math.round(this.leftPaneHeight * this.editorFraction))
		)
	);
	/** Largest register width retaining a usable source pane. */
	maxRegisterWidth = $derived(Math.max(260, this.workspaceWidth - 315));
	/** Register width clamped to current geometry. */
	displayedRegisterWidth = $derived(Math.min(this.registerWidth, this.maxRegisterWidth));
	/** Restore browser preferences and return the saved Auto Save choice to its workspace owner. */
	restore(): boolean {
		const layout = loadPaneLayout();
		if (layout) {
			this.registerWidth = layout.registerWidth;
			this.editorFraction = layout.editorFraction;
		}
		const settings = loadDisplaySettings();
		if (!settings) return false;
		this.ascii = settings.ascii;
		this.showLabels = settings.showLabels;
		this.showDataLabels = settings.showDataLabels;
		this.showTextLabels = settings.showTextLabels;
		this.labelSortState = settings.labelSortState;
		this.showLines = settings.showLines;
		this.hexValues = settings.hexValues;
		this.hexAddresses = settings.hexAddresses;
		this.speed = settings.speed;
		return settings.autoSave;
	}
	/** Persist the display record, including the workspace owner's Auto Save choice. */
	persist(autoSave: boolean): void {
		saveDisplaySettings({
			autoSave,
			ascii: this.ascii,
			showLabels: this.showLabels,
			showDataLabels: this.showDataLabels,
			showTextLabels: this.showTextLabels,
			labelSortState: this.labelSortState,
			showLines: this.showLines,
			hexValues: this.hexValues,
			hexAddresses: this.hexAddresses,
			speed: this.speed
		});
	}
	/** Persist committed divider geometry through the validated layout adapter. */
	persistLayout = (): void => {
		savePaneLayout({
			registerWidth: this.displayedRegisterWidth,
			editorFraction: this.editorFraction
		});
	};
	/** Update the editor fraction from an interactive pixel size. */
	setEditorHeight = (height: number) => {
		this.editorFraction =
			Math.max(150, Math.min(this.maxEditorHeight, height)) / Math.max(1, this.leftPaneHeight);
	};
}
