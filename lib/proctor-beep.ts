/** Loud multi-tone alert beep (browser AudioContext). */
export function playProctorBeep(opts?: { durationMs?: number; volume?: number }) {
  const durationMs = opts?.durationMs ?? 2200;
  const volume = opts?.volume ?? 0.22;
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AC();
    const master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);

    const tones = [880, 1175, 880, 1175, 988, 1319];
    const step = durationMs / tones.length;
    tones.forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = i % 2 === 0 ? "square" : "sawtooth";
      o.frequency.value = freq;
      const t0 = ctx.currentTime + (i * step) / 1000;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(volume, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + step / 1000 - 0.02);
      o.connect(g);
      g.connect(master);
      o.start(t0);
      o.stop(t0 + step / 1000);
    });
    window.setTimeout(() => {
      void ctx.close().catch(() => undefined);
    }, durationMs + 200);
  } catch {
    // ignore
  }
}
