import React from 'react';
import { ActiveTab } from '../types';
import { Plus, FileSpreadsheet, Settings, ReceiptText, BarChart3, WifiOff, RefreshCw } from 'lucide-react';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenNewExpense: (event?: React.MouseEvent<HTMLButtonElement>) => void;
  onOpenExport: () => void;
  propertyName: string;
  isOffline?: boolean;
  hasPendingSync?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenNewExpense,
  onOpenExport,
  propertyName,
  isOffline,
  hasPendingSync,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-emerald-950 text-stone-100 border-b border-emerald-900 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setActiveTab('expenses')}
            className="text-left group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-md"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-700/80 flex items-center justify-center text-emerald-100 font-bold text-lg border border-emerald-600/50 shadow-inner">
                AG
              </div>
              <div className="truncate">
                <span className="text-lg font-bold tracking-tight text-white block leading-tight">
                  AgroGasto
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-emerald-400 block truncate max-w-[140px] sm:max-w-[200px]">
                    {propertyName || 'Minha Propriedade'}
                  </span>
                  {/* Discrete Offline indicator */}
                  {isOffline && (
                    <span className="inline-flex items-center gap-1 text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded font-semibold whitespace-nowrap">
                      <WifiOff className="w-2.5 h-2.5" />
                      Offline – sincronizando depois
                    </span>
                  )}
                  {!isOffline && hasPendingSync && (
                    <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-700/50 text-emerald-200 border border-emerald-500/30 px-1.5 py-0.2 rounded font-semibold whitespace-nowrap">
                      <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                      Sincronizando...
                    </span>
                  )}
                </div>
              </div>
            </div>
          </button>
        </div>

        {/* Zone 2: 3 clean text navigation links (desktop/tablet) */}
        <nav className="hidden md:flex items-center gap-1 sm:gap-2 text-sm font-medium">
          <button
            onClick={() => setActiveTab('expenses')}
            className={`px-3.5 py-2 rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'expenses'
                ? 'bg-emerald-900/90 text-white font-semibold shadow-sm'
                : 'text-stone-300 hover:text-white hover:bg-emerald-900/40'
            }`}
          >
            <ReceiptText className="w-4 h-4 text-emerald-400" />
            <span className="sr-only xl:not-sr-only">Lançamentos</span>
          </button>

          <button
            onClick={() => setActiveTab('summary')}
            className={`px-3.5 py-2 rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'summary'
                ? 'bg-emerald-900/90 text-white font-semibold shadow-sm'
                : 'text-stone-300 hover:text-white hover:bg-emerald-900/40'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            <span className="sr-only xl:not-sr-only">Totais & Relatório</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3.5 py-2 rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-emerald-900/90 text-white font-semibold shadow-sm'
                : 'text-stone-300 hover:text-white hover:bg-emerald-900/40'
            }`}
          >
            <Settings className="w-4 h-4 text-emerald-400" />
            <span className="sr-only xl:not-sr-only">Configurações</span>
          </button>
        </nav>

        {/* Zone 3: 1-2 primary actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenExport}
            title="Exportar para Excel / CSV"
            className="h-10 px-3 sm:px-3.5 rounded-lg border border-emerald-800 bg-emerald-900/50 hover:bg-emerald-900 text-stone-200 hover:text-white text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
            <span className="hidden sm:inline">Exportar Excel</span>
          </button>

          <button
            onClick={onOpenNewExpense}
            className="h-10 px-3.5 sm:px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-stone-950 font-bold text-xs sm:text-sm transition-all shadow-md shadow-emerald-950/40 flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Novo Lançamento</span>
          </button>
        </div>
      </div>
    </header>
  );
};
