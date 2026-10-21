import mars.Globals;
import mars.mips.hardware.MemoryConfigurations;
import mars.simulator.ProgramArgumentList;

/** Captures the canonical fatal diagnostic when argument bytes exceed a compact address space. */
public final class ProgramArgumentsFailureProbe {
  public static void main(String[] args) {
    Globals.initialize(false);
    MemoryConfigurations.setCurrentConfiguration(MemoryConfigurations.getConfigurationByName("CompactDataAtZero"));
    new ProgramArgumentList("x".repeat(16384)).storeProgramArguments();
    throw new AssertionError("Expected the legacy fatal exit");
  }
}
