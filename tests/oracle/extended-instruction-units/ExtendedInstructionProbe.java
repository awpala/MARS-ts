import java.util.*;
import mars.*;
import mars.assembler.*;
import mars.mips.hardware.*;
import mars.mips.instructions.*;

/** Probes canonical descriptors and substitutions without modifying legacy sources. */
public final class ExtendedInstructionProbe {
    private static String q(String value) {
        if (value == null) return "null";
        StringBuilder out = new StringBuilder("\"");
        for (int i=0;i<value.length();i++) {
            char c=value.charAt(i);
            if (c=='"' || c=='\\') out.append('\\').append(c);
            else if (c<32 || Character.isSurrogate(c)) out.append(String.format("\\u%04x",(int)c));
            else out.append(c);
        }
        return out.append('"').toString();
    }
    private static String strings(List values) {
        if (values==null) return "null";
        ArrayList<String> out=new ArrayList<>();
        for (Object value: values) out.add(q((String)value));
        return "["+String.join(",",out)+"]";
    }
    private static Token token(String value) { return new Token(TokenTypes.IDENTIFIER,value,null,1,1); }
    private static void expansion(String template, String[] values, boolean delayed, MIPSprogram program) {
        Globals.getSettings().setBooleanSettingNonPersistent(Settings.DELAYED_BRANCHING_ENABLED,delayed);
        TokenList tokens=new TokenList();
        for (String value:values) tokens.add(token(value));
        String result=null, failure=null;
        try { result=ExtendedInstruction.makeTemplateSubstitutions(program,template,tokens); }
        catch (Throwable error) { failure=error.getClass().getSimpleName(); }
        System.out.println("{\"kind\":\"expansion\",\"template\":"+q(template)+",\"values\":"+strings(Arrays.asList(values))+",\"delayed\":"+delayed+",\"result\":"+q(result)+",\"failure\":"+q(failure)+"}");
    }
    private static void metadata(ExtendedInstruction instruction, int overload, String translation, String compact, MIPSprogram program) {
        Globals.getSettings().setBooleanSettingNonPersistent(Settings.DELAYED_BRANCHING_ENABLED,false);
        int length=instruction.getInstructionLength(), compactLength=instruction.getCompactInstructionLength();
        Globals.getSettings().setBooleanSettingNonPersistent(Settings.DELAYED_BRANCHING_ENABLED,true);
        System.out.println("{\"kind\":\"metadata\",\"overload\":"+overload+",\"translation\":"+q(translation)+",\"compact\":"+q(compact)+",\"example\":"+q(instruction.getExampleFormat())+",\"name\":"+q(instruction.getName())+",\"description\":"+q(instruction.getDescription())+",\"templates\":"+strings(instruction.getBasicIntructionTemplateList())+",\"compactTemplates\":"+strings(instruction.getCompactBasicIntructionTemplateList())+",\"hasCompact\":"+instruction.hasCompactTranslation()+",\"length\":"+length+",\"compactLength\":"+compactLength+",\"delayedLength\":"+instruction.getInstructionLength()+",\"delayedCompactLength\":"+instruction.getCompactInstructionLength()+",\"tokens\":"+q(instruction.getTokenList().toString())+",\"types\":"+q(instruction.getTokenList().toTypeString())+"}");
        TokenList example=instruction.getTokenList();
        String[] values=new String[example.size()];
        for (int i=0;i<values.length;i++) {
            Token token=example.get(i); String value=token.getValue();
            if (i>0 && token.getType()==TokenTypes.IDENTIFIER) value="268468224";
            else if (token.getType()==TokenTypes.REGISTER_NAME || token.getType()==TokenTypes.REGISTER_NUMBER) value="$"+RegisterFile.getUserRegister(value).getNumber();
            values[i]=value;
        }
        for (ArrayList list:new ArrayList[] {instruction.getBasicIntructionTemplateList(),instruction.getCompactBasicIntructionTemplateList()})
            if (list!=null) for (Object template:list) for (boolean delayed:new boolean[] {false,true}) expansion((String)template,values,delayed,program);
    }
    private static final class Program extends MIPSprogram {
        private final SymbolTable symbols=new SymbolTable("probe.asm");
        public SymbolTable getLocalSymbolTable() { return symbols; }
    }
    public static void main(String[] args) {
        Globals.initialize(false);
        MIPSprogram program=new Program();
        program.getLocalSymbolTable().addSymbol(token("LABEL_local"),268468224,false,new ErrorList());
        Globals.symbolTable.addSymbol(token("global_target"),4194304,false,new ErrorList());
        ArrayList<String> operators=new ArrayList<>();
        for (Object item:Globals.instructionSet.getInstructionList()) if (!operators.contains(((Instruction)item).getName())) operators.add(((Instruction)item).getName());
        System.out.println("{\"kind\":\"operators\",\"names\":"+strings(operators)+"}");
        for (Object item:Globals.instructionSet.getInstructionList()) if (item instanceof ExtendedInstruction) metadata((ExtendedInstruction)item,0,null,null,program);
        metadata(new ExtendedInstruction("custom $1", "\nfirst\n\nDBNOP\nlast\r\n"),2,"\nfirst\n\nDBNOP\nlast\r\n",null,program);
        metadata(new ExtendedInstruction("custom $1", null, "description"),3,null,null,program);
        metadata(new ExtendedInstruction("custom $1", "", "\n", "description"),4,"","\n",program);
        metadata(new ExtendedInstruction("custom $1", "XDBNOPY", "DBNOP\n compact ", "description"),4,"XDBNOPY","DBNOP\n compact ",program);
        String[] markers={"RG2 RG2 OP2", "LH2", "LH2P4", "LL2", "LL2U", "LL2P4", "VHL2P4", "VH2P4", "VH2", "VL2P4", "VL2P4U", "VL2", "VL2U", "VHL2", "LHL", "LHPAP4", "LHPA", "LHPN", "LLPP4", "LLP", "LLPU", "S32", "LAB LAB"};
        String[] values={"0","-1","32767","32768","65535","65536","2147483647","-2147483648","0xffffffff","0x80000000","0x10008000","4194304","bad","2147483648","-2147483616"};
        for (String value:values) for (String marker:markers) for (boolean delayed:new boolean[] {false,true}) expansion(marker,new String[] {"custom","$31",value,"+",value},delayed,program);
        for (String marker:new String[] {"NR1 NR2 NR3 NR4", "DBNOP", "aDBNOPz", "BROFF12 BROFF12", "BROFF", "BROFF1", "BROFFxy", "LH2P", "VL2P", "LLPP", "LHPAP", "LH2Px", "VL2PzU"}) for (boolean delayed:new boolean[] {false,true}) expansion(marker,new String[] {"custom","$31","$f31","$bad","$t0"},delayed,program);
        expansion("LAB LAB",new String[] {"b","268468224"},false,program);
        expansion("LAB",new String[] {"b","4194304"},false,program);
        expansion("LH10P4|LL10U|VL10P4U",new String[] {"custom","0","0","0","0","0","0","0","0","0","32768"},false,program);
    }
}
