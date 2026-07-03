'use client';
import { useState, useEffect, useCallback } from 'react';
import { LayoutDashboard, Megaphone, ShieldCheck, Activity, LogOut, RefreshCw, Plus, Trash2, UserCheck, Car, Home, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useDialog } from '@/hooks/useDialog';
import DialogModal from '@/components/DialogModal';

type Zona = {
  id: string; nombre_zona: string; estado: 'estable' | 'alerta' | 'crítico';
  inventario: { tipo: string; cantidad_disponible: number; }[];
};

type Reporte = {
  id: string; tipo: string; descripcion: string; numero_telefono: string;
  estado_reporte: string; created_at: string; zona_id: string;
  zonas: { nombre_zona: string } | null;
};

type Anuncio = { id: string; titulo: string; contenido: string; etiqueta: string; created_at: string; };

type Voluntario = {
  id: string; nombre: string; telefono: string; 
  ofrece_voluntariado: boolean; ofrece_vehiculo: boolean;
  vehiculo_tipo: string; vehiculo_modelo: string; vehiculo_docs_aldia: boolean;
  estado: string; created_at: string;
};

type Necesidad = {
  id: string; centro_id: string; categoria: string;
  cantidad_solicitada: number; cantidad_asignada: number;
  estado: string; created_at: string;
  centros_refugio: { nombre: string } | null;
};

export default function AdminDashboard() {
  const [zones, setZones] = useState<Zona[]>([]);
  const [reports, setReports] = useState<Reporte[]>([]);
  const [anuncios, setAnuncios] = useState<Anuncio[]>([]);
  const [voluntarios, setVoluntarios] = useState<Voluntario[]>([]);
  const [necesidades, setNecesidades] = useState<Necesidad[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<'reportes'|'noticias'|'voluntarios'|'refugios'>('reportes');

  // Asignación de Recursos state
  const [asignacion, setAsignacion] = useState<{ necesidad: Necesidad | null, zona_id: string, categoria: string, cantidad: string }>({
    necesidad: null, zona_id: '', categoria: '', cantidad: ''
  });
  const [asignando, setAsignando] = useState(false);

  // Nuevo Anuncio
  const [nuevoAnuncio, setNuevoAnuncio] = useState({ titulo: '', contenido: '', etiqueta: 'Comunicado Oficial' });
  const [enviandoAnuncio, setEnviandoAnuncio] = useState(false);

  const router = useRouter();
  const supabase = createClient();
  const { dialogProps, showAlert, showDanger } = useDialog();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: zonasData } = await supabase.from('zonas').select('id, nombre_zona, estado, inventario(tipo, cantidad_disponible)').order('nombre_zona');
    const { data: reportesData } = await supabase.from('reportes_ciudadanos').select('*, zonas(nombre_zona)').order('created_at', { ascending: false }).limit(20);
    const { data: anunciosData } = await supabase.from('anuncios_oficiales').select('*').order('created_at', { ascending: false });
    const { data: volData } = await supabase.from('voluntarios').select('*').order('created_at', { ascending: false });
    const { data: necData } = await supabase.from('necesidades_refugio').select('*, centros_refugio(nombre)').eq('estado', 'pendiente').order('created_at', { ascending: false });

    if (zonasData) setZones(zonasData as Zona[]);
    if (reportesData) setReports(reportesData as Reporte[]);
    if (anunciosData) setAnuncios(anunciosData as Anuncio[]);
    if (volData) setVoluntarios(volData as Voluntario[]);
    if (necData) setNecesidades(necData as Necesidad[]);
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
    if (!error) fetchData();
  };

  const actualizarEstadoZona = async (zonaId: string, nuevoEstado: string) => {
    await supabase.from('zonas').update({ estado: nuevoEstado }).eq('id', zonaId);
    fetchData();
  };

  const publicarAnuncio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoAnuncio.titulo || !nuevoAnuncio.contenido) return;
    setEnviandoAnuncio(true);
    const { error } = await supabase.from('anuncios_oficiales').insert(nuevoAnuncio);
    if (error) {
      await showAlert('Error al publicar', error.message);
    } else {
      setNuevoAnuncio({ titulo: '', contenido: '', etiqueta: 'Comunicado Oficial' });
      fetchData();
    }
    setEnviandoAnuncio(false);
  };

  const eliminarAnuncio = async (anuncioId: string) => {
    const ok = await showDanger('Eliminar anuncio', '¿Eliminar este anuncio de todos los portales?', 'Sí, eliminar');
    if (!ok) return;
    const { error } = await supabase.from('anuncios_oficiales').delete().eq('id', anuncioId);
    if (!error) fetchData();
  };

  // Voluntarios
  const cambiarEstadoVoluntario = async (id: string, nuevoEstado: string) => {
    await supabase.from('voluntarios').update({ estado: nuevoEstado }).eq('id', id);
    fetchData();
  };
  const eliminarVoluntario = async (id: string) => {
    const ok = await showDanger('Eliminar Voluntario', '¿Seguro que deseas eliminar este voluntario/vehículo de la base de datos?', 'Sí, eliminar');
    if (!ok) return;
    await supabase.from('voluntarios').delete().eq('id', id);
    fetchData();
  };

  // Asignación
  const ejecutarAsignacion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asignacion.necesidad || !asignacion.zona_id || !asignacion.categoria || !asignacion.cantidad) return;
    const cant = parseInt(asignacion.cantidad);
    if (cant <= 0) return;

    setAsignando(true);
    
    // Validar si hay suficiente
    const zonaSeleccionada = zones.find(z => z.id === asignacion.zona_id);
    const itemInventario = zonaSeleccionada?.inventario.find(i => i.tipo === asignacion.categoria);
    
    if (!itemInventario || itemInventario.cantidad_disponible < cant) {
      await showAlert('Sin stock suficiente', 'No hay suficientes puntos/recursos en esa categoría para asignar esa cantidad.');
      setAsignando(false);
      return;
    }

    // 1. Restar de la zona (la RLS policy lo permite si es super_admin)
    const { error: errInv } = await supabase.from('inventario')
      .update({ cantidad_disponible: itemInventario.cantidad_disponible - cant })
      .eq('zona_id', asignacion.zona_id)
      .eq('tipo', asignacion.categoria);
      
    if (errInv) {
      await showAlert('Error', errInv.message);
      setAsignando(false);
      return;
    }

    // 2. Sumar a la necesidad
    const nuevaCantAsignada = asignacion.necesidad.cantidad_asignada + cant;
    const completado = nuevaCantAsignada >= asignacion.necesidad.cantidad_solicitada;
    
    const { error: errNec } = await supabase.from('necesidades_refugio')
      .update({ 
        cantidad_asignada: nuevaCantAsignada,
        estado: completado ? 'completado' : 'pendiente'
      })
      .eq('id', asignacion.necesidad.id);

    setAsignando(false);
    if (errNec) {
      await showAlert('Error', errNec.message);
    } else {
      setAsignacion({ necesidad: null, zona_id: '', categoria: '', cantidad: '' });
      fetchData();
      if (completado) {
        await showAlert('¡Completado!', 'Se han asignado los recursos y la necesidad del refugio ha sido completada.');
      }
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
              <Link href="/" className="text-sm font-bold text-teal-400 hover:text-teal-300 hidden sm:block mr-2">Ver Portal</Link>
              <button onClick={fetchData} className="p-2 text-slate-400 hover:text-white"><RefreshCw className="w-5 h-5" /></button>
              <button onClick={handleSignOut} className="flex items-center gap-2 text-sm text-slate-300 hover:text-white bg-slate-800 px-4 py-2 rounded-lg border border-slate-700">
                <LogOut className="w-4 h-4" /> Salir
              </button>
            </div>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-white flex items-center mb-8">
            <LayoutDashboard className="mr-3 text-teal-400 w-8 h-8" /> Matriz de Zonas
          </h1>

          {/* Matriz de Zonas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {zones.map(zona => (
              <div key={zona.id} className="bg-slate-800 rounded-2xl shadow-xl border border-slate-700 overflow-hidden hover:border-teal-500/50 transition-all duration-300">
                <div className={`px-5 py-4 border-b border-slate-700 flex justify-between items-center ${zona.estado === 'crítico' ? 'bg-red-900/30' : zona.estado === 'alerta' ? 'bg-amber-900/30' : 'bg-slate-800'}`}>
                  <h2 className="text-xl font-bold text-white">{zona.nombre_zona}</h2>
                  <select
                    value={zona.estado}
                    onChange={e => actualizarEstadoZona(zona.id, e.target.value)}
                    className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border outline-none cursor-pointer ${zona.estado === 'crítico' ? 'bg-red-500/20 text-red-400 border-red-500/40' : zona.estado === 'alerta' ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'}`}
                  >
                    <option value="estable">✅ Estable</option><option value="alerta">⚠️ Alerta</option><option value="crítico">🔴 Crítico</option>
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
                  ) : <div className="col-span-2 text-center py-4 text-slate-500 text-sm">Sin recursos.</div>}
                </div>
              </div>
            ))}
          </div>

          {/* Navegación de Pestañas Inferiores */}
          <div className="flex space-x-2 overflow-x-auto custom-scrollbar pb-2 mb-6 border-b border-slate-700">
            <button onClick={() => setActiveTab('reportes')} className={`px-5 py-3 rounded-t-xl font-bold transition-colors whitespace-nowrap flex items-center ${activeTab === 'reportes' ? 'bg-slate-800 text-teal-400 border-t border-l border-r border-slate-700' : 'text-slate-400 hover:text-white'}`}>
              <Activity className="w-4 h-4 mr-2" /> Reportes Ciudadanos
            </button>
            <button onClick={() => setActiveTab('refugios')} className={`px-5 py-3 rounded-t-xl font-bold transition-colors whitespace-nowrap flex items-center ${activeTab === 'refugios' ? 'bg-slate-800 text-amber-400 border-t border-l border-r border-slate-700' : 'text-slate-400 hover:text-white'}`}>
              <Home className="w-4 h-4 mr-2" /> Centros de Refugio
            </button>
            <button onClick={() => setActiveTab('voluntarios')} className={`px-5 py-3 rounded-t-xl font-bold transition-colors whitespace-nowrap flex items-center ${activeTab === 'voluntarios' ? 'bg-slate-800 text-blue-400 border-t border-l border-r border-slate-700' : 'text-slate-400 hover:text-white'}`}>
              <UserCheck className="w-4 h-4 mr-2" /> Gestión Voluntarios
            </button>
            <button onClick={() => setActiveTab('noticias')} className={`px-5 py-3 rounded-t-xl font-bold transition-colors whitespace-nowrap flex items-center ${activeTab === 'noticias' ? 'bg-slate-800 text-emerald-400 border-t border-l border-r border-slate-700' : 'text-slate-400 hover:text-white'}`}>
              <Megaphone className="w-4 h-4 mr-2" /> Portal Noticias
            </button>
          </div>

          {/* CONTENIDO DE PESTAÑAS */}
          <div className="bg-slate-800 rounded-b-2xl rounded-tr-2xl shadow-xl border border-slate-700 p-6 min-h-[600px]">
            
            {activeTab === 'reportes' && (
              <div className="space-y-4">
                {reports.length === 0 ? <p className="text-slate-500 text-center py-8">No hay reportes aún.</p> : reports.map(r => (
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
                    <div className="flex gap-2">
                      <a href={`https://wa.me/${r.numero_telefono.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="bg-slate-800 px-4 py-2 rounded-lg border border-slate-700 text-teal-400 font-mono font-bold hover:bg-slate-700">💬 {r.numero_telefono}</a>
                      <button onClick={() => eliminarReporte(r.id)} className="bg-red-500/10 text-red-400 px-4 py-2 rounded-lg border border-red-500/30 hover:bg-red-500/20">Eliminar</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'refugios' && (
              <div>
                <p className="text-slate-400 mb-6">Asigna recursos a las necesidades reportadas por los centros de refugio usando el inventario disponible de cualquier zona.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {necesidades.length === 0 ? <div className="col-span-full text-slate-500 text-center py-8">No hay necesidades pendientes de refugios.</div> : necesidades.map(req => {
                    const progress = Math.min(100, Math.round((req.cantidad_asignada / req.cantidad_solicitada) * 100));
                    return (
                      <div key={req.id} className="p-5 rounded-2xl border border-amber-500/30 bg-slate-900">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="text-white font-bold capitalize text-lg flex items-center">
                            {req.categoria}
                          </h4>
                          <span className="text-xs bg-amber-500/10 text-amber-400 px-3 py-1 rounded-full border border-amber-500/30">
                            {req.centros_refugio?.nombre}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs text-slate-400 mb-2">
                          <span>Recolectado: {req.cantidad_asignada}</span>
                          <span>Meta: {req.cantidad_solicitada}</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden mb-4">
                          <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${progress}%` }}></div>
                        </div>
                        <button 
                          onClick={() => setAsignacion({ necesidad: req, zona_id: '', categoria: '', cantidad: '' })}
                          className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold py-2 rounded-lg transition-colors flex justify-center items-center"
                        >
                          <Plus className="w-4 h-4 mr-1" /> Asignar Puntos de Inventario
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'voluntarios' && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-bold text-white mb-4 border-b border-slate-700 pb-2">Pendientes de Aprobación</h3>
                  <div className="space-y-3">
                    {voluntarios.filter(v => v.estado === 'pendiente').map(v => (
                      <div key={v.id} className="p-4 rounded-xl border border-slate-700 bg-slate-900 flex justify-between items-center">
                        <div>
                          <div className="font-bold text-white">{v.nombre} <a href={`https://wa.me/${v.telefono.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-teal-400 font-mono text-sm ml-2">💬 {v.telefono}</a></div>
                          <div className="text-sm text-slate-400 flex gap-2 mt-1">
                            {v.ofrece_voluntariado && <span className="bg-blue-500/20 text-blue-400 px-2 rounded">Voluntario</span>}
                            {v.ofrece_vehiculo && <span className="bg-indigo-500/20 text-indigo-400 px-2 rounded">Vehículo ({v.vehiculo_tipo}: {v.vehiculo_modelo})</span>}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => cambiarEstadoVoluntario(v.id, 'activo')} className="bg-blue-500 text-white px-3 py-1.5 rounded hover:bg-blue-600 font-bold text-sm">Aceptar</button>
                          <button onClick={() => eliminarVoluntario(v.id)} className="bg-red-500/10 text-red-400 px-3 py-1.5 rounded hover:bg-red-500/20 font-bold text-sm border border-red-500/20">Rechazar</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-bold text-white mb-4 border-b border-slate-700 pb-2 flex items-center"><UserCheck className="w-5 h-5 mr-2 text-blue-400" /> Voluntarios Activos</h3>
                    <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
                      {voluntarios.filter(v => v.estado === 'activo' && v.ofrece_voluntariado).map(v => (
                        <div key={v.id} className="p-3 rounded-xl border border-slate-700 bg-slate-900/50 flex justify-between items-center">
                          <div>
                            <div className="font-bold text-slate-200">{v.nombre}</div>
                            <div className="text-teal-400 font-mono text-xs">{v.telefono}</div>
                          </div>
                          <button onClick={() => eliminarVoluntario(v.id)} className="text-red-400 hover:text-red-300 p-2"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-4 border-b border-slate-700 pb-2 flex items-center"><Car className="w-5 h-5 mr-2 text-indigo-400" /> Vehículos a Disposición</h3>
                    <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
                      {voluntarios.filter(v => v.estado === 'activo' && v.ofrece_vehiculo).map(v => (
                        <div key={v.id} className="p-3 rounded-xl border border-indigo-500/20 bg-slate-900/50 flex justify-between items-center">
                          <div>
                            <div className="font-bold text-indigo-300">{v.vehiculo_tipo.toUpperCase()} - {v.vehiculo_modelo}</div>
                            <div className="text-slate-400 text-xs">Dueño: {v.nombre} | {v.telefono}</div>
                            {v.vehiculo_docs_aldia && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 rounded uppercase mt-1 inline-block">Docs al día</span>}
                          </div>
                          <button onClick={() => eliminarVoluntario(v.id)} className="text-red-400 hover:text-red-300 p-2"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'noticias' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <form onSubmit={publicarAnuncio} className="bg-slate-900/50 p-6 rounded-2xl border border-slate-700 h-fit">
                  <h3 className="text-lg font-bold text-white mb-4">Redactar Comunicado</h3>
                  <div className="space-y-4">
                    <input required type="text" placeholder="Título del anuncio..." value={nuevoAnuncio.titulo} onChange={e => setNuevoAnuncio({...nuevoAnuncio, titulo: e.target.value})} className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none" />
                    <select value={nuevoAnuncio.etiqueta} onChange={e => setNuevoAnuncio({...nuevoAnuncio, etiqueta: e.target.value})} className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none">
                      <option value="Comunicado Oficial">Comunicado Oficial</option>
                      <option value="Alerta Importante">Alerta Importante</option>
                      <option value="Llamado a la Comunidad">Llamado a la Comunidad</option>
                    </select>
                    <textarea required rows={4} placeholder="Contenido del mensaje..." value={nuevoAnuncio.contenido} onChange={e => setNuevoAnuncio({...nuevoAnuncio, contenido: e.target.value})} className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none resize-none"></textarea>
                    <button type="submit" disabled={enviandoAnuncio} className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold py-3 rounded-lg flex items-center justify-center disabled:opacity-50">
                      {enviandoAnuncio ? 'Publicando...' : <><Plus className="w-5 h-5 mr-2" /> Publicar Anuncio</>}
                    </button>
                  </div>
                </form>
                <div className="space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                  <h3 className="text-lg font-bold text-white mb-4">Anuncios Activos</h3>
                  {anuncios.map(anuncio => (
                    <div key={anuncio.id} className="p-5 rounded-2xl border border-slate-700 bg-slate-900/50">
                      <div className="flex justify-between items-start mb-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${anuncio.etiqueta.includes('Alerta') ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>{anuncio.etiqueta}</span>
                        <button onClick={() => eliminarAnuncio(anuncio.id)} className="text-slate-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                      </div>
                      <h4 className="font-bold text-white mb-1">{anuncio.titulo}</h4>
                      <p className="text-slate-400 text-sm mb-2">{anuncio.contenido}</p>
                      <div className="text-xs text-slate-500">{tiempoRelativo(anuncio.created_at)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
      
      {/* Modal de Asignación de Recursos cruzada */}
      {asignacion.necesidad && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setAsignacion({ necesidad: null, zona_id: '', categoria: '', cantidad: '' })}></div>
          <div className="relative bg-slate-800 border border-slate-700 rounded-3xl shadow-2xl w-full max-w-md p-6 sm:p-8">
            <h3 className="text-2xl font-bold text-white mb-2">Asignar Recursos</h3>
            <p className="text-slate-400 text-sm mb-6">Transfiere inventario de una Zona al Refugio <strong>{asignacion.necesidad.centros_refugio?.nombre}</strong> (Necesita {asignacion.necesidad.cantidad_solicitada - asignacion.necesidad.cantidad_asignada} {asignacion.necesidad.categoria} más).</p>
            
            <form onSubmit={ejecutarAsignacion} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">1. Selecciona la Zona de Origen</label>
                <select required value={asignacion.zona_id} onChange={e => setAsignacion({...asignacion, zona_id: e.target.value, categoria: ''})} className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-amber-500 outline-none">
                  <option value="">Elegir zona...</option>
                  {zones.filter(z => z.inventario.length > 0).map(z => <option key={z.id} value={z.id}>{z.nombre_zona}</option>)}
                </select>
              </div>
              
              {asignacion.zona_id && (
                <div className="animate-in fade-in slide-in-from-top-2">
                  <label className="block text-sm font-medium text-slate-300 mb-1">2. Categoría a Descontar</label>
                  <select required value={asignacion.categoria} onChange={e => setAsignacion({...asignacion, categoria: e.target.value})} className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-amber-500 outline-none">
                    <option value="">Elegir categoría disponible...</option>
                    {zones.find(z => z.id === asignacion.zona_id)?.inventario.map(i => (
                      <option key={i.tipo} value={i.tipo}>{i.tipo} (Disp: {i.cantidad_disponible})</option>
                    ))}
                  </select>
                </div>
              )}

              {asignacion.categoria && (
                <div className="animate-in fade-in slide-in-from-top-2">
                  <label className="block text-sm font-medium text-slate-300 mb-1">3. Cantidad a Asignar</label>
                  <input required type="number" min="1" max={zones.find(z => z.id === asignacion.zona_id)?.inventario.find(i => i.tipo === asignacion.categoria)?.cantidad_disponible || 1} placeholder="Ej: 50" value={asignacion.cantidad} onChange={e => setAsignacion({...asignacion, cantidad: e.target.value})} className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-amber-500 outline-none" />
                </div>
              )}

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setAsignacion({ necesidad: null, zona_id: '', categoria: '', cantidad: '' })} className="flex-1 px-4 py-3 text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium">Cancelar</button>
                <button type="submit" disabled={asignando || !asignacion.zona_id || !asignacion.categoria || !asignacion.cantidad} className="flex-1 px-4 py-3 text-slate-900 bg-amber-500 hover:bg-amber-400 rounded-xl font-bold flex justify-center items-center disabled:opacity-50">
                  {asignando ? 'Asignando...' : <><CheckCircle className="w-4 h-4 mr-2" /> Confirmar</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <DialogModal {...dialogProps} />
    </>
  );
}
