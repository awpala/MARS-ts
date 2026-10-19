# ADR 0003: Browser file workflows and local UI validation

- **Status**: Accepted
- **Date**: 2026-10-19

## Context

The [port fidelity decision](0002-port-fidelity.md) preserves Venus workflows while replacing native file selection and secondary windows. Browser pages cannot overwrite arbitrary selected files or close tabs they did not open. The initial editor must expose these differences honestly without introducing a launch screen or server-side file access.

## Decision

Open uses a user-initiated browser file input and reads only selected files into session-owned editor buffers. Canceling the picker changes nothing. Buffers retain their source names, content, and independent saved snapshots. A downloaded filename is not evidence of native filesystem access. Include resolution will use a host-owned virtual filesystem when the assembler is connected.

Save and Save As initiate a browser download. Save As obtains a filename in a modal in the current tab. After download initiation, the editor records the downloaded content as its saved snapshot, matching the dirty-state workflow while describing the action as a download. It cannot confirm that the browser completed a disk write and does not claim to overwrite the originally selected file. Closing dirty buffers presents Save, Discard, and Cancel in the current tab; cancellation preserves content. Exit closes documents through this same workflow and leaves the main GUI open.

Editor, settings, help, and syscall dialogs use same-tab modal presentation with focus entry, dismissal, and restoration. New windows, native Java dialogs, and a splash screen are not introduced. Browser-reserved shortcuts remain subject to the browser; corresponding menu/toolbar actions stay available.

Playwright is a development-only dependency for reproducible browser workflow validation against an isolated test server on port 6278. Port 6277 remains reserved for human review. Test mode uses separate SvelteKit output and Vite caches so automated builds do not replace the review server’s generated files. Its Chromium download is a local validation prerequisite, not a shipped runtime dependency. Browser tests must check actual file content, dirty-state decisions, dialogs, and lifecycle behavior rather than treating a successful HTTP response as GUI validation.

## Consequences and validation

The UI supports saving without requiring a browser-specific filesystem API. Users choose download destinations through browser preferences. Native filesystem overwrite confirmation is unavailable; a future File System Access adapter would require explicit capability handling and separate validation.

The [browser adapter](../../src/lib/browser/) owns downloads and the [editor](../../src/lib/editor/) owns buffers and saved snapshots. Engine code performs no DOM or filesystem operations. Browser tests under `tests/browser/` exercise these adaptations; engine oracle comparisons remain separate. This decision does not declare assembly, simulation, editor highlighting, tools, or settings complete.
