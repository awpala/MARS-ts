package mars.mips.instructions;
import mars.*;
import mars.mips.hardware.*;
import javax.swing.*;
import java.awt.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Execute the actual random/dialog service classes; only Swing user responses are automated. */
public final class PlatformSyscallProbe {
  private static String b64(String text) { return Base64.getEncoder().encodeToString(text.getBytes(StandardCharsets.UTF_8)); }
  private static final int DATA = 0x10010000;
  private static SyscallLoader loader;
  private static ProgramStatement statement;
  private static int row = 0;
  private static void run(int service, int a0, int a1, int a2, int f12, int f13, String input, int action, boolean gui) throws Exception {
    if(gui && !SwingUtilities.isEventDispatchThread()) {
      SwingUtilities.invokeAndWait(() -> { try { run(service,a0,a1,a2,f12,f13,input,action,true); } catch(Exception error) { throw new RuntimeException(error); } });
      return;
    }
    RegisterFile.resetRegisters(); Coprocessor0.resetRegisters(); Coprocessor1.resetRegisters();
    RegisterFile.setProgramCounter(0x00400004);
    RegisterFile.updateRegister(2, service); RegisterFile.updateRegister(4,a0); RegisterFile.updateRegister(5,a1); RegisterFile.updateRegister(6,a2);
    Coprocessor1.updateRegister(0,0x12345678); Coprocessor1.updateRegister(1,0x76543210);
    Coprocessor1.updateRegister(12,f12); Coprocessor1.updateRegister(13,f13);
    for(int i=-8;i<32;i++) Globals.memory.setByte(DATA+64+i,0x7e);
    Globals.memory.setByte(0x103fffff,0x7e);
    int[] bytes={65,127,128,255,0}; for(int i=0;i<bytes.length;i++) Globals.memory.setByte(DATA+i,bytes[i]);
    for(int i=0;i<3;i++) Globals.memory.setByte(DATA+32+i,new int[]{66,255,0}[i]);
    final String[] message={""}; final int[] type={-99};
    javax.swing.Timer responder = new javax.swing.Timer(5, event -> {
      for(Window window:Window.getWindows()) if(window instanceof JDialog && window.isShowing()) {
        JOptionPane pane=findPane((Container)window);
        if(pane==null) continue;
        message[0]=String.valueOf(pane.getMessage()); type[0]=pane.getMessageType();
        if(pane.getWantsInput()) { pane.setInputValue(input); pane.setValue(input==null?JOptionPane.CANCEL_OPTION:JOptionPane.OK_OPTION); }
        else pane.setValue(action);
      }
    });
    if(gui) responder.start();
    String outcome="ok";
    try { loader.findSyscall(service).simulate(statement); }
    catch(ProcessingException error) { outcome=error.errors()==null?"exit":error.errors().generateErrorReport(); }
    catch(Exception error) { outcome=error.getClass().getName()+":"+error.getMessage(); }
    finally { responder.stop(); }
    StringJoiner state=new StringJoiner(",");
    for(int r:new int[]{2,4,5,6}) state.add(""+RegisterFile.getValue(r));
    for(int r:new int[]{0,1}) state.add(""+Coprocessor1.getValue(r));
    for(int r:new int[]{8,12,13,14}) state.add(""+Coprocessor0.getValue(r));
    for(int i=-8;i<32;i++) state.add(""+Globals.memory.getByte(DATA+64+i));
    state.add(""+Globals.memory.getByte(0x103fffff));
    System.out.println(service+"\t"+(row++)+"\t"+a0+"\t"+a1+"\t"+a2+"\t"+f12+"\t"+f13+"\t"+(input==null?"null":b64(input))+"\t"+action+"\t"+b64(outcome)+"\t"+b64(message[0])+"\t"+type[0]+"\t"+state);
  }
  private static JOptionPane findPane(Container root) {
    if(root instanceof JOptionPane) return (JOptionPane)root;
    for(Component child:root.getComponents()) if(child instanceof Container) { JOptionPane pane=findPane((Container)child); if(pane!=null) return pane; }
    return null;
  }
  public static void main(String[] args) throws Exception {
    Globals.initialize(false); Globals.memory.clear(); loader=new SyscallLoader();loader.loadSyscalls();
    statement=new ProgramStatement(null,"",null,null,(Instruction)Globals.instructionSet.matchOperator("syscall").get(0),0x00400000,0);
    boolean gui=!GraphicsEnvironment.isHeadless();
    if(!gui) {
      int[] seeds={0,-1,Integer.MAX_VALUE,Integer.MIN_VALUE,123456789};
      int[] ids={0,-7,Integer.MAX_VALUE,Integer.MIN_VALUE,42};
      int[] bounds={1,2,3,16,1073741825,Integer.MAX_VALUE,0,-1,Integer.MIN_VALUE};
      for(int i=0;i<seeds.length;i++) {
        run(40,ids[i],seeds[i],0,0,0,"",0,false);
        for(int j=0;j<bounds.length;j++) for(int service:new int[]{41,42,43,44}) run(service,ids[i],bounds[j],0,0,0,"",0,false);
      }
      // Revisit independent streams and reseed an existing one.
      for(int id:ids) run(41,id,0,0,0,0,"",0,false);
      run(40,ids[0],seeds[0],0,0,0,"",0,false); run(41,ids[0],0,0,0,0,"",0,false);
    } else {
      String[] inputs={null,"","0","-2147483648","2147483647","2147483648"," 42 ","١٢٣","abc","NaN","Infinity","-0.0","0x1.8p2","1.0000000596046447753906250001","é😀x"," ","\t-2.5\n"};
      for(int action:new int[]{0,1,2,-1}) run(50,DATA,99,0,0,0,"",action,true);
      for(int service:new int[]{51,52,53}) for(String input:inputs) run(service,DATA,99,0,0,0,input,0,true);
      for(int length:new int[]{Integer.MIN_VALUE,-2,0,1,2,4,5,8,Integer.MAX_VALUE}) for(String input:new String[]{null,"","a","abcd","é😀x"}) run(54,DATA,DATA+64,length,0,0,input,0,true);
      for(int type:new int[]{Integer.MIN_VALUE,-1,0,1,2,3,4,Integer.MAX_VALUE}) run(55,DATA,type,0,0,0,"",0,true);
      for(int value:new int[]{0,-1,Integer.MIN_VALUE,Integer.MAX_VALUE}) run(56,DATA,value,0,0,0,"",0,true);
      for(int bits:new int[]{0,0x80000000,0x3fc00000,1,0x7f7fffff,0x7fc12345,0x7f800000,0xff800000}) run(57,DATA,99,0,bits,0,"",0,true);
      for(double value:new double[]{0,-0.0,1.25,Double.MIN_VALUE,Double.MAX_VALUE,Double.NaN,Double.POSITIVE_INFINITY,Double.NEGATIVE_INFINITY}) {
        long bits=Double.doubleToRawLongBits(value); run(58,DATA,99,0,(int)bits,(int)(bits>>>32),"",0,true);
      }
      run(59,DATA,DATA+32,0,0,0,"",0,true);
      for(int service=50;service<=59;service++) run(service,0,DATA+64,8,0,0,"a",0,true);
      run(54,DATA,0,8,0,0,"a",0,true); run(59,DATA,0,0,0,0,"",0,true);
      // A write straddling the segment end must preserve partial writes and the prior status register.
      run(54,DATA,0x103fffff,8,0,0,"abcd",0,true);
    }
    if(gui) SwingUtilities.invokeAndWait(() -> { for(Window window:Window.getWindows()) window.dispose(); });
  }
}
