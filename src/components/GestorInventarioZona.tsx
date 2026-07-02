'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Wifi, WifiOff, Plus, Minus, Save, CheckCircle2, AlertTriangle, Trash2, PlusCircle } from 'lucide-react';
import { useDialog } from '@/hooks/useDialog';
import DialogModal from '@/components/DialogModal';

type Inventario = Record<string, number>;

// Lee del localStorage de forma segura
function readLocal(zonaId: string): { inv: Inventario, cats: string[] } | null {
  try {
    const raw = localStorage.getItem(`avcor-inv-v2-${zonaId}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeLocal(zonaId: string, inv: Inventario, cats: string[]) {
  try { localStorage.setItem(`avcor-inv-v2-${zonaId}`, JSON.stringify({ inv, cats })); } catch { /* noop */ }
}

export default function GestorInventarioZona({ zonaId }: { zonaId: string }) {
  const supabase = createClient();
  const { dialogProps, showAlert, showDanger } = useDialog();

  const [categories,   setCategories]     = useState<string[]>([]);
  const [inventory,    setInventoryState] = useState<Inventario>({});
  const [pendingSync,  setPendingSync]    = useState(false);
  const [isSyncing,    setIsSyncing]      = useState(false);
  const [isOnline,     setIsOnline]       = useState(true);
  const [lastSynced,   setLastSynced]     = useState<string | null>(null);
  const [syncError,    setSyncError]      = useState<string | null>(null);
  const [initializing, setInitializing]   = useState(true);
  
  const [newCatName, setNewCatName] = useState('');

  const fetchedRef = useRef(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const up   = () => { setIsOnline(true); };
    const down = () => setIsOnline(false);
    window.addEventListener('online',  up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  useEffect(() => {
    if (fetchedRef.current || !zonaId) return;
    fetchedRef.current = true;

    async function init() {
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('inventario')
          .select('tipo, cantidad_disponible')
          .eq('zona_id', zonaId);

        if (!error && data) {
          const fromDB: Inventario = {};
          const cats: string[] = [];
          data.forEach(row => { 
            fromDB[row.tipo] = row.cantidad_disponible; 
            cats.push(row.tipo);
          });
          
          if (cats.length === 0) {
            // Defaults si está vacio
            const defaultCats = ['agua', 'alimentos', 'medicamentos', 'herramientas'];
            defaultCats.forEach(c => fromDB[c] = 0);
            setCategories(defaultCats);
            setInventoryState(fromDB);
            writeLocal(zonaId, fromDB, defaultCats);
            const seed = defaultCats.map(tipo => ({ zona_id: zonaId, tipo, cantidad_disponible: 0 }));
            await supabase.from('inventario').upsert(seed, { onConflict: 'zona_id,tipo' });
          } else {
            setCategories(cats);
            setInventoryState(fromDB);
            writeLocal(zonaId, fromDB, cats);
          }
          setPendingSync(false);
          setInitializing(false);
          return;
        }
      }

      // Offline
      const local = readLocal(zonaId);
      if (local) {
        setInventoryState(local.inv);
        setCategories(local.cats);
      } else {
        const defaultCats = ['agua', 'alimentos', 'medicamentos', 'herramientas'];
        const defInv: Inventario = {};
        defaultCats.forEach(c => defInv[c] = 0);
        setCategories(defaultCats);
        setInventoryState(defInv);
      }
      setPendingSync(true);
      setInitializing(false);
    }

    init();
  }, [zonaId, supabase]);

  const handleIncrement = useCallback((tipo: string, amount: number) => {
    setInventoryState(prev => {
      const next = { ...prev, [tipo]: Math.max(0, prev[tipo] + amount) };
      writeLocal(zonaId, next, categories);
      return next;
    });
    setPendingSync(true);
    setSyncError(null);
  }, [zonaId, categories]);

  const handleChange = useCallback((tipo: string, value: string) => {
    const val = parseInt(value) || 0;
    setInventoryState(prev => {
      const next = { ...prev, [tipo]: Math.max(0, val) };
      writeLocal(zonaId, next, categories);
      return next;
    });
    setPendingSync(true);
    setSyncError(null);
  }, [zonaId, categories]);

  const syncInventory = useCallback(async (currentInventory: Inventario, currentCats: string[]) => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncError(null);

    const updates = currentCats.map(tipo => ({
      zona_id: zonaId,
      tipo,
      cantidad_disponible: currentInventory[tipo],
      updated_at: new Date().toISOString(),
    }));

    if (updates.length > 0) {
      const { error } = await supabase.from('inventario').upsert(updates, { onConflict: 'zona_id,tipo' });
      if (error) {
        setSyncError(`No se pudo sincronizar: ${error.message}`);
        setIsSyncing(false);
        return;
      }
    }

    setPendingSync(false);
    setLastSynced(new Date().toLocaleTimeString('es-VE'));
    setIsSyncing(false);
  }, [zonaId, isSyncing, supabase]);

  useEffect(() => {
    if (isOnline && pendingSync && !isSyncing && !initializing) {
      syncInventory(inventory, categories);
    }
  }, [isOnline, pendingSync, initializing, inventory, categories, isSyncing, syncInventory]);

  const addCategory = async () => {
    const cat = newCatName.trim().toLowerCase();
    if (!cat || categories.includes(cat)) return;
    
    const newCats = [...categories, cat];
    const newInv = { ...inventory, [cat]: 0 };
    
    setCategories(newCats);
    setInventoryState(newInv);
    setNewCatName('');
    writeLocal(zonaId, newInv, newCats);
    setPendingSync(true);
  };
  const removeCategory = useCallback((cat: string) => {
    const cantidad = inventory[cat] || 0;
    const title = `Eliminar "${cat}"`;
    const msg = cantidad > 0
      ? `Esta categoría tiene ${cantidad} unidades registradas. Si la eliminas se borrarán permanentemente de la base de datos. ¿Deseas continuar?`
      : `¿Seguro que deseas eliminar la categoría "${cat}"? Esta acción es permanente.`;

    showDanger(title, msg, 'Sí, eliminar').then(async confirmed => {
      if (!confirmed) return;

      const newCats = categories.filter(c => c !== cat);
      const newInv = { ...inventory };
      delete newInv[cat];
      setCategories(newCats);
      setInventoryState(newInv);
      writeLocal(zonaId, newInv, newCats);

      if (isOnline) {
        const { error } = await supabase
          .from('inventario')
          .delete()
          .eq('zona_id', zonaId)
          .eq('tipo', cat);

        if (error) {
          await showAlert('Error al eliminar', `No se pudo eliminar "${cat}" de la base de datos: ${error.message}`);
          setCategories(categories);
          setInventoryState(inventory);
          writeLocal(zonaId, inventory, categories);
          return;
        }
        await syncInventory(newInv, newCats);
      } else {
        setPendingSync(true);
      }
    });
  }, [inventory, categories, zonaId, isOnline, supabase, showDanger, showAlert, syncInventory]);


  if (initializing) {
    return (
      <div className="max-w-4xl mx-auto p-8 bg-slate-800 rounded-2xl shadow-xl border border-slate-700 text-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-slate-700"></div>
          <div className="h-4 bg-slate-700 rounded w-48"></div>
          <p className="text-slate-400 text-sm">Cargando inventario de Supabase...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 bg-slate-800 rounded-2xl shadow-xl border border-slate-700">
      <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4 border-b border-slate-700 pb-5">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-white">Gestor de Inventario</h2>
          {lastSynced && !pendingSync && (
            <p className="text-sm text-emerald-400 font-medium flex items-center gap-1 mt-1">
              <CheckCircle2 className="w-4 h-4" /> Sincronizado a las {lastSynced}
            </p>
          )}
        </div>
        <div className={`flex items-center px-4 py-2 rounded-full font-semibold text-sm shadow-sm transition-colors ${isOnline ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
          {isOnline ? <Wifi className="w-5 h-5 mr-2" /> : <WifiOff className="w-5 h-5 mr-2" />}
          {isOnline ? 'Conectado' : 'Sin señal (Offline)'}
        </div>
      </div>

      {syncError && (
        <div className="mb-6 p-4 bg-red-900/40 border-l-4 border-red-500 text-red-300 rounded-r-xl flex items-start gap-3 shadow-sm">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block text-red-400">Error al sincronizar</span>
            <span className="text-sm">{syncError}</span>
          </div>
        </div>
      )}

      {pendingSync && !syncError && (
        <div className="mb-6 p-4 bg-amber-900/40 border-l-4 border-amber-500 text-amber-300 rounded-r-xl flex items-center justify-between gap-4 shadow-sm">
          <div>
            <span className="font-bold block text-amber-400">Cambios sin sincronizar</span>
            <span className="text-sm">{isOnline ? 'Listo para enviar.' : 'Se enviarán al recuperar la señal.'}</span>
          </div>
          {isOnline && (
            <button
              onClick={() => syncInventory(inventory, categories)}
              disabled={isSyncing}
              className="flex items-center px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-lg transition-colors active:scale-95 shadow-md shrink-0 disabled:opacity-50"
            >
              {isSyncing ? (
                <><svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg> Enviando...</>
              ) : (
                <><Save className="w-4 h-4 mr-2" /> Guardar Ahora</>
              )}
            </button>
          )}
        </div>
      )}

      <div className="mb-8 p-4 bg-slate-900/50 rounded-xl border border-slate-700 flex flex-col sm:flex-row gap-3">
        <input 
          type="text" 
          value={newCatName}
          onChange={e => setNewCatName(e.target.value)}
          placeholder="Nueva categoría (ej. camisas)"
          className="flex-1 bg-slate-800 border border-slate-600 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-teal-500 outline-none"
          onKeyDown={(e) => e.key === 'Enter' && addCategory()}
        />
        <button 
          onClick={addCategory}
          className="bg-teal-500 hover:bg-teal-400 text-slate-900 px-6 py-2 rounded-lg font-bold flex items-center justify-center transition-colors"
        >
          <PlusCircle className="w-5 h-5 mr-2" /> Añadir
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {categories.map((cat) => (
          <div key={cat} className="p-5 rounded-2xl border border-slate-700 bg-slate-900/80 shadow-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-200 capitalize">{cat}</h3>
              <button 
                onClick={() => removeCategory(cat)}
                className="text-red-400 hover:text-red-300 p-2 rounded-lg hover:bg-red-400/10 transition-colors"
                title="Eliminar categoría"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between bg-slate-800 rounded-xl p-2 border border-slate-700">
                <div className="flex gap-1">
                  <button onClick={() => handleIncrement(cat, -10)} className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center bg-slate-700 rounded-lg font-bold text-red-400 hover:bg-slate-600 transition-colors">-10</button>
                  <button onClick={() => handleIncrement(cat, -1)} className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center bg-slate-700 rounded-lg font-bold text-red-400 hover:bg-slate-600 transition-colors"><Minus className="w-5 h-5"/></button>
                </div>

                <input
                  type="number"
                  min="0"
                  value={inventory[cat] || 0}
                  onChange={(e) => handleChange(cat, e.target.value)}
                  className="w-20 md:w-24 text-2xl md:text-3xl font-black tabular-nums text-center bg-transparent text-white outline-none focus:ring-2 focus:ring-teal-500 rounded-lg"
                />

                <div className="flex gap-1">
                  <button onClick={() => handleIncrement(cat, 1)} className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center bg-slate-700 rounded-lg font-bold text-emerald-400 hover:bg-slate-600 transition-colors"><Plus className="w-5 h-5"/></button>
                  <button onClick={() => handleIncrement(cat, 10)} className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center bg-slate-700 rounded-lg font-bold text-emerald-400 hover:bg-slate-600 transition-colors">+10</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isOnline && (
        <div className="mt-8 pt-5 border-t border-slate-700">
          <button
            onClick={() => syncInventory(inventory, categories)}
            disabled={isSyncing || (!pendingSync && !!lastSynced)}
            className="w-full flex items-center justify-center gap-2 py-4 bg-teal-500 hover:bg-teal-400 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-default text-slate-900 font-bold rounded-xl transition-all active:scale-95 shadow-md"
          >
            {isSyncing ? (
              <><svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg> Guardando en central AVCOR...</>
            ) : (!pendingSync && lastSynced) ? (
              <><CheckCircle2 className="w-5 h-5 text-emerald-500" /> Todo guardado</>
            ) : (
              <><Save className="w-5 h-5" /> Guardar Inventario</>
            )}
          </button>
        </div>
      )}

      <DialogModal {...dialogProps} />
    </div>
  );
}
