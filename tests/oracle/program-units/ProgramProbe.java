import mars.*;
import mars.assembler.*;
import mars.mips.hardware.*;
import java.util.*;

/** Public program lifecycle oracle, using only dedicated fixture sources. */
public final class ProgramProbe {
 static final String BASE="tests/oracle/program-units/sources/";
 static String q(String s) {if(s==null)return "null";return "\""+s.replace("\\","\\\\").replace("\"","\\\"").replace("\n","\\n").replace("\r","\\r").replace("\t","\\t")+"\"";}
 static String strings(ArrayList values) {if(values==null)return "null";StringJoiner j=new StringJoiner(",","[","]");for(Object v:values)j.add(q((String)v));return j.toString();}
 static String snapshot(MIPSprogram p) {
  StringJoiner mapping=new StringJoiner(",","[","]"),tokens=new StringJoiner(",","[","]"),machine=new StringJoiner(",","[","]");
  if(p.getSourceLineList()!=null) for(SourceLine l:p.getSourceLineList())mapping.add("["+q(l.getSource())+","+q(l.getFilename())+","+l.getLineNumber()+","+(l.getMIPSprogram()==p)+"]");
  if(p.getTokenList()!=null) for(Object raw:p.getTokenList()){TokenList list=(TokenList)raw;StringJoiner line=new StringJoiner(",","[","]");for(int i=0;i<list.size();i++){Token t=list.get(i);line.add("["+q(t.getType().toString())+","+q(t.getValue())+","+t.getSourceLine()+","+t.getStartPos()+"]");}tokens.add(line.toString());}
  if(p.getMachineList()!=null)for(Object raw:p.getMachineList()){ProgramStatement s=(ProgramStatement)raw;machine.add("["+s.getAddress()+","+s.getBinaryStatement()+"]");}
  return "{\"filename\":"+q(p.getFilename())+",\"source\":"+strings(p.getSourceList())+",\"mapping\":"+(p.getSourceLineList()==null?"null":mapping)+",\"tokens\":"+(p.getTokenList()==null?"null":tokens)+",\"parsed\":"+(p.getParsedList()==null?"null":p.getParsedList().size())+",\"machine\":"+(p.getMachineList()==null?"null":machine)+",\"tokenizer\":"+(p.getTokenizer()!=null)+",\"symbols\":"+(p.getLocalSymbolTable()!=null)+",\"macro\":"+(p.getLocalMacroPool()!=null)+",\"backstep\":"+(p.getBackStepper()!=null)+",\"enabled\":"+p.backSteppingEnabled()+",\"stepped\":"+p.inSteppedExecution()+"}";
 }
 static void emit(String key,MIPSprogram p) {System.out.println("{\"kind\":\"state\",\"key\":"+q(key)+",\"state\":"+snapshot(p)+"}");}
 static void error(String key,MIPSprogram p,ProcessingException e) {System.out.println("{\"kind\":\"error\",\"key\":"+q(key)+",\"errors\":"+q(e.errors().generateErrorReport())+",\"state\":"+snapshot(p)+"}");}
 public static void main(String[] args)throws Exception {
  Globals.initialize(false);
  MIPSprogram p=new MIPSprogram();emit("fresh",p);
  for(String file:new String[]{"empty.txt","blank.txt","mixed.txt","unicode.txt","lead.asm","include.asm"}){
   p=new MIPSprogram();p.readSource(BASE+file);emit("read:"+file,p);
   StringJoiner lines=new StringJoiner(",","[","]");for(int i=-1;i<=p.getSourceList().size()+2;i++)lines.add(q(p.getSourceLine(i)));
   System.out.println("{\"kind\":\"lines\",\"key\":"+q(file)+",\"lines\":"+lines+"}");
   if(file.endsWith(".asm")){p.tokenize();emit("tokenize:"+file,p);}
  }
  p=new MIPSprogram();p.readSource(BASE+"lead.asm");p.tokenize();
  ArrayList<SourceLine> mapping=new ArrayList<>();mapping.add(new SourceLine("replacement",p,9));p.setSourceLineList(mapping);mapping.add(new SourceLine("later",p,10));emit("mapping-alias",p);
  p.getSourceList().add("direct source edit");emit("source-alias",p);
  ArrayList parsed=p.createParsedList();parsed.add(new ProgramStatement(0,0));emit("parsed-alias",p);p.createParsedList();emit("parsed-replace",p);
  MacroPool pool=p.createMacroPool();emit("macro-created",p);p.setLocalMacroPool(null);emit("macro-cleared",p);p.setLocalMacroPool(pool);emit("macro-restored",p);
  try{p.readSource(BASE+"missing.asm");}catch(ProcessingException e){error("read-failure-retains-other-state",p,e);}
  p=new MIPSprogram();p.readSource(BASE+"lead.asm");p.tokenize();p.readSource(BASE+"bad.asm");try{p.tokenize();}catch(ProcessingException e){error("tokenize-failure-retains-old-tokens-symbols",p,e);}
  String[][] cases={{"other.asm","lead.asm"},{"lead.asm","other.asm"},{"other.asm"},{"lead.asm","lead.asm"},{}};
  for(int c=0;c<cases.length;c++)for(boolean handler:new boolean[]{false,true}){
   p=new MIPSprogram();ArrayList<String> files=new ArrayList<>();for(String f:cases[c])files.add(BASE+f);
   ArrayList programs=p.prepareFilesForAssembly(files,BASE+"lead.asm",handler?BASE+"handler.asm":null);
   StringJoiner result=new StringJoiner(",","[","]");for(Object value:programs){MIPSprogram program=(MIPSprogram)value;result.add("{\"own\":"+(program==p)+",\"state\":"+snapshot(program)+"}");}
   System.out.println("{\"kind\":\"prepare\",\"case\":"+c+",\"handler\":"+handler+",\"files\":"+strings(files)+",\"programs\":"+result+",\"lead\":"+snapshot(p)+"}");
  }
 }
}
