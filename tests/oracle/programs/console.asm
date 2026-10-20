# Original probe: integer, string and character input/output with bounded buffer.
.data
buffer: .space 8
.text
li $v0, 5
syscall
move $s0, $v0
move $a0, $v0
li $v0, 1
syscall
li $a0, 10
li $v0, 11
syscall
la $a0, buffer
li $a1, 8
li $v0, 8
syscall
li $v0, 4
syscall
li $v0, 12
syscall
move $a0, $v0
li $v0, 11
syscall
li $v0, 10
syscall
