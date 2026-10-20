# Settings oracle

`SettingsProbe.java` invokes the unchanged `mars.Settings` and `mars.Globals` classes with isolated Java preferences. It captures all 21 boolean slots and their canonical defaults, persistent versus nonpersistent setter notifications, repeated setters, engine string defaults, backstepping without a program, invalid setting identifiers, and configured engine limits. The program-arguments slot retains its original numeric position for identifier compatibility; program arguments are outside the current port scope.

After `build-legacy`, run `node tests/oracle/settings-units/run.mjs --update` to regenerate `golden.json` or `--check` to compare without changes. The shared runner records exact command, streams, exit status, JDK major, probe hash, and immutable legacy input digest. `tests/session/globals-controller.test.ts` compares the translated settings against these results and separately tests preference-host isolation and controller lifecycle behavior. Swing font, color, and syntax-style preference objects are not implemented by the engine settings class.

The translated algorithms are copyright Pete Sanderson and Kenneth Vollmar under the MIT license; see [MARSlicense.txt](../../../MARSlicense.txt).
