# Original probe: one explicitly seeded stream, integer/range/float/double samples.
.text
li $a0, 7
li $a1, -12345
li $v0, 40
syscall
li $v0, 41
syscall
move $s0, $a0
li $a0, 7
li $a1, 17
li $v0, 42
syscall
move $s1, $a0
li $a0, 7
li $v0, 43
syscall
mfc1 $s2, $f0
li $a0, 7
li $v0, 44
syscall
mfc1 $s3, $f0
mfc1 $s4, $f1
li $v0, 10
syscall
