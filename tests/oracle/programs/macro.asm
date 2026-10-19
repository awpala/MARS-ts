# Original probe: constants, local macro labels and pseudo-instruction expansion.
.eqv AMOUNT 3
.macro increment (%reg)
local:
addiu %reg, %reg, AMOUNT
.end_macro
.text
li $s0, 0
increment ($s0)
increment ($s0)
li $t0, 0x12345678
move $s1, $t0
blt $s0, $s1, done
li $s0, -1
done:
li $v0, 10
syscall
