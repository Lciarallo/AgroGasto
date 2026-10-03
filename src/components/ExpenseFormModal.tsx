import React, { useState, useEffect, useMemo } from 'react';
import {
  ExpenseRecord,
  PropertySettings,
  SubgroupItem,
  InstallmentScope,
} from '../types';
import {
  getTodayDateStr,
  generateId,
  formatNumberBR,
  formatCurrency,
  formatDateBR,
  splitAmountIntoInstallments,
  calculateInstallmentDates,
  formatInstallmentDescription,
  stripInstallmentSuffix,
} from '../utils/formatters';
import {
  X,
  DollarSign,
  Check,
  Plus,
  CreditCard,
  Calendar,
  AlertTriangle,
  Layers,
} from 'lucide-react';

interface ExpenseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (expense: ExpenseRecord) => void;
  onSaveBatch?: (expenses: ExpenseRecord[]) => void;
  onUpdateInstallmentSeries?: (
    editedExpense: ExpenseRecord,
    scope: InstallmentScope,
    newTotalPurchaseAmount: number,
    dueDay?: number
  ) => void;
  initialData?: ExpenseRecord | null;
  settings: PropertySettings;
  onUpdateSettings?: (newSettings: PropertySettings) => void;
}

export const ExpenseFormModal: React.FC<ExpenseFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onSaveBatch,
  onUpdateInstallmentSeries,
  initialData,
  settings,
  onUpdateSettings,
}) => {
  const isEditing = Boolean(initialData);
  const isEditingInstallment = Boolean(
    initialData &&
      ((initialData.totalParcelas && initialData.totalParcelas > 1) ||
        initialData.parcelamentoId)
  );

  // Form states
  const [date, setDate] = useState<string>(getTodayDateStr());
  const [description, setDescription] = useState<string>('');
  const [amountRaw, setAmountRaw] = useState<string>('');
  const [amountNumber, setAmountNumber] = useState<number>(0);
  const [sectorId, setSectorId] = useState<string>('');
  const [subgroupId, setSubgroupId] = useState<string>('');
  const [paymentMethodId, setPaymentMethodId] = useState<string>('');
  const [installmentsCount, setInstallmentsCount] = useState<number>(1);
  const [editScope, setEditScope] = useState<InstallmentScope>('single');
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Quick inline creation state
  const [showAddSubgroup, setShowAddSubgroup] = useState(false);
  const [newSubgroupName, setNewSubgroupName] = useState('');

  // Synchronize initial data or defaults when opened
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setDate(initialData.date);
        const isInst =
          (initialData.totalParcelas && initialData.totalParcelas > 1) ||
          Boolean(initialData.parcelamentoId);
        setDescription(
          isInst ? stripInstallmentSuffix(initialData.description) : initialData.description
        );
        setEditScope('single');
        setAmountNumber(initialData.amount);
        setAmountRaw(formatNumberBR(initialData.amount));
        setSectorId(initialData.sectorId);
        setSubgroupId(initialData.subgroupId);
        setPaymentMethodId(initialData.paymentMethodId);
        setInstallmentsCount(initialData.totalParcelas || 1);
        setNotes(initialData.notes || '');
      } else {
        setDate(getTodayDateStr());
        setDescription('');
        setAmountNumber(0);
        setAmountRaw('');
        const defaultSec = settings.sectors[0]?.id || '';
        setSectorId(defaultSec);
        const subList = settings.sectors.find((s) => s.id === defaultSec)?.subgroups || [];
        setSubgroupId(subList[0]?.id || '');
        setPaymentMethodId(settings.paymentMethods[0]?.id || '');
        setInstallmentsCount(1);
        setEditScope('single');
        setNotes('');
      }
      setErrorMsg('');
      setShowAddSubgroup(false);
      setNewSubgroupName('');
    }
  }, [isOpen, initialData, settings]);

  // Selected payment method object
  const selectedPaymentMethod = useMemo(
    () => settings.paymentMethods.find((p) => p.id === paymentMethodId),
    [settings.paymentMethods, paymentMethodId]
  );

  const isCreditCardSelected = Boolean(selectedPaymentMethod?.isCreditCard);

  // Reset installments to 1x if user switches to a non-credit-card payment method on new expense
  useEffect(() => {
    if (!isEditing && !isCreditCardSelected) {
      setInstallmentsCount(1);
    }
  }, [isEditing, isCreditCardSelected]);

  // Handle switching editScope when editing an installment (switches between installment value vs total purchase value)
  const handleSelectEditScope = (newScope: InstallmentScope) => {
    if (!initialData) return;
    setEditScope(newScope);
    const totalPurchaseVal =
      initialData.valorTotalCompra ??
      initialData.amount * (initialData.totalParcelas || 1);

    if (newScope === 'single') {
      setAmountNumber(initialData.amount);
      setAmountRaw(formatNumberBR(initialData.amount));
    } else {
      setAmountNumber(totalPurchaseVal);
      setAmountRaw(formatNumberBR(totalPurchaseVal));
    }
  };

  // When sector changes, dynamically update subgrupo options to only that sector's subgroups
  const handleSectorChange = (newSectorId: string) => {
    setSectorId(newSectorId);
    const chosenSector = settings.sectors.find((s) => s.id === newSectorId);
    if (chosenSector && chosenSector.subgroups.length > 0) {
      const exists = chosenSector.subgroups.some((sg) => sg.id === subgroupId);
      if (!exists) {
        setSubgroupId(chosenSector.subgroups[0].id);
      }
    } else {
      setSubgroupId('');
    }
  };

  const currentSector = settings.sectors.find((s) => s.id === sectorId);
  const availableSubgroups = currentSector ? currentSector.subgroups : [];

  // Currency input handler
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    if (!rawVal) {
      setAmountRaw('');
      setAmountNumber(0);
      return;
    }
    const cents = parseInt(rawVal, 10);
    const floatVal = cents / 100;
    setAmountNumber(floatVal);
    setAmountRaw(formatNumberBR(floatVal));
  };

  const addQuickAmount = (extra: number) => {
    const nextVal = (amountNumber || 0) + extra;
    setAmountNumber(nextVal);
    setAmountRaw(formatNumberBR(nextVal));
  };

  const setQuickDate = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setDate(`${year}-${month}-${day}`);
  };

  const handleCreateSubgroupInline = () => {
    if (!newSubgroupName.trim() || !sectorId || !onUpdateSettings) return;

    const newSub: SubgroupItem = {
      id: generateId('sub'),
      name: newSubgroupName.trim(),
    };

    const updatedSectors = settings.sectors.map((sec) => {
      if (sec.id === sectorId) {
        return {
          ...sec,
          subgroups: [...sec.subgroups, newSub],
        };
      }
      return sec;
    });

    const newSettings: PropertySettings = {
      ...settings,
      sectors: updatedSectors,
    };

    onUpdateSettings(newSettings);
    setSubgroupId(newSub.id);
    setNewSubgroupName('');
    setShowAddSubgroup(false);
  };

  // Preview of installments when creating a new expense on a credit card
  const installmentPreview = useMemo(() => {
    if (isEditing || !isCreditCardSelected) return null;
    const count = Math.max(1, installmentsCount);
    const total = amountNumber || 0;
    const amounts = splitAmountIntoInstallments(total, count);
    const dates = calculateInstallmentDates(date, count, selectedPaymentMethod?.dueDay);
    // Representative installment value (standard installment is amounts[count - 1])
    const baseInstallmentValue = amounts[count - 1] || 0;

    return {
      count,
      total,
      baseInstallmentValue,
      items: amounts.map((val, idx) => ({
        number: idx + 1,
        amount: val,
        date: dates[idx],
      })),
    };
  }, [
    isEditing,
    isCreditCardSelected,
    installmentsCount,
    amountNumber,
    date,
    selectedPaymentMethod?.dueDay,
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setErrorMsg('Por favor, informe a descrição do gasto.');
      return;
    }
    if (amountNumber <= 0) {
      setErrorMsg('Por favor, informe um valor válido maior que zero.');
      return;
    }
    if (!sectorId) {
      setErrorMsg('Por favor, selecione um Setor.');
      return;
    }

    const secObj = settings.sectors.find((s) => s.id === sectorId);
    const subObj = secObj?.subgroups.find((sg) => sg.id === subgroupId);
    const payObj = settings.paymentMethods.find((p) => p.id === paymentMethodId);

    const sectorName = secObj ? secObj.name : initialData?.sectorName || 'Outros';
    const subgroupName = subObj ? subObj.name : initialData?.subgroupName || 'Geral';
    const paymentMethodName = payObj ? payObj.name : initialData?.paymentMethodName || 'Outro';
    const nowIso = new Date().toISOString();

    // Case 1: Editing an existing installment record
    if (isEditing && initialData && isEditingInstallment) {
      const totalParcelas = initialData.totalParcelas || 1;
      const numeroParcela = initialData.numeroParcela || 1;
      const formattedDesc = formatInstallmentDescription(
        description.trim(),
        numeroParcela,
        totalParcelas
      );

      if (editScope === 'single' || !onUpdateInstallmentSeries) {
        const singleUpdated: ExpenseRecord = {
          ...initialData,
          date,
          description: formattedDesc,
          amount: amountNumber,
          sectorId,
          sectorName,
          subgroupId: subgroupId || '',
          subgroupName,
          paymentMethodId,
          paymentMethodName,
          notes: notes.trim(),
          updatedAt: nowIso,
        };
        onSave(singleUpdated);
        onClose();
        return;
      }

      // 'this_and_next' or 'all' -> amountNumber is the new total purchase amount
      const editedRecord: ExpenseRecord = {
        ...initialData,
        date,
        description: formattedDesc,
        sectorId,
        sectorName,
        subgroupId: subgroupId || '',
        subgroupName,
        paymentMethodId,
        paymentMethodName,
        notes: notes.trim(),
        updatedAt: nowIso,
      };

      onUpdateInstallmentSeries(
        editedRecord,
        editScope,
        amountNumber,
        payObj?.dueDay
      );
      onClose();
      return;
    }

    // Case 2: New expense with installments (> 1x on Credit Card)
    if (!isEditing && isCreditCardSelected && installmentsCount > 1) {
      const parcelamentoId = generateId('parc');
      const amounts = splitAmountIntoInstallments(amountNumber, installmentsCount);
      const dates = calculateInstallmentDates(date, installmentsCount, payObj?.dueDay);

      const batchRecords: ExpenseRecord[] = amounts.map((instAmount, idx) => {
        const num = idx + 1;
        return {
          id: generateId('exp'),
          date: dates[idx],
          description: formatInstallmentDescription(description.trim(), num, installmentsCount),
          amount: instAmount,
          sectorId,
          sectorName,
          subgroupId: subgroupId || '',
          subgroupName,
          paymentMethodId,
          paymentMethodName,
          notes: notes.trim(),
          parcelamentoId,
          numeroParcela: num,
          totalParcelas: installmentsCount,
          valorTotalCompra: amountNumber,
          dataCompra: date,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
      });

      if (onSaveBatch) {
        onSaveBatch(batchRecords);
      } else {
        batchRecords.forEach((r) => onSave(r));
      }
      onClose();
      return;
    }

    // Case 3: Standard 1x expense (New or Editing 1x)
    const record: ExpenseRecord = {
      id: initialData ? initialData.id : generateId('exp'),
      date,
      description: description.trim(),
      amount: amountNumber,
      sectorId,
      sectorName,
      subgroupId: subgroupId || '',
      subgroupName,
      paymentMethodId,
      paymentMethodName,
      notes: notes.trim(),
      createdAt: initialData ? initialData.createdAt : nowIso,
      updatedAt: nowIso,
    };

    onSave(record);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
    >
      <div className="relative bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-emerald-950 text-white flex items-center justify-between border-b border-emerald-900">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-800/80 flex items-center justify-center text-emerald-200">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-white leading-tight">
                {isEditing
                  ? isEditingInstallment
                    ? `Editar Parcela (${initialData?.numeroParcela}/${initialData?.totalParcelas})`
                    : 'Editar Lançamento'
                  : 'Novo Lançamento Rural'}
              </h2>
              <p className="text-xs text-emerald-300">
                {isEditing
                  ? 'Altere os dados do registro'
                  : 'Preencha os dados da despesa no campo'}
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

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 text-stone-800"
        >
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs sm:text-sm font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
              {errorMsg}
            </div>
          )}

          {/* Scope selector when editing an installment */}
          {isEditing && isEditingInstallment && (
            <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-2.5">
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-700" />
                <span>O que você deseja editar nesta compra parcelada?</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { id: 'single' as InstallmentScope, label: 'Somente esta parcela' },
                  { id: 'this_and_next' as InstallmentScope, label: 'Esta e as próximas' },
                  { id: 'all' as InstallmentScope, label: 'Todas as parcelas da compra' },
                ].map((opt) => {
                  const active = editScope === opt.id;
                  return (
                    <button
                      type="button"
                      key={opt.id}
                      onClick={() => handleSelectEditScope(opt.id)}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold border text-left flex items-center justify-between transition-all cursor-pointer ${
                        active
                          ? 'border-emerald-700 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-600/20'
                          : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-100'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {active && <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0 ml-1" />}
                    </button>
                  );
                })}
              </div>

              {editScope === 'single' ? (
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200/90 text-[11px] text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Aviso:</strong> Ao editar somente esta parcela, a soma individual das
                    parcelas pode deixar de bater com o valor total original da compra (
                    {formatCurrency(
                      initialData?.valorTotalCompra ??
                        (initialData?.amount || 0) * (initialData?.totalParcelas || 1)
                    )}
                    ).
                  </span>
                </div>
              ) : (
                <p className="text-[11px] text-stone-600">
                  Se você alterar o <strong>Valor Total da Compra</strong> abaixo, as parcelas{' '}
                  {editScope === 'this_and_next' ? 'restantes' : 'da compra'} serão recalculadas
                  automaticamente mantendo a soma exata em centavos.
                </p>
              )}
            </div>
          )}

          {/* Campo Valor (Destaque Principal com máscara R$) */}
          <div className="bg-stone-50 p-3.5 sm:p-4 rounded-xl border border-stone-200">
            <label className="block text-xs font-semibold text-stone-600 mb-1">
              {isEditing && isEditingInstallment
                ? editScope === 'single'
                  ? `Valor desta Parcela ${initialData?.numeroParcela}/${initialData?.totalParcelas} (R$) *`
                  : 'Valor Total da Compra (R$) *'
                : 'Valor da Despesa (R$) *'}
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-stone-500 font-bold text-lg pointer-events-none">
                R$
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={amountRaw}
                onChange={handleAmountChange}
                placeholder="0,00"
                autoFocus={!isEditing}
                className="w-full pl-12 pr-4 py-3 text-2xl sm:text-3xl font-mono font-bold tabular-nums text-stone-900 bg-white rounded-lg border-2 border-emerald-600 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-200 outline-none transition-all placeholder:text-stone-300"
              />
            </div>
            {/* Quick value helpers */}
            <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-1">
              <span className="text-[11px] text-stone-600 font-medium shrink-0">Atalhos:</span>
              <button
                type="button"
                onClick={() => addQuickAmount(50)}
                className="px-2.5 py-1 text-xs font-medium rounded-md bg-stone-200 hover:bg-stone-300 text-stone-800 transition-colors cursor-pointer shrink-0"
              >
                + R$ 50
              </button>
              <button
                type="button"
                onClick={() => addQuickAmount(100)}
                className="px-2.5 py-1 text-xs font-medium rounded-md bg-stone-200 hover:bg-stone-300 text-stone-800 transition-colors cursor-pointer shrink-0"
              >
                + R$ 100
              </button>
              <button
                type="button"
                onClick={() => addQuickAmount(500)}
                className="px-2.5 py-1 text-xs font-medium rounded-md bg-stone-200 hover:bg-stone-300 text-stone-800 transition-colors cursor-pointer shrink-0"
              >
                + R$ 500
              </button>
              <button
                type="button"
                onClick={() => addQuickAmount(1000)}
                className="px-2.5 py-1 text-xs font-medium rounded-md bg-stone-200 hover:bg-stone-300 text-stone-800 transition-colors cursor-pointer shrink-0"
              >
                + R$ 1.000
              </button>
              {amountNumber > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setAmountNumber(0);
                    setAmountRaw('');
                  }}
                  className="px-2 py-1 text-xs font-medium rounded-md text-red-600 hover:bg-red-50 transition-colors cursor-pointer ml-auto shrink-0"
                >
                  Zerar
                </button>
              )}
            </div>
          </div>

          {/* Campo Descrição */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Descrição do Gasto *
            </label>
            <div className="relative">
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex.: Óleo diesel trator John Deere, 20 sacos de adubo, etc."
                className="w-full px-3.5 py-2.5 text-sm sm:text-base font-medium rounded-lg border border-stone-300 bg-white text-stone-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none transition-all placeholder:text-stone-400"
              />
            </div>
            {isEditing && isEditingInstallment && (
              <span className="text-[11px] text-stone-500 mt-0.5 block">
                O sufixo da parcela ({initialData?.numeroParcela}/{initialData?.totalParcelas}) será
                mantido automaticamente.
              </span>
            )}
          </div>

          {/* Data com atalhos de Hoje / Ontem */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-stone-700">
                {!isEditing && isCreditCardSelected && installmentsCount > 1
                  ? 'Data da Compra / 1ª Parcela *'
                  : 'Data do Gasto *'}
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setQuickDate(0)}
                  className={`text-[11px] px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                    date === getTodayDateStr()
                      ? 'bg-emerald-700 text-white font-semibold'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                  }`}
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate(1)}
                  className="text-[11px] px-2 py-0.5 rounded font-medium bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors cursor-pointer"
                >
                  Ontem
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate(2)}
                  className="text-[11px] px-2 py-0.5 rounded font-medium bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors cursor-pointer"
                >
                  Anteontem
                </button>
              </div>
            </div>
            <div className="relative">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm sm:text-base font-medium rounded-lg border border-stone-300 bg-white text-stone-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
              />
            </div>
          </div>

          {/* Grid Setor & Subgrupo (Cascading) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Setor */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1 flex items-center justify-between">
                <span>Setor da Propriedade *</span>
              </label>
              <select
                value={sectorId}
                onChange={(e) => handleSectorChange(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm sm:text-base font-semibold rounded-lg border border-stone-300 bg-white text-stone-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none transition-all cursor-pointer"
              >
                {settings.sectors.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Subgrupo (Restrito ao setor selecionado) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-stone-700">Subgrupo do Setor *</label>
                {onUpdateSettings && (
                  <button
                    type="button"
                    onClick={() => setShowAddSubgroup(!showAddSubgroup)}
                    className="text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-0.5 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    Novo
                  </button>
                )}
              </div>

              {showAddSubgroup ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={newSubgroupName}
                    onChange={(e) => setNewSubgroupName(e.target.value)}
                    placeholder="Nome do novo subgrupo"
                    className="flex-1 px-2.5 py-2 text-xs rounded-lg border border-emerald-600 outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleCreateSubgroupInline}
                    className="px-2.5 py-2 bg-emerald-700 text-white rounded-lg text-xs font-bold hover:bg-emerald-800 cursor-pointer"
                  >
                    Salvar
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddSubgroup(false)}
                    className="px-2 py-2 bg-stone-200 text-stone-700 rounded-lg text-xs hover:bg-stone-300 cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <select
                  value={subgroupId}
                  onChange={(e) => setSubgroupId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm sm:text-base font-semibold rounded-lg border border-stone-300 bg-white text-stone-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none transition-all cursor-pointer"
                >
                  {availableSubgroups.length === 0 ? (
                    <option value="">Nenhum subgrupo cadastrado</option>
                  ) : (
                    availableSubgroups.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name}
                      </option>
                    ))
                  )}
                </select>
              )}
              <span className="text-[10px] text-stone-600 block mt-0.5">
                Subgrupos disponíveis em: <strong>{currentSector?.name}</strong>
              </span>
            </div>
          </div>

          {/* Forma de Pagamento */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              Forma de Pagamento *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {settings.paymentMethods.map((pay) => {
                const isSelected = paymentMethodId === pay.id;
                return (
                  <button
                    type="button"
                    key={pay.id}
                    onClick={() => setPaymentMethodId(pay.id)}
                    className={`min-h-[44px] px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all border text-left flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'border-emerald-700 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-600/30'
                        : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'
                    }`}
                  >
                    <div className="min-w-0 pr-1">
                      <span className="truncate block">{pay.name}</span>
                      {pay.isCreditCard && (
                        <span className="text-[10px] text-emerald-700 font-medium block">
                          Crédito{pay.dueDay ? ` · Dia ${pay.dueDay}` : ''}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-emerald-700 shrink-0 ml-1" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Campo Parcelas (Exibido quando a forma de pagamento é cartão de crédito em Novo Gasto) */}
          {!isEditing && isCreditCardSelected && (
            <div className="p-3.5 sm:p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-emerald-700" />
                  <span>Parcelas no Cartão de Crédito</span>
                </label>

                <select
                  value={installmentsCount}
                  onChange={(e) => setInstallmentsCount(parseInt(e.target.value, 10) || 1)}
                  className="px-3 py-2 text-xs sm:text-sm font-bold rounded-lg border border-emerald-400 bg-white text-stone-900 focus:border-emerald-700 outline-none cursor-pointer"
                >
                  {Array.from({ length: 24 }, (_, idx) => idx + 1).map((num) => {
                    const previewPerInst =
                      amountNumber > 0 ? ` — ${formatCurrency(amountNumber / num)}` : '';
                    return (
                      <option key={num} value={num}>
                        {num}x {num === 1 ? '(À vista no cartão)' : `parcelas${previewPerInst}`}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Prévia das parcelas */}
              {installmentPreview && (
                <div className="pt-2 border-t border-emerald-200/70 space-y-2">
                  <div className="text-xs sm:text-sm font-bold text-emerald-900 font-mono">
                    {installmentPreview.count}x de{' '}
                    {formatCurrency(installmentPreview.baseInstallmentValue)} (total{' '}
                    {formatCurrency(installmentPreview.total)})
                  </div>

                  {selectedPaymentMethod?.dueDay && installmentsCount > 1 && (
                    <p className="text-[11px] text-emerald-800">
                      1ª parcela na data informada ({formatDateBR(date)}) e seguintes no dia{' '}
                      <strong>{selectedPaymentMethod.dueDay}</strong> de cada mês.
                    </p>
                  )}

                  {/* Lista de datas e valores de cada parcela */}
                  <div className="max-h-36 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {installmentPreview.items.map((item) => (
                      <div
                        key={item.number}
                        className="px-2.5 py-1.5 rounded-lg bg-white border border-emerald-200/80 flex items-center justify-between text-xs"
                      >
                        <span className="font-semibold text-stone-700 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-emerald-700" />
                          <span>
                            {item.number}/{installmentPreview.count} · {formatDateBR(item.date)}
                          </span>
                        </span>
                        <span className="font-mono font-bold text-emerald-900">
                          {formatCurrency(item.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Observações / Notas Opcionais */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Observações / Fornecedor / Número da Nota (opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Ex.: Comprado na Cooperativa, NF 4829, pago pelo aplicativo"
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-stone-300 bg-white text-stone-900 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none transition-all placeholder:text-stone-400"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-stone-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[48px] px-4 py-2.5 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-100 font-semibold text-sm transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="min-h-[48px] px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm sm:text-base shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <Check className="w-5 h-5 stroke-[2.5]" />
              <span>
                {isEditing
                  ? 'Salvar Alterações'
                  : isCreditCardSelected && installmentsCount > 1
                  ? `Lançar ${installmentsCount} Parcelas`
                  : 'Confirmar Lançamento'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
