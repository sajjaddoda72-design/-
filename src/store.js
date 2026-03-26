import { create } from 'zustand';

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
  eq: {
    enabled: false,
    low: 0,  // 200 Hz lowshelf gain dB
    mid: 0,  // 1 kHz peaking gain dB
    high: 0, // 8 kHz highshelf gain dB
  },
  compressor: {
    enabled: false,
    threshold: -24,
    ratio: 4,
    attack: 0.003,
    release: 0.25,
  },
  reverb: {
    enabled: false,
    wet: 0.5,
    roomSize: 0.5,
    decay: 2,
    preDelay: 0.05,
  },
  lang: 'en',

  setFile: (file, name, buffer) => set({ file, fileName: name, audioBuffer: buffer, duration: buffer ? buffer.duration : 0, currentTime: 0 }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setSpeed: (speed) => set({ speed }),
  setPitch: (pitch) => set({ pitch }),
  setVolume: (volume) => set({ volume }),
  setPan: (pan) => set({ pan }),
  setEq: (eqUpdate) => set((state) => ({ eq: { ...state.eq, ...eqUpdate } })),
  setCompressor: (compUpdate) => set((state) => ({ compressor: { ...state.compressor, ...compUpdate } })),
  setReverb: (reverbUpdate) => set((state) => ({ reverb: { ...state.reverb, ...reverbUpdate } })),
  toggleLang: () => set((state) => ({ lang: state.lang === 'en' ? 'ar' : 'en' })),
  resetAudio: () => set({ file: null, fileName: '', audioBuffer: null, isPlaying: false, currentTime: 0, duration: 0 }),
}));
