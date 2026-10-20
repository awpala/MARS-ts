# Original probe: heap alignment and allocation return addresses.
.text
li $a0, 1
li $v0, 9
syscall
move $s0, $v0
li $a0, 5
li $v0, 9
syscall
move $s1, $v0
li $a0, 0
li $v0, 9
syscall
move $s2, $v0
li $v0, 10
syscall
