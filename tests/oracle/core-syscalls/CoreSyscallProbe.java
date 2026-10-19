package mars.mips.instructions;
import mars.*;
import mars.mips.hardware.*;
import mars.mips.instructions.syscalls.*;
import mars.util.SystemIO;
import java.io.*;
import java.lang.reflect.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Direct service execution, isolated input, raw output, and machine/error state. */
public final class CoreSyscallProbe {
  private static String b64(String text){return Base64.getEncoder().encodeToString(text.getBytes(StandardCharsets.UTF_8));}
  public static void main(String[] args)throws Exception {
    Globals.initialize(false); Globals.memory.clear();
    PrintStream report=System.out;
    Field reader=SystemIO.class.getDeclaredField("inputReader");reader.setAccessible(true);
    int[] services={1,2,3,4,5,6,7,8,9,10,11,12,17,34,35,36};
    int[] values={0,-1,Integer.MAX_VALUE,Integer.MIN_VALUE,1,5,255,256};
    String[] inputs={"0"," -42 ","2147483648","","١٢٣","0x1.8p2","NaN","abc","é😀x","5.5","Infinity","1.0000000596046447753906250001"};
    SyscallLoader loader=new SyscallLoader(); loader.loadSyscalls();
    for(int service:services)for(int n=0;n<inputs.length;n++) {
      RegisterFile.resetRegisters();Coprocessor0.resetRegisters();Coprocessor1.resetRegisters();
      RegisterFile.setProgramCounter(0x00400004); RegisterFile.updateRegister(4,values[n%values.length]);RegisterFile.updateRegister(5,new int[]{-1,0,1,2,4,8}[n%6]);
      for(int i=0;i<16;i++)Globals.memory.setByte(0x10010000+i,0x7e);
      if(service==4) { RegisterFile.updateRegister(4,n==11?0:0x10010000); for(int i=0;i<5;i++) Globals.memory.setByte(0x10010000+i,new int[]{65,127,128,255,0}[i]); }
      if(service==8)RegisterFile.updateRegister(4,n==11?0:0x10010000);
      if(service==9)RegisterFile.updateRegister(4,new int[]{0,1,4,-1,Integer.MAX_VALUE,8}[n%6]);
      if(service==2)Coprocessor1.updateRegister(12,new int[]{0,0x80000000,0x3fc00000,0x7fc12345,0x7f800000,0xff800000,1,0x7f7fffff}[n%8]);
      if(service==3)Coprocessor1.setRegisterPairToDouble(12,new double[]{0,-0.0,1.25,Double.NaN,Double.POSITIVE_INFINITY,Double.NEGATIVE_INFINITY,Double.MIN_VALUE,Double.MAX_VALUE}[n%8]);
      ByteArrayOutputStream output=new ByteArrayOutputStream();System.setOut(new PrintStream(output,true,StandardCharsets.UTF_8));
      reader.set(null,new BufferedReader(new StringReader(inputs[n]+"\n")));
      ProgramStatement statement=new ProgramStatement(null,"",null,null,(Instruction)Globals.instructionSet.matchOperator("syscall").get(0),0x00400000,0);
      String outcome="ok";
      try{loader.findSyscall(service).simulate(statement);}catch(ProcessingException error){outcome=error.errors()==null?"exit":error.errors().generateErrorReport();}catch(Exception error){outcome=error.getClass().getName()+":"+error.getMessage();}
      System.setOut(report);
      StringJoiner state=new StringJoiner(",");for(int register:new int[]{2,4,5})state.add(""+RegisterFile.getValue(register));for(int register:new int[]{0,1})state.add(""+Coprocessor1.getValue(register));for(int register:new int[]{8,12,13,14})state.add(""+Coprocessor0.getValue(register));for(int i=0;i<16;i++)state.add(""+Globals.memory.getByte(0x10010000+i));
      report.println(service+"\t"+n+"\t"+b64(inputs[n])+"\t"+b64(output.toString(StandardCharsets.UTF_8))+"\t"+b64(outcome)+"\t"+state);
    }
  }
}
