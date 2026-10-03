import React, { useState, useMemo } from 'react';
import { ExpenseRecord, PropertySettings } from '../types';
import { formatCurrency, formatDateBR } from '../utils/formatters';
import {
  Layers,
  CreditCard,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  CalendarClock,
} from 'lucide-react';

interface TotaisSummaryProps {
  expenses: ExpenseRecord[];
  upcomingInstallments?: ExpenseRecord[];
  settings: PropertySettings;
  periodLabel: string;
  onOpenExport: () => void;
}

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const SHORT_MONTH_NAMES = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

export const TotaisSummary: React.FC<TotaisSummaryProps> = ({
  expenses,
  upcomingInstallments = [],
  periodLabel,
  onOpenExport,
}) => {
  const [expandedSectorId, setExpandedSectorId] = useState<string | null>(null);
  const [showUpcomingDetails, setShowUpcomingDetails] = useState(false);

  // Overall calculations
  const totalAmount = expenses.reduce((sum, item) => sum + item.amount, 0);
  const count = expenses.length;
  const averageAmount = count > 0 ? totalAmount / count : 0;
  const highestExpense = expenses.reduce(
    (max, item) => (item.amount > (max?.amount || 0) ? item : max),
    null as ExpenseRecord | null
  );

  // Upcoming installments ("Parcelas a pagar") calculations
  const upcomingSummary = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth(); // 0..11

    // Total committed in all upcoming installments
    const totalCommitted = upcomingInstallments.reduce((sum, item) => sum + item.amount, 0);

    // Build buckets for the next 6 months (starting from next month: m+1 to m+6)
    const nextSixMonths: {
      key: string; // YYYY-MM
      label: string;
      shortLabel: string;
      amount: number;
      count: number;
      items: ExpenseRecord[];
    }[] = [];

    for (let i = 1; i <= 6; i++) {
      const d = new Date(curYear, curMonth + i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      nextSixMonths.push({
        key,
        label: `${MONTH_NAMES[m]} de ${y}`,
        shortLabel: `${SHORT_MONTH_NAMES[m]}/${String(y).slice(-2)}`,
        amount: 0,
        count: 0,
        items: [],
      });
    }

    const bucketMap = new Map(nextSixMonths.map((b) => [b.key, b]));

    upcomingInstallments.forEach((inst) => {
      const ym = (inst.date || '').slice(0, 7);
      const bucket = bucketMap.get(ym);
      if (bucket) {
        bucket.amount += inst.amount;
        bucket.count += 1;
        bucket.items.push(inst);
      }
    });

    const totalNextSixMonths = nextSixMonths.reduce((s, b) => s + b.amount, 0);

    return {
      totalCommitted,
      totalNextSixMonths,
      totalCount: upcomingInstallments.length,
      nextSixMonths,
    };
  }, [upcomingInstallments]);

  // Sector totals
  const sectorTotalsMap = new Map<string, { name: string; amount: number; count: number }>();
  expenses.forEach((item) => {
    const existing = sectorTotalsMap.get(item.sectorId) || {
      name: item.sectorName,
      amount: 0,
      count: 0,
    };
    existing.amount += item.amount;
    existing.count += 1;
    sectorTotalsMap.set(item.sectorId, existing);
  });

  const sectorTotals = Array.from(sectorTotalsMap.entries())
    .map(([id, data]) => ({
      id,
      name: data.name,
      amount: data.amount,
      count: data.count,
      percentage: totalAmount > 0 ? (data.amount / totalAmount) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Subgroup totals within each sector
  const getSubgroupsForSector = (secId: string) => {
    const subMap = new Map<string, { name: string; amount: number; count: number }>();
    expenses
      .filter((exp) => exp.sectorId === secId)
      .forEach((exp) => {
        const key = exp.subgroupId || exp.subgroupName;
        const existing = subMap.get(key) || {
          name: exp.subgroupName,
          amount: 0,
          count: 0,
        };
        existing.amount += exp.amount;
        existing.count += 1;
        subMap.set(key, existing);
      });

    return Array.from(subMap.entries())
      .map(([id, data]) => ({
        id,
        name: data.name,
        amount: data.amount,
        count: data.count,
        percentage: totalAmount > 0 ? (data.amount / totalAmount) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  };

  // Payment methods totals
  const paymentTotalsMap = new Map<string, { name: string; amount: number; count: number }>();
  expenses.forEach((item) => {
    const existing = paymentTotalsMap.get(item.paymentMethodId) || {
      name: item.paymentMethodName,
      amount: 0,
      count: 0,
    };
    existing.amount += item.amount;
    existing.count += 1;
    paymentTotalsMap.set(item.paymentMethodId, existing);
  });

  const paymentTotals = Array.from(paymentTotalsMap.entries())
    .map(([id, data]) => ({
      id,
      name: data.name,
      amount: data.amount,
      count: data.count,
      percentage: totalAmount > 0 ? (data.amount / totalAmount) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  return (
    <div className="space-y-6">
      {/* Top Banner: Big Totals Card */}
      <div className="bg-gradient-to-br from-emerald-950 via-emerald-900 to-stone-900 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-emerald-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <span>Totais do Período</span>
              <span className="text-stone-400">·</span>
              <span className="text-white">{periodLabel}</span>
            </div>
            <div className="text-3xl sm:text-4xl md:text-5xl font-extrabold font-mono tabular-nums tracking-tight text-white my-2">
              {formatCurrency(totalAmount)}
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-stone-300">
              <span>
                <strong>{count}</strong> {count === 1 ? 'despesa registrada' : 'despesas registradas'}
              </span>
              <span aria-hidden="true" className="text-emerald-700">·</span>
              <span>
                Média:{' '}
                <strong className="font-mono tabular-nums text-white">
                  {formatCurrency(averageAmount)}
                </strong>
                /gasto
              </span>
            </div>
          </div>

          <div className="pt-2 sm:pt-0">
            <button
              onClick={onOpenExport}
              className="h-11 px-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold text-xs sm:text-sm transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
              <span>Exportar Dados</span>
            </button>
          </div>
        </div>

        {/* Highest expense highlight */}
        {highestExpense && (
          <div className="mt-5 pt-4 border-t border-emerald-800/60 flex items-center justify-between text-xs text-stone-300">
            <div className="truncate mr-2">
              <span className="text-emerald-300 font-medium">Maior despesa:</span>{' '}
              <span className="text-white font-semibold truncate">{highestExpense.description}</span>{' '}
              <span className="text-stone-400">({highestExpense.sectorName})</span>
            </div>
            <span className="font-mono tabular-nums font-bold text-white shrink-0">
              {formatCurrency(highestExpense.amount)}
            </span>
          </div>
        )}
      </div>

      {/* Bloco: Parcelas a pagar (Comprometido nos próximos meses + próximos 6 meses) */}
      <div className="bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800">
              <CalendarClock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900 leading-tight">
                Parcelas a Pagar
              </h3>
              <p className="text-xs text-stone-500">
                Total já comprometido nos próximos meses e vencimentos nos próximos 6 meses
              </p>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-left sm:text-right">
            <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block">
              Total Comprometido ({upcomingSummary.totalCount}{' '}
              {upcomingSummary.totalCount === 1 ? 'parcela futura' : 'parcelas futuras'})
            </span>
            <span className="text-lg sm:text-xl font-extrabold font-mono tabular-nums text-emerald-950">
              {formatCurrency(upcomingSummary.totalCommitted)}
            </span>
          </div>
        </div>

        {/* Grid dos próximos 6 meses */}
        <div>
          <h4 className="text-xs font-bold text-stone-600 uppercase tracking-wider mb-2.5">
            Previsão mês a mês (Próximos 6 meses):
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
            {upcomingSummary.nextSixMonths.map((monthItem) => {
              const hasValue = monthItem.amount > 0;
              return (
                <div
                  key={monthItem.key}
                  className={`p-3 rounded-xl border flex flex-col justify-between transition-colors ${
                    hasValue
                      ? 'border-emerald-300 bg-emerald-50/40'
                      : 'border-stone-200 bg-stone-50/50 opacity-75'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="text-xs font-bold text-stone-800">
                      {monthItem.shortLabel}
                    </span>
                    <span className="text-[10px] font-semibold text-stone-500">
                      {monthItem.count} {monthItem.count === 1 ? 'parc.' : 'parcs.'}
                    </span>
                  </div>
                  <div className="text-sm sm:text-base font-bold font-mono tabular-nums text-emerald-900">
                    {formatCurrency(monthItem.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Lista expansível das próximas parcelas */}
        {upcomingInstallments.length > 0 && (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowUpcomingDetails(!showUpcomingDetails)}
              className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer"
            >
              {showUpcomingDetails ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  <span>Ocultar relação de parcelas futuras</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  <span>Ver relação das {upcomingInstallments.length} parcelas a vencer</span>
                </>
              )}
            </button>

            {showUpcomingDetails && (
              <div className="mt-3 space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {upcomingInstallments.map((inst) => (
                  <div
                    key={inst.id}
                    className="p-2.5 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-stone-900 truncate">
                        {inst.description}
                      </div>
                      <div className="text-[11px] text-stone-500">
                        Vence em {formatDateBR(inst.date)} · {inst.paymentMethodName} · {inst.sectorName}
                      </div>
                    </div>
                    <div className="font-mono font-bold text-emerald-900 shrink-0">
                      {formatCurrency(inst.amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Grid: Totais por Setor */}
      <div className="bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900 leading-tight">
                Gastos por Setor
              </h3>
              <p className="text-xs text-stone-500">
                Divisão do investimento rural entre as atividades
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-stone-500 font-mono">
            {sectorTotals.length} {sectorTotals.length === 1 ? 'setor' : 'setores'}
          </span>
        </div>

        {sectorTotals.length === 0 ? (
          <p className="text-xs text-stone-400 py-4 text-center">Nenhum gasto neste período</p>
        ) : (
          <div className="space-y-4">
            {sectorTotals.map((sec) => {
              const isExpanded = expandedSectorId === sec.id;
              const subList = getSubgroupsForSector(sec.id);

              return (
                <div
                  key={sec.id}
                  className="rounded-xl border border-stone-200 overflow-hidden bg-stone-50/50 hover:bg-stone-50 transition-colors"
                >
                  <div
                    onClick={() => setExpandedSectorId(isExpanded ? null : sec.id)}
                    className="p-4 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between sm:justify-start gap-2 mb-1.5">
                        <span className="text-sm font-bold text-stone-900">{sec.name}</span>
                        <span className="text-xs text-stone-500">
                          {sec.count} {sec.count === 1 ? 'lançamento' : 'lançamentos'}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-stone-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-emerald-700 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, sec.percentage)}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-1 sm:pt-0">
                      <div className="text-right">
                        <span className="text-base sm:text-lg font-bold font-mono tabular-nums text-emerald-900 block leading-tight">
                          {formatCurrency(sec.amount)}
                        </span>
                        <span className="text-[11px] font-semibold text-stone-500">
                          {sec.percentage.toFixed(1)}% do total
                        </span>
                      </div>

                      <button
                        type="button"
                        className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors"
                        title={isExpanded ? 'Ocultar subgrupos' : 'Ver subgrupos'}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Accordion: Subgroups of this sector */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 bg-white border-t border-stone-200/80">
                      <h4 className="text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-2">
                        Detalhamento por Subgrupo em {sec.name}:
                      </h4>
                      <div className="space-y-2">
                        {subList.map((sub) => {
                          const subSecPct = sec.amount > 0 ? (sub.amount / sec.amount) * 100 : 0;
                          return (
                            <div
                              key={sub.id}
                              className="flex items-center justify-between text-xs py-1.5 border-b border-stone-100 last:border-0"
                            >
                              <div className="min-w-0 pr-2">
                                <span className="font-semibold text-stone-800 block truncate">
                                  {sub.name}
                                </span>
                                <span className="text-[10px] text-stone-500">
                                  {sub.count} {sub.count === 1 ? 'gasto' : 'gastos'} · {subSecPct.toFixed(1)}% do setor
                                </span>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="font-mono tabular-nums font-bold text-stone-900 block">
                                  {formatCurrency(sub.amount)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Totais por Forma de Pagamento */}
      <div className="bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-6 shadow-xs">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800">
            <CreditCard className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-stone-900 leading-tight">
              Gastos por Forma de Pagamento
            </h3>
            <p className="text-xs text-stone-500">
              Fluxo de saída financeiro por método de liquidação
            </p>
          </div>
        </div>

        {paymentTotals.length === 0 ? (
          <p className="text-xs text-stone-400 py-4 text-center">Nenhum gasto neste período</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {paymentTotals.map((pay) => (
              <div
                key={pay.id}
                className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/60 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-stone-800 truncate mr-2">{pay.name}</span>
                  <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100/60 px-1.5 py-0.5 rounded">
                    {pay.percentage.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-base font-bold font-mono tabular-nums text-stone-900">
                    {formatCurrency(pay.amount)}
                  </span>
                  <span className="text-[11px] text-stone-500">
                    {pay.count} {pay.count === 1 ? 'vez' : 'vezes'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
