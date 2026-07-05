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
  const [necesidadesRefugios, setNecesidadesRefugios] = useState<any[]>([]);
  const router = useRouter();
  const supabase = createClient();
  const { dialogProps, showAlert, showDanger } = useDialog();

  useEffect(() => {
    if (!zonaId) return;
    
    // Auth check
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/login');
        return;
      }
      if (user.app_metadata?.role !== 'zone_leader' && user.app_metadata?.role !== 'super_admin') {
        router.push('/');
      }
    });

    const fetchData = async () => {
      setLoading(true);
      // Cargar info de la zona
      const { data: zonaData } = await supabase
        .from('zonas')
        .select('id, nombre_zona, estado')
        .eq('id', zonaId)
        .single();
      if (zonaData) setZona(zonaData);

      // Cargar reportes
      const { data: reportesData, error: reportesError } = await supabase
        .from('reportes_ciudadanos')
        .select('id, tipo, descripcion, numero_telefono, estado_reporte, created_at')
        .eq('zona_id', zonaId)
        .order('created_at', { ascending: false });
      if (reportesData) setReports(reportesData);
      if (reportesError) setFetchError(reportesError.message);
      
      // Cargar anuncios oficiales
      const { data: anunciosData } = await supabase
        .from('anuncios_oficiales')
        .select('*')
        .order('created_at', { ascending: false });
      if (anunciosData) setAnuncios(anunciosData);

      // Necesidades de Refugios
      const { data: necData } = await supabase.from('necesidades_refugio')
        .select('*, centros_refugio(nombre)')
        .eq('estado', 'pendiente')
        .order('created_at', { ascending: false });
      if (necData) setNecesidadesRefugios(necData);
      
      setLoading(false);
    };

    fetchData();

    // Suscripciones
    const reportesChannel = supabase
      .channel('public:reportes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reportes_ciudadanos', filter: `zona_id=eq.${zonaId}` }, () => {
        fetchData();
      })
      .subscribe();
      
    const necesidadesChannel = supabase
      .channel('public:necesidades')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'necesidades_refugio' }, () => {
        supabase.from('necesidades_refugio')
          .select('*, centros_refugio(nombre)')
          .eq('estado', 'pendiente')
          .order('created_at', { ascending: false })
          .then(({ data }) => {
            if (data) setNecesidadesRefugios(data);
          });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(reportesChannel);
      supabase.removeChannel(necesidadesChannel);
    };
  }, [zonaId, router, supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const marcarAtendido = async (reporteId: string) => {
    await supabase
      .from('reportes_ciudadanos')
      .update({ estado_reporte: 'atendido' })
      .eq('id', reporteId);
  };

  const eliminarReporte = async (reporteId: string) => {
    const ok = await showDanger('Eliminar reporte', '¿Seguro que deseas eliminar este reporte? Esta acción es permanente.', 'Sí, eliminar');
    if (!ok) return;
    const { error } = await supabase.from('reportes_ciudadanos').delete().eq('id', reporteId);
    if (error) {
      await showAlert('Error al eliminar', error.message);
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
          <div className="flex items-center space-x-3">
            <img src="/logo.jpg" alt="AVCOR Logo" className="w-8 h-8 rounded-full shadow-lg border border-teal-500/30" />
            <ShieldCheck className="text-teal-400 w-6 h-6" />
            <span className="font-bold text-xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-400">
              {zona ? zona.nombre_zona : 'Cargando...'}
            </span>
          </div>
          <div className="flex items-center gap-3">
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
        </div>

        <div className="mb-12">
          <GestorInventarioZona zonaId={zonaId} />
        </div>

        <div className="mb-12 max-w-7xl mx-auto">
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-slate-800 rounded-2xl shadow-xl border border-slate-700 p-6">
              <div className="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
                <h2 className="text-2xl font-bold text-white">Alertas Ciudadanas</h2>
                <span className="bg-teal-500/20 text-teal-400 text-sm font-bold px-3 py-1 rounded-full border border-teal-500/30">
                  {reports.filter(r => r.estado_reporte === 'pendiente').length} pendientes
                </span>
              </div>
              {loading ? (
                <div className="space-y-4 animate-pulse">
                  {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-slate-700 rounded-2xl"></div>)}
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
                            href={`https://wa.me/${r.numero_telefono.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer"
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

          <div className="bg-slate-800/80 backdrop-blur border border-slate-700/50 rounded-3xl p-6 shadow-xl">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center">
              <span className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mr-3">🏠</span>
              Necesidades de Refugios
            </h2>
            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              {necesidadesRefugios.length === 0 ? (
                <div className="text-center py-10 bg-slate-900/50 rounded-2xl border border-slate-800 border-dashed">
                  <p className="text-slate-500">No hay solicitudes activas.</p>
                </div>
              ) : (
                necesidadesRefugios.map(req => {
                  const progress = Math.min(100, Math.round((req.cantidad_asignada / req.cantidad_solicitada) * 100));
                  return (
                    <div key={req.id} className="bg-slate-900 p-5 rounded-2xl border border-slate-700">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-white font-bold capitalize text-lg">{req.categoria}</h4>
                        <span className="text-xs bg-slate-800 text-amber-400 px-3 py-1 rounded-full border border-amber-500/30">
                          {req.centros_refugio?.nombre}
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${progress}%` }}></div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
      <DialogModal {...dialogProps} />
    </div>
  );
}
