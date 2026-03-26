import { PitchShifter } from 'soundtouchjs';
import { useStore } from '../store';
import { generateImpulseResponse } from './reverb';

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
    this.eqLow = null;
    this.eqMid = null;
    this.eqHigh = null;
    this.compressor = null;
    this.rafId = null;
    this.reverbCacheKey = '';
    this._initialized = false;

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

    // 3-Band EQ
    this.eqLow = this.ctx.createBiquadFilter();
    this.eqLow.type = 'lowshelf';
    this.eqLow.frequency.value = 200;
    this.eqLow.gain.value = 0;

    this.eqMid = this.ctx.createBiquadFilter();
    this.eqMid.type = 'peaking';
    this.eqMid.frequency.value = 1000;
    this.eqMid.Q.value = 1;
    this.eqMid.gain.value = 0;

    this.eqHigh = this.ctx.createBiquadFilter();
    this.eqHigh.type = 'highshelf';
    this.eqHigh.frequency.value = 8000;
    this.eqHigh.gain.value = 0;

    // Dynamics Compressor
    this.compressor = this.ctx.createDynamicsCompressor();

    // Reverb
    this.reverbDry = this.ctx.createGain();
    this.reverbWet = this.ctx.createGain();
    this.convolver = this.ctx.createConvolver();
    this.preDelay = this.ctx.createDelay(1);

    // Analyser
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;

    // Signal chain:
    // gainNode -> panNode -> eqLow -> eqMid -> eqHigh -> compressor -> reverbDry -> analyser -> dest
    //                                                                -> preDelay -> convolver -> reverbWet -> analyser
    this.gainNode.connect(this.panNode);
    this.panNode.connect(this.eqLow);
    this.eqLow.connect(this.eqMid);
    this.eqMid.connect(this.eqHigh);
    this.eqHigh.connect(this.compressor);

    this.compressor.connect(this.reverbDry);

    const preDelayGain = this.ctx.createGain();
    this.compressor.connect(preDelayGain);
    preDelayGain.connect(this.preDelay);
    this.preDelay.connect(this.convolver);
    this.convolver.connect(this.reverbWet);

    this.reverbDry.connect(this.analyser);
    this.reverbWet.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

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

      // Param changes — always sync
      this.updateParams(state);
    });
  }

  load(audioBuffer) {
    this._ensureContext();

    if (this.shifter) {
      this.shifter.disconnect();
      this.shifter.off('play', this.handlePlayEvent);
      this.shifter = null;
    }

    this.shifter = new PitchShifter(this.ctx, audioBuffer, 8192);
    this.shifter.on('play', this.handlePlayEvent);

    const state = useStore.getState();
    this.updateParams(state);

    if (state.isPlaying) {
      this.play();
    }
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

  seek(perc) {
    if (this.shifter) {
      this.shifter.percentagePlayed = perc;
      useStore.getState().setCurrentTime(this.shifter.duration * perc);
    }
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

    // 3-Band EQ
    if (state.eq) {
      this.eqLow.gain.setTargetAtTime(state.eq.low, this.ctx.currentTime, 0.05);
      this.eqMid.gain.setTargetAtTime(state.eq.mid, this.ctx.currentTime, 0.05);
      this.eqHigh.gain.setTargetAtTime(state.eq.high, this.ctx.currentTime, 0.05);
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
