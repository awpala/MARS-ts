package mars.simulator;

import mars.assembler.Directives;
import mars.assembler.Symbol;
import mars.assembler.SourceLine;
import mars.assembler.Token;
import mars.assembler.TokenList;
import mars.assembler.TokenTypes;
import mars.assembler.SymbolTable;
import mars.assembler.Macro;
import mars.assembler.MacroPool;
import mars.ErrorList;
import mars.ErrorMessage;
import mars.Globals;
import mars.MIPSprogram;

/** Tests the immutable legacy classes without modifying their source tree. */
public final class AssemblerProbe {
    private static void branch(String label) {
        System.out.println("branch\t" + label + "\t" + DelayedBranch.isRegistered() + "\t"
            + DelayedBranch.isTriggered() + "\t" + DelayedBranch.getBranchTargetAddress());
    }

    private static final class NamedProgram extends MIPSprogram {
        String filename;
        java.util.ArrayList<TokenList> tokenLines = new java.util.ArrayList<>();
        java.util.ArrayList<String> sourceLines = new java.util.ArrayList<>();
        NamedProgram(String filename) { this.filename = filename; }
        public String getFilename() { return filename; }
        public java.util.ArrayList getTokenList() { return tokenLines; }
        public String getSourceLine(int line) { return line > 0 && line <= sourceLines.size() ? sourceLines.get(line - 1) : null; }
    }
    private static void list(String label, TokenList list) {
        System.out.println("list\t" + label + "\t" + list.size() + "\t" + list.isEmpty() + "\t" + list.getProcessedLine() + "\t" + list.toString() + "\t" + list.toTypeString());
    }
    private static void table(String label, SymbolTable table) {
        java.util.ArrayList<String> symbols = new java.util.ArrayList<>();
        for (Object value : table.getAllSymbols()) {
            Symbol symbol = (Symbol) value;
            symbols.add(symbol.getName() + ":" + symbol.getAddress() + ":" + symbol.getType());
        }
        System.out.println("table\t" + label + "\t" + table.getSize() + "\t" + String.join(",", symbols));
    }
    private static String name(Symbol symbol) { return symbol == null ? "null" : symbol.getName(); }
    private static Token token(String name) { return new Token(TokenTypes.IDENTIFIER, name, null, 3, 7); }
    private static String encoded(String value) { return java.util.Base64.getEncoder().encodeToString(value.getBytes(java.nio.charset.StandardCharsets.UTF_8)); }
    private static void lexical() {
        Globals.initialize(false);
        String[] values = {"", "'x'", "#comment", "(", ")", ":", "+", "-", ",", "%", "%arg", "$", "$arg", "$t0", "$8", "$08", "$fp", "$s8", "$32", "$f0", "$f31", "$f32", "$12 (status)", "0", "31", "32", "32767", "32768", "65535", "65536", "-1", "-32768", "-32769", "2147483647", "2147483648", "4294967295", "4294967296", "0x80000000", "0xffff", "-0x80000000", "0x1ffffffff", "08", "010", "+010", "1.0", ".5", "1.", "1e20", "-1E-4", "1f", "1D", "1e", "1e+", "0x1p2", "0X.8P-4f", "0x1.p10D", "0x1.0", "NaN", "+NaN", "-NaN", "nan", "Infinity", "+Infinity", "-Infinity", "infinity", "NaNf", "1e99999", " 1 ", "\t1.5\n", "\u00001.5\u0000", "\u00a01.5", "add", "ADD", "li", "syscall", "unknown", ".DATA", ".unknown", ".", "\"unterminated", "a$b._3", "_label", "9label", "\u03b1\u0661", "\u4e2d\u6587", "a\u0301", "\u2160", "\ud801\udc00", "a-b", "1_0", "0b101", "#0xff"};
        String[] numericPrefixes = {"١٢٣", "１２３", "०१२", "-١٢", "+१२", "0xＡＢ", "𝟙"};
        for (String value : java.util.stream.Stream.concat(
                java.util.Arrays.stream(values),
                java.util.Arrays.stream(numericPrefixes)).toArray(String[]::new)) {
            String classification;
            String identifier;
            try { classification = TokenTypes.matchTokenType(value).toString(); } catch (Exception error) { classification = "error:" + error.getClass().getSimpleName(); }
            try { identifier = Boolean.toString(TokenTypes.isValidIdentifier(value)); } catch (Exception error) { identifier = "error:" + error.getClass().getSimpleName(); }
            System.out.println("lexical\t" + encoded(value) + "\t" + classification + "\t" + identifier + "\t" + (Globals.instructionSet.matchOperator(value) != null) + "\t" + Macro.tokenIsMacroParameter(value, false) + "\t" + Macro.tokenIsMacroParameter(value, true));
        }
    }
    private static Token location(String value, int line, int original) {
        Token token = new Token(TokenTypes.IDENTIFIER, value, null, line, 1);
        token.setOriginal(null, original);
        return token;
    }
    private static TokenList tokens(String... values) {
        TokenList tokens = new TokenList();
        for (String value : values) tokens.add(token(value));
        return tokens;
    }
    private static void macros() {
        NamedProgram program = new NamedProgram("macros.asm");
        Macro macro = new Macro();
        System.out.println("macro-default\t" + macro.getName() + "\t" + macro.getProgram() + "\t" + macro.getFromLine() + "\t" + macro.getToLine() + "\t" + macro.getOriginalFromLine() + "\t" + macro.getOriginalToLine() + "\t" + macro.getArgs().size());
        macro.setName("example"); macro.setProgram(program); macro.setFromLine(2); macro.setToLine(9); macro.setOriginalFromLine(1); macro.setOriginalToLine(8);
        java.util.ArrayList<String> formal = new java.util.ArrayList<>(); formal.add("%arg"); macro.setArgs(formal); formal.add("$param");
        System.out.println("macro-properties\t" + macro.getName() + "\t" + (macro.getProgram() == program) + "\t" + macro.getFromLine() + "\t" + macro.getToLine() + "\t" + macro.getOriginalFromLine() + "\t" + macro.getOriginalToLine() + "\t" + macro.getArgs().size());
        Macro equal = new Macro(); equal.setName("example"); equal.addArg("%different"); equal.addArg("%other");
        System.out.println("macro-equal\t" + macro.equals(equal) + "\t" + macro.equals(macro) + "\t" + macro.equals(null) + "\t" + macro.equals("example"));
        equal.addArg("%third"); System.out.println("macro-arity\t" + macro.equals(equal));
        macro.addLabel("zebra"); macro.addLabel("loop"); macro.readyForCommit();
        program.sourceLines.add("loop: add %arg, %arg # %arg"); program.tokenLines.add(tokens("loop", ":", "add", "%arg", "%arg", "# %arg"));
        program.sourceLines.add("loop loop"); program.tokenLines.add(tokens("loop", "loop"));
        program.sourceLines.add("add $param, $t0, $f0"); program.tokenLines.add(tokens("add", "$param", "$t0", "$f0"));
        program.sourceLines.add("missing %unknown"); program.tokenLines.add(tokens("missing", "%unknown"));
        program.sourceLines.add("already replaced"); program.tokenLines.add(tokens("%arg"));
        ErrorList errors = new ErrorList();
        TokenList arguments = tokens("example", "$s0", "42");
        for (int line = 1; line <= 5; line++) System.out.println("macro-expand\t" + line + "\t" + encoded(macro.getSubstitutedLine(line, arguments, 7L, errors)));
        System.out.println("macro-long\t" + encoded(macro.getSubstitutedLine(2, arguments, Long.MIN_VALUE, errors)));
        ErrorMessage error = (ErrorMessage) errors.getErrorMessages().get(0);
        System.out.println("macro-error\t" + errors.errorCount() + "\t" + error.getFilename() + "\t" + error.getLine() + "\t" + error.getPosition() + "\t" + error.getMessage());
        MacroPool pool = new MacroPool(program);
        System.out.println("pool-default\t" + pool.getCurrent() + "\t" + pool.getNextCounter() + "\t" + pool.getNextCounter() + "\t" + pool.matchesAnyMacroName("call"));
        for (int line : new int[] {10, 30, 30}) {
            pool.beginMacro(location("call", line, line / 10)); pool.getCurrent().addArg("%arg"); pool.commitMacro(location(".end_macro", line + 5, line / 10 + 1));
        }
        pool.beginMacro(location("call", 50, 5)); pool.commitMacro(location(".end_macro", 55, 6));
        Macro match = pool.getMatchingMacro(tokens("call", "1"), 1);
        System.out.println("pool-match\t" + match.getFromLine() + "\t" + match.getToLine() + "\t" + match.getOriginalFromLine() + "\t" + match.getOriginalToLine() + "\t" + pool.getMatchingMacro(tokens("call"), 1).getFromLine() + "\t" + pool.getMatchingMacro(tokens(), 1) + "\t" + pool.getMatchingMacro(tokens("CALL", "1"), 1) + "\t" + pool.matchesAnyMacroName("call"));
        pool.setCurrent(macro); System.out.println("pool-set\t" + (pool.getCurrent() == macro)); pool.setCurrent(null);
        System.out.println("pool-stack\t" + pool.pushOnCallStack(location("call", 2, 200)) + "\t" + pool.pushOnCallStack(location("call", 3, 300)) + "\t" + pool.pushOnCallStack(location("call", 2, 400)) + "\t" + pool.getCallStack().toString() + "\t" + pool.getExpansionHistory());
        pool.popFromCallStack(); System.out.println("pool-pop\t" + pool.getCallStack().size() + "\t" + pool.getExpansionHistory());
        pool.popFromCallStack(); System.out.println("pool-empty\t" + pool.getCallStack().size() + "\t" + pool.getExpansionHistory());
        try { pool.popFromCallStack(); } catch (Exception failure) { System.out.println("pool-underflow\t" + failure.getMessage()); }
    }
    private static void structures() {
        NamedProgram program = new NamedProgram("original.asm");
        SourceLine source = new SourceLine("label: nop", program, 8);
        program.filename = "renamed.asm";
        System.out.println("source\t" + source.getSource() + "\t" + source.getFilename() + "\t" + source.getLineNumber() + "\t" + (source.getMIPSprogram() == program));
        SourceLine unknown = new SourceLine("", null, -1);
        System.out.println("source-null\t" + unknown.getFilename() + "\t" + unknown.getLineNumber() + "\t" + unknown.getMIPSprogram());
        Token token = new Token(TokenTypes.OPERATOR, "add", program, 11, 4);
        System.out.println("token\t" + token.getValue() + "\t" + token.toString() + "\t" + token.getType() + "\t" + token.getSourceLine() + "\t" + token.getStartPos() + "\t" + token.getOriginalSourceLine() + "\t" + (token.getOriginalProgram() == program));
        NamedProgram included = new NamedProgram("included.asm");
        token.setOriginal(included, 2);
        token.setType(TokenTypes.IDENTIFIER);
        System.out.println("token-original\t" + token.getType() + "\t" + token.getOriginalSourceLine() + "\t" + (token.getSourceMIPSprogram() == program) + "\t" + (token.getOriginalProgram() == included));
        TokenList tokens = new TokenList(); list("empty", tokens);
        tokens.setProcessedLine("add $t0"); tokens.add(token); tokens.add(new Token(TokenTypes.REGISTER_NAME, "$t0", null, 11, 8));
        list("added", tokens);
        TokenList clone = (TokenList) tokens.clone();
        token.setType(TokenTypes.OPERATOR);
        list("shared", clone);
        clone.remove(0); clone.setProcessedLine("clone");
        list("clone-removed", clone); list("original", tokens);
        clone.set(0, token); list("replaced", clone);
        for (int position : new int[] {-1, 2}) {
            try { tokens.get(position); } catch (IndexOutOfBoundsException error) { System.out.println("list-error\tget\t" + position + "\t" + error.getMessage()); }
            try { tokens.set(position, token); } catch (IndexOutOfBoundsException error) { System.out.println("list-error\tset\t" + position + "\t" + error.getMessage()); }
            try { tokens.remove(position); } catch (IndexOutOfBoundsException error) { System.out.println("list-error\tremove\t" + position + "\t" + error.getMessage()); }
        }
        ErrorList errors = new ErrorList();
        SymbolTable global = new SymbolTable("global"); Globals.symbolTable = global;
        SymbolTable local = new SymbolTable("local.asm");
        global.addSymbol(token("global"), 64, false, errors);
        global.addSymbol(token("minus"), 128, false, errors);
        Globals.debug = true;
        local.addSymbol(token("local"), 0x80000000, true, errors);
        local.addSymbol(token("alias"), 0x80000000, false, errors);
        local.addSymbol(token("minus"), -1, true, errors);
        local.addSymbol(token("local"), 32, false, errors);
        table("added", local);
        System.out.println("lookup\t" + local.getAddress("local") + "\t" + local.getAddress("LOCAL") + "\t" + local.getAddressLocalOrGlobal("global") + "\t" + local.getAddressLocalOrGlobal("minus"));
        for (String address : new String[] {"0x80000000", "-2147483648", "0xffffffff", "64", "nonsense"}) {
            System.out.println("address\t" + address + "\t" + name(local.getSymbolGivenAddress(address)) + "\t" + name(local.getSymbolGivenAddressLocalOrGlobal(address)));
        }
        System.out.println("segments\t" + local.getDataSymbols().size() + "\t" + local.getTextSymbols().size() + "\t" + SymbolTable.getStartLabel());
        java.util.ArrayList detached = local.getAllSymbols(); detached.clear();
        System.out.println("detached\t" + local.getSize());
        local.fixSymbolTableAddress(0x80000000, 0x10010000); table("relocated", local);
        local.removeSymbol(token("absent")); local.removeSymbol(token("alias")); table("removed", local);
        ErrorMessage error = (ErrorMessage) errors.getErrorMessages().get(0);
        System.out.println("duplicate\t" + errors.errorCount() + "\t" + error.getFilename() + "\t" + error.getLine() + "\t" + error.getPosition() + "\t" + error.getMessage());
        local.clear(); table("cleared", local);
        Globals.debug = false;
    }

    public static void main(String[] arguments) {
        for (Object value : Directives.getDirectiveList()) {
            Directives directive = (Directives) value;
            System.out.println("directive\t" + directive.getName() + "\t" + directive.toString()
                + "\t" + directive.getDescription() + "\t" + Directives.isIntegerDirective(directive)
                + "\t" + Directives.isFloatingDirective(directive));
        }
        String[] candidates = {".data", ".DaTa", ".INCLUDE", ".\u0130nclude", ".\u0131nclude", ".\u212aTEXT", ".a\u017fcii", ".asciiz", "data", ".unknown", "", " .data", ".data "};
        for (String candidate : candidates) {
            Directives found = Directives.matchDirective(candidate);
            System.out.println("match\t" + candidate + "\t" + (found == null ? "null" : found.getName()));
        }
        for (String candidate : new String[] {"", ".", ".a", ".A", ".end_", ".unknown", ".\u0130"}) {
            java.util.ArrayList matches = Directives.prefixMatchDirectives(candidate);
            String names = "null";
            if (matches != null) {
                java.util.ArrayList<String> list = new java.util.ArrayList<>();
                for (Object match : matches) list.add(((Directives) match).getName());
                names = String.join(",", list);
            }
            System.out.println("prefix\t" + candidate + "\t" + names);
        }
        System.out.println("null-kind\t" + Directives.isIntegerDirective(null) + "\t" + Directives.isFloatingDirective(null));
        for (int address : new int[] {0, -1, Integer.MIN_VALUE, Integer.MAX_VALUE, 0x10010000}) {
            for (boolean data : new boolean[] {Symbol.DATA_SYMBOL, Symbol.TEXT_SYMBOL}) {
                Symbol symbol = new Symbol("Label.$", address, data);
                System.out.println("symbol\t" + symbol.getName() + "\t" + symbol.getAddress() + "\t" + symbol.getType());
                symbol.setAddress(~address);
                System.out.println("readdress\t" + symbol.getAddress());
            }
        }
        lexical();
        structures();
        macros();
        branch("initial");
        DelayedBranch.trigger(); branch("trigger-cleared");
        DelayedBranch.register(0x80000000); branch("register");
        DelayedBranch.register(0x400004); branch("register-twice");
        DelayedBranch.trigger(); branch("trigger");
        DelayedBranch.trigger(); branch("trigger-twice");
        DelayedBranch.register(-1); branch("branch-in-delay-slot");
        DelayedBranch.trigger(); branch("trigger-extended");
        DelayedBranch.clear(); branch("clear");
        DelayedBranch.clear(); branch("clear-twice");
        DelayedBranch.register(-1); branch("new-branch");
        DelayedBranch.clear(); branch("clear-untriggered");
    }
}
