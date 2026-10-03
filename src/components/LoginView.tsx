import React from 'react';
import { useAuth } from '../firebase/AuthContext';
import { ShieldCheck, Cloud, WifiOff, Smartphone, Laptop, AlertCircle } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { signInWithGoogle, error, clearError } = useAuth();
  const [isSigningIn, setIsSigningIn] = React.useState(false);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col justify-center items-center p-4 sm:p-6 text-stone-900">
      <div className="w-full max-w-md bg-white rounded-3xl border border-stone-200 shadow-xl overflow-hidden">
        {/* Brand Header */}
        <div className="bg-gradient-to-br from-emerald-950 via-emerald-900 to-stone-950 p-6 sm:p-8 text-white text-center relative overflow-hidden">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-700/80 border border-emerald-500/40 flex items-center justify-center text-white font-extrabold text-2xl shadow-lg mb-3">
            AG
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            AgroGasto
          </h1>
          <p className="text-xs sm:text-sm text-emerald-300 font-medium mt-1">
            Gestão Financeira & Despesas de Propriedades Rurais
          </p>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs sm:text-sm text-red-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span>{error}</span>
                <button
                  onClick={clearError}
                  className="block text-xs font-bold text-red-700 underline mt-1 cursor-pointer"
                >
                  Tentar novamente
                </button>
              </div>
            </div>
          )}

          {/* Features description */}
          <div className="space-y-3.5 text-xs sm:text-sm text-stone-600">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800 shrink-0">
                <Cloud className="w-4 h-4" />
              </div>
              <div>
                <strong className="text-stone-900 block">Sincronização na Nuvem</strong>
                <span>Mesmos dados em tempo real no celular e no computador.</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800 shrink-0">
                <WifiOff className="w-4 h-4" />
              </div>
              <div>
                <strong className="text-stone-900 block">Funciona Sem Sinal no Campo</strong>
                <span>Cache offline automático: lança sem internet e sincroniza ao voltar.</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800 shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <strong className="text-stone-900 block">Dados 100% Privados</strong>
                <span>Apenas você tem acesso aos lançamentos da sua conta Google.</span>
              </div>
            </div>
          </div>

          {/* Login Button with Google */}
          <div className="pt-2">
            <button
              onClick={handleSignIn}
              disabled={isSigningIn}
              className="w-full min-h-[52px] px-6 py-3.5 rounded-2xl bg-stone-900 hover:bg-stone-800 active:bg-stone-950 text-white font-bold text-sm sm:text-base shadow-lg shadow-stone-900/20 transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 disabled:cursor-wait"
            >
              {isSigningIn ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.9c2.28-2.1 3.645-5.18 3.645-9.15z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.9-3.05c-1.08.72-2.45 1.16-4.03 1.16-3.1 0-5.74-2.1-6.68-4.93H1.21v3.13C3.26 21.48 7.34 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.32 14.27c-.24-.73-.38-1.5-.38-2.27s.14-1.54.38-2.27V6.6H1.21C.44 8.13 0 9.87 0 12s.44 3.87 1.21 5.4l4.11-3.13z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.52 1.21 6.6l4.11 3.13c.94-2.83 3.58-4.96 6.68-4.96z"
                  />
                </svg>
              )}
              <span>{isSigningIn ? 'Conectando ao Google...' : 'Entrar com Google'}</span>
            </button>
          </div>

          <p className="text-[11px] text-stone-500 text-center leading-relaxed">
            Seus dados ficam protegidos no Firebase sob seu ID de usuário.
          </p>
        </div>
      </div>
    </div>
  );
};
