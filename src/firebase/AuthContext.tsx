import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth, googleProvider, testFirestoreConnection } from './config';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logOut: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Test connection on boot as required by Firebase integration skill
    testFirestoreConnection();

    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser);
        setLoading(false);
      },
      (err) => {
        console.error('Auth state change error:', err);
        setError('Erro ao verificar sessão de login.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      console.error('Erro no login com Google:', err);
      const code = (err as { code?: string })?.code;
      if (code === 'auth/popup-closed-by-user') {
        setError('O login foi cancelado antes da conclusão.');
      } else if (code === 'auth/popup-blocked') {
        setError('O navegador bloqueou a janela do Google. Permita pop-ups para fazer login.');
      } else if (code === 'auth/network-request-failed') {
        setError('Falha de conexão com a internet. Verifique sua rede e tente novamente.');
      } else {
        setError('Não foi possível entrar com o Google. Tente novamente.');
      }
    }
  };

  const logOut = async () => {
    setError(null);
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Erro ao sair:', err);
      setError('Erro ao encerrar a sessão.');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithGoogle,
        logOut,
        error,
        clearError: () => setError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
