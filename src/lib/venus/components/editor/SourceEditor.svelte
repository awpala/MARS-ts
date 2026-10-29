<script lang="ts">
  import { highlightSource } from '#lib/editor/highlighting/MIPSTokenMarker.js';
  import { Token } from '#lib/editor/highlighting/Token.js';
  import { Directives } from '#lib/engine/assembler/directives/Directives.js';
  import editorPreset from '#lib/editor/editor-preset.json';
  import { SOURCE_EXTENSION_LABEL } from '#lib/browser/SourceLibrary.js';
  import { getDesktop } from '../../context/desktop.js';
  import { useKeyboard } from '../../hooks/useKeyboard.js';
  import { clamp } from '../../utils/geometry/clamp.js';
  const desktop = getDesktop();
  const { workspace, simulation, display } = desktop;
  const current = $derived(workspace.current);
  const running = $derived(simulation.running);
  const showLines = $derived(display.showLines);
  /** Instruction hover help is withheld while a dialog owns interaction. */
  const helpEnabled = $derived(!desktop.hasModal);
  /** Initialized instruction catalog, used only for hover descriptions. */
  const instructionSet = $derived(simulation.machine?.instructionSet);
  const paneId = $props.id();
  const syntaxStyles = editorPreset.syntaxStyles;
  const highlighted = $derived(highlightSource(current?.text ?? ''));
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
    sourceHelp && sourceHelp.buffer === current?.id && sourceHelp.source === current.text
      ? sourceHelp
      : null
  );
  function sourceKeydown(event: KeyboardEvent) {
    sourceHelp = null;
    if (running || current?.readOnly) return;
    // JEditTextArea only intercepts unmodified Tab; insert_tab replaces the selection
    // with one literal tab. Shift+Tab remains available for keyboard focus traversal.
    if (event.key !== 'Tab' || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey)
      return;
    const input = event.currentTarget;
    if (!(input instanceof HTMLTextAreaElement)) return;
    event.preventDefault();
    input.setRangeText('\t', input.selectionStart, input.selectionEnd, 'end');
    workspace.edit(input.value);
    workspace.selection();
  }
  function hoverSource(event: PointerEvent) {
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
        source: current.text,
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

  /** Publish the mounted textarea to the workspace for its editor commands, and withdraw it on removal. */
  function registerInput(element: HTMLTextAreaElement) {
    workspace.sourceInput = element;
    return () => {
      workspace.sourceInput = undefined;
    };
  }
  useKeyboard(
    (event) => {
      if (event.key === 'Escape') sourceHelp = null;
    },
    { enabled: () => Boolean(visibleSourceHelp) }
  );
</script>

<!-- @component Highlighted source surface with local scrolling and hover state. With no open source and an empty browser library, it shows how to create or import one. The source workspace owns the buffer, selection, scroll position, and the textarea handle its editor commands use; this view publishes the handle while mounted and delegates every mutation to the workspace. -->
{#if current}<div
    class="editor-area"
    style:--editor-font={editorPreset.font}
    style:--editor-tab-size={editorPreset.tabSize}
    style:--editor-caret={`var(--theme-text, ${editorPreset.caretColor})`}
    style:--editor-selection={`var(--theme-selection, ${editorPreset.selectionBackground})`}
  >
    {#if showLines}<div class="line-numbers" aria-hidden="true">
        <pre style:transform={`translateY(${-workspace.sourceScrollTop}px)`}>{Array.from(
            { length: current.text.split('\n').length },
            (_, i) => i + 1
          ).join('\n')}</pre>
      </div>{/if}
    <div class="source-surface">
      <pre
        class="syntax-layer"
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
        {@attach registerInput}
        aria-label={`Source ${current.name}`}
        aria-describedby={visibleSourceHelp ? `${paneId}-source-help` : undefined}
        value={current.text}
        readonly={running || current.readOnly}
        style:cursor={visibleSourceHelp && helpEnabled ? 'pointer' : 'text'}
        oninput={(event) => {
          workspace.edit(event.currentTarget.value);
          workspace.selection();
        }}
        onfocus={workspace.selection}
        onclick={workspace.selection}
        onpointermove={hoverSource}
        onpointerleave={leaveSource}
        onpointerdown={() => (sourceHelp = null)}
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
        or File → Import ... to add {SOURCE_EXTENSION_LABEL} files, or ZIP archives of them, from your
        computer.
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
  .source-surface textarea::selection {
    background: var(--editor-selection);
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
