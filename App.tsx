import React from 'react';
import { UploadGate } from './components/UploadGate';
import { Modules } from './components/Modules';
import { PlaybackControls } from './components/PlaybackControls';
import { Visualizer } from './components/Visualizer';
import { useStore } from './store';
import { Languages } from 'lucide-react';

function App() {
  const file = useStore(s => s.file);
  const lang = useStore(s => s.lang);
  const toggleLang = useStore(s => s.toggleLang);

  const isEn = lang === 'en';

  return (
    <div dir={isEn ? 'ltr' : 'rtl'} className="min-h-screen bg-black text-white font-sans selection:bg-emerald-500/30">
      {/* Background gradients */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-emerald-900/20 blur-[120px] rounded-full opacity-50 mix-blend-screen" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-teal-900/20 blur-[100px] rounded-full opacity-30 mix-blend-screen" />
      </div>

      <div className="relative z-10 flex flex-col items-center min-h-screen pt-6 px-4 pb-48 max-w-lg mx-auto w-full">
        {/* Header */}
        <header className="w-full flex justify-between items-center mb-6 border-b border-emerald-500/20 pb-4">
          <h1 className="text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
            EcoSynth
          </h1>
          <button 
            onClick={toggleLang}
            className="p-2 rounded-full bg-zinc-900 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 transition-colors shadow-sm"
          >
            <Languages size={20} />
          </button>
        </header>

        {/* Content */}
        {!file ? (
          <div className="flex-1 flex flex-col justify-center items-center w-full">
            <UploadGate />
          </div>
        ) : (
          <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Visualizer />
            <Modules />
          </div>
        )}
      </div>

      <PlaybackControls />
    </div>
  );
}

export default App;