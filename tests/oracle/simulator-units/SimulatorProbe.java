package mars.simulator;

import mars.*;
import mars.mips.hardware.*;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Calls the canonical simulator directly, without the MarsLaunch command-line adapter. */
public final class SimulatorProbe {
    static final int T = 0x00400000;
    static final Simulator simulator = Simulator.getInstance();
    static final List<String> notices = new ArrayList<>();
    static String b64(String text) { return Base64.getEncoder().encodeToString(text.getBytes(StandardCharsets.UTF_8)); }
    static String ints(int[] values) { return Arrays.toString(values).replace(" ", ""); }
    static void run(String id, int[] words, int pc, int max, int[] points, boolean delayed, int t0, int interrupt, boolean handler) throws Exception {
        Globals.program = null;
        Globals.memory.clear(); RegisterFile.resetRegisters(); Coprocessor0.resetRegisters(); Coprocessor1.resetRegisters(); DelayedBranch.clear();
        Globals.getSettings().setDelayedBranchingEnabledNonPersistent(delayed);
        for (int i = 0; i < words.length; i++) Globals.memory.setStatement(T + 4*i, new ProgramStatement(words[i],T+4*i));
        if (handler) Globals.memory.setStatement(Memory.exceptionHandlerAddress, new ProgramStatement(0,Memory.exceptionHandlerAddress));
        RegisterFile.updateRegister(8,t0);
        Globals.program = new MIPSprogram();
        BackStepper back = new BackStepper();
        Field field = MIPSprogram.class.getDeclaredField("backStepper"); field.setAccessible(true); field.set(Globals.program,back);
        Simulator.externalInterruptingDevice = interrupt;
        notices.clear();
        String input = "\"id\":\""+id+"\",\"words\":"+ints(words)+",\"start\":"+pc+",\"max\":"+max+",\"points\":"+(points==null?"null":ints(points))+",\"delayed\":"+delayed+",\"t0\":"+t0+",\"interrupt\":"+interrupt+",\"handler\":"+handler;
        String done = "null", error = "";
        try { done = Boolean.toString(simulator.simulate(Globals.program,pc,max,points,null)); }
        catch (ProcessingException e) { error = e.errors().generateErrorReport(); }
        int[] state = {RegisterFile.getProgramCounter(),RegisterFile.getValue(8),RegisterFile.getValue(9),RegisterFile.getValue(2),Coprocessor0.getValue(8),Coprocessor0.getValue(12),Coprocessor0.getValue(13),Coprocessor0.getValue(14),Simulator.externalInterruptingDevice};
        System.out.println("{"+input+",\"done\":"+done+",\"error\":\""+b64(error)+"\",\"state\":"+ints(state)+",\"branch\":["+DelayedBranch.isRegistered()+","+DelayedBranch.isTriggered()+"],\"empty\":"+back.empty()+",\"notices\":\""+b64(String.join("\n",notices))+"\"}");
    }
    public static void main(String[] args) throws Exception {
        Globals.initialize(false);
        simulator.addObserver((observable,value)->notices.add(value.toString()));
        int[] line = {0x24080001,0x25090002,0};
        run("empty",new int[]{},T,0,null,false,0,0,false);
        for (int limit : new int[]{-1,0,1,2,3,4}) run("linear-"+limit,line,T,limit,null,false,0,0,false);
        run("breakpoint",line,T,0,new int[]{T+8,T+4},false,0,0,false);
        run("initial-breakpoint",line,T,0,new int[]{T},false,0,0,false);
        run("empty-breakpoints",line,T,0,new int[]{},false,0,0,false);
        run("breakpoint-before-limit",line,T,1,new int[]{T+4},false,0,0,false);
        run("exit",new int[]{0x2402000a,0x0000000c,0x24080063},T,0,null,false,0,0,false);
        for (boolean delay : new boolean[]{false,true}) {
            run("branch-"+delay,new int[]{0x10000002,0x24080001,0x24080002,0x24090003},T,0,null,delay,0,0,false);
            run("branch-step-"+delay,new int[]{0x10000002,0x24080001,0x24080002,0x24090003},T,1,null,delay,0,0,false);
            run("branch-breakpoint-"+delay,new int[]{0x10000002,0x24080001,0x24080002,0x24090003},T,0,new int[]{T+12},delay,0,0,false);
            run("branch-cliff-"+delay,new int[]{0x10000002},T,0,null,delay,0,0,false);
            run("nested-branch-"+delay,new int[]{0x10000002,0x10000003,0,0x24080001,0x24090002},T,6,null,delay,0,0,false);
        }
        for (int pc : new int[]{T+1,0,0x10010000,0x7ffffffc,-1}) run("invalid-pc-"+pc,new int[]{0},pc,0,null,false,0,0,false);
        run("bad-jr",new int[]{0x01000008},T,0,null,false,7,0,false);
        run("undefined",new int[]{-1},T,0,null,false,0,0,false);
        run("overflow",new int[]{0x21090001},T,0,null,false,Integer.MAX_VALUE,0,false);
        run("load-address",new int[]{0x8d090001},T,0,null,false,0x10010000,0,false);
        run("handler",new int[]{-1},T,0,null,false,0,0,true);
        run("handler-step",new int[]{-1},T,1,null,false,0,0,true);
        run("interrupt",line,T,0,null,false,0,0xffff0000,false);
        run("interrupt-handler",line,T,0,null,false,0,0xffff0008,true);
    }
}
