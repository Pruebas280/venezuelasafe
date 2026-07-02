'use client';
import { use, useState, useEffect, useCallback } from 'react';
import { ShieldCheck, MapPin, PhoneCall, LogOut, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import GestorInventarioZona from '@/components/GestorInventarioZona';
import { useDialog } from '@/hooks/useDialog';
import DialogModal from '@/components/DialogModal';

type Reporte = {
  id: string;
  tipo: string;
  descripcion: string;
  numero_telefono: string;
  estado_reporte: string;
  created_at: string;
};

type Zona = {
  id: string;
  nombre_zona: string;
  estado: string;
};

export default function ZonaDashboard({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const zonaId = resolvedParams.id;

  const [zona, setZona] = useState<Zona | null>(null);
  const [reports, setReports] = useState<Reporte[]>([]);
  const [anuncios, setAnuncios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();
  const { dialogProps, showAlert, showDanger } = useDialog();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    // Cargar info de la zona
    const { data: zonaData } = await supabase
      .from('zonas')
      .select('id, nombre_zona, estado')
      .eq('id', zonaId)
      .single();

    // Cargar reportes filtrados por zona
    const { data: reportesData, error } = await supabase
      .from('reportes_ciudadanos')
      .select('id, tipo, descripcion, numero_telefono, estado_reporte, created_at')
      .eq('zona_id', zonaId)
      .order('created_at', { ascending: false });

    // Cargar anuncios oficiales
    const { data: anunciosData } = await supabase
      .from('anuncios_oficiales')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setFetchError(error.message);
    } else if (reportesData) {
      setReports(reportesData);
    }
    
    if (anunciosData) setAnuncios(anunciosData);
    if (zonaData) setZona(zonaData);
    setLoading(false);
  }, [zonaId, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const marcarAtendido = async (reporteId: string) => {
    await supabase
      .from('reportes_ciudadanos')
      .update({ estado_reporte: 'atendido' })
      .eq('id', reporteId);
    fetchData();
  };

  const eliminarReporte = async (reporteId: string) => {
    const ok = await showDanger('Eliminar reporte', '¿Seguro que deseas eliminar este reporte? Esta acción es permanente.', 'Sí, eliminar');
    if (!ok) return;
    const { error } = await supabase.from('reportes_ciudadanos').delete().eq('id', reporteId);
    if (error) {
      await showAlert('Error al eliminar', error.message);
    } else {
      fetchData();
    }
  };

  const tiempoRelativo = (dateStr: string) => {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return 'Hace un momento';
    if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} horas`;
    return `Hace ${Math.floor(diff / 86400)} días`;
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 pb-20 selection:bg-teal-500 selection:text-white">
      <nav className="bg-slate-900/50 backdrop-blur-md border-b border-slate-800 shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <ShieldCheck className="text-teal-400 w-8 h-8" />
            <span className="font-bold text-xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-400">
              {zona ? zona.nombre_zona : 'Cargando...'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchData} className="p-2 text-slate-400 hover:text-white transition-colors" title="Recargar">
              <RefreshCw className="w-5 h-5" />
            </button>
            <button onClick={handleSignOut} className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors bg-slate-800 px-4 py-2 rounded-lg border border-slate-700">
              <LogOut className="w-4 h-4" /> Salir
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center">
            <MapPin className="mr-3 text-teal-400 w-8 h-8" />
            {zona ? `${zona.nombre_zona} — Panel Operativo` : 'Cargando zona...'}
          </h1>
          <p className="text-slate-400 mt-2">
            Gestiona el inventario táctilmente. Los cambios se guardan localmente si no hay red.
          </p>
        </div>

        {/* Gestor de Inventario Offline-First */}
        <div className="mb-12">
          <GestorInventarioZona zonaId={zonaId} />
        </div>

        {/* Anuncios Oficiales */}
        <div className="mb-12 max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center border-b border-slate-700 pb-4">
            <ShieldCheck className="text-emerald-400 mr-2" /> Anuncios Oficiales de Matriz
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {anuncios.map(anuncio => (
              <div key={anuncio.id} className="bg-slate-800/80 backdrop-blur-sm border border-slate-700/80 rounded-2xl p-5 hover:border-emerald-500/30 transition-colors shadow-lg">
                <div className={`text-xs font-bold uppercase tracking-wider mb-2 inline-block px-2 py-0.5 rounded-full ${anuncio.etiqueta.includes('Alerta') ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                  {anuncio.etiqueta}
                </div>
                <h3 className="text-lg font-bold text-white mb-2 leading-tight">{anuncio.titulo}</h3>
                <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{anuncio.contenido}</p>
                <div className="text-[10px] text-slate-500 mt-3">{tiempoRelativo(anuncio.created_at)}</div>
              </div>
            ))}
            {anuncios.length === 0 && (
              <div className="col-span-1 md:col-span-2 text-center py-8 text-slate-500 bg-slate-800/30 rounded-2xl border border-slate-700/30">
                No hay comunicados oficiales por el momento.
              </div>
            )}
          </div>
        </div>

        {/* Reportes ciudadanos de la zona */}
        <div className="bg-slate-800 rounded-2xl shadow-xl border border-slate-700 p-6 md:p-8 max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
            <h2 className="text-2xl font-bold text-white">Alertas Ciudadanas</h2>
            <span className="bg-teal-500/20 text-teal-400 text-sm font-bold px-3 py-1 rounded-full border border-teal-500/30">
              {reports.filter(r => r.estado_reporte === 'pendiente').length} pendientes
            </span>
          </div>

          {fetchError && (
            <div className="mb-6 p-4 bg-red-900/40 border border-red-500 text-red-300 rounded-xl">
              <span className="font-bold block text-red-400">Error al cargar reportes:</span>
              <span className="text-sm font-mono mt-1 block">{fetchError}</span>
            </div>
          )}

          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 bg-slate-700 rounded-2xl animate-pulse"></div>
              ))}
            </div>
          ) : reports.length === 0 ? (
            <p className="text-slate-400 text-center py-12">No hay reportes para esta zona aún.</p>
          ) : (
            <div className="space-y-4">
              {reports.map(r => (
                <div key={r.id} className={`p-5 rounded-2xl border transition-all ${
                  r.estado_reporte === 'atendido'
                    ? 'bg-slate-900/50 border-slate-800 opacity-60'
                    : 'bg-slate-900 border-slate-700 hover:border-teal-500/50 shadow-md'
                }`}>
                  <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-3 mb-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                          r.tipo === 'alerta_daño' ? 'bg-red-500/20 text-red-400' : 'bg-teal-500/20 text-teal-400'
                        }`}>
                          {r.tipo === 'alerta_daño' ? 'Alerta' : 'Donación'}
                        </span>
                        <span className="text-sm text-slate-400">{tiempoRelativo(r.created_at)}</span>
                        {r.estado_reporte === 'atendido' && (
                          <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" /> Atendido
                          </span>
                        )}
                      </div>
                      <p className="text-white text-lg font-medium">{r.descripcion}</p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                      <a
                        href={`tel:${r.numero_telefono}`}
                        className="flex items-center justify-center bg-slate-800 border border-slate-600 text-teal-400 px-5 py-3 rounded-xl font-black font-mono shadow-sm hover:bg-slate-700 active:scale-95 transition-all whitespace-nowrap"
                      >
                        <PhoneCall className="w-5 h-5 mr-2" />
                        {r.numero_telefono}
                      </a>

                      {r.estado_reporte === 'pendiente' && (
                        <button
                          onClick={() => marcarAtendido(r.id)}
                          className="flex items-center justify-center bg-emerald-500 hover:bg-emerald-400 text-slate-900 px-4 py-3 rounded-xl font-bold active:scale-95 transition-all whitespace-nowrap"
                        >
                          <CheckCircle2 className="w-5 h-5 mr-2" /> Marcar Atendido
                        </button>
                      )}

                      <button
                        onClick={() => eliminarReporte(r.id)}
                        className="flex items-center justify-center bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 px-4 py-3 rounded-xl font-bold active:scale-95 transition-all whitespace-nowrap"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <DialogModal {...dialogProps} />
    </div>
  );
}
