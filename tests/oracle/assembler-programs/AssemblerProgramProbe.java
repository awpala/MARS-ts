import java.util.*;
import java.nio.file.*;
import mars.*;
import mars.assembler.*;
import mars.mips.hardware.*;
import mars.mips.instructions.*;

/** Runs complete immutable Java assembler passes against loaded and virtual sources. */
public final class AssemblerProgramProbe {
 private static String q(String value){if(value==null)return "null";StringBuilder out=new StringBuilder("\"");for(int i=0;i<value.length();i++){char c=value.charAt(i);if(c=='"'||c=='\\')out.append('\\').append(c);else if(c<32||Character.isSurrogate(c))out.append(String.format("\\u%04x",(int)c));else out.append(c);}return out.append('"').toString();}
 private static String errors(ErrorList errors){if(errors==null)return "null";ArrayList<String> out=new ArrayList<>();for(Object item:errors.getErrorMessages()){ErrorMessage e=(ErrorMessage)item;out.add("{\"file\":"+q(e.getFilename())+",\"line\":"+e.getLine()+",\"column\":"+e.getPosition()+",\"message\":"+q(e.getMessage())+",\"warning\":"+e.isWarning()+",\"history\":"+q(e.getMacroExpansionHistory())+"}");}return "["+String.join(",",out)+"]";}
 private static String statements(ArrayList list){if(list==null)return "null";ArrayList<String> out=new ArrayList<>();for(Object item:list){ProgramStatement s=(ProgramStatement)item;out.add("{\"address\":"+s.getAddress()+",\"binary\":"+s.getBinaryStatement()+",\"basic\":"+q(s.getBasicAssemblyStatement())+",\"printable\":"+q(s.getPrintableBasicAssemblyStatement())+",\"machine\":"+q(s.getMachineStatement())+",\"source\":"+q(s.getSource())+",\"file\":"+q(s.getSourceFile())+",\"line\":"+s.getSourceLine()+",\"operands\":"+Arrays.toString(s.getOperands())+"}");}return "["+String.join(",",out)+"]";}
 private static String symbols(SymbolTable table){if(table==null)return "null";ArrayList<String> out=new ArrayList<>();for(Object item:table.getAllSymbols()){Symbol s=(Symbol)item;out.add("{\"name\":"+q(s.getName())+",\"address\":"+s.getAddress()+",\"data\":"+s.getType()+"}");}return "["+String.join(",",out)+"]";}
 private static class Program extends MIPSprogram {
  private final String name;private ArrayList<String> source;
  Program(String name,String text){this.name=name;this.source=new ArrayList<>(Arrays.asList(text.split("\\n",-1)));if(text.endsWith("\n"))source.remove(source.size()-1);}
  public String getFilename(){return name;}public ArrayList getSourceList(){return source;}
  public void setSourceLineList(ArrayList<SourceLine> lines){super.setSourceLineList(lines);source=super.getSourceList();}
 }
 private static void run(String id,String config,boolean delayed,boolean bare,boolean extended,boolean warnings,boolean hex,String[][] sources) throws Exception {
  MemoryConfigurations.setCurrentConfiguration(MemoryConfigurations.getConfigurationByName(config));
  Globals.memory.clear();Globals.symbolTable.clear();
  Globals.getSettings().setBooleanSettingNonPersistent(Settings.DELAYED_BRANCHING_ENABLED,delayed);
  Globals.getSettings().setBooleanSettingNonPersistent(Settings.BARE_MACHINE_ENABLED,bare);
  Globals.getSettings().setBooleanSettingNonPersistent(Settings.DISPLAY_ADDRESSES_IN_HEX,hex);
  Globals.getSettings().setBooleanSettingNonPersistent(Settings.DISPLAY_VALUES_IN_HEX,hex);
  ArrayList<MIPSprogram> programs=new ArrayList<>();ArrayList<String> inputs=new ArrayList<>();
  Assembler assembler=new Assembler();ArrayList result=null;ErrorList errors=null;String failure=null;
  for(String[] source:sources){programs.add(new Program(source[0],source[1]));inputs.add("{\"name\":"+q(source[0])+",\"text\":"+q(source[1])+"}");}
  try{for(MIPSprogram program:programs)program.tokenize();result=assembler.assemble(programs,extended,warnings);errors=assembler.getErrorList();}
  catch(ProcessingException error){failure="ProcessingException";errors=error.errors();}
  catch(Throwable error){failure=error.getClass().getSimpleName();errors=assembler.getErrorList();}
  ArrayList<String> locals=new ArrayList<>(),parsed=new ArrayList<>();LinkedHashSet<Integer> addresses=new LinkedHashSet<>();
  for(int i=0;i<96;i++)addresses.add(Memory.dataBaseAddress+i);
  for(MIPSprogram program:programs){locals.add(symbols(program.getLocalSymbolTable()));parsed.add(statements(program.getParsedList()));if(program.getLocalSymbolTable()!=null)for(Object item:program.getLocalSymbolTable().getDataSymbols()){int addr=((Symbol)item).getAddress();for(int i=0;i<16;i++)addresses.add(addr+i);}}
  ArrayList<String> memory=new ArrayList<>();for(int address:addresses){try{memory.add("["+address+","+Globals.memory.getByte(address)+"]");}catch(AddressErrorException error){memory.add("["+address+",null]");}}
  System.out.println("{\"id\":"+q(id)+",\"config\":"+q(config)+",\"delayed\":"+delayed+",\"bare\":"+bare+",\"extended\":"+extended+",\"warnings\":"+warnings+",\"hex\":"+hex+",\"sources\":["+String.join(",",inputs)+"],\"failure\":"+q(failure)+",\"result\":"+statements(result)+",\"errors\":"+errors(errors)+",\"parsed\":["+String.join(",",parsed)+"],\"locals\":["+String.join(",",locals)+"],\"globals\":"+symbols(Globals.symbolTable)+",\"memory\":["+String.join(",",memory)+"]}");
 }
 private static void one(String id,String text) throws Exception {run(id,"Default",false,false,true,false,true,new String[][]{{"unit.asm",text}});}
 public static void main(String[] args) throws Exception {
  Globals.initialize(false);
  String[] sources={
   "", "# only comment\n", ".data\nb: .byte 1,-128,127,128,255,-129\nh: .half 1,-32768,32767,32768,65535\nw: .word 0xffffffff,2147483647,-2147483648\n.text\nnop",
   ".data\na: .byte 1\nb: .word 2\n.align 0\nc: .byte 3\nd: .word 0x12345678\n.align 3\ne: .half 4\n.space 5\nf: .word 6\n.data\ng: .word 7",
   ".data\nx: .word 1:4\n.half -1:3\n.byte 255:2\n.float 1.5:2\n.double -2.25:2\n.word 2,3\n4,5\n.ascii \"ab\",\"\\n\\t\\r\\b\\f\\0\\\\\\\"\\'\\x\\u1234\"\n\"cd\"\n.asciiz \"éλ😀\"",
   ".data\n.float 0,-0,1.5,-2.5,1e-46,3.4028235e38,NaN\n.double 0,-0,0x1.fffffffffffffp1023,0x0.0000000000001p-1022,0x1.00000000000008p0,0x1.fffffffffffff8p1023,1e400,-1e-400,NaN,Infinity,-Infinity,1f,1D",
   ".data\n.word later\n.half later\n.byte later\nlater:.word 1\n.text\nla $t0,later",
   ".extern shared,4\n.extern shared,8\n.data\nx:.word shared\n.globl main\n.text\nmain:nop\n.kdata\nk:.word main\n.ktext 0x80000180\nnop\n.text\nnop",
   ".text 0x00400004\nnop\n.text 0x00400000\nnop\n.text 0x00400004\nnop", ".text 0x00400001\nnop", ".data 0x7fffffff\n.word 1\n.asciiz \"ab\"",
   ".word 1\n.align 2\n.space 4\n.ascii \"a\"", ".data\n.align\n.align -1\n.align label\n.space\n.space -1\n.space label", ".data\n.word 1:0\n.byte 2:-1\n.float label:2\n.half 1:label\n.word 1:2:3",
   ".extern\n.extern a,-1\n.globl\n.globl 123\n.globl missing", ".data\nx:.word 1\nx:.word 2\n.word missing\n.float label\n.double 0x10\n.ascii 4\n.float 1e40",
   ".set noat\n.unknown ignore\n.text\nnop", ".text\nadd $t0\nadd $t0,$t1,$f0\nsll $t0,$t1,32\naddiu $t0,$t1,65536\n???",
   ".macro\n.end_macro\n.macro add\n.end_macro extra", ".macro first (%x)\n.macro second\n.end_macro", ".macro first ($t0)\n.end_macro", ".macro first (%x)\nadd %x,%x,%x",
   ".macro increment (%x)\nlocal: addiu %x,%x,1\nbne %x,$0,local\n.end_macro\n.text\nincrement($t0)\nincrement $t1",
   ".macro recurse\nrecurse\n.end_macro\nrecurse", "later $t0\n.macro later(%x)\nmove %x,$0\n.end_macro", ".macro one(%x)\nnop\n.end_macro\none $t0,$t1",
   ".eqv VALUE 0x12345678\n.text\nli $t0,VALUE\nblt $t0,20,label\nlabel:nop",
   ".data\n.align 31\nlarge:.byte 1", ".data\n.double 0x1p-1075,0x1.8p-1075,0x1.0000000000001p-1075,0x1.fffffffffffffp-1023,0x1p1024",
   ".text 0x80000000\nnop\n.ktext 0x80000000\nnop", ".data\n.word\n.half\n.asciiz\n.byte 1\nlabel:\n.word 2"
  };
  for(int i=0;i<sources.length;i++)one("case-"+i,sources[i]);
  for(String config:new String[]{"Default","CompactDataAtZero","CompactTextAtZero"})for(boolean delayed:new boolean[]{false,true})run("compact-"+config+"-"+delayed,config,delayed,false,true,false,false,new String[][]{{"unit.asm",".data\nx:.word 1\n.text\nla $t0,x\nlw $t1,x\nli $t2,0x12345678\nblt $t0,32768,label\nlabel:nop"}});
  run("warning-errors","Default",false,false,true,true,true,new String[][]{{"unit.asm",".data\n.byte 255\n.text\nnop"}});
  run("pseudo-disabled","Default",false,false,false,false,true,new String[][]{{"unit.asm","li $t0,1\nnop"}});
  run("bare-registers","Default",false,true,true,false,true,new String[][]{{"unit.asm","add $t0,$t1,$t2\nadd $1,$2,$3"}});
  run("multi","Default",false,false,true,false,true,new String[][]{{"first.asm",".globl entry\n.data\na:.word other\n.text\nentry:jal other"},{"second.asm",".globl other\n.data\nb:.word entry\n.text\nother:jr $ra"}});
  run("multi-duplicate","Default",false,false,true,false,true,new String[][]{{"first.asm",".globl same\nsame:nop"},{"second.asm",".globl same\nsame:nop"}});
  for(String name:new String[]{"integer","data","macro","branch","float","include","undefined","heap","random","arguments","console","main","read-int","overflow","unaligned","unknown-syscall","exit","loop"})run("corpus-"+name,"Default",false,false,true,false,true,new String[][]{{"tests/oracle/programs/"+name+".asm",Files.readString(Path.of("tests/oracle/programs/"+name+".asm"))}});
  int index=0;
  for(Object item:Globals.instructionSet.getInstructionList()){
   Instruction inst=(Instruction)item;
   String source=".text\n"+inst.getExampleFormat()+"\nlabel:nop\n";
   run("catalog-"+(index++),"Default",false,false,true,false,true,new String[][]{{"catalog.asm",source}});
  }
 }
}
