# Bundled assembly sources

This directory holds immutable assembly references shipped with the application. The browser's bundled-source catalog assigns each a reserved virtual identity outside the writable source library; engine hosts resolve that identity to the same source whether or not it is open in the editor. Protected reference tabs offer Copy to new file for user modifications.

[exceptions.s](exceptions.s) is the user-supplied SPIM S20 default exception handler and startup code, copied unchanged. It is copyright 1990–2010 James R. Larus and distributed under the BSD three-clause notice retained at the top of the source, independently of the MARS MIT license. Its header records the SPIM project and source references. Keep the complete copyright, conditions, and disclaimer in redistributed copies, including editable clones.

This source uses the default MIPS32 exception vector at `0x80000180` and includes `__start`, which calls a user-provided global `main` label. It is intended for the default memory configuration. MARS warns about unsupported `.set` directives; the source is deliberately preserved rather than rewritten to suppress those warnings. Warnings-as-errors can therefore reject it. Choose a custom handler or copy and adapt the source when different startup, warning, or memory-layout behavior is needed.
