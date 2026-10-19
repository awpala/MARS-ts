import mars.*;
import mars.mips.hardware.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Public-API probe for the canonical Java sparse-memory implementation. */
public class MemoryProbe {
  interface Operation { Object run() throws Exception; }
  static void out(String key, Object value) { System.out.println(key+"\t"+Base64.getEncoder().encodeToString(String.valueOf(value).getBytes(StandardCharsets.UTF_8))); }
  static void attempt(String key, Operation operation) {
    try { out(key,operation.run()); }
    catch(Exception error) { out(key,"!"+error.getClass().getSimpleName()+":"+error.getMessage()); }
  }
  static String bits(double value) { return Long.toString(Double.doubleToLongBits(value)); }
  static String statement(ProgramStatement statement) { return statement==null?"null":Integer.toString(statement.getBinaryStatement()); }
  public static void main(String[] arguments) throws Exception {
    Globals.initialize(false);
    Memory m=Globals.memory;
    for(String config:new String[]{"Default","CompactDataAtZero","CompactTextAtZero"}) {
      MemoryConfigurations.setCurrentConfiguration(MemoryConfigurations.getConfigurationByName(config));
      m.clear(); m.deleteObservers(); m.setByteOrder(Memory.LITTLE_ENDIAN);
      Globals.getSettings().setBooleanSettingNonPersistent(Settings.SELF_MODIFYING_CODE_ENABLED,false);
      out(config+":limits",Memory.textBaseAddress+","+Memory.textLimitAddress+","+Memory.dataSegmentBaseAddress+","+Memory.dataSegmentLimitAddress+","+Memory.stackBaseAddress+","+Memory.stackLimitAddress+","+Memory.kernelTextBaseAddress+","+Memory.kernelTextLimitAddress+","+Memory.kernelDataBaseAddress+","+Memory.kernelDataSegmentLimitAddress+","+Memory.memoryMapBaseAddress+","+Memory.memoryMapLimitAddress+","+m.usingCompactMemoryConfiguration());
      int[] boundaries={Memory.textBaseAddress-1,Memory.textBaseAddress,Memory.textLimitAddress-1,Memory.textLimitAddress,Memory.dataSegmentBaseAddress-1,Memory.dataSegmentBaseAddress,Memory.dataSegmentLimitAddress-1,Memory.dataSegmentLimitAddress,Memory.stackLimitAddress,Memory.stackLimitAddress+1,Memory.stackBaseAddress,Memory.stackBaseAddress+1,Memory.kernelTextBaseAddress,Memory.kernelTextLimitAddress,Memory.kernelDataBaseAddress,Memory.kernelDataSegmentLimitAddress,Memory.memoryMapBaseAddress,Memory.memoryMapLimitAddress-1,Memory.memoryMapLimitAddress,-1};
      for(int i=0;i<boundaries.length;i++) { final int a=boundaries[i]; final String k=config+":bound:"+i; out(k,Memory.inTextSegment(a)+","+Memory.inDataSegment(a)+","+Memory.inKernelTextSegment(a)+","+Memory.inKernelDataSegment(a)+","+Memory.inMemoryMapSegment(a)); attempt(k+":read",()->m.get(a,1)); attempt(k+":raw",()->m.getRawWordOrNull(a)); }
      int[] bases={Memory.dataSegmentBaseAddress,Memory.stackBaseAddress-16,Memory.kernelDataBaseAddress,Memory.memoryMapBaseAddress};
      for(boolean little:new boolean[]{true,false}) {
        m.clear(); m.setByteOrder(little);
        for(int segment=0;segment<bases.length;segment++) {
          final int b=bases[segment]; String k=config+":"+little+":"+segment;
          attempt(k+":initial",()->m.getRawWordOrNull(b));
          attempt(k+":setWord",()->m.setWord(b,0x12345678));
          for(int j=0;j<4;j++) { final int a=b+j; attempt(k+":byte:"+j,()->m.getByte(a)); }
          attempt(k+":word",()->m.getWord(b)); attempt(k+":raw",()->m.getRawWord(b));
          attempt(k+":setHalf",()->m.setHalf(b+2,0xabcd)); attempt(k+":half",()->m.getHalf(b+2));
          attempt(k+":setByte",()->m.setByte(b+1,0x1ff)); attempt(k+":after",()->m.getWordNoNotify(b));
          attempt(k+":unalignedSet",()->m.set(b+3,0x11223344,4)); attempt(k+":unalignedGet",()->m.get(b+3,4)); attempt(k+":next",()->m.getWord(b+4));
          attempt(k+":setRaw",()->m.setRawWord(b,0x01020304)); attempt(k+":rawAfter",()->m.getRawWord(b)); attempt(k+":wordAfterRaw",()->m.getWord(b));
          attempt(k+":setDouble",()->bits(m.setDouble(b+8,-0.0))); attempt(k+":doubleLow",()->m.getWord(b+8)); attempt(k+":doubleHigh",()->m.getWord(b+12));
          attempt(k+":nan",()->bits(m.setDouble(b+8,Double.longBitsToDouble(0x7ff123456789abcdL)))); attempt(k+":nanHigh",()->m.getWord(b+12));
          attempt(k+":badWord",()->m.getWord(b+1)); attempt(k+":badHalf",()->m.getHalf(b+1)); attempt(k+":badRaw",()->m.getRawWord(b+1)); attempt(k+":badStoreWord",()->m.setWord(b+1,1)); attempt(k+":badStoreHalf",()->m.setHalf(b+1,1)); attempt(k+":badStoreRaw",()->m.setRawWord(b+1,1));
        }
      }
      m.clear(); m.setByteOrder(true);
      for(boolean little:new boolean[]{true,false}) {
        for(int segment=0;segment<bases.length;segment++) {
          m.clear(); m.setByteOrder(little);
          final int a=segment==1?Memory.stackBaseAddress-4094:bases[segment]+4094;
          final String k=config+":cross:"+little+":"+segment;
          attempt(k+":write",()->m.set(a,0x89abcdef,4));
          attempt(k+":read",()->m.get(a,4));
          for(int j=0;j<4;j++) { final int at=a+j; attempt(k+":byte:"+j,()->m.getByte(at)); }
        }
      }
      m.clear(); m.setByteOrder(true);
      int d=Memory.dataSegmentBaseAddress;
      attempt(config+":block:write",()->m.setWord(d+4092,0x11223344));
      attempt(config+":block:partialRead",()->m.get(d+4094,4));
      attempt(config+":block:crossWrite",()->m.set(d+4094,0x55667788,4));
      attempt(config+":block:crossRead",()->m.get(d+4094,4));
      attempt(config+":block:next",()->m.getRawWordOrNull(d+4096));
      attempt(config+":block:firstNull",()->m.getAddressOfFirstNull(d,d+12288));
      int edge=Memory.dataSegmentLimitAddress-2;
      attempt(config+":edge:write",()->m.set(edge,0x12345678,4));
      attempt(config+":edge:read",()->m.get(edge,4));
      m.clear();
      for(int size:new int[]{0,1,2,3,4,7,-1,0x7fffffff}) { attempt(config+":heap:"+size,()->m.allocateBytesFromHeap(size)); out(config+":heapAt:"+size,Memory.heapAddress); }
      m.clear(); int capacity=Memory.dataSegmentLimitAddress-Memory.heapAddress; attempt(config+":heap:capacity",()->m.allocateBytesFromHeap(capacity));
      m.clear(); int t=Memory.textBaseAddress,kt=Memory.kernelTextBaseAddress;
      attempt(config+":text:empty",()->statement(m.getStatement(t)));
      m.setStatement(t,new ProgramStatement(0x2408002a,t)); m.setStatement(kt,new ProgramStatement(0,kt));
      attempt(config+":text:stored",()->statement(m.getStatementNoNotify(t))); attempt(config+":text:dump",()->m.getRawWordOrNull(t)); attempt(config+":kernel:stored",()->statement(m.getStatement(kt)));
      m.setStatement(t,null); out(config+":text:nullClears",statement(m.getStatementNoNotify(t))); m.setStatement(t,new ProgramStatement(0x2408002a,t));
      Globals.debug=true; boolean debugNullFailure=false;
      try { m.setStatement(t,null); } catch(NullPointerException error) { debugNullFailure=true; } finally { Globals.debug=false; }
      out(config+":text:debugNullFailure",debugNullFailure); out(config+":text:debugNullUnchanged",statement(m.getStatementNoNotify(t)));
      attempt(config+":text:readDisabled",()->m.getWord(t)); attempt(config+":text:writeDisabled",()->m.setWord(t,0)); attempt(config+":kernel:read",()->m.getWord(kt)); attempt(config+":kernel:write",()->m.setWord(kt,0));
      attempt(config+":text:unaligned",()->statement(m.getStatement(t+1))); attempt(config+":text:outside",()->statement(m.getStatement(d))); attempt(config+":text:storeOutside",()->{m.setStatement(d,new ProgramStatement(0,d));return "ok";});
      Globals.getSettings().setBooleanSettingNonPersistent(Settings.SELF_MODIFYING_CODE_ENABLED,true);
      attempt(config+":text:writeEnabled",()->m.setRawWord(t,0)); attempt(config+":text:readEnabled",()->m.getWord(t));
      attempt(config+":text:byteWrite",()->m.setByte(t,0x2408002a)); attempt(config+":text:byteRead",()->m.getByte(t));
      m.setWord(d,0x2408002a); attempt(config+":data:statement",()->statement(m.getStatement(d)));
      List<String> notices=new ArrayList<>(); Observer observer=(o,n)->notices.add(n.toString()); m.addObserver(observer,d);
      attempt(config+":data:silentStatement",()->statement(m.getStatementNoNotify(d))); out(config+":data:silentNotices",String.join("|",notices)); m.deleteObservers();
    }
    MemoryConfigurations.setCurrentConfiguration(MemoryConfigurations.getDefaultConfiguration()); m.clear(); m.setByteOrder(true); m.deleteObservers();
    for(int a:new int[]{0,1,2,3,4,-1,-2,-3,-4,Integer.MAX_VALUE,Integer.MIN_VALUE}) out("align:"+a,Memory.wordAligned(a)+","+Memory.doublewordAligned(a)+","+Memory.alignToWordBoundary(a));
    int d=Memory.dataBaseAddress;
    List<String> notices=new ArrayList<>(); Observer a=(o,n)->notices.add("a:"+n), b=(o,n)->notices.add("b:"+n);
    m.addObserver(a,d); m.addObserver(b,d,d+4); m.addObserver(a,d); out("observers:count",m.countObservers());
    m.setByte(d+3,99); m.getByte(d+4); m.getWordNoNotify(d); m.getRawWordOrNull(d); out("observers:sequence",String.join("|",notices));
    m.deleteObserver(a); out("observers:afterDelete",m.countObservers()); notices.clear(); m.getByte(d); out("observers:remaining",String.join("|",notices));
    m.clear(); notices.clear(); m.getByte(d); out("observers:afterClear",String.join("|",notices));
    m.deleteObservers(); out("observers:empty",m.countObservers()); m.addObserver(a); out("observers:all",m.countObservers());
    attempt("observers:badStart",()->{m.addObserver(a,d+1,d+4);return "ok";}); attempt("observers:badEnd",()->{m.addObserver(a,d,d+1);return "ok";}); attempt("observers:crossSign",()->{m.addObserver(a,0x7ffffffc,0x80000000);return "ok";}); attempt("observers:reversed",()->{m.addObserver(a,d+4,d);return "ok";}); attempt("observers:notify",()->{m.notifyObservers();return "ok";});
    m.deleteObservers(); Observer adding=(o,n)->{try { m.addObserver(a,d); } catch(AddressErrorException error) { throw new RuntimeException(error); }}; m.addObserver(adding,d); attempt("observers:mutating",()->m.getByte(d));
    m.deleteObservers(); notices.clear(); m.addObserver(a,d+4); m.set(d+3,0x12345678,4); out("observers:startOnly",String.join("|",notices));
    m.deleteObservers(); notices.clear(); m.addObserver(a); m.setRawWord(-4,1); m.getByte(-2); m.getStatement(Memory.kernelTextBaseAddress); out("observers:signedRanges",String.join("|",notices));
  }
}
