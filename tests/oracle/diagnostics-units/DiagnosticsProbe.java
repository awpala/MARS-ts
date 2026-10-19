import java.util.ArrayList;
import java.util.Base64;
import java.nio.charset.StandardCharsets;
import mars.ErrorMessage;
import mars.ProcessingException;
import mars.Globals;
import mars.mips.hardware.RegisterFile;
import mars.mips.hardware.Coprocessor0;
import mars.mips.hardware.AddressErrorException;
import mars.ErrorList;
import mars.MIPSprogram;
import mars.ProgramStatement;
import mars.assembler.SourceLine;

/** Calls unmodified MARS diagnostics; no substitute diagnostic implementation. */
public final class DiagnosticsProbe {
    private static void output(String key, String value) {
        System.out.println(key + "\t" + Base64.getEncoder().encodeToString(value.getBytes(StandardCharsets.UTF_8)));
    }
    private static void message(String key, ErrorMessage value) {
        output(key, value.isWarning() + "|" + value.getFilename() + "|" + value.getLine() + "|" + value.getPosition() + "|" + value.getMessage() + "|" + value.getMacroExpansionHistory());
    }
    public static void main(String[] args) {
        ErrorMessage basic = new ErrorMessage("file.asm", 4, 8, "bad operand");
        ErrorMessage warning = new ErrorMessage(true, "inc.asm", 6, 2, "warning", "12->20");
        message("basic", basic);
        message("warning", warning);
        message("null-program", new ErrorMessage((MIPSprogram)null, -1, 0, "unknown"));
        message("null-history", new ErrorMessage("name.asm", 0, -1, "empty", null));
        message("default-program", new ErrorMessage(new MIPSprogram(), 2, 1, "default"));
        MIPSprogram mapped = new MIPSprogram() {
            public String getFilename() { return "top.asm"; }
            public ArrayList<SourceLine> getSourceLineList() {
                ArrayList<SourceLine> lines = new ArrayList<>();
                lines.add(new SourceLine("x", new MIPSprogram() { public String getFilename() { return "included.asm"; } }, 91));
                return lines;
            }
        };
        message("include", new ErrorMessage(mapped, 1, 3, "mapped"));
        String[] sources = {"syscall", "  <13> syscall", "<13> <25> syscall", "label: <3> syscall", "<2147483648> syscall", "<0012> syscall", "<13> x <22>", "\u00a0<13> syscall"};
        for (int i = 0; i < sources.length; i++) {
            ProgramStatement statement = new ProgramStatement(null, sources[i], null, null, null, 0x400000, 40);
            message("runtime-" + i, new ErrorMessage(statement, "runtime"));
        }
        ErrorList list = new ErrorList();
        list.add(basic);
        list.add(warning, 0);
        list.add(new ErrorMessage("a//b///", 0, 0, "path"));
        list.add(new ErrorMessage("/", -1, 3, "root"));
        list.add(new ErrorMessage((MIPSprogram)null, 0, 0, "no location"));
        output("report", list.generateErrorAndWarningReport());
        output("counts", list.errorCount() + "|" + list.warningCount() + "|" + list.errorsOccurred() + "|" + list.warningsOccurred() + "|" + list.errorLimitExceeded() + "|" + list.getErrorLimit());
        ErrorList limit = new ErrorList();
        for (int i = 0; i < limit.getErrorLimit(); i++) limit.add(new ErrorMessage("x", i + 1, 2, "e"));
        limit.add(new ErrorMessage(true, "x", 999, 3, "ignored warning", ""), 0);
        limit.add(basic);
        output("limit", limit.errorCount() + "|" + limit.warningCount() + "|" + limit.errorLimitExceeded() + "|" + limit.getErrorMessages().size());
        message("terminal", (ErrorMessage)limit.getErrorMessages().get(limit.getErrorMessages().size() - 1));
        ErrorList empty = new ErrorList();
        output("empty", empty.generateErrorAndWarningReport() + "|" + empty.errorsOccurred() + "|" + empty.warningsOccurred());
        Globals.initialize(false);
        output("processing-exit", String.valueOf(new ProcessingException().errors() == null));
        output("processing-list", String.valueOf(new ProcessingException(list).errors() == list));
        for (int kind = 0; kind < 4; kind++) {
            RegisterFile.initializeProgramCounter(0);
            Coprocessor0.resetRegisters();
            ProgramStatement statement = new ProgramStatement(null, "<13> syscall", null, null, null, 0, 40);
            AddressErrorException address = new AddressErrorException("bad address ", 4, 0x80000001);
            ProcessingException exception;
            if (kind == 0) exception = new ProcessingException(statement, "problem");
            else if (kind == 1) exception = new ProcessingException(statement, "problem", 12);
            else if (kind == 2) exception = new ProcessingException(statement, address);
            else exception = new ProcessingException(list, address);
            output("processing-report-" + kind, exception.errors().generateErrorAndWarningReport());
            output("processing-registers-" + kind, Coprocessor0.getValue(8) + "|" + Coprocessor0.getValue(12) + "|" + Coprocessor0.getValue(13) + "|" + Coprocessor0.getValue(14));
        }

    }
}
