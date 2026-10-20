import mars.*;
import java.util.*;
/** Canonical headless preference defaults and update notifications. */
public final class SettingsProbe {
 public static void main(String[] args){
  Globals.initialize(false);Settings settings=Globals.getSettings();
  System.out.println("limits\t"+Globals.maximumErrorMessages+"\t"+Globals.maximumMessageCharacters+"\t"+Globals.maximumBacksteps);
  int[] notifications={0};settings.addObserver((observable,value)->notifications[0]++);
  for(int i=0;i<21;i++){
   boolean initial=settings.getBooleanSetting(i);
   settings.setBooleanSettingNonPersistent(i,!initial);int silent=notifications[0];
   settings.setBooleanSetting(i,initial);int once=notifications[0];
   settings.setBooleanSetting(i,initial);int twice=notifications[0];
   System.out.println("boolean\t"+i+"\t"+initial+"\t"+silent+"\t"+once+"\t"+twice);
  }
  System.out.println("strings\t"+settings.getExceptionHandler()+"\t"+settings.getMemoryConfiguration()+"\t"+settings.getLabelSortState());
  System.out.println("backstep\t"+settings.getBackSteppingEnabled());
  for(int id:new int[]{-1,21}){try{settings.getBooleanSetting(id);}catch(Exception error){System.out.println("invalid\t"+error.getMessage());}}
 }
}
