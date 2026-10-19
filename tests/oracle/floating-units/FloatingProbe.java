import java.util.*;
import java.math.*;
import java.nio.charset.StandardCharsets;

/** JDK 21 public floating conversion API oracle; no OpenJDK implementation copied. */
public final class FloatingProbe {
 static String b64(String text){return Base64.getEncoder().encodeToString(text.getBytes(StandardCharsets.UTF_8));}
 static void f(int bits){float v=Float.intBitsToFloat(bits);System.out.println("F\t"+Integer.toUnsignedString(bits,16)+"\t"+Float.toString(v));}
 static void d(long bits){double v=Double.longBitsToDouble(bits);System.out.println("D\t"+Long.toUnsignedString(bits,16)+"\t"+Double.toString(v));}
 static void p(String text){String f,d;try{f=Integer.toUnsignedString(Float.floatToIntBits(Float.parseFloat(text)),16);}catch(NumberFormatException e){f="error";}try{d=Long.toUnsignedString(Double.doubleToLongBits(Double.parseDouble(text)),16);}catch(NumberFormatException e){d="error";}System.out.println("P\t"+b64(text)+"\t"+f+"\t"+d);}
 static void midpoint(double a,double b){
  if(!Double.isFinite(a)||!Double.isFinite(b))return;
  BigDecimal mid=new BigDecimal(a).add(new BigDecimal(b)).divide(BigDecimal.valueOf(2));
  BigDecimal epsilon=BigDecimal.ONE.scaleByPowerOfTen(-Math.max(0,mid.scale())-20);
  for(BigDecimal value:new BigDecimal[]{mid.subtract(epsilon),mid,mid.add(epsilon)}){p(value.toPlainString());p(value.negate().toPlainString());}
 }
 public static void main(String[] args){
  for(int exponent=0;exponent<256;exponent++)for(int fraction:new int[]{0,1,2,0x3fffff,0x7ffffe,0x7fffff}){int bits=(exponent<<23)|fraction;f(bits);f(bits|0x80000000);}
  for(int exponent=0;exponent<2048;exponent++)for(long fraction:new long[]{0,1,0xfffffffffffffL}){long bits=((long)exponent<<52)|fraction;d(bits);d(bits|Long.MIN_VALUE);}
  Random random=new Random(0x4d415253L);
  for(int n=0;n<4096;n++){
   int fb=random.nextInt();long db=random.nextLong();f(fb);d(db);
   if(n<512){p(Float.toString(Float.intBitsToFloat(fb)));p(Float.toHexString(Float.intBitsToFloat(fb)));p(Double.toString(Double.longBitsToDouble(db)));p(Double.toHexString(Double.longBitsToDouble(db)));}
  }
  for(int bits:new int[]{0,1,2,0x007fffff,0x00800000,0x3f7fffff,0x3f800000,0x3f800001,0x4affffff,0x4b000000,0x7f7ffffe})midpoint(Float.intBitsToFloat(bits),Float.intBitsToFloat(bits+1));
  for(long bits:new long[]{0L,1L,2L,0xfffffffffffffL,0x10000000000000L,0x3fefffffffffffffL,0x3ff0000000000000L,0x3ff0000000000001L,0x4330000000000000L,0x7feffffffffffffeL})midpoint(Double.longBitsToDouble(bits),Double.longBitsToDouble(bits+1));
  for(int exponent=-325;exponent<=310;exponent++)p("1e"+exponent);
  for(int exponent=-1076;exponent<=1025;exponent+=7)p("0x1.fffffffffffffp"+exponent);
  for(String text:new String[]{""," ","+","-",".","1","-0","-0.0","+0","NaN","+NaN","-NaN","NaNf","nan","Infinity","+Infinity","-Infinity","Infinityd","inf","0x1p0","-0X.8P+1f","0x1.p-1D","0x1","0xp0","0x.p1","0x1p","1.",".1","1f","1D","1e+2f","1e","1_0","1,0","١","１","\u00a01.0","\u20031.0","\u00001.0\u001f","1.0\n","1e999999999999999999999999","1e-999999999999999999999999","-0e999999999999999999","0x0p999999999999999999","0x1p99999999999999999999","0x1p-999999999999999999999","1.0000000596046447753906250001","1.0000000596046447753906249999","3.40282356779733661637539395458142568448e38","3.40282356779733661637539395458142568447e38","2.4703282292062327208828439643411068618252990130716238221279284125033775363510437593264991818081799618989828234772285886546332835517796989819938739800539093906315035659515570226392290858392449105184435931802849936536152500319370457678249219365623669863658480757001585769269903706311928279558551332927834338409351978015531246597263579574622766465272827220056374006485499977096599470454020828166226237857373934507363390079677619305775067401763246736009689513405355374585166611342237666786041621596804619144672918403005300575308490487653917113865916462395249123653876375927391246907498958479218947314318517498445982505851118324047819439183754567923252023946253496448169594011614415987e-324"})p(text);
 }
}
