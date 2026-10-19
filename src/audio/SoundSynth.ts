/**
 * Procedural Web Audio Synthesizer for Roomba Bumper Royale
 * Zero-dependency, zero-404 procedural audio.
 */

class SoundSynthEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineSubOsc: OscillatorNode | null = null;
  private muted: boolean = false;
  private initialized: boolean = false;

  public init() {
    if (this.initialized && this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.45, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // Dedicated continuous engine hum generator
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.engineGain.connect(this.masterGain);

      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.setValueAtTime(75, this.ctx.currentTime);

      this.engineSubOsc = this.ctx.createOscillator();
      this.engineSubOsc.type = 'triangle';
      this.engineSubOsc.frequency.setValueAtTime(37.5, this.ctx.currentTime);

      // Low pass filter to make the engine hum sound like a muffled vacuum motor
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(260, this.ctx.currentTime);
      filter.Q.setValueAtTime(2.0, this.ctx.currentTime);

      this.engineOsc.connect(filter);
      this.engineSubOsc.connect(filter);
      filter.connect(this.engineGain);

      this.engineOsc.start();
      this.engineSubOsc.start();

      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio init error:', e);
    }
  }

  public ensureContext() {
    if (!this.initialized) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.45, this.ctx.currentTime, 0.05);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  /**
   * Update engine hum frequency and volume based on Roomba speeds
   */
  public updateEngineHum(speedRatio: number, isBoosting: boolean) {
    if (!this.ctx || !this.engineGain || !this.engineOsc || !this.engineSubOsc || this.muted) return;
    const now = this.ctx.currentTime;
    const targetGain = Math.min(0.22, 0.04 + speedRatio * 0.14 + (isBoosting ? 0.08 : 0));
    const baseFreq = isBoosting ? 130 + speedRatio * 80 : 75 + speedRatio * 60;

    this.engineGain.gain.setTargetAtTime(targetGain, now, 0.1);
    this.engineOsc.frequency.setTargetAtTime(baseFreq, now, 0.1);
    this.engineSubOsc.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.1);
  }

  public stopEngineHum() {
    if (!this.ctx || !this.engineGain) return;
    this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
  }

  /**
   * Plastic/metal bumper impact clack sound
   */
  public playBump(intensity: number = 1.0) {
    if (!this.ctx || !this.masterGain || this.muted) return;
    this.ensureContext();
    const now = this.ctx.currentTime;
    const clampedIntensity = Math.min(Math.max(intensity, 0.2), 2.0);

    // Punchy thump
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160 * clampedIntensity, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.12);

    gain.gain.setValueAtTime(0.6 * Math.min(clampedIntensity, 1.2), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.15);

    // Snap transient noise click
    const bufferSize = this.ctx.sampleRate * 0.03;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.4 * clampedIntensity, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.04);

    noise.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noise.start(now);
  }

  /**
   * Cheerful suction pop when vacuuming a clump of dust/crumb
   */
  public playVacuumPop() {
    if (!this.ctx || !this.masterGain || this.muted) return;
    this.ensureContext();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    const startFreq = 420 + Math.random() * 80;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(startFreq * 2.1, now + 0.07);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  /**
   * Turbo Boost ignition rush
   */
  public playBoostWhoosh() {
    if (!this.ctx || !this.masterGain || this.muted) return;
    this.ensureContext();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(480, now + 0.28);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(320, now);
    filter.frequency.exponentialRampToValueAtTime(1200, now + 0.28);
    filter.Q.setValueAtTime(3.0, now);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.32);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  /**
   * Countdown beep
   */
  public playCountDown(isFinal: boolean = false) {
    if (!this.ctx || !this.masterGain || this.muted) return;
    this.ensureContext();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = isFinal ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(isFinal ? 880 : 440, now);

    gain.gain.setValueAtTime(isFinal ? 0.45 : 0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isFinal ? 0.35 : 0.18));

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + (isFinal ? 0.38 : 0.2));
  }

  /**
   * Hazard spin-out buzz
   */
  public playHazardStun() {
    if (!this.ctx || !this.masterGain || this.muted) return;
    this.ensureContext();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.linearRampToValueAtTime(90, now + 0.25);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  /**
   * Victory Fanfare arpeggio
   */
  public playVictory() {
    if (!this.ctx || !this.masterGain || this.muted) return;
    this.ensureContext();
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);

      gain.gain.setValueAtTime(0, now + idx * 0.12);
      gain.gain.linearRampToValueAtTime(0.35, now + idx * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.38);
    });
  }

  /**
   * Playful Dog Bark sound
   */
  public playDogBark() {
    if (!this.ctx || !this.masterGain || this.muted) return;
    this.ensureContext();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.14);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, now);
    filter.frequency.exponentialRampToValueAtTime(250, now + 0.14);
    filter.Q.setValueAtTime(3.5, now);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  /**
   * Dog Dropping Roomba at corner
   */
  public playDogDrop() {
    if (!this.ctx || !this.masterGain || this.muted) return;
    this.ensureContext();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.18);

    gain.gain.setValueAtTime(0.55, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  /**
   * High Value Clean chime: triumphant crystal fanfare
   */
  public playHighValueChime() {
    if (!this.ctx || !this.masterGain || this.muted) return;
    this.ensureContext();
    const now = this.ctx.currentTime;
    const notes = [1046.5, 1318.5, 1567.98, 2093.0]; // C6, E6, G6, C7
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);

      gain.gain.setValueAtTime(0, now + idx * 0.06);
      gain.gain.linearRampToValueAtTime(0.4, now + idx * 0.06 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.28);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.3);
    });
  }

  /**
   * High Value Spot spawn announcement chime
   */
  public playHighValueSpawn() {
    if (!this.ctx || !this.masterGain || this.muted) return;
    this.ensureContext();
    const now = this.ctx.currentTime;
    const freqs = [587.33, 880.0, 1174.66]; // D5, A5, D6
    freqs.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0, now + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.25, now + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.4);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.45);
    });
  }
}

export const soundSynth = new SoundSynthEngine();
