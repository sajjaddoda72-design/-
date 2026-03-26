import React, { useRef, useState, useCallback } from 'react';
import Upload from 'lucide-react/dist/esm/icons/upload';
import { useStore } from '../store';
import { engine } from '../audio/engine';

export const UploadGate = () => {
  const { lang, setFile } = useStore();
  const fileRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const processFile = useCallback(async (file) => {
    if (!file) return;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      setFile(file, file.name, audioBuffer);
      engine.load(audioBuffer);
    } catch {
      alert(lang === 'en' ? "Unsupported file format" : "تنسيق الملف غير مدعوم");
    }
  }, [lang, setFile]);

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
      <div className="bg-emerald-500/10 p-6 rounded-full mb-4 ring-1 ring-emerald-500/30">
        <Upload size={48} className="text-emerald-400" />
      </div>
      <h2 className="text-xl font-bold text-emerald-100">
        {lang === 'en' ? 'Upload an audio file to start' : 'قم بتحميل ملف صوتي للبدء'}
      </h2>
      <p className="text-zinc-400 text-sm max-w-xs">
        {lang === 'en'
          ? 'Drag & drop or click to select — WAV, MP3, M4A, OGG'
          : 'اسحب وأفلت أو انقر للاختيار — WAV, MP3, M4A, OGG'}
      </p>

      <button
        onClick={() => fileRef.current?.click()}
        className="mt-6 px-8 py-3 bg-emerald-600 hover:bg-emerald-500 transition-all text-white font-medium rounded-full shadow-[0_0_15px_rgba(16,185,129,0.4)] active:scale-95"
      >
        {lang === 'en' ? 'Select File' : 'اختيار ملف'}
      </button>

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
