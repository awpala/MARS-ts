/* Probes the unmodified MARS editor lexer; MARS copyright Pete Sanderson and Kenneth Vollmar (MIT).
 * Token marker/KeywordMap copyright Slava Pestov, Mike Dillon, and Pete Sanderson; original notices remain in legacy sources. */
import java.util.*;
import javax.swing.text.Segment;
import mars.Globals;
import mars.mips.instructions.Instruction;
import mars.assembler.Directives;
import mars.mips.hardware.Register;
import mars.venus.editors.jeditsyntax.*;
import mars.venus.editors.jeditsyntax.tokenmarker.*;

public class HighlightingProbe {
  static String quote(String text) {
    StringBuilder out = new StringBuilder("\"");
    for (int i=0;i<text.length();i++) {
      char c=text.charAt(i);
      if(c=='"'||c=='\\') out.append('\\').append(c);
      else if(c<32 || Character.isSurrogate(c)) out.append(String.format("\\u%04x",(int)c));
      else out.append(c);
    }
    return out.append('"').toString();
  }
  static class Marker extends MIPSTokenMarker {
    int state(int i) { return lineInfo[i].token; }
  }
  static String sample(String text) {
    String[] lines=text.split("\n",-1);
    Marker marker=new Marker(); marker.insertLines(0,lines.length);
    StringJoiner results=new StringJoiner(",","[","]");
    for(int i=0;i<lines.length;i++) {
      String line=lines[i]; char[] padded=("prefix!"+line+"!suffix").toCharArray();
      Token token=marker.markTokens(new Segment(padded,7,line.length()),i);
      StringJoiner tokens=new StringJoiner(",","[","]");
      while(true) { tokens.add("["+token.id+","+token.length+"]"); if(token.id==Token.END)break; token=token.next; }
      results.add("{\"tokens\":"+tokens+",\"state\":"+marker.state(i)+",\"nextLineRequested\":"+marker.isNextLineRequested()+"}");
    }
    return "{\"source\":"+quote(text)+",\"lines\":"+results+"}";
  }
  public static void main(String[] args) {
    Globals.initialize(false);
    TreeSet<String> instructions=new TreeSet<>();
    for(Object item:Globals.instructionSet.getInstructionList()) instructions.add(((Instruction)item).getName());
    StringJoiner names=new StringJoiner(",","[","]"); for(String name:instructions) names.add(quote(name));
    System.out.print("{\"instructions\":"+names+",\"styles\":[");
    SyntaxStyle[] styles=SyntaxUtilities.getDefaultSyntaxStyles();
    for(int i=0;i<styles.length;i++) { if(i>0)System.out.print(","); SyntaxStyle style=styles[i]; System.out.print("{\"color\":"+quote(String.format("#%06x",style.getColor().getRGB()&0xffffff))+",\"italic\":"+style.isItalic()+",\"bold\":"+style.isBold()+"}"); }
    System.out.print("],\"letterDigitRanges\":[");
    boolean first=true;
    for(int i=0;i<65536;i++) if(Character.isLetterOrDigit((char)i)) {
      int start=i; while(i+1<65536&&Character.isLetterOrDigit((char)(i+1)))i++;
      if(!first)System.out.print(","); first=false; System.out.print("["+start+","+i+"]");
    }
    for(String category : new String[]{"letterRanges", "digitRanges"}) {
      System.out.print("],\""+category+"\":["); first=true;
      for(int i=0;i<65536;i++) if(category.equals("letterRanges") ? Character.isLetter((char)i) : Character.isDigit((char)i)) {
        int start=i; while(i+1<65536 && (category.equals("letterRanges") ? Character.isLetter((char)(i+1)) : Character.isDigit((char)(i+1))))i++;
        if(!first)System.out.print(",");first=false;System.out.print("["+start+","+i+"]");
      }
    }
    System.out.print("],\"uppercase\":[");first=true;
    for(int i=0;i<65536;i++) if(Character.toUpperCase((char)i)!=i) {
      if(!first)System.out.print(","); first=false; System.out.print("["+i+","+(int)Character.toUpperCase((char)i)+"]");
    }
    List<String> cases=new ArrayList<>(Arrays.asList("", "# comment", "  main : add $t0, $zero, $31 # hi", ".word 0:10", "b: b b", "  .data\nstr: .asciiz \"a#b\\\"c\"\n.text\nli $v0, 10\nsyscall", "'x' '\\n' '\\''", "\"unterminated\nadd $s0,$s1,$s2", "'unterminated\nnext:", "\\\"x\" \\\\'y'", "%arg % %5 .macro example(%p) .end_macro", "ADD Li .TEXT $ZERO $F0", "x.y$: x-y: 0: :", "étiquette: add $0, $0, $0", "𐐀: add\u00a0$t0", "\\\\\"\\\\\"", "\"x\"'y'#z", "\tlabel\t:\tli\t$a0,1", ".word -1, +4, 0xdeadbeef, 1.0e3", "$fp $s8 $32 $f31 $f32", "add: .data: %arg: foo : bar :", "\r\n\r", "\\# comment", "li\\ foo", ".word 1\u0000add"));
    cases.addAll(instructions);
    for(Object item:Directives.getDirectiveList())cases.add(((Directives)item).getName());
    for(Register register:mars.mips.hardware.RegisterFile.getRegisters())cases.add(register.getName());
    for(int i=0;i<32;i++) {cases.add("$"+i);cases.add("$f"+i);}
    Random random=new Random(71391); String alphabet="abc.$%_01:'\"#\\ \t,()";
    for(int n=0;n<300;n++) {StringBuilder line=new StringBuilder();for(int i=0;i<random.nextInt(65);i++)line.append(alphabet.charAt(random.nextInt(alphabet.length())));cases.add(line.toString());}
    System.out.print("],\"cases\":[");first=true;
    for(String text:cases) {if(!first)System.out.print(",");first=false;System.out.print(sample(text));}
    System.out.println("]}");
  }
}
