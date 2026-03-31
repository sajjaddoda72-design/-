import { create } from 'zustand';

let _nextId = 1;

/** Default per-layer effects state */
const defaultLayerEffects = () => ({
  volume: 0,       // dB
  pan: 0,          // -100 to 100
  speed: 1,
  pitch: 0,
  reversed: false,
  muted: false,
  solo: false,
  fadeIn: 0,       // seconds
  fadeOut: 0,      // seconds
  preset: null,    // FX preset id or null
});

/**
 * Create a new layer object from an AudioBuffer.
 */
const createLayer = (name, audioBuffer) => ({
  id: _nextId++,
  name,
  audioBuffer,       // original AudioBuffer (never mutated)
  duration: audioBuffer.duration,
  offset: 0,         // time offset in seconds (for timeline positioning)
  effects: defaultLayerEffects(),
});

export const useLayerStore = create((set, get) => ({
  layers: [],
  isPlaying: false,
  currentTime: 0,
  editingLayerId: null,  // id of layer whose editor is open, or null

  // ---- Layer CRUD ----

  addLayer: (name, audioBuffer) => set((state) => ({
    layers: [...state.layers, createLayer(name, audioBuffer)],
  })),

  removeLayer: (id) => set((state) => ({
    layers: state.layers.filter((l) => l.id !== id),
    editingLayerId: state.editingLayerId === id ? null : state.editingLayerId,
  })),

  duplicateLayer: (id) => set((state) => {
    const src = state.layers.find((l) => l.id === id);
    if (!src) return state;
    const copy = {
      ...createLayer(src.name + ' (copy)', src.audioBuffer),
      offset: src.offset,
      effects: { ...src.effects },
    };
    const idx = state.layers.findIndex((l) => l.id === id);
    const next = [...state.layers];
    next.splice(idx + 1, 0, copy);
    return { layers: next };
  }),

  // ---- Per-layer effects ----

  updateLayerEffects: (id, patch) => set((state) => ({
    layers: state.layers.map((l) =>
      l.id === id ? { ...l, effects: { ...l.effects, ...patch } } : l
    ),
  })),

  setLayerOffset: (id, offset) => set((state) => ({
    layers: state.layers.map((l) =>
      l.id === id ? { ...l, offset: Math.max(0, offset) } : l
    ),
  })),

  // ---- Drag reorder ----

  reorderLayers: (fromIndex, toIndex) => set((state) => {
    if (fromIndex === toIndex) return state;
    const next = [...state.layers];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return { layers: next };
  }),

  // ---- Playback ----

  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentTime: (currentTime) => set({ currentTime }),

  /** Total duration = max(layer.offset + layer.duration) across all layers */
  getTotalDuration: () => {
    const { layers } = get();
    if (layers.length === 0) return 0;
    return Math.max(...layers.map((l) => l.offset + l.duration));
  },

  // ---- Editor ----

  setEditingLayerId: (id) => set({ editingLayerId: id }),

  // ---- Reset ----

  clearAll: () => set({ layers: [], isPlaying: false, currentTime: 0, editingLayerId: null }),
}));
