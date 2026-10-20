# Legacy MARS application

This directory owns the original Java/Swing MARS application used as the behavioral oracle for the TypeScript port. It contains the Java sources, runtime properties and instruction data, XML tool definitions, bundled help and images, manifests, historical JAR packaging script, and [generated Javadoc](docs/README.md). Keep Java sources, runtime resources, and generated documentation unchanged; they define the behavior being ported.

The current application lives under [src/](../src/), with browser assets under [static/](../static/) and authored port documentation under [docs/](../docs/README.md). Oracle probes, inputs, and golden captures stay under [tests/oracle/](../tests/oracle/README.md) because they validate the port. Legacy source paths in provenance headers and fixture metadata are relative to this directory; Java package names and classpath resource names are unchanged.

The original [MARSlicense.txt](../MARSlicense.txt) remains at the repository root and applies to both applications. MARS is copyright 2003–2013 Pete Sanderson and Kenneth Vollmar under that MIT license.

## Build and run

Use `build-legacy` and `run-legacy` from the prepared development environment. The build compiles this directory's Java sources, copies its runtime resources and the shared root license, and creates `__build/legacy/Mars.jar` at the repository root. Generated Javadoc is not a runtime dependency and is excluded from that archive. The runner preserves the caller's working directory and isolates Java preferences; use it for reproducible oracle observations.

```sh
build-legacy
run-legacy nc tests/oracle/programs/integer.asm
```

Run the example from the repository root. The [oracle guide](../docs/agents/legacy.md) describes command options and isolation. The provisional JDK, build/run helpers, and this directory are removed together at P5 of the [port plan](../docs/adrs/0000-port-plan.md#6-milestones); the root license and port validation fixtures remain.

[CreateMarsJar.bat](CreateMarsJar.bat) is the historical Windows packaging recipe, run from this directory after compiling classes. Its license argument points to the shared parent file and packages it at the JAR root. It includes this directory's `docs/` and uses [mainclass.txt](mainclass.txt); oracle builds use the maintained helper instead.

## Original MARS README

MARS (official) MIPS Assembler and Runtime Simulator

MARS is a lightweight interactive development environment (IDE) for programming in MIPS assembly language, intended for educational-level use with Patterson and Hennessy's Computer Organization and Design.

It is available for you to download as an executable JAR file. Click the MARS v.4.5 link at right, under Releases, to access the download.

We have relocated the MARS website to https://dpetersanderson.github.io/ There are still a couple of display issues to work out but all website content is there. This includes all documentation and the JAR download. We are not experienced in github so if you know a way we can host the website in this MARS repository let us know.

This is the original MARS, developed by Pete Sanderson and Ken Vollmar. Developed while Pete was professor at Otterbein University and Ken was professor at Missouri State University. Both are now retired. This is a legacy application but is very stable and continues to be used by universities throughout the world as of 2024. The last release was MARS 4.5 in August 2014.

Until October 2024 the MARS website, including executable JAR file download, was hosted by Missouri State University. That is no longer the case. That's why it is here.
