import React from 'react';
import { ExpenseRecord } from '../types';
import { formatCurrency, formatDateBR } from '../utils/formatters';
import { Edit2, Trash2, Calendar, FileQuestion, Plus, Sparkles, CreditCard, Check } from 'lucide-react';

interface ExpenseListProps {
  expenses: ExpenseRecord[];
  totalAllCount: number;
  onEdit: (expense: ExpenseRecord, trigger?: HTMLButtonElement) => void;
  onDeleteRequest: (expense: ExpenseRecord) => void;
  onOpenNewExpense: (event?: React.MouseEvent<HTMLButtonElement>) => void;
  recentlySavedIds?: string[];
}

export const ExpenseList: React.FC<ExpenseListProps> = ({
  expenses,
  totalAllCount,
  onEdit,
  onDeleteRequest,
  onOpenNewExpense,
  recentlySavedIds = [],
}) => {
  if (expenses.length === 0) {
    const isAppCompletelyEmpty = totalAllCount === 0;

    return (
      <div className="bg-white rounded-2xl border border-stone-200/90 p-8 sm:p-12 text-center shadow-xs">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4 border border-emerald-100">
          {isAppCompletelyEmpty ? <Sparkles className="w-7 h-7" /> : <FileQuestion className="w-7 h-7" />}
        </div>
        <h3 className="text-base sm:text-lg font-bold text-stone-800 mb-1">
          {isAppCompletelyEmpty ? 'Nenhum gasto lançado ainda' : 'Nenhum lançamento encontrado'}
        </h3>
        <p className="text-xs sm:text-sm text-stone-500 max-w-sm mx-auto mb-6">
          {isAppCompletelyEmpty
            ? 'Toque em + para começar'
            : 'Não há despesas correspondentes aos filtros selecionados.'}
        </p>
        <button
          onClick={onOpenNewExpense}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm shadow-md transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>{isAppCompletelyEmpty ? 'Lançar Primeiro Gasto' : 'Lançar Novo Gasto'}</span>
        </button>
      </div>
    );
  }

  // Calculate total of shown list
  const totalAmount = expenses.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="space-y-3">
      {/* Header bar of the list with count and sum */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
          {expenses.length} {expenses.length === 1 ? 'Lançamento' : 'Lançamentos'}
        </span>
        <div className="text-right">
          <span className="text-xs text-stone-500 mr-2">Soma na lista:</span>
          <span className="text-sm font-bold font-mono tabular-nums text-emerald-800">
            {formatCurrency(totalAmount)}
          </span>
        </div>
      </div>

      {/* Cards list */}
      <div className="space-y-2.5">
        {expenses.map((expense) => {
          const isInstallment = Boolean(
            (expense.totalParcelas && expense.totalParcelas > 1) || expense.parcelamentoId
          );
          const installmentBadgeText = isInstallment
            ? `${expense.numeroParcela || 1}/${expense.totalParcelas || 1}`
            : null;

          return (
            <div
              key={expense.id}
              className={`bg-white rounded-xl border border-stone-200/90 hover:border-emerald-600/40 p-4 transition-colors ${recentlySavedIds.includes(expense.id) ? 'expense-just-saved' : ''}`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                {/* Main Content */}
                <div className="min-w-0 flex-1">
                  {/* Top line: Date and metadata unboxed with separators */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-stone-500 mb-1">
                    <span className="font-semibold text-stone-700 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                      {formatDateBR(expense.date)}
                    </span>
                    <span aria-hidden="true" className="text-stone-300">·</span>
                    <span className="font-medium text-stone-800">{expense.sectorName}</span>
                    <span aria-hidden="true" className="text-stone-300">/</span>
                    <span className="text-stone-600">{expense.subgroupName}</span>
                    <span aria-hidden="true" className="text-stone-300">·</span>
                    <span className="text-stone-500">{expense.paymentMethodName}</span>
                    {recentlySavedIds.includes(expense.id) && (
                      <span className="inline-flex items-center gap-1 text-emerald-800 font-semibold">
                        <Check className="w-3.5 h-3.5" aria-hidden="true" />
                        Salvo
                      </span>
                    )}
                    {installmentBadgeText && (
                      <span
                        className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 font-mono font-bold text-[11px] border border-emerald-200"
                        title={
                          expense.valorTotalCompra
                            ? `Parcela ${installmentBadgeText} · Total da compra: ${formatCurrency(
                                expense.valorTotalCompra
                              )}`
                            : `Parcela ${installmentBadgeText}`
                        }
                      >
                        <CreditCard className="w-3 h-3 text-emerald-700" />
                        <span>{installmentBadgeText}</span>
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <h4 className="text-base sm:text-lg font-semibold text-stone-900 leading-snug break-words">
                    {expense.description}
                  </h4>

                  {/* Optional installment total purchase hint */}
                  {isInstallment && expense.valorTotalCompra && (
                    <p className="text-[11px] text-stone-500 mt-0.5 font-mono">
                      Total da compra: {formatCurrency(expense.valorTotalCompra)}
                      {expense.dataCompra ? ` · Compra em ${formatDateBR(expense.dataCompra)}` : ''}
                    </p>
                  )}

                  {/* Optional notes */}
                  {expense.notes && (
                    <p className="text-xs text-stone-600 mt-1 italic break-words">
                      Nota: {expense.notes}
                    </p>
                  )}
                </div>

                {/* Right side: Amount and Action Buttons */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100 shrink-0">
                  <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-emerald-800">
                    {formatCurrency(expense.amount)}
                  </div>

                  {/* Actions buttons */}
                  <div className="flex items-center gap-1">
                    <button
                    onClick={(event) => onEdit(expense, event.currentTarget)}
                      className="min-h-[40px] px-2.5 py-1.5 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 font-medium text-xs flex items-center gap-1 transition-colors cursor-pointer"
                      title="Editar lançamento"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-stone-500" />
                      <span>Editar</span>
                    </button>

                    <button
                      onClick={() => onDeleteRequest(expense)}
                      className="min-h-[40px] px-2.5 py-1.5 rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50 font-medium text-xs flex items-center gap-1 transition-colors cursor-pointer"
                      title="Excluir lançamento"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Excluir</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
