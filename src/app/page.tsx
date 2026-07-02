'use client';
import { useState, useEffect } from 'react';
import { AlertCircle, HeartHandshake, Phone, MapPin, Send, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type Zona = { id: string; nombre_zona: string; };

export default function Home() {
  const [modalType, setModalType] = useState<'alerta_daño' | 'oferta_donacion' | null>(null);
  const [zones, setZones] = useState<Zona[]>([]);
  const [anuncios, setAnuncios] = useState<any[]>([]);
  const [form, setForm] = useState({ zona_id: '', numero_telefono: '', descripcion: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    supabase.from('zonas').select('id, nombre_zona').order('nombre_zona').then(({ data }) => {
      if (data) setZones(data);
    });
    supabase.from('anuncios_oficiales').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      if (data) setAnuncios(data);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.zona_id || !form.numero_telefono || !form.descripcion) return;
    setSending(true);

    await supabase.from('reportes_ciudadanos').insert({
      zona_id: form.zona_id,
      tipo: modalType,
      descripcion: form.descripcion,
      numero_telefono: form.numero_telefono,
    });

    setSending(false);
    setSent(true);
    setForm({ zona_id: '', numero_telefono: '', descripcion: '' });
    setTimeout(() => {
      setSent(false);
      setModalType(null);
    }, 2000);
  };

  const openModal = (type: 'alerta_daño' | 'oferta_donacion') => {
    setSent(false);
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
            Ayúdanos a coordinar esfuerzos reportando incidentes o donando recursos vitales.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4">
            <button
              onClick={() => openModal('alerta_daño')}
              className="group inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white bg-red-500 rounded-xl hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 focus:ring-offset-slate-900 active:scale-95 shadow-lg shadow-red-500/30 transition-all"
            >
              <AlertCircle className="w-6 h-6 mr-2 group-hover:animate-pulse" />
              Reportar Emergencia
            </button>
            <button
              onClick={() => openModal('oferta_donacion')}
              className="group inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-teal-900 bg-teal-400 rounded-xl hover:bg-teal-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-400 focus:ring-offset-slate-900 active:scale-95 shadow-lg shadow-teal-500/30 transition-all"
            >
              <HeartHandshake className="w-6 h-6 mr-2 group-hover:scale-110 transition-transform" />
              Ofrecer Donación
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

      {/* Modal de Formulario */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setModalType(null)}></div>
          <div className="relative bg-slate-800 border border-slate-700 rounded-3xl shadow-2xl w-full max-w-md p-6 sm:p-8">
            {sent ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-teal-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Send className="w-8 h-8 text-teal-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">¡Reporte Enviado!</h3>
                <p className="text-slate-400">Un líder de tu zona se pondrá en contacto contigo.</p>
              </div>
            ) : (
              <>
                <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
                  {modalType === 'alerta_daño'
                    ? <><AlertCircle className="text-red-400 mr-3" /> Reportar Incidente</>
                    : <><HeartHandshake className="text-teal-400 mr-3" /> Ofrecer Donación</>
                  }
                </h3>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center">
                      <MapPin className="w-4 h-4 mr-1 text-slate-400" /> Tu Zona
                    </label>
                    <select
                      required
                      value={form.zona_id}
                      onChange={e => setForm(f => ({ ...f, zona_id: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all"
                    >
                      <option value="">Selecciona tu zona...</option>
                      {zones.map(z => <option key={z.id} value={z.id}>{z.nombre_zona}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center">
                      <Phone className="w-4 h-4 mr-1 text-slate-400" /> Teléfono (Obligatorio)
                    </label>
                    <input
                      required
                      type="tel"
                      value={form.numero_telefono}
                      onChange={e => setForm(f => ({ ...f, numero_telefono: e.target.value }))}
                      placeholder="Ej. 0414-1234567"
                      className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all placeholder:text-slate-600"
                    />
                    <p className="text-xs text-slate-500 mt-2">* Solo visible por el líder de tu zona. Totalmente confidencial.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Descripción</label>
                    <textarea
                      required
                      rows={3}
                      value={form.descripcion}
                      onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                      placeholder={modalType === 'alerta_daño' ? 'Describe el daño o la emergencia...' : '¿Qué recursos deseas donar?'}
                      className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all placeholder:text-slate-600 resize-none"
                    ></textarea>
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button type="button" onClick={() => setModalType(null)} className="flex-1 px-4 py-3 text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium transition-colors">
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={sending}
                      className={`flex-1 px-4 py-3 text-white rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60 ${modalType === 'alerta_daño' ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/30' : 'bg-teal-500 hover:bg-teal-600 shadow-lg shadow-teal-500/30'}`}
                    >
                      {sending ? (
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
                      ) : <><Send className="w-4 h-4" /> Enviar</>}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
