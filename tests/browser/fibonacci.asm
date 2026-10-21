# Positive control supplied by the user: stores compute ten Fibonacci words.
      .data
fibs: .word 0 : 10
size: .word 10
      .text
      la $t0, fibs
      la $t5, size
      lw $t5, 0($t5)
      li $t2, 1
      add.d $f0, $f2, $f4
      sw $t2, 0($t0)
      sw $t2, 4($t0)
      addi $t1, $t5, -2
loop: lw $t3, 0($t0)
      lw $t4, 4($t0)
      add $t2, $t3, $t4
      sw $t2, 8($t0)
      addi $t0, $t0, 4
      addi $t1, $t1, -1
      bgtz $t1, loop
      la $a0, fibs
      add $a1, $zero, $t5
      jal print
      li $v0, 10
      syscall
      .data
space: .asciiz " "
head: .asciiz "The Fibonacci numbers are:\n"
nwln: .asciiz "\n"
      .text
print: add $t0, $zero, $a0
      add $t1, $zero, $a1
      la $a0, head
      li $v0, 4
      syscall
out:  lw $a0, 0($t0)
      li $v0, 1
      syscall
      la $a0, space
      li $v0, 4
      syscall
      la $a0, nwln
      li $v0, 4
      syscall
      addi $t0, $t0, 4
      addi $t1, $t1, -1
      bgtz $t1, out
      jr $ra
