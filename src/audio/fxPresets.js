import { generateImpulseResponse } from './reverb';

/**
 * Each preset exports:
 *   id        — unique key
 *   name      — { en, ar }
 *   icon      — emoji for the card
 *   wet       — dry/wet mix (0-1)
 *   build(ctx) — returns an array of AudioNodes forming a serial FX chain
 *   buildOffline(ctx, bufferLength) — same but for OfflineAudioContext export
 *
 * Nodes are wired: compressor -> nodes[0] -> … -> nodes[n] -> fxWetGain
 */

/** Helper: create a simple waveshaper distortion curve */
function makeDistortionCurve(amount = 50) {
  const samples = 44100;
  const curve = new Float32Array(samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

export const FX_PRESETS = [
  // ---- 1. Echo ----
  {
    id: 'echo',
    name: { en: 'Echo', ar: 'صدى' },
    icon: '🔊',
    wet: 0.5,
    build(ctx) {
      const delay = ctx.createDelay(2);
      delay.delayTime.value = 0.35;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.45;
      const out = ctx.createGain();
      out.gain.value = 0.8;
      // delay -> feedback -> delay (loop), delay -> out
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(out);
      return [delay, out];
    },
  },

  // ---- 2. Large Room ----
  {
    id: 'large-room',
    name: { en: 'Large Room', ar: 'غرفة كبيرة' },
    icon: '🏛️',
    wet: 0.45,
    build(ctx) {
      const conv = ctx.createConvolver();
      conv.buffer = generateImpulseResponse(ctx, 3.5, 4, false);
      return [conv];
    },
  },

  // ---- 3. Hall ----
  {
    id: 'hall',
    name: { en: 'Hall', ar: 'قاعة' },
    icon: '🎵',
    wet: 0.55,
    build(ctx) {
      const conv = ctx.createConvolver();
      conv.buffer = generateImpulseResponse(ctx, 5, 6, false);
      const hpf = ctx.createBiquadFilter();
      hpf.type = 'highpass';
      hpf.frequency.value = 200;
      conv.connect(hpf);
      return [conv, hpf];
    },
  },

  // ---- 4. Underwater ----
  {
    id: 'underwater',
    name: { en: 'Underwater', ar: 'تحت الماء' },
    icon: '🌊',
    wet: 0.7,
    build(ctx) {
      const lpf = ctx.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.value = 500;
      lpf.Q.value = 5;
      const gain = ctx.createGain();
      gain.gain.value = 1.2;
      lpf.connect(gain);
      return [lpf, gain];
    },
  },

  // ---- 5. Radio ----
  {
    id: 'radio',
    name: { en: 'Radio', ar: 'راديو' },
    icon: '📻',
    wet: 0.85,
    build(ctx) {
      const hpf = ctx.createBiquadFilter();
      hpf.type = 'highpass';
      hpf.frequency.value = 300;
      const lpf = ctx.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.value = 4000;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -30;
      comp.ratio.value = 12;
      comp.attack.value = 0.003;
      comp.release.value = 0.1;
      hpf.connect(lpf);
      lpf.connect(comp);
      return [hpf, lpf, comp];
    },
  },

  // ---- 6. Speaker ----
  {
    id: 'speaker',
    name: { en: 'Speaker', ar: 'مكبر صوت' },
    icon: '🔈',
    wet: 0.75,
    build(ctx) {
      const hpf = ctx.createBiquadFilter();
      hpf.type = 'highpass';
      hpf.frequency.value = 200;
      const lpf = ctx.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.value = 6000;
      const ws = ctx.createWaveShaper();
      ws.curve = makeDistortionCurve(20);
      ws.oversample = '4x';
      const gain = ctx.createGain();
      gain.gain.value = 0.7;
      hpf.connect(lpf);
      lpf.connect(ws);
      ws.connect(gain);
      return [hpf, lpf, ws, gain];
    },
  },

  // ---- 7. Rainy Room ----
  {
    id: 'rainy-room',
    name: { en: 'Rainy Room', ar: 'غرفة ممطرة' },
    icon: '🌧️',
    wet: 0.5,
    build(ctx) {
      const conv = ctx.createConvolver();
      conv.buffer = generateImpulseResponse(ctx, 2.5, 3, false);
      const lpf = ctx.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.value = 3000;
      conv.connect(lpf);
      return [conv, lpf];
    },
  },

  // ---- 8. Megaphone ----
  {
    id: 'megaphone',
    name: { en: 'Megaphone', ar: 'مكبر صوت يدوي' },
    icon: '📢',
    wet: 0.8,
    build(ctx) {
      const hpf = ctx.createBiquadFilter();
      hpf.type = 'highpass';
      hpf.frequency.value = 600;
      const lpf = ctx.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.value = 4000;
      const peak = ctx.createBiquadFilter();
      peak.type = 'peaking';
      peak.frequency.value = 2000;
      peak.gain.value = 10;
      peak.Q.value = 2;
      const ws = ctx.createWaveShaper();
      ws.curve = makeDistortionCurve(40);
      ws.oversample = '4x';
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -20;
      comp.ratio.value = 15;
      hpf.connect(lpf);
      lpf.connect(peak);
      peak.connect(ws);
      ws.connect(comp);
      return [hpf, lpf, peak, ws, comp];
    },
  },

  // ---- 9. Telephone ----
  {
    id: 'telephone',
    name: { en: 'Telephone', ar: 'هاتف' },
    icon: '📞',
    wet: 0.9,
    build(ctx) {
      const hpf = ctx.createBiquadFilter();
      hpf.type = 'highpass';
      hpf.frequency.value = 400;
      const lpf = ctx.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.value = 3400;
      const peak = ctx.createBiquadFilter();
      peak.type = 'peaking';
      peak.frequency.value = 1800;
      peak.gain.value = 8;
      peak.Q.value = 3;
      hpf.connect(lpf);
      lpf.connect(peak);
      return [hpf, lpf, peak];
    },
  },

  // ---- 10. Deep Space / Dream ----
  {
    id: 'deep-space',
    name: { en: 'Deep Space', ar: 'فضاء عميق' },
    icon: '🌌',
    wet: 0.6,
    build(ctx) {
      const conv = ctx.createConvolver();
      conv.buffer = generateImpulseResponse(ctx, 6, 8, false);
      const delay = ctx.createDelay(2);
      delay.delayTime.value = 0.5;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.3;
      const lpf = ctx.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.value = 2000;
      conv.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(lpf);
      return [conv, delay, lpf];
    },
  },

  // ---- 11. Internal Voice ----
  // Muffled, intimate, close sound: lowpass + gentle reverb + reduced stereo
  {
    id: 'internal-voice',
    name: { en: 'Internal Voice', ar: 'صوت داخلي' },
    icon: '🧠',
    wet: 0.7,
    build(ctx) {
      const lpf = ctx.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.value = 1200;
      lpf.Q.value = 0.7;
      const conv = ctx.createConvolver();
      conv.buffer = generateImpulseResponse(ctx, 1.5, 3, false);
      const gain = ctx.createGain();
      gain.gain.value = 1.1;
      lpf.connect(conv);
      conv.connect(gain);
      return [lpf, conv, gain];
    },
  },

  // ---- 12. Anti-Voice Mirror ----
  // Simultaneous normal + phase-inverted delayed copy for eerie mirror effect
  {
    id: 'anti-voice',
    name: { en: 'Anti-Voice Mirror', ar: 'صوت معكوس' },
    icon: '🪞',
    wet: 0.65,
    build(ctx) {
      const delay = ctx.createDelay(1);
      delay.delayTime.value = 0.03;
      const invert = ctx.createGain();
      invert.gain.value = -0.8;
      const lpf = ctx.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.value = 3000;
      const conv = ctx.createConvolver();
      conv.buffer = generateImpulseResponse(ctx, 2, 4, true);
      delay.connect(invert);
      invert.connect(lpf);
      lpf.connect(conv);
      return [delay, invert, lpf, conv];
    },
  },

  // ---- 13. Womb / Inside ----
  // Warm muffled low-frequency emphasis, soft lowpass, subtle resonant reverb
  {
    id: 'womb',
    name: { en: 'Womb / Inside', ar: 'رحم / داخلي' },
    icon: '🫧',
    wet: 0.75,
    build(ctx) {
      const lpf = ctx.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.value = 400;
      lpf.Q.value = 3;
      const bass = ctx.createBiquadFilter();
      bass.type = 'lowshelf';
      bass.frequency.value = 150;
      bass.gain.value = 8;
      const conv = ctx.createConvolver();
      conv.buffer = generateImpulseResponse(ctx, 2, 5, false);
      const gain = ctx.createGain();
      gain.gain.value = 1.3;
      lpf.connect(bass);
      bass.connect(conv);
      conv.connect(gain);
      return [lpf, bass, conv, gain];
    },
  },

  // ---- 14. Breath Boost ----
  // Air-band enhancement: upper frequency EQ boost + gentle compression
  {
    id: 'breath-boost',
    name: { en: 'Breath Boost', ar: 'تعزيز النفس' },
    icon: '💨',
    wet: 0.6,
    build(ctx) {
      const air = ctx.createBiquadFilter();
      air.type = 'highshelf';
      air.frequency.value = 8000;
      air.gain.value = 10;
      const presence = ctx.createBiquadFilter();
      presence.type = 'peaking';
      presence.frequency.value = 5000;
      presence.gain.value = 6;
      presence.Q.value = 1;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -25;
      comp.ratio.value = 3;
      comp.attack.value = 0.01;
      comp.release.value = 0.15;
      air.connect(presence);
      presence.connect(comp);
      return [air, presence, comp];
    },
  },
];
