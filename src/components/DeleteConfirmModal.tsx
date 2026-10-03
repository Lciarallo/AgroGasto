import React, { useState, useEffect } from 'react';
import { ExpenseRecord, InstallmentScope } from '../types';
import { formatCurrency, formatDateBR } from '../utils/formatters';
import { Trash2, AlertTriangle, Check, CreditCard } from 'lucide-react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (scope: InstallmentScope) => void;
  expense: ExpenseRecord | null;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  expense,
}) => {
  const [deleteScope, setDeleteScope] = useState<InstallmentScope>('single');

  useEffect(() => {
    if (isOpen) {
      setDeleteScope('single');
    }
  }, [isOpen, expense]);

  if (!isOpen || !expense) return null;

  const isInstallment = Boolean(
    (expense.totalParcelas && expense.totalParcelas > 1) || expense.parcelamentoId
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
    >
      <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col">
        <div className="p-5 sm:p-6 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-red-100 flex items-center justify-center text-red-600">
            <Trash2 className="w-6 h-6" />
          </div>

          <div>
            <h3 className="text-base sm:text-lg font-bold text-stone-900">
              {isInstallment ? 'Excluir Lançamento Parcelado?' : 'Excluir Lançamento?'}
            </h3>
            <p className="text-xs sm:text-sm text-stone-500 mt-1">
              {isInstallment
                ? 'Escolha quais parcelas desta compra você deseja remover:'
                : 'Esta ação removerá o registro abaixo permanentemente:'}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 text-left text-xs space-y-1">
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold text-stone-900 text-sm truncate">
                {expense.description}
              </div>
              {isInstallment && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-mono font-bold text-[11px] shrink-0">
                  <CreditCard className="w-3 h-3 text-emerald-700" />
                  {expense.numeroParcela || 1}/{expense.totalParcelas || 1}
                </span>
              )}
            </div>
            <div className="text-stone-500">
              {formatDateBR(expense.date)} · {expense.sectorName} · {expense.subgroupName}
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-base font-bold font-mono text-emerald-800">
                {formatCurrency(expense.amount)}
              </span>
              {isInstallment && expense.valorTotalCompra && (
                <span className="text-[11px] font-mono text-stone-500">
                  Compra total: {formatCurrency(expense.valorTotalCompra)}
                </span>
              )}
            </div>
          </div>

          {isInstallment && (
            <div className="text-left space-y-2">
              <div className="space-y-1.5">
                {[
                  {
                    id: 'single' as InstallmentScope,
                    label: 'Somente esta parcela',
                    desc: `Remove apenas a parcela ${expense.numeroParcela}/${expense.totalParcelas}`,
                  },
                  {
                    id: 'this_and_next' as InstallmentScope,
                    label: 'Esta e as próximas',
                    desc: `Remove da parcela ${expense.numeroParcela}/${expense.totalParcelas} até a ${expense.totalParcelas}/${expense.totalParcelas}`,
                  },
                  {
                    id: 'all' as InstallmentScope,
                    label: 'Todas as parcelas da compra',
                    desc: `Remove todas as ${expense.totalParcelas} parcelas desta compra`,
                  },
                ].map((opt) => {
                  const active = deleteScope === opt.id;
                  return (
                    <button
                      type="button"
                      key={opt.id}
                      onClick={() => setDeleteScope(opt.id)}
                      className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                        active
                          ? 'border-red-600 bg-red-50/70 text-red-950 ring-2 ring-red-500/20'
                          : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold">{opt.label}</div>
                        <div className="text-[11px] text-stone-500">{opt.desc}</div>
                      </div>
                      {active && <Check className="w-4 h-4 text-red-600 shrink-0 ml-2" />}
                    </button>
                  );
                })}
              </div>

              {deleteScope === 'single' && (
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200/90 text-[11px] text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Aviso:</strong> Ao excluir somente esta parcela, o total das parcelas
                    restantes deixará de bater com o valor total original da compra.
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={onClose}
              className="min-h-[44px] px-4 py-2.5 rounded-xl border border-stone-300 hover:bg-stone-100 text-stone-700 font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                onConfirm(deleteScope);
                onClose();
              }}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm shadow-md transition-colors cursor-pointer"
            >
              Sim, Excluir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
