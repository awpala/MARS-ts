import java.util.*;
import mars.*;
import mars.assembler.*;
import mars.mips.instructions.Instruction;

/** Calls the unmodified tokenizer with whole files and explicit source-line probes. */
public final class TokenizerProbe {
    private static String q(String value) {
        if (value == null) return "null";
        StringBuilder out = new StringBuilder("\"");
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (c == '"' || c == '\\') out.append('\\').append(c);
            else if (c < 32 || Character.isSurrogate(c)) out.append(String.format("\\u%04x", (int)c));
            else out.append(c);
        }
        return out.append('"').toString();
    }
    private static String filename(MIPSprogram program) { return program == null ? null : program.getFilename(); }
    private static String tokenList(TokenList tokens) {
        if (tokens == null) return "null";
        ArrayList<String> entries = new ArrayList<>();
        for (int i = 0; i < tokens.size(); i++) {
            Token token = tokens.get(i);
            entries.add("{\"type\":" + q(token.getType().toString()) + ",\"value\":" + q(token.getValue()) + ",\"line\":" + token.getSourceLine() + ",\"column\":" + token.getStartPos() + ",\"originalLine\":" + token.getOriginalSourceLine() + ",\"program\":" + q(filename(token.getSourceMIPSprogram())) + ",\"originalProgram\":" + q(filename(token.getOriginalProgram())) + "}");
        }
        return "{\"processed\":" + q(tokens.getProcessedLine()) + ",\"tokens\":[" + String.join(",", entries) + "]}";
    }
    private static String errors(ErrorList errors) {
        ArrayList<String> list = new ArrayList<>();
        for (Object entry : errors.getErrorMessages()) {
            ErrorMessage error = (ErrorMessage)entry;
            list.add("{\"file\":" + q(error.getFilename()) + ",\"line\":" + error.getLine() + ",\"column\":" + error.getPosition() + ",\"message\":" + q(error.getMessage()) + ",\"history\":" + q(error.getMacroExpansionHistory()) + ",\"warning\":" + error.isWarning() + "}");
        }
        return "[" + String.join(",", list) + "]";
    }
    private static void line(String text, boolean doEqv) {
        Tokenizer tokenizer = new Tokenizer();
        TokenList result = null;
        String failure = null;
        ErrorList caller = new ErrorList();
        try { result = tokenizer.tokenizeLine(7, text, caller, doEqv); }
        catch (Throwable error) { failure = error.getClass().getSimpleName(); }
        System.out.println("{\"kind\":\"line\",\"line\":" + q(text) + ",\"eqv\":" + doEqv + ",\"result\":" + tokenList(result) + ",\"failure\":" + q(failure) + ",\"errors\":" + errors(caller) + ",\"internalErrors\":" + errors(tokenizer.getErrors()) + "}");
    }
    private static class Program extends MIPSprogram {
        private final String name;
        private ArrayList<String> source;
        Program(String name, String... lines) { this.name = name; this.source = new ArrayList<>(Arrays.asList(lines)); }
        public String getFilename() { return name; }
        public ArrayList getSourceList() { return source; }
        public void setSourceLineList(ArrayList<SourceLine> lines) { super.setSourceLineList(lines); source = super.getSourceList(); }
    }
    private static void whole(String id, MIPSprogram program) {
        Tokenizer tokenizer = new Tokenizer();
        ArrayList lists = null;
        String failure = null;
        try { lists = tokenizer.tokenize(program); }
        catch (Throwable error) { failure = error.getClass().getSimpleName(); }
        ArrayList<String> tokenLines = new ArrayList<>();
        if (lists != null) for (Object list : lists) tokenLines.add(tokenList((TokenList)list));
        ArrayList<String> sources = new ArrayList<>();
        if (program.getSourceLineList() != null) for (SourceLine line : program.getSourceLineList()) sources.add("{\"source\":" + q(line.getSource()) + ",\"file\":" + q(line.getFilename()) + ",\"line\":" + line.getLineNumber() + "}");
        ArrayList<String> plain = new ArrayList<>();
        for (Object line : program.getSourceList()) plain.add(q((String)line));
        System.out.println("{\"kind\":\"program\",\"id\":" + q(id) + ",\"failure\":" + q(failure) + ",\"result\":" + (lists == null ? "null" : "[" + String.join(",", tokenLines) + "]") + ",\"sourceMap\":" + (program.getSourceLineList() == null ? "null" : "[" + String.join(",", sources) + "]") + ",\"plainSource\":[" + String.join(",", plain) + "],\"errors\":" + errors(tokenizer.getErrors()) + "}");
    }
    public static void main(String[] args) throws Exception {
        Globals.initialize(false);
        ArrayList<String> operators = new ArrayList<>();
        for (Object value : Globals.instructionSet.getInstructionList()) {
            String name = ((Instruction)value).getName();
            if (!operators.contains(name)) operators.add(name);
        }
        ArrayList<String> names = new ArrayList<>();
        for (String name : operators) names.add(q(name));
        System.out.println("{\"kind\":\"operators\",\"names\":[" + String.join(",", names) + "]}");
        String[] lines = {
            "", "   ", "\t, ,\t", "# comment", "label:lw,$t4,simple#comment", "here: lw $t3, 8($t4)",
            "label  :lw  $t4  ,simple ,  ,  , # comment", "add $t0,$t1,$t2", "ADD $t0,$t1,$t2", "x+4 x-4 +4 -4", "add -4,+5", "1.2e-5 1e+4 e-5", "x+-1 x--1", "1.0p-3", "-\u0661", "\u03b1\u0661:",
            "stuff:.asciiz\"# ,\\n\\\"\",\"aaaaa\"", "\"a\\\"b\" trailing", "\"a\\\\\" next", "\"unterminated", "\"\"", "'a' 'Z' '\u00e9' '\u0000'", "'\\n' '\\t' '\\b' '\\r' '\\f' '\\0' '\\\"' '\\\\' '\\\''", "'\\000' '\\377' '\\400' '\\777' '\\078'", "'\\+07' '\\-00' '\\-01' '\\\u0660\u0660\u0661'", "'\\x' '\\12' '\\1'", "'' 'a 'abc'", "'", "'a", "'ab", "'abc", "'abcd", "'abcde", "'abcdef", "'\ud83d\ude00'", "'a'#comment", "'a'+'b'", "@ ! ? | & ;", ".macro name(%arg,$param)", ".end_macro", ".eqv", ".eqv NAME", ".eqv NAME # only", ".eqv 3 4", ".eqv ONE (ONE)", ".eqv ONE 1", "prefix: .eqv NAME #", ".include \"file.inc\"", "\n\r\u00a0", "a\u0301", "0x1p2 0x1p-2", "NaN +Infinity -Infinity"
        };
        for (String text : lines) { line(text, true); line(text, false); }
        whole("eqv", new Program("eqv.asm", ".eqv ONE, 1", ".eqv TWO, ONE + ONE # hi", "label: li $t0,TWO", ".eqv ONE, 1", ".ascii \"ONE\" # ONE", "ONE: .word ONE", ""));
        whole("eqv-errors", new Program("eqv-errors.asm", ".eqv ONE 1", ".eqv ONE 2", ".eqv 3 4", ".eqv SELF (SELF)", ".eqv MISSING #hi", "@"));
        whole("eqv-character", new Program("eqv-character.asm", ".eqv CHAR 'a'", "li $t0,CHAR", ".eqv NEWLINE '\\n'", "li $t0,NEWLINE"));
        whole("empty", new Program("empty.asm"));
        whole("no-parent", new Program("main.asm", ".include \"absent.inc\""));
        whole("include-unclosed", new Program("tests/oracle/tokenizer-units/inputs/virtual.asm", ".include \"abc"));
        whole("include-quote-only", new Program("tests/oracle/tokenizer-units/inputs/virtual.asm", ".include \""));
        for (String name : new String[] {"main", "duplicate", "recursive", "missing", "include-errors", "include-trailing"}) {
            MIPSprogram program = new MIPSprogram(); program.readSource("tests/oracle/tokenizer-units/inputs/" + name + ".asm"); whole(name, program);
        }
        Tokenizer tokenizer = new Tokenizer();
        ErrorList errors = new ErrorList();
        tokenizer.tokenizeLine(1, "@", errors);
        String exampleFailure = null; TokenList example = null;
        try { example = tokenizer.tokenizeExampleInstruction("add $1,$2,$3"); } catch (Throwable error) { exampleFailure = error.getClass().getSimpleName(); }
        System.out.println("{\"kind\":\"caller-restoration\",\"example\":" + tokenList(example) + ",\"failure\":" + q(exampleFailure) + ",\"callerErrors\":" + errors(errors) + ",\"internalErrors\":" + errors(tokenizer.getErrors()) + "}");
        tokenizer.tokenizeLine(1, "@"); exampleFailure = null;
        try { tokenizer.tokenizeExampleInstruction("add $1,$2,$3"); } catch (Throwable error) { exampleFailure = error.getClass().getSimpleName(); }
        System.out.println("{\"kind\":\"pending-errors\",\"failure\":" + q(exampleFailure) + ",\"errors\":" + errors(tokenizer.getErrors()) + "}");
    }
}
