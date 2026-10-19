# Original probe: signed overflow raises an exception instead of wrapping.
.text
li $t0, 0x7fffffff
addi $t1, $t0, 1
