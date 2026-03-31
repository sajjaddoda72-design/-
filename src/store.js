import { create } from 'zustand';

/** 18-band EQ frequency centers (Hz) */
export const EQ_BANDS = [
  65, 92, 131, 185, 262, 370, 523, 740, 1046,
  1479, 2093, 2960, 4186, 5900, 8356, 11800, 16670, 20000,
];

/** Create default gains object: { 65: 0, 92: 0, ... } */
const defaultEqGains = () => {
  const g = {};
  EQ_BANDS.forEach((f) => { g[f] = 0; });
  return g;
};

export const useStore = create((set) => ({
  file: null,
  fileName: '',
  audioBuffer: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  speed: 1,
  pitch: 0,
  volume: 0, // dB
  pan: 0,
  reversed: false,

  // 18-band EQ
  eq: {
    enabled: false,
    gains: defaultEqGains(), // { [freq]: dB }
  },

  compressor: {
    enabled: false,
    threshold: -24,
    ratio: 4,
    attack: 0.003,
    release: 0.25,
  },
  normalize: {
    enabled: false,
    targetDb: -1, // target peak level in dB
  },
  limiter: {
    enabled: false,
    threshold: -3,
    release: 0.1,
  },
  reverb: {
    enabled: false,
    wet: 0.5,
    roomSize: 0.5,
    decay: 2,
    preDelay: 0.05,
  },

  // FX Preset: null or preset id string
  activePreset: null,

  lang: 'en',

  setFile: (file, name, buffer) => set({ file, fileName: name, audioBuffer: buffer, duration: buffer ? buffer.duration : 0, currentTime: 0 }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setSpeed: (speed) => set({ speed }),
  setPitch: (pitch) => set({ pitch }),
  setVolume: (volume) => set({ volume }),
  setPan: (pan) => set({ pan }),
  setReversed: (reversed) => set({ reversed }),
  setEq: (eqUpdate) => set((state) => ({ eq: { ...state.eq, ...eqUpdate } })),
  setEqBand: (freq, dB) => set((state) => ({
    eq: { ...state.eq, gains: { ...state.eq.gains, [freq]: dB } },
  })),
  resetEq: () => set((state) => ({ eq: { ...state.eq, gains: defaultEqGains() } })),
  setCompressor: (compUpdate) => set((state) => ({ compressor: { ...state.compressor, ...compUpdate } })),
  setNormalize: (normUpdate) => set((state) => ({ normalize: { ...state.normalize, ...normUpdate } })),
  setLimiter: (limUpdate) => set((state) => ({ limiter: { ...state.limiter, ...limUpdate } })),
  setReverb: (reverbUpdate) => set((state) => ({ reverb: { ...state.reverb, ...reverbUpdate } })),
  setActivePreset: (presetId) => set({ activePreset: presetId }),
  toggleLang: () => set((state) => ({ lang: state.lang === 'en' ? 'ar' : 'en' })),
  resetAudio: () => set({ file: null, fileName: '', audioBuffer: null, isPlaying: false, currentTime: 0, duration: 0, reversed: false }),
}));
