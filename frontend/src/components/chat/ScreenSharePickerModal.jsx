// ============================================================================
// ScreenSharePickerModal.jsx
// Modal estilo Discord para seleccionar pantallas o aplicaciones a transmitir
// desde la aplicación de escritorio Moonlight (Electron).
// ============================================================================
import React, { useState } from 'react';
import { Monitor, AppWindow, Check, X, Tv } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ScreenSharePickerModal({ sources = [], onSelect, onCancel }) {
  const [tab, setTab] = useState('screens'); // 'screens' | 'windows'

  const screens = sources.filter((s) => s.isScreen);
  const windows = sources.filter((s) => !s.isScreen);

  const activeSources = tab === 'screens' ? screens : windows;
  const [selectedId, setSelectedId] = useState(() => {
    return activeSources[0]?.id || sources[0]?.id || null;
  });

  const handleTabChange = (nextTab) => {
    setTab(nextTab);
    const list = nextTab === 'screens' ? screens : windows;
    if (list.length > 0) {
      setSelectedId(list[0].id);
    }
  };

  const handleConfirm = () => {
    if (!selectedId) return;
    onSelect?.(selectedId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm animate-fade-in p-4 select-none">
      <div className="relative w-full max-w-[620px] rounded-2xl bg-card/95 border border-border/40 shadow-2xl p-6 flex flex-col max-h-[85vh] animate-scale-in">
        {/* Botón de Cierre */}
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-card/80 hover:text-foreground transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Encabezado */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
            <Tv className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground font-display tracking-tight">
              Compartir pantalla
            </h2>
            <p className="text-xs text-muted-foreground">
              Elige la pantalla completa o la ventana específica que deseas transmitir
            </p>
          </div>
        </div>

        {/* Pestañas (Pantallas vs Aplicaciones) */}
        <div className="flex border-b border-border/40 mb-4 gap-6">
          <button
            type="button"
            onClick={() => handleTabChange('screens')}
            className={cn(
              "flex items-center gap-2 pb-2 text-xs font-semibold border-b-2 transition-all duration-150",
              tab === 'screens'
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Monitor className="h-4 w-4" />
            Pantallas ({screens.length})
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('windows')}
            className={cn(
              "flex items-center gap-2 pb-2 text-xs font-semibold border-b-2 transition-all duration-150",
              tab === 'windows'
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <AppWindow className="h-4 w-4" />
            Aplicaciones ({windows.length})
          </button>
        </div>

        {/* Rejilla de Mosaicos con Vista Previa */}
        <div className="flex-1 overflow-y-auto pr-1 min-h-[220px] max-h-[360px] custom-scrollbar">
          {activeSources.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <AppWindow className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-xs font-medium">No se encontraron ventanas disponibles en esta categoría</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3.5">
              {activeSources.map((item) => {
                const isSelected = selectedId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={cn(
                      "group relative flex flex-col rounded-xl overflow-hidden border text-left transition-all duration-150 bg-background/40 hover:bg-card/80",
                      isSelected
                        ? "border-primary ring-2 ring-primary/40 shadow-lg shadow-primary/10"
                        : "border-border/40 hover:border-border/80"
                    )}
                  >
                    {/* Miniatura de Vista Previa */}
                    <div className="relative aspect-video w-full bg-black/60 overflow-hidden flex items-center justify-center">
                      {item.thumbnail ? (
                        <img
                          src={item.thumbnail}
                          alt={item.name}
                          className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                        />
                      ) : (
                        <Monitor className="h-8 w-8 text-muted-foreground/40" />
                      )}

                      {/* Insignia de Selección Check */}
                      {isSelected && (
                        <div className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md animate-scale-in">
                          <Check className="h-3.5 w-3.5 stroke-[3]" />
                        </div>
                      )}
                    </div>

                    {/* Nombre e Icono */}
                    <div className="p-2.5 flex items-center gap-2 min-w-0">
                      {item.appIcon ? (
                        <img src={item.appIcon} alt="" className="h-4 w-4 shrink-0 rounded" />
                      ) : (
                        <Monitor className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="text-xs font-semibold text-foreground truncate">
                        {item.name || 'Pantalla'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Pie de página */}
        <div className="mt-5 pt-3 border-t border-border/30 flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            className="h-9 px-4 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!selectedId}
            onClick={handleConfirm}
            className="h-9 px-5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg shadow-md shadow-primary/10 gap-2"
          >
            <Tv className="h-3.5 w-3.5" />
            Transmitir en directo
          </Button>
        </div>
      </div>
    </div>
  );
}
