/**
 * Procedural sound effects and music using Web Audio API.
 * No external audio files needed — all sounds are synthesized.
 */
export class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;
  private musicGain: GainNode | null = null;
  private musicPlaying = false;
  private musicNodes: (OscillatorNode | AudioBufferSourceNode)[] = [];
  private musicTimers: number[] = [];
  private musicVolume = 0.08;
  private currentMapId = '';
  private loopCount = 0;

  init(): void {
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.3;
    this.masterGain.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicVolume;
    this.musicGain.connect(this.ctx.destination);
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) this.init();
    if (this.ctx!.state === 'suspended') this.ctx!.resume();
    return this.ctx!;
  }

  /** Short water squirt sound */
  playShoot(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    const now = ctx.currentTime;

    // Noise burst for water spray
    const duration = 0.08;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    // Bandpass to make it sound like water
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2000;
    filter.Q.value = 1.5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);
    noise.start(now);
    noise.stop(now + duration);
  }

  /** Water splash on hit */
  playSplash(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    const now = ctx.currentTime;

    const duration = 0.2;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800;
    filter.Q.value = 0.8;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);
    noise.start(now);
    noise.stop(now + duration);
  }

  /** Taking damage sound - pitch varies based on remaining health (0-100) */
  playHurt(healthRemaining: number = 50): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    const now = ctx.currentTime;

    // Higher pitch = lower health (more urgent)
    const healthPct = Math.max(0, Math.min(1, healthRemaining / 100));
    const baseFreq = 120 + (1 - healthPct) * 280; // 120Hz at full health, 400Hz at low
    const endFreq = 50 + (1 - healthPct) * 80;
    const duration = 0.15 + (1 - healthPct) * 0.1; // Longer at low health

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3 + (1 - healthPct) * 0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + duration);

    // Add a splash layer
    const splashDuration = 0.12;
    const bufferSize = ctx.sampleRate * splashDuration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 600 + (1 - healthPct) * 600;
    filter.Q.value = 1;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.2, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + splashDuration);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain!);
    noise.start(now);
    noise.stop(now + splashDuration);
  }

  /** Kill confirmed sound */
  playKill(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    const now = ctx.currentTime;

    // Two-tone ascending ding
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = i === 0 ? 600 : 900;

      const gain = ctx.createGain();
      const t = now + i * 0.1;
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.15);
    }
  }

  /** Death sound */
  playDeath(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.5);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  /** Round start countdown beep */
  playBeep(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 880;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.musicGain) {
      this.musicGain.gain.value = this.muted ? 0 : this.musicVolume;
    }
    return this.muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  // ===================== BACKGROUND MUSIC =====================

  /** Start map-themed background music with fade-in */
  startMusic(mapId: string = 'aqua_park'): void {
    if (this.musicPlaying) this.stopMusic();
    this.musicPlaying = true;
    this.currentMapId = mapId;
    this.loopCount = 0;
    const ctx = this.ensureContext();
    if (!this.musicGain) {
      this.musicGain = ctx.createGain();
      this.musicGain.connect(ctx.destination);
    }
    // Fade in from silence over first loop
    this.musicGain.gain.setValueAtTime(0, ctx.currentTime);
    this.musicGain.gain.linearRampToValueAtTime(
      this.muted ? 0 : this.musicVolume,
      ctx.currentTime + 8
    );
    this.scheduleMusicLoop();
  }

  stopMusic(): void {
    this.musicPlaying = false;
    for (const node of this.musicNodes) {
      try { node.stop(); } catch {}
    }
    this.musicNodes = [];
    for (const t of this.musicTimers) {
      clearTimeout(t);
    }
    this.musicTimers = [];
  }

  // ---- Helpers ----

  private playNote(
    ctx: AudioContext, now: number, freq: number, time: number, dur: number,
    type: OscillatorType, vol: number, filterType?: BiquadFilterType, filterFreq?: number
  ): void {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now + time);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, now + time);
    g.gain.setValueAtTime(vol, now + time + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.01, now + time + dur);
    if (filterType && filterFreq) {
      const f = ctx.createBiquadFilter();
      f.type = filterType;
      f.frequency.value = filterFreq;
      osc.connect(f);
      f.connect(g);
    } else {
      osc.connect(g);
    }
    g.connect(this.musicGain!);
    osc.start(now + time);
    osc.stop(now + time + dur + 0.05);
    this.musicNodes.push(osc);
  }

  private playPad(ctx: AudioContext, now: number, freqs: number[], time: number, dur: number, vol: number): void {
    for (const freq of freqs) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now + time);
      g.gain.linearRampToValueAtTime(vol, now + time + 0.4);
      g.gain.setValueAtTime(vol, now + time + dur - 0.4);
      g.gain.linearRampToValueAtTime(0, now + time + dur);
      osc.connect(g);
      g.connect(this.musicGain!);
      osc.start(now + time);
      osc.stop(now + time + dur + 0.05);
      this.musicNodes.push(osc);
    }
  }

  private playKick(ctx: AudioContext, t: number, vol: number): void {
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.15);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
    osc.connect(g);
    g.connect(this.musicGain!);
    osc.start(t);
    osc.stop(t + 0.2);
    this.musicNodes.push(osc);
  }

  private playSnare(ctx: AudioContext, t: number, vol: number, hpFreq: number = 1000): void {
    const dur = 0.1;
    const size = ctx.sampleRate * dur;
    const buf = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let s = 0; s < size; s++) {
      data[s] = (Math.random() * 2 - 1) * Math.pow(1 - s / size, 1.5);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = hpFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.01, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.musicGain!);
    src.start(t);
    src.stop(t + dur + 0.01);
    this.musicNodes.push(src);
  }

  private playHihat(ctx: AudioContext, t: number, vol: number): void {
    const dur = 0.04;
    const size = ctx.sampleRate * dur;
    const buf = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let s = 0; s < size; s++) {
      data[s] = (Math.random() * 2 - 1) * Math.pow(1 - s / size, 3);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.01, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.musicGain!);
    src.start(t);
    src.stop(t + dur + 0.01);
    this.musicNodes.push(src);
  }

  private scheduleMusicLoop(): void {
    if (!this.musicPlaying) return;
    this.loopCount++;

    switch (this.currentMapId) {
      case 'aqua_park': this.musicAquaPark(); break;
      case 'pirate_cove': this.musicPirateCove(); break;
      case 'neon_city': this.musicNeonCity(); break;
      case 'sky_fortress': this.musicSkyFortress(); break;
      case 'jungle_temple': this.musicJungleTemple(); break;
      case 'mega_arena': this.musicMegaArena(); break;
      default: this.musicAquaPark(); break;
    }
  }

  private scheduleNextLoop(loopDuration: number): void {
    const timer = window.setTimeout(() => {
      this.musicNodes = [];
      this.scheduleMusicLoop();
    }, loopDuration * 1000);
    this.musicTimers.push(timer);
  }

  // ===================== AQUA PARK — Bright, upbeat summer pop =====================
  private musicAquaPark(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const bpm = 128; const beat = 60 / bpm; const bar = beat * 4;
    const loopDuration = bar * 8;

    // Bass — bouncy C-F-G-C
    const bass: [number, number, number][] = [
      [130.81, 0, beat*0.8], [130.81, beat*1.5, beat*0.5], [155.56, beat*2, beat*0.8], [130.81, beat*3, beat*0.5],
      [130.81, bar, beat*0.8], [174.61, bar+beat, beat*0.8], [196.00, bar+beat*2, beat*1.2],
      [174.61, bar*2, beat*0.8], [174.61, bar*2+beat*1.5, beat*0.5], [196.00, bar*2+beat*2, beat*0.8],
      [174.61, bar*3, beat*0.8], [233.08, bar*3+beat, beat*0.8], [196.00, bar*3+beat*2, beat*1.2],
      [196.00, bar*4, beat*0.6], [196.00, bar*4+beat*0.75, beat*0.3], [233.08, bar*4+beat*1.5, beat*0.5],
      [196.00, bar*5, beat*0.8], [233.08, bar*5+beat, beat*0.5], [196.00, bar*5+beat*2, beat*1.2],
      [130.81, bar*6, beat*0.8], [155.56, bar*6+beat, beat*0.5], [174.61, bar*6+beat*2, beat*0.8],
      [130.81, bar*7, beat*0.8], [155.56, bar*7+beat*2, beat*0.8],
    ];
    for (const [f, t, d] of bass) this.playNote(ctx, now, f, t, d, 'triangle', 0.3);

    // Melody — bright pentatonic
    const mel: [number, number, number][] = [
      [523.25, 0, beat*0.5], [587.33, beat*0.5, beat*0.5], [659.25, beat, beat], [783.99, beat*2, beat*1.5],
      [659.25, bar+beat*0.5, beat*0.5], [783.99, bar+beat, beat*0.5], [880, bar+beat*1.5, beat], [783.99, bar+beat*3, beat],
      [659.25, bar*2, beat*0.5], [783.99, bar*2+beat*0.5, beat*0.5], [880, bar*2+beat, beat],
      [587.33, bar*3, beat*0.5], [659.25, bar*3+beat, beat], [523.25, bar*3+beat*2.5, beat*1.5],
      [783.99, bar*4, beat*0.5], [880, bar*4+beat*0.5, beat*0.5], [1046.5, bar*4+beat, beat],
      [783.99, bar*5, beat], [880, bar*5+beat*1.5, beat*0.5], [783.99, bar*5+beat*2, beat],
      [523.25, bar*6, beat], [659.25, bar*6+beat*2, beat], [523.25, bar*7, beat], [659.25, bar*7+beat*1.5, beat*0.5], [523.25, bar*7+beat*2.5, beat*1.5],
    ];
    for (const [f, t, d] of mel) this.playNote(ctx, now, f, t, d, 'square', 0.12, 'lowpass', 2500);

    // Drums
    for (let b = 0; b < 32; b++) {
      const t = now + b * beat;
      if (b % 4 === 0 || b % 4 === 2) this.playKick(ctx, t, 0.35);
      if (b % 4 === 1 || b % 4 === 3) this.playSnare(ctx, t, 0.2);
      this.playHihat(ctx, t, 0.1);
      this.playHihat(ctx, t + beat * 0.5, 0.06);
    }

    // Pads
    this.playPad(ctx, now, [261.63, 329.63, 392.00], 0, bar*2, 0.05);
    this.playPad(ctx, now, [349.23, 440.00, 523.25], bar*2, bar*2, 0.05);
    this.playPad(ctx, now, [392.00, 493.88, 587.33], bar*4, bar*2, 0.05);
    this.playPad(ctx, now, [261.63, 329.63, 392.00], bar*6, bar*2, 0.05);

    this.scheduleNextLoop(loopDuration);
  }

  // ===================== PIRATE COVE — Sea shanty / folk feel =====================
  private musicPirateCove(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const bpm = 110; const beat = 60 / bpm; const bar = beat * 4;
    const loopDuration = bar * 8;

    // Bass — D minor / shanty progression: Dm-C-Bb-A
    const bass: [number, number, number][] = [
      [146.83, 0, beat*1.2], [146.83, beat*2, beat*0.8], [146.83, beat*3, beat*0.5],
      [146.83, bar, beat*0.8], [130.81, bar+beat*2, beat*1.2],
      [116.54, bar*2, beat*1.2], [116.54, bar*2+beat*2, beat*0.8], [116.54, bar*2+beat*3, beat*0.5],
      [110.00, bar*3, beat*1.2], [110.00, bar*3+beat*2, beat*0.8],
      // Repeat with variation
      [146.83, bar*4, beat*1.2], [146.83, bar*4+beat*2, beat*0.6], [164.81, bar*4+beat*3, beat*0.5],
      [130.81, bar*5, beat*1.2], [130.81, bar*5+beat*2, beat*1.2],
      [116.54, bar*6, beat*1.2], [116.54, bar*6+beat*2, beat*0.8],
      [110.00, bar*7, beat*0.8], [130.81, bar*7+beat*1.5, beat*0.5], [146.83, bar*7+beat*2.5, beat*1.5],
    ];
    for (const [f, t, d] of bass) this.playNote(ctx, now, f, t, d, 'triangle', 0.3);

    // Melody — jaunty accordion/fiddle feel in D minor pentatonic
    const mel: [number, number, number][] = [
      // Shanty call
      [587.33, 0, beat*0.8], [523.25, beat, beat*0.5], [587.33, beat*1.5, beat*0.5], [698.46, beat*2, beat],
      [659.25, bar, beat*0.5], [587.33, bar+beat*0.5, beat*0.5], [523.25, bar+beat, beat], [466.16, bar+beat*2.5, beat*1.5],
      // Response
      [523.25, bar*2, beat*0.8], [466.16, bar*2+beat, beat*0.5], [523.25, bar*2+beat*1.5, beat*0.5], [587.33, bar*2+beat*2, beat*1.5],
      [440.00, bar*3, beat], [523.25, bar*3+beat*1.5, beat*0.5], [587.33, bar*3+beat*2, beat*1.5],
      // High phrase
      [698.46, bar*4, beat*0.5], [783.99, bar*4+beat*0.5, beat*0.5], [880.00, bar*4+beat, beat],
      [783.99, bar*4+beat*2, beat*0.5], [698.46, bar*4+beat*2.5, beat*0.5], [587.33, bar*4+beat*3, beat],
      [523.25, bar*5, beat], [587.33, bar*5+beat*1.5, beat*0.5], [523.25, bar*5+beat*2, beat*1.5],
      // Resolve
      [466.16, bar*6, beat*0.8], [523.25, bar*6+beat, beat*0.5], [587.33, bar*6+beat*2, beat],
      [523.25, bar*7, beat*0.8], [466.16, bar*7+beat, beat*0.5], [587.33, bar*7+beat*2, beat*2],
    ];
    for (const [f, t, d] of mel) this.playNote(ctx, now, f, t, d, 'sawtooth', 0.10, 'lowpass', 1800);

    // Drums — stompy 3/4 feel over 4/4 (skip some snares for swing)
    for (let b = 0; b < 32; b++) {
      const t = now + b * beat;
      if (b % 4 === 0) this.playKick(ctx, t, 0.35);
      if (b % 4 === 2) this.playKick(ctx, t, 0.2);
      if (b % 4 === 1 || b % 4 === 3) this.playSnare(ctx, t, 0.15, 800);
      // Swing hi-hat (dotted feel)
      this.playHihat(ctx, t, 0.08);
      if (b % 2 === 0) this.playHihat(ctx, t + beat * 0.66, 0.05);
    }

    // Pads — open fifths for sea ambiance
    this.playPad(ctx, now, [293.66, 440.00], 0, bar*2, 0.05);
    this.playPad(ctx, now, [261.63, 392.00], bar*2, bar*2, 0.05);
    this.playPad(ctx, now, [233.08, 349.23], bar*4, bar*2, 0.05);
    this.playPad(ctx, now, [220.00, 329.63, 440.00], bar*6, bar*2, 0.05);

    this.scheduleNextLoop(loopDuration);
  }

  // ===================== NEON CITY — Synthwave / retrowave =====================
  private musicNeonCity(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const bpm = 118; const beat = 60 / bpm; const bar = beat * 4;
    const loopDuration = bar * 8;

    // Bass — pulsing 8th notes, Am-F-C-G synthwave progression
    const bassProgression: [number, number][] = [
      [110.00, 0], [110.00, bar], [87.31, bar*2], [87.31, bar*3],
      [130.81, bar*4], [130.81, bar*5], [98.00, bar*6], [98.00, bar*7],
    ];
    for (const [freq, startTime] of bassProgression) {
      for (let i = 0; i < 8; i++) {
        const t = startTime + i * beat * 0.5;
        this.playNote(ctx, now, freq, t, beat * 0.4, 'sawtooth', 0.20, 'lowpass', 400);
      }
    }

    // Arp — shimmering arpeggiated synth
    const arps: [number, number, number][] = [
      // Am arp
      [440, 0, beat*0.3], [523.25, beat*0.5, beat*0.3], [659.25, beat, beat*0.3], [523.25, beat*1.5, beat*0.3],
      [440, beat*2, beat*0.3], [523.25, beat*2.5, beat*0.3], [659.25, beat*3, beat*0.3], [523.25, beat*3.5, beat*0.3],
      [440, bar, beat*0.3], [523.25, bar+beat*0.5, beat*0.3], [659.25, bar+beat, beat*0.3], [880, bar+beat*1.5, beat*0.3],
      [659.25, bar+beat*2, beat*0.3], [523.25, bar+beat*2.5, beat*0.3], [440, bar+beat*3, beat*0.3], [523.25, bar+beat*3.5, beat*0.3],
      // F arp
      [349.23, bar*2, beat*0.3], [440, bar*2+beat*0.5, beat*0.3], [523.25, bar*2+beat, beat*0.3], [440, bar*2+beat*1.5, beat*0.3],
      [349.23, bar*2+beat*2, beat*0.3], [440, bar*2+beat*2.5, beat*0.3], [523.25, bar*2+beat*3, beat*0.3], [440, bar*2+beat*3.5, beat*0.3],
      [349.23, bar*3, beat*0.3], [440, bar*3+beat*0.5, beat*0.3], [523.25, bar*3+beat, beat*0.3], [698.46, bar*3+beat*1.5, beat*0.3],
      [523.25, bar*3+beat*2, beat*0.3], [440, bar*3+beat*2.5, beat*0.3], [349.23, bar*3+beat*3, beat*0.3], [440, bar*3+beat*3.5, beat*0.3],
      // C arp
      [523.25, bar*4, beat*0.3], [659.25, bar*4+beat*0.5, beat*0.3], [783.99, bar*4+beat, beat*0.3], [659.25, bar*4+beat*1.5, beat*0.3],
      [523.25, bar*4+beat*2, beat*0.3], [659.25, bar*4+beat*2.5, beat*0.3], [783.99, bar*4+beat*3, beat*0.3], [659.25, bar*4+beat*3.5, beat*0.3],
      [523.25, bar*5, beat*0.3], [659.25, bar*5+beat*0.5, beat*0.3], [783.99, bar*5+beat, beat*0.3], [1046.5, bar*5+beat*1.5, beat*0.3],
      [783.99, bar*5+beat*2, beat*0.3], [659.25, bar*5+beat*2.5, beat*0.3], [523.25, bar*5+beat*3, beat*0.3], [659.25, bar*5+beat*3.5, beat*0.3],
      // G arp
      [392.00, bar*6, beat*0.3], [493.88, bar*6+beat*0.5, beat*0.3], [587.33, bar*6+beat, beat*0.3], [493.88, bar*6+beat*1.5, beat*0.3],
      [392.00, bar*6+beat*2, beat*0.3], [493.88, bar*6+beat*2.5, beat*0.3], [587.33, bar*6+beat*3, beat*0.3], [493.88, bar*6+beat*3.5, beat*0.3],
      [392.00, bar*7, beat*0.3], [493.88, bar*7+beat*0.5, beat*0.3], [587.33, bar*7+beat, beat*0.3], [783.99, bar*7+beat*1.5, beat*0.3],
      [587.33, bar*7+beat*2, beat*0.3], [493.88, bar*7+beat*2.5, beat*0.3], [392.00, bar*7+beat*3, beat*0.3], [493.88, bar*7+beat*3.5, beat*0.3],
    ];
    for (const [f, t, d] of arps) this.playNote(ctx, now, f, t, d, 'square', 0.08, 'lowpass', 3000);

    // Lead melody — soaring synth
    const mel: [number, number, number][] = [
      [880, bar, beat], [783.99, bar+beat*1.5, beat*0.5], [659.25, bar+beat*2, beat*1.5],
      [698.46, bar*3, beat], [659.25, bar*3+beat*1.5, beat*0.5], [523.25, bar*3+beat*2, beat*1.5],
      [1046.5, bar*5, beat], [880, bar*5+beat*1.5, beat*0.5], [783.99, bar*5+beat*2, beat],
      [783.99, bar*7, beat], [659.25, bar*7+beat*1.5, beat*0.5], [587.33, bar*7+beat*2, beat*1.5],
    ];
    for (const [f, t, d] of mel) this.playNote(ctx, now, f, t, d, 'sawtooth', 0.10, 'lowpass', 2000);

    // Drums — 4-on-the-floor with open hats
    for (let b = 0; b < 32; b++) {
      const t = now + b * beat;
      this.playKick(ctx, t, 0.35);
      if (b % 4 === 1 || b % 4 === 3) this.playSnare(ctx, t, 0.18);
      this.playHihat(ctx, t + beat * 0.5, 0.09);
    }

    // Pads — lush minor chords
    this.playPad(ctx, now, [220.00, 261.63, 329.63], 0, bar*2, 0.06);
    this.playPad(ctx, now, [174.61, 220.00, 261.63], bar*2, bar*2, 0.06);
    this.playPad(ctx, now, [261.63, 329.63, 392.00], bar*4, bar*2, 0.06);
    this.playPad(ctx, now, [196.00, 246.94, 293.66], bar*6, bar*2, 0.06);

    this.scheduleNextLoop(loopDuration);
  }

  // ===================== SKY FORTRESS — Ethereal / floaty ambient =====================
  private musicSkyFortress(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const bpm = 100; const beat = 60 / bpm; const bar = beat * 4;
    const loopDuration = bar * 8;

    // Bass — slow, airy, Cmaj7-Fmaj7-Am7-Gmaj7
    const bass: [number, number, number][] = [
      [130.81, 0, bar*1.8], [130.81, bar*1.5, beat*0.5],
      [174.61, bar*2, bar*1.8],
      [110.00, bar*4, bar*1.8],
      [98.00, bar*6, bar*1.8], [130.81, bar*7+beat*2, beat*1.5],
    ];
    for (const [f, t, d] of bass) this.playNote(ctx, now, f, t, d, 'sine', 0.25);

    // Melody — airy, floating, wide intervals
    const mel: [number, number, number][] = [
      [783.99, beat, beat*1.5], [1046.5, beat*3, beat*1.5],
      [880, bar+beat*2, beat*2],
      [698.46, bar*2+beat, beat*1.5], [1046.5, bar*2+beat*3, beat*1.5],
      [880, bar*3+beat*2, beat*2],
      [659.25, bar*4+beat, beat*1.5], [880, bar*4+beat*3, beat*1.5],
      [783.99, bar*5+beat, beat*2],
      [587.33, bar*6+beat, beat*1.5], [783.99, bar*6+beat*3, beat*1.5],
      [659.25, bar*7+beat, beat], [783.99, bar*7+beat*2.5, beat*1.5],
    ];
    for (const [f, t, d] of mel) this.playNote(ctx, now, f, t, d, 'sine', 0.12, 'lowpass', 3500);

    // Chime/bell arpeggios — high sparkly notes
    const chimes: [number, number, number][] = [
      [1318.51, bar*0.5, beat*0.4], [1567.98, bar*0.5+beat, beat*0.4], [2093.00, bar*0.5+beat*2, beat*0.4],
      [1567.98, bar*2.5, beat*0.4], [1318.51, bar*2.5+beat, beat*0.4], [1760.00, bar*2.5+beat*2, beat*0.4],
      [1318.51, bar*4.5, beat*0.4], [1046.50, bar*4.5+beat, beat*0.4], [1318.51, bar*4.5+beat*2, beat*0.4],
      [1174.66, bar*6.5, beat*0.4], [1567.98, bar*6.5+beat, beat*0.4], [1318.51, bar*6.5+beat*2, beat*0.4],
    ];
    for (const [f, t, d] of chimes) this.playNote(ctx, now, f, t, d, 'sine', 0.06);

    // Drums — sparse, gentle
    for (let b = 0; b < 32; b++) {
      const t = now + b * beat;
      if (b % 8 === 0) this.playKick(ctx, t, 0.2);
      if (b % 8 === 4) this.playSnare(ctx, t, 0.08, 2000);
      if (b % 2 === 0) this.playHihat(ctx, t, 0.05);
    }

    // Pads — wide, dreamy major 7ths
    this.playPad(ctx, now, [261.63, 329.63, 392.00, 493.88], 0, bar*2, 0.06);
    this.playPad(ctx, now, [349.23, 440.00, 523.25, 659.25], bar*2, bar*2, 0.06);
    this.playPad(ctx, now, [220.00, 261.63, 329.63, 415.30], bar*4, bar*2, 0.06);
    this.playPad(ctx, now, [196.00, 246.94, 293.66, 392.00], bar*6, bar*2, 0.06);

    this.scheduleNextLoop(loopDuration);
  }

  // ===================== JUNGLE TEMPLE — Tribal / world percussion =====================
  private musicJungleTemple(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const bpm = 115; const beat = 60 / bpm; const bar = beat * 4;
    const loopDuration = bar * 8;

    // Bass — deep, mysterious E minor / phrygian
    const bass: [number, number, number][] = [
      [82.41, 0, beat*0.8], [82.41, beat*1.5, beat*0.3], [87.31, beat*2, beat*0.8], [82.41, beat*3.5, beat*0.5],
      [82.41, bar, beat*0.8], [98.00, bar+beat*1.5, beat*0.5], [87.31, bar+beat*2.5, beat*0.8],
      [87.31, bar*2, beat*0.8], [82.41, bar*2+beat*1.5, beat*0.5], [87.31, bar*2+beat*2, beat*0.8],
      [98.00, bar*3, beat*0.8], [87.31, bar*3+beat*1.5, beat*0.5], [82.41, bar*3+beat*2.5, beat*1],
      [82.41, bar*4, beat*0.8], [82.41, bar*4+beat*1.5, beat*0.3], [110.00, bar*4+beat*2, beat*0.8],
      [98.00, bar*5, beat*0.8], [87.31, bar*5+beat*1.5, beat*0.5], [82.41, bar*5+beat*2.5, beat*1],
      [87.31, bar*6, beat*0.8], [98.00, bar*6+beat*1.5, beat*0.5], [110.00, bar*6+beat*2.5, beat*0.8],
      [98.00, bar*7, beat*0.8], [87.31, bar*7+beat*1.5, beat*0.5], [82.41, bar*7+beat*2.5, beat*1.5],
    ];
    for (const [f, t, d] of bass) this.playNote(ctx, now, f, t, d, 'triangle', 0.3);

    // Melody — snake charmer / pentatonic minor
    const mel: [number, number, number][] = [
      [329.63, 0, beat*0.5], [349.23, beat*0.5, beat*0.3], [329.63, beat, beat*0.5], [261.63, beat*1.5, beat*0.8],
      [293.66, bar, beat*0.8], [329.63, bar+beat, beat*0.5], [392.00, bar+beat*2, beat],
      [329.63, bar*2, beat*0.5], [349.23, bar*2+beat*0.5, beat*0.3], [329.63, bar*2+beat, beat], [293.66, bar*2+beat*2.5, beat*0.5],
      [261.63, bar*3, beat], [329.63, bar*3+beat*2, beat*1.5],
      [493.88, bar*4, beat*0.5], [523.25, bar*4+beat*0.5, beat*0.3], [493.88, bar*4+beat, beat*0.5], [392.00, bar*4+beat*1.5, beat],
      [440.00, bar*5, beat], [392.00, bar*5+beat*1.5, beat*0.5], [329.63, bar*5+beat*2.5, beat*1],
      [349.23, bar*6, beat*0.5], [392.00, bar*6+beat, beat], [329.63, bar*6+beat*2.5, beat*0.8],
      [293.66, bar*7, beat*0.8], [261.63, bar*7+beat, beat*0.5], [329.63, bar*7+beat*2, beat*2],
    ];
    for (const [f, t, d] of mel) this.playNote(ctx, now, f, t, d, 'sawtooth', 0.08, 'lowpass', 1500);

    // Drums — tribal percussion with toms
    for (let b = 0; b < 32; b++) {
      const t = now + b * beat;
      // Deep kick
      if (b % 4 === 0) this.playKick(ctx, t, 0.3);
      // Rim/click on off-beats
      if (b % 4 === 2) this.playSnare(ctx, t, 0.12, 2000);
      // Shaker pattern (16th notes)
      this.playHihat(ctx, t, 0.06);
      this.playHihat(ctx, t + beat * 0.25, 0.03);
      this.playHihat(ctx, t + beat * 0.5, 0.05);
      this.playHihat(ctx, t + beat * 0.75, 0.03);
      // Tom fills every 4 bars
      if (b % 16 === 14) {
        const tom = ctx.createOscillator();
        tom.frequency.setValueAtTime(200, t);
        tom.frequency.exponentialRampToValueAtTime(80, t + 0.2);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.2, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
        tom.connect(g); g.connect(this.musicGain!);
        tom.start(t); tom.stop(t + 0.25);
        this.musicNodes.push(tom);
      }
      if (b % 16 === 15) {
        const tom = ctx.createOscillator();
        tom.frequency.setValueAtTime(160, t);
        tom.frequency.exponentialRampToValueAtTime(60, t + 0.2);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.2, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
        tom.connect(g); g.connect(this.musicGain!);
        tom.start(t); tom.stop(t + 0.25);
        this.musicNodes.push(tom);
      }
    }

    // Pads — dark, minor
    this.playPad(ctx, now, [164.81, 196.00, 246.94], 0, bar*2, 0.05);
    this.playPad(ctx, now, [174.61, 220.00, 261.63], bar*2, bar*2, 0.05);
    this.playPad(ctx, now, [196.00, 246.94, 293.66], bar*4, bar*2, 0.05);
    this.playPad(ctx, now, [164.81, 196.00, 246.94], bar*6, bar*2, 0.05);

    this.scheduleNextLoop(loopDuration);
  }

  // ===================== MEGA ARENA — Heavy, intense industrial =====================
  private musicMegaArena(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const bpm = 140; const beat = 60 / bpm; const bar = beat * 4;
    const loopDuration = bar * 8;

    // Bass — aggressive, driving E-G-A-E power progression
    const bass: [number, number, number][] = [
      [82.41, 0, beat*0.5], [82.41, beat*0.75, beat*0.3], [82.41, beat*1.5, beat*0.5], [82.41, beat*2.5, beat*0.3],
      [82.41, beat*3, beat*0.5], [82.41, beat*3.5, beat*0.3],
      [82.41, bar, beat*0.5], [98.00, bar+beat, beat*0.5], [82.41, bar+beat*2, beat*0.5], [98.00, bar+beat*3, beat*0.5],
      [98.00, bar*2, beat*0.5], [98.00, bar*2+beat*0.75, beat*0.3], [98.00, bar*2+beat*1.5, beat*0.5],
      [110.00, bar*2+beat*2.5, beat*0.5], [98.00, bar*2+beat*3.5, beat*0.3],
      [110.00, bar*3, beat*0.5], [98.00, bar*3+beat, beat*0.5], [82.41, bar*3+beat*2, beat*0.5], [98.00, bar*3+beat*3, beat*0.5],
      // Repeat higher energy
      [82.41, bar*4, beat*0.4], [82.41, bar*4+beat*0.5, beat*0.3], [98.00, bar*4+beat, beat*0.4], [82.41, bar*4+beat*1.5, beat*0.3],
      [110.00, bar*4+beat*2, beat*0.4], [98.00, bar*4+beat*2.5, beat*0.3], [82.41, bar*4+beat*3, beat*0.4], [110.00, bar*4+beat*3.5, beat*0.3],
      [98.00, bar*5, beat*0.5], [110.00, bar*5+beat, beat*0.5], [130.81, bar*5+beat*2, beat*1],
      [110.00, bar*6, beat*0.5], [98.00, bar*6+beat, beat*0.5], [82.41, bar*6+beat*2, beat*0.5], [98.00, bar*6+beat*3, beat*0.5],
      [82.41, bar*7, beat*0.5], [82.41, bar*7+beat*0.75, beat*0.3], [82.41, bar*7+beat*1.5, beat*0.5],
      [110.00, bar*7+beat*2.5, beat*0.5], [82.41, bar*7+beat*3.5, beat*0.5],
    ];
    for (const [f, t, d] of bass) this.playNote(ctx, now, f, t, d, 'sawtooth', 0.22, 'lowpass', 300);

    // Melody — aggressive, power-chord style riff
    const mel: [number, number, number][] = [
      [329.63, 0, beat*0.5], [392.00, beat, beat*0.5], [440.00, beat*2, beat], [329.63, beat*3.5, beat*0.5],
      [392.00, bar+beat, beat*0.5], [329.63, bar+beat*2, beat], [293.66, bar+beat*3.5, beat*0.5],
      [392.00, bar*2, beat*0.5], [440.00, bar*2+beat, beat*0.5], [523.25, bar*2+beat*2, beat],
      [440.00, bar*3, beat*0.5], [392.00, bar*3+beat, beat*0.5], [329.63, bar*3+beat*2, beat*1.5],
      // Higher octave
      [659.25, bar*4, beat*0.4], [783.99, bar*4+beat*0.5, beat*0.4], [880, bar*4+beat, beat*0.5],
      [783.99, bar*4+beat*2, beat*0.5], [659.25, bar*4+beat*3, beat*0.5],
      [783.99, bar*5, beat*0.5], [880, bar*5+beat, beat*0.5], [659.25, bar*5+beat*2, beat*1.5],
      [523.25, bar*6, beat*0.5], [587.33, bar*6+beat, beat*0.5], [659.25, bar*6+beat*2, beat],
      [587.33, bar*7, beat*0.5], [523.25, bar*7+beat, beat*0.5], [329.63, bar*7+beat*2, beat*2],
    ];
    for (const [f, t, d] of mel) this.playNote(ctx, now, f, t, d, 'square', 0.10, 'lowpass', 2000);

    // Drums — heavy, double-kick pattern
    for (let b = 0; b < 32; b++) {
      const t = now + b * beat;
      // Double kick
      this.playKick(ctx, t, 0.4);
      if (b % 2 === 0) this.playKick(ctx, t + beat * 0.5, 0.25);
      // Hard snare
      if (b % 4 === 1 || b % 4 === 3) this.playSnare(ctx, t, 0.25, 800);
      // Driving hats
      this.playHihat(ctx, t, 0.1);
      this.playHihat(ctx, t + beat * 0.25, 0.05);
      this.playHihat(ctx, t + beat * 0.5, 0.08);
      this.playHihat(ctx, t + beat * 0.75, 0.05);
    }

    // Power chords — distorted 5ths
    this.playPad(ctx, now, [164.81, 246.94], 0, bar*2, 0.06);
    this.playPad(ctx, now, [196.00, 293.66], bar*2, bar*2, 0.06);
    this.playPad(ctx, now, [220.00, 329.63], bar*4, bar*2, 0.06);
    this.playPad(ctx, now, [164.81, 246.94], bar*6, bar*2, 0.06);

    this.scheduleNextLoop(loopDuration);
  }
}
