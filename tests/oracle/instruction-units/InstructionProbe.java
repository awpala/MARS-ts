package mars.mips.instructions;
import java.util.Base64;
import java.nio.charset.StandardCharsets;
import mars.Globals;
import mars.assembler.TokenList;

/** Captures real instruction descriptors without executing any instruction. */
public final class InstructionProbe {
    private static String encode(String value) {
        return Base64.getEncoder().encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }
    private static void emit(BasicInstruction instruction) {
        BasicInstructionFormat format = instruction.getInstructionFormat();
        String kind = format == BasicInstructionFormat.R_FORMAT ? "R" : format == BasicInstructionFormat.I_FORMAT ? "I" : format == BasicInstructionFormat.I_BRANCH_FORMAT ? "B" : "J";
        instruction.createExampleTokenList();
        TokenList tokens = instruction.getTokenList();
        System.out.println(encode(instruction.getExampleFormat()) + "\t" + encode(instruction.getDescription()) + "\t" + instruction.getOperationMask() + "\t" + kind + "\t" + instruction.getOpcodeMask() + "\t" + instruction.getOpcodeMatch() + "\t" + instruction.getInstructionLength() + "\t" + encode(instruction.getName()) + "\t" + encode(tokens.toString()) + "\t" + encode(tokens.toTypeString()));
    }
    public static void main(String[] args) {
        Globals.initialize(false);
        for (Object instruction : Globals.instructionSet.getInstructionList()) {
            if (instruction instanceof BasicInstruction) emit((BasicInstruction)instruction);
        }
        emit(new BasicInstruction("  custom $1", BasicInstructionFormat.R_FORMAT, "11111111 ffffffff ssssssss tttttttt", statement -> {}));
    }
}
