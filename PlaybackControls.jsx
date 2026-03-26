import React, { useState } from 'react';
import { Play, Pause, Download, SkipBack } from 'lucide-react';
import { useStore } from '../store';
import { engine } from '../audio/engine';
import { exportAudio } from '../audio/export';

export const PlaybackControls = () => {
  const lang = useStore(s => s.lang);
  const isPlaying = useStore(s => s.isPlaying);
  const setIsPlaying = useStore(s => s.setIsPlaying);
  const currentTime = useStore(s => s.currentTime);
  const duration = useStore(s => s.duration);
  const file = useStore(s => s.file);
  const [exportModal, setExportModal] = useState(false);
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

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 p-4 pb-safe bg-zinc-900/90 backdrop-blur-xl border-t border-emerald-500/20 z-50">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between text-xs text-emerald-400 font-medium mb-2 px-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
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
              <SkipBack size={24} />
            </button>
            
            <button 
              onClick={togglePlay}
              disabled={!file}
              className="p-4 bg-emerald-500 hover:bg-emerald-400 text-white rounded-full shadow-[0_0_20px_rgba(16,185,129,0.4)] disabled:opacity-50 active:scale-95 transition-all"
            >
              {isPlaying ? <Pause size={32} /> : <Play size={32} className="ml-1" />}
            </button>
            
            <button 
              onClick={() => setExportModal(true)}
              disabled={!file}
              className="p-3 text-zinc-400 hover:text-emerald-400 disabled:opacity-50"
            >
              <Download size={24} />
            </button>
          </div>
        </div>
      </div>

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
    </>
  );
};