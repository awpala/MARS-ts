# Original probe: sm starts at the global main label.
.text
li $s0, -1
li $v0, 10
syscall
.globl main
main:
li $s0, 42
li $v0, 10
syscall
