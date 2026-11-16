# Schemas

This directory owns the checked-in definitions of schema-aware, bounded payloads: data with a fixed shape that crosses a boundary of the system, or passes between parts of it, and must be validated at that boundary. Each definition is a [JSON Schema](https://json-schema.org/draft/2020-12) document that is the single statement of its payload. Application code under [src/](../src/) evaluates the checked-in document itself rather than restating it, so a payload that the application accepts is, by construction, one the schema accepts.

It currently holds one definition, the portable MARS-ts data file. The directory is deliberately general: a later bounded payload gets its own schema file here under the same conventions, rather than a format described only in code or prose. [ADR 0017](../docs/adrs/0017-portable-mars-data.md) records the decision.

| Schema                                                     | Payload                                                                                    | Written and read by                                                                                |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| [mars-ts-data.v1.schema.json](mars-ts-data.v1.schema.json) | `mars-ts-data.json`: a portable copy of the application data in one browser's localStorage | Export MARS and Import MARS, through the [browser data adapter](../src/lib/browser/data/README.md) |

## Conventions

- **One file per payload version**, named `<payload>.v<version>.schema.json`. A published version is not edited incompatibly: a change that would reject payloads the version already accepts, or accept ones the application cannot use, is a new version in a new file, and the application decides which versions it reads.
- **Dialect and identity.** Every schema declares `"$schema": "https://json-schema.org/draft/2020-12/schema"` and an `$id` that is the URL of the file on the repository's `main` branch. The `$id` is an identifier; it resolves online only after the human publishes the file there.
- **Self-describing payloads.** A payload carries a fixed `format` name and an integer `version`, so a reader can reject a file that is some other document or a version it does not support before interpreting anything else.
- **Closed objects.** Record objects set `additionalProperties: false`. An unknown property is a rejection, not something to ignore, which keeps the schema in step with the records it describes: adding a stored field without updating the schema fails the application's own export and its tests.
- **Descriptions are documentation.** `title` and `description` explain each record and field for a person reading the schema or a file that references it; they carry no validation meaning.

### Supported keywords

The application validates with a small evaluator of its own, [jsonSchema.ts](../src/lib/browser/data/jsonSchema.ts), instead of a general-purpose validator dependency. A schema here may use only the keywords that evaluator implements. It refuses, rather than silently ignores, any other keyword, and a unit test audits every schema in use.

| Purpose    | Keywords                                          | Notes                                                                                                |
| ---------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Annotation | `$schema`, `$id`, `$defs`, `title`, `description` | Not evaluated                                                                                        |
| Reference  | `$ref`                                            | Same-document `#/$defs/<name>` only; evaluated together with sibling keywords                        |
| Any value  | `type`, `const`, `enum`                           | `number` and `integer` require a finite value; `const` and `enum` hold primitive values              |
| Objects    | `properties`, `required`, `additionalProperties`  | `additionalProperties` is `false` or a schema                                                        |
| Arrays     | `items`, `prefixItems`, `minItems`, `maxItems`    | `items` applies after the positions `prefixItems` covers                                             |
| Numbers    | `minimum`, `maximum`, `multipleOf`                | `multipleOf` is a positive integer                                                                   |
| Strings    | `minLength`, `pattern`                            | Length counts Unicode code points; `pattern` is an ECMAScript expression evaluated with the `u` flag |

Combinators (`anyOf`, `oneOf`, `allOf`, `not`), conditionals, `patternProperties`, `uniqueItems`, `format`, and remote references are not available. A nullable value is written as a `type` list such as `["object", "null"]`; object and numeric keywords then apply only when the value has that type. Extend the evaluator, with tests, before a schema needs another keyword.

A schema states shape, types, ranges, and vocabularies. Rules it cannot express, such as uniqueness after name normalization or an index that must refer into another array, remain with the code that owns the record, and the reader of the payload applies both.

## MARS-ts data, version 1

`mars-ts-data.json` is the file Export MARS writes and Import MARS reads. Its envelope identifies the payload, and its `storage` object mirrors the application's localStorage:

```json
{
  "$schema": "https://raw.githubusercontent.com/awpala/MARS-ts/main/schemas/mars-ts-data.v1.schema.json",
  "format": "mars-ts-data",
  "version": 1,
  "exportedAt": "2026-11-16T12:34:56.789Z",
  "storage": {
    "mars-ts:sources:v1": [{ "name": "main.asm", "source": ".text\n" }],
    "mars-ts:theme:v1": "dark",
    "mars-ts:engine-settings:v1:DelayedBranching": "true"
  }
}
```

`format`, `version`, and `storage` are required; `$schema` and `exportedAt` are informational. Each property of `storage` is a storage key, and its value is that key's stored record:

| Storage key                            | Record                                                                                                                                            | Value in the payload |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| `mars-ts:sources:v1`                   | Saved source library: `name` and `source` per file                                                                                                | Parsed JSON          |
| `mars-ts:workspace:v1`                 | Open working buffers in tab order, with current text, saved baseline, new-file state, and the selected tab                                        | Parsed JSON          |
| `mars-ts:display-settings:v1`          | Working editor and display preferences, including Auto Save and run speed                                                                         | Parsed JSON          |
| `mars-ts:panes:v1`                     | Divider positions                                                                                                                                 | Parsed JSON          |
| `mars-ts:desktop-session:v1`           | Desktop recovery: presentation, editor history, consoles, breakpoints, and the last stable execution with its machine checkpoint and source texts | Parsed JSON          |
| `mars-ts:theme:v1`                     | `light` or `dark`                                                                                                                                 | Stored text          |
| `mars-ts:engine-settings:v1:<setting>` | One engine setting per key: `true` or `false` for the 21 boolean settings, free text for the 7 string settings                                    | Stored text          |

The rule for the last column is the schema's own: a key whose schema type is `string` holds the stored text unchanged, and every other key holds the parsed JSON of the stored text. The application derives both its list of mirrored keys and that rule from the schema, so the schema is the registry of what an export contains.

Every key is optional. An absent key was not stored when the file was exported; importing removes that key, so the application starts from its default for it. Keys outside the schema are not part of the payload: Export MARS does not copy them, Import MARS rejects a file containing them, and replacing the stored data leaves any such key already in the browser untouched. The storage keys carry their own record versions (`:v1`); the envelope `version` covers the envelope and the set of mirrored keys.

The schema accepts what each record's owning reader accepts, apart from unknown properties. Records written by earlier revisions therefore remain valid: display settings require only their original five fields, the pane layout may omit `dataSegmentHeight`, and the session may omit `programArguments`, `help`, and several checkpoint fields. The pane layout takes any finite numbers because its reader rounds and clamps them.

### Keeping the schema and the stored records together

The schema mirrors current storage, so a change to a stored record and the corresponding schema change belong in one change:

- A new optional field on a record, a new stored vocabulary value, or a new mirrored storage key: add it to this version's schema. Existing files stay valid.
- A change that makes existing version 1 files invalid or unusable: add `mars-ts-data.v2.schema.json`, leave version 1 as published, and decide in the [browser data adapter](../src/lib/browser/data/README.md) whether version 1 files are still read.

The adapter's unit tests hold the two together. They check that the schema uses only supported keywords, that its storage keys are exactly the keys the application owns (including one per engine setting), that its vocabularies, display-settings fields, and settings array sizes equal those of the record owners, and that records produced by the application's real writers, including a stepped program's machine checkpoint, form a payload the schema accepts. Browser scenarios export from a live desktop and import the result into a separate browser profile.

## Adding a schema

Add a file here when a payload has a fixed shape, a boundary at which it must be validated, and a reader or writer in the application. Name the payload and its version, follow the conventions above, document the payload in this README, and import the schema where it is validated through the package's `#schemas/*` subpath, as the data adapter does. Keep the code that owns the payload responsible for the rules a schema cannot express. The browser-test and standalone builds copy this directory with the application sources, since the application imports from it at build time. Do not add a schema for a format the application does not yet read or write.
