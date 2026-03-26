import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Power } from 'lucide-react';
import { useStore } from '../store';

const Panel = ({ title, isActive, onToggle, children }) => {
  const [open, setOpen] = useState(false);
  
  return (
    <div className={`mb-4 mx-4 rounded-3xl border transition-all duration-300 ${isActive ? 'bg-zinc-900/80 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'bg-zinc-900/40 border-white/5'}`}>
      <div 
        className="flex items-center justify-between p-4 cursor-pointer select-none"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center space-x-3 gap-3" onClick={(e) => e.stopPropagation()}>
          <button 
            onClick={onToggle}
            className={`p-2 rounded-full transition-all ${isActive ? 'bg-emerald-500/20 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
          >
            <Power size={18} />
          </button>
          <h3 className={`font-semibold text-lg ${isActive ? 'text-emerald-100' : 'text-zinc-400'}`}>
            {title}
          </h3>
        </div>
        <button className="text-zinc-500">
          {open ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
        </button>
      </div>
      
      {open && (
        <div className="p-4 pt-0 border-t border-white/5 animate-in fade-in slide-in-from-top-2">
          {children}
        </div>
      )}
    </div>
  );
};

const Slider = ({ label, value, min, max, step, onChange, format = v => v }) => (
  <div className="mb-4 last:mb-0">
    <div className="flex justify-between text-sm mb-2 text-emerald-100/70 font-medium">
      <span>{label}</span>
      <span>{format(value)}</span>
    </div>
    <input 
      type="range" 
      min={min} 
      max={max} 
      step={step} 
      value={value} 
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
    />
  </div>
);

export const Modules = () => {
  const state = useStore();
  const lang = state.lang;
  const isEn = lang === 'en';

  return (
    <div className="pb-32 space-y-4 max-w-md mx-auto w-full">
      <Panel 
        title={isEn ? "Speed & Pitch" : "السرعة والطبقة"} 
        isActive={state.speed !== 1 || state.pitch !== 0}
        onToggle={() => {
          if (state.speed !== 1 || state.pitch !== 0) {
            state.setSpeed(1);
            state.setPitch(0);
          }
        }}
      >
        <Slider 
          label={isEn ? "Speed" : "السرعة"} 
          value={state.speed} min={1} max={10} step={0.1} 
          onChange={state.setSpeed} format={v => `${v}x`} 
        />
        <Slider 
          label={isEn ? "Pitch (Semitones)" : "الطبقة (أنصاف النغمات)"} 
          value={state.pitch} min={-12} max={12} step={1} 
          onChange={state.setPitch} format={v => v > 0 ? `+${v}` : v} 
        />
      </Panel>

      <Panel 
        title={isEn ? "Volume" : "الصوت"} 
        isActive={state.volume !== 0}
        onToggle={() => state.setVolume(0)}
      >
        <Slider 
          label={isEn ? "Volume Gain (dB)" : "تضخيم الصوت"} 
          value={state.volume} min={-40} max={20} step={1} 
          onChange={state.setVolume} format={v => `${v} dB`} 
        />
      </Panel>

      <Panel 
        title={isEn ? "Stereo Panning" : "التحريك الصوتي"} 
        isActive={state.pan !== 0}
        onToggle={() => state.setPan(0)}
      >
        <Slider 
          label={isEn ? "L / R" : "يسار / يمين"} 
          value={state.pan} min={-100} max={100} step={1} 
          onChange={state.setPan} format={v => v === 0 ? 'Center' : (v < 0 ? `L ${Math.abs(v)}%` : `R ${v}%`)} 
        />
      </Panel>

      <Panel 
        title={isEn ? "Reverb" : "الصدى"} 
        isActive={state.reverb.enabled}
        onToggle={() => state.setReverb({ enabled: !state.reverb.enabled })}
      >
        <div className={!state.reverb.enabled ? 'opacity-50 pointer-events-none' : ''}>
          <Slider 
            label={isEn ? "Wet/Dry Mix" : "مستوى التأثير"} 
            value={state.reverb.wet} min={0} max={1} step={0.05} 
            onChange={(v) => state.setReverb({ wet: v })} format={v => `${Math.round(v * 100)}%`} 
          />
          <Slider 
            label={isEn ? "Room Size" : "حجم الغرفة"} 
            value={state.reverb.roomSize} min={0.1} max={1} step={0.1} 
            onChange={(v) => state.setReverb({ roomSize: v })} format={v => `${Math.round(v * 100)}%`} 
          />
          <Slider 
            label={isEn ? "Decay" : "الاضمحلال"} 
            value={state.reverb.decay} min={0.5} max={5} step={0.1} 
            onChange={(v) => state.setReverb({ decay: v })} format={v => `${v}s`} 
          />
          <Slider 
            label={isEn ? "Pre-delay" : "التأخير الأولي"} 
            value={state.reverb.preDelay} min={0} max={0.2} step={0.01} 
            onChange={(v) => state.setReverb({ preDelay: v })} format={v => `${Math.round(v * 1000)}ms`} 
          />
        </div>
      </Panel>
    </div>
  );
};