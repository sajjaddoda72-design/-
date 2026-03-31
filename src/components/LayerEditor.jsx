import React, { useState } from 'react';
import X from 'lucide-react/dist/esm/icons/x';
import { useStore } from '../store';
import { FX_PRESETS } from '../audio/fxPresets';

const Slider = ({ label, value, min, max, step, onChange, format = (v) => v }) => (
  <div className="mb-3 last:mb-0">
    <div className="flex justify-between text-xs mb-1 text-emerald-100/70 font-medium">
      <span>{label}</span>
      <span>{format(value)}</span>
    </div>
    <input
      type="range" min={min} max={max} step={step} value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
    />
  </div>
);

export const LayerEditor = ({ layer, onClose, onUpdate }) => {
  const lang = useStore((s) => s.lang);
  const isEn = lang === 'en';
  const fx = layer.effects;
  const [fxOpen, setFxOpen] = useState(false);

  return (
    <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-zinc-900 border-t border-emerald-500/30 rounded-t-3xl max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5 sticky top-0 bg-zinc-900/95 backdrop-blur-sm z-10">
          <h2 className="text-lg font-bold text-emerald-100 truncate flex-1">{layer.name}</h2>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Volume & Pan */}
          <div className="bg-zinc-800/40 rounded-2xl p-3">
            <Slider label={isEn ? 'Volume' : 'الصوت'} value={fx.volume} min={-40} max={20} step={1}
              onChange={(v) => onUpdate({ volume: v })} format={(v) => `${v} dB`} />
            <Slider label={isEn ? 'Pan' : 'التحريك'} value={fx.pan} min={-100} max={100} step={1}
              onChange={(v) => onUpdate({ pan: v })}
              format={(v) => v === 0 ? 'Center' : v < 0 ? `L ${Math.abs(v)}%` : `R ${v}%`} />
          </div>

          {/* Speed & Pitch */}
          <div className="bg-zinc-800/40 rounded-2xl p-3">
            <Slider label={isEn ? 'Speed' : 'السرعة'} value={fx.speed} min={0.25} max={4} step={0.05}
              onChange={(v) => onUpdate({ speed: v })} format={(v) => `${v}x`} />
            <Slider label={isEn ? 'Pitch' : 'الطبقة'} value={fx.pitch} min={-12} max={12} step={1}
              onChange={(v) => onUpdate({ pitch: v })} format={(v) => v > 0 ? `+${v}` : `${v}`} />
          </div>

          {/* Fade In / Out */}
          <div className="bg-zinc-800/40 rounded-2xl p-3">
            <Slider label={isEn ? 'Fade In' : 'تلاشي دخول'} value={fx.fadeIn} min={0} max={5} step={0.1}
              onChange={(v) => onUpdate({ fadeIn: v })} format={(v) => `${v}s`} />
            <Slider label={isEn ? 'Fade Out' : 'تلاشي خروج'} value={fx.fadeOut} min={0} max={5} step={0.1}
              onChange={(v) => onUpdate({ fadeOut: v })} format={(v) => `${v}s`} />
          </div>

          {/* Toggles */}
          <div className="flex gap-2 flex-wrap">
            {[
              { key: 'reversed', label: isEn ? 'Reverse' : 'عكس' },
              { key: 'muted', label: isEn ? 'Mute' : 'كتم' },
              { key: 'solo', label: isEn ? 'Solo' : 'منفرد' },
            ].map(({ key, label }) => (
              <button key={key}
                onClick={() => onUpdate({ [key]: !fx[key] })}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                  fx[key]
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                    : 'bg-zinc-800/60 border-white/5 text-zinc-400'
                }`}>
                {label}
              </button>
            ))}
          </div>

          {/* Offset */}
          <div className="bg-zinc-800/40 rounded-2xl p-3">
            <Slider label={isEn ? 'Time Offset' : 'إزاحة الوقت'} value={layer.offset} min={0} max={60} step={0.1}
              onChange={(v) => {
                // Update offset via layerStore directly
                const { useLayerStore } = require('../layerStore');
                useLayerStore.getState().setLayerOffset(layer.id, v);
              }}
              format={(v) => `${v.toFixed(1)}s`} />
          </div>

          {/* FX Preset */}
          <div>
            <button onClick={() => setFxOpen(!fxOpen)}
              className={`w-full p-3 rounded-2xl border text-sm font-medium transition-all ${
                fx.preset
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                  : 'bg-zinc-800/60 border-white/5 text-zinc-400'
              }`}>
              {fx.preset
                ? `FX: ${FX_PRESETS.find((p) => p.id === fx.preset)?.name[isEn ? 'en' : 'ar'] || fx.preset}`
                : (isEn ? 'Select FX Preset' : 'اختيار مؤثر')}
            </button>

            {fxOpen && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                {FX_PRESETS.map((preset) => (
                  <button key={preset.id}
                    onClick={() => { onUpdate({ preset: fx.preset === preset.id ? null : preset.id }); setFxOpen(false); }}
                    className={`p-2 rounded-xl border text-center transition-all active:scale-95 ${
                      fx.preset === preset.id
                        ? 'bg-emerald-500/20 border-emerald-500/50'
                        : 'bg-zinc-800/60 border-white/5'
                    }`}>
                    <div className="text-lg">{preset.icon}</div>
                    <div className="text-[10px] text-zinc-300 mt-1 truncate">
                      {isEn ? preset.name.en : preset.name.ar}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
