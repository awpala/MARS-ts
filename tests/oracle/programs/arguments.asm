# Original probe: argc/argv initialization and UTF-8-independent ASCII arguments.
.text
move $s0, $a0
lw $a0, 0($a1)
li $v0, 4
syscall
lw $a0, 4($a1)
syscall
li $v0, 10
syscall
