import java.lang.reflect.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import javax.swing.*;
import mars.*;
import mars.mips.hardware.*;
import mars.venus.*;

/** Headless probes of the unchanged Venus formatter, dialog commit, and handler execution. */
public final class ExceptionHandlerProbe {
  static final String BASE = "tests/oracle/exception-handler/sources/";

  static void field(Object target, String name, Object value) throws Exception {
    Field field = target.getClass().getDeclaredField(name);
    field.setAccessible(true);
    field.set(target, value);
  }

  static String b64(String text) {
    return Base64.getEncoder().encodeToString(text.getBytes(StandardCharsets.UTF_8));
  }

  public static void main(String[] args) throws Exception {
    Globals.initialize(false);
    RunAssembleAction action = new RunAssembleAction("Assemble", null, null, null, null, null);
    Method formatter = RunAssembleAction.class.getDeclaredMethod("buildFileNameList", String.class, ArrayList.class);
    formatter.setAccessible(true);
    String[][] cases = {
      {}, {"lead.asm"}, {"handler.asm", "lead.asm"},
      {"x".repeat(39)}, {"x".repeat(40)}, {"x".repeat(40), "lead.asm"},
      {"x".repeat(19), "y".repeat(20)}, {"x".repeat(19), "y".repeat(21)},
      {"x".repeat(61), "y".repeat(61)}, {"lead.asm", "lead.asm"}
    };
    for (String[] names : cases) {
      ArrayList<MIPSprogram> programs = new ArrayList<>();
      for (String name : names) {
        MIPSprogram program = new MIPSprogram();
        field(program, "filename", name);
        programs.add(program);
      }
      String result = (String) formatter.invoke(action, "Assemble: assembling ", programs);
      System.out.println("message\t" + String.join(",", names) + "\t" + b64(result));
    }

    try {
      new MIPSprogram().readSource("missing-exception-handler.asm");
    } catch (ProcessingException error) {
      System.out.println("missing\t" + b64(error.errors().generateErrorReport()));
    }

    Settings settings = Globals.getSettings();
    Method commit = SettingsExceptionHandlerAction.class.getDeclaredMethod("performOK");
    commit.setAccessible(true);
    for (boolean initial : new boolean[]{false, true}) {
      for (boolean enabled : new boolean[]{false, true}) {
        for (String name : new String[]{"old.asm", "new.asm", ""}) {
          settings.setExceptionHandlerEnabled(initial);
          settings.setExceptionHandler("old.asm");
          int[] notices = {0};
          Observer observer = (source, value) -> notices[0]++;
          settings.addObserver(observer);
          SettingsExceptionHandlerAction dialog = new SettingsExceptionHandlerAction("Exception Handler", null, null, null, null, null);
          field(dialog, "initialSelected", initial);
          field(dialog, "initialPathname", "old.asm");
          field(dialog, "exceptionHandlerSetting", new JCheckBox("", enabled));
          field(dialog, "exceptionHandlerDisplay", new JTextField(name));
          commit.invoke(dialog);
          settings.deleteObserver(observer);
          System.out.println("commit\t" + initial + "\t" + enabled + "\t" + name + "\t" + settings.getExceptionHandlerEnabled() + "\t" + settings.getExceptionHandler() + "\t" + notices[0]);
        }
      }
    }

    Globals.program = new MIPSprogram();
    ArrayList<String> files = new ArrayList<>();
    files.add(BASE + "lead.asm");
    ArrayList programs = Globals.program.prepareFilesForAssembly(files, BASE + "lead.asm", BASE + "handler.asm");
    Globals.program.assemble(programs, true, false);
    RegisterFile.resetRegisters();
    Coprocessor0.resetRegisters();
    Globals.program.simulate(100);
    System.out.println("execution\t" + RegisterFile.getValue(8) + "\t" + RegisterFile.getValue(9) + "\t" + Coprocessor0.getValue(12) + "\t" + Coprocessor0.getValue(13) + "\t" + Coprocessor0.getValue(14));
  }
}
