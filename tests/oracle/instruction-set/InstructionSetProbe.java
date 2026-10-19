package mars.simulator;
import mars.mips.instructions.*;
import java.util.*;
import java.nio.charset.StandardCharsets;
import mars.*;
import mars.mips.hardware.*;
import mars.simulator.DelayedBranch;

/** Executes every canonical callback with explicit operands and repeatable machine states. */
public final class InstructionSetProbe {
  private static final int[] VALUES = {0, -1, Integer.MAX_VALUE, Integer.MIN_VALUE, 1, -2, 0x3fc00000, 0x7fc12345, 0x7f800000, 0xff800000, 0x80000000, 0x40240000, 0x40160000, 0xc0160000, 0x4f000000, 0xcf000001};
  private static String encode(String value) { return Base64.getEncoder().encodeToString(value.getBytes(StandardCharsets.UTF_8)); }
  public static void main(String[] args) throws Exception {
    Globals.initialize(false); Globals.memory.clear();
    int index = 0;
    for (Object raw : Globals.instructionSet.getInstructionList()) {
      if (!(raw instanceof BasicInstruction)) continue;
      BasicInstruction instruction = (BasicInstruction) raw;
      for (int scenario=0; scenario<VALUES.length*2; scenario++) {
        RegisterFile.resetRegisters(); Coprocessor0.resetRegisters(); Coprocessor1.resetRegisters(); DelayedBranch.clear();
        Globals.getSettings().setDelayedBranchingEnabledNonPersistent(scenario % 2 == 1);
        int a=VALUES[scenario%VALUES.length], b=VALUES[(scenario+(scenario<16?3:1))%VALUES.length];
        for(int r=1;r<32;r++) { RegisterFile.updateRegister(r, r%4<2?b:a); Coprocessor1.updateRegister(r,r%4<2?b:a); }
        Coprocessor1.updateRegister(0,b);
        if(scenario>=16) {
          double[] doubles={-5.5,-4.5,4.5,5.5,2147483647.5,-2147483648.5,Double.NaN,Double.POSITIVE_INFINITY,Double.NEGATIVE_INFINITY,0.0,-0.0,Double.MIN_VALUE,Double.MAX_VALUE,1.25,-2.75,Math.sqrt(2)};
          for(int r=0;r<32;r+=2) Coprocessor1.setRegisterPairToDouble(r,doubles[(scenario-16+(r%4==0?1:0))%16]);
        } RegisterFile.updateRegister(33,0x87654321); RegisterFile.updateRegister(34,0x12345678);
        Coprocessor1.setConditionFlags(); if(scenario%2==0) Coprocessor1.clearConditionFlags();
        Coprocessor0.updateRegister(14,0x00400200); RegisterFile.setProgramCounter(0x00400004);
        for(int i=-8;i<20;i+=4) Globals.memory.setWord(0x10010000+i,0x89abcdef+i);
        ProgramStatement statement = new ProgramStatement(null,"",null,null,instruction,0x00400000,0);
        int[] operands=statement.getOperands();
        String mask=instruction.getOperationMask();
        for(int n=0;n<3;n++) {
          char code="fst".charAt(n); int first=mask.indexOf(code), last=mask.lastIndexOf(code);
          if(first<0) continue;
          int width=last-first+1;
          operands[n]=width==5 ? (n+1)*2 : width==3 ? scenario%8 : width==16 ? (scenario%2==0?-1:1) : 4;
        }
        String name=instruction.getName();
        if(instruction.getExampleFormat().contains("($t2)")) {
          operands[0]=2; operands[1]=new int[]{0,1,2,3,-1,4,-4,8}[scenario%8]; operands[2]=6;
          RegisterFile.updateRegister(6,scenario==15?0:0x10010000);
        }
        if(name.equals("mfc0") || name.equals("mtc0")) operands[1]=12;
        if(name.equals("syscall")) RegisterFile.updateRegister(2,99999);
        if(name.contains(".d") && scenario==5) operands[name.startsWith("c.")&&mask.indexOf('f')>=0&&mask.lastIndexOf('f')-mask.indexOf('f')==2?1:0]=3;
        if(name.contains(".d") && scenario==21) operands[1]=3;
        String outcome="ok";
        try { instruction.getSimulationCode().simulate(statement); }
        catch(ProcessingException e) { outcome=e.errors()==null?"exit":e.errors().generateErrorReport(); }
        catch(Exception e) { outcome=e.getClass().getName()+":"+e.getMessage(); }
        StringBuilder state=new StringBuilder();
        for(int r=0;r<35;r++) { if(r==32) continue; state.append(RegisterFile.getValue(r)).append(','); }
        state.append(RegisterFile.getProgramCounter()).append(',');
        for(int r=0;r<32;r++) state.append(Coprocessor1.getValue(r)).append(',');
        for(int r:new int[]{8,12,13,14}) state.append(Coprocessor0.getValue(r)).append(',');
        state.append(Coprocessor1.getConditionFlags()).append(',').append(DelayedBranch.isRegistered()?1:0).append(',').append(DelayedBranch.getBranchTargetAddress()).append(',');
        for(int i=-8;i<20;i+=4) state.append(Globals.memory.getWord(0x10010000+i)).append(',');
        System.out.println(index+"\t"+scenario+"\t"+encode(instruction.getExampleFormat())+"\t"+Arrays.toString(operands)+"\t"+encode(outcome)+"\t"+state);
      }
      index++;
    }
    System.out.println("COUNT\t"+index+"\t"+Globals.instructionSet.getInstructionList().size());
    for(Object raw: Globals.instructionSet.getInstructionList()) {
      Instruction instruction=(Instruction)raw;
      if(instruction instanceof ExtendedInstruction) {
        ExtendedInstruction extended=(ExtendedInstruction)instruction;
        System.out.println("P\t"+encode(extended.getExampleFormat())+"\t"+encode(extended.getDescription())+"\t"+encode(String.valueOf(extended.getBasicIntructionTemplateList()))+"\t"+encode(String.valueOf(extended.getCompactBasicIntructionTemplateList()))+"\t"+extended.getInstructionLength()+"\t"+extended.getCompactInstructionLength());
      } else {
        BasicInstruction basic=(BasicInstruction)instruction;
        for(int bits:new int[]{0,-1,0x13579bdf,0x2468ace0}) {
          int word=basic.getOpcodeMatch() | (bits & ~basic.getOpcodeMask());
          BasicInstruction found=Globals.instructionSet.findByBinaryCode(word);
          System.out.println("D\t"+word+"\t"+encode(found==null?"":found.getExampleFormat()));
        }
      }
    }
    for(String name:new String[]{"ADD","addı","ADDİ","ſLL","SYSCALL","","no-such-op"}) {
      ArrayList matched=Globals.instructionSet.matchOperator(name); StringJoiner examples=new StringJoiner("\n");
      if(matched!=null)for(Object match:matched)examples.add(((Instruction)match).getExampleFormat());
      System.out.println("M\t"+encode(name)+"\t"+encode(matched==null?"<null>":examples.toString()));
    }
    Random random=new Random(12345);
    for(int n=0;n<1024;n++) { int word=random.nextInt(); BasicInstruction found=Globals.instructionSet.findByBinaryCode(word); System.out.println("D\t"+word+"\t"+encode(found==null?"":found.getExampleFormat())); }
  }
}
