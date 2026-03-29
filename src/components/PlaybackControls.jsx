import React, { useState } from 'react';
import Play from 'lucide-react/dist/esm/icons/play';
import Pause from 'lucide-react/dist/esm/icons/pause';
import Download from 'lucide-react/dist/esm/icons/download';
import SkipBack from 'lucide-react/dist/esm/icons/skip-back';
import X from 'lucide-react/dist/esm/icons/x';
import Undo2 from 'lucide-react/dist/esm/icons/undo-2';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import { useStore } from '../store';
import { engine } from '../audio/engine';
import { exportAudio } from '../audio/export';
import { FX_PRESETS } from '../audio/fxPresets';

export const PlaybackControls = () => {
  const lang = useStore(s => s.lang);
  const isPlaying = useStore(s => s.isPlaying);
  const setIsPlaying = useStore(s => s.setIsPlaying);
  const currentTime = useStore(s => s.currentTime);
  const duration = useStore(s => s.duration);
  const file = useStore(s => s.file);
  const fileName = useStore(s => s.fileName);
  const reversed = useStore(s => s.reversed);
  const setReversed = useStore(s => s.setReversed);
  const activePreset = useStore(s => s.activePreset);
  const setActivePreset = useStore(s => s.setActivePreset);
  const resetAudio = useStore(s => s.resetAudio);
  const [exportModal, setExportModal] = useState(false);
  const [fxModal, setFxModal] = useState(false);
  const [exportProgress, setExportProgress] = useState(null);

  const isEn = lang === 'en';

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e) => {
    const val = parseFloat(e.target.value);
    engine.seek(val / 100);
  };

  const formatTime = (secs) => {
    if (!secs) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleRemoveAudio = () => {
    engine.unload();
    resetAudio();
  };

  const handleToggleReverse = () => {
    if (!file) return;
    setReversed(!reversed);
  };

  const handleSelectPreset = (presetId) => {
    if (activePreset === presetId) {
      // Deselect
      engine.clearPreset();
      setActivePreset(null);
    } else {
      const preset = FX_PRESETS.find((p) => p.id === presetId);
      if (preset) {
        engine.applyPreset(preset.build.bind(preset), preset.wet);
        setActivePreset(presetId);
      }
    }
  };

  const startExport = async (format) => {
    setIsPlaying(false);
    try {
      await exportAudio(format, (msg, progress) => {
        setExportProgress({ msg, p: progress });
      });
      setExportModal(false);
    } catch (err) {
      alert("Export failed: " + err.message);
    } finally {
      setExportProgress(null);
    }
  };

  // Glass button style helper
  const glassBtn = (active) =>
    `p-3 rounded-full border transition-all ${
      active
        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
        : 'bg-zinc-900/60 border-white/10 text-zinc-400 hover:text-emerald-400 hover:border-emerald-500/30'
    } disabled:opacity-50 disabled:pointer-events-none`;

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 p-4 pb-safe bg-zinc-900/90 backdrop-blur-xl border-t border-emerald-500/20 z-50">
        <div className="max-w-md mx-auto">
          {/* File name + time row */}
          <div className="flex items-center justify-between text-xs font-medium mb-2 px-1">
            <span className="text-emerald-400">{formatTime(currentTime)}</span>
            {file && (
              <span className="text-zinc-500 truncate max-w-[160px] mx-2">{fileName}</span>
            )}
            <span className="text-emerald-400">{formatTime(duration)}</span>
          </div>

          <input
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={duration ? (currentTime / duration) * 100 : 0}
            onChange={handleSeek}
            disabled={!file}
            className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 mb-4"
          />

          <div className="flex items-center justify-between">
            <button
              onClick={() => engine.seek(0)}
              disabled={!file}
              className="p-3 text-zinc-400 hover:text-emerald-400 disabled:opacity-50"
            >
              <SkipBack size={22} />
            </button>

            {/* Reverse */}
            <button
              onClick={handleToggleReverse}
              disabled={!file}
              title={isEn ? 'Reverse' : 'عكس'}
              className={glassBtn(reversed)}
            >
              <Undo2 size={20} />
            </button>

            {/* Remove Audio */}
            <button
              onClick={handleRemoveAudio}
              disabled={!file}
              title={isEn ? 'Remove Audio' : 'إزالة الصوت'}
              className="p-3 text-zinc-400 hover:text-red-400 disabled:opacity-50 transition-colors"
            >
              <X size={20} />
            </button>

            {/* Play */}
            <button
              onClick={togglePlay}
              disabled={!file}
              className="p-4 bg-emerald-500 hover:bg-emerald-400 text-white rounded-full shadow-[0_0_20px_rgba(16,185,129,0.4)] disabled:opacity-50 active:scale-95 transition-all"
            >
              {isPlaying ? <Pause size={28} /> : <Play size={28} className="ml-0.5" />}
            </button>

            {/* FX Presets */}
            <button
              onClick={() => setFxModal(true)}
              disabled={!file}
              title={isEn ? 'FX Presets' : 'مؤثرات جاهزة'}
              className={glassBtn(!!activePreset)}
            >
              <Sparkles size={20} />
            </button>

            {/* Export */}
            <button
              onClick={() => setExportModal(true)}
              disabled={!file}
              className="p-3 text-zinc-400 hover:text-emerald-400 disabled:opacity-50"
            >
              <Download size={22} />
            </button>
          </div>
        </div>
      </div>

      {/* ---- Export Modal ---- */}
      {exportModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-emerald-500/30 p-6 rounded-3xl max-w-sm w-full shadow-2xl">
            <h2 className="text-xl font-bold text-emerald-100 mb-6 text-center">
              {isEn ? 'Export Audio' : 'تصدير الصوت'}
            </h2>

            {exportProgress ? (
              <div className="text-center py-4">
                <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <div className="text-emerald-300 font-medium animate-pulse">{exportProgress.msg}</div>
                <div className="w-full bg-zinc-800 h-2 rounded-full mt-4 overflow-hidden">
                  <div className="bg-emerald-500 h-full transition-all duration-300" style={{width: `${exportProgress.p}%`}}></div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={() => startExport('wav')}
                  className="w-full p-4 bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/50 rounded-xl text-emerald-100 font-medium transition-all flex justify-between items-center"
                >
                  <span>Download WAV</span>
                  <span className="text-xs opacity-70">Lossless</span>
                </button>
                <button
                  onClick={() => startExport('mp3')}
                  className="w-full p-4 bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/50 rounded-xl text-emerald-100 font-medium transition-all flex justify-between items-center"
                >
                  <span>Download MP3</span>
                  <span className="text-xs opacity-70">Compressed</span>
                </button>
                <button
                  onClick={() => setExportModal(false)}
                  className="w-full mt-4 p-4 text-zinc-400 hover:text-white"
                >
                  {isEn ? 'Cancel' : 'إلغاء'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- FX Presets Modal ---- */}
      {fxModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-emerald-500/30 p-5 rounded-3xl max-w-sm w-full shadow-2xl max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-emerald-100 mb-4 text-center">
              {isEn ? 'FX Presets' : 'مؤثرات جاهزة'}
            </h2>

            <div className="grid grid-cols-2 gap-3">
              {FX_PRESETS.map((preset) => {
                const isActive = activePreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => { handleSelectPreset(preset.id); }}
                    className={`p-4 rounded-2xl border text-center transition-all active:scale-95 ${
                      isActive
                        ? 'bg-emerald-500/20 border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                        : 'bg-zinc-800/60 border-white/5 hover:border-emerald-500/30 hover:bg-zinc-800'
                    }`}
                  >
                    <div className="text-2xl mb-2">{preset.icon}</div>
                    <div className={`text-sm font-medium ${isActive ? 'text-emerald-300' : 'text-zinc-300'}`}>
                      {isEn ? preset.name.en : preset.name.ar}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Clear + Close */}
            <div className="flex gap-3 mt-4">
              {activePreset && (
                <button
                  onClick={() => { engine.clearPreset(); setActivePreset(null); }}
                  className="flex-1 p-3 text-sm text-red-400 border border-red-500/30 rounded-xl hover:bg-red-500/10 transition-all"
                >
                  {isEn ? 'Clear FX' : 'إزالة المؤثر'}
                </button>
              )}
              <button
                onClick={() => setFxModal(false)}
                className="flex-1 p-3 text-sm text-zinc-400 hover:text-white"
              >
                {isEn ? 'Close' : 'إغلاق'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
