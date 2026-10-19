# Original probe: delay slot executes only with the db CLI option.
.text
addiu $s0, $zero, 1
beq $zero, $zero, target
addiu $s0, $s0, 2
addiu $s0, $s0, 4
target:
addiu $s0, $s0, 8
addiu $v0, $zero, 10
syscall
