# Original probe: float/double arithmetic, bit transfers and Java print formatting.
.data
single: .float 0.1
second: .float 0.2
double: .double 1.0e20
.text
lwc1 $f0, single
lwc1 $f2, second
add.s $f12, $f0, $f2
mfc1 $s0, $f12
li $v0, 2
syscall
li $a0, 10
li $v0, 11
syscall
ldc1 $f12, double
li $v0, 3
syscall
li $v0, 10
syscall
