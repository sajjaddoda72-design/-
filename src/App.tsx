import { useState } from 'react';
import { UploadGate } from './components/UploadGate';
import { Modules } from './components/Modules';
import { PlaybackControls } from './components/PlaybackControls';
import { Visualizer } from './components/Visualizer';
import { LayerWorkspace } from './components/LayerWorkspace';
import { useStore } from './store';
import { useLayerStore } from './layerStore';
import { engine } from './audio/engine';
import Languages from 'lucide-react/dist/esm/icons/languages';
import Layers from 'lucide-react/dist/esm/icons/layers';
import ArrowRightToLine from 'lucide-react/dist/esm/icons/arrow-right-to-line';

function App() {
  const file = useStore(s => s.file);
  const fileName = useStore(s => s.fileName);
  const audioBuffer = useStore(s => s.audioBuffer);
  const lang = useStore(s => s.lang);
  const toggleLang = useStore(s => s.toggleLang);
  const resetAudio = useStore(s => s.resetAudio);
  const addLayer = useLayerStore(s => s.addLayer);

  const [screen, setScreen] = useState('main'); // 'main' | 'layers'
  const [toast, setToast] = useState<string | null>(null);

  const isEn = lang === 'en';

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleMoveToLayers = () => {
    if (!audioBuffer || !fileName) return;
    addLayer(fileName, audioBuffer);
    engine.unload();
    resetAudio();
    setScreen('layers');
    showToast(isEn ? 'File added as layer' : 'تم إضافة الملف كطبقة');
  };

  // ---- Layers screen ----
  if (screen === 'layers') {
    return (
      <div dir={isEn ? 'ltr' : 'rtl'}>
        <LayerWorkspace onBack={() => setScreen('main')} />
        {toast && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] bg-emerald-500/90 text-white px-5 py-2.5 rounded-2xl text-sm font-medium shadow-lg backdrop-blur-sm">
            {toast}
          </div>
        )}
      </div>
    );
  }

  // ---- Main screen ----
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
          <div className="flex items-center gap-2">
            {/* Layers button */}
            <button
              onClick={() => setScreen('layers')}
              className="p-2 rounded-full bg-zinc-900 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 transition-colors shadow-sm"
              title={isEn ? 'Layers' : 'الطبقات'}
            >
              <Layers size={20} />
            </button>
            {/* Language toggle */}
            <button
              onClick={toggleLang}
              className="p-2 rounded-full bg-zinc-900 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 transition-colors shadow-sm"
            >
              <Languages size={20} />
            </button>
          </div>
        </header>

        {/* Content */}
        {!file ? (
          <div className="flex-1 flex flex-col justify-center items-center w-full">
            <UploadGate />
          </div>
        ) : (
          <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Visualizer />

            {/* Move to Layers button */}
            <div className="flex justify-center">
              <button
                onClick={handleMoveToLayers}
                className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900/60 border border-emerald-500/20 rounded-full text-emerald-400 text-sm font-medium hover:bg-emerald-500/10 transition-all active:scale-95"
              >
                <ArrowRightToLine size={16} />
                {isEn ? 'Move to Layers' : 'نقل إلى الطبقات'}
              </button>
            </div>

            <Modules />
          </div>
        )}
      </div>

      <PlaybackControls />

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] bg-emerald-500/90 text-white px-5 py-2.5 rounded-2xl text-sm font-medium shadow-lg backdrop-blur-sm">
          {toast}
        </div>
      )}
    </div>
  );
}

export default App;
