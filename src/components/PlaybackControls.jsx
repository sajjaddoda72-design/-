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
  const [fxModal, setFxModal] = useState(false);
  const [exporting, setExporting] = useState(null); // { msg, p }

  const isEn = lang === 'en';

  const togglePlay = () => setIsPlaying(!isPlaying);

  const handleSeek = (e) => {
    engine.seek(parseFloat(e.target.value) / 100);
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

  const handleExportWav = async () => {
    if (!file || exporting) return;
    setIsPlaying(false);
    try {
      await exportAudio((msg, p) => setExporting({ msg, p }));
    } catch (err) {
      alert((isEn ? 'Export failed: ' : 'فشل التصدير: ') + err.message);
    } finally {
      setExporting(null);
    }
  };

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
          {/* Export progress overlay */}
          {exporting && (
            <div className="absolute inset-0 bg-zinc-900/95 backdrop-blur-sm flex flex-col items-center justify-center rounded-t-2xl z-10">
              <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></div>
              <div className="text-emerald-300 text-sm font-medium animate-pulse">{exporting.msg}</div>
              <div className="w-48 bg-zinc-800 h-1.5 rounded-full mt-3 overflow-hidden">
                <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${exporting.p}%` }}></div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-xs font-medium mb-2 px-1">
            <span className="text-emerald-400">{formatTime(currentTime)}</span>
            {file && (
              <span className="text-zinc-500 truncate max-w-[160px] mx-2">{fileName}</span>
            )}
            <span className="text-emerald-400">{formatTime(duration)}</span>
          </div>

          <input
            type="range" min="0" max="100" step="0.1"
            value={duration ? (currentTime / duration) * 100 : 0}
            onChange={handleSeek} disabled={!file}
            className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 mb-4"
          />

          <div className="flex items-center justify-between">
            <button onClick={() => engine.seek(0)} disabled={!file}
              className="p-3 text-zinc-400 hover:text-emerald-400 disabled:opacity-50">
              <SkipBack size={22} />
            </button>

            <button onClick={handleToggleReverse} disabled={!file}
              title={isEn ? 'Reverse' : 'عكس'} className={glassBtn(reversed)}>
              <Undo2 size={20} />
            </button>

            <button onClick={handleRemoveAudio} disabled={!file}
              title={isEn ? 'Remove Audio' : 'إزالة الصوت'}
              className="p-3 text-zinc-400 hover:text-red-400 disabled:opacity-50 transition-colors">
              <X size={20} />
            </button>

            <button onClick={togglePlay} disabled={!file}
              className="p-4 bg-emerald-500 hover:bg-emerald-400 text-white rounded-full shadow-[0_0_20px_rgba(16,185,129,0.4)] disabled:opacity-50 active:scale-95 transition-all">
              {isPlaying ? <Pause size={28} /> : <Play size={28} className="ml-0.5" />}
            </button>

            <button onClick={() => setFxModal(true)} disabled={!file}
              title={isEn ? 'FX Presets' : 'مؤثرات جاهزة'} className={glassBtn(!!activePreset)}>
              <Sparkles size={20} />
            </button>

            {/* Direct WAV export */}
            <button onClick={handleExportWav} disabled={!file || !!exporting}
              title={isEn ? 'Download WAV' : 'تنزيل WAV'}
              className="p-3 text-zinc-400 hover:text-emerald-400 disabled:opacity-50">
              <Download size={22} />
            </button>
          </div>
        </div>
      </div>

      {/* FX Presets Modal */}
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
                  <button key={preset.id} onClick={() => handleSelectPreset(preset.id)}
                    className={`p-4 rounded-2xl border text-center transition-all active:scale-95 ${
                      isActive
                        ? 'bg-emerald-500/20 border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                        : 'bg-zinc-800/60 border-white/5 hover:border-emerald-500/30 hover:bg-zinc-800'
                    }`}>
                    <div className="text-2xl mb-2">{preset.icon}</div>
                    <div className={`text-sm font-medium ${isActive ? 'text-emerald-300' : 'text-zinc-300'}`}>
                      {isEn ? preset.name.en : preset.name.ar}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-3 mt-4">
              {activePreset && (
                <button onClick={() => { engine.clearPreset(); setActivePreset(null); }}
                  className="flex-1 p-3 text-sm text-red-400 border border-red-500/30 rounded-xl hover:bg-red-500/10 transition-all">
                  {isEn ? 'Clear FX' : 'إزالة المؤثر'}
                </button>
              )}
              <button onClick={() => setFxModal(false)}
                className="flex-1 p-3 text-sm text-zinc-400 hover:text-white">
                {isEn ? 'Close' : 'إغلاق'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
