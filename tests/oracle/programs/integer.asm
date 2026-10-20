# Original probe: arithmetic wrapping, shifts, unsigned comparison, HI/LO.
.text
li $t0, 0x7fffffff
addiu $t1, $t0, 1
li $t2, -1
slt $t3, $t2, $zero
sltu $t4, $t2, $zero
sll $t5, $t2, 31
srl $t6, $t2, 31
sra $t7, $t2, 31
li $a0, -7
li $a1, 3
div $a0, $a1
mflo $s0
mfhi $s1
multu $t2, $t2
mflo $s2
mfhi $s3
addu $zero, $t0, $t0
li $v0, 10
syscall
