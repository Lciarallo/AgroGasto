import React from 'react';
import { ActiveTab } from '../types';
import { ReceiptText, BarChart3, Settings, Plus, FileSpreadsheet } from 'lucide-react';

interface BottomNavProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenNewExpense: (event?: React.MouseEvent<HTMLButtonElement>) => void;
  onOpenExport: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  setActiveTab,
  onOpenNewExpense,
  onOpenExport,
}) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-stone-900/95 backdrop-blur-md border-t border-stone-800 text-stone-300 pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5 items-center h-16 max-w-lg mx-auto px-1">
        {/* Tab 1: Lançamentos */}
        <button
          onClick={() => setActiveTab('expenses')}
          className={`flex flex-col items-center justify-center min-h-[48px] w-full transition-colors cursor-pointer ${
            activeTab === 'expenses' ? 'text-emerald-400 font-semibold' : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <ReceiptText className="w-5 h-5" />
          <span className="text-[10px] mt-1 tracking-tight truncate max-w-full px-0.5">Gastos</span>
        </button>

        {/* Tab 2: Totais */}
        <button
          onClick={() => setActiveTab('summary')}
          className={`flex flex-col items-center justify-center min-h-[48px] w-full transition-colors cursor-pointer ${
            activeTab === 'summary' ? 'text-emerald-400 font-semibold' : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <BarChart3 className="w-5 h-5" />
          <span className="text-[10px] mt-1 tracking-tight truncate max-w-full px-0.5">Totais</span>
        </button>

        {/* Tab 3: Central Novo Button */}
        <div className="flex justify-center items-center">
          <button
            onClick={onOpenNewExpense}
            className="w-12 h-12 rounded-full bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-stone-950 flex items-center justify-center shadow-lg shadow-emerald-500/30 transition-transform cursor-pointer -mt-4 border-2 border-stone-900"
            aria-label="Novo Lançamento de Gasto"
          >
            <Plus className="w-6 h-6 stroke-[3]" />
          </button>
        </div>

        {/* Tab 4: Exportar */}
        <button
          onClick={onOpenExport}
          className="flex flex-col items-center justify-center min-h-[48px] w-full transition-colors text-stone-400 hover:text-stone-200 cursor-pointer"
        >
          <FileSpreadsheet className="w-5 h-5" />
          <span className="text-[10px] mt-1 tracking-tight truncate max-w-full px-0.5">Excel/CSV</span>
        </button>

        {/* Tab 5: Ajustes */}
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center justify-center min-h-[48px] w-full transition-colors cursor-pointer ${
            activeTab === 'settings' ? 'text-emerald-400 font-semibold' : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <Settings className="w-5 h-5" />
          <span className="text-[10px] mt-1 tracking-tight truncate max-w-full px-0.5">Ajustes</span>
        </button>
      </div>
    </nav>
  );
};
