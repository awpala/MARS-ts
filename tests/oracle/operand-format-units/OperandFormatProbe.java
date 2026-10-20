package mars.assembler;
import java.util.*;
import mars.*;
import mars.mips.instructions.*;

/** Invokes package-visible canonical operand validation and overload selection. */
public final class OperandFormatProbe {
 private static String q(String value) {
  if(value==null)return "null"; StringBuilder out=new StringBuilder("\"");
  for(int i=0;i<value.length();i++){char c=value.charAt(i);if(c=='"'||c=='\\')out.append('\\').append(c);else if(c<32||Character.isSurrogate(c))out.append(String.format("\\u%04x",(int)c));else out.append(c);}return out.append('"').toString();
 }
 private static String tokens(TokenList list) {
  ArrayList<String> out=new ArrayList<>();for(int i=0;i<list.size();i++){Token t=list.get(i);out.add("{\"type\":"+q(t.getType().toString())+",\"value\":"+q(t.getValue())+",\"line\":"+t.getSourceLine()+",\"column\":"+t.getStartPos()+"}");}return "["+String.join(",",out)+"]";
 }
 private static String spec(Instruction inst) {return "{\"example\":"+q(inst.getExampleFormat())+",\"tokens\":"+tokens(inst.getTokenList())+"}";}
 private static String errors(ErrorList errors) {
  ArrayList<String> out=new ArrayList<>();for(Object item:errors.getErrorMessages()){ErrorMessage e=(ErrorMessage)item;out.add("{\"file\":"+q(e.getFilename())+",\"line\":"+e.getLine()+",\"column\":"+e.getPosition()+",\"message\":"+q(e.getMessage())+"}");}return "["+String.join(",",out)+"]";
 }
 private static final class Definition extends Instruction {
  Definition(TokenTypes type) {exampleFormat="op operand";description="";mnemonic="op";tokenList=new TokenList();tokenList.add(new Token(TokenTypes.OPERATOR,"op",null,1,1));tokenList.add(new Token(type,"operand",null,1,4));}
 }
 private static TokenList candidate(TokenTypes type,String value) {TokenList list=new TokenList();list.add(new Token(TokenTypes.OPERATOR,"op",null,7,3));list.add(new Token(type,value,null,7,6));return list;}
 private static void check(Instruction inst,TokenList source,boolean bare) {
  Globals.getSettings().setBooleanSettingNonPersistent(Settings.BARE_MACHINE_ENABLED,bare);
  TokenList cand=(TokenList)source.clone();String before=tokens(cand),failure=null;Boolean result=null;ErrorList errors=new ErrorList();
  try{result=OperandFormat.tokenOperandMatch(cand,inst,errors);}catch(Throwable error){failure=error.getClass().getSimpleName();}
  System.out.println("{\"kind\":\"check\",\"spec\":"+spec(inst)+",\"before\":"+before+",\"bare\":"+bare+",\"result\":"+result+",\"failure\":"+q(failure)+",\"after\":"+tokens(cand)+",\"errors\":"+errors(errors)+"}");
 }
 private static void best(TokenList cand,ArrayList matches,boolean bare) {
  Globals.getSettings().setBooleanSettingNonPersistent(Settings.BARE_MACHINE_ENABLED,bare);
  String before=tokens(cand),failure=null;Integer index=null;ArrayList<String> specs=new ArrayList<>();if(matches!=null)for(Object match:matches)specs.add(spec((Instruction)match));
  try{Instruction match=OperandFormat.bestOperandMatch(cand,matches);index=match==null?null:matches.indexOf(match);}catch(Throwable error){failure=error.getClass().getSimpleName();}
  System.out.println("{\"kind\":\"best\",\"specs\":"+(matches==null?"null":"["+String.join(",",specs)+"]")+",\"before\":"+before+",\"bare\":"+bare+",\"index\":"+index+",\"failure\":"+q(failure)+",\"after\":"+tokens(cand)+"}");
 }
 public static void main(String[] args) throws Exception {
  Globals.initialize(false);
  java.lang.reflect.Method initialize=Instruction.class.getDeclaredMethod("createExampleTokenList");initialize.setAccessible(true);
  for(Object item:Globals.instructionSet.getInstructionList()) initialize.invoke(item);
  TokenTypes[] types={TokenTypes.COMMENT,TokenTypes.DIRECTIVE,TokenTypes.OPERATOR,TokenTypes.DELIMITER,TokenTypes.REGISTER_NAME,TokenTypes.REGISTER_NUMBER,TokenTypes.FP_REGISTER_NAME,TokenTypes.IDENTIFIER,TokenTypes.LEFT_PAREN,TokenTypes.RIGHT_PAREN,TokenTypes.INTEGER_5,TokenTypes.INTEGER_16,TokenTypes.INTEGER_16U,TokenTypes.INTEGER_32,TokenTypes.REAL_NUMBER,TokenTypes.QUOTED_STRING,TokenTypes.PLUS,TokenTypes.MINUS,TokenTypes.COLON,TokenTypes.ERROR,TokenTypes.MACRO_PARAMETER};
  for(TokenTypes expected:types)for(TokenTypes actual:types)for(boolean bare:new boolean[]{false,true})check(new Definition(expected),candidate(actual,"12"),bare);
  for(TokenTypes expected:new TokenTypes[]{TokenTypes.INTEGER_5,TokenTypes.INTEGER_16,TokenTypes.INTEGER_16U,TokenTypes.INTEGER_32})for(TokenTypes actual:new TokenTypes[]{TokenTypes.INTEGER_16,TokenTypes.INTEGER_16U})for(String value:new String[]{"-32769","-32768","-1","0","31","32","32767","32768","65535","65536","0xffffffff","bad"})check(new Definition(expected),candidate(actual,value),false);
  for(Object item:Globals.instructionSet.getInstructionList()) {
   Instruction inst=(Instruction)item;TokenList list=inst.getTokenList();
   if(list==null) continue;
   for(boolean bare:new boolean[]{false,true})check(inst,list,bare);
  }
  Instruction inst=new Definition(TokenTypes.REGISTER_NUMBER);TokenList empty=new TokenList();check(inst,empty,false);
  TokenList shortList=candidate(TokenTypes.REGISTER_NAME,"$t0");shortList.remove(1);check(inst,shortList,false);
  TokenList longList=candidate(TokenTypes.REGISTER_NUMBER,"$8");longList.add(new Token(TokenTypes.INTEGER_5,"1",null,7,10));check(inst,longList,false);
  best(candidate(TokenTypes.INTEGER_5,"1"),null,false);best(candidate(TokenTypes.INTEGER_5,"1"),new ArrayList(),false);
  ArrayList single=new ArrayList();single.add(inst);best(candidate(TokenTypes.INTEGER_5,"1"),single,false);
  ArrayList mutation=new ArrayList();mutation.add(new Definition(TokenTypes.IDENTIFIER));mutation.add(new Definition(TokenTypes.OPERATOR));best(candidate(TokenTypes.OPERATOR,"add"),mutation,false);
  for(String source:new String[]{"li $t0,1","li $t0,65535","li $t0,65536","lw $t0,4($t1)","lw $t0,label","add $t0,$t1,32768","add $t0,$t1,$t2","beq $t0,$t1,add","rol $t0,$t1,32","add $f0,$f1,$f2","add $t0"})for(boolean bare:new boolean[]{false,true}) {
   TokenList list=new Tokenizer().tokenizeExampleInstruction(source);best(list,Globals.instructionSet.matchOperator(list.get(0).getValue()),bare);
  }
 }
}
