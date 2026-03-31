import React, { useRef, useState, useCallback } from 'react';
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left';
import Plus from 'lucide-react/dist/esm/icons/plus';
import Play from 'lucide-react/dist/esm/icons/play';
import Pause from 'lucide-react/dist/esm/icons/pause';
import Download from 'lucide-react/dist/esm/icons/download';
import { useStore } from '../store';
import { useLayerStore } from '../layerStore';
import { LayerItem } from './LayerItem';
import { LayerEditor } from './LayerEditor';
import { exportLayerMix } from '../audio/layerExport';

export const LayerWorkspace = ({ onBack }) => {
  const lang = useStore((s) => s.lang);
  const isEn = lang === 'en';

  const layers = useLayerStore((s) => s.layers);
  const addLayer = useLayerStore((s) => s.addLayer);
  const removeLayer = useLayerStore((s) => s.removeLayer);
  const duplicateLayer = useLayerStore((s) => s.duplicateLayer);
  const updateLayerEffects = useLayerStore((s) => s.updateLayerEffects);
  const reorderLayers = useLayerStore((s) => s.reorderLayers);
  const editingLayerId = useLayerStore((s) => s.editingLayerId);
  const setEditingLayerId = useLayerStore((s) => s.setEditingLayerId);

  const fileRef = useRef(null);
  const [dragFrom, setDragFrom] = useState(null);
  const [previewId, setPreviewId] = useState(null);
  const [previewCtx, setPreviewCtx] = useState(null);
  const [exporting, setExporting] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  // ---- Add layer from file ----
  const handleAddFile = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      addLayer(file.name, audioBuffer);
      showToast(isEn ? 'Layer created successfully' : 'تم إنشاء الطبقة بنجاح');
    } catch {
      alert(isEn ? 'Unsupported file format' : 'تنسيق الملف غير مدعوم');
    }
    if (fileRef.current) fileRef.current.value = '';
  }, [addLayer, isEn]);

  // ---- Preview playback ----
  const handleTogglePreview = useCallback((id) => {
    if (previewId === id && previewCtx) {
      previewCtx.close();
      setPreviewCtx(null);
      setPreviewId(null);
      return;
    }
    // Stop any existing preview
    if (previewCtx) previewCtx.close();

    const layer = layers.find((l) => l.id === id);
    if (!layer) return;

    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const source = ctx.createBufferSource();
    source.buffer = layer.audioBuffer;
    const gain = ctx.createGain();
    gain.gain.value = Math.pow(10, layer.effects.volume / 20);
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(0);
    source.onended = () => {
      setPreviewId(null);
      setPreviewCtx(null);
    };
    setPreviewId(id);
    setPreviewCtx(ctx);
  }, [previewId, previewCtx, layers]);

  // ---- Drag reorder ----
  const handleDragStart = useCallback((idx) => setDragFrom(idx), []);
  const handleDragOver = useCallback(() => {}, []);
  const handleDrop = useCallback((toIdx) => {
    if (dragFrom !== null && dragFrom !== toIdx) {
      reorderLayers(dragFrom, toIdx);
    }
    setDragFrom(null);
  }, [dragFrom, reorderLayers]);

  // ---- Export ----
  const handleExport = useCallback(async () => {
    if (layers.length === 0) return;
    setExporting({ msg: isEn ? 'Rendering mix...' : 'جاري تصدير المزيج...', p: 0 });
    try {
      await exportLayerMix(layers, (msg, p) => setExporting({ msg, p }));
      showToast(isEn ? 'Export complete!' : 'تم التصدير!');
    } catch (err) {
      alert((isEn ? 'Export failed: ' : 'فشل التصدير: ') + err.message);
    } finally {
      setExporting(null);
    }
  }, [layers, isEn]);

  // ---- Editing layer ----
  const editingLayer = editingLayerId ? layers.find((l) => l.id === editingLayerId) : null;

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-emerald-900/20 blur-[120px] rounded-full opacity-50 mix-blend-screen" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen max-w-lg mx-auto w-full">
        {/* Header */}
        <header className="flex items-center gap-3 px-4 pt-6 pb-4 border-b border-emerald-500/20">
          <button onClick={onBack}
            className="p-2 rounded-full bg-zinc-900 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300 flex-1">
            {isEn ? 'Layers' : 'الطبقات'}
          </h1>
          <button onClick={handleExport} disabled={layers.length === 0 || !!exporting}
            className="p-2 rounded-full bg-zinc-900 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
            title={isEn ? 'Export Mix' : 'تصدير المزيج'}>
            <Download size={20} />
          </button>
        </header>

        {/* Export progress */}
        {exporting && (
          <div className="mx-4 mt-3 p-3 bg-zinc-900/80 border border-emerald-500/30 rounded-2xl flex items-center gap-3">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            <div className="flex-1">
              <div className="text-xs text-emerald-300">{exporting.msg}</div>
              <div className="w-full bg-zinc-800 h-1 rounded-full mt-1 overflow-hidden">
                <div className="bg-emerald-500 h-full transition-all" style={{ width: `${exporting.p}%` }}></div>
              </div>
            </div>
          </div>
        )}

        {/* Layer list */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-24">
          {layers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="text-zinc-600 text-6xl mb-4">🎚️</div>
              <p className="text-zinc-500 text-sm">
                {isEn ? 'No layers yet. Add audio files to start mixing.' : 'لا توجد طبقات. أضف ملفات صوتية لبدء المزج.'}
              </p>
            </div>
          ) : (
            layers.map((layer, idx) => (
              <LayerItem
                key={layer.id}
                layer={layer}
                index={idx}
                onRemove={removeLayer}
                onDuplicate={duplicateLayer}
                onToggleMute={(id) => updateLayerEffects(id, { muted: !layer.effects.muted })}
                onToggleSolo={(id) => updateLayerEffects(id, { solo: !layer.effects.solo })}
                onOpenEditor={setEditingLayerId}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                previewPlaying={previewId === layer.id}
                onTogglePreview={handleTogglePreview}
              />
            ))
          )}
        </div>

        {/* Add Layer FAB */}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-medium rounded-full shadow-[0_0_20px_rgba(16,185,129,0.4)] active:scale-95 transition-all"
          >
            <Plus size={20} />
            <span>{isEn ? 'Add Layer' : 'إضافة طبقة'}</span>
          </button>
        </div>

        <input
          type="file" ref={fileRef} className="hidden"
          accept="audio/wav,audio/mp3,audio/mpeg,audio/m4a,audio/ogg,audio/aac,audio/*"
          onChange={handleAddFile}
        />
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] bg-emerald-500/90 text-white px-5 py-2.5 rounded-2xl text-sm font-medium shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-top-2">
          {toast}
        </div>
      )}

      {/* Layer Editor Modal */}
      {editingLayer && (
        <LayerEditor
          layer={editingLayer}
          onClose={() => setEditingLayerId(null)}
          onUpdate={(patch) => updateLayerEffects(editingLayer.id, patch)}
        />
      )}
    </div>
  );
};
