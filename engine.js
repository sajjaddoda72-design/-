import { PitchShifter } from 'soundtouchjs';
import { useStore } from '../store';
import { generateImpulseResponse } from './reverb';

class AudioEngine {
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.shifter = null;
    
    this.gainNode = this.ctx.createGain();
    this.panNode = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : this.ctx.createGain();
    
    this.reverbDry = this.ctx.createGain();
    this.reverbWet = this.ctx.createGain();
    this.convolver = this.ctx.createConvolver();
    this.preDelay = this.ctx.createDelay(1);
    
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;

    this.gainNode.connect(this.panNode);
    this.panNode.connect(this.reverbDry);
    
    const preDelayGain = this.ctx.createGain();
    this.panNode.connect(preDelayGain);
    preDelayGain.connect(this.preDelay);
    this.preDelay.connect(this.convolver);
    this.convolver.connect(this.reverbWet);
    
    this.reverbDry.connect(this.analyser);
    this.reverbWet.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    
    this.rafId = null;
    this.reverbCacheKey = '';

    // Bind methods
    this.syncLoop = this.syncLoop.bind(this);
    this.handlePlayEvent = this.handlePlayEvent.bind(this);
  }

  load(audioBuffer) {
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
    
    const linearGain = Math.pow(10, state.volume / 20);
    this.gainNode.gain.setTargetAtTime(linearGain, this.ctx.currentTime, 0.05);
    
    if (this.panNode.pan) {
      this.panNode.pan.setTargetAtTime(state.pan / 100, this.ctx.currentTime, 0.05);
    }

    if (state.reverb.enabled) {
      this.reverbDry.gain.setTargetAtTime(1 - state.reverb.wet, this.ctx.currentTime, 0.05);
      this.reverbWet.gain.setTargetAtTime(state.reverb.wet, this.ctx.currentTime, 0.05);
      this.preDelay.delayTime.setTargetAtTime(state.reverb.preDelay, this.ctx.currentTime, 0.05);
      
      const key = `${state.reverb.roomSize.toFixed(2)}-${state.reverb.decay.toFixed(2)}`;
      if (this.reverbCacheKey !== key) {
        this.convolver.buffer = generateImpulseResponse(this.ctx, state.reverb.decay * 10, state.reverb.decay * 10, false);
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
