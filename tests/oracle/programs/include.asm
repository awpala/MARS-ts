# Original probe: include resolves relative to the including source file.
.include "included.inc"
.text
li $s0, INCLUDED_VALUE
li $v0, 10
syscall
