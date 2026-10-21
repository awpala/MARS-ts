import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.StringTokenizer;
import mars.Globals;
import mars.mips.hardware.Memory;
import mars.mips.hardware.MemoryConfigurations;
import mars.mips.hardware.RegisterFile;
import mars.simulator.ProgramArgumentList;

/** Observes the unchanged argument tokenizer, raw stack bytes, argv words, and register setup. */
public final class ProgramArgumentsProbe {
  public static void main(String[] args) throws Exception {
    Globals.initialize(false);
    String[][] cases = {
      {"empty", "Default", ""},
      {"whitespace", "Default", " \t\n\r\f "},
      {"ascii", "Default", "first second"},
      {"delimiters", "Default", " a\tb\nc\rd\fe "},
      {"quotes", "Default", "\"two words\" 'three four'"},
      {"non-delimiters", "Default", "a\u00a0b c\u000bd"},
      {"unicode", "Default", "éĀ😀"},
      {"gap-edge", "Default", "x".repeat(4095)},
      {"gap-crossed", "Default", "x".repeat(4096)},
      {"unaligned-clearance", "Default", "x".repeat(4101)},
      {"compact-data", "CompactDataAtZero", "first second"},
      {"compact-text", "CompactTextAtZero", "first second"}
    };
    for (String[] item : cases) {
      MemoryConfigurations.setCurrentConfiguration(MemoryConfigurations.getConfigurationByName(item[1]));
      Globals.memory.clear();
      RegisterFile.resetRegisters();
      RegisterFile.getUserRegister("$a0").setValue(91);
      RegisterFile.getUserRegister("$a1").setValue(92);
      RegisterFile.getUserRegister("$sp").setValue(Memory.stackPointer - 64);
      new ProgramArgumentList(item[2]).storeProgramArguments();
      int sp = RegisterFile.getValue(29);
      int count = new StringTokenizer(item[2]).countTokens();
      StringBuilder row = new StringBuilder("{\"id\":\"" + item[0] + "\",\"configuration\":\"" + item[1]
        + "\",\"input\":\"" + Base64.getEncoder().encodeToString(item[2].getBytes(StandardCharsets.UTF_8))
        + "\",\"registers\":[" + sp + "," + RegisterFile.getValue(4) + "," + RegisterFile.getValue(5) + "],\"stack\":[");
      if (count > 0) {
        for (int i = 0; i < count + 2; i++) {
          if (i > 0) row.append(',');
          row.append(Globals.memory.getWord(sp + i * 4));
        }
      }
      row.append("],\"strings\":[");
      StringTokenizer tokens = new StringTokenizer(item[2]);
      for (int i = 0; i < count; i++) {
        if (i > 0) row.append(',');
        int address = Globals.memory.getWord(RegisterFile.getValue(5) + i * 4);
        int length = tokens.nextToken().length();
        row.append('[');
        for (int j = 0; j <= length; j++) {
          if (j > 0) row.append(',');
          row.append(Globals.memory.getByte(address + j) & 255);
        }
        row.append(']');
      }
      System.out.println(row.append("]}"));
    }
  }
}
