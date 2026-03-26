import lamejs from 'lamejs';
import { stretchOffline } from './offlineStretch';
import { generateImpulseResponse } from './reverb';
import { useStore } from '../store';

const applyEffectsOffline = async (outBuffer, state, onProgress) => {
  const offlineCtx = new OfflineAudioContext(2, outBuffer.length, outBuffer.sampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = outBuffer;

  const gainNode = offlineCtx.createGain();
  const panNode = offlineCtx.createStereoPanner ? offlineCtx.createStereoPanner() : offlineCtx.createGain();
  
  const reverbDry = offlineCtx.createGain();
  const reverbWet = offlineCtx.createGain();
  const preDelay = offlineCtx.createDelay(1);
  const convolver = offlineCtx.createConvolver();

  source.connect(gainNode);
  gainNode.connect(panNode);
  panNode.connect(reverbDry);
  
  const preDelayGain = offlineCtx.createGain();
  panNode.connect(preDelayGain);
  preDelayGain.connect(preDelay);
  preDelay.connect(convolver);
  convolver.connect(reverbWet);

  reverbDry.connect(offlineCtx.destination);
  reverbWet.connect(offlineCtx.destination);

  // Apply state params
  const linearGain = Math.pow(10, state.volume / 20);
  gainNode.gain.value = linearGain;

  if (panNode.pan) {
    panNode.pan.value = state.pan / 100;
  }

  if (state.reverb.enabled) {
    reverbDry.gain.value = 1 - state.reverb.wet;
    reverbWet.gain.value = state.reverb.wet;
    preDelay.delayTime.value = state.reverb.preDelay;
    convolver.buffer = generateImpulseResponse(offlineCtx, state.reverb.decay * 10, state.reverb.decay * 10, false);
  } else {
    reverbDry.gain.value = 1;
    reverbWet.gain.value = 0;
  }

  source.start(0);
  
  if (onProgress) onProgress(100);

  return offlineCtx.startRendering();
};

const encodeWav = (audioBuffer) => {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;
  const buffer = new ArrayBuffer(44 + length * numChannels * 2);
  const view = new DataView(buffer);
  
  const writeString = (view, offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
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

const encodeMp3 = (audioBuffer, onProgress) => {
  return new Promise((resolve) => {
    const channels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const kbps = 128;
    const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, kbps);
    
    const left = audioBuffer.getChannelData(0);
    const right = channels > 1 ? audioBuffer.getChannelData(1) : left;
    
    const sampleBlockSize = 1152;
    const mp3Data = [];
    let offset = 0;
    
    const encodeChunk = () => {
      let startTime = performance.now();
      
      while (offset < left.length && performance.now() - startTime < 16) {
        let length = Math.min(sampleBlockSize, left.length - offset);
        
        const leftChunk = new Int16Array(length);
        const rightChunk = new Int16Array(length);
        
        for (let i = 0; i < length; i++) {
          let l = left[offset + i];
          let r = right[offset + i];
          l = Math.max(-1, Math.min(1, l));
          r = Math.max(-1, Math.min(1, r));
          leftChunk[i] = l < 0 ? l * 0x8000 : l * 0x7FFF;
          rightChunk[i] = r < 0 ? r * 0x8000 : r * 0x7FFF;
        }
        
        let mp3buf = channels === 2 
          ? mp3encoder.encodeBuffer(leftChunk, rightChunk) 
          : mp3encoder.encodeBuffer(leftChunk);
          
        if (mp3buf.length > 0) {
          mp3Data.push(mp3buf);
        }
        
        offset += sampleBlockSize;
      }
      
      if (onProgress) onProgress(Math.min(100, (offset / left.length) * 100));
      
      if (offset >= left.length) {
        const mp3buf = mp3encoder.flush();
        if (mp3buf.length > 0) {
          mp3Data.push(mp3buf);
        }
        resolve(new Blob(mp3Data, { type: 'audio/mp3' }));
      } else {
        setTimeout(encodeChunk, 0);
      }
    };
    
    encodeChunk();
  });
};

export const exportAudio = async (format, onProgress) => {
  const state = useStore.getState();
  if (!state.audioBuffer) throw new Error("No audio buffer");
  
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  
  onProgress('Stretching...', 0);
  const stretchedBuffer = await stretchOffline(ctx, state.audioBuffer, state.speed, state.pitch, (p) => onProgress('Stretching...', p));
  
  onProgress('Applying Effects...', 0);
  const finalBuffer = await applyEffectsOffline(stretchedBuffer, state, (p) => onProgress('Applying Effects...', p));
  
  onProgress(`Encoding ${format.toUpperCase()}...`, 0);
  
  let blob;
  if (format === 'wav') {
    blob = encodeWav(finalBuffer);
    onProgress('Done', 100);
  } else if (format === 'mp3') {
    blob = await encodeMp3(finalBuffer, (p) => onProgress('Encoding MP3...', p));
  }
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = `EcoSynth_Export_${Date.now()}.${format}`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 100);
};