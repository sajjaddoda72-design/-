import { stretchOffline } from './offlineStretch';
import { encodeWav, downloadBlob } from './export';
import { generateImpulseResponse } from './reverb';
import { FX_PRESETS } from './fxPresets';

/**
 * Reverse an AudioBuffer (pure copy).
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

/**
 * Render a single layer to an AudioBuffer with all its effects applied.
 */
async function renderLayer(ctx, layer) {
  const fx = layer.effects;
  let buf = layer.audioBuffer;

  // Reverse
  if (fx.reversed) {
    buf = reverseBuffer(ctx, buf);
  }

  // Speed + Pitch via SoundTouch
  if (fx.speed !== 1 || fx.pitch !== 0) {
    buf = await stretchOffline(ctx, buf, fx.speed, fx.pitch, () => {});
  }

  // Apply volume, pan, fade, FX preset via OfflineAudioContext
  const tailSamples = Math.ceil(buf.sampleRate * 3);
  const totalLength = buf.length + tailSamples;
  const offCtx = new OfflineAudioContext(2, totalLength, buf.sampleRate);

  const source = offCtx.createBufferSource();
  source.buffer = buf;

  const gainNode = offCtx.createGain();
  const linearGain = Math.pow(10, fx.volume / 20);
  gainNode.gain.value = linearGain;

  const panNode = offCtx.createStereoPanner
    ? offCtx.createStereoPanner()
    : offCtx.createGain();
  if (panNode.pan) panNode.pan.value = fx.pan / 100;

  source.connect(gainNode);
  gainNode.connect(panNode);

  let lastNode = panNode;

  // FX Preset
  if (fx.preset) {
    const preset = FX_PRESETS.find((p) => p.id === fx.preset);
    if (preset) {
      const dryGain = offCtx.createGain();
      const wetGain = offCtx.createGain();
      dryGain.gain.value = 1 - preset.wet;
      wetGain.gain.value = preset.wet;

      const nodes = preset.build(offCtx);
      if (nodes.length > 0) {
        lastNode.connect(nodes[0]);
        for (let i = 1; i < nodes.length; i++) {
          nodes[i - 1].connect(nodes[i]);
        }
        nodes[nodes.length - 1].connect(wetGain);
      }

      lastNode.connect(dryGain);

      // Merge dry + wet
      const merger = offCtx.createGain();
      dryGain.connect(merger);
      wetGain.connect(merger);
      lastNode = merger;
    }
  }

  lastNode.connect(offCtx.destination);

  // Fade in
  if (fx.fadeIn > 0) {
    gainNode.gain.setValueAtTime(0, 0);
    gainNode.gain.linearRampToValueAtTime(linearGain, fx.fadeIn);
  }

  // Fade out
  if (fx.fadeOut > 0) {
    const fadeStart = buf.duration - fx.fadeOut;
    if (fadeStart > 0) {
      gainNode.gain.setValueAtTime(linearGain, fadeStart);
      gainNode.gain.linearRampToValueAtTime(0, buf.duration);
    }
  }

  source.start(0);
  return offCtx.startRendering();
}

/**
 * Mix all layers into a single AudioBuffer and export as WAV.
 */
export async function exportLayerMix(layers, onProgress) {
  if (!layers || layers.length === 0) throw new Error('No layers to export');

  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const sampleRate = layers[0].audioBuffer.sampleRate;

  // Determine which layers to include (solo logic)
  const hasSolo = layers.some((l) => l.effects.solo);
  const activeLayers = layers.filter((l) => {
    if (l.effects.muted) return false;
    if (hasSolo && !l.effects.solo) return false;
    return true;
  });

  if (activeLayers.length === 0) throw new Error('All layers are muted');

  // Render each layer
  onProgress('Rendering layers...', 10);
  const rendered = [];
  for (let i = 0; i < activeLayers.length; i++) {
    const layer = activeLayers[i];
    onProgress(`Rendering ${layer.name}...`, 10 + (i / activeLayers.length) * 60);
    const buf = await renderLayer(ctx, layer);
    rendered.push({ buffer: buf, offset: layer.offset });
  }

  // Calculate total duration
  const totalDuration = Math.max(
    ...rendered.map((r) => r.offset + r.buffer.duration)
  );
  const totalSamples = Math.ceil(totalDuration * sampleRate);

  // Mix down
  onProgress('Mixing...', 75);
  const mixL = new Float32Array(totalSamples);
  const mixR = new Float32Array(totalSamples);

  for (const { buffer, offset } of rendered) {
    const startSample = Math.floor(offset * sampleRate);
    const srcL = buffer.getChannelData(0);
    const srcR = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : srcL;
    const len = Math.min(srcL.length, totalSamples - startSample);
    for (let i = 0; i < len; i++) {
      mixL[startSample + i] += srcL[i];
      mixR[startSample + i] += srcR[i];
    }
  }

  // Normalize to prevent clipping
  let peak = 0;
  for (let i = 0; i < totalSamples; i++) {
    peak = Math.max(peak, Math.abs(mixL[i]), Math.abs(mixR[i]));
  }
  if (peak > 1) {
    const scale = 0.95 / peak;
    for (let i = 0; i < totalSamples; i++) {
      mixL[i] *= scale;
      mixR[i] *= scale;
    }
  }

  // Create final AudioBuffer
  const finalBuffer = ctx.createBuffer(2, totalSamples, sampleRate);
  finalBuffer.getChannelData(0).set(mixL);
  finalBuffer.getChannelData(1).set(mixR);

  onProgress('Encoding WAV...', 90);
  const blob = encodeWav(finalBuffer);
  onProgress('Done', 100);

  downloadBlob(blob, `EcoSynth_Mix_${Date.now()}.wav`);
}
