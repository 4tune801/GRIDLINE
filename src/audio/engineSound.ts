class EngineAudioSynthesizer {
  private ctx: AudioContext | null = null;
  private oscPrimary: OscillatorNode | null = null;
  private oscSub: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private muted = false;
  private running = false;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setTargetAtTime(muted ? 0 : 0.04, this.ctx.currentTime, 0.05);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public startEngine() {
    if (this.running) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const gain = ctx.createGain();
    gain.gain.value = 0;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;

    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.value = 58;

    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = 116;

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc1.start();
    osc2.start();

    this.oscPrimary = osc1;
    this.oscSub = osc2;
    this.gainNode = gain;
    this.running = true;
  }

  public updateEngine(speedKmh: number, nitroActive: boolean) {
    if (!this.running || !this.ctx || !this.oscPrimary || !this.oscSub || !this.gainNode) return;
    const now = this.ctx.currentTime;
    const ratio = Math.min(1, Math.max(0, speedKmh / 290));
    const baseFreq = 54 + ratio * 135 + (nitroActive ? 28 : 0);

    this.oscPrimary.frequency.setTargetAtTime(baseFreq, now, 0.06);
    this.oscSub.frequency.setTargetAtTime(baseFreq * 1.98, now, 0.06);
    const targetGain = this.muted ? 0 : 0.028 + ratio * 0.045 + (nitroActive ? 0.02 : 0);
    this.gainNode.gain.setTargetAtTime(targetGain, now, 0.08);
  }

  public stopEngine() {
    if (!this.running) return;
    try {
      this.oscPrimary?.stop();
      this.oscSub?.stop();
      this.oscPrimary?.disconnect();
      this.oscSub?.disconnect();
      this.gainNode?.disconnect();
    } catch {
      // ignore cleanup errors
    }
    this.oscPrimary = null;
    this.oscSub = null;
    this.gainNode = null;
    this.running = false;
  }

  public playCountdownTone(isGo: boolean) {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isGo ? 'triangle' : 'sine';
    osc.frequency.value = isGo ? 880 : 440;

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (isGo ? 0.45 : 0.18));

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (isGo ? 0.46 : 0.2));
  }

  public playLapChime() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const notes = [523.25, 659.25];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.09;
      gain.gain.setValueAtTime(0.07, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.26);
    });
  }

  public playFinishFanfare(won: boolean) {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const notes = won ? [523.25, 659.25, 783.99, 1046.5] : [392.0, 349.23, 329.63];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.11;
      gain.gain.setValueAtTime(0.08, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.38);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.4);
    });
  }
}

export const engineAudio = new EngineAudioSynthesizer();
