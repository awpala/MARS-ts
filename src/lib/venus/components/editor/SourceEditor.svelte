<script lang="ts">
  import { columnRanges } from '#lib/editor/columnSelection.js';
  import { highlightSource } from '#lib/editor/highlighting/MIPSTokenMarker.js';
  import { Token } from '#lib/editor/highlighting/Token.js';
  import { Directives } from '#lib/engine/assembler/directives/Directives.js';
  import editorPreset from '#lib/editor/editor-preset.json';
  import { SOURCE_EXTENSION_LABEL } from '#lib/browser/sources/SourceLibrary.js';
  import { getDesktop } from '../../context/desktop.js';
  import { useKeyboard } from '../../hooks/useKeyboard.js';
  import { clamp } from '../../utils/geometry/clamp.js';
  const desktop = getDesktop();
  const { workspace, simulation, display } = desktop;
  const current = $derived(workspace.current);
  const running = $derived(simulation.running);
  const showLines = $derived(display.showLines);
  const sourceText = $derived(workspace.editorText);
  const caretLine = $derived(
    sourceText
      .slice(
        0,
        workspace.selectionDirection === 'backward'
          ? workspace.selectionStart
          : workspace.selectionEnd
      )
      .split('\n').length
  );
  /** Instruction hover help is withheld while a dialog owns interaction. */
  const helpEnabled = $derived(!desktop.hasModal);
  /** Initialized instruction catalog, used only for hover descriptions. */
  const instructionSet = $derived(simulation.machine?.instructionSet);
  const paneId = $props.id();
  const syntaxStyles = editorPreset.syntaxStyles;
  // Buffer metadata and history can refresh without changing the syntax tokens.
  const highlighted = $derived(highlightSource(sourceText));
  let sourceHelp = $state.raw<{
    buffer: number;
    source: string;
    start: number;
    left: number;
    edge: number;
    above: boolean;
    entries: { example: string; description: string }[];
  } | null>(null);
  const visibleSourceHelp = $derived(
    sourceHelp && sourceHelp.buffer === current?.id && sourceHelp.source === sourceText
      ? sourceHelp
      : null
  );
  const rectangle = $derived(
    workspace.inputMode?.rectangular && workspace.selectionStart !== workspace.selectionEnd
      ? columnRanges(sourceText, workspace.selectionStart, workspace.selectionEnd)
      : []
  );
  const firstRectangleLine = $derived(
    rectangle.length ? sourceText.slice(0, rectangle[0].lineStart).split('\n').length - 1 : 0
  );
  function sourceKeydown(event: KeyboardEvent & { currentTarget: HTMLTextAreaElement }) {
    sourceHelp = null;
    const input = event.currentTarget;
    workspace.selection();
    workspace.inputMode?.keydown(event, input, () => workspace.editFromInput(input));
    workspace.selection();
  }
  function sourceBeforeInput(event: InputEvent & { currentTarget: HTMLTextAreaElement }) {
    const input = event.currentTarget;
    workspace.selection();
    workspace.inputMode?.beforeInput(event, input, () => workspace.editFromInput(input));
  }
  // The held key belongs to this editing surface. Mode and repeat count belong to the source tab.
  let backslashDown = false;
  function rectangleShortcut(event: KeyboardEvent) {
    if (event.code !== 'Backslash' && event.key !== '\\') return;
    const release = event.type === 'keyup';
    const sawPress = backslashDown;
    backslashDown = !release;
    const input = workspace.sourceInput;
    if (
      !input ||
      (event.target !== input && document.activeElement !== input) ||
      display.view !== 'Edit' ||
      desktop.hasModal ||
      !event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.metaKey ||
      event.isComposing ||
      event.getModifierState('AltGraph')
    )
      return;
    event.preventDefault();
    // Some hosts intercept the press and deliver only the release to Chrome.
    if (!event.repeat && !(release && sawPress)) workspace.inputMode?.toggleRectangle();
  }
  function sourceClipboard(event: ClipboardEvent & { currentTarget: HTMLTextAreaElement }) {
    const mode = workspace.inputMode;
    const input = event.currentTarget;
    if (
      !mode ||
      !(mode.repeating || (mode.rectangular && input.selectionStart !== input.selectionEnd)) ||
      !event.clipboardData
    )
      return;
    event.preventDefault();
    if (event.type !== 'paste')
      event.clipboardData.setData(
        'text/plain',
        mode.counted(mode.selected(input.value, input.selectionStart, input.selectionEnd))
      );
    if (!input.readOnly && event.type !== 'copy')
      workspace.replaceSelection(
        event.type === 'cut' ? '' : mode.counted(event.clipboardData.getData('text/plain')),
        input.selectionStart,
        input.selectionEnd
      );
  }
  function hoverSource(event: PointerEvent) {
    if (event.buttons & 1 && workspace.inputMode) workspace.inputMode.rectangular = event.ctrlKey;
    if (!current || !instructionSet || event.buttons) {
      sourceHelp = null;
      return;
    }
    // Hit-test the painted tokens under the native textarea, preserving its selection behavior.
    const surface = (event.currentTarget as HTMLTextAreaElement).parentElement;
    for (const node of surface?.querySelectorAll<HTMLElement>('[data-help-start]') ?? []) {
      const rect = node.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX >= rect.right ||
        event.clientY < rect.top ||
        event.clientY >= rect.bottom
      )
        continue;
      const start = Number(node.dataset.helpStart);
      if (visibleSourceHelp?.start === start) return;
      const span = highlighted.find((entry) => entry.start === start);
      if (!span) break;
      const directive = span.id === Token.KEYWORD2 ? Directives.matchDirective(span.text) : null;
      const entries = directive
        ? [{ example: directive.getName(), description: directive.getDescription() }]
        : (instructionSet.matchOperator(span.text) ?? []).map((instruction) => ({
            example: instruction.getExampleFormat(),
            description: instruction.getDescription()
          }));
      if (!entries.length) break;
      const above = window.innerHeight - rect.bottom < 260;
      sourceHelp = {
        buffer: current.id,
        source: sourceText,
        start,
        entries,
        above,
        left: clamp(rect.left, 8, window.innerWidth - 528),
        edge: above ? window.innerHeight - rect.top : rect.bottom
      };
      return;
    }
    sourceHelp = null;
  }
  function leaveSource(event: PointerEvent) {
    if (!(event.relatedTarget instanceof Element) || !event.relatedTarget.closest('.source-help'))
      sourceHelp = null;
  }
  function blurSource() {
    // Selecting reference text blurs the textarea; the popup's pointer exit owns dismissal there.
    if (!workspace.sourceInput?.parentElement?.querySelector('.source-help:hover'))
      sourceHelp = null;
  }

  /** Publish this surface's input and line geometry for workspace navigation, and withdraw both on removal. */
  function registerInput(element: HTMLTextAreaElement) {
    return workspace.registerSourceInput(element, (line, onlyIfHidden) => {
      const style = getComputedStyle(element);
      const height = Number.parseFloat(style.lineHeight);
      if (!Number.isFinite(height)) return;
      const top = Number.parseFloat(style.paddingTop) + (line - 1) * height;
      if (
        onlyIfHidden &&
        top >= element.scrollTop &&
        top + height <= element.scrollTop + element.clientHeight
      )
        return;
      element.scrollTop = Math.max(0, (line - 3) * height);
    });
  }
  useKeyboard(
    (event) => {
      if (event.key === 'Escape') sourceHelp = null;
    },
    { enabled: () => Boolean(visibleSourceHelp) }
  );
</script>

<svelte:window onkeydowncapture={rectangleShortcut} onkeyupcapture={rectangleShortcut} />

<!-- @component Highlighted source surface with view-owned DOM geometry, scrolling, and hover state. With no open source and an empty browser library, it shows how to create or import one. The workspace owns buffers and persisted selection/scroll positions; it borrows this view's textarea and line-reveal capability through a mounted registration and handles source mutations. -->
{#if current}<div
    class="editor-area"
    style:--editor-font={editorPreset.font}
    style:--editor-tab-size={editorPreset.tabSize}
    style:--editor-caret={`var(--theme-text, ${editorPreset.caretColor})`}
    style:--editor-selection={`var(--theme-selection, ${editorPreset.selectionBackground})`}
  >
    {#if showLines}<div class="line-numbers" aria-hidden="true" data-testid="editor-line-numbers">
        <pre style:transform={`translateY(${-workspace.sourceScrollTop}px)`}>{Array.from(
            { length: sourceText.split('\n').length },
            (_, i) => i + 1
          ).join('\n')}</pre>
      </div>{/if}
    <div class="source-surface" data-testid="editor-surface">
      {#if display.highlightCurrentLine}
        <div
          class="current-line"
          data-testid="editor-current-line"
          aria-hidden="true"
          style:--line-index={caretLine - 1}
          style:--scroll-top={`${workspace.sourceScrollTop}px`}
        ></div>
      {/if}
      {#if rectangle.length}
        <pre
          aria-hidden="true"
          class="syntax-layer column-layer"
          style:top={`calc(${firstRectangleLine} * 1lh)`}
          style:transform={`translate(${-workspace.sourceScrollLeft}px, ${-workspace.sourceScrollTop}px)`}>{#each rectangle as range (range.lineStart)}<span
              class="column-row"
              >{sourceText.slice(range.lineStart, range.start)}<mark
                data-testid="editor-selected-columns"
                >{sourceText.slice(range.start, range.end)}</mark
              ></span
            >{/each}</pre>
      {/if}
      <pre
        class="syntax-layer"
        data-testid="editor-syntax"
        aria-hidden="true"
        style:transform={`translate(${-workspace.sourceScrollLeft}px, ${-workspace.sourceScrollTop}px)`}>{#each highlighted as span (span.start)}<span
            data-token={span.id}
            data-help-start={span.id === Token.KEYWORD1 || span.id === Token.KEYWORD2
              ? span.start
              : undefined}
            style:color={`var(--theme-syntax-${span.id}, ${syntaxStyles[span.id].color})`}
            style:font-style={syntaxStyles[span.id].italic ? 'italic' : 'normal'}
            style:font-weight={syntaxStyles[span.id].bold ? 'bold' : 'normal'}>{span.text}</span
          >{/each}&#10;</pre>
      <textarea
        data-testid="source-input"
        {@attach registerInput}
        aria-label={`Source ${current.name}`}
        aria-describedby={visibleSourceHelp ? `${paneId}-source-help` : undefined}
        value={sourceText}
        readonly={running || current.readOnly}
        style:cursor={visibleSourceHelp && helpEnabled ? 'pointer' : 'text'}
        class={{
          'column-selection': rectangle.length > 0,
          overwriting: workspace.inputMode?.overwrite
        }}
        oninput={(event) => workspace.editFromInput(event.currentTarget)}
        onbeforeinput={sourceBeforeInput}
        oncut={sourceClipboard}
        oncopy={sourceClipboard}
        onpaste={sourceClipboard}
        onfocus={workspace.selection}
        onclick={workspace.selection}
        onpointermove={hoverSource}
        onpointerleave={leaveSource}
        onpointerdown={(event) => {
          sourceHelp = null;
          if (workspace.inputMode && event.button === 0)
            workspace.inputMode.rectangular = event.ctrlKey;
        }}
        onblur={blurSource}
        onkeydown={sourceKeydown}
        onkeyup={workspace.selection}
        onselect={workspace.selection}
        onscroll={(event) => {
          sourceHelp = null;
          workspace.sourceScrollTop = event.currentTarget.scrollTop;
          workspace.sourceScrollLeft = event.currentTarget.scrollLeft;
        }}
        spellcheck="false"
        autocapitalize="off"
        autocomplete="off"
        wrap="off"></textarea>
      {#if visibleSourceHelp && helpEnabled}
        <div
          id={`${paneId}-source-help`}
          class="source-help popup-surface"
          role="tooltip"
          style:left={`${visibleSourceHelp.left}px`}
          style:top={visibleSourceHelp.above ? undefined : `${visibleSourceHelp.edge}px`}
          style:bottom={visibleSourceHelp.above ? `${visibleSourceHelp.edge}px` : undefined}
          onpointerleave={() => (sourceHelp = null)}
        >
          {#each visibleSourceHelp.entries as entry (entry.example)}
            <p><code>{entry.example}</code><br />{entry.description}</p>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{:else}<div class="empty-editor">
    {#if !workspace.libraryFiles.length}
      <p class="empty-library">
        No source files are saved in this browser yet. Use File → New (Alt/Option+N) to create one,
        or File → Import File(s) ... to add {SOURCE_EXTENSION_LABEL} files, or ZIP archives of them, from
        your computer.
      </p>
    {/if}
  </div>{/if}

<style>
  .source-surface {
    position: relative;
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    background: var(--theme-canvas, white);
  }
  .current-line {
    position: absolute;
    left: 0;
    right: 0;
    top: calc(5px + var(--line-index) * 1lh - var(--scroll-top));
    height: 1lh;
    font: var(--editor-font);
    background: color-mix(in srgb, var(--theme-text, #17202b) 10%, var(--theme-canvas, white));
    pointer-events: none;
  }
  .syntax-layer {
    position: absolute;
    top: 0;
    left: 0;
    margin: 0;
    padding: 5px 8px;
    pointer-events: none;
    white-space: pre;
    font: var(--editor-font);
    tab-size: var(--editor-tab-size);
    font-variant-ligatures: none;
  }
  .source-surface textarea {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    background: transparent;
    color: transparent;
    caret-color: var(--editor-caret);
    -webkit-text-fill-color: transparent;
    font-variant-ligatures: none;
  }
  .source-surface textarea.overwriting {
    caret-shape: underscore;
  }
  .source-surface textarea::selection {
    background: var(--editor-selection);
  }
  .column-layer {
    color: transparent;
  }
  .column-row {
    display: block;
    min-height: 1lh;
  }
  .column-layer mark {
    color: transparent;
    background: var(--editor-selection);
  }
  .source-surface textarea.column-selection::selection {
    background: transparent;
  }
  .source-help {
    cursor: text;
    user-select: text;
    position: fixed;
    z-index: 30;
    width: max-content;
    max-width: min(520px, calc(100vw - 16px));
    max-height: min(240px, 40vh);
    overflow: auto;
  }
  .source-help p + p {
    margin-top: 7px;
  }
  .source-help code {
    font-weight: bold;
  }
  @media (forced-colors: active) {
    .syntax-layer {
      display: none;
    }
    /* Windows contrast themes override native ::selection colors. Paint the same column
       ranges above the native editor with the user's system highlight and text colors. */
    .column-layer {
      display: block;
      z-index: 1;
      forced-color-adjust: none;
    }
    .column-layer mark {
      background: Highlight;
      color: HighlightText;
    }
    .source-surface textarea.column-selection {
      forced-color-adjust: none;
      background: Canvas;
    }
    .source-surface textarea.column-selection::selection {
      background: transparent;
      color: CanvasText;
    }
    .source-surface textarea {
      color: CanvasText;
      -webkit-text-fill-color: CanvasText;
      caret-color: CanvasText;
    }
  }
  .editor-area {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
  .line-numbers {
    overflow: hidden;
    width: 45px;
    flex-shrink: 0;
    background: var(--theme-gutter, #f1f1f1);
    border-right: 1px solid var(--theme-border, #ddd);
    text-align: right;
    padding: 5px 6px 5px 0;
    color: var(--theme-muted, #777);
  }
  .line-numbers pre,
  .editor-area textarea {
    font: var(--editor-font);
    tab-size: var(--editor-tab-size);
  }
  .editor-area textarea {
    flex: 1;
    min-width: 0;
    resize: none;
    padding: 5px 8px;
    border: 0;
    outline-offset: -2px;
    white-space: pre;
  }
  .empty-editor {
    flex: 1;
    background: var(--theme-surface, #f7f7f7);
  }
  .empty-library {
    max-width: 60ch;
    margin: 24px auto;
    padding: 0 16px;
    text-align: center;
    color: var(--theme-muted, #4b5563);
  }

  p {
    margin: 8px 0;
  }
</style>
