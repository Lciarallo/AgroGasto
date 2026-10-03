import React from 'react';
import { FilterState, PropertySettings, PeriodFilterOption } from '../types';
import { Search, Filter, RotateCcw, Calendar, ChevronDown, CreditCard } from 'lucide-react';

interface ExpenseFiltersProps {
  filters: FilterState;
  onFilterChange: (newFilters: FilterState) => void;
  settings: PropertySettings;
  totalFilteredCount: number;
  totalAllCount: number;
}

export const ExpenseFilters: React.FC<ExpenseFiltersProps> = ({
  filters,
  onFilterChange,
  settings,
  totalFilteredCount,
  totalAllCount,
}) => {
  // Period label translator
  const periodOptions: { id: PeriodFilterOption; label: string }[] = [
    { id: 'this_month', label: 'Este Mês' },
    { id: 'last_month', label: 'Mês Passado' },
    { id: 'last_30_days', label: 'Últimos 30 Dias' },
    { id: 'this_year', label: 'Este Ano' },
    { id: 'all', label: 'Todo o Período' },
    { id: 'custom', label: 'Personalizado' },
  ];

  // Available subgroups depend on selected sector
  const currentSector = settings.sectors.find((s) => s.id === filters.sectorId);
  const availableSubgroups = currentSector ? currentSector.subgroups : [];

  const handlePeriodChange = (period: PeriodFilterOption) => {
    onFilterChange({
      ...filters,
      period,
    });
  };

  const handleSectorChange = (sectorId: string) => {
    onFilterChange({
      ...filters,
      sectorId,
      subgroupId: 'all',
    });
  };

  const handleClearFilters = () => {
    onFilterChange({
      period: 'this_month',
      customStartDate: '',
      customEndDate: '',
      sectorId: 'all',
      subgroupId: 'all',
      paymentMethodId: 'all',
      searchQuery: '',
      onlyInstallments: false,
    });
  };

  const isFiltered =
    filters.period !== 'this_month' ||
    filters.sectorId !== 'all' ||
    filters.subgroupId !== 'all' ||
    filters.paymentMethodId !== 'all' ||
    filters.searchQuery.trim() !== '' ||
    Boolean(filters.onlyInstallments);

  return (
    <div className="bg-white rounded-2xl border border-stone-200/90 p-4 sm:p-5 shadow-xs space-y-4">
      {/* Top row: Search input + Clear button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={filters.searchQuery}
            onChange={(e) => onFilterChange({ ...filters, searchQuery: e.target.value })}
            placeholder="Buscar por descrição, produto ou observação..."
            className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-xl border border-stone-200 bg-stone-50/70 text-stone-900 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none transition-all placeholder:text-stone-400"
          />
          {filters.searchQuery && (
            <button
              onClick={() => onFilterChange({ ...filters, searchQuery: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-700 font-bold px-1"
            >
              ×
            </button>
          )}
        </div>

        {/* Clear Filters CTA if any filter active */}
        {isFiltered && (
          <button
            onClick={handleClearFilters}
            className="px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 border border-emerald-200"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Limpar Filtros
          </button>
        )}
      </div>

      {/* Period Selector Tabs (Segmented control) */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold text-stone-600 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-stone-500" />
            Período
          </label>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
          {periodOptions.map((opt) => {
            const isActive = filters.period === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => handlePeriodChange(opt.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:text-stone-900 hover:bg-stone-200'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Custom date range if 'custom' is selected */}
        {filters.period === 'custom' && (
          <div className="grid grid-cols-2 gap-2 mt-2.5 pt-2.5 border-t border-stone-100">
            <div>
              <label className="block text-[11px] text-stone-500 font-medium mb-1">De (Início):</label>
              <input
                type="date"
                value={filters.customStartDate}
                onChange={(e) => onFilterChange({ ...filters, customStartDate: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-stone-300 bg-white"
              />
            </div>
            <div>
              <label className="block text-[11px] text-stone-500 font-medium mb-1">Até (Fim):</label>
              <input
                type="date"
                value={filters.customEndDate}
                onChange={(e) => onFilterChange({ ...filters, customEndDate: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-stone-300 bg-white"
              />
            </div>
          </div>
        )}
      </div>

      {/* Dropdown Filters: Setor, Subgrupo, Forma de Pagamento */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
        {/* Setor */}
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Setor</label>
          <div className="relative">
            <select
              value={filters.sectorId}
              onChange={(e) => handleSectorChange(e.target.value)}
              className="w-full pl-3 pr-8 py-2 text-xs sm:text-sm font-medium rounded-lg border border-stone-200 bg-stone-50 hover:bg-white focus:bg-white focus:border-emerald-600 outline-none transition-colors cursor-pointer appearance-none text-stone-800"
            >
              <option value="all">Todos os Setores</option>
              {settings.sectors.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-stone-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Subgrupo (shows only when a sector is selected or all) */}
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Subgrupo</label>
          <div className="relative">
            <select
              value={filters.subgroupId}
              onChange={(e) => onFilterChange({ ...filters, subgroupId: e.target.value })}
              disabled={filters.sectorId === 'all'}
              className={`w-full pl-3 pr-8 py-2 text-xs sm:text-sm font-medium rounded-lg border border-stone-200 transition-colors appearance-none ${
                filters.sectorId === 'all'
                  ? 'bg-stone-100 text-stone-400 cursor-not-allowed'
                  : 'bg-stone-50 hover:bg-white focus:bg-white focus:border-emerald-600 cursor-pointer text-stone-800'
              }`}
            >
              <option value="all">
                {filters.sectorId === 'all' ? 'Selecione um setor antes' : 'Todos os Subgrupos'}
              </option>
              {availableSubgroups.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-stone-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Forma de Pagamento */}
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Forma de Pagamento</label>
          <div className="relative">
            <select
              value={filters.paymentMethodId}
              onChange={(e) => onFilterChange({ ...filters, paymentMethodId: e.target.value })}
              className="w-full pl-3 pr-8 py-2 text-xs sm:text-sm font-medium rounded-lg border border-stone-200 bg-stone-50 hover:bg-white focus:bg-white focus:border-emerald-600 outline-none transition-colors cursor-pointer appearance-none text-stone-800"
            >
              <option value="all">Todas as Formas</option>
              {settings.paymentMethods.map((pay) => (
                <option key={pay.id} value={pay.id}>
                  {pay.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-stone-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Active filters status summary & "Somente parcelados" toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500 pt-2 border-t border-stone-100">
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-emerald-700" />
          <span>
            Exibindo <strong>{totalFilteredCount}</strong> de <strong>{totalAllCount}</strong> lançamentos
          </span>
        </div>

        <label className="inline-flex items-center gap-2 text-xs font-semibold text-stone-700 cursor-pointer select-none px-2.5 py-1 rounded-lg hover:bg-stone-100 transition-colors">
          <input
            type="checkbox"
            checked={Boolean(filters.onlyInstallments)}
            onChange={(e) =>
              onFilterChange({ ...filters, onlyInstallments: e.target.checked })
            }
            className="w-4 h-4 rounded text-emerald-700 focus:ring-emerald-600 cursor-pointer"
          />
          <CreditCard className="w-3.5 h-3.5 text-emerald-700" />
          <span>Somente parcelados</span>
        </label>
      </div>
    </div>
  );
};
