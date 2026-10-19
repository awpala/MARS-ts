# Original probe: CLI step limit stops an otherwise infinite loop.
.text
loop:
addiu $s0, $s0, 1
j loop
nop
