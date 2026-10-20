# Legacy Java documentation

This directory preserves the generated MARS 4.5 Javadoc for the original Java/Swing application. Open [index.html](index.html) for the framed reference or [overview-summary.html](overview-summary.html) for the package overview. The HTML pages, `mars/` package tree, `resources/` images, `stylesheet.css`, and `package-list` were moved together from `docs/` without changing their contents or relative layout.

These generated files are read-only historical reference material, not documentation of the TypeScript implementation. Read the canonical [Java sources](../mars/) when the Javadoc and source disagree. MARS is copyright Pete Sanderson and Kenneth Vollmar under the shared root [MIT license](../../MARSlicense.txt); the generated files retain their original notices.

Current architecture, port plans, oracle guidance, and operations remain under the repository's [docs/](../../docs/README.md) and in the [implementation guide](../../IMPLEMENTATION.md). Legacy runtime help lives under [help/](../help/) because the Java application loads it from the classpath.

The runtime does not read Javadoc, and `build-legacy` does not package it. The historical [CreateMarsJar.bat](../CreateMarsJar.bat) includes this `docs/` directory; use the maintained `build-legacy` helper for the oracle. This archive is removed with the Java reference at milestone P5 of the [port plan](../../docs/adrs/0000-port-plan.md#6-milestones).
