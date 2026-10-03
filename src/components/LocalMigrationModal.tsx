import React, { useState } from 'react';
import { ExpenseRecord, PropertySettings } from '../types';
import { CloudUpload, CheckCircle2, AlertCircle, X, Database } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';

interface LocalMigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  localExpenses: ExpenseRecord[];
  localSettings: PropertySettings;
  onConfirmMigration: () => Promise<void>;
  onClearLocalStorage: () => void;
}

export const LocalMigrationModal: React.FC<LocalMigrationModalProps> = ({
  isOpen,
  onClose,
  localExpenses,
  localSettings,
  onConfirmMigration,
  onClearLocalStorage,
}) => {
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationSuccess, setMigrationSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const totalAmount = localExpenses.reduce((sum, item) => sum + item.amount, 0);

  const handleStartMigration = async () => {
    if (isMigrating) return; // Prevent duplicate clicks
    setIsMigrating(true);
    setErrorMsg(null);

    try {
      await onConfirmMigration();
      setMigrationSuccess(true);
    } catch (err) {
      console.error('Erro na migração:', err);
      setErrorMsg('Ocorreu um erro ao enviar os dados para a nuvem. Tente novamente.');
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
    >
      <div className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 bg-emerald-950 text-white flex items-center justify-between border-b border-emerald-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-800/80 flex items-center justify-center text-emerald-200">
              <CloudUpload className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-white leading-tight">
                Migração para a Nuvem
              </h2>
              <p className="text-xs text-emerald-300">
                Dados encontrados na memória deste navegador
              </p>
            </div>
          </div>
          {!isMigrating && (
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-lg hover:bg-emerald-900 text-stone-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-stone-800">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {!migrationSuccess ? (
            <>
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                Identificamos dados salvos anteriormente neste navegador. Você pode enviar esses lançamentos para a sua conta na nuvem para acessá-los também pelo celular ou outro computador:
              </p>

              {/* Data Summary Box */}
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
                <div className="flex items-center justify-between text-xs text-stone-600">
                  <span>Propriedade:</span>
                  <strong className="text-stone-900">{localSettings.propertyName}</strong>
                </div>
                <div className="flex items-center justify-between text-xs text-stone-600">
                  <span>Lançamentos locais:</span>
                  <strong className="text-stone-900">{localExpenses.length} registros</strong>
                </div>
                {localExpenses.length > 0 && (
                  <div className="pt-2 border-t border-stone-200 flex items-center justify-between text-sm">
                    <span className="font-semibold text-stone-700">Total acumulado:</span>
                    <span className="font-bold font-mono tabular-nums text-emerald-800">
                      {formatCurrency(totalAmount)}
                    </span>
                  </div>
                )}
              </div>

              <div className="text-[11px] text-stone-500 bg-emerald-50/60 p-3 rounded-xl border border-emerald-100 flex items-start gap-2">
                <Database className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <span>
                  A cópia do seu navegador será mantida intacta até que você confirme que a sincronização deu certo.
                </span>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex flex-col sm:flex-row gap-2.5">
                <button
                  onClick={handleStartMigration}
                  disabled={isMigrating}
                  className="flex-1 min-h-[48px] px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-stone-300 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-wait"
                >
                  {isMigrating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Enviando para a nuvem...</span>
                    </>
                  ) : (
                    <>
                      <CloudUpload className="w-4 h-4" />
                      <span>Enviar meus dados locais para a nuvem</span>
                    </>
                  )}
                </button>

                <button
                  onClick={onClose}
                  disabled={isMigrating}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl border border-stone-300 hover:bg-stone-100 text-stone-700 text-xs font-semibold cursor-pointer"
                >
                  Não enviar agora
                </button>
              </div>
            </>
          ) : (
            /* Success State */
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-stone-900">
                  Dados enviados com sucesso!
                </h3>
                <p className="text-xs sm:text-sm text-stone-600 mt-1 max-w-sm mx-auto">
                  Seus lançamentos já estão seguros no Firestore e sincronizados com a nuvem.
                </p>
              </div>

              <div className="pt-3 flex flex-col sm:flex-row gap-2.5">
                <button
                  onClick={() => {
                    onClearLocalStorage();
                    onClose();
                  }}
                  className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs sm:text-sm shadow-xs cursor-pointer"
                >
                  Limpar cópia local e continuar
                </button>
                <button
                  onClick={onClose}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl border border-stone-300 hover:bg-stone-100 text-stone-700 font-semibold text-xs cursor-pointer"
                >
                  Manter cópia local e fechar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
