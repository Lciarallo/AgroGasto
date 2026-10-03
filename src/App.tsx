import React, { useState, useEffect, useMemo } from 'react';
import {
  ExpenseRecord,
  PropertySettings,
  FilterState,
  ActiveTab,
  PeriodFilterOption,
  InstallmentScope,
} from './types';
import { DEFAULT_SETTINGS, loadSettings } from './utils/storage';
import { useAuth } from './firebase/AuthContext';
import {
  subscribeToPropertyConfig,
  savePropertyConfig,
  subscribeToExpenses,
  subscribeToUpcomingInstallments,
  saveExpenseToFirestore,
  saveExpensesBatchToFirestore,
  updateInstallmentSeriesInFirestore,
  deleteInstallmentSeriesFromFirestore,
  batchUpdateExpensesForRename,
  clearAllExpensesFromFirestore,
  fetchAllUserExpensesForBackup,
  restoreAllExpensesToFirestore,
  migrateLocalDataToCloud,
} from './firebase/firestoreService';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { ExpenseList } from './components/ExpenseList';
import { ExpenseFilters } from './components/ExpenseFilters';
import { ExpenseFormModal } from './components/ExpenseFormModal';
import { TotaisSummary } from './components/TotalsSummary';
import { SettingsView } from './components/SettingsView';
import { ExportModal } from './components/ExportModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { LoginView } from './components/LoginView';
import { LocalMigrationModal } from './components/LocalMigrationModal';
import { formatCurrency, downloadFile } from './utils/formatters';
import { Plus, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function App() {
  const { user, loading: authLoading, logOut } = useAuth();

  // Application Data States (Synced from Firestore)
  const [settings, setSettings] = useState<PropertySettings>(DEFAULT_SETTINGS);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [upcomingInstallments, setUpcomingInstallments] = useState<ExpenseRecord[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);

  // Network & Offline Cache Status
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [hasPendingSync, setHasPendingSync] = useState(false);

  // Navigation State
  const [activeTab, setActiveTab] = useState<ActiveTab>('expenses');

  // Modal States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<ExpenseRecord | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);

  // Local storage migration state
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [localDataToMigrate, setLocalDataToMigrate] = useState<{
    expenses: ExpenseRecord[];
    settings: PropertySettings;
  } | null>(null);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(
    null
  );

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Filter State (defaults to 'this_month')
  const [filters, setFilters] = useState<FilterState>({
    period: 'this_month',
    customStartDate: '',
    customEndDate: '',
    sectorId: 'all',
    subgroupId: 'all',
    paymentMethodId: 'all',
    searchQuery: '',
    onlyInstallments: false,
  });

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Check for local storage data to propose migration on first login
  useEffect(() => {
    if (user) {
      const migrationDoneKey = `agrogasto_migrated_${user.uid}`;
      const alreadyMigrated = localStorage.getItem(migrationDoneKey) === 'true';

      if (!alreadyMigrated) {
        try {
          const rawLocalExp = localStorage.getItem('agrogasto_expenses_v1');
          const localExp = rawLocalExp ? JSON.parse(rawLocalExp) : [];
          const localSettings = loadSettings();

          if (Array.isArray(localExp) && localExp.length > 0) {
            setLocalDataToMigrate({
              expenses: localExp,
              settings: localSettings,
            });
            setShowMigrationModal(true);
          }
        } catch (e) {
          console.warn('Erro ao verificar dados locais para migração:', e);
        }
      }
    }
  }, [user]);

  // Real-time synchronization with Firestore (Settings, Period Expenses & Upcoming Installments)
  useEffect(() => {
    if (!user) {
      setExpenses([]);
      setUpcomingInstallments([]);
      setIsDataLoading(false);
      return;
    }

    setIsDataLoading(true);

    // 1. Subscribe to Property Settings (users/{uid}/config/propriedade)
    const unsubscribeConfig = subscribeToPropertyConfig(
      user.uid,
      (newSettings) => {
        setSettings(newSettings);
      },
      (err) => {
        console.error('Erro na sincronização de configurações:', err);
        showToast('Erro ao carregar configurações da nuvem.', 'error');
      }
    );

    // 2. Subscribe to Expenses (users/{uid}/gastos) filtered by period for read economy
    const unsubscribeExpenses = subscribeToExpenses(
      user.uid,
      filters.period,
      filters.customStartDate,
      filters.customEndDate,
      (newExpenses, meta) => {
        setExpenses(newExpenses);
        setHasPendingSync(meta.hasPendingWrites);
        setIsDataLoading(false);
      },
      (err) => {
        console.error('Erro na sincronização de despesas:', err);
        showToast('Erro ao sincronizar despesas.', 'error');
        setIsDataLoading(false);
      }
    );

    // 3. Subscribe to upcoming installments for Summary "Parcelas a pagar"
    const unsubscribeUpcoming = subscribeToUpcomingInstallments(
      user.uid,
      (installments) => {
        setUpcomingInstallments(installments);
      },
      (err) => {
        console.error('Erro ao carregar parcelas futuras:', err);
      }
    );

    return () => {
      unsubscribeConfig();
      unsubscribeExpenses();
      unsubscribeUpcoming();
    };
  }, [user, filters.period, filters.customStartDate, filters.customEndDate]);

  // Handle setting updates
  const handleUpdateSettings = async (newSettings: PropertySettings) => {
    if (!user) return;
    try {
      await savePropertyConfig(user.uid, newSettings);
      setSettings(newSettings);
    } catch (err) {
      console.error('Erro ao salvar configurações:', err);
      showToast('Erro ao salvar configurações na nuvem.', 'error');
    }
  };

  // 1. Synchronized rename: Sector with writeBatch in Firestore
  const handleRenameSector = async (sectorId: string, newName: string) => {
    if (!user) return;
    const cleanName = newName.trim();
    if (!cleanName) return;

    try {
      const newSettings: PropertySettings = {
        ...settings,
        sectors: settings.sectors.map((sec) =>
          sec.id === sectorId ? { ...sec, name: cleanName } : sec
        ),
      };
      await savePropertyConfig(user.uid, newSettings);

      await batchUpdateExpensesForRename(user.uid, 'sectorId', sectorId, 'sectorName', cleanName);
      showToast(`Setor "${cleanName}" e histórico atualizados na nuvem.`);
    } catch (err) {
      console.error('Erro ao renomear setor:', err);
      showToast('Erro ao renomear setor no Firestore.', 'error');
    }
  };

  // 1. Synchronized rename: Subgroup with writeBatch in Firestore
  const handleRenameSubgroup = async (sectorId: string, subgroupId: string, newName: string) => {
    if (!user) return;
    const cleanName = newName.trim();
    if (!cleanName) return;

    try {
      const newSettings: PropertySettings = {
        ...settings,
        sectors: settings.sectors.map((sec) => {
          if (sec.id === sectorId) {
            return {
              ...sec,
              subgroups: sec.subgroups.map((sub) =>
                sub.id === subgroupId ? { ...sub, name: cleanName } : sub
              ),
            };
          }
          return sec;
        }),
      };
      await savePropertyConfig(user.uid, newSettings);

      await batchUpdateExpensesForRename(user.uid, 'subgroupId', subgroupId, 'subgroupName', cleanName);
      showToast(`Subgrupo "${cleanName}" e histórico atualizados na nuvem.`);
    } catch (err) {
      console.error('Erro ao renomear subgrupo:', err);
      showToast('Erro ao renomear subgrupo no Firestore.', 'error');
    }
  };

  // 1. Synchronized rename: Payment Method with writeBatch in Firestore
  const handleRenamePaymentMethod = async (paymentId: string, newName: string) => {
    if (!user) return;
    const cleanName = newName.trim();
    if (!cleanName) return;

    try {
      const newSettings: PropertySettings = {
        ...settings,
        paymentMethods: settings.paymentMethods.map((pay) =>
          pay.id === paymentId ? { ...pay, name: cleanName } : pay
        ),
      };
      await savePropertyConfig(user.uid, newSettings);

      await batchUpdateExpensesForRename(
        user.uid,
        'paymentMethodId',
        paymentId,
        'paymentMethodName',
        cleanName
      );
      showToast(`Forma de pagamento "${cleanName}" e histórico atualizados na nuvem.`);
    } catch (err) {
      console.error('Erro ao renomear forma de pagamento:', err);
      showToast('Erro ao renomear forma de pagamento no Firestore.', 'error');
    }
  };

  // Download complete JSON Backup from Cloud
  const handleDownloadCloudBackup = async () => {
    if (!user) return;
    const allExpenses = await fetchAllUserExpensesForBackup(user.uid);
    const nowIso = new Date().toISOString();

    const backupData = {
      version: '2.1',
      exportedAt: nowIso,
      userEmail: user.email,
      settings: {
        ...settings,
        lastBackupDate: nowIso,
      },
      expenses: allExpenses,
    };

    const jsonStr = JSON.stringify(backupData, null, 2);
    const fileName = `backup_agrogasto_nuvem_${nowIso.slice(0, 10)}.json`;
    downloadFile(jsonStr, fileName, 'application/json;charset=utf-8;');

    await savePropertyConfig(user.uid, {
      ...settings,
      lastBackupDate: nowIso,
    });
    showToast('Backup da nuvem gerado com sucesso!');
  };

  // Restore JSON Backup into Cloud
  const handleRestoreJSON = async (
    importedExpenses: ExpenseRecord[],
    importedSettings: PropertySettings
  ) => {
    if (!user) return;
    try {
      await restoreAllExpensesToFirestore(user.uid, importedExpenses, importedSettings);
      showToast('Backup restaurado e sincronizado com o Firebase!');
    } catch (err) {
      console.error('Erro ao restaurar backup:', err);
      showToast('Falha ao restaurar dados na nuvem.', 'error');
    }
  };

  // Clear all cloud expenses (Double-confirmed in SettingsView)
  const handleClearAllExpenses = async () => {
    if (!user) return;
    try {
      await clearAllExpensesFromFirestore(user.uid);
      showToast('Todos os lançamentos foram apagados da nuvem.');
    } catch (err) {
      console.error('Erro ao apagar lançamentos da nuvem:', err);
      showToast('Erro ao apagar despesas no Firestore.', 'error');
    }
  };

  // Create or Update Single Expense in Firestore
  const handleSaveExpense = async (record: ExpenseRecord) => {
    if (!user) return;
    try {
      await saveExpenseToFirestore(user.uid, record);
      showToast('Lançamento salvo na nuvem!');
    } catch (err) {
      console.error('Erro ao salvar gasto:', err);
      showToast('Erro ao gravar lançamento.', 'error');
    }
  };

  // Create Installment Expenses Batch in Firestore (writeBatch)
  const handleSaveExpenseBatch = async (records: ExpenseRecord[]) => {
    if (!user) return;
    try {
      await saveExpensesBatchToFirestore(user.uid, records);
      showToast(`${records.length} parcelas salvas em lote na nuvem!`);
    } catch (err) {
      console.error('Erro ao salvar parcelas em lote:', err);
      showToast('Erro ao gravar parcelas.', 'error');
    }
  };

  // Update Installment Series according to scope ('single' | 'this_and_next' | 'all')
  const handleUpdateInstallmentSeries = async (
    editedExpense: ExpenseRecord,
    scope: InstallmentScope,
    newTotalPurchaseAmount: number,
    dueDay?: number
  ) => {
    if (!user) return;
    try {
      await updateInstallmentSeriesInFirestore(
        user.uid,
        editedExpense,
        scope,
        newTotalPurchaseAmount,
        dueDay
      );
      showToast('Parcelamento atualizado na nuvem!');
    } catch (err) {
      console.error('Erro ao atualizar série de parcelas:', err);
      showToast('Erro ao atualizar parcelas.', 'error');
    }
  };

  // Delete Expense or Installment Series from Firestore
  const handleConfirmDelete = async (scope: InstallmentScope = 'single') => {
    if (!user || !deletingExpense) return;
    try {
      await deleteInstallmentSeriesFromFirestore(user.uid, deletingExpense, scope);
      showToast(
        scope === 'all'
          ? 'Todas as parcelas da compra foram excluídas.'
          : scope === 'this_and_next'
          ? 'Esta e as próximas parcelas foram excluídas.'
          : 'Lançamento excluído da nuvem.'
      );
      setDeletingExpense(null);
    } catch (err) {
      console.error('Erro ao excluir gasto:', err);
      showToast('Erro ao remover despesa.', 'error');
    }
  };

  // Confirm local to cloud data migration
  const handleConfirmLocalMigration = async () => {
    if (!user || !localDataToMigrate) return;
    await migrateLocalDataToCloud(
      user.uid,
      localDataToMigrate.expenses,
      localDataToMigrate.settings
    );
    localStorage.setItem(`agrogasto_migrated_${user.uid}`, 'true');
    showToast('Dados locais migrados com sucesso para a nuvem!');
  };

  // Clear local storage after user confirmation
  const handleClearLocalStorage = () => {
    if (user) {
      localStorage.removeItem('agrogasto_expenses_v1');
      localStorage.setItem(`agrogasto_migrated_${user.uid}`, 'true');
      showToast('Cópia local removida com segurança.');
    }
  };

  // Quick Open Modal
  const handleOpenNewExpense = () => {
    setEditingExpense(null);
    setIsFormOpen(true);
  };

  const handleOpenEditExpense = (expense: ExpenseRecord) => {
    setEditingExpense(expense);
    setIsFormOpen(true);
  };

  // Filter expenses by search query, sector, subgroup, payment method, and onlyInstallments
  const filteredExpenses = useMemo(() => {
    const query = filters.searchQuery.trim().toLowerCase();

    return expenses.filter((item) => {
      if (query) {
        const matchDesc = item.description.toLowerCase().includes(query);
        const matchSector = item.sectorName.toLowerCase().includes(query);
        const matchSubgroup = item.subgroupName.toLowerCase().includes(query);
        const matchNotes = item.notes?.toLowerCase().includes(query);
        if (!matchDesc && !matchSector && !matchSubgroup && !matchNotes) {
          return false;
        }
      }

      if (filters.sectorId !== 'all' && item.sectorId !== filters.sectorId) {
        return false;
      }

      if (filters.subgroupId !== 'all' && item.subgroupId !== filters.subgroupId) {
        return false;
      }

      if (
        filters.paymentMethodId !== 'all' &&
        item.paymentMethodId !== filters.paymentMethodId
      ) {
        return false;
      }

      if (filters.onlyInstallments) {
        const isInst = Boolean(
          (item.totalParcelas && item.totalParcelas > 1) || item.parcelamentoId
        );
        if (!isInst) {
          return false;
        }
      }

      return true;
    });
  }, [
    expenses,
    filters.searchQuery,
    filters.sectorId,
    filters.subgroupId,
    filters.paymentMethodId,
    filters.onlyInstallments,
  ]);

  // Label for active period
  const periodLabel = useMemo(() => {
    const now = new Date();
    const months = [
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
    if (filters.period === 'this_month') {
      return `${months[now.getMonth()]} de ${now.getFullYear()}`;
    }
    if (filters.period === 'last_month') {
      const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return `${months[prevDate.getMonth()]} de ${prevDate.getFullYear()}`;
    }
    if (filters.period === 'last_30_days') {
      return 'Últimos 30 Dias';
    }
    if (filters.period === 'this_year') {
      return `Ano de ${now.getFullYear()}`;
    }
    if (filters.period === 'all') {
      return 'Histórico Completo';
    }
    if (filters.period === 'custom') {
      return `${filters.customStartDate || 'Início'} até ${filters.customEndDate || 'Fim'}`;
    }
    return 'Período';
  }, [filters]);

  const totalFilteredAmount = useMemo(() => {
    return filteredExpenses.reduce((sum, item) => sum + item.amount, 0);
  }, [filteredExpenses]);

  // 1. Initial Authentication Loading State
  if (authLoading) {
    return (
      <div className="min-h-screen bg-stone-100 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-800 text-white font-bold flex items-center justify-center text-xl shadow-lg mb-3 animate-pulse">
          AG
        </div>
        <div className="flex items-center gap-2 text-stone-600 text-sm font-semibold">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
          <span>Carregando AgroGasto na Nuvem...</span>
        </div>
      </div>
    );
  }

  // 1. Unauthenticated State: Show Login View
  if (!user) {
    return <LoginView />;
  }

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col font-sans pb-20 md:pb-12 text-stone-900">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-20 right-4 z-50 px-4 py-2.5 rounded-xl shadow-lg border flex items-center gap-2 text-xs sm:text-sm font-medium animate-in fade-in slide-in-from-top-2 ${
            toastMessage.type === 'success'
              ? 'bg-stone-900 text-white border-stone-700'
              : 'bg-red-900 text-white border-red-700'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Bar Header with Discrete Offline Indicator */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenNewExpense={handleOpenNewExpense}
        onOpenExport={() => setIsExportOpen(true)}
        propertyName={settings.propertyName}
        isOffline={isOffline}
        hasPendingSync={hasPendingSync}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6">
        {/* Quick Mobile Action Bar if on expenses tab */}
        {activeTab === 'expenses' && (
          <div className="md:hidden flex items-center justify-between bg-emerald-900 text-white p-3.5 rounded-2xl shadow-sm">
            <div>
              <span className="text-[11px] text-emerald-300 block uppercase tracking-wider font-semibold">
                Total ({periodLabel}):
              </span>
              <span className="text-xl font-bold font-mono tabular-nums text-white">
                {formatCurrency(totalFilteredAmount)}
              </span>
            </div>
            <button
              onClick={handleOpenNewExpense}
              className="px-3.5 py-2 rounded-xl bg-emerald-500 text-stone-950 font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Novo Gasto</span>
            </button>
          </div>
        )}

        {/* View 1: Lançamentos (Lista + Filtros) */}
        {activeTab === 'expenses' && (
          <div className="space-y-5">
            {/* Filters Section */}
            <ExpenseFilters
              filters={filters}
              onFilterChange={setFilters}
              settings={settings}
              totalFilteredCount={filteredExpenses.length}
              totalAllCount={expenses.length}
            />

            {/* Expenses Feed */}
            {isDataLoading ? (
              <div className="bg-white rounded-2xl border border-stone-200/90 p-12 text-center shadow-xs">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-700 mb-2" />
                <p className="text-xs sm:text-sm text-stone-500">
                  Carregando lançamentos da nuvem...
                </p>
              </div>
            ) : (
              <ExpenseList
                expenses={filteredExpenses}
                totalAllCount={expenses.length}
                onEdit={handleOpenEditExpense}
                onDeleteRequest={setDeletingExpense}
                onOpenNewExpense={handleOpenNewExpense}
              />
            )}
          </div>
        )}

        {/* View 2: Totais & Relatório */}
        {activeTab === 'summary' && (
          <div className="space-y-5">
            {/* Filter by period directly inside summary view */}
            <div className="bg-white rounded-2xl border border-stone-200/90 p-4 shadow-xs">
              <label className="block text-xs font-semibold text-stone-600 mb-2">
                Filtrar período do relatório:
              </label>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {[
                  { id: 'this_month' as PeriodFilterOption, label: 'Este Mês' },
                  { id: 'last_month' as PeriodFilterOption, label: 'Mês Passado' },
                  { id: 'last_30_days' as PeriodFilterOption, label: 'Últimos 30 Dias' },
                  { id: 'this_year' as PeriodFilterOption, label: 'Este Ano' },
                  { id: 'all' as PeriodFilterOption, label: 'Todo o Período' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setFilters({ ...filters, period: item.id })}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer shrink-0 ${
                      filters.period === item.id
                        ? 'bg-emerald-800 text-white shadow-xs'
                        : 'bg-stone-100 text-stone-600 hover:text-stone-900 hover:bg-stone-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <TotaisSummary
              expenses={filteredExpenses}
              upcomingInstallments={upcomingInstallments}
              settings={settings}
              periodLabel={periodLabel}
              onOpenExport={() => setIsExportOpen(true)}
            />
          </div>
        )}

        {/* View 3: Configurações */}
        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            onSaveSettings={handleUpdateSettings}
            expenses={expenses}
            onRenameSector={handleRenameSector}
            onRenameSubgroup={handleRenameSubgroup}
            onRenamePaymentMethod={handleRenamePaymentMethod}
            onClearAllExpenses={handleClearAllExpenses}
            onRestoreJSON={handleRestoreJSON}
            onDownloadCloudBackup={handleDownloadCloudBackup}
            lastBackupDate={settings.lastBackupDate || null}
            userEmail={user.email}
            onLogOut={logOut}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenNewExpense={handleOpenNewExpense}
        onOpenExport={() => setIsExportOpen(true)}
      />

      {/* Expense Form Modal (Novo / Editar) */}
      <ExpenseFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingExpense(null);
        }}
        onSave={handleSaveExpense}
        onSaveBatch={handleSaveExpenseBatch}
        onUpdateInstallmentSeries={handleUpdateInstallmentSeries}
        initialData={editingExpense}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
      />

      {/* Export to Excel / CSV Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        expenses={filteredExpenses}
        settings={settings}
        periodLabel={periodLabel}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(deletingExpense)}
        onClose={() => setDeletingExpense(null)}
        onConfirm={handleConfirmDelete}
        expense={deletingExpense}
      />

      {/* Local Data Migration Prompt Modal */}
      {showMigrationModal && localDataToMigrate && (
        <LocalMigrationModal
          isOpen={showMigrationModal}
          onClose={() => setShowMigrationModal(false)}
          localExpenses={localDataToMigrate.expenses}
          localSettings={localDataToMigrate.settings}
          onConfirmMigration={handleConfirmLocalMigration}
          onClearLocalStorage={handleClearLocalStorage}
        />
      )}
    </div>
  );
}
