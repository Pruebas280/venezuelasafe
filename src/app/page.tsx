'use client';
import { useState, useEffect } from 'react';
import { AlertCircle, HeartHandshake, Phone, MapPin, Send, ChevronRight, UserPlus, Home, Car } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type Zona = { id: string; nombre_zona: string; };

type ModalType = 'alerta_daño' | 'oferta_donacion' | 'voluntario' | 'refugio' | null;

export default function PublicPortal() {
  const [modalType, setModalType] = useState<ModalType>(null);
  const [zones, setZones] = useState<Zona[]>([]);
  const [anuncios, setAnuncios] = useState<any[]>([]);
  
  // Forms state
  const [form, setForm] = useState({ zona_id: '', numero_telefono: '', descripcion: '' });
  const [voluntarioForm, setVoluntarioForm] = useState({
    nombre: '', telefono: '', ofrece_voluntariado: false, ofrece_vehiculo: false, vehiculo_tipo: 'carro', vehiculo_modelo: '', vehiculo_docs_aldia: false
  });
  const [refugioForm, setRefugioForm] = useState({
    nombre: '', tipo_organizacion: 'iglesia', direccion: '', num_personas: '', contacto_nombre: '', contacto_telefono: ''
  });

  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [refugioUrl, setRefugioUrl] = useState('');
  const supabase = createClient();

  useEffect(() => {
    supabase.from('zonas').select('id, nombre_zona').order('nombre_zona').then(({ data }) => {
      if (data) setZones(data);
    });
    supabase.from('anuncios_oficiales').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      if (data) setAnuncios(data);
    });
  }, [supabase]);

  const handleSubmitReporte = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.zona_id || !form.numero_telefono || !form.descripcion) return;
    setSending(true);

    await supabase.from('reportes_ciudadanos').insert({
      zona_id: form.zona_id,
      tipo: modalType,
      descripcion: form.descripcion,
      numero_telefono: form.numero_telefono,
    });

    finishSubmit();
    setForm({ zona_id: '', numero_telefono: '', descripcion: '' });
  };

  const handleSubmitVoluntario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voluntarioForm.nombre || !voluntarioForm.telefono) return;
    if (!voluntarioForm.ofrece_voluntariado && !voluntarioForm.ofrece_vehiculo) {
      alert("Debes seleccionar al menos una opción (Voluntario o Vehículo)");
      return;
    }
    setSending(true);

    await supabase.from('voluntarios').insert({
      nombre: voluntarioForm.nombre,
      telefono: voluntarioForm.telefono,
      ofrece_voluntariado: voluntarioForm.ofrece_voluntariado,
      ofrece_vehiculo: voluntarioForm.ofrece_vehiculo,
      vehiculo_tipo: voluntarioForm.ofrece_vehiculo ? voluntarioForm.vehiculo_tipo : null,
      vehiculo_modelo: voluntarioForm.ofrece_vehiculo ? voluntarioForm.vehiculo_modelo : null,
      vehiculo_docs_aldia: voluntarioForm.ofrece_vehiculo ? voluntarioForm.vehiculo_docs_aldia : false
    });

    finishSubmit();
    setVoluntarioForm({ nombre: '', telefono: '', ofrece_voluntariado: false, ofrece_vehiculo: false, vehiculo_tipo: 'carro', vehiculo_modelo: '', vehiculo_docs_aldia: false });
  };

  const handleSubmitRefugio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refugioForm.nombre || !refugioForm.direccion || !refugioForm.num_personas || !refugioForm.contacto_telefono) return;
    setSending(true);

    const { data, error } = await supabase.from('centros_refugio').insert({
      nombre: refugioForm.nombre,
      tipo_organizacion: refugioForm.tipo_organizacion,
      direccion: refugioForm.direccion,
      num_personas: parseInt(refugioForm.num_personas),
      contacto_nombre: refugioForm.contacto_nombre,
      contacto_telefono: refugioForm.contacto_telefono
    }).select('id').single();

    setSending(false);
    
    if (error) {
      alert("Error al registrar refugio: " + error.message);
    } else if (data) {
      setRefugioUrl(`/refugio/${data.id}`);
      setSent(true);
      setRefugioForm({ nombre: '', tipo_organizacion: 'iglesia', direccion: '', num_personas: '', contacto_nombre: '', contacto_telefono: '' });
    }
  };

  const finishSubmit = () => {
    setSending(false);
    setSent(true);
    setTimeout(() => {
      setSent(false);
      setModalType(null);
    }, 2500);
  };

  const openModal = (type: ModalType) => {
    setSent(false);
    setRefugioUrl('');
    setModalType(type);
  };

  return (
    <main className="min-h-screen bg-slate-900 text-slate-50 selection:bg-teal-500 selection:text-white">
      {/* Navbar */}
      <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="font-black text-2xl tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-400">
            AVCOR
          </div>
          <Link href="/login" className="text-sm font-semibold text-slate-300 hover:text-white transition-colors">
            Acceso Personal →
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="relative overflow-hidden pt-16 pb-24 lg:pt-32 lg:pb-40">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-teal-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
          <div className="absolute top-24 -right-24 w-96 h-96 bg-emerald-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8">
            <span className="block text-slate-100">Unidos por la</span>
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-400">
              Esperanza y Acción
            </span>
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-xl text-slate-300">
            Frente a la adversidad, la Asociación Venezolana Centro Oriental se mantiene firme.
            Únete como voluntario, reporta emergencias o registra centros de refugio.
          </p>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
            <button
              onClick={() => openModal('alerta_daño')}
              className="group flex flex-col items-center justify-center p-6 text-white bg-red-500/10 border border-red-500/50 rounded-2xl hover:bg-red-500 hover:border-red-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 focus:ring-offset-slate-900 active:scale-95 shadow-lg shadow-red-500/10 transition-all"
            >
              <AlertCircle className="w-10 h-10 mb-3 text-red-400 group-hover:text-white group-hover:animate-pulse" />
              <span className="font-bold">Reportar Emergencia</span>
            </button>
            <button
              onClick={() => openModal('oferta_donacion')}
              className="group flex flex-col items-center justify-center p-6 text-white bg-emerald-500/10 border border-emerald-500/50 rounded-2xl hover:bg-emerald-500 hover:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 focus:ring-offset-slate-900 active:scale-95 shadow-lg shadow-emerald-500/10 transition-all"
            >
              <HeartHandshake className="w-10 h-10 mb-3 text-emerald-400 group-hover:text-white group-hover:scale-110 transition-transform" />
              <span className="font-bold">Ofrecer Donación</span>
            </button>
            <button
              onClick={() => openModal('voluntario')}
              className="group flex flex-col items-center justify-center p-6 text-white bg-blue-500/10 border border-blue-500/50 rounded-2xl hover:bg-blue-600 hover:border-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-slate-900 active:scale-95 shadow-lg shadow-blue-500/10 transition-all"
            >
              <UserPlus className="w-10 h-10 mb-3 text-blue-400 group-hover:text-white group-hover:scale-110 transition-transform" />
              <span className="font-bold">Aplicar Voluntariado</span>
            </button>
            <button
              onClick={() => openModal('refugio')}
              className="group flex flex-col items-center justify-center p-6 text-white bg-amber-500/10 border border-amber-500/50 rounded-2xl hover:bg-amber-500 hover:border-amber-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 focus:ring-offset-slate-900 active:scale-95 shadow-lg shadow-amber-500/10 transition-all"
            >
              <Home className="w-10 h-10 mb-3 text-amber-400 group-hover:text-white group-hover:scale-110 transition-transform" />
              <span className="font-bold text-center">Registrar Centro de Refugio</span>
            </button>
          </div>
        </div>
      </div>

      {/* Comunicados Oficiales */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 relative z-10">
        <h2 className="text-2xl font-bold text-slate-100 mb-6 flex items-center">
          <ChevronRight className="text-teal-400 mr-2" /> Comunicados Oficiales
        </h2>
        <div className="space-y-6">
          {anuncios.map(anuncio => (
            <div key={anuncio.id} className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 hover:border-teal-500/30 transition-colors shadow-xl">
              <div className={`text-sm font-semibold mb-2 flex items-center ${anuncio.etiqueta.includes('Alerta') ? 'text-red-400' : 'text-teal-400'}`}>
                {anuncio.etiqueta.includes('Alerta') ? (
                  <span className="w-2 h-2 rounded-full bg-red-400 animate-ping mr-2"></span>
                ) : (
                  <span className="w-2 h-2 rounded-full bg-teal-400 mr-2"></span>
                )}
                {anuncio.etiqueta}
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{anuncio.titulo}</h3>
              <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{anuncio.contenido}</p>
              <div className="text-xs text-slate-500 mt-4">{new Date(anuncio.created_at).toLocaleDateString('es-VE', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          ))}
          {anuncios.length === 0 && (
            <div className="text-center py-10 text-slate-500 bg-slate-800/30 rounded-2xl border border-slate-700/30">
              No hay comunicados oficiales por el momento.
            </div>
          )}
        </div>
      </div>

      {/* Modal General */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setModalType(null)}></div>
          <div className={`relative bg-slate-800 border border-slate-700 rounded-3xl shadow-2xl w-full p-6 sm:p-8 max-h-[90vh] overflow-y-auto custom-scrollbar ${modalType === 'refugio' || modalType === 'voluntario' ? 'max-w-2xl' : 'max-w-md'}`}>
            
            {sent ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-teal-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Send className="w-8 h-8 text-teal-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">
                  {modalType === 'refugio' ? '¡Centro Registrado!' : '¡Enviado Exitosamente!'}
                </h3>
                
                {modalType === 'refugio' && refugioUrl ? (
                  <div className="mt-4 bg-slate-900 p-4 rounded-xl border border-slate-700">
                    <p className="text-amber-400 text-sm font-bold mb-2">IMPORTANTE: Guarda este enlace para poder solicitar recursos.</p>
                    <div className="bg-slate-800 p-3 rounded text-slate-300 font-mono text-xs break-all">
                      {window.location.origin}{refugioUrl}
                    </div>
                    <Link href={refugioUrl} className="mt-4 inline-block bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold py-2 px-6 rounded-lg transition-colors">
                      Ir al panel del refugio ahora
                    </Link>
                  </div>
                ) : (
                  <p className="text-slate-400">Gracias por tu apoyo a la comunidad.</p>
                )}
                
                {modalType !== 'refugio' && (
                  <button onClick={() => setModalType(null)} className="mt-6 text-teal-400 font-medium hover:text-teal-300">Cerrar</button>
                )}
              </div>
            ) : (
              <>
                <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
                  {modalType === 'alerta_daño' && <><AlertCircle className="text-red-400 mr-3" /> Reportar Incidente</>}
                  {modalType === 'oferta_donacion' && <><HeartHandshake className="text-emerald-400 mr-3" /> Ofrecer Donación</>}
                  {modalType === 'voluntario' && <><UserPlus className="text-blue-400 mr-3" /> Registro de Voluntarios</>}
                  {modalType === 'refugio' && <><Home className="text-amber-400 mr-3" /> Registrar Centro de Refugio</>}
                </h3>

                {/* FORMULARIO DE REPORTES / DONACIONES */}
                {(modalType === 'alerta_daño' || modalType === 'oferta_donacion') && (
                  <form onSubmit={handleSubmitReporte} className="space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center">
                        <MapPin className="w-4 h-4 mr-1 text-slate-400" /> Tu Zona
                      </label>
                      <select required value={form.zona_id} onChange={e => setForm(f => ({ ...f, zona_id: e.target.value }))} className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-teal-500 outline-none transition-all">
                        <option value="">Selecciona tu zona...</option>
                        {zones.map(z => <option key={z.id} value={z.id}>{z.nombre_zona}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center">
                        <Phone className="w-4 h-4 mr-1 text-slate-400" /> Teléfono (Obligatorio)
                      </label>
                      <input required type="tel" value={form.numero_telefono} onChange={e => setForm(f => ({ ...f, numero_telefono: e.target.value }))} placeholder="Ej. +58 414-1234567" className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-teal-500 outline-none transition-all placeholder:text-slate-600" />
                      <p className="text-xs text-slate-500 mt-2">* Solo visible por autoridades.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Descripción</label>
                      <textarea required rows={3} value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder={modalType === 'alerta_daño' ? 'Describe el daño...' : '¿Qué donas?'} className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-teal-500 outline-none transition-all placeholder:text-slate-600 resize-none"></textarea>
                    </div>
                    <div className="pt-4 flex gap-3">
                      <button type="button" onClick={() => setModalType(null)} className="flex-1 px-4 py-3 text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium transition-colors">Cancelar</button>
                      <button type="submit" disabled={sending} className={`flex-1 px-4 py-3 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-60 ${modalType === 'alerta_daño' ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}>
                        {sending ? 'Enviando...' : <><Send className="w-4 h-4" /> Enviar</>}
                      </button>
                    </div>
                  </form>
                )}

                {/* FORMULARIO DE VOLUNTARIOS */}
                {modalType === 'voluntario' && (
                  <form onSubmit={handleSubmitVoluntario} className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Nombre Completo</label>
                        <input required type="text" value={voluntarioForm.nombre} onChange={e => setVoluntarioForm(f => ({ ...f, nombre: e.target.value }))} className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Teléfono de Contacto</label>
                        <input required type="tel" value={voluntarioForm.telefono} onChange={e => setVoluntarioForm(f => ({ ...f, telefono: e.target.value }))} className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                      </div>
                    </div>

                    <div className="bg-slate-900/50 p-5 rounded-2xl border border-slate-700 space-y-4">
                      <p className="text-sm text-slate-400 font-bold mb-2">¿Cómo deseas ayudar? (Selecciona al menos uno)</p>
                      <label className="flex items-center space-x-3 cursor-pointer group">
                        <input type="checkbox" checked={voluntarioForm.ofrece_voluntariado} onChange={e => setVoluntarioForm(f => ({ ...f, ofrece_voluntariado: e.target.checked }))} className="w-5 h-5 rounded border-slate-600 text-blue-500 focus:ring-blue-500 bg-slate-800" />
                        <span className="text-slate-300 group-hover:text-white transition-colors">Quiero ser voluntario en terreno (Logística, rescate, etc)</span>
                      </label>
                      <label className="flex items-center space-x-3 cursor-pointer group">
                        <input type="checkbox" checked={voluntarioForm.ofrece_vehiculo} onChange={e => setVoluntarioForm(f => ({ ...f, ofrece_vehiculo: e.target.checked }))} className="w-5 h-5 rounded border-slate-600 text-blue-500 focus:ring-blue-500 bg-slate-800" />
                        <span className="text-slate-300 group-hover:text-white transition-colors">Quiero poner mi vehículo a disposición de rescates y traslados</span>
                      </label>
                    </div>

                    {voluntarioForm.ofrece_vehiculo && (
                      <div className="bg-blue-500/10 p-5 rounded-2xl border border-blue-500/30 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                        <h4 className="text-blue-400 font-bold flex items-center"><Car className="w-4 h-4 mr-2" /> Datos del Vehículo</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">Tipo de Vehículo</label>
                            <select value={voluntarioForm.vehiculo_tipo} onChange={e => setVoluntarioForm(f => ({ ...f, vehiculo_tipo: e.target.value }))} className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none">
                              <option value="carro">Carro / Camioneta</option>
                              <option value="moto">Moto</option>
                              <option value="camion">Camión de carga</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">Marca / Modelo / Año</label>
                            <input required type="text" placeholder="Ej: Toyota Hilux 2018" value={voluntarioForm.vehiculo_modelo} onChange={e => setVoluntarioForm(f => ({ ...f, vehiculo_modelo: e.target.value }))} className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" />
                          </div>
                        </div>
                        <label className="flex items-center space-x-3 cursor-pointer">
                          <input type="checkbox" required checked={voluntarioForm.vehiculo_docs_aldia} onChange={e => setVoluntarioForm(f => ({ ...f, vehiculo_docs_aldia: e.target.checked }))} className="w-4 h-4 rounded border-slate-600 text-blue-500 focus:ring-blue-500 bg-slate-800" />
                          <span className="text-sm text-slate-300">Confirmo que el vehículo tiene todos los documentos al día y está en buen estado.</span>
                        </label>
                      </div>
                    )}

                    <div className="pt-4 flex gap-3">
                      <button type="button" onClick={() => setModalType(null)} className="flex-1 px-4 py-3 text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium transition-colors">Cancelar</button>
                      <button type="submit" disabled={sending} className="flex-1 px-4 py-3 text-white bg-blue-600 hover:bg-blue-500 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-60 transition-colors">
                        {sending ? 'Enviando...' : <><Send className="w-4 h-4" /> Enviar Solicitud</>}
                      </button>
                    </div>
                  </form>
                )}

                {/* FORMULARIO DE CENTRO DE REFUGIO */}
                {modalType === 'refugio' && (
                  <form onSubmit={handleSubmitRefugio} className="space-y-4">
                    <p className="text-slate-400 text-sm mb-4">Registra un centro de refugio que esté alojando personas para poder recibir recursos oficiales del inventario.</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Nombre del Centro/Refugio</label>
                        <input required type="text" placeholder="Ej: Escuela Bolivariana Sur" value={refugioForm.nombre} onChange={e => setRefugioForm(f => ({ ...f, nombre: e.target.value }))} className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 outline-none" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Tipo de Organización</label>
                        <select value={refugioForm.tipo_organizacion} onChange={e => setRefugioForm(f => ({ ...f, tipo_organizacion: e.target.value }))} className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 outline-none">
                          <option value="iglesia">Iglesia / Templo</option>
                          <option value="escuela">Escuela / Colegio</option>
                          <option value="casa_comunal">Casa Comunal</option>
                          <option value="casa_particular">Casa Particular</option>
                          <option value="ong">ONG / Fundación</option>
                          <option value="otro">Otro</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-300 mb-1">Dirección Completa</label>
                        <textarea required rows={2} value={refugioForm.direccion} onChange={e => setRefugioForm(f => ({ ...f, direccion: e.target.value }))} className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 outline-none resize-none"></textarea>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Nº Personas Alojadas aprox.</label>
                        <input required type="number" min="1" value={refugioForm.num_personas} onChange={e => setRefugioForm(f => ({ ...f, num_personas: e.target.value }))} className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 outline-none" />
                      </div>
                    </div>
                    
                    <div className="bg-amber-500/10 p-4 rounded-xl border border-amber-500/30 mt-4">
                      <h4 className="text-amber-400 font-bold text-sm mb-3">Datos del Responsable</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">Nombre Completo</label>
                          <input required type="text" value={refugioForm.contacto_nombre} onChange={e => setRefugioForm(f => ({ ...f, contacto_nombre: e.target.value }))} className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">Teléfono</label>
                          <input required type="tel" value={refugioForm.contacto_telefono} onChange={e => setRefugioForm(f => ({ ...f, contacto_telefono: e.target.value }))} className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 outline-none" />
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                      <button type="button" onClick={() => setModalType(null)} className="flex-1 px-4 py-3 text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium transition-colors">Cancelar</button>
                      <button type="submit" disabled={sending} className="flex-1 px-4 py-3 text-slate-900 bg-amber-500 hover:bg-amber-400 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-60 transition-colors">
                        {sending ? 'Registrando...' : <><Send className="w-4 h-4" /> Registrar Centro</>}
                      </button>
                    </div>
                  </form>
                )}

              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
