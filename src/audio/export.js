import { stretchOffline } from './offlineStretch';
import { generateImpulseResponse } from './reverb';
import { useStore, EQ_BANDS } from '../store';
import { FX_PRESETS } from './fxPresets';

/**
 * Reverse an AudioBuffer (pure copy, no mutation).
 */
function reverseBuffer(ctx, buffer) {
  const numCh = buffer.numberOfChannels;
  const rev = ctx.createBuffer(numCh, buffer.length, buffer.sampleRate);
  for (let ch = 0; ch < numCh; ch++) {
    const src = buffer.getChannelData(ch);
    const dst = rev.getChannelData(ch);
    for (let i = 0, j = src.length - 1; i < src.length; i++, j--) {
      dst[i] = src[j];
    }
  }
  return rev;
}

const applyEffectsOffline = async (outBuffer, state, onProgress) => {
  const tailSamples = Math.ceil(outBuffer.sampleRate * 6);
  const totalLength = outBuffer.length + tailSamples;
  const offlineCtx = new OfflineAudioContext(2, totalLength, outBuffer.sampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = outBuffer;

  const gainNode = offlineCtx.createGain();
  const panNode = offlineCtx.createStereoPanner
    ? offlineCtx.createStereoPanner()
    : offlineCtx.createGain();

  // 18-band EQ
  const eqFilters = EQ_BANDS.map((freq, i) => {
    const f = offlineCtx.createBiquadFilter();
    if (i === 0) f.type = 'lowshelf';
    else if (i === EQ_BANDS.length - 1) f.type = 'highshelf';
    else { f.type = 'peaking'; f.Q.value = 1.4; }
    f.frequency.value = freq;
    f.gain.value = (state.eq && state.eq.enabled) ? (state.eq.gains[freq] || 0) : 0;
    return f;
  });
  for (let i = 1; i < eqFilters.length; i++) {
    eqFilters[i - 1].connect(eqFilters[i]);
  }

  const comp = offlineCtx.createDynamicsCompressor();
  if (state.compressor && state.compressor.enabled) {
    comp.threshold.value = state.compressor.threshold;
    comp.ratio.value = state.compressor.ratio;
    comp.attack.value = state.compressor.attack;
    comp.release.value = state.compressor.release;
  }

  const fxDryGain = offlineCtx.createGain();
  const fxWetGain = offlineCtx.createGain();
  fxDryGain.gain.value = 1;
  fxWetGain.gain.value = 0;

  if (state.activePreset) {
    const preset = FX_PRESETS.find((p) => p.id === state.activePreset);
    if (preset) {
      const nodes = preset.build(offlineCtx);
      if (nodes.length > 0) {
        comp.connect(nodes[0]);
        for (let i = 1; i < nodes.length; i++) {
          nodes[i - 1].connect(nodes[i]);
        }
        nodes[nodes.length - 1].connect(fxWetGain);
      }
      fxDryGain.gain.value = 1 - preset.wet;
      fxWetGain.gain.value = preset.wet;
    }
  }

  const reverbDry = offlineCtx.createGain();
  const reverbWet = offlineCtx.createGain();
  const preDelay = offlineCtx.createDelay(1);
  const convolver = offlineCtx.createConvolver();

  source.connect(gainNode);
  gainNode.connect(panNode);
  panNode.connect(eqFilters[0]);
  eqFilters[eqFilters.length - 1].connect(comp);

  comp.connect(fxDryGain);
  fxDryGain.connect(reverbDry);
  fxWetGain.connect(reverbDry);

  const preDelayGain = offlineCtx.createGain();
  comp.connect(preDelayGain);
  preDelayGain.connect(preDelay);
  preDelay.connect(convolver);
  convolver.connect(reverbWet);

  reverbDry.connect(offlineCtx.destination);
  reverbWet.connect(offlineCtx.destination);

  const linearGain = Math.pow(10, state.volume / 20);
  gainNode.gain.value = linearGain;

  if (panNode.pan) {
    panNode.pan.value = state.pan / 100;
  }

  if (state.reverb.enabled) {
    reverbDry.gain.value = 1 - state.reverb.wet;
    reverbWet.gain.value = state.reverb.wet;
    preDelay.delayTime.value = state.reverb.preDelay;
    convolver.buffer = generateImpulseResponse(offlineCtx, state.reverb.roomSize * 5, state.reverb.decay * 10, false);
  } else {
    reverbDry.gain.value = 1;
    reverbWet.gain.value = 0;
    convolver.buffer = generateImpulseResponse(offlineCtx, 0.01, 0.01, false);
  }

  source.start(0);
  if (onProgress) onProgress(100);
  return offlineCtx.startRendering();
};

export const encodeWav = (audioBuffer) => {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;
  const buffer = new ArrayBuffer(44 + length * numChannels * 2);
  const view = new DataView(buffer);

  const writeString = (v, offset, string) => {
    for (let i = 0; i < string.length; i++) {
      v.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + length * numChannels * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, length * numChannels * 2, true);

  const channels = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push(audioBuffer.getChannelData(i));
  }

  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      let sample = channels[channel][i];
      sample = Math.max(-1, Math.min(1, sample));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, sample, true);
      offset += 2;
    }
  }
  return new Blob([view], { type: 'audio/wav' });
};

/** Helper: trigger a file download from a Blob */
export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
};

export const exportAudio = async (onProgress) => {
  const state = useStore.getState();
  if (!state.audioBuffer) throw new Error("No audio buffer");

  const ctx = new (window.AudioContext || window.webkitAudioContext)();

  let sourceBuffer = state.audioBuffer;
  if (state.reversed) {
    onProgress('Reversing...', 0);
    sourceBuffer = reverseBuffer(ctx, state.audioBuffer);
  }

  onProgress('Stretching...', 0);
  const stretchedBuffer = await stretchOffline(ctx, sourceBuffer, state.speed, state.pitch, (p) => onProgress('Stretching...', p));

  onProgress('Applying Effects...', 0);
  const effectsBuffer = await applyEffectsOffline(stretchedBuffer, state, (p) => onProgress('Applying Effects...', p));

  onProgress('Encoding WAV...', 90);
  const blob = encodeWav(effectsBuffer);
  onProgress('Done', 100);

  downloadBlob(blob, `EcoSynth_Export_${Date.now()}.wav`);
};
