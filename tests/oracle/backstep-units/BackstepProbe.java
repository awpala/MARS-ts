package mars.simulator;
import mars.*;
import mars.mips.hardware.*;
import mars.simulator.*;
import java.lang.reflect.Field;

/** Exercises the real bounded undo history and its hardware-recording hooks. */
public final class BackstepProbe {
    static final int T = 0x00400000, D = 0x10010000;
    static BackStepper back;
    static void fresh() throws Exception {
        Globals.program = null;
        Globals.memory.clear(); RegisterFile.resetRegisters(); Coprocessor0.resetRegisters(); Coprocessor1.resetRegisters();
        DelayedBranch.clear();
        for (int i = 0; i < 2010; i++) Globals.memory.setStatement(T + i * 4, new ProgramStatement(0, T + i * 4));
        Globals.memory.setWord(D, 0);
        back = new BackStepper();
        Globals.program = new MIPSprogram();
        Field field = MIPSprogram.class.getDeclaredField("backStepper"); field.setAccessible(true); field.set(Globals.program, back);
    }
    static void emit(String key) throws Exception {
        System.out.println(key + "\t" + back.enabled() + "," + back.empty() + "," + back.inDelaySlot() + "," + RegisterFile.getProgramCounter() + "," + RegisterFile.getValue(8) + "," + RegisterFile.getValue(9) + "," + Globals.memory.getWord(D) + "," + Coprocessor0.getValue(8) + "," + Coprocessor1.getValue(0) + "," + Coprocessor1.getConditionFlags());
    }
    public static void main(String[] args) throws Exception {
        Globals.initialize(false); fresh(); emit("fresh");
        RegisterFile.initializeProgramCounter(T + 4);
        RegisterFile.updateRegister(8, 11); RegisterFile.updateRegister(9, 22);
        Globals.memory.setWord(D, 0x12345678); Globals.memory.setHalf(D, 0xaabb); Globals.memory.setByte(D+1, 0xcc); Globals.memory.setRawWord(D, -1);
        Coprocessor0.updateRegister(8, 123); Coprocessor1.updateRegister(0, 456); Coprocessor1.setConditionFlag(3);
        back.addDoNothing(T); emit("group-written"); back.backStep(); emit("group-restored");
        RegisterFile.initializeProgramCounter(T+4); RegisterFile.updateRegister(8, 10);
        RegisterFile.initializeProgramCounter(T+8); RegisterFile.updateRegister(8, 20);
        back.setEnabled(false); back.backStep(); emit("disabled-undo"); back.setEnabled(true);
        back.backStep(); emit("second-undone"); back.backStep(); emit("first-undone");
        RegisterFile.initializeProgramCounter(T+4); Coprocessor1.setConditionFlag(2);
        RegisterFile.initializeProgramCounter(T+8); Coprocessor1.clearConditionFlag(2);
        back.backStep(); emit("condition-restored-set"); back.backStep(); emit("condition-restored-clear");
        RegisterFile.initializeProgramCounter(T+4); RegisterFile.setProgramCounter(T+100);
        emit("branch"); back.backStep(); emit("branch-undone");
        DelayedBranch.register(T+100); DelayedBranch.trigger();
        back.addDoNothing(T+4); emit("delay-recorded"); DelayedBranch.clear(); emit("delay-retained"); back.backStep(); emit("delay-undone");
        fresh(); RegisterFile.initializeProgramCounter(T); RegisterFile.updateRegister(8, 7); RegisterFile.updateRegister(9, 8); back.backStep(); emit("gui-before-program");
        fresh(); RegisterFile.initializeProgramCounter(T+40000); RegisterFile.updateRegister(8, 7); RegisterFile.updateRegister(9, 8); back.backStep(); emit("null-statement-group");
        fresh(); back.setEnabled(false); back.addRegisterFileRestore(8, 99); emit("disabled-add"); back.setEnabled(true); back.backStep(); emit("disabled-add-undone");
        fresh();
        for (int i=0; i<2005; i++) { RegisterFile.initializeProgramCounter(T+(i+1)*4); RegisterFile.updateRegister(8,i+1); }
        int count=0; while (!back.empty()) { back.backStep(); count++; }
        System.out.println("capacity\t"+count); emit("capacity-state");
        fresh(); System.out.println("pc-return\t"+back.addPCRestore(Integer.MIN_VALUE));
        back.backStep(); emit("pc-wrap");
    }
}
