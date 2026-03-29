import { PitchShifter } from 'soundtouchjs';
import { useStore, EQ_BANDS } from '../store';
import { generateImpulseResponse } from './reverb';

/**
 * Reverse an AudioBuffer without mutating the original.
 * Returns a new AudioBuffer with channels reversed in-place.
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

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.shifter = null;
    this.gainNode = null;
    this.panNode = null;
    this.reverbDry = null;
    this.reverbWet = null;
    this.convolver = null;
    this.preDelay = null;
    this.analyser = null;
    this.compressor = null;

    // 18-band EQ filters
    this.eqFilters = [];

    // FX preset nodes (managed by applyPreset / clearPreset)
    this.fxNodes = [];
    this.fxDryGain = null;
    this.fxWetGain = null;

    this.rafId = null;
    this.reverbCacheKey = '';
    this._initialized = false;

    // Keep original + reversed buffers so we never destroy the source
    this._originalBuffer = null;
    this._reversedBuffer = null;

    // Bind methods
    this.syncLoop = this.syncLoop.bind(this);
    this.handlePlayEvent = this.handlePlayEvent.bind(this);
  }

  /** Lazily create AudioContext and nodes (must happen after user gesture). */
  _ensureContext() {
    if (this._initialized) return;
    this._initialized = true;

    this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    this.gainNode = this.ctx.createGain();
    this.panNode = this.ctx.createStereoPanner
      ? this.ctx.createStereoPanner()
      : this.ctx.createGain();

    // 18-band EQ — chain of peaking filters
    this.eqFilters = EQ_BANDS.map((freq, i) => {
      const f = this.ctx.createBiquadFilter();
      if (i === 0) {
        f.type = 'lowshelf';
      } else if (i === EQ_BANDS.length - 1) {
        f.type = 'highshelf';
      } else {
        f.type = 'peaking';
        f.Q.value = 1.4;
      }
      f.frequency.value = freq;
      f.gain.value = 0;
      return f;
    });

    // Chain EQ filters together
    for (let i = 1; i < this.eqFilters.length; i++) {
      this.eqFilters[i - 1].connect(this.eqFilters[i]);
    }

    // Dynamics Compressor
    this.compressor = this.ctx.createDynamicsCompressor();

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

    // Analyser
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;

    // Signal chain:
    // gainNode -> panNode -> eqFilters[0..17] -> compressor -> fxDryGain -> reverbDry -> analyser -> dest
    //                                                       -> fxWetGain -> reverbDry
    //                                         compressor -> reverbWet path (preDelay -> convolver -> reverbWet -> analyser)
    this._connectChain();

    // Subscribe to Zustand store for play/pause and param changes
    this._unsubscribe = useStore.subscribe((state, prev) => {
      // Play / pause transitions
      if (state.isPlaying !== prev.isPlaying) {
        if (state.isPlaying) {
          this.play();
        } else {
          this.pause();
        }
      }

      // Reverse toggle — reload buffer
      if (state.reversed !== prev.reversed && this._originalBuffer) {
        const wasPlaying = state.isPlaying;
        if (wasPlaying) this.pause();
        const buf = state.reversed ? this._reversedBuffer : this._originalBuffer;
        this._loadBuffer(buf);
        if (wasPlaying) {
          // Small delay to let the new shifter settle
          setTimeout(() => useStore.getState().setIsPlaying(true), 50);
        }
      }

      // Param changes — always sync
      this.updateParams(state);
    });
  }

  /** Wire the static part of the audio graph. */
  _connectChain() {
    this.gainNode.connect(this.panNode);
    this.panNode.connect(this.eqFilters[0]);

    const lastEq = this.eqFilters[this.eqFilters.length - 1];
    lastEq.connect(this.compressor);

    // Compressor -> FX dry path
    this.compressor.connect(this.fxDryGain);
    this.fxDryGain.connect(this.reverbDry);

    // FX wet path (initially disconnected — connected when a preset is applied)
    this.fxWetGain.connect(this.reverbDry);

    // Reverb send from compressor
    const preDelayGain = this.ctx.createGain();
    this.compressor.connect(preDelayGain);
    preDelayGain.connect(this.preDelay);
    this.preDelay.connect(this.convolver);
    this.convolver.connect(this.reverbWet);

    this.reverbDry.connect(this.analyser);
    this.reverbWet.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
  }

  load(audioBuffer) {
    this._ensureContext();

    // Store original and pre-compute reversed
    this._originalBuffer = audioBuffer;
    this._reversedBuffer = reverseBuffer(this.ctx, audioBuffer);

    const state = useStore.getState();
    const buf = state.reversed ? this._reversedBuffer : this._originalBuffer;
    this._loadBuffer(buf);

    this.updateParams(state);

    if (state.isPlaying) {
      this.play();
    }
  }

  /** Internal: load a specific buffer into the PitchShifter. */
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
    if (this.shifter) {
      this.shifter.disconnect();
    }
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

  // ---- FX Preset management ----

  /**
   * Apply an FX preset. `nodes` is an array of AudioNode instances
   * that form a serial chain from compressor output to fxWetGain.
   * `wet` is the wet/dry mix (0-1).
   */
  applyPreset(buildFn, wet = 0.6) {
    this.clearPreset();
    if (!this.ctx) return;

    const nodes = buildFn(this.ctx);
    this.fxNodes = nodes;

    // Wire: compressor -> nodes[0] -> ... -> nodes[n] -> fxWetGain
    if (nodes.length > 0) {
      this.compressor.connect(nodes[0]);
      for (let i = 1; i < nodes.length; i++) {
        nodes[i - 1].connect(nodes[i]);
      }
      nodes[nodes.length - 1].connect(this.fxWetGain);
    }

    this.fxDryGain.gain.setTargetAtTime(1 - wet, this.ctx.currentTime, 0.05);
    this.fxWetGain.gain.setTargetAtTime(wet, this.ctx.currentTime, 0.05);
  }

  clearPreset() {
    if (!this.ctx) return;
    // Disconnect FX nodes
    for (const node of this.fxNodes) {
      try { node.disconnect(); } catch { /* already disconnected */ }
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

    const linearGain = Math.pow(10, state.volume / 20);
    this.gainNode.gain.setTargetAtTime(linearGain, this.ctx.currentTime, 0.05);

    if (this.panNode.pan) {
      this.panNode.pan.setTargetAtTime(state.pan / 100, this.ctx.currentTime, 0.05);
    }

    // 18-Band EQ
    if (state.eq && state.eq.gains) {
      EQ_BANDS.forEach((freq, i) => {
        const dB = state.eq.enabled ? (state.eq.gains[freq] || 0) : 0;
        this.eqFilters[i].gain.setTargetAtTime(dB, this.ctx.currentTime, 0.05);
      });
    }

    // Dynamics Compressor
    if (state.compressor) {
      this.compressor.threshold.setTargetAtTime(state.compressor.threshold, this.ctx.currentTime, 0.05);
      this.compressor.ratio.setTargetAtTime(state.compressor.ratio, this.ctx.currentTime, 0.05);
      this.compressor.attack.setTargetAtTime(state.compressor.attack, this.ctx.currentTime, 0.05);
      this.compressor.release.setTargetAtTime(state.compressor.release, this.ctx.currentTime, 0.05);
    }

    // Reverb
    if (state.reverb.enabled) {
      this.reverbDry.gain.setTargetAtTime(1 - state.reverb.wet, this.ctx.currentTime, 0.05);
      this.reverbWet.gain.setTargetAtTime(state.reverb.wet, this.ctx.currentTime, 0.05);
      this.preDelay.delayTime.setTargetAtTime(state.reverb.preDelay, this.ctx.currentTime, 0.05);

      const key = `${state.reverb.roomSize.toFixed(2)}-${state.reverb.decay.toFixed(2)}`;
      if (this.reverbCacheKey !== key) {
        this.convolver.buffer = generateImpulseResponse(
          this.ctx,
          state.reverb.roomSize * 5,
          state.reverb.decay * 10,
          false,
        );
        this.reverbCacheKey = key;
      }
    } else {
      this.reverbDry.gain.setTargetAtTime(1, this.ctx.currentTime, 0.05);
      this.reverbWet.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    }
  }

  syncLoop() {
    if (useStore.getState().isPlaying && this.shifter) {
      this.rafId = requestAnimationFrame(this.syncLoop);
    }
  }
}

export const engine = new AudioEngine();
