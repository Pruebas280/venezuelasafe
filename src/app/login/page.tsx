'use client';
import { useState } from 'react';
import { ShieldCheck, UserCircle2, ArrowRight, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !data.user) {
      // Mensajes de error específicos según el código de Supabase
      let mensaje = 'Error desconocido. Intenta de nuevo.';
      if (authError?.message?.includes('Invalid login credentials')) {
        mensaje = 'Correo o contraseña incorrectos.';
      } else if (authError?.message?.includes('Email not confirmed')) {
        mensaje = 'Tu correo no ha sido confirmado. Ve al SQL Editor de Supabase y ejecuta: UPDATE auth.users SET email_confirmed_at = NOW() WHERE email_confirmed_at IS NULL;';
      } else if (authError?.message?.includes('Too many requests')) {
        mensaje = 'Demasiados intentos. Espera unos minutos e intenta de nuevo.';
      } else if (authError?.message) {
        mensaje = `Error de Supabase: ${authError.message}`;
      }
      setError(mensaje);
      setLoading(false);
      return;
    }

    const role = data.user.app_metadata?.role;
    const zonaId = data.user.app_metadata?.zona_id;

    if (role === 'super_admin') {
      router.push('/admin');
    } else if (role === 'zone_leader' && zonaId) {
      router.push(`/zona/${zonaId}`);
    } else if (role === 'cadetes_medicos' && zonaId) {
      router.push(`/medicina/${zonaId}`);
    } else if (role === 'coordinador_medico_general') {
      router.push('/medicina/general');
    } else {
      setError('Tu usuario no tiene un rol asignado. Contacta al administrador de AVCOR.');
      await supabase.auth.signOut();
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800/80 backdrop-blur-lg border border-slate-700 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        {/* Top accent line */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-500"></div>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-900 border border-slate-700 mb-4 shadow-inner">
            <ShieldCheck className="w-8 h-8 text-teal-400" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">Acceso Autorizado</h2>
          <p className="text-slate-400 text-sm">Portal exclusivo para líderes y directiva de AVCOR</p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/40 border border-red-700/60 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
            <p className="text-red-300 text-sm font-medium">{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center">
              <UserCircle2 className="w-4 h-4 mr-1 text-slate-500" /> Correo Electrónico
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tucorreo@avcor.org"
              className="w-full bg-slate-900/50 border border-slate-700 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all placeholder:text-slate-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-900/50 border border-slate-700 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all placeholder:text-slate-600"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center px-4 py-4 text-white bg-teal-500 hover:bg-teal-400 disabled:bg-teal-800 disabled:cursor-not-allowed rounded-xl font-bold transition-all active:scale-95 group shadow-lg shadow-teal-500/20"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                Verificando...
              </span>
            ) : (
              <>
                Iniciar Sesión
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <Link href="/" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
            &larr; Volver al Portal Público
          </Link>
        </div>
      </div>
    </div>
  );
}
