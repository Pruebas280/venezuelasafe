'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Home, Package, Send, CheckCircle, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import DialogModal from '@/components/DialogModal';
import { useDialog } from '@/hooks/useDialog';

type Centro = {
  id: string;
  nombre: string;
  tipo_organizacion: string;
  direccion: string;
  num_personas: number;
  contacto_nombre: string;
  contacto_telefono: string;
};

type Necesidad = {
  id: string;
  categoria: string;
  cantidad_solicitada: number;
  cantidad_asignada: number;
  estado: string;
};

export default function RefugioPage() {
  const params = useParams();
  const id = params?.id as string;
  
  const [centro, setCentro] = useState<Centro | null>(null);
  const [necesidades, setNecesidades] = useState<Necesidad[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [nuevaNecesidad, setNuevaNecesidad] = useState({ categoria: '', cantidad: '' });
  const [submitting, setSubmitting] = useState(false);
  
  const dialog = useDialog();
  const supabase = createClient();

  useEffect(() => {
    if (!id) return;
    
    const fetchCentro = async () => {
      const { data } = await supabase.from('centros_refugio').select('*').eq('id', id).single();
      if (data) setCentro(data);
      
      const { data: nData } = await supabase.from('necesidades_refugio').select('*').eq('centro_id', id).order('created_at', { ascending: false });
      if (nData) setNecesidades(nData);
      
      setLoading(false);
    };

    fetchCentro();

    // Suscripción en tiempo real a las necesidades de este centro (para ver si le asignaron recursos)
    const channel = supabase
      .channel('public:necesidades_refugio')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'necesidades_refugio', filter: `centro_id=eq.${id}` }, () => {
        supabase.from('necesidades_refugio').select('*').eq('centro_id', id).order('created_at', { ascending: false }).then(({ data }) => {
          if (data) setNecesidades(data);
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaNecesidad.categoria || !nuevaNecesidad.cantidad || isNaN(parseInt(nuevaNecesidad.cantidad))) return;
    setSubmitting(true);

    const { error } = await supabase.from('necesidades_refugio').insert({
      centro_id: id,
      categoria: nuevaNecesidad.categoria,
      cantidad_solicitada: parseInt(nuevaNecesidad.cantidad)
    });

    setSubmitting(false);
    if (error) {
      dialog.showAlert('Error al solicitar', error.message);
    } else {
      setNuevaNecesidad({ categoria: '', cantidad: '' });
      dialog.showAlert('Solicitud Registrada', 'Tu solicitud ha sido enviada a los líderes de zona y administradores.');
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-amber-400">Cargando datos del centro...</div>;

  if (!centro) return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <h1 className="text-2xl text-white mb-4">Centro no encontrado</h1>
      <Link href="/" className="text-amber-400 hover:underline flex items-center">
        <ChevronLeft className="w-4 h-4 mr-1" /> Volver al inicio
      </Link>
    </div>
  );

  return (
    <main className="min-h-screen bg-slate-900 text-slate-50 selection:bg-amber-500 selection:text-white pb-20">
      <DialogModal {...dialog.dialogProps} />
      
      <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center text-slate-400 hover:text-white transition-colors">
            <ChevronLeft className="w-5 h-5 mr-1" /> Volver
          </Link>
          <div className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400 flex items-center">
            <Home className="w-5 h-5 mr-2 text-amber-400" />
            Panel de Refugio
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 pt-8">
        <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-3xl mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">{centro.nombre}</h1>
          <div className="flex flex-wrap gap-3 mb-4">
            <span className="bg-slate-700 text-slate-300 px-3 py-1 rounded-full text-sm">{centro.tipo_organizacion}</span>
            <span className="bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-sm font-bold flex items-center">
              Alojando a {centro.num_personas} personas
            </span>
          </div>
          <p className="text-slate-400"><span className="font-semibold text-slate-300">Dirección:</span> {centro.direccion}</p>
          <div className="mt-4 pt-4 border-t border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <p className="text-slate-400"><span className="font-semibold text-slate-300">Responsable:</span> {centro.contacto_nombre}</p>
            <a href={`https://wa.me/${centro.contacto_telefono.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="inline-flex bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 text-amber-400 hover:bg-slate-700 text-sm font-mono items-center w-fit">
              💬 {centro.contacto_telefono}
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Formulario para pedir cosas */}
          <div className="lg:col-span-1">
            <div className="bg-slate-800 border border-slate-700 p-6 rounded-3xl sticky top-24">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                <Package className="w-5 h-5 mr-2 text-amber-400" />
                Solicitar Recursos
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">¿Qué necesitan?</label>
                  <input required type="text" placeholder="Ej: Agua potable, Colchonetas..." value={nuevaNecesidad.categoria} onChange={e => setNuevaNecesidad(n => ({ ...n, categoria: e.target.value }))} className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-amber-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Cantidad Estimada</label>
                  <input required type="number" min="1" placeholder="Ej: 50" value={nuevaNecesidad.cantidad} onChange={e => setNuevaNecesidad(n => ({ ...n, cantidad: e.target.value }))} className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-amber-500 outline-none" />
                </div>
                <button type="submit" disabled={submitting} className="w-full mt-2 bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold py-3 rounded-xl flex items-center justify-center transition-colors disabled:opacity-70">
                  {submitting ? 'Enviando...' : <><Send className="w-4 h-4 mr-2" /> Publicar Necesidad</>}
                </button>
              </form>
            </div>
          </div>

          {/* Lista de necesidades */}
          <div className="lg:col-span-2">
            <h2 className="text-xl font-bold text-white mb-4">Necesidades Publicadas</h2>
            {necesidades.length === 0 ? (
              <div className="text-center py-12 bg-slate-800/30 rounded-3xl border border-slate-700/30">
                <p className="text-slate-500">Aún no has solicitado ningún recurso.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {necesidades.map(req => {
                  const progress = Math.min(100, Math.round((req.cantidad_asignada / req.cantidad_solicitada) * 100));
                  return (
                    <div key={req.id} className={`p-5 rounded-2xl border transition-all ${req.estado === 'completado' ? 'bg-emerald-900/10 border-emerald-500/30' : 'bg-slate-800/50 border-slate-700'}`}>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="text-lg font-bold text-white capitalize">{req.categoria}</h3>
                          <div className="text-sm text-slate-400 mt-1">
                            {req.cantidad_asignada} de {req.cantidad_solicitada} asignados
                          </div>
                        </div>
                        {req.estado === 'completado' ? (
                          <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold flex items-center">
                            <CheckCircle className="w-3 h-3 mr-1" /> COMPLETADO
                          </span>
                        ) : (
                          <span className="bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-xs font-bold">
                            EN PROCESO
                          </span>
                        )}
                      </div>
                      
                      <div className="w-full bg-slate-900 rounded-full h-3 mt-4 overflow-hidden border border-slate-800">
                        <div 
                          className={`h-3 rounded-full transition-all duration-1000 ${progress === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                      <div className="text-right text-xs mt-1 text-slate-500 font-bold">{progress}%</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
