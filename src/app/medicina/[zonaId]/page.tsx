'use client';

import { useState, useEffect, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { LogOut, Plus, Trash2, Pill, CheckCircle2, AlertCircle, ShieldPlus } from 'lucide-react';
import { useDialog } from '@/hooks/useDialog';
import DialogModal from '@/components/DialogModal';

type ClasificacionItem = { nombre: string; cantidad: number };
type RegistroMedicina = {
  id: string;
  nombre_medicina: string;
  cantidad: number;
  created_at: string;
};

export default function MedicinaZonaPage({ params }: { params: Promise<{ zonaId: string }> }) {
  const { zonaId } = use(params);
  const router = useRouter();
  const supabase = createClient();
  const { dialogProps, showAlert, showDanger } = useDialog();

  const [zonaNombre, setZonaNombre] = useState('');
  const [totalMedicamentos, setTotalMedicamentos] = useState(0);
  const [registros, setRegistros] = useState<RegistroMedicina[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Estado del lote de entrada
  const [items, setItems] = useState<ClasificacionItem[]>([{ nombre: '', cantidad: 0 }]);

  useEffect(() => {
    if (!zonaId) return;
    const fetchData = async () => {
      const { data: zona } = await supabase.from('zonas').select('nombre_zona').eq('id', zonaId).single();
      if (zona) setZonaNombre(zona.nombre_zona);

      const { data: inv } = await supabase.from('inventario').select('cantidad_disponible').eq('zona_id', zonaId).eq('tipo', 'medicamentos').single();
      if (inv) setTotalMedicamentos(inv.cantidad_disponible);

      const { data: regs } = await supabase.from('clasificacion_medicinas').select('*').eq('zona_id', zonaId).order('created_at', { ascending: false });
      if (regs) setRegistros(regs);

      setLoading(false);
    };

    fetchData();

    const channel = supabase.channel('medicina-zona')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clasificacion_medicinas', filter: `zona_id=eq.${zonaId}` }, () => {
        supabase.from('clasificacion_medicinas').select('*').eq('zona_id', zonaId).order('created_at', { ascending: false }).then(({ data }) => {
          if (data) setRegistros(data);
        });
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [zonaId, supabase]);

  const totalLote = items.reduce((sum, i) => sum + (i.cantidad || 0), 0);

  const addItem = () => setItems(prev => [...prev, { nombre: '', cantidad: 0 }]);
  const updateItem = (index: number, field: keyof ClasificacionItem, value: string | number) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };
  const removeItem = (index: number) => {
    if (items.length === 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const invalid = items.some(i => !i.nombre.trim() || i.cantidad <= 0);
    if (invalid) {
      await showAlert('Datos incompletos', 'Cada medicamento debe tener nombre y cantidad mayor a 0.');
      return;
    }
    if (totalLote === 0) {
      await showAlert('Sin medicamentos', 'Agrega al menos un medicamento al lote.');
      return;
    }

    setSubmitting(true);

    // 1. Registrar clasificaciones
    const rows = items.map(i => ({
      zona_id: zonaId,
      nombre_medicina: i.nombre.trim(),
      cantidad: i.cantidad,
    }));

    const { error: errClas } = await supabase.from('clasificacion_medicinas').insert(rows);
    if (errClas) {
      await showAlert('Error', errClas.message);
      setSubmitting(false);
      return;
    }

    // 2. Sumar al inventario de medicamentos
    const nuevoTotal = totalMedicamentos + totalLote;
    const { error: errInv } = await supabase.from('inventario')
      .upsert({ zona_id: zonaId, tipo: 'medicamentos', cantidad_disponible: nuevoTotal }, { onConflict: 'zona_id,tipo' });

    if (errInv) {
      await showAlert('Error al actualizar inventario', errInv.message);
    } else {
      setTotalMedicamentos(nuevoTotal);
      setItems([{ nombre: '', cantidad: 0 }]);
      await showAlert('¡Lote Registrado!', `Se registraron ${totalLote} unidades de medicamentos en el inventario.`);
    }

    setSubmitting(false);
  };

  const eliminarRegistro = async (id: string, cantidad: number) => {
    const ok = await showDanger('Eliminar registro', `¿Eliminar este registro? Esto también restará ${cantidad} unidades del inventario.`, 'Sí, eliminar');
    if (!ok) return;
    await supabase.from('clasificacion_medicinas').delete().eq('id', id);
    const nuevo = Math.max(0, totalMedicamentos - cantidad);
    await supabase.from('inventario').update({ cantidad_disponible: nuevo }).eq('zona_id', zonaId).eq('tipo', 'medicamentos');
    setTotalMedicamentos(nuevo);
  };

  const vaciarHistorialZonal = async () => {
    const ok = await showDanger('Vaciar Historial', '¿Estás seguro de que quieres eliminar todo el historial de clasificaciones de esta zona? (Esto NO altera la cantidad actual del inventario, solo borra el registro).', 'Sí, vaciar');
    if (!ok) return;
    const { error } = await supabase.from('clasificacion_medicinas').delete().eq('zona_id', zonaId);
    if (error) {
      await showAlert('Error', error.message);
    } else {
      await showAlert('Éxito', 'Historial vaciado correctamente.');
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const tiempoRelativo = (d: string) => {
    const diff = (Date.now() - new Date(d).getTime()) / 1000;
    if (diff < 60) return 'Hace un momento';
    if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} horas`;
    return `Hace ${Math.floor(diff / 86400)} días`;
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-emerald-400 animate-pulse font-bold text-xl">Cargando datos médicos...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 pb-20">
      <DialogModal {...dialogProps} />

      {/* NAV */}
      <nav className="bg-slate-900/50 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-500/20 rounded-full flex items-center justify-center">
              <ShieldPlus className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400 leading-none">Cadetes Médicos</div>
              <div className="text-xs text-slate-400">{zonaNombre}</div>
            </div>
          </div>
          <button onClick={handleSignOut} className="flex items-center gap-2 text-sm text-slate-300 hover:text-white bg-slate-800 px-4 py-2 rounded-lg border border-slate-700">
            <LogOut className="w-4 h-4" /> Salir
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Total */}
        <div className="bg-gradient-to-br from-emerald-900/40 to-teal-900/20 border border-emerald-500/30 rounded-3xl p-6 mb-8 flex items-center gap-6">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center shrink-0">
            <Pill className="w-8 h-8 text-emerald-400" />
          </div>
          <div>
            <p className="text-emerald-400 text-sm font-bold uppercase tracking-widest">Total Medicamentos en Zona</p>
            <p className="text-5xl font-black text-white">{totalMedicamentos.toLocaleString()}</p>
            <p className="text-slate-400 text-sm mt-1">{zonaNombre}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* FORMULARIO DE ENTRADA */}
          <div>
            <div className="bg-slate-800 border border-slate-700 rounded-3xl p-6">
              <h2 className="text-xl font-bold text-white mb-1">Registrar Entrada de Medicamentos</h2>
              <p className="text-slate-400 text-sm mb-6">Debes clasificar <strong>cada</strong> medicina por nombre y cantidad antes de registrar.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
                  {items.map((item, index) => (
                    <div key={index} className="flex gap-2 items-center bg-slate-900/50 p-3 rounded-xl border border-slate-700">
                      <div className="flex-1">
                        <input
                          required
                          type="text"
                          placeholder="Ej: Atamel 500mg"
                          value={item.nombre}
                          onChange={e => updateItem(index, 'nombre', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none mb-2"
                        />
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-slate-400 shrink-0">Cantidad:</label>
                          <input
                            required
                            type="number"
                            min="1"
                            value={item.cantidad || ''}
                            onChange={e => updateItem(index, 'cantidad', parseInt(e.target.value) || 0)}
                            className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                          />
                        </div>
                      </div>
                      {items.length > 1 && (
                        <button type="button" onClick={() => removeItem(index)} className="text-red-400 hover:text-red-300 p-2 shrink-0">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={addItem}
                  className="w-full border-2 border-dashed border-slate-600 hover:border-emerald-500/50 text-slate-400 hover:text-emerald-400 py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Agregar otro medicamento
                </button>

                {/* Resumen del lote */}
                <div className={`p-4 rounded-xl border ${totalLote > 0 ? 'bg-emerald-900/20 border-emerald-500/30' : 'bg-slate-900/30 border-slate-700'}`}>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm font-semibold">Total del lote:</span>
                    <span className={`text-2xl font-black ${totalLote > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>{totalLote} uds.</span>
                  </div>
                  {totalLote > 0 && (
                    <p className="text-xs text-emerald-400/70 mt-1">
                      ✓ {items.filter(i => i.nombre && i.cantidad > 0).length} tipo(s) clasificado(s)
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={submitting || totalLote === 0}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-black py-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  {submitting ? 'Registrando...' : <><CheckCircle2 className="w-5 h-5" /> Confirmar Entrada ({totalLote} uds.)</>}
                </button>
              </form>
            </div>
          </div>

          {/* HISTORIAL */}
          <div>
            <div className="flex justify-between items-center mb-4 border-b border-slate-700/50 pb-2">
              <h2 className="text-xl font-bold text-white">Historial de Clasificaciones</h2>
              <button onClick={vaciarHistorialZonal} className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg flex items-center transition-colors">
                <Trash2 className="w-3 h-3 mr-1" /> Vaciar Historial
              </button>
            </div>
            {registros.length === 0 ? (
              <div className="text-center py-16 bg-slate-800/30 rounded-3xl border border-slate-700/30">
                <AlertCircle className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-500">No hay registros aún para esta zona.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar pr-1">
                {registros.map(reg => (
                  <div key={reg.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-4 flex justify-between items-center hover:border-emerald-500/30 transition-colors">
                    <div>
                      <p className="font-bold text-white capitalize">{reg.nombre_medicina}</p>
                      <p className="text-sm text-slate-400">{tiempoRelativo(reg.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="bg-emerald-500/20 text-emerald-400 font-black px-3 py-1 rounded-full text-sm">+{reg.cantidad}</span>
                      <button onClick={() => eliminarRegistro(reg.id, reg.cantidad)} className="text-slate-500 hover:text-red-400 p-1 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
