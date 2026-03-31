import React, { useRef, useEffect, useCallback } from 'react';
import Play from 'lucide-react/dist/esm/icons/play';
import Pause from 'lucide-react/dist/esm/icons/pause';
import Volume2 from 'lucide-react/dist/esm/icons/volume-2';
import VolumeX from 'lucide-react/dist/esm/icons/volume-x';
import Headphones from 'lucide-react/dist/esm/icons/headphones';
import Copy from 'lucide-react/dist/esm/icons/copy';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import Settings from 'lucide-react/dist/esm/icons/settings';
import GripVertical from 'lucide-react/dist/esm/icons/grip-vertical';
import { useStore } from '../store';

/** Draw a waveform from an AudioBuffer onto a canvas, with visual transforms. */
const drawWaveform = (canvas, audioBuffer, effects) => {
  if (!canvas || !audioBuffer) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const data = audioBuffer.getChannelData(0);

  // Visual duration scaling: compress/stretch waveform based on speed
  const speedScale = effects?.speed || 1;
  const visualSamples = Math.floor(data.length / speedScale);
  const step = Math.max(1, Math.ceil(visualSamples / w));

  // Volume amplitude scaling
  const volScale = Math.pow(10, (effects?.volume || 0) / 20);

  ctx.clearRect(0, 0, w, h);

  // Gradient fill — glow if FX active
  const hasFx = !!effects?.preset;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  if (hasFx) {
    grad.addColorStop(0, 'rgba(52, 211, 153, 0.9)');
    grad.addColorStop(0.5, 'rgba(16, 185, 129, 0.5)');
    grad.addColorStop(1, 'rgba(52, 211, 153, 0.9)');
  } else {
    grad.addColorStop(0, 'rgba(16, 185, 129, 0.8)');
    grad.addColorStop(0.5, 'rgba(16, 185, 129, 0.35)');
    grad.addColorStop(1, 'rgba(16, 185, 129, 0.8)');
  }

  ctx.fillStyle = grad;
  const mid = h / 2;

  // If reversed, read data backwards
  const reversed = effects?.reversed || false;

  for (let i = 0; i < w; i++) {
    const sampleIdx = reversed ? (visualSamples - 1 - i * step) : (i * step);
    let min = 1, max = -1;
    for (let j = 0; j < step; j++) {
      const idx = Math.abs(sampleIdx + j) % data.length;
      const val = (data[idx] || 0) * volScale;
      if (val < min) min = val;
      if (val > max) max = val;
    }
    // Clamp
    min = Math.max(-1, min);
    max = Math.min(1, max);
    const top = mid + min * mid;
    const bottom = mid + max * mid;
    ctx.fillRect(i, top, 1, Math.max(1, bottom - top));
  }
};

const formatDuration = (secs) => {
  if (!secs || secs < 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export const LayerItem = ({
  layer,
  index,
  onRemove,
  onDuplicate,
  onToggleMute,
  onToggleSolo,
  onOpenEditor,
  onDragStart,
  onDragOver,
  onDrop,
  previewPlaying,
  onTogglePreview,
}) => {
  const canvasRef = useRef(null);
  const lang = useStore((s) => s.lang);
  const isEn = lang === 'en';
  const fx = layer.effects;

  // Visual duration = original duration / speed
  const visualDuration = layer.duration / (fx.speed || 1);

  // Redraw waveform when buffer or effects change
  useEffect(() => {
    drawWaveform(canvasRef.current, layer.audioBuffer, fx);
  }, [layer.audioBuffer, fx.speed, fx.volume, fx.reversed, fx.preset]);

  const handleDragStart = useCallback((e) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    onDragStart(index);
  }, [index, onDragStart]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    onDragOver(index);
  }, [index, onDragOver]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    onDrop(index);
  }, [index, onDrop]);

  const { muted, solo } = fx;
  const hasPreset = !!fx.preset;

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`rounded-2xl border transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 ${
        muted
          ? 'bg-zinc-900/40 border-white/5 opacity-50'
          : solo
            ? 'bg-emerald-900/20 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
            : 'bg-zinc-900/60 border-white/10 hover:border-emerald-500/20'
      }`}
    >
      {/* Header: drag handle + name + metadata */}
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-400 touch-none transition-colors">
          <GripVertical size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-emerald-100 truncate">{layer.name}</div>
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 flex-wrap">
            <span>{formatDuration(visualDuration)}</span>
            {fx.speed !== 1 && (
              <span className="bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-medium">
                {fx.speed}x
              </span>
            )}
            {fx.pitch !== 0 && (
              <span className="bg-teal-500/10 text-teal-400 px-1.5 py-0.5 rounded font-medium">
                {fx.pitch > 0 ? '+' : ''}{fx.pitch}st
              </span>
            )}
            {layer.offset > 0 && (
              <span className="bg-zinc-800 px-1.5 py-0.5 rounded text-emerald-400/70">
                +{layer.offset.toFixed(1)}s
              </span>
            )}
            {hasPreset && (
              <span className="bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded font-medium animate-pulse">
                FX
              </span>
            )}
            {fx.reversed && (
              <span className="bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded font-medium">
                REV
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Waveform */}
      <div className="px-3 pb-2">
        <canvas
          ref={canvasRef}
          width={600}
          height={60}
          className={`w-full h-[40px] rounded-lg transition-all duration-300 ${
            hasPreset ? 'bg-emerald-900/20 shadow-[0_0_8px_rgba(16,185,129,0.1)]' : 'bg-zinc-800/50'
          }`}
        />
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between px-2 pb-2">
        <button onClick={() => onTogglePreview(layer.id)}
          className="p-2 text-zinc-400 hover:text-emerald-400 transition-all active:scale-90">
          {previewPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button onClick={() => onToggleMute(layer.id)}
          className={`p-2 transition-all active:scale-90 ${muted ? 'text-red-400' : 'text-zinc-400 hover:text-emerald-400'}`}>
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
        <button onClick={() => onToggleSolo(layer.id)}
          className={`p-2 transition-all active:scale-90 ${solo ? 'text-yellow-400' : 'text-zinc-400 hover:text-emerald-400'}`}>
          <Headphones size={16} />
        </button>
        <button onClick={() => onDuplicate(layer.id)}
          className="p-2 text-zinc-400 hover:text-emerald-400 transition-all active:scale-90">
          <Copy size={16} />
        </button>
        <button onClick={() => onOpenEditor(layer.id)}
          className="p-2 text-zinc-400 hover:text-emerald-400 transition-all active:scale-90">
          <Settings size={16} />
        </button>
        <button onClick={() => onRemove(layer.id)}
          className="p-2 text-zinc-400 hover:text-red-400 transition-all active:scale-90">
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};
