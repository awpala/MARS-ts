# Displayed failure text

This directory owns the conversion of an unknown thrown value into text for display. [errorMessage.ts](errorMessage.ts) returns an `Error`'s message and otherwise the string conversion of the value. It has no legacy provenance.

The simulation state, source workspace, desktop persistence owner, and Execute view model use it so a failure from storage, an engine call, or a memory edit reads the same way wherever it is shown. It decides only how a value becomes text. Translated `ProcessingException` diagnostics keep their error-report formatting in the simulation owner, the surrounding wording of each message belongs to the owner that shows it, and clearing or retaining a message belongs to the component or state that holds it.

Add a helper here only for further conversion of failures into display text that two or more owners repeat; failure policy, retries, and reporting channels stay with their owners.
