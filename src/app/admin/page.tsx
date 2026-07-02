'use client';
import { useState, useEffect, useCallback } from 'react';
import { LayoutDashboard, Megaphone, ShieldCheck, Activity, LogOut, RefreshCw, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useDialog } from '@/hooks/useDialog';
import DialogModal from '@/components/DialogModal';

type Zona = {
  id: string;
  nombre_zona: string;
  estado: 'estable' | 'alerta' | 'crítico';
  inventario: {
    tipo: string;
    cantidad_disponible: number;
  }[];
};

type Reporte = {
  id: string;
  tipo: string;
  descripcion: string;
  numero_telefono: string;
  estado_reporte: string;
  created_at: string;
  zona_id: string;
  zonas: { nombre_zona: string } | null;
};

type Anuncio = {
  id: string;
  titulo: string;
  contenido: string;
  etiqueta: string;
  created_at: string;
};

export default function AdminDashboard() {
  const [zones, setZones] = useState<Zona[]>([]);
  const [reports, setReports] = useState<Reporte[]>([]);
  const [anuncios, setAnuncios] = useState<Anuncio[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estado para el formulario de anuncios
  const [nuevoAnuncio, setNuevoAnuncio] = useState({ titulo: '', contenido: '', etiqueta: 'Comunicado Oficial' });
  const [enviandoAnuncio, setEnviandoAnuncio] = useState(false);

  const router = useRouter();
  const supabase = createClient();
  const { dialogProps, showAlert, showDanger } = useDialog();

  const fetchData = useCallback(async () => {
    setLoading(true);
    // Cargar zonas con inventario
    const { data: zonasData } = await supabase
      .from('zonas')
      .select('id, nombre_zona, estado, inventario(tipo, cantidad_disponible)')
      .order('nombre_zona');

    // Cargar reportes con nombre de zona
    const { data: reportesData } = await supabase
      .from('reportes_ciudadanos')
      .select('*, zonas(nombre_zona)')
      .order('created_at', { ascending: false })
      .limit(20);

    // Cargar anuncios
    const { data: anunciosData } = await supabase
      .from('anuncios_oficiales')
      .select('*')
      .order('created_at', { ascending: false });

    if (zonasData) setZones(zonasData as Zona[]);
    if (reportesData) setReports(reportesData as Reporte[]);
    if (anunciosData) setAnuncios(anunciosData as Anuncio[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const eliminarReporte = async (reporteId: string) => {
    const ok = await showDanger('Eliminar reporte', '¿Seguro que deseas eliminar este reporte de forma permanente?', 'Sí, eliminar');
    if (!ok) return;
    const { error } = await supabase.from('reportes_ciudadanos').delete().eq('id', reporteId);
    if (error) {
      await showAlert('Error al eliminar', error.message);
    } else {
      fetchData();
    }
  };

  const actualizarEstadoZona = async (zonaId: string, nuevoEstado: string) => {
    const { error } = await supabase.from('zonas').update({ estado: nuevoEstado }).eq('id', zonaId);
    if (error) {
      await showAlert('Error al actualizar zona', error.message);
    } else {
      fetchData();
    }
  };

  const publicarAnuncio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoAnuncio.titulo || !nuevoAnuncio.contenido) return;
    setEnviandoAnuncio(true);
    const { error } = await supabase.from('anuncios_oficiales').insert({
      titulo: nuevoAnuncio.titulo,
      contenido: nuevoAnuncio.contenido,
      etiqueta: nuevoAnuncio.etiqueta
    });
    if (error) {
      await showAlert('Error al publicar', 'No se pudo publicar el anuncio: ' + error.message);
    } else {
      setNuevoAnuncio({ titulo: '', contenido: '', etiqueta: 'Comunicado Oficial' });
      fetchData();
    }
    setEnviandoAnuncio(false);
  };

  const eliminarAnuncio = async (anuncioId: string) => {
    const ok = await showDanger('Eliminar anuncio', '¿Eliminar este anuncio de todos los portales? Esta acción es permanente.', 'Sí, eliminar');
    if (!ok) return;
    const { error } = await supabase.from('anuncios_oficiales').delete().eq('id', anuncioId);
    if (error) {
      await showAlert('Error al eliminar anuncio', error.message);
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
    <>
      <div className="min-h-screen bg-slate-900 pb-20 text-slate-50 selection:bg-teal-500 selection:text-white">
      <nav className="bg-slate-900/50 backdrop-blur-md border-b border-slate-800 shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <ShieldCheck className="text-teal-400 w-8 h-8" />
            <span className="font-bold text-xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-400">AVCOR Súper Admin</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm font-bold text-teal-400 hover:text-teal-300 hidden sm:block mr-2">
              Ver Portal Público
            </Link>
            <button onClick={fetchData} className="p-2 text-slate-400 hover:text-white transition-colors" title="Recargar datos">
              <RefreshCw className="w-5 h-5" />
            </button>
            <button onClick={handleSignOut} className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors bg-slate-800 px-4 py-2 rounded-lg border border-slate-700">
              <LogOut className="w-4 h-4" /> Salir
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <h1 className="text-3xl font-bold text-white flex items-center">
            <LayoutDashboard className="mr-3 text-teal-400 w-8 h-8" /> Matriz de Zonas
          </h1>
        </div>

        {/* Matriz de Zonas */}
        {loading && zones.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-slate-800 rounded-2xl shadow-sm border border-slate-700 p-5 animate-pulse">
                <div className="h-6 bg-slate-700 rounded mb-4 w-2/3"></div>
                <div className="grid grid-cols-2 gap-4">
                  {[...Array(4)].map((_, j) => <div key={j} className="h-20 bg-slate-700/50 rounded-xl"></div>)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {zones.map(zona => (
              <div key={zona.id} className="bg-slate-800 rounded-2xl shadow-xl border border-slate-700 overflow-hidden hover:border-teal-500/50 transition-all duration-300 hover:-translate-y-1">
                <div className={`px-5 py-4 border-b border-slate-700 flex justify-between items-center ${
                  zona.estado === 'crítico' ? 'bg-red-900/30 border-red-900/50' :
                  zona.estado === 'alerta' ? 'bg-amber-900/30 border-amber-900/50' : 'bg-slate-800/80'
                }`}>
                  <h2 className="text-xl font-bold text-white">{zona.nombre_zona}</h2>
                  <select
                    value={zona.estado}
                    onChange={e => actualizarEstadoZona(zona.id, e.target.value)}
                    className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border outline-none cursor-pointer transition-all ${
                      zona.estado === 'crítico'
                        ? 'bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30'
                        : zona.estado === 'alerta'
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30'
                    }`}
                  >
                    <option value="estable">✅ Estable</option>
                    <option value="alerta">⚠️ Alerta</option>
                    <option value="crítico">🔴 Crítico</option>
                  </select>
                </div>
                <div className="p-5 grid grid-cols-2 gap-4">
                  {zona.inventario && zona.inventario.length > 0 ? (
                    zona.inventario.map(item => (
                      <div key={item.tipo} className="bg-slate-900/50 rounded-xl p-4 text-center border border-slate-700">
                        <div className="text-slate-400 text-xs font-bold uppercase mb-1 truncate px-1" title={item.tipo}>{item.tipo}</div>
                        <div className="text-3xl font-black text-white">{item.cantidad_disponible}</div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 text-center py-4 text-slate-500 text-sm">
                      Sin recursos en inventario.
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Parte inferior */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Reportes */}
          <div className="lg:col-span-2 bg-slate-800 rounded-2xl shadow-xl border border-slate-700 p-6">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center">
              <Activity className="mr-2 text-teal-400" /> Reportes Ciudadanos
            </h2>
            {loading && reports.length === 0 ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-slate-700 rounded-xl animate-pulse"></div>)}
              </div>
            ) : reports.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No hay reportes aún.</p>
            ) : (
              <div className="space-y-4">
                {reports.map(r => (
                  <div key={r.id} className="p-4 rounded-xl border border-slate-700 bg-slate-900/50 flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:border-slate-500 transition-colors">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${r.tipo === 'alerta_daño' ? 'bg-red-500/20 text-red-400' : 'bg-teal-500/20 text-teal-400'}`}>
                          {r.tipo === 'alerta_daño' ? 'Alerta' : 'Donación'}
                        </span>
                        <span className="font-semibold text-slate-300">{r.zonas?.nombre_zona ?? 'Zona desconocida'}</span>
                        <span className="text-xs text-slate-500">{tiempoRelativo(r.created_at)}</span>
                      </div>
                      <p className="text-white font-medium">{r.descripcion}</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <a href={`tel:${r.numero_telefono}`} className="bg-slate-800 px-4 py-2 rounded-lg border border-slate-700 shadow-sm flex items-center font-mono font-bold text-teal-400 whitespace-nowrap hover:bg-slate-700 transition-colors">
                        📞 {r.numero_telefono}
                      </a>
                      <button onClick={() => eliminarReporte(r.id)} className="bg-red-500/10 text-red-400 border border-red-500/30 px-4 py-2 rounded-lg shadow-sm flex items-center justify-center font-bold whitespace-nowrap hover:bg-red-500/20 transition-colors">
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Anuncios Oficiales Editor */}
          <div className="bg-slate-800 rounded-2xl shadow-xl border border-slate-700 p-6 flex flex-col h-[800px]">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center shrink-0">
              <Megaphone className="mr-2 text-emerald-400" /> Portal de Noticias
            </h2>
            
            {/* Formulario */}
            <form onSubmit={publicarAnuncio} className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 mb-6 shrink-0">
              <h3 className="text-sm font-bold text-slate-300 mb-3">Redactar Comunicado</h3>
              
              <div className="space-y-3">
                <input
                  type="text"
                  required
                  placeholder="Título del anuncio..."
                  value={nuevoAnuncio.titulo}
                  onChange={e => setNuevoAnuncio({...nuevoAnuncio, titulo: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                />
                
                <select
                  value={nuevoAnuncio.etiqueta}
                  onChange={e => setNuevoAnuncio({...nuevoAnuncio, etiqueta: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                >
                  <option value="Comunicado Oficial">Comunicado Oficial</option>
                  <option value="Alerta Importante">Alerta Importante</option>
                  <option value="Llamado a la Comunidad">Llamado a la Comunidad</option>
                </select>

                <textarea
                  required
                  rows={3}
                  placeholder="Contenido del mensaje..."
                  value={nuevoAnuncio.contenido}
                  onChange={e => setNuevoAnuncio({...nuevoAnuncio, contenido: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none resize-none"
                ></textarea>
                
                <button
                  type="submit"
                  disabled={enviandoAnuncio}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold py-2 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50"
                >
                  {enviandoAnuncio ? 'Publicando...' : <><Plus className="w-4 h-4 mr-1" /> Publicar Anuncio</>}
                </button>
              </div>
            </form>

            {/* Lista de Anuncios */}
            <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
              <h3 className="text-sm font-bold text-slate-400 sticky top-0 bg-slate-800 py-1">Anuncios Activos</h3>
              {loading && anuncios.length === 0 ? (
                <div className="animate-pulse space-y-3">
                  {[...Array(2)].map((_, i) => <div key={i} className="h-24 bg-slate-700/50 rounded-xl"></div>)}
                </div>
              ) : anuncios.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">No hay anuncios publicados.</p>
              ) : (
                anuncios.map(anuncio => (
                  <div key={anuncio.id} className="p-4 rounded-xl border border-slate-700 bg-slate-900/30 group">
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        anuncio.etiqueta.includes('Alerta') ? 'bg-red-500/20 text-red-400' : 'bg-teal-500/20 text-teal-400'
                      }`}>
                        {anuncio.etiqueta}
                      </span>
                      <button 
                        onClick={() => eliminarAnuncio(anuncio.id)}
                        className="text-slate-500 hover:text-red-400 transition-colors p-1 opacity-0 group-hover:opacity-100"
                        title="Eliminar anuncio"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <h4 className="font-bold text-white text-sm mb-1">{anuncio.titulo}</h4>
                    <p className="text-slate-400 text-xs mb-2 line-clamp-3">{anuncio.contenido}</p>
                    <div className="text-[10px] text-slate-500">{tiempoRelativo(anuncio.created_at)}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      </div>
      <DialogModal {...dialogProps} />
    </>
  );
}
