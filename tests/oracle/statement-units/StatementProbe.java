import mars.*;
import mars.assembler.*;
import mars.mips.instructions.*;
import java.util.*;

/** Public ProgramStatement probe; never executes an instruction. */
public final class StatementProbe {
  static ArrayList<BasicInstruction> instructions = new ArrayList<>();
  static String q(String text) {
    if(text == null) return "null";
    return "\"" + text.replace("\\","\\\\").replace("\"","\\\"").replace("\n","\\n").replace("\r","\\r").replace("\t","\\t") + "\"";
  }
  static String tokens(TokenList tokens) {
    StringJoiner join = new StringJoiner(",","[","]");
    for(int i=0;i<tokens.size();i++) {Token t=tokens.get(i); join.add("["+q(t.getType().toString())+","+q(t.getValue())+","+t.getSourceLine()+","+t.getStartPos()+"]");}
    return join.toString();
  }
  static String state(ProgramStatement statement, ErrorList errors) {
    StringJoiner printable = new StringJoiner(",","[","]");
    for(int setting=0;setting<4;setting++) {
      Globals.getSettings().setBooleanSettingNonPersistent(Settings.DISPLAY_ADDRESSES_IN_HEX,(setting&1)!=0);
      Globals.getSettings().setBooleanSettingNonPersistent(Settings.DISPLAY_VALUES_IN_HEX,(setting&2)!=0);
      printable.add(q(statement.getPrintableBasicAssemblyStatement()));
    }
    String string;
    try { string=statement.toString(); } catch(RuntimeException e) {string="<THROWS>";}
    return "{\"basic\":"+q(statement.getBasicAssemblyStatement())+",\"machine\":"+q(statement.getMachineStatement())+",\"binary\":"+statement.getBinaryStatement()+",\"operands\":"+Arrays.toString(statement.getOperands())+",\"printable\":"+printable+",\"string\":"+q(string)+",\"errors\":"+q(errors.generateErrorReport())+",\"bounds\":["+statement.getOperand(-1)+","+statement.getOperand(0)+","+statement.getOperand(1)+","+statement.getOperand(2)+","+statement.getOperand(3)+","+statement.getOperand(4)+"]}";
  }
  static void decode(int binary,int address) {
    BasicInstruction found=Globals.instructionSet.findByBinaryCode(binary);
    ProgramStatement s=new ProgramStatement(binary,address);
    System.out.println("{\"kind\":\"decode\",\"id\":"+instructions.indexOf(found)+",\"binary\":"+binary+",\"address\":"+address+",\"state\":"+state(s,new ErrorList())+"}");
  }
  static void encode(BasicInstruction instruction, TokenList tokens,int address,int symbol, String label,boolean repeat) {
    MIPSprogram program=new MIPSprogram() { final SymbolTable symbols=new SymbolTable("probe"); public SymbolTable getLocalSymbolTable() { return symbols; } public String getFilename() { return "probe"; } };
    program.getLocalSymbolTable().addSymbol(new Token(TokenTypes.IDENTIFIER,"label",program,1,1),symbol,false,new ErrorList());
    ProgramStatement statement=new ProgramStatement(program,label,tokens,tokens,instruction,address,7);
    ErrorList errors=new ErrorList();
    statement.buildBasicStatementFromBasicInstruction(errors);
    if(!errors.errorsOccurred()) statement.buildMachineStatementFromBasicStatement(errors);
    System.out.println("{\"kind\":\"encode\",\"id\":"+instructions.indexOf(instruction)+",\"tokens\":"+tokens(tokens)+",\"address\":"+address+",\"symbol\":"+symbol+",\"label\":"+q(label)+",\"repeat\":false,\"state\":"+state(statement,errors)+"}");
    if(repeat) {
      statement.buildBasicStatementFromBasicInstruction(errors);
      statement.buildMachineStatementFromBasicStatement(errors);
      System.out.println("{\"kind\":\"encode\",\"id\":"+instructions.indexOf(instruction)+",\"tokens\":"+tokens(tokens)+",\"address\":"+address+",\"symbol\":"+symbol+",\"label\":"+q(label)+",\"repeat\":true,\"state\":"+state(statement,errors)+"}");
    }
  }
  static BasicInstruction named(String name) {
    for(BasicInstruction i:instructions) if(i.getName().equals(name)) return i;
    throw new RuntimeException(name);
  }
  static TokenList line(String operator,TokenTypes[] types,String... values) {
    TokenList tokens=new TokenList(); tokens.add(new Token(TokenTypes.OPERATOR,operator,null,7,1));
    for(int i=0;i<values.length;i++) tokens.add(new Token(types[i],values[i],null,7,3+i));
    return tokens;
  }
  static void special(String name,ProgramStatement statement,ErrorList errors) {
    System.out.println("{\"kind\":\"special\",\"name\":"+q(name)+",\"state\":"+state(statement,errors)+",\"source\":"+q(statement.getSource())+",\"file\":"+q(statement.getSourceFile())+",\"instruction\":"+q(statement.getInstruction()==null?null:statement.getInstruction().getName())+"}");
  }
  static void specials() {
    ErrorList errors=new ErrorList();
    ProgramStatement statement=new ProgramStatement(-1,-4);
    statement.setSource("replacement source");
    statement.setBinaryStatement(0x80000000);
    statement.setBasicAssemblyStatement("custom -2147483648");
    statement.setMachineStatement("10000000000000000000000000000000");
    special("setters",statement,errors);
    statement.setBasicAssemblyStatement(null);
    statement.setMachineStatement(null);
    special("clear-strings",statement,errors);
    statement.setBasicAssemblyStatement("no-space");
    special("malformed-basic",statement,errors);
    InstructionSet original=Globals.instructionSet;
    Globals.instructionSet=new InstructionSet(){
      public BasicInstruction findByBinaryCode(int word) {return null;}
      public ArrayList matchOperator(String name) {return original.matchOperator(name);}
    };
    special("nop-fallback",new ProgramStatement(0,0),new ErrorList());
    Globals.instructionSet=original;
    TokenList empty=line("li",new TokenTypes[]{});
    statement=new ProgramStatement(null,"li",empty,empty,(Instruction)original.matchOperator("li").get(0),0,1);
    errors=new ErrorList(); statement.buildMachineStatementFromBasicStatement(errors);
    special("pseudo-encoding",statement,errors);
  }
  public static void main(String[] args) {
    Globals.initialize(false);
    for(Object i:Globals.instructionSet.getInstructionList()) if(i instanceof BasicInstruction) instructions.add((BasicInstruction)i);
    for(int id=0;id<instructions.size();id++) {
      BasicInstruction i=instructions.get(id); BasicInstructionFormat f=i.getInstructionFormat();
      String format=f==BasicInstructionFormat.R_FORMAT?"R":f==BasicInstructionFormat.I_FORMAT?"I":f==BasicInstructionFormat.J_FORMAT?"J":"B";
      System.out.println("{\"kind\":\"instruction\",\"id\":"+id+",\"example\":"+q(i.getExampleFormat())+",\"mask\":"+q(i.getOperationMask())+",\"format\":"+q(format)+",\"tokens\":"+tokens(i.getTokenList())+"}");
    }
    int[] patterns={0,-1,0xaaaaaaaa,0x55555555,0x80008000,0x7fff7fff};
    int[] addresses={0,0x00400000,0x0ffffffc,0x80000000,-4};
    for(BasicInstruction i:instructions) {
      for(int p=0;p<patterns.length;p++) decode(i.getOpcodeMatch() | (patterns[p]&~i.getOpcodeMask()),addresses[p%addresses.length]);
      encode(i,(TokenList)i.getTokenList().clone(),0x00400000,0x00400018,i.getExampleFormat(),false);
    }
    decode(-1,0x00400000);
    specials();
    TokenTypes R=TokenTypes.REGISTER_NAME,N=TokenTypes.REGISTER_NUMBER,F=TokenTypes.FP_REGISTER_NAME,I=TokenTypes.INTEGER_32,L=TokenTypes.IDENTIFIER;
    for(String value:new String[]{"-32768","-1","0","32767","65535","0x80000000","0xffffffff"}) encode(named("addi"),line("addi",new TokenTypes[]{R,N,I},"$t0","$9",value),0x00400000,0,"integer",true);
    for(int address:addresses) for(int delta:new int[]{-131072,-4,0,4,131068}) encode(named("beq"),line("beq",new TokenTypes[]{R,N,L},"$t0","$9","label"),address,address+delta,"branch",false);
    for(int address:addresses) for(int target:addresses) encode(named("j"),line("j",new TokenTypes[]{L},"label"),address,target,"jump",true);
    encode(named("add"),line("add",new TokenTypes[]{R},"$bogus"),0,0,"bad-name",false);
    encode(named("add"),line("add",new TokenTypes[]{N},"$88"),0,0,"bad-number",false);
    encode(named("add.s"),line("add.s",new TokenTypes[]{F},"$f88"),0,0,"bad-fp",false);
    encode(named("j"),line("j",new TokenTypes[]{L},"missing"),0,0,"missing",false);
    encode(named("nop"),line("nop",new TokenTypes[]{I},"42"),0,0,"mismatch",false);
  }
}
