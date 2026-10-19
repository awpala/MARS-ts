import mars.Globals;
import mars.util.Binary;
import mars.assembler.DataTypes;
import mars.assembler.Directives;
import mars.mips.hardware.*;
import java.util.*;
import mars.simulator.Exceptions;

/** External probe: invokes canonical Java classes without modifying the legacy tree. */
public class Probe {
  static void out(String label, Object value) { System.out.println(label + "=" + value); }
  interface Operation { Object run() throws Exception; }
  static void attempt(String label, Operation operation) {
    try { out(label, operation.run()); }
    catch (Exception error) { out(label, "!" + error.getClass().getSimpleName()); }
  }
  public static void main(String[] args) throws Exception {
    Globals.initialize(false);
    for (int c=0; c<=65535; c++) if (Character.digit((char)c,16)>=0) out("digit:"+c,Character.digit((char)c,16));
    for (String value : new String[]{"١٢٣", "１２３", "0xＡＢ", "०१२", "-١٢", "+१२", "0xＦＦＦＦＦＦＦＦ", "𝟙"}) {
      attempt("unicodeInt:"+value,()->Binary.stringToInt(value));
      attempt("unicodeLong:"+value,()->Binary.stringToLong(value));
    }
    int[] words = {0, 1, -1, Integer.MIN_VALUE, Integer.MAX_VALUE, 0x12345678, 0x000a2080};
    for (int v : words) {
      String key = "word:" + v;
      out(key, Binary.intToBinaryString(v) + "," + Binary.intToHexString(v) + "," + Binary.intToHalfHexString(v) + "," + Binary.unsignedIntToIntString(v) + "," + Binary.intToAscii(v));
      for (int b : new int[]{0, 1, 7, 31, 32, -1}) out(key + ":bit:" + b, Binary.bitValue(v,b) + "," + Binary.setBit(v,b) + "," + Binary.clearBit(v,b));
      for (int b = 0; b < 4; b++) out(key + ":byte:" + b, Binary.getByte(v,b) + "," + Binary.setByte(v,b,0x1ab));
    }
    out("wide32", Binary.intToBinaryString(1, 36));
    out("wide64", Binary.longToBinaryString(1L, 68));
    for (String v : new String[]{"", "0", "-0", "+1", "42", "077", "08", "-077", "0x7fffffff", "0x80000000", "0xffffffff", "0xFFFFFFFF", "-0x80000000", "-0x1", "#ff", "2147483648", "4294967295", "4294967296", "18446744073709551616", "-2147483649", " 1", "1 ", "0x100000000", "0xffffffffffffffff", "9223372036854775807", "-9223372036854775808", "+0x1", "0x", "++1"}) {
      attempt("parseInt:" + v, () -> Binary.stringToInt(v));
      attempt("parseLong:" + v, () -> Binary.stringToLong(v));
      out("classify:" + v, Binary.isHex(v) + "," + Binary.isOctal(v));
    }
    for (String v : new String[]{"", "1", "0000", "1111", "10000", "102x", "11111111111111111111111111111111", "1111111111111111111111111111111111111111111111111111111111111111"}) {
      attempt("bitsInt:" + v, () -> Binary.binaryStringToInt(v));
      attempt("bitsLong:" + v, () -> Binary.binaryStringToLong(v));
      out("bitsHex:" + v, Binary.binaryStringToHexString(v) + "," + Binary.binaryStringToHexDigit(v));
    }
    out("hexBits", Binary.hexStringToBinaryString("0XAf-012x"));
    for (long v : new long[]{0, 1, -1, Long.MIN_VALUE, Long.MAX_VALUE, 0x123456789abcdef0L}) out("long:" + v, Binary.longToBinaryString(v) + "," + Binary.longToHexString(v) + "," + Binary.highOrderLongToInt(v) + "," + Binary.lowOrderLongToInt(v) + "," + Binary.twoIntsToLong(Binary.highOrderLongToInt(v),Binary.lowOrderLongToInt(v)));
    for (Object item : Directives.getDirectiveList()) {
      Directives d = (Directives)item;
      out("size:"+d, DataTypes.getLengthInBytes(d));
      for (int v : new int[]{-32769,-32768,-129,-128,0,127,128,32767,32768}) out("range:"+d+":"+v,DataTypes.outOfRange(d,v));
      for (double v : new double[]{-Double.MAX_VALUE, -Float.MAX_VALUE, 0, Float.MAX_VALUE, Double.MAX_VALUE, Double.NaN, Double.POSITIVE_INFINITY}) out("floatRange:"+d+":"+Double.toHexString(v),DataTypes.outOfRange(d,v));
    }
    Register r = new Register("test",7,-1);
    List<String> events = new ArrayList<>();
    Observer first = (o,n) -> events.add("first:"+n);
    Observer second = (o,n) -> events.add("second:"+n);
    r.addObserver(first); r.addObserver(second); r.addObserver(first);
    out("register:get",r.getValue()); out("register:set",r.setValue(12));
    out("register:peek",r.getValueNoNotify()); r.changeResetValue(99); r.resetValue();
    out("register:reset",r.getValueNoNotify()); r.deleteObserver(second); r.getValue();
    out("register:events",String.join("|",events));
    List<String> accesses = new ArrayList<>();
    Observer observe = (o,n) -> accesses.add(n.toString());
    RegisterFile.addRegistersObserver(observe);
    out("rf:zero", RegisterFile.updateRegister(0, 5));
    out("rf:t0", RegisterFile.updateRegister(8, -1));
    out("rf:t0read", RegisterFile.getValue(8));
    out("rf:hi", RegisterFile.updateRegister(33,123));
    out("rf:lo", RegisterFile.updateRegister(34,-456));
    out("rf:hiRead", RegisterFile.getValue(33)); out("rf:loRead", RegisterFile.getValue(34));
    out("rf:unknown", RegisterFile.updateRegister(35,99));
    for(String n: new String[]{"$zero","$0","$08","$0x1f","$","$32","zero","$s8",""}) attempt("rf:lookup:"+n,()-> { Register q=RegisterFile.getUserRegister(n); return q==null?"null":q.getName(); });
    RegisterFile.initializeProgramCounter(0x7ffffffc); RegisterFile.incrementPC(); out("rf:pc",RegisterFile.getProgramCounter());
    out("rf:pcOld",RegisterFile.setProgramCounter(4));
    out("rf:events",String.join("|",accesses)); RegisterFile.deleteRegistersObserver(observe);
    RegisterFile.resetRegisters();
    out("rf:reset",RegisterFile.getValue(8)+","+RegisterFile.getValue(28)+","+RegisterFile.getValue(29)+","+RegisterFile.getProgramCounter()+","+RegisterFile.getValue(33));
    accesses.clear(); Coprocessor0.addRegistersObserver(observe);
    out("cp0:status",Coprocessor0.getValue(12)); out("cp0:update",Coprocessor0.updateRegister(8,42)); out("cp0:string",Coprocessor0.updateRegister("$8",43)); out("cp0:unknown",Coprocessor0.getValue(7));
    out("cp0:events",String.join("|",accesses)); Coprocessor0.deleteRegistersObserver(observe); Coprocessor0.resetRegisters();
    accesses.clear(); Coprocessor1.addRegistersObserver(observe);
    Coprocessor1.setRegisterPairToLong(2,0x123456789abcdef0L); out("cp1:pair",Coprocessor1.getLongFromRegisterPair(2));
    out("cp1:events",String.join("|",accesses)); Coprocessor1.deleteRegistersObserver(observe);
    for (long v : new long[]{0,Long.MIN_VALUE,0x7ff0000000000000L,0x7ff8123456789abcL,0x0000000000000001L}) {
      Coprocessor1.setRegisterPairToLong(0,v); out("cp1:raw:"+v,Coprocessor1.getLongFromRegisterPair(0));
      Coprocessor1.setRegisterPairToDouble(2,Double.longBitsToDouble(v)); out("cp1:double:"+v,Coprocessor1.getLongFromRegisterPair(2));
    }
    for(int v:new int[]{0,Integer.MIN_VALUE,0x3f800000,0x7f800000,0x7fc12345,1}) { Coprocessor1.setRegisterToInt(0,v); Coprocessor1.setRegisterToFloat(1,Float.intBitsToFloat(v)); out("cp1:float:"+v,Coprocessor1.getIntFromRegister(1)); }
    for(int n:new int[]{1,-1,31}) attempt("cp1:odd:"+n,()->Coprocessor1.getLongFromRegisterPair(n));
    Coprocessor1.setConditionFlags(); out("cp1:all",Coprocessor1.getConditionFlags()); out("cp1:clear7",Coprocessor1.clearConditionFlag(7)); out("cp1:flags",Coprocessor1.getConditionFlags()); out("cp1:invalid",Coprocessor1.getConditionFlag(99)); Coprocessor1.clearConditionFlags(); out("cp1:set3",Coprocessor1.setConditionFlag(3)); out("cp1:one",Coprocessor1.getConditionFlags()); Coprocessor1.resetRegisters(); out("cp1:reset",Coprocessor1.getConditionFlags()+","+Coprocessor1.getValue(0));
    Iterator configurations = MemoryConfigurations.getConfigurationsIterator();
    while(configurations.hasNext()) { MemoryConfiguration c=(MemoryConfiguration)configurations.next(); out("config:"+c.getConfigurationIdentifier(),c.getConfigurationName()+"|"+Arrays.toString(c.getConfigurationItemValues())); out("configChange:"+c.getConfigurationIdentifier(),MemoryConfigurations.setCurrentConfiguration(c)); out("configRegs:"+c.getConfigurationIdentifier(),RegisterFile.getValue(28)+","+RegisterFile.getValue(29)+","+RegisterFile.getProgramCounter()); }
    out("config:null",MemoryConfigurations.setCurrentConfiguration(null));
    out("config:same",MemoryConfigurations.setCurrentConfiguration(MemoryConfigurations.getCurrentConfiguration()));
    for(int cause:new int[]{4,5,8,9,10,12,13,15,16,17,64,128}) {
      Coprocessor0.resetRegisters(); Coprocessor0.updateRegister(13,-1); RegisterFile.initializeProgramCounter(Integer.MIN_VALUE);
      accesses.clear(); Coprocessor0.addRegistersObserver(observe);
      Exceptions.setRegisters(cause,0xabcdef01);
      Coprocessor0.deleteRegistersObserver(observe);
      out("exception:"+cause,Coprocessor0.getValue(8)+","+Coprocessor0.getValue(12)+","+Coprocessor0.getValue(13)+","+Coprocessor0.getValue(14));
      out("exceptionEvents:"+cause,String.join("|",accesses));
    }
    for(int address:new int[]{0,Integer.MIN_VALUE,-1,0x10010003}) {
      AddressErrorException e=new AddressErrorException("bad address ",4,address); out("addressError:"+address,e.getMessage()+"|"+e.getAddress()+"|"+e.getType());
      MemoryAccessNotice n=new MemoryAccessNotice(AccessNotice.WRITE,address,-1); out("memoryNotice:"+address,n+"|"+n.getAddress()+"|"+n.getLength()+"|"+n.getValue()+"|"+n.accessIsFromGUI()+"|"+n.accessIsFromMIPS());
    }
  }
}
