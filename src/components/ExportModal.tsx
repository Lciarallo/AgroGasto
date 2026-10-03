import React, { useState } from 'react';
import { ExpenseRecord, PropertySettings } from '../types';
import { generateExcelCSV, downloadFile, formatCurrency, formatDateBR } from '../utils/formatters';
import { X, FileSpreadsheet, Download, Copy, Check, Info } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  expenses: ExpenseRecord[];
  settings: PropertySettings;
  periodLabel: string;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  expenses,
  settings,
  periodLabel,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const totalAmount = expenses.reduce((sum, item) => sum + item.amount, 0);

  const handleDownloadExcelCSV = () => {
    const csvContent = generateExcelCSV(expenses, settings.propertyName);
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `gastos_${settings.propertyName.toLowerCase().replace(/\s+/g, '_')}_${dateStr}.csv`;
    downloadFile(csvContent, fileName, 'text/csv;charset=utf-8;');
  };

  const handleCopySummary = () => {
    const lines = [
      `📊 *Relatório de Gastos - ${settings.propertyName}*`,
      `Período: ${periodLabel}`,
      `Total: ${formatCurrency(totalAmount)} (${expenses.length} lançamentos)`,
      '',
      '*Principais Gastos:*',
      ...expenses.slice(0, 10).map((e) => `• ${formatDateBR(e.date)} - ${e.description} (${e.sectorName}): ${formatCurrency(e.amount)}`),
      expenses.length > 10 ? `... e mais ${expenses.length - 10} lançamentos.` : '',
      '',
      `Gerado via AgroGasto em ${new Date().toLocaleDateString('pt-BR')}`,
    ].filter(Boolean);

    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
    >
      <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-emerald-950 text-white flex items-center justify-between border-b border-emerald-900">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-800/80 flex items-center justify-center text-emerald-200">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-white leading-tight">
                Exportar Lançamentos
              </h2>
              <p className="text-xs text-emerald-300">
                Gere planilhas para o Excel, contador ou relatórios
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg hover:bg-emerald-900 text-stone-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-5">
          {/* Summary Box */}
          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
            <div className="flex items-center justify-between text-xs text-stone-600">
              <span>Propriedade:</span>
              <strong className="text-stone-900">{settings.propertyName}</strong>
            </div>
            <div className="flex items-center justify-between text-xs text-stone-600">
              <span>Período Selecionado:</span>
              <strong className="text-stone-900">{periodLabel}</strong>
            </div>
            <div className="flex items-center justify-between text-xs text-stone-600">
              <span>Total de Lançamentos:</span>
              <strong className="text-stone-900">{expenses.length} registros</strong>
            </div>
            <div className="pt-2 border-t border-stone-200 flex items-center justify-between text-sm">
              <span className="font-semibold text-stone-700">Valor Total:</span>
              <span className="font-bold font-mono tabular-nums text-emerald-800 text-lg">
                {formatCurrency(totalAmount)}
              </span>
            </div>
          </div>

          {/* Compatibility Notice */}
          <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              O arquivo <strong>.CSV</strong> é formatado especificamente para o Excel no Brasil (ponto e vírgula como separador e vírgula nos centavos), abrindo com colunas perfeitas e caracteres acentuados preservados.
            </p>
          </div>

          {/* Action buttons */}
          <div className="space-y-2.5 pt-2">
            <button
              onClick={handleDownloadExcelCSV}
              disabled={expenses.length === 0}
              className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-stone-300 disabled:cursor-not-allowed text-white font-bold text-sm sm:text-base shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-5 h-5" />
              <span>Baixar Planilha Excel (.CSV)</span>
            </button>

            <button
              onClick={handleCopySummary}
              disabled={expenses.length === 0}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-stone-300 hover:bg-stone-100 disabled:opacity-50 text-stone-700 font-semibold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700 font-bold">Resumo Copiado para a Área de Transferência!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-stone-500" />
                  <span>Copiar Resumo em Texto (para WhatsApp)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-stone-50 border-t border-stone-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-stone-600 hover:bg-stone-200 transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
