import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useAnimate, useReducedMotion } from 'motion/react';
import './expense-composer.css';
import {
  AlertCircle, ArrowRight, CalendarDays, Check, CheckCircle2, ChevronDown,
  CreditCard, Loader2, Plus, ReceiptText, WifiOff, X,
} from 'lucide-react';
import type {
  ExpenseFormOrigin, ExpenseRecord, ExpenseSaveResult, InstallmentScope, PropertySettings,
} from '../types';
import {
  calculateInstallmentDates, formatCurrency, formatDateBR, formatInstallmentDescription,
  formatNumberBR, generateId, getTodayDateStr, splitAmountIntoInstallments,
  stripInstallmentSuffix,
} from '../utils/formatters';

type SaveCallbackResult = Promise<ExpenseSaveResult | void> | ExpenseSaveResult | void;

interface ExpenseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (expense: ExpenseRecord) => SaveCallbackResult;
  onSaveBatch?: (expenses: ExpenseRecord[]) => SaveCallbackResult;
  onUpdateInstallmentSeries?: (
    editedExpense: ExpenseRecord,
    scope: InstallmentScope,
    newTotalPurchaseAmount: number,
    dueDay?: number
  ) => SaveCallbackResult;
  initialData?: ExpenseRecord | null;
  settings: PropertySettings;
  onUpdateSettings?: (newSettings: PropertySettings) => Promise<void> | void;
  origin?: ExpenseFormOrigin | null;
  isOffline?: boolean;
}

type Field = 'amount' | 'description' | 'date' | 'sector' | 'subgroup' | 'payment';
type Phase = 'editing' | 'saving' | 'saved';

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? <p id={id} className="expense-field-error">{message}</p> : null;
}

// Live settings updates, including inline-created subgroups, must not reset a draft.
export function ExpenseFormModal({ isOpen, ...props }: ExpenseFormModalProps) {
  return isOpen ? <ExpenseComposer {...props} /> : null;
}

function ExpenseComposer({
  onClose, onSave, onSaveBatch, onUpdateInstallmentSeries, initialData,
  settings, onUpdateSettings, origin, isOffline = false,
}: Omit<ExpenseFormModalProps, 'isOpen'>) {
  const isEditing = Boolean(initialData);
  const isEditingInstallment = Boolean(initialData?.parcelamentoId || (initialData?.totalParcelas || 1) > 1);
  const firstSector = settings.sectors[0];
  const [date, setDate] = useState(initialData?.date || getTodayDateStr());
  const [description, setDescription] = useState(
    isEditingInstallment ? stripInstallmentSuffix(initialData?.description || '') : initialData?.description || ''
  );
  const [amount, setAmount] = useState(initialData?.amount || 0);
  const [amountInput, setAmountInput] = useState(initialData ? formatNumberBR(initialData.amount) : '');
  const [sectorId, setSectorId] = useState(initialData?.sectorId || firstSector?.id || '');
  const [subgroupId, setSubgroupId] = useState(initialData?.subgroupId || firstSector?.subgroups[0]?.id || '');
  const [paymentId, setPaymentId] = useState(initialData?.paymentMethodId || settings.paymentMethods[0]?.id || '');
  const [count, setCount] = useState(initialData?.totalParcelas || 1);
  const [scope, setScope] = useState<InstallmentScope>('single');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [phase, setPhase] = useState<Phase>('editing');
  const [saveError, setSaveError] = useState('');
  const [receipt, setReceipt] = useState<ExpenseSaveResult | null>(null);
  const [showAllInstallments, setShowAllInstallments] = useState(false);
  const [showAddSubgroup, setShowAddSubgroup] = useState(false);
  const [newSubgroup, setNewSubgroup] = useState('');
  const [addingSubgroup, setAddingSubgroup] = useState(false);
  const [subgroupError, setSubgroupError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const amountField = useRef<HTMLInputElement>(null);
  const receiptHeading = useRef<HTMLHeadingElement>(null);
  const focusNewDraft = useRef(false);
  const submitLock = useRef(false);
  const mounted = useRef(true);
  const saveGeneration = useRef(0);
  const closing = useRef(false);
  const [panel, animate] = useAnimate<HTMLDivElement>();
  const reducedMotion = useReducedMotion();

  const sector = settings.sectors.find((item) => item.id === sectorId);
  const subgroup = sector?.subgroups.find((item) => item.id === subgroupId);
  const payment = settings.paymentMethods.find((item) => item.id === paymentId);
  const archivedSector = !sector && initialData?.sectorId === sectorId;
  const archivedSubgroup = !subgroup && initialData?.sectorId === sectorId && initialData?.subgroupId === subgroupId;
  const archivedPayment = !payment && initialData?.paymentMethodId === paymentId;
  const sectorName = sector?.name || (archivedSector ? initialData?.sectorName : '') || '';
  const subgroupName = subgroup?.name || (archivedSubgroup ? initialData?.subgroupName : '') || '';
  const paymentName = payment?.name || (archivedPayment ? initialData?.paymentMethodName : '') || '';
  const isNewInstallment = !isEditing && Boolean(payment?.isCreditCard) && count > 1;
  const isSaving = phase === 'saving';

  useLayoutEffect(() => {
    const element = dialog.current;
    const content = panel.current;
    if (!element || !content) return;
    mounted.current = true;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.documentElement.style.overflow;
    const viewport = window.visualViewport;
    const fitViewport = () => {
      element.style.setProperty('--expense-viewport-height', `${viewport?.height || window.innerHeight}px`);
      element.style.setProperty('--expense-viewport-top', `${viewport?.offsetTop || 0}px`);
    };
    fitViewport();
    viewport?.addEventListener('resize', fitViewport);
    viewport?.addEventListener('scroll', fitViewport);
    window.addEventListener('resize', fitViewport);
    document.documentElement.style.overflow = 'hidden';
    element.showModal();
    heading.current?.focus({ preventScroll: true });
    const box = content.getBoundingClientRect();
    const start = origin ? {
      x: origin.x + origin.width / 2 - (box.x + box.width / 2),
      y: origin.y + origin.height / 2 - (box.y + box.height / 2),
      scaleX: Math.max(0.15, Math.min(1, origin.width / box.width)),
      scaleY: Math.max(0.08, Math.min(1, origin.height / box.height)),
    } : { x: 0, y: 16, scaleX: 0.98, scaleY: 0.98 };
    const animation = reducedMotion
      ? animate(content, { opacity: [0, 1] }, { duration: 0.1 })
      : animate(content, {
          x: [start.x, 0], y: [start.y, 0],
          scaleX: [start.scaleX, 1], scaleY: [start.scaleY, 1], opacity: [0.35, 1],
        }, { duration: 0.32, ease: [0.16, 1, 0.3, 1] });
    // Touch devices keep heading focus until a field is chosen, avoiding an early keyboard.
    animation.then(() => {
      if (!closing.current && document.activeElement === heading.current && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        amountField.current?.focus({ preventScroll: true });
      }
    });
    return () => {
      mounted.current = false;
      animation.stop();
      viewport?.removeEventListener('resize', fitViewport);
      viewport?.removeEventListener('scroll', fitViewport);
      window.removeEventListener('resize', fitViewport);
      element.close();
      document.documentElement.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [animate, origin, reducedMotion, panel]);

  const preview = useMemo(() => {
    if (isEditing || !payment?.isCreditCard) return null;
    const amounts = splitAmountIntoInstallments(Number.isFinite(amount) ? amount : 0, count);
    const dates = calculateInstallmentDates(date, count, payment.dueDay);
    return amounts.map((value, index) => ({ number: index + 1, amount: value, date: dates[index] }));
  }, [isEditing, payment?.isCreditCard, payment?.dueDay, amount, count, date]);

  const errors: Partial<Record<Field, string>> = {};
  if (!Number.isSafeInteger(Math.round(amount * 100)) || amount <= 0) errors.amount = 'Informe um valor maior que zero.';
  if (isNewInstallment && Math.round(amount * 100) < count) errors.amount = 'O valor precisa permitir pelo menos R$ 0,01 por parcela.';
  if (!description.trim()) errors.description = 'Descreva o que foi comprado ou pago.';
  if (description.trim().length > 250) errors.description = 'Use até 250 caracteres na descrição.';
  if (!isValidDate(date)) errors.date = 'Escolha uma data válida.';
  if (!sector && !archivedSector) errors.sector = 'Selecione um setor da propriedade.';
  if (!subgroup && !archivedSubgroup) errors.subgroup = 'Selecione um subgrupo deste setor.';
  if (!payment && !archivedPayment) errors.payment = 'Selecione uma forma de pagamento.';
  const valid = Object.keys(errors).length === 0;
  const visibleError = (field: Field) => submitted || touched[field] ? errors[field] : undefined;
  const touch = (field: Field) => setTouched((current) => ({ ...current, [field]: true }));

  const requestClose = async () => {
    if ((submitLock.current && phase !== 'saved') || closing.current) return;
    closing.current = true;
    if (panel.current) {
      await animate(panel.current, reducedMotion ? { opacity: 0 } : { opacity: 0, scaleX: 0.98, scaleY: 0.98 }, { duration: 0.12 });
    }
    onClose();
  };

  const containKeyboardFocus = (event: React.KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== 'Tab') return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]'
    )).filter((element) => element.getClientRects().length > 0);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (!first) {
      event.preventDefault();
      heading.current?.focus({ preventScroll: true });
    } else if (event.shiftKey && (document.activeElement === first || document.activeElement === heading.current)) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const updateAmount = (next: number) => {
    setAmount(next);
    setAmountInput(next > 0 ? formatNumberBR(next) : '');
    setSaveError('');
  };

  const selectScope = (next: InstallmentScope) => {
    setScope(next);
    updateAmount(next === 'single' ? initialData?.amount || 0 : initialData?.valorTotalCompra ?? (initialData?.amount || 0) * (initialData?.totalParcelas || 1));
  };

  const quickDate = (daysAgo: number) => {
    const next = new Date();
    next.setDate(next.getDate() - daysAgo);
    setDate(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`);
    touch('date');
  };

  const createSubgroup = async () => {
    if (!newSubgroup.trim() || !sector || !onUpdateSettings || addingSubgroup) return;
    setAddingSubgroup(true);
    setSubgroupError('');
    const item = { id: generateId('sub'), name: newSubgroup.trim() };
    try {
      await onUpdateSettings({
        ...settings,
        sectors: settings.sectors.map((entry) => entry.id === sector.id ? { ...entry, subgroups: [...entry.subgroups, item] } : entry),
      });
      setSubgroupId(item.id);
      setShowAddSubgroup(false);
      setNewSubgroup('');
    } catch {
      setSubgroupError('Não foi possível criar o subgrupo. Tente novamente.');
    } finally {
      setAddingSubgroup(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitLock.current || addingSubgroup) return;
    setSubmitted(true);
    if (!valid) {
      const firstInvalid = Object.keys(errors)[0];
      dialog.current?.querySelector<HTMLElement>(`[data-field="${firstInvalid}"]`)?.focus();
      return;
    }
    submitLock.current = true;
    const generation = ++saveGeneration.current;
    setPhase('saving');
    setSaveError('');
    const now = new Date().toISOString();
    const record: ExpenseRecord = {
      ...initialData,
      id: initialData?.id || generateId('exp'), date,
      description: isEditingInstallment ? formatInstallmentDescription(description.trim(), initialData?.numeroParcela || 1, initialData?.totalParcelas || 1) : description.trim(),
      amount: isEditingInstallment && scope !== 'single' ? initialData?.amount || 0 : amount,
      sectorId, sectorName, subgroupId, subgroupName,
      paymentMethodId: paymentId, paymentMethodName: paymentName,
      notes: notes.trim(), createdAt: initialData?.createdAt || now, updatedAt: now,
    };
    try {
      let result: ExpenseSaveResult | void;
      if (isEditingInstallment && scope !== 'single' && onUpdateInstallmentSeries) {
        result = await onUpdateInstallmentSeries(record, scope, amount, payment?.dueDay);
      } else if (isNewInstallment && preview) {
        const parcelamentoId = generateId('parc');
        const records = preview.map((item) => ({
          ...record, id: generateId('exp'), date: item.date, amount: item.amount,
          description: formatInstallmentDescription(description.trim(), item.number, count),
          parcelamentoId, numeroParcela: item.number, totalParcelas: count,
          valorTotalCompra: amount, dataCompra: date,
        }));
        if (onSaveBatch) result = await onSaveBatch(records);
        else {
          const results = await Promise.all(records.map((item) => onSave(item)));
          result = {
            status: results.some((item) => item?.status === 'pending') ? 'pending' : 'synced',
            completion: Promise.all(results.map((item) => item?.completion)).then(() => undefined),
          };
        }
      } else result = await onSave(record);
      setReceipt(result || { status: 'synced' });
      setPhase('saved');
      if (result?.status === 'pending' && result.completion) {
        void result.completion.then(
          () => {
            if (mounted.current && saveGeneration.current === generation) setReceipt({ status: 'synced' });
          },
          () => {
            if (!mounted.current || saveGeneration.current !== generation) return;
            submitLock.current = false;
            setReceipt(null);
            setPhase('editing');
            setSaveError('A sincronização falhou. Seus dados continuam aqui. Tente salvar novamente.');
            focusNewDraft.current = true;
          }
        );
      }
    } catch {
      submitLock.current = false;
      setPhase('editing');
      setSaveError('Não foi possível salvar. Seus dados continuam aqui. Tente novamente.');
    }
  };

  const startAnother = () => {
    setDate(getTodayDateStr()); setDescription(''); updateAmount(0); setNotes('');
    setCount(1); setScope('single'); setTouched({}); setSubmitted(false);
    setReceipt(null); setPhase('editing'); setShowAllInstallments(false);
    submitLock.current = false;
    saveGeneration.current++;
    focusNewDraft.current = true;
  };

  const amountLabel = (isEditingInstallment && scope !== 'single') || isNewInstallment ? 'Valor total da compra' : isEditingInstallment ? 'Valor desta parcela' : 'Valor do gasto';
  const title = isEditingInstallment ? `Editar parcela ${initialData?.numeroParcela || 1}/${initialData?.totalParcelas || 1}` : isEditing ? 'Editar lançamento' : 'Novo lançamento';

  return (
    <dialog
      ref={dialog} className="expense-dialog" aria-modal="true" aria-labelledby="expense-title" aria-describedby="expense-subtitle"
      onKeyDown={containKeyboardFocus}
      onCancel={(event) => { event.preventDefault(); void requestClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) void requestClose(); }}
    >
      <div ref={panel} className="expense-panel">
        <header className="expense-panel-header">
          <div className="flex items-center gap-3 min-w-0">
            <div className="expense-header-icon"><ReceiptText className="size-5" aria-hidden="true" /></div>
            <div>
              <h2 id="expense-title" ref={heading} tabIndex={-1} className="text-lg font-bold text-stone-900 outline-none">{title}</h2>
              <p id="expense-subtitle" className="text-sm text-stone-600">{phase === 'saved' ? 'Tudo pronto. Você pode continuar.' : 'Do campo para o seu controle de gastos.'}</p>
            </div>
          </div>
          <button type="button" onClick={() => void requestClose()} disabled={isSaving} className="expense-icon-button" aria-label="Fechar lançamento"><X className="size-5" aria-hidden="true" /></button>
        </header>

        <AnimatePresence mode="wait" initial={false}>
          {phase === 'saved' && receipt ? (
            <motion.div key="receipt" className="expense-receipt" initial={{ opacity: 0, y: reducedMotion ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} onAnimationComplete={() => receiptHeading.current?.focus({ preventScroll: true })}>
              <div className="expense-receipt-mark" aria-hidden="true">
                <motion.svg viewBox="0 0 48 48" fill="none" className="size-12">
                  <circle cx="24" cy="24" r="21" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                  <motion.path d="m14 24 7 7 13-14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: reducedMotion ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3 }} />
                </motion.svg>
              </div>
              <div role="status">
                <h3 ref={receiptHeading} tabIndex={-1} className="text-xl font-bold text-stone-900 outline-none">{receipt.status === 'pending' ? 'Lançamento registrado' : isEditing ? 'Lançamento atualizado' : 'Gasto salvo'}</h3>
                <p className="mt-2 text-sm text-stone-600">{receipt.status === 'pending' ? 'Registrado neste dispositivo. Aguardando sincronização com a nuvem.' : isNewInstallment ? `${count} parcelas salvas na nuvem.` : 'Salvo na nuvem com sucesso.'}</p>
              </div>
              <div className="expense-receipt-value">{formatCurrency(amount)}</div>
              <p className="text-base font-semibold text-stone-800 break-words">{description}</p>
              <p className="mt-1 text-sm text-stone-600 break-words">{sectorName} · {paymentName}{isNewInstallment ? ` · ${count} parcelas` : ''}</p>
              <div className="expense-receipt-actions">
                {!isEditing && <button type="button" className="expense-secondary-button" onClick={startAnother}><Plus className="size-4" aria-hidden="true" />Lançar outro gasto</button>}
                <button type="button" className="expense-primary-button" onClick={() => void requestClose()}>Concluir<ArrowRight className="size-4" aria-hidden="true" /></button>
              </div>
            </motion.div>
          ) : (
            <motion.form key="draft" onSubmit={handleSubmit} noValidate className="expense-form" aria-busy={isSaving} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }} onAnimationComplete={() => { if (focusNewDraft.current) { amountField.current?.focus({ preventScroll: true }); focusNewDraft.current = false; } }}>
              <div className="expense-form-scroll">
                <fieldset disabled={isSaving} className="expense-fields">
                  {isEditingInstallment && onUpdateInstallmentSeries && (
                    <fieldset className="expense-scope">
                      <legend className="expense-label">Aplicar alterações a</legend>
                      <div className="expense-scope-options">
                        {([{ value: 'single', label: 'Esta parcela' }, { value: 'this_and_next', label: 'Esta e as próximas' }, { value: 'all', label: 'Toda a compra' }] as const).map((item) => (
                          <label className="expense-choice" key={item.value}>
                            <input type="radio" name="expense-scope" value={item.value} checked={scope === item.value} onChange={() => selectScope(item.value)} />
                            <span>{item.label}</span>
                          </label>
                        ))}
                      </div>
                      <p className="expense-help">{scope === 'single' ? 'Alterar só esta parcela pode mudar a soma das parcelas da compra.' : 'O valor total será redistribuído entre as parcelas selecionadas.'}</p>
                    </fieldset>
                  )}

                  <div>
                    <label htmlFor="expense-amount" className="expense-label">{amountLabel} <span aria-hidden="true">*</span></label>
                    <div className={`expense-amount-input ${visibleError('amount') ? 'has-error' : ''}`}>
                      <span aria-hidden="true">R$</span>
                      <input ref={amountField} id="expense-amount" data-field="amount" type="text" inputMode="numeric" autoComplete="off" value={amountInput} placeholder="0,00" aria-required="true" aria-invalid={Boolean(visibleError('amount'))} aria-describedby={visibleError('amount') ? 'expense-amount-error' : 'expense-amount-help'} onBlur={() => touch('amount')} onChange={(event) => { const digits = event.target.value.replace(/\D/g, '').slice(0, 13); updateAmount(digits ? Number(digits) / 100 : 0); }} />
                      {amount > 0 && !errors.amount && <CheckCircle2 className="size-5 text-emerald-700 shrink-0" aria-hidden="true" />}
                    </div>
                    <FieldError id="expense-amount-error" message={visibleError('amount')} />
                    <p id="expense-amount-help" className="sr-only">Digite o valor em centavos. Por exemplo, 1250 corresponde a R$ 12,50.</p>
                    <div className="expense-quick-amounts" aria-label="Adicionar ao valor">
                      {[50, 100, 500, 1000].map((value) => <button key={value} type="button" onClick={() => updateAmount(amount + value)}>+ {formatCurrency(value)}</button>)}
                      {amount > 0 && <button type="button" onClick={() => updateAmount(0)}>Zerar</button>}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="expense-description" className="expense-label">Descrição do gasto <span aria-hidden="true">*</span></label>
                    <input id="expense-description" data-field="description" type="text" value={description} maxLength={250} placeholder="Ex.: Adubo para o bananal" className="expense-input" aria-required="true" aria-invalid={Boolean(visibleError('description'))} aria-describedby={visibleError('description') ? 'expense-description-error' : undefined} onBlur={() => touch('description')} onChange={(event) => { setDescription(event.target.value); setSaveError(''); }} />
                    <FieldError id="expense-description-error" message={visibleError('description')} />
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <label htmlFor="expense-date" className="expense-label mb-0">{isNewInstallment ? 'Data da compra / 1ª parcela' : 'Data do gasto'} <span aria-hidden="true">*</span></label>
                      <div className="expense-quick-dates">{['Hoje', 'Ontem', 'Anteontem'].map((label, index) => <button key={label} type="button" onClick={() => quickDate(index)}>{label}</button>)}</div>
                    </div>
                    <input id="expense-date" data-field="date" type="date" value={date} className="expense-input" aria-required="true" aria-invalid={Boolean(visibleError('date'))} aria-describedby={visibleError('date') ? 'expense-date-error' : undefined} onBlur={() => touch('date')} onChange={(event) => setDate(event.target.value)} />
                    <FieldError id="expense-date-error" message={visibleError('date')} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="expense-sector" className="expense-label">Setor <span aria-hidden="true">*</span></label>
                      <select id="expense-sector" data-field="sector" value={sectorId} className="expense-input" aria-required="true" aria-invalid={Boolean(visibleError('sector'))} aria-describedby={visibleError('sector') ? 'expense-sector-error' : undefined} onBlur={() => touch('sector')} onChange={(event) => { const id = event.target.value; setSectorId(id); setSubgroupId(settings.sectors.find((item) => item.id === id)?.subgroups[0]?.id || ''); }}>
                        {settings.sectors.length === 0 && <option value="">Cadastre um setor</option>}
                        {archivedSector && <option value={sectorId}>{sectorName} (arquivado)</option>}
                        {settings.sectors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                      <FieldError id="expense-sector-error" message={visibleError('sector')} />
                    </div>
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <label htmlFor="expense-subgroup" className="expense-label mb-0">Subgrupo <span aria-hidden="true">*</span></label>
                        {onUpdateSettings && sector && <button type="button" className="expense-text-button" onClick={() => setShowAddSubgroup(!showAddSubgroup)} aria-expanded={showAddSubgroup} aria-controls="expense-new-subgroup"><Plus className="size-3.5" aria-hidden="true" />Novo</button>}
                      </div>
                      <select id="expense-subgroup" data-field="subgroup" value={subgroupId} className="expense-input" aria-required="true" aria-invalid={Boolean(visibleError('subgroup'))} aria-describedby={visibleError('subgroup') ? 'expense-subgroup-error' : undefined} onBlur={() => touch('subgroup')} onChange={(event) => setSubgroupId(event.target.value)}>
                        {!sector?.subgroups.length && !archivedSubgroup && <option value="">Cadastre um subgrupo</option>}
                        {archivedSubgroup && <option value={subgroupId}>{subgroupName} (arquivado)</option>}
                        {sector?.subgroups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                      <FieldError id="expense-subgroup-error" message={visibleError('subgroup')} />
                    </div>
                  </div>
                  {showAddSubgroup && (
                    <div id="expense-new-subgroup" className="expense-inline-subgroup">
                      <label htmlFor="expense-subgroup-name" className="expense-label">Novo subgrupo em {sectorName}</label>
                      <div className="flex flex-wrap gap-2">
                        <input id="expense-subgroup-name" className="expense-input flex-1 min-w-0" placeholder="Nome do subgrupo" value={newSubgroup} maxLength={100} disabled={addingSubgroup} onChange={(event) => setNewSubgroup(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void createSubgroup(); } }} />
                        <button type="button" className="expense-secondary-button" disabled={addingSubgroup || !newSubgroup.trim()} onClick={() => void createSubgroup()}>{addingSubgroup ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}Adicionar</button>
                        <button type="button" className="expense-icon-button" disabled={addingSubgroup} aria-label="Cancelar novo subgrupo" onClick={() => setShowAddSubgroup(false)}><X className="size-4" aria-hidden="true" /></button>
                      </div>
                      {subgroupError && <p className="expense-field-error" role="alert">{subgroupError}</p>}
                    </div>
                  )}

                  <fieldset aria-describedby={visibleError('payment') ? 'expense-payment-error' : undefined}>
                    <legend className="expense-label">Forma de pagamento <span aria-hidden="true">*</span></legend>
                    <div className="expense-payments" data-field="payment" tabIndex={-1}>
                      {archivedPayment && <label className="expense-choice"><input type="radio" name="expense-payment" value={paymentId} checked readOnly /><span>{paymentName} (arquivado)</span></label>}
                      {settings.paymentMethods.map((item) => (
                        <label key={item.id} className="expense-choice">
                          <input type="radio" name="expense-payment" value={item.id} checked={paymentId === item.id} onChange={() => { setPaymentId(item.id); if (!isEditing && !item.isCreditCard) setCount(1); touch('payment'); }} />
                          <span><span className="block">{item.name}</span>{item.isCreditCard && <span className="expense-choice-detail">Crédito{item.dueDay ? ` · dia ${item.dueDay}` : ''}</span>}</span>
                        </label>
                      ))}
                    </div>
                    <FieldError id="expense-payment-error" message={visibleError('payment')} />
                  </fieldset>

                  {!isEditing && payment?.isCreditCard && (
                    <div className="expense-installment-control">
                      <label htmlFor="expense-installments" className="expense-label mb-0 flex items-center gap-2"><CreditCard className="size-4" aria-hidden="true" />Parcelas no cartão</label>
                      <select id="expense-installments" value={count} className="expense-input" onChange={(event) => { setCount(Number(event.target.value)); setShowAllInstallments(false); }}>
                        {Array.from({ length: 24 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value === 1 ? '1x · à vista no cartão' : `${value} parcelas`}</option>)}
                      </select>
                    </div>
                  )}

                  <details className="expense-notes" open={notes ? true : undefined}>
                    <summary><span>Observações <span className="font-normal text-stone-600">(opcional)</span></span><ChevronDown className="size-4" aria-hidden="true" /></summary>
                    <label htmlFor="expense-notes" className="sr-only">Observações, fornecedor ou número da nota</label>
                    <textarea id="expense-notes" value={notes} maxLength={500} rows={2} className="expense-input mt-3" placeholder="Fornecedor, número da nota ou outra anotação" onChange={(event) => setNotes(event.target.value)} />
                  </details>
                </fieldset>

                <aside className="expense-review" aria-label="Prévia do lançamento">
                  <h3 className="text-sm font-bold text-stone-900">Confira seu lançamento</h3>
                  <p className="expense-review-amount">{formatCurrency(amount)}</p>
                  <p className="text-sm font-semibold text-stone-800 break-words">{description.trim() || 'Descrição do gasto'}</p>
                  <dl className="expense-review-details">
                    <div><dt><CalendarDays className="size-4" aria-hidden="true" />Data</dt><dd>{isValidDate(date) ? formatDateBR(date) : 'Escolha uma data'}</dd></div>
                    <div><dt>Setor</dt><dd>{sectorName || 'Selecione'}{subgroupName && <span className="block text-stone-600 font-normal">{subgroupName}</span>}</dd></div>
                    <div><dt>Pagamento</dt><dd>{paymentName || 'Selecione'}{isNewInstallment && <span className="block text-stone-600 font-normal">{count} parcelas</span>}</dd></div>
                  </dl>
                  {preview && count > 1 && (
                    <section className="expense-installment-preview" aria-label="Prévia das parcelas">
                      <div className="flex items-center justify-between gap-2 mb-3"><h4 className="text-sm font-bold text-stone-900">Vencimentos</h4><span className="text-xs font-semibold text-stone-600">{count} parcelas</span></div>
                      <ol id="expense-preview-list">
                        {(showAllInstallments ? preview : preview.slice(0, 3)).map((item) => <li key={item.number}><span className="expense-installment-number">{item.number}</span><span className="text-xs text-stone-700">{formatDateBR(item.date)}</span><strong className="text-xs font-mono tabular-nums text-stone-900">{formatCurrency(item.amount)}</strong></li>)}
                      </ol>
                      {count > 3 && <button type="button" className="expense-text-button mt-3" aria-expanded={showAllInstallments} aria-controls="expense-preview-list" disabled={isSaving} onClick={() => setShowAllInstallments(!showAllInstallments)}>{showAllInstallments ? 'Mostrar menos' : `Ver as ${count} parcelas`}<ChevronDown className={`size-3.5 ${showAllInstallments ? 'rotate-180' : ''}`} aria-hidden="true" /></button>}
                      {preview[0].amount !== preview[preview.length - 1].amount && <p className="expense-help mt-3">O ajuste de centavos fica na primeira parcela. A soma é {formatCurrency(amount)}.</p>}
                      {payment?.dueDay && <p className="expense-help mt-2">Primeira parcela na data informada; seguintes no dia {payment.dueDay} de cada mês.</p>}
                    </section>
                  )}
                  {isOffline && <p className="expense-offline-note"><WifiOff className="size-4 shrink-0" aria-hidden="true" /><span>Sem sinal. O lançamento ficará aguardando sincronização.</span></p>}
                </aside>
              </div>

              <footer className="expense-form-footer">
                {saveError && <div role="alert" className="expense-save-error"><AlertCircle className="size-4 shrink-0" aria-hidden="true" /><span>{saveError}</span></div>}
                <div className="expense-footer-status" role="status">
                  {isSaving ? <><Loader2 className="size-4 animate-spin" aria-hidden="true" /><span>{isOffline ? 'Registrando no dispositivo…' : 'Salvando lançamento…'}</span></> : valid ? <><CheckCircle2 className="size-4 text-emerald-700" aria-hidden="true" /><span>Pronto para salvar</span></> : <><ReceiptText className="size-4" aria-hidden="true" /><span>Preencha os campos obrigatórios</span></>}
                </div>
                <div className="expense-footer-actions">
                  <button type="button" className="expense-secondary-button" onClick={() => void requestClose()} disabled={isSaving}>Cancelar</button>
                  <button type="submit" className="expense-primary-button" disabled={isSaving || addingSubgroup}>
                    {isSaving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}
                    {isSaving ? 'Salvando…' : isEditing ? 'Salvar alterações' : isNewInstallment ? `Lançar ${count} parcelas` : 'Salvar gasto'}
                  </button>
                </div>
              </footer>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </dialog>
  );
}
