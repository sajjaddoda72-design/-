import React, { useRef, useState, useCallback } from 'react';
import Upload from 'lucide-react/dist/esm/icons/upload';
import { useStore } from '../store';
import { engine } from '../audio/engine';

/* ---------- Animated waveform bars (pure CSS) ---------- */
const WaveformLoader = ({ fileName, statusText }) => (
  <div className="flex flex-col items-center justify-center gap-5 py-2">
    {/* Animated bars */}
    <div className="flex items-end gap-[5px] h-16">
      {[0.45, 0.7, 1, 0.8, 0.55, 0.9, 0.65, 0.5, 0.75].map((h, i) => (
        <span
          key={i}
          className="w-[5px] rounded-full bg-emerald-400"
          style={{
            animation: `wave 1s ease-in-out ${i * 0.09}s infinite alternate`,
            height: `${h * 100}%`,
          }}
        />
      ))}
    </div>

    {/* File name */}
    <p className="text-emerald-200 font-semibold text-sm truncate max-w-[240px]">
      {fileName}
    </p>

    {/* Status */}
    <span className="text-emerald-400/80 text-xs tracking-wide animate-pulse">
      {statusText}
    </span>

    {/* Inline keyframes */}
    <style>{`
      @keyframes wave {
        0%   { transform: scaleY(0.35); opacity: 0.5; }
        100% { transform: scaleY(1);    opacity: 1;   }
      }
    `}</style>
  </div>
);

export const UploadGate = () => {
  const { lang, setFile } = useStore();
  const fileRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(null); // { name, status }

  const isEn = lang === 'en';

  const processFile = useCallback(async (file) => {
    if (!file) return;

    setLoading({
      name: file.name,
      status: isEn ? 'Reading file...' : 'جاري قراءة الملف...',
    });

    try {
      const arrayBuffer = await file.arrayBuffer();

      setLoading({
        name: file.name,
        status: isEn ? 'Analyzing audio...' : 'جاري تحليل الصوت...',
      });

      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      setFile(file, file.name, audioBuffer);
      engine.load(audioBuffer);
    } catch {
      alert(isEn ? 'Unsupported file format' : 'تنسيق الملف غير مدعوم');
    } finally {
      setLoading(null);
    }
  }, [isEn, setFile]);

  const handleFile = (e) => {
    processFile(e.target.files[0]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) processFile(file);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col items-center justify-center p-8 bg-zinc-900/60 backdrop-blur border rounded-3xl text-center space-y-4 m-4 shadow-xl shadow-emerald-900/10 transition-all ${
        dragging
          ? 'border-emerald-400 bg-emerald-500/10 scale-[1.02]'
          : 'border-emerald-500/20'
      }`}
    >
      {loading ? (
        /* ---- Loading state ---- */
        <WaveformLoader fileName={loading.name} statusText={loading.status} />
      ) : (
        /* ---- Idle state ---- */
        <>
          <div className="bg-emerald-500/10 p-6 rounded-full mb-4 ring-1 ring-emerald-500/30">
            <Upload size={48} className="text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-emerald-100">
            {isEn ? 'Upload an audio file to start' : 'قم بتحميل ملف صوتي للبدء'}
          </h2>
          <p className="text-zinc-400 text-sm max-w-xs">
            {isEn
              ? 'Drag & drop or click to select — WAV, MP3, M4A, OGG'
              : 'اسحب وأفلت أو انقر للاختيار — WAV, MP3, M4A, OGG'}
          </p>

          <button
            onClick={() => fileRef.current?.click()}
            className="mt-6 px-8 py-3 bg-emerald-600 hover:bg-emerald-500 transition-all text-white font-medium rounded-full shadow-[0_0_15px_rgba(16,185,129,0.4)] active:scale-95"
          >
            {isEn ? 'Select File' : 'اختيار ملف'}
          </button>
        </>
      )}

      <input
        type="file"
        ref={fileRef}
        className="hidden"
        accept="audio/wav,audio/mp3,audio/mpeg,audio/m4a,audio/ogg,audio/aac,audio/*"
        onChange={handleFile}
      />
    </div>
  );
};
