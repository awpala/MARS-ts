.ktext 0x80000180
addiu $t0, $zero, 42
mfc0 $k0, $14
addiu $k0, $k0, 4
mtc0 $k0, $14
eret
