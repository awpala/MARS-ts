import java.nio.file.*;
import java.util.*;
import mars.*;
import mars.mips.dump.*;
import mars.mips.hardware.*;

/** Captures bytes from the unchanged legacy format classes and populated GUI ranges. */
public final class DumpProbe {
  private static final int[] WORDS = {0, -1, 0x7fffffff, 0x80000000, 0x12345678, 0x00410a09, 0x0d0c085c, 0x20217f80, 42};
  private static final class Program extends MIPSprogram {
    private ArrayList<String> source = new ArrayList<>(Arrays.asList(".text", "main: li $t0, 0x12345678 # source é", "addiu $t1, $t0, -1", "syscall"));
    public String getFilename() { return "dump.asm"; }
    public ArrayList getSourceList() { return source; }
    public void setSourceLineList(ArrayList<mars.assembler.SourceLine> lines) { super.setSourceLineList(lines); source = super.getSourceList(); }
  }
  private static void dump(String config, String id, int first, int last) throws Exception {
    for (Object item : new DumpFormatLoader().loadDumpFormats()) {
      DumpFormat format = (DumpFormat) item;
      Path file = Files.createTempFile("mars-dump-", ".out");
      String bytes = "";
      String error = "";
      try {
        format.dumpMemoryRange(file.toFile(), first, last);
      } catch (AddressErrorException ex) { error = ex.getMessage(); }
      finally { bytes = Base64.getEncoder().encodeToString(Files.readAllBytes(file)); Files.delete(file); }
      System.out.println(config + "\t" + id + "\t" + format.getCommandDescriptor() + "\t" + first + "\t" + last + "\t" + bytes + "\t" + error);
    }
  }
  public static void main(String[] args) throws Exception {
    Globals.initialize(false);
    for (String config : new String[]{"Default", "CompactDataAtZero", "CompactTextAtZero"}) {
      MemoryConfigurations.setCurrentConfiguration(MemoryConfigurations.getConfigurationByName(config));
      Globals.memory.clear();
      Program program = new Program(); program.tokenize();
      ArrayList<MIPSprogram> programs = new ArrayList<>(); programs.add(program);
      Globals.program = program;
      new mars.assembler.Assembler().assemble(programs, true, false);
      int base = Memory.dataBaseAddress;
      for (int i = 0; i < WORDS.length; i++) Globals.memory.setRawWord(base + i * 4, WORDS[i]);
      int high = Globals.memory.getAddressOfFirstNull(base, Memory.dataSegmentLimitAddress) - 4;
      int textHigh = Globals.memory.getAddressOfFirstNull(Memory.textBaseAddress, Memory.textLimitAddress) - 4;
      System.out.println(config + "\tranges\t" + Memory.textBaseAddress + "\t" + textHigh + "\t" + base + "\t" + high);
      for (boolean hexAddresses : new boolean[]{true, false}) for (boolean hexValues : new boolean[]{true, false}) {
        Globals.getSettings().setBooleanSettingNonPersistent(Settings.DISPLAY_ADDRESSES_IN_HEX, hexAddresses);
        Globals.getSettings().setBooleanSettingNonPersistent(Settings.DISPLAY_VALUES_IN_HEX, hexValues);
        dump(config, "data-" + hexAddresses + "-" + hexValues, base, base + 32);
        dump(config, "text-" + hexAddresses + "-" + hexValues, Memory.textBaseAddress, textHigh + 8);
      }
      dump(config, "partial", base, base + 24);
      dump(config, "empty", base + 4096, base + 4100);
      dump(config, "unaligned", base + 1, base + 5);
      dump(config, "block-end", high - 4, high + 8);
      dump(config, "reversed", base + 4, base);
      Globals.memory.setByteOrder(false);
      Globals.memory.setWord(base, 0x12345678);
      dump(config, "big-endian", base, base + 32);

    }
  }
}
