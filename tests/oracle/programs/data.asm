# Original probe: directive alignment, little-endian storage and signed loads.
.data
bytes: .byte 0x80, 0xff, 0x7f, 0
halves: .half 0x8000, 0x7fff
words: .word 0x12345678, -1
string: .asciiz "A\n\t"
.align 2
storage: .space 8
.text
la $t0, bytes
lb $s0, 0($t0)
lbu $s1, 0($t0)
lh $s2, 4($t0)
lhu $s3, 4($t0)
lw $s4, 8($t0)
la $t1, storage
sw $s4, 0($t1)
sb $s0, 1($t1)
sh $s3, 4($t1)
li $v0, 10
syscall
