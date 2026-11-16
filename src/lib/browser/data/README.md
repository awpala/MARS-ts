# Browser application data

This directory owns the portable copy of the application's browser-local data: the `mars-ts-data.json` payload that Export MARS writes and Import MARS reads. It captures the mirrored localStorage keys into that payload, validates a payload, summarizes it for confirmation, and replaces the stored keys with one. It also holds the small JSON Schema evaluator that validation uses. The record formats themselves stay with their owners in [sources](../sources/README.md), [preferences](../preferences/README.md), and [session](../session/README.md); this adapter reads and writes their keys only as a whole, and holds no editor buffers, machine state, timers, or listeners.

The payload is defined by the checked-in [MARS-ts data schema](../../../../schemas/README.md), imported at build time through the `#schemas/*` subpath. [marsData.ts](marsData.ts) evaluates that document rather than restating it, and derives from it both the list of mirrored storage keys and which of them hold stored text unchanged (the theme and each engine setting) rather than parsed JSON. Adding a mirrored key or a stored field is therefore a schema change, described in the schema guide.

## Capture and export

`captureMarsData` copies every mirrored key present in storage into an envelope with the fixed `format`, the `version`, the schema's `$id`, and the export time. It only reads storage, omits absent keys, ignores keys outside the schema, and throws when a stored record is not valid JSON. The caller, the [export component](../../venus/components/transfers/README.md), first flushes the desktop's recovery writer so the session record is current, then checks the capture with `validateMarsData` and exports nothing when stored data does not conform, reporting the problem instead of producing a file that could not be imported. `marsDataBlob` serializes the payload as compact JSON with a trailing newline under `MARS_DATA_FILENAME`, `mars-ts-data.json`.

## Validation

`validateMarsData` applies two gates and returns at most twenty problems, each prefixed with the JSON Pointer of the failing value:

1. **The schema.** [jsonSchema.ts](jsonSchema.ts) evaluates the checked-in document: envelope identity and version, the closed set of storage keys, and every record's shape, types, ranges, and vocabularies, down to the machine checkpoint's register counts and memory blocks.
2. **The record owners.** Only for a schema-conforming payload, each mirrored record is run through the reader that will load it: the source library and workspace readers (valid virtual names, unique after normalization), the display-settings and pane-layout loaders, and the recovery record's validator (history references, random-stream identities, and the loaded program's source). These are the rules a schema cannot express, and reusing the readers keeps one definition of each.

`readMarsData` and `readMarsDataFile` wrap this for a picker selection and never throw: malformed JSON, a nonconforming payload, an unreadable file, and a file above `MARS_DATA_MAX_BYTES` (32 MiB, far more than browser storage holds) all come back as a reading with issues. A conforming reading carries the payload and a `MarsDataSummary`: saved sources, open buffers and how many are unsaved, stored preference records, whether a session is included and which program it had loaded, and the export time.

The evaluator implements the JSON Schema 2020-12 subset listed in the schema guide. It audits a schema once before first use and throws on an unsupported or malformed keyword, since that is a defect in a checked-in schema rather than a property of the value being validated; `unsupportedSchemaKeywords` exposes the same audit to tests. Numbers must be finite, string length counts code points, and traversal stops once the issue limit is reached, so an arbitrarily large document cannot produce an unbounded report.

## Replacement

`applyMarsData` replaces every mirrored key with a validated payload: it removes all mirrored keys, then writes those the payload contains, so keys the payload omits return to their defaults and keys outside the schema are untouched. If any write throws, such as on a full quota, it removes the mirrored keys again, writes back every previous value, and rethrows; restoring continues past an individual failure. It does not reload anything. The [Import MARS owner](../../venus/state/README.md) suspends the desktop's recovery writer before calling it, so the replaced session record is not overwritten when the page exits, and reloads the application afterwards so every state owner restores from the new records.

## Limits

Import MARS replaces; it does not merge with the data already in the browser. Only envelope version 1 is read, and there is no migration between versions. Storage is shared by every tab of the same origin: another open tab of the application keeps writing its own state, as it does for any other storage change. Whether a payload fits is decided by the browser's quota at write time, with the previous data restored on failure.

Add code here when it concerns the application's stored data as a whole. A new stored record belongs to the submodule that owns its format, with its key added to the schema; a new schema-defined payload gets its own schema and its own adapter beside the code that reads or writes it, and may reuse the evaluator.
