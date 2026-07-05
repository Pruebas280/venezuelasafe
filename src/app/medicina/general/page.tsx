'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { LogOut, Pill, Search, ShieldPlus, BarChart3, Trash2 } from 'lucide-react';
import { useDialog } from '@/hooks/useDialog';
import DialogModal from '@/components/DialogModal';

type ZonaMedicina = {
  id: string;
  nombre_zona: string;
  total: number;
};

type RegistroMedicina = {
  id: string;
  zona_id: string;
  nombre_medicina: string;
  cantidad: number;
  created_at: string;
  zonas?: { nombre_zona: string };
};

export default function MedicinaGeneralPage() {
  const router = useRouter();
  const supabase = createClient();
  const { dialogProps } = useDialog();

  const [zonas, setZonas] = useState<ZonaMedicina[]>([]);
  const [registros, setRegistros] = useState<RegistroMedicina[]>([]);
  const [filtro, setFiltro] = useState('');
  const [loading, setLoading] = useState(true);

  const totalGlobal = zonas.reduce((sum, z) => sum + z.total, 0);

  useEffect(() => {
    const fetchData = async () => {
      // Todas las zonas con su inventario de medicamentos
      const { data: zonasData } = await supabase
        .from('zonas')
        .select('id, nombre_zona, inventario!inner(cantidad_disponible, tipo)')
        .eq('inventario.tipo', 'medicamentos');

      if (zonasData) {
        const parsed: ZonaMedicina[] = zonasData.map((z: any) => ({
          id: z.id,
          nombre_zona: z.nombre_zona,
          total: z.inventario?.[0]?.cantidad_disponible ?? 0,
        }));
        setZonas(parsed);
      }

      // Todos los registros de clasificación con nombre de zona
      const { data: regsData } = await supabase
        .from('clasificacion_medicinas')
        .select('*, zonas(nombre_zona)')
        .order('created_at', { ascending: false });

      if (regsData) setRegistros(regsData as RegistroMedicina[]);
      setLoading(false);
    };

    fetchData();

    const channel = supabase.channel('medicina-general')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clasificacion_medicinas' }, () => {
        fetchData();
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  const vaciarHistorialGlobal = async () => {
    const ok = await dialogProps.showDanger?.('Vaciar Todo el Historial', '¿Seguro que quieres eliminar TODO el historial de clasificación de medicinas de todas las zonas? (Esto NO altera la cantidad actual del inventario).', 'Sí, vaciar');
    if (!ok) return;
    const { error } = await supabase.from('clasificacion_medicinas').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    // Error silently handled or UI reloads via channel
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const tiempoRelativo = (d: string) => {
    const diff = (Date.now() - new Date(d).getTime()) / 1000;
    if (diff < 60) return 'Hace un momento';
    if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`;
    return `Hace ${Math.floor(diff / 86400)} días`;
  };

  const registrosFiltrados = registros.filter(r =>
    r.nombre_medicina.toLowerCase().includes(filtro.toLowerCase()) ||
    (r.zonas?.nombre_zona ?? '').toLowerCase().includes(filtro.toLowerCase())
  );

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
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-500/20 rounded-full flex items-center justify-center">
              <ShieldPlus className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400 leading-none">Coordinador General Médico</div>
              <div className="text-xs text-slate-400">Todas las zonas — Solo lectura</div>
            </div>
          </div>
          <button onClick={handleSignOut} className="flex items-center gap-2 text-sm text-slate-300 hover:text-white bg-slate-800 px-4 py-2 rounded-lg border border-slate-700">
            <LogOut className="w-4 h-4" /> Salir
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Total Global */}
        <div className="bg-gradient-to-br from-emerald-900/40 to-teal-900/20 border border-emerald-500/30 rounded-3xl p-8 mb-8 flex flex-col md:flex-row md:items-center gap-6">
          <div className="w-20 h-20 bg-emerald-500/20 rounded-2xl flex items-center justify-center shrink-0">
            <Pill className="w-10 h-10 text-emerald-400" />
          </div>
          <div>
            <p className="text-emerald-400 text-sm font-bold uppercase tracking-widest">Total Global de Medicamentos</p>
            <p className="text-6xl font-black text-white">{totalGlobal.toLocaleString()}</p>
            <p className="text-slate-400 text-sm mt-1">Suma de {zonas.length} zonas</p>
          </div>
        </div>

        {/* Cards por Zona */}
        <div className="mb-10">
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
            <BarChart3 className="w-6 h-6 mr-2 text-emerald-400" /> Inventario por Zona
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {zonas.map(z => {
              const pct = totalGlobal > 0 ? Math.round((z.total / totalGlobal) * 100) : 0;
              return (
                <div key={z.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-5 hover:border-emerald-500/40 transition-colors">
                  <p className="text-slate-400 text-xs font-bold uppercase mb-2 truncate">{z.nombre_zona}</p>
                  <p className="text-4xl font-black text-white mb-3">{z.total.toLocaleString()}</p>
                  <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                    <div className="bg-emerald-500 h-2 rounded-full transition-all duration-700" style={{ width: `${pct}%` }}></div>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 text-right">{pct}% del total</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Historial Global con Búsqueda */}
        <div>
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-3 border-b border-slate-700/50 pb-3">
            <h2 className="text-2xl font-bold text-white flex items-center">
              Clasificaciones Registradas
            </h2>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar medicina o zona..."
                  value={filtro}
                  onChange={e => setFiltro(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-white rounded-xl pl-9 pr-4 py-2 focus:ring-2 focus:ring-emerald-500 outline-none w-full sm:w-64"
                />
              </div>
              <button onClick={vaciarHistorialGlobal} className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-4 py-2 rounded-xl flex items-center transition-colors h-[42px]">
                <Trash2 className="w-4 h-4 mr-2" /> Vaciar Historial
              </button>
            </div>
          </div>

          {registrosFiltrados.length === 0 ? (
            <div className="text-center py-16 bg-slate-800/30 rounded-3xl border border-slate-700/30 text-slate-500">
              {filtro ? 'No hay resultados para tu búsqueda.' : 'No hay clasificaciones registradas aún.'}
            </div>
          ) : (
            <div className="bg-slate-800 border border-slate-700 rounded-3xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700 bg-slate-900/50">
                      <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider py-4 px-6">Medicamento</th>
                      <th className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider py-4 px-4">Zona</th>
                      <th className="text-right text-xs font-bold text-slate-400 uppercase tracking-wider py-4 px-4">Cantidad</th>
                      <th className="text-right text-xs font-bold text-slate-400 uppercase tracking-wider py-4 px-6">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {registrosFiltrados.map(reg => (
                      <tr key={reg.id} className="hover:bg-slate-700/20 transition-colors">
                        <td className="py-4 px-6 font-semibold text-white capitalize">{reg.nombre_medicina}</td>
                        <td className="py-4 px-4">
                          <span className="bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full text-xs font-bold">
                            {reg.zonas?.nombre_zona ?? '—'}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right font-black text-emerald-400 text-lg">+{reg.cantidad}</td>
                        <td className="py-4 px-6 text-right text-slate-400 text-sm">{tiempoRelativo(reg.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
