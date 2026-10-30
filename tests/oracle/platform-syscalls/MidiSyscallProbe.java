package mars.mips.instructions;
import mars.*;
import mars.mips.hardware.*;
import javax.sound.midi.*;
import javax.sound.midi.spi.MidiDeviceProvider;
import java.io.*;
import java.lang.reflect.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;

/** Execute the actual MIDI service classes; only the sound output device is replaced by a recording one. */
public final class MidiSyscallProbe {
  /** Observations of one legacy Tone: the sequencer calls, requested Sequence, and real-time dispatches. */
  static final class ToneRecord {
    final List<String> calls = Collections.synchronizedList(new ArrayList<>());
    final List<String> received = Collections.synchronizedList(new ArrayList<>());
    volatile String sequence = "-";
    volatile long noteOn = -1, noteOff = -1;
    final CountDownLatch started = new CountDownLatch(1), closed = new CountDownLatch(1);
  }
  static final List<ToneRecord> tones = new CopyOnWriteArrayList<>();
  static final class Info extends MidiDevice.Info { Info(String name) { super(name, "MARS-ts", "Oracle probe device", "1"); } }
  static final Info SEQUENCER = new Info("MARS-ts probe sequencer"), RECEIVER = new Info("MARS-ts probe receiver");

  /** Service provider exposing the recording sequencer and a receiver port that accepts every message. */
  public static final class Provider extends MidiDeviceProvider {
    public MidiDevice.Info[] getDeviceInfo() { return new MidiDevice.Info[]{SEQUENCER, RECEIVER}; }
    public MidiDevice getDevice(MidiDevice.Info info) {
      if(info == SEQUENCER) return sequencer();
      if(info == RECEIVER) return receiverPort();
      throw new IllegalArgumentException("Unsupported device");
    }
  }

  private static String hex(byte[] bytes, int length) {
    StringBuilder text = new StringBuilder();
    for(int i = 0; i < length; i++) text.append(String.format("%02X", bytes[i] & 0xff));
    return text.toString();
  }
  private static String describe(Sequence sequence) {
    StringJoiner text = new StringJoiner("|");
    text.add((sequence.getDivisionType() == Sequence.PPQ ? "PPQ" : "SMPTE") + ":" + sequence.getResolution());
    for(Track track : sequence.getTracks()) for(int i = 0; i < track.size(); i++) {
      MidiEvent event = track.get(i);
      text.add(event.getTick() + ":" + hex(event.getMessage().getMessage(), event.getMessage().getLength()));
    }
    return text.toString();
  }

  /** Wrap a new JDK real-time sequencer, recording legacy calls and tagging the messages it dispatches. */
  private static Sequencer sequencer() {
    try {
      Sequencer real = null;
      for(MidiDevice.Info info : MidiSystem.getMidiDeviceInfo())
        if(info != SEQUENCER && MidiSystem.getMidiDevice(info) instanceof Sequencer candidate) { real = candidate; break; }
      final Sequencer delegate = real;
      final ToneRecord tone = new ToneRecord();
      delegate.addMetaEventListener(message -> { if(message.getType() == 47) tone.calls.add("endOfTrack"); });
      InvocationHandler handler = (proxy, method, args) -> {
        String name = method.getName();
        if(name.equals("getDeviceInfo")) return SEQUENCER;
        if(name.equals("getTransmitter")) {
          Transmitter transmitter = delegate.getTransmitter();
          return new Transmitter() {
            public void setReceiver(Receiver receiver) {
              transmitter.setReceiver(new Receiver() {
                public void send(MidiMessage message, long timeStamp) {
                  int command = message.getStatus() & 0xf0;
                  // The JDK sequencer's controller resets after the note-off vary with timing; they are not Tone's messages.
                  if(tone.noteOff < 0) tone.received.add(hex(message.getMessage(), message.getLength()));
                  if(command == 0x90 && tone.noteOn < 0) tone.noteOn = System.nanoTime();
                  if(command == 0x80 && tone.noteOff < 0) tone.noteOff = System.nanoTime();
                  receiver.send(message, timeStamp);
                }
                public void close() { receiver.close(); }
              });
            }
            public Receiver getReceiver() { return transmitter.getReceiver(); }
            public void close() { transmitter.close(); }
          };
        }
        if(name.equals("open")) tones.add(tone);
        if(name.equals("setTempoInMPQ")) tone.calls.add("setTempoInMPQ(" + args[0] + ")");
        else if(name.equals("setSequence") && args[0] instanceof Sequence sequence) { tone.sequence = describe(sequence); tone.calls.add(name); }
        else if(name.matches("open|addMetaEventListener|start|stop|close")) tone.calls.add(name);
        try {
          return method.invoke(delegate, args);
        } catch(InvocationTargetException error) {
          throw error.getCause();
        } finally {
          if(name.equals("start")) tone.started.countDown();
          if(name.equals("close")) tone.closed.countDown();
        }
      };
      return (Sequencer)Proxy.newProxyInstance(MidiSyscallProbe.class.getClassLoader(), new Class<?>[]{Sequencer.class}, handler);
    } catch(MidiUnavailableException error) {
      throw new IllegalStateException(error);
    }
  }
  private static MidiDevice receiverPort() {
    return new MidiDevice() {
      private boolean open;
      public MidiDevice.Info getDeviceInfo() { return RECEIVER; }
      public void open() { open = true; }
      public void close() { open = false; }
      public boolean isOpen() { return open; }
      public long getMicrosecondPosition() { return -1; }
      public int getMaxReceivers() { return -1; }
      public int getMaxTransmitters() { return 0; }
      public Receiver getReceiver() { return new Receiver() { public void send(MidiMessage message, long timeStamp) {} public void close() {} }; }
      public List<Receiver> getReceivers() { return List.of(); }
      public Transmitter getTransmitter() throws MidiUnavailableException { throw new MidiUnavailableException("No transmitters"); }
      public List<Transmitter> getTransmitters() { return List.of(); }
    };
  }

  private static SyscallLoader loader;
  private static ProgramStatement statement;
  private static int row = 0;
  private static String registers() {
    StringJoiner state = new StringJoiner(",");
    for(int r : new int[]{2,4,5,6,7}) state.add("" + RegisterFile.getValue(r));
    return state.toString();
  }
  private static String simulate(int service, int a0, int a1, int a2, int a3) {
    RegisterFile.resetRegisters();
    RegisterFile.updateRegister(2, service); RegisterFile.updateRegister(4, a0); RegisterFile.updateRegister(5, a1); RegisterFile.updateRegister(6, a2); RegisterFile.updateRegister(7, a3);
    try { loader.findSyscall(service).simulate(statement); return "ok"; }
    catch(Exception error) { return error.getClass().getName() + ":" + error.getMessage(); }
  }
  /** Await the tones opened since {@code first}; unbounded tones are observed only through their note-on. */
  private static List<ToneRecord> await(int first, int count, boolean untilClosed) throws InterruptedException {
    long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
    while(tones.size() < first + count && System.nanoTime() < deadline) Thread.sleep(5);
    List<ToneRecord> opened = new ArrayList<>(tones.subList(first, Math.min(tones.size(), first + count)));
    for(ToneRecord tone : opened) {
      if(!(untilClosed ? tone.closed : tone.started).await(Math.max(0, deadline - System.nanoTime()), TimeUnit.NANOSECONDS))
        throw new IllegalStateException("Tone did not " + (untilClosed ? "close" : "start"));
      while(tone.noteOn < 0 && System.nanoTime() < deadline) Thread.sleep(5);
    }
    return opened;
  }
  private static String observe(ToneRecord tone, boolean endedBeforeReturn, int duration) {
    String span = "-";
    if(tone.noteOn >= 0 && tone.noteOff >= 0) {
      double milliseconds = (tone.noteOff - tone.noteOn) / 1e6;
      // Real-time dispatch jitter is not captured exactly; only the 1 tick = 1 ms contract is.
      span = String.valueOf(milliseconds >= duration - 5 && milliseconds <= duration + 250);
    }
    return String.join(";", String.join(",", tone.calls), tone.sequence, String.join(",", tone.received), String.valueOf(endedBeforeReturn), span);
  }
  private static void run(int service, int a0, int a1, int a2, int a3, int duration, boolean untilClosed) throws Exception {
    int first = tones.size();
    String outcome = simulate(service, a0, a1, a2, a3);
    boolean ended = tones.size() > first && tones.get(first).closed.getCount() == 0;
    String state = registers();
    ToneRecord tone = await(first, 1, untilClosed).get(0);
    System.out.println(service + "\t" + (row++) + "\t" + a0 + "\t" + a1 + "\t" + a2 + "\t" + a3 + "\t" + outcome + "\t" + state + "\t" + observe(tone, ended, duration));
  }

  public static void main(String[] args) throws Exception {
    Globals.initialize(false); Globals.memory.clear(); loader = new SyscallLoader(); loader.loadSyscalls();
    statement = new ProgramStatement(null, "", null, null, (Instruction)Globals.instructionSet.matchOperator("syscall").get(0), 0x00400000, 0);

    // Without a sound line, Tone reports MidiUnavailableException on stderr and the service returns at once.
    PrintStream err = System.err;
    ByteArrayOutputStream trace = new ByteArrayOutputStream();
    System.setErr(new PrintStream(trace, true, StandardCharsets.UTF_8));
    long before = System.nanoTime();
    String outcome = simulate(33, 60, 1500, 0, 100);
    boolean early = System.nanoTime() - before < TimeUnit.MILLISECONDS.toNanos(1500);
    System.setErr(err);
    System.out.println("33\t" + (row++) + "\t60\t1500\t0\t100\t" + outcome + "\t" + registers() + "\tno-device;" + trace.toString(StandardCharsets.UTF_8).lines().findFirst().orElse("") + ";returnedBeforeDuration=" + early);

    // Install the recording devices; javax.sound.midi resolves classpath providers through ServiceLoader on each lookup.
    Path classes = Paths.get(MidiSyscallProbe.class.getProtectionDomain().getCodeSource().getLocation().toURI());
    Path services = classes.resolve("META-INF/services/javax.sound.midi.spi.MidiDeviceProvider");
    Files.createDirectories(services.getParent());
    Files.writeString(services, Provider.class.getName() + "\n");
    System.setProperty("javax.sound.midi.Sequencer", Provider.class.getName() + "#" + SEQUENCER.getName());
    System.setProperty("javax.sound.midi.Receiver", Provider.class.getName() + "#" + RECEIVER.getName());

    int lowByte = 0x100;
    int[][] synchronous = {
      {60, 120, 0, 100}, {0, 40, 127, 127}, {127, 40, 0, 0}, {-1, 40, -1, -1}, {128, 40, 128, 128},
      {lowByte + 72, 40, lowByte + 5, lowByte + 50}, {Integer.MIN_VALUE, 40, Integer.MAX_VALUE, Integer.MIN_VALUE},
      {64, 0, 0, 100}, {64, -1, 0, 100}, {64, Integer.MIN_VALUE, 0, 100}
    };
    for(int[] tone : synchronous) run(33, tone[0], tone[1], tone[2], tone[3], tone[1] < 0 ? 1000 : tone[1], true);
    run(31, 60, 400, 0, 100, 400, true);
    run(31, -5, -5, 200, 300, 1000, true);
    // Overlapping asynchronous tones open independent sequencers.
    int first = tones.size();
    String a = simulate(31, 60, 300, 0, 100), b = simulate(31, 64, 300, 40, 90);
    List<ToneRecord> pair = await(first, 2, true);
    // Pool threads may open the two sequencers in either order; report them in request order.
    pair.sort(Comparator.comparing(tone -> tone.sequence));
    boolean overlapped = Math.max(pair.get(0).noteOn, pair.get(1).noteOn) < Math.min(pair.get(0).noteOff, pair.get(1).noteOff);
    System.out.println("31\t" + (row++) + "\t60,64\t300\t0,40\t100,90\t" + a + "," + b + "\t" + registers() + "\t" + observe(pair.get(0), false, 300) + "\t" + observe(pair.get(1), false, 300) + "\toverlapped=" + overlapped);
    // A maximal duration is scheduled as ticks without clamping; the probe does not wait for its end.
    run(31, 67, Integer.MAX_VALUE, 0, 100, Integer.MAX_VALUE, false);
    System.out.flush();
    // ToneGenerator's cached pool threads are non-daemon, and the maximal tone never ends.
    System.exit(0);
  }
}
