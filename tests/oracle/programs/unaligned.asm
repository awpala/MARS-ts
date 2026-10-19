# Original probe: unaligned word load diagnostic and exception register state.
.data
value: .word 42
.text
la $t0, value
lw $t1, 1($t0)
