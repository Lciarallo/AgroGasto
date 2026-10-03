import React, { useState } from 'react';
import { PropertySettings, SectorItem, SubgroupItem, PaymentMethodItem, ExpenseRecord } from '../types';
import { generateId } from '../utils/formatters';
import {
  Layers,
  CreditCard,
  Building,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  AlertTriangle,
  Save,
  Download,
  Upload,
  AlertCircle,
  ShieldCheck,
  LogOut,
  User,
} from 'lucide-react';

interface SettingsViewProps {
  settings: PropertySettings;
  onSaveSettings: (newSettings: PropertySettings) => Promise<void> | void;
  expenses: ExpenseRecord[];
  onRenameSector: (sectorId: string, newName: string) => Promise<void> | void;
  onRenameSubgroup: (sectorId: string, subgroupId: string, newName: string) => Promise<void> | void;
  onRenamePaymentMethod: (paymentId: string, newName: string) => Promise<void> | void;
  onClearAllExpenses: () => Promise<void> | void;
  onRestoreJSON: (importedExpenses: ExpenseRecord[], importedSettings: PropertySettings) => Promise<void> | void;
  onDownloadCloudBackup: () => Promise<void>;
  lastBackupDate: string | null;
  userEmail: string | null;
  onLogOut: () => Promise<void> | void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
  expenses,
  onRenameSector,
  onRenameSubgroup,
  onRenamePaymentMethod,
  onClearAllExpenses,
  onRestoreJSON,
  onDownloadCloudBackup,
  lastBackupDate,
  userEmail,
  onLogOut,
}) => {
  // Property name state
  const [propertyName, setPropertyName] = useState(settings.propertyName);

  // Active sector tab in settings (to manage subgroups under that sector)
  const [selectedSectorId, setSelectedSectorId] = useState<string>(
    settings.sectors[0]?.id || ''
  );

  // Inline edit state for Sector
  const [editingSectorId, setEditingSectorId] = useState<string | null>(null);
  const [editingSectorName, setEditingSectorName] = useState('');
  const [newSectorName, setNewSectorName] = useState('');
  const [showAddSector, setShowAddSector] = useState(false);

  // Inline edit state for Subgroup
  const [editingSubgroupId, setEditingSubgroupId] = useState<string | null>(null);
  const [editingSubgroupName, setEditingSubgroupName] = useState('');
  const [newSubgroupName, setNewSubgroupName] = useState('');
  const [showAddSubgroup, setShowAddSubgroup] = useState(false);

  // Inline edit state for Payment Methods
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editingPaymentName, setEditingPaymentName] = useState('');
  const [editingPaymentIsCredit, setEditingPaymentIsCredit] = useState(false);
  const [editingPaymentDueDay, setEditingPaymentDueDay] = useState<string>('');

  const [newPaymentName, setNewPaymentName] = useState('');
  const [newPaymentIsCredit, setNewPaymentIsCredit] = useState(false);
  const [newPaymentDueDay, setNewPaymentDueDay] = useState<string>('');
  const [showAddPayment, setShowAddPayment] = useState(false);

  // Modal / Double confirmation state for deleting all expenses
  const [deleteAllStep, setDeleteAllStep] = useState<0 | 1 | 2>(0);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [isDownloadingBackup, setIsDownloadingBackup] = useState(false);

  // Alerts / Feedback
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  // Save property name
  const handleSavePropertyName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyName.trim()) return;
    await onSaveSettings({
      ...settings,
      propertyName: propertyName.trim(),
    });
    showFeedback('Nome da propriedade atualizado com sucesso!');
  };

  /* ================= SECTOR OPERATIONS ================= */
  const handleAddSector = async () => {
    if (!newSectorName.trim()) return;
    const newSector: SectorItem = {
      id: generateId('sec'),
      name: newSectorName.trim(),
      subgroups: [
        { id: generateId('sub'), name: 'Geral' },
        { id: generateId('sub'), name: 'Insumos' },
      ],
    };
    const updated = {
      ...settings,
      sectors: [...settings.sectors, newSector],
    };
    await onSaveSettings(updated);
    setNewSectorName('');
    setShowAddSector(false);
    setSelectedSectorId(newSector.id);
    showFeedback(`Setor "${newSector.name}" adicionado.`);
  };

  const handleStartEditSector = (sector: SectorItem) => {
    setEditingSectorId(sector.id);
    setEditingSectorName(sector.name);
  };

  const handleSaveEditSector = async (sectorId: string) => {
    const cleanName = editingSectorName.trim();
    if (!cleanName) return;

    await onRenameSector(sectorId, cleanName);
    setEditingSectorId(null);
    showFeedback('Setor e histórico na nuvem atualizados.');
  };

  const handleDeleteSector = async (sectorId: string) => {
    if (settings.sectors.length <= 1) {
      showFeedback('É necessário manter pelo menos um setor cadastrado.', 'error');
      return;
    }
    const sectorToDelete = settings.sectors.find((s) => s.id === sectorId);
    const linkedExpenses = expenses.filter((e) => e.sectorId === sectorId);

    if (linkedExpenses.length > 0) {
      const confirmDelete = window.confirm(
        `Existem ${linkedExpenses.length} lançamento(s) vinculados ao setor "${sectorToDelete?.name}". Tem certeza que deseja excluí-lo? Os lançamentos antigos continuarão salvos com o nome "${sectorToDelete?.name}".`
      );
      if (!confirmDelete) return;
    }

    const updatedSectors = settings.sectors.filter((s) => s.id !== sectorId);
    const updated = {
      ...settings,
      sectors: updatedSectors,
    };
    await onSaveSettings(updated);
    if (selectedSectorId === sectorId) {
      setSelectedSectorId(updatedSectors[0]?.id || '');
    }
    showFeedback('Setor excluído com sucesso.');
  };

  /* ================= SUBGROUP OPERATIONS ================= */
  const currentSector = settings.sectors.find((s) => s.id === selectedSectorId) || settings.sectors[0];

  const handleAddSubgroup = async () => {
    if (!newSubgroupName.trim() || !currentSector) return;
    const newSub: SubgroupItem = {
      id: generateId('sub'),
      name: newSubgroupName.trim(),
    };
    const updatedSectors = settings.sectors.map((s) => {
      if (s.id === currentSector.id) {
        return {
          ...s,
          subgroups: [...s.subgroups, newSub],
        };
      }
      return s;
    });
    await onSaveSettings({ ...settings, sectors: updatedSectors });
    setNewSubgroupName('');
    setShowAddSubgroup(false);
    showFeedback(`Subgrupo "${newSub.name}" adicionado em ${currentSector.name}.`);
  };

  const handleStartEditSubgroup = (subgroup: SubgroupItem) => {
    setEditingSubgroupId(subgroup.id);
    setEditingSubgroupName(subgroup.name);
  };

  const handleSaveEditSubgroup = async (subgroupId: string) => {
    const cleanName = editingSubgroupName.trim();
    if (!cleanName || !currentSector) return;

    await onRenameSubgroup(currentSector.id, subgroupId, cleanName);
    setEditingSubgroupId(null);
    showFeedback('Subgrupo e histórico na nuvem atualizados.');
  };

  const handleDeleteSubgroup = async (subgroupId: string) => {
    if (!currentSector) return;
    if (currentSector.subgroups.length <= 1) {
      showFeedback('Mantenha pelo menos um subgrupo neste setor.', 'error');
      return;
    }
    const subToDelete = currentSector.subgroups.find((s) => s.id === subgroupId);
    const linkedExpenses = expenses.filter((e) => e.subgroupId === subgroupId);

    if (linkedExpenses.length > 0) {
      const confirmDelete = window.confirm(
        `Existem ${linkedExpenses.length} lançamento(s) vinculados ao subgrupo "${subToDelete?.name}". Tem certeza que deseja excluí-lo? Os lançamentos antigos continuarão salvos com o nome "${subToDelete?.name}".`
      );
      if (!confirmDelete) return;
    }

    const updatedSectors = settings.sectors.map((s) => {
      if (s.id === currentSector.id) {
        return {
          ...s,
          subgroups: s.subgroups.filter((sub) => sub.id !== subgroupId),
        };
      }
      return s;
    });
    await onSaveSettings({ ...settings, sectors: updatedSectors });
    showFeedback('Subgrupo excluído com sucesso.');
  };

  /* ================= PAYMENT METHODS OPERATIONS ================= */
  const parseDueDay = (val: string): number | undefined => {
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 1 && num <= 31) {
      return num;
    }
    return undefined;
  };

  const handleAddPayment = async () => {
    if (!newPaymentName.trim()) return;
    const dueDayNum = newPaymentIsCredit ? parseDueDay(newPaymentDueDay) : undefined;
    const newPay: PaymentMethodItem = {
      id: generateId('pay'),
      name: newPaymentName.trim(),
      isCreditCard: newPaymentIsCredit,
      ...(dueDayNum !== undefined ? { dueDay: dueDayNum } : {}),
    };
    const updated = {
      ...settings,
      paymentMethods: [...settings.paymentMethods, newPay],
    };
    await onSaveSettings(updated);
    setNewPaymentName('');
    setNewPaymentIsCredit(false);
    setNewPaymentDueDay('');
    setShowAddPayment(false);
    showFeedback(`Forma de pagamento "${newPay.name}" adicionada.`);
  };

  const handleStartEditPayment = (pay: PaymentMethodItem) => {
    setEditingPaymentId(pay.id);
    setEditingPaymentName(pay.name);
    setEditingPaymentIsCredit(Boolean(pay.isCreditCard));
    setEditingPaymentDueDay(pay.dueDay ? String(pay.dueDay) : '');
  };

  const handleSaveEditPayment = async (paymentId: string) => {
    const cleanName = editingPaymentName.trim();
    if (!cleanName) return;

    const currentPay = settings.paymentMethods.find((p) => p.id === paymentId);
    const dueDayNum = editingPaymentIsCredit ? parseDueDay(editingPaymentDueDay) : undefined;

    const updatedMethods = settings.paymentMethods.map((p) => {
      if (p.id !== paymentId) return p;
      const updatedItem: PaymentMethodItem = {
        id: p.id,
        name: cleanName,
        isCreditCard: editingPaymentIsCredit,
      };
      if (dueDayNum !== undefined) {
        updatedItem.dueDay = dueDayNum;
      }
      return updatedItem;
    });

    await onSaveSettings({
      ...settings,
      paymentMethods: updatedMethods,
    });

    if (currentPay && currentPay.name !== cleanName) {
      await onRenamePaymentMethod(paymentId, cleanName);
    }

    setEditingPaymentId(null);
    showFeedback('Forma de pagamento atualizada com sucesso.');
  };

  const handleToggleCreditCardDirect = async (pay: PaymentMethodItem, isCredit: boolean) => {
    const updatedMethods = settings.paymentMethods.map((p) => {
      if (p.id !== pay.id) return p;
      const updatedItem: PaymentMethodItem = {
        id: p.id,
        name: p.name,
        isCreditCard: isCredit,
      };
      if (isCredit && p.dueDay) {
        updatedItem.dueDay = p.dueDay;
      }
      return updatedItem;
    });

    await onSaveSettings({
      ...settings,
      paymentMethods: updatedMethods,
    });
    showFeedback(
      isCredit
        ? `"${pay.name}" configurado como cartão de crédito.`
        : `"${pay.name}" desmarcado como cartão de crédito.`
    );
  };

  const handleChangeDueDayDirect = async (pay: PaymentMethodItem, dueDayStr: string) => {
    const dueDayNum = parseDueDay(dueDayStr);
    const updatedMethods = settings.paymentMethods.map((p) => {
      if (p.id !== pay.id) return p;
      const updatedItem: PaymentMethodItem = {
        id: p.id,
        name: p.name,
        isCreditCard: Boolean(p.isCreditCard),
      };
      if (dueDayNum !== undefined) {
        updatedItem.dueDay = dueDayNum;
      }
      return updatedItem;
    });

    await onSaveSettings({
      ...settings,
      paymentMethods: updatedMethods,
    });
    showFeedback(
      dueDayNum
        ? `Vencimento de "${pay.name}" definido para dia ${dueDayNum}.`
        : `Dia de vencimento de "${pay.name}" removido.`
    );
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (settings.paymentMethods.length <= 1) {
      showFeedback('Mantenha pelo menos uma forma de pagamento.', 'error');
      return;
    }
    const payToDelete = settings.paymentMethods.find((p) => p.id === paymentId);
    const linkedExpenses = expenses.filter((e) => e.paymentMethodId === paymentId);

    if (linkedExpenses.length > 0) {
      const confirmDelete = window.confirm(
        `Existem ${linkedExpenses.length} lançamento(s) vinculados a "${payToDelete?.name}". Tem certeza que deseja excluí-la? Os lançamentos antigos continuarão com o nome "${payToDelete?.name}".`
      );
      if (!confirmDelete) return;
    }

    const updated = {
      ...settings,
      paymentMethods: settings.paymentMethods.filter((p) => p.id !== paymentId),
    };
    await onSaveSettings(updated);
    showFeedback('Forma de pagamento excluída com sucesso.');
  };

  /* ================= BACKUP & RESTORE ================= */
  const handleExportCloudJSON = async () => {
    setIsDownloadingBackup(true);
    try {
      await onDownloadCloudBackup();
      showFeedback('Backup da nuvem baixado com sucesso!');
    } catch (err) {
      console.error('Erro ao gerar backup da nuvem:', err);
      showFeedback('Falha ao baixar backup da nuvem.', 'error');
    } finally {
      setIsDownloadingBackup(false);
    }
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (parsed.settings && Array.isArray(parsed.expenses)) {
          await onRestoreJSON(parsed.expenses, parsed.settings);
          showFeedback('Backup restaurado e sincronizado com a nuvem!');
        } else {
          showFeedback('Arquivo de backup inválido.', 'error');
        }
      } catch (err) {
        showFeedback('Erro ao processar arquivo JSON.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Backup status helper
  const getBackupStatus = () => {
    if (!lastBackupDate) {
      return {
        isOverdue: true,
        label: 'Nunca realizado',
        diffDays: null,
      };
    }
    const backupTime = new Date(lastBackupDate).getTime();
    const diffDays = Math.floor((Date.now() - backupTime) / (1000 * 60 * 60 * 24));
    const formattedDate = new Date(lastBackupDate).toLocaleDateString('pt-BR');
    const formattedTime = new Date(lastBackupDate).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    if (diffDays >= 7) {
      return {
        isOverdue: true,
        label: `${formattedDate} às ${formattedTime} (há ${diffDays} dias)`,
        diffDays,
      };
    }

    return {
      isOverdue: false,
      label:
        diffDays === 0
          ? `Hoje às ${formattedTime}`
          : `${formattedDate} às ${formattedTime} (há ${diffDays} ${diffDays === 1 ? 'dia' : 'dias'})`,
      diffDays,
    };
  };

  const backupStatus = getBackupStatus();

  return (
    <div className="space-y-6">
      {/* Feedback message banner */}
      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-xl border text-xs sm:text-sm font-semibold flex items-center gap-2 ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {feedbackMsg.type === 'success' ? (
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Conta de Usuário (Google Auth) */}
      <div className="bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 shrink-0 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-800 font-bold">
              <User className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-semibold text-stone-500 block uppercase tracking-wider">
                Conta Conectada (Google)
              </span>
              <strong className="text-sm sm:text-base text-stone-900 block truncate max-w-xs sm:max-w-md">
                {userEmail || 'Usuário autenticado'}
              </strong>
            </div>
          </div>

          <button
            onClick={onLogOut}
            className="min-h-[44px] px-4 py-2.5 rounded-xl border border-stone-300 hover:bg-red-50 hover:text-red-700 hover:border-red-300 text-stone-700 font-semibold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer self-start sm:self-auto"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair da Conta</span>
          </button>
        </div>
      </div>

      {/* Propriedade Rural: Nome */}
      <div className="bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-6 shadow-xs">
        <div className="flex items-center gap-2.5 mb-3 min-w-0">
          <div className="w-8 h-8 shrink-0 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800">
            <Building className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-stone-900 leading-tight">
              Identificação da Propriedade
            </h3>
            <p className="text-xs text-stone-500">
              Nome da fazenda, sítio ou chácara que aparecerá nos relatórios
            </p>
          </div>
        </div>

        <form onSubmit={handleSavePropertyName} className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            value={propertyName}
            onChange={(e) => setPropertyName(e.target.value)}
            placeholder="Ex.: Fazenda Boa Esperança, Sítio Três Meninas"
            className="flex-1 px-3.5 py-2.5 text-sm font-medium rounded-xl border border-stone-300 bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none"
          />
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs shrink-0"
          >
            <Save className="w-4 h-4" />
            <span>Salvar Nome</span>
          </button>
        </form>
      </div>

      {/* Gerenciamento de Setores e Subgrupos */}
      <div className="bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-200">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 shrink-0 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800">
              <Layers className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold text-stone-900 leading-tight">
                Setores & Subgrupos da Propriedade
              </h3>
              <p className="text-xs text-stone-500">
                Ao renomear um item, todos os lançamentos existentes serão atualizados automaticamente na nuvem
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAddSector(!showAddSector)}
            className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Adicionar Novo Setor</span>
          </button>
        </div>

        {/* Form to add new sector */}
        {showAddSector && (
          <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={newSectorName}
              onChange={(e) => setNewSectorName(e.target.value)}
              placeholder="Nome do novo setor (ex.: Café, Grãos, Silvicultura)"
              className="flex-1 px-3 py-2 text-xs sm:text-sm rounded-lg border border-emerald-400 bg-white outline-none"
              autoFocus
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddSector}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Salvar Setor
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddSector(false);
                  setNewSectorName('');
                }}
                className="px-3 py-2 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-lg text-xs cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Sectors Tabs selector */}
        <div>
          <label className="block text-xs font-bold text-stone-600 mb-2 uppercase tracking-wider">
            Selecione o setor para gerenciar seus subgrupos:
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {settings.sectors.map((sec) => {
              const isSelected = selectedSectorId === sec.id;
              const isEditingThis = editingSectorId === sec.id;

              if (isEditingThis) {
                return (
                  <div key={sec.id} className="flex items-center gap-1 bg-stone-100 p-1 rounded-lg">
                    <input
                      type="text"
                      value={editingSectorName}
                      onChange={(e) => setEditingSectorName(e.target.value)}
                      className="px-2 py-1 text-xs rounded border border-stone-300 bg-white"
                      autoFocus
                    />
                    <button
                      onClick={() => handleSaveEditSector(sec.id)}
                      className="p-1 text-emerald-700 hover:bg-emerald-100 rounded"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingSectorId(null)}
                      className="p-1 text-stone-500 hover:bg-stone-200 rounded"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              }

              return (
                <div
                  key={sec.id}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all border ${
                    isSelected
                      ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                      : 'bg-stone-50 hover:bg-stone-100 text-stone-800 border-stone-200'
                  }`}
                >
                  <button
                    onClick={() => setSelectedSectorId(sec.id)}
                    className="text-xs sm:text-sm font-semibold cursor-pointer text-left"
                  >
                    {sec.name}
                  </button>

                  <div className="flex items-center gap-0.5 ml-1.5 pl-1.5 border-l border-current/20">
                    <button
                      onClick={() => handleStartEditSector(sec)}
                      className="p-1 opacity-70 hover:opacity-100 rounded transition-opacity"
                      title="Renomear Setor (atualiza todo o histórico)"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    {settings.sectors.length > 1 && (
                      <button
                        onClick={() => handleDeleteSector(sec.id)}
                        className="p-1 opacity-70 hover:opacity-100 rounded transition-opacity"
                        title="Excluir Setor"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Subgroups of the selected sector */}
        {currentSector && (
          <div className="pt-4 border-t border-stone-100 space-y-3">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                  Subgrupos vinculados ao setor: <span className="text-emerald-800">{currentSector.name}</span>
                </h4>
                <p className="text-[11px] text-stone-500">
                  Estes subgrupos só aparecem no formulário quando {currentSector.name} for escolhido
                </p>
              </div>

              <button
                onClick={() => setShowAddSubgroup(!showAddSubgroup)}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shrink-0 whitespace-nowrap"
              >
                <Plus className="w-3 h-3" />
                <span>Novo Subgrupo</span>
              </button>
            </div>

            {/* Form to add new subgroup */}
            {showAddSubgroup && (
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={newSubgroupName}
                  onChange={(e) => setNewSubgroupName(e.target.value)}
                  placeholder={`Ex.: Insumos, Gasto de máquina, Equipamento...`}
                  className="flex-1 px-3 py-2 text-xs rounded-lg border border-stone-300 bg-white outline-none"
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddSubgroup}
                    className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold cursor-pointer"
                  >
                    Salvar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddSubgroup(false);
                      setNewSubgroupName('');
                    }}
                    className="px-2.5 py-2 bg-stone-200 text-stone-700 rounded-lg text-xs cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* List of subgroups */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {currentSector.subgroups.map((sub) => {
                const isEditingThis = editingSubgroupId === sub.id;

                if (isEditingThis) {
                  return (
                    <div
                      key={sub.id}
                      className="p-2.5 rounded-xl border border-emerald-400 bg-emerald-50/50 flex items-center gap-1.5"
                    >
                      <input
                        type="text"
                        value={editingSubgroupName}
                        onChange={(e) => setEditingSubgroupName(e.target.value)}
                        className="flex-1 px-2 py-1 text-xs rounded border border-stone-300 bg-white"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveEditSubgroup(sub.id)}
                        className="p-1 text-emerald-800 hover:bg-emerald-200 rounded"
                        title="Salvar"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingSubgroupId(null)}
                        className="p-1 text-stone-500 hover:bg-stone-200 rounded"
                        title="Cancelar"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                }

                return (
                  <div
                    key={sub.id}
                    className="p-2.5 rounded-xl border border-stone-200 bg-stone-50/60 hover:bg-stone-100 flex items-center justify-between gap-2"
                  >
                    <span className="text-xs font-semibold text-stone-800 truncate">{sub.name}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleStartEditSubgroup(sub)}
                        className="p-1 text-stone-500 hover:text-stone-800 hover:bg-stone-200 rounded cursor-pointer"
                        title="Renomear subgrupo (atualiza todo o histórico)"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      {currentSector.subgroups.length > 1 && (
                        <button
                          onClick={() => handleDeleteSubgroup(sub.id)}
                          className="p-1 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer"
                          title="Excluir subgrupo"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Gerenciamento de Formas de Pagamento */}
      <div className="bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-200">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 shrink-0 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800">
              <CreditCard className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold text-stone-900 leading-tight">
                Formas de Pagamento
              </h3>
              <p className="text-xs text-stone-500">
                Marque os cartões de crédito para habilitar o parcelamento e informe o dia de vencimento da fatura
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAddPayment(!showAddPayment)}
            className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Adicionar Forma de Pagamento</span>
          </button>
        </div>

        {/* Add payment form */}
        {showAddPayment && (
          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={newPaymentName}
                onChange={(e) => setNewPaymentName(e.target.value)}
                placeholder="Ex.: Cartão Sicoob, Cartão Cresol, Cheque, Débito BB"
                className="flex-1 px-3 py-2 text-xs sm:text-sm rounded-lg border border-stone-300 bg-white outline-none"
                autoFocus
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-4">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-stone-800 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newPaymentIsCredit}
                    onChange={(e) => setNewPaymentIsCredit(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-700 focus:ring-emerald-600 cursor-pointer"
                  />
                  <span>É cartão de crédito (permite parcelar)</span>
                </label>

                {newPaymentIsCredit && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-stone-600">
                      Dia de vencimento da fatura (1 a 31, opcional):
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={newPaymentDueDay}
                      onChange={(e) => setNewPaymentDueDay(e.target.value)}
                      placeholder="Ex.: 10"
                      className="w-20 px-2.5 py-1 text-xs rounded-lg border border-stone-300 bg-white font-mono"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddPayment}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  Salvar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddPayment(false);
                    setNewPaymentName('');
                    setNewPaymentIsCredit(false);
                    setNewPaymentDueDay('');
                  }}
                  className="px-3 py-2 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-lg text-xs cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* List of payment methods */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {settings.paymentMethods.map((pay) => {
            const isEditingThis = editingPaymentId === pay.id;

            if (isEditingThis) {
              return (
                <div
                  key={pay.id}
                  className="p-3.5 rounded-xl border border-emerald-500 bg-emerald-50/40 space-y-3"
                >
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={editingPaymentName}
                      onChange={(e) => setEditingPaymentName(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 text-xs sm:text-sm font-semibold rounded-lg border border-stone-300 bg-white"
                      autoFocus
                    />
                    <button
                      onClick={() => handleSaveEditPayment(pay.id)}
                      className="px-2.5 py-1.5 bg-emerald-700 text-white hover:bg-emerald-800 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                      title="Salvar"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Salvar</span>
                    </button>
                    <button
                      onClick={() => setEditingPaymentId(null)}
                      className="p-1.5 text-stone-500 hover:bg-stone-200 rounded-lg cursor-pointer"
                      title="Cancelar"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-2 pt-1 border-t border-emerald-200/60">
                    <label className="flex items-center gap-2 text-xs font-semibold text-stone-800 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={editingPaymentIsCredit}
                        onChange={(e) => setEditingPaymentIsCredit(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-700 focus:ring-emerald-600 cursor-pointer"
                      />
                      <span>É cartão de crédito (permite parcelar)</span>
                    </label>

                    {editingPaymentIsCredit && (
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-stone-600">
                          Dia de vencimento da fatura (1 a 31):
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={editingPaymentDueDay}
                          onChange={(e) => setEditingPaymentDueDay(e.target.value)}
                          placeholder="Opcional"
                          className="w-20 px-2 py-1 text-xs rounded border border-stone-300 bg-white font-mono"
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={pay.id}
                className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/60 hover:bg-stone-50 flex flex-col justify-between gap-2.5 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-xs sm:text-sm font-bold text-stone-900 block truncate">
                      {pay.name}
                    </span>
                    <span className="text-[11px] text-stone-500 block">
                      {pay.isCreditCard
                        ? `Cartão de crédito · ${
                            pay.dueDay ? `Vencimento todo dia ${pay.dueDay}` : 'Sem dia de vencimento fixo'
                          }`
                        : 'Pagamento à vista'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleStartEditPayment(pay)}
                      className="p-1.5 text-stone-500 hover:text-stone-800 hover:bg-stone-200 rounded-lg cursor-pointer"
                      title="Editar nome ou configurações do cartão"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {settings.paymentMethods.length > 1 && (
                      <button
                        onClick={() => handleDeletePayment(pay.id)}
                        className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Direct Credit Card Toggle & Due Day */}
                <div className="pt-2 border-t border-stone-200/70 flex flex-wrap items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-2 text-xs text-stone-700 font-medium cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={Boolean(pay.isCreditCard)}
                      onChange={(e) => handleToggleCreditCardDirect(pay, e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-700 focus:ring-emerald-600 cursor-pointer"
                    />
                    <span>É cartão de crédito (permite parcelar)</span>
                  </label>

                  {pay.isCreditCard && (
                    <div className="flex items-center gap-1.5">
                      <label className="text-[11px] text-stone-600 font-medium">
                        Vencimento (1-31):
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        defaultValue={pay.dueDay ?? ''}
                        onBlur={(e) => {
                          const newVal = e.target.value;
                          const currentVal = pay.dueDay ? String(pay.dueDay) : '';
                          if (newVal !== currentVal) {
                            handleChangeDueDayDirect(pay, newVal);
                          }
                        }}
                        placeholder="Dia"
                        className="w-16 px-2 py-1 text-xs rounded border border-stone-300 bg-white font-mono text-stone-900"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Backup & Segurança dos Dados */}
      <div className="bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900 leading-tight">
                Segurança & Backup dos Dados na Nuvem
              </h3>
              <p className="text-xs text-stone-500">
                Seus dados estão protegidos no Firebase sob sua conta Google. Você pode baixar uma cópia completa dos dados a qualquer momento.
              </p>
            </div>
          </div>
        </div>

        {/* Warning if backup is overdue (more than 7 days or never made) */}
        {backupStatus.isOverdue && (
          <div className="p-3.5 bg-amber-50 border border-amber-200/90 rounded-xl text-xs flex items-center gap-2.5 text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold">Faça um backup dos seus dados. </span>
              <span className="text-amber-800">
                {backupStatus.diffDays !== null
                  ? `Já se passaram ${backupStatus.diffDays} dias desde o último download de backup.`
                  : 'Recomendamos baixar uma cópia periodicamente para garantir que suas anotações estejam seguras.'}
              </span>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleExportCloudJSON}
              disabled={isDownloadingBackup}
              className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:bg-stone-300 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
            >
              {isDownloadingBackup ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Gerando backup da nuvem...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Baixar Backup Completo (JSON)</span>
                </>
              )}
            </button>

            <label className="px-4 py-2.5 rounded-xl border border-stone-300 hover:bg-stone-50 text-stone-800 text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-2xs transition-colors">
              <Upload className="w-4 h-4 text-emerald-700" />
              <span>Restaurar Backup na Nuvem (JSON)</span>
              <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
            </label>
          </div>

          <div className="text-xs text-stone-500">
            Último backup baixado:{' '}
            <strong className="text-stone-800 font-semibold">{backupStatus.label}</strong>
          </div>
        </div>

        {/* Zona de Perigo: Apagar todos os lançamentos com confirmação dupla */}
        <div className="pt-5 mt-5 border-t border-stone-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                Limpeza de Lançamentos na Nuvem
              </h4>
              <p className="text-xs text-stone-500">
                Apaga todos os registros de gastos na nuvem ({expenses.length} lançamentos). Setores e configurações são mantidos.
              </p>
            </div>

            {deleteAllStep === 0 && (
              <button
                type="button"
                onClick={() => setDeleteAllStep(1)}
                disabled={expenses.length === 0}
                className="px-3.5 py-2 rounded-xl text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed border border-red-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Apagar todos os lançamentos</span>
              </button>
            )}
          </div>

          {/* Double Confirmation Box */}
          {deleteAllStep === 1 && (
            <div className="mt-3 p-4 rounded-xl bg-red-50 border border-red-200 space-y-3">
              <div className="flex items-start gap-2.5 text-xs text-red-900">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-sm">Tem certeza que deseja apagar todos os {expenses.length} lançamentos na nuvem?</p>
                  <p className="mt-0.5 text-red-800">
                    Esta ação removerá todos os gastos cadastrados até o momento da sua conta Firebase.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setDeleteAllStep(0)}
                  className="px-3 py-1.5 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteAllStep(2)}
                  className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer shadow-xs"
                >
                  Continuar para Confirmação Final
                </button>
              </div>
            </div>
          )}

          {deleteAllStep === 2 && (
            <div className="mt-3 p-4 rounded-xl bg-red-100 border-2 border-red-400 space-y-3">
              <div className="flex items-start gap-2.5 text-xs text-red-950">
                <AlertTriangle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-black text-sm uppercase">Confirmação Definitiva:</p>
                  <p className="mt-0.5 text-red-900 font-medium">
                    Todos os lançamentos serão permanentemente apagados da nuvem sem possibilidade de recuperação.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setDeleteAllStep(0)}
                  disabled={isDeletingAll}
                  className="px-3 py-1.5 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-semibold cursor-pointer"
                >
                  Cancelar e Manter Dados
                </button>
                <button
                  type="button"
                  disabled={isDeletingAll}
                  onClick={async () => {
                    setIsDeletingAll(true);
                    try {
                      await onClearAllExpenses();
                      setDeleteAllStep(0);
                      showFeedback('Todos os lançamentos foram apagados da nuvem.');
                    } finally {
                      setIsDeletingAll(false);
                    }
                  }}
                  className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-bold cursor-pointer shadow-sm flex items-center gap-2"
                >
                  {isDeletingAll ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Apagando...</span>
                    </>
                  ) : (
                    <span>Sim, Apagar Tudo Definitivamente</span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
