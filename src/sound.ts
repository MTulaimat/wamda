/* Soft capture chime, synthesized with WebAudio so we ship no audio asset. */
let ctx: AudioContext | null = null;

export function playChime() {
  try {
    ctx = ctx ?? new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;
    // Two quick ascending notes - a gentle, non-intrusive "ping".
    [
      { f: 660, t: 0 },
      { f: 880, t: 0.08 },
    ].forEach(({ f, t }) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.0001, now + t);
      gain.gain.exponentialRampToValueAtTime(0.12, now + t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.22);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(now + t);
      osc.stop(now + t + 0.24);
    });
  } catch {
    /* audio unavailable - silently ignore */
  }
}
