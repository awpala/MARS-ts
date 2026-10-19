.eqv BASE, 12
.include "nested/one.inc"
main: li $t0, VALUE
add $t1,$t0,BASE # substitutions
.macro test(%param)
li $v0,%param
.end_macro
