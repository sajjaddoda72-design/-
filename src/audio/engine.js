import { PitchShifter } from 'soundtouchjs';
import { useStore, EQ_BANDS } from '../store';
import { generateImpulseResponse } from './reverb';

/**
 * Reverse an AudioBuffer without mutating the original.
 */
function reverseBuffer(ctx, buffer) {
  const numChannels = buffer.numberOfChannels;
  const reversed = ctx.createBuffer(numChannels, buffer.length, buffer.sampleRate);
  for (let ch = 0; ch < numChannels; ch++) {
    const src = buffer.getChannelData(ch);
    const dst = reversed.getChannelData(ch);
    for (let i = 0, j = src.length - 1; i < src.length; i++, j--) {
      dst[i] = src[j];
    }
  }
  return reversed;
}

/**
 * Analyze peak amplitude of an AudioBuffer. Returns 0-1 float.
 */
function analyzePeak(buffer) {
  let peak = 0;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]);
      if (abs > peak) peak = abs;
    }
  }
  return peak || 1; // avoid division by zero
}

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.shifter = null;
    this.gainNode = null;
    this.panNode = null;
    this.compressor = null;
    this.normalizeGain = null; // real-time normalize GainNode
    this.reverbDry = null;
    this.reverbWet = null;
    this.convolver = null;
    this.preDelay = null;
    this.fxNodes = [];
    this.fxDryGain = null;
    this.fxWetGain = null;
    this.limiter = null; // FINAL stage
    this.analyser = null;
    this.eqFilters = [];
    this.rafId = null;
    this.reverbCacheKey = '';
    this._initialized = false;
    this._originalBuffer = null;
    this._reversedBuffer = null;

    this.syncLoop = this.syncLoop.bind(this);
    this.handlePlayEvent = this.handlePlayEvent.bind(this);
  }

  _ensureContext() {
    if (this._initialized) return;
    this._initialized = true;

    this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    // Volume
    this.gainNode = this.ctx.createGain();

    // Pan
    this.panNode = this.ctx.createStereoPanner
      ? this.ctx.createStereoPanner()
      : this.ctx.createGain();

    // 18-band EQ
    this.eqFilters = EQ_BANDS.map((freq, i) => {
      const f = this.ctx.createBiquadFilter();
      if (i === 0) f.type = 'lowshelf';
      else if (i === EQ_BANDS.length - 1) f.type = 'highshelf';
      else { f.type = 'peaking'; f.Q.value = 1.4; }
      f.frequency.value = freq;
      f.gain.value = 0;
      return f;
    });
    for (let i = 1; i < this.eqFilters.length; i++) {
      this.eqFilters[i - 1].connect(this.eqFilters[i]);
    }

    // Compressor
    this.compressor = this.ctx.createDynamicsCompressor();

    // Normalize — real-time GainNode (gain = targetLinear / peak)
    this.normalizeGain = this.ctx.createGain();
    this.normalizeGain.gain.value = 1;

    // FX preset dry/wet
    this.fxDryGain = this.ctx.createGain();
    this.fxWetGain = this.ctx.createGain();
    this.fxDryGain.gain.value = 1;
    this.fxWetGain.gain.value = 0;

    // Reverb
    this.reverbDry = this.ctx.createGain();
    this.reverbWet = this.ctx.createGain();
    this.convolver = this.ctx.createConvolver();
    this.preDelay = this.ctx.createDelay(1);

    // Limiter — FINAL stage (hard-knee compressor)
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = 0;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 1;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.1;

    // Analyser
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;

    /*
     * CORRECT CHAIN ORDER:
     * Source (PitchShifter) → Gain → Pan → EQ → Compressor → Normalize
     *   → FX dry/wet → Reverb dry/wet → Limiter (FINAL) → Analyser → Output
     */
    this._connectChain();

    // Subscribe to store
    this._unsubscribe = useStore.subscribe((state, prev) => {
      if (state.isPlaying !== prev.isPlaying) {
        state.isPlaying ? this.play() : this.pause();
      }
      if (state.reversed !== prev.reversed && this._originalBuffer) {
        const wasPlaying = state.isPlaying;
        if (wasPlaying) this.pause();
        this._loadBuffer(state.reversed ? this._reversedBuffer : this._originalBuffer);
        if (wasPlaying) setTimeout(() => useStore.getState().setIsPlaying(true), 50);
      }
      this.updateParams(state);
    });
  }

  _connectChain() {
    // Gain → Pan → EQ chain
    this.gainNode.connect(this.panNode);
    this.panNode.connect(this.eqFilters[0]);
    const lastEq = this.eqFilters[this.eqFilters.length - 1];

    // EQ → Compressor → Normalize
    lastEq.connect(this.compressor);
    this.compressor.connect(this.normalizeGain);

    // Normalize → FX dry path → Reverb dry
    this.normalizeGain.connect(this.fxDryGain);
    this.fxDryGain.connect(this.reverbDry);

    // FX wet path → Reverb dry
    this.fxWetGain.connect(this.reverbDry);

    // Normalize → Reverb wet path (preDelay → convolver → reverbWet)
    const preDelayGain = this.ctx.createGain();
    this.normalizeGain.connect(preDelayGain);
    preDelayGain.connect(this.preDelay);
    this.preDelay.connect(this.convolver);
    this.convolver.connect(this.reverbWet);

    // Reverb dry + wet → Limiter (FINAL) → Analyser → Output
    this.reverbDry.connect(this.limiter);
    this.reverbWet.connect(this.limiter);
    this.limiter.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
  }

  load(audioBuffer) {
    this._ensureContext();

    this._originalBuffer = audioBuffer;
    this._reversedBuffer = reverseBuffer(this.ctx, audioBuffer);

    // Analyze peak ONCE and store it
    const peak = analyzePeak(audioBuffer);
    useStore.getState().setNormalize({ peakValue: peak });

    const state = useStore.getState();
    this._loadBuffer(state.reversed ? this._reversedBuffer : this._originalBuffer);
    this.updateParams(state);

    if (state.isPlaying) this.play();
  }

  _loadBuffer(audioBuffer) {
    if (this.shifter) {
      this.shifter.disconnect();
      this.shifter.off('play', this.handlePlayEvent);
      this.shifter = null;
    }
    this.shifter = new PitchShifter(this.ctx, audioBuffer, 8192);
    this.shifter.on('play', this.handlePlayEvent);
  }

  handlePlayEvent(detail) {
    const state = useStore.getState();
    if (Math.abs(state.currentTime - detail.timePlayed) > 0.1) {
      state.setCurrentTime(detail.timePlayed);
    }
    if (detail.percentagePlayed >= 100) {
      state.setIsPlaying(false);
      state.setCurrentTime(0);
      if (this.shifter) this.shifter.percentagePlayed = 0;
    }
  }

  play() {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.shifter) {
      this.shifter.connect(this.gainNode);
      this.syncLoop();
    }
  }

  pause() {
    if (this.shifter) this.shifter.disconnect();
    cancelAnimationFrame(this.rafId);
  }

  unload() {
    this.pause();
    if (this.shifter) {
      this.shifter.off('play', this.handlePlayEvent);
      this.shifter = null;
    }
    this._originalBuffer = null;
    this._reversedBuffer = null;
    this.clearPreset();
  }

  seek(perc) {
    if (this.shifter) {
      this.shifter.percentagePlayed = perc;
      useStore.getState().setCurrentTime(this.shifter.duration * perc);
    }
  }

  // ---- FX Preset ----

  applyPreset(buildFn, wet = 0.6) {
    this.clearPreset();
    if (!this.ctx) return;
    const nodes = buildFn(this.ctx);
    this.fxNodes = nodes;
    // Wire: normalizeGain → nodes[0] → ... → nodes[n] → fxWetGain
    if (nodes.length > 0) {
      this.normalizeGain.connect(nodes[0]);
      for (let i = 1; i < nodes.length; i++) nodes[i - 1].connect(nodes[i]);
      nodes[nodes.length - 1].connect(this.fxWetGain);
    }
    this.fxDryGain.gain.setTargetAtTime(1 - wet, this.ctx.currentTime, 0.05);
    this.fxWetGain.gain.setTargetAtTime(wet, this.ctx.currentTime, 0.05);
  }

  clearPreset() {
    if (!this.ctx) return;
    for (const node of this.fxNodes) {
      try { node.disconnect(); } catch { /* ok */ }
    }
    this.fxNodes = [];
    this.fxDryGain.gain.setTargetAtTime(1, this.ctx.currentTime, 0.05);
    this.fxWetGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
  }

  updateParams(state) {
    if (this.shifter) {
      this.shifter.tempo = state.speed;
      this.shifter.pitchSemitones = state.pitch;
    }
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    // Volume
    this.gainNode.gain.setTargetAtTime(Math.pow(10, state.volume / 20), t, 0.05);

    // Pan
    if (this.panNode.pan) {
      this.panNode.pan.setTargetAtTime(state.pan / 100, t, 0.05);
    }

    // 18-Band EQ
    if (state.eq && state.eq.gains) {
      EQ_BANDS.forEach((freq, i) => {
        const dB = state.eq.enabled ? (state.eq.gains[freq] || 0) : 0;
        this.eqFilters[i].gain.setTargetAtTime(dB, t, 0.05);
      });
    }

    // Compressor
    if (state.compressor) {
      this.compressor.threshold.setTargetAtTime(state.compressor.threshold, t, 0.05);
      this.compressor.ratio.setTargetAtTime(state.compressor.ratio, t, 0.05);
      this.compressor.attack.setTargetAtTime(state.compressor.attack, t, 0.05);
      this.compressor.release.setTargetAtTime(state.compressor.release, t, 0.05);
    }

    // Normalize — real-time GainNode: gain = targetLinear / peak
    if (state.normalize) {
      if (state.normalize.enabled && state.normalize.peakValue > 0) {
        const targetLinear = Math.pow(10, state.normalize.targetDb / 20);
        const normGain = targetLinear / state.normalize.peakValue;
        this.normalizeGain.gain.setTargetAtTime(normGain, t, 0.05);
      } else {
        this.normalizeGain.gain.setTargetAtTime(1, t, 0.05);
      }
    }

    // Reverb
    if (state.reverb.enabled) {
      this.reverbDry.gain.setTargetAtTime(1 - state.reverb.wet, t, 0.05);
      this.reverbWet.gain.setTargetAtTime(state.reverb.wet, t, 0.05);
      this.preDelay.delayTime.setTargetAtTime(state.reverb.preDelay, t, 0.05);
      const key = `${state.reverb.roomSize.toFixed(2)}-${state.reverb.decay.toFixed(2)}`;
      if (this.reverbCacheKey !== key) {
        this.convolver.buffer = generateImpulseResponse(this.ctx, state.reverb.roomSize * 5, state.reverb.decay * 10, false);
        this.reverbCacheKey = key;
      }
    } else {
      this.reverbDry.gain.setTargetAtTime(1, t, 0.05);
      this.reverbWet.gain.setTargetAtTime(0, t, 0.05);
    }

    // Limiter — FINAL stage
    if (state.limiter) {
      const lThresh = state.limiter.enabled ? state.limiter.threshold : 0;
      const lRatio = state.limiter.enabled ? 20 : 1;
      this.limiter.threshold.setTargetAtTime(lThresh, t, 0.05);
      this.limiter.ratio.setTargetAtTime(lRatio, t, 0.05);
      this.limiter.release.setTargetAtTime(state.limiter.release, t, 0.05);
    }
  }

  syncLoop() {
    if (useStore.getState().isPlaying && this.shifter) {
      this.rafId = requestAnimationFrame(this.syncLoop);
    }
  }
}

export const engine = new AudioEngine();
