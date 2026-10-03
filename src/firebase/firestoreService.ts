import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './config';
import { ExpenseRecord, PropertySettings, PeriodFilterOption, InstallmentScope } from '../types';
import { DEFAULT_SETTINGS, normalizePaymentMethods } from '../utils/storage';
import {
  splitAmountIntoInstallments,
  calculateInstallmentDates,
  formatInstallmentDescription,
  stripInstallmentSuffix,
} from '../utils/formatters';

export interface SnapshotMetaInfo {
  fromCache: boolean;
  hasPendingWrites: boolean;
}

/**
 * Calculates start and end dates (YYYY-MM-DD) for period-based query optimization
 */
export function getDateRangeForPeriod(
  period: PeriodFilterOption,
  customStart?: string,
  customEnd?: string
): { startDate?: string; endDate?: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  if (period === 'this_month') {
    const end = new Date(year, month + 1, 0);
    return {
      startDate: `${year}-${String(month + 1).padStart(2, '0')}-01`,
      endDate: `${year}-${String(month + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`,
    };
  }

  if (period === 'last_month') {
    const prevMonthDate = new Date(year, month - 1, 1);
    const prevYear = prevMonthDate.getFullYear();
    const prevMonth = prevMonthDate.getMonth();
    const end = new Date(prevYear, prevMonth + 1, 0);
    return {
      startDate: `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-01`,
      endDate: `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`,
    };
  }

  if (period === 'last_30_days') {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);
    return {
      startDate: thirtyDaysAgo.toISOString().slice(0, 10),
      endDate: now.toISOString().slice(0, 10),
    };
  }

  if (period === 'this_year') {
    return {
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
    };
  }

  if (period === 'custom' && customStart && customEnd) {
    return {
      startDate: customStart,
      endDate: customEnd,
    };
  }

  return {}; // 'all' -> no date constraint
}

/**
 * Subscribes to real-time changes on user's property configuration document
 */
export function subscribeToPropertyConfig(
  userId: string,
  onData: (settings: PropertySettings) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const configDocRef = doc(db, 'users', userId, 'config', 'propriedade');

  return onSnapshot(
    configDocRef,
    { includeMetadataChanges: true },
    (snapshot) => {
      if (snapshot.exists()) {
        const rawData = snapshot.data() as PropertySettings;
        const normalized: PropertySettings = {
          ...rawData,
          paymentMethods: normalizePaymentMethods(rawData.paymentMethods || []),
        };
        onData(normalized);
      } else {
        const initialConfig: PropertySettings = {
          ...DEFAULT_SETTINGS,
          propertyName: 'Minha Propriedade',
        };
        savePropertyConfig(userId, initialConfig).catch((err) => {
          console.error('Erro ao inicializar configurações no Firestore:', err);
        });
        onData(initialConfig);
      }
    },
    (error) => {
      onError?.(error);
      handleFirestoreError(error, OperationType.GET, `users/${userId}/config/propriedade`);
    }
  );
}

/**
 * Saves user's property configuration to Firestore
 */
export async function savePropertyConfig(
  userId: string,
  settings: PropertySettings
): Promise<void> {
  const path = `users/${userId}/config/propriedade`;
  try {
    const configDocRef = doc(db, 'users', userId, 'config', 'propriedade');
    await setDoc(
      configDocRef,
      {
        ...settings,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Subscribes to real-time expenses with date range optimization (loads only filtered period)
 */
export function subscribeToExpenses(
  userId: string,
  period: PeriodFilterOption,
  customStart: string | undefined,
  customEnd: string | undefined,
  onData: (expenses: ExpenseRecord[], metadata: SnapshotMetaInfo) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const path = `users/${userId}/gastos`;
  const expensesRef = collection(db, 'users', userId, 'gastos');
  const { startDate, endDate } = getDateRangeForPeriod(period, customStart, customEnd);

  let q;
  if (startDate && endDate) {
    q = query(
      expensesRef,
      where('date', '>=', startDate),
      where('date', '<=', endDate),
      orderBy('date', 'desc')
    );
  } else {
    q = query(expensesRef, orderBy('date', 'desc'));
  }

  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snapshot) => {
      const records: ExpenseRecord[] = [];
      snapshot.forEach((docSnapshot) => {
        records.push(docSnapshot.data() as ExpenseRecord);
      });
      records.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

      onData(records, {
        fromCache: snapshot.metadata.fromCache,
        hasPendingWrites: snapshot.metadata.hasPendingWrites,
      });
    },
    (error) => {
      onError?.(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

/**
 * Subscribes to upcoming installments for the Summary "Parcelas a pagar" view
 */
export function subscribeToUpcomingInstallments(
  userId: string,
  onData: (installments: ExpenseRecord[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const path = `users/${userId}/gastos`;
  const expensesRef = collection(db, 'users', userId, 'gastos');

  const now = new Date();
  const startYear = now.getFullYear();
  const startMonth = String(now.getMonth() + 1).padStart(2, '0');
  const startDay = String(now.getDate()).padStart(2, '0');
  const todayStr = `${startYear}-${startMonth}-${startDay}`;

  const q = query(
    expensesRef,
    where('date', '>', todayStr),
    orderBy('date', 'asc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const records: ExpenseRecord[] = [];
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data() as ExpenseRecord;
        if ((data.totalParcelas && data.totalParcelas > 1) || data.parcelamentoId) {
          records.push(data);
        }
      });
      onData(records);
    },
    (error) => {
      onError?.(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

/**
 * Adds or updates a single expense record
 */
export async function saveExpenseToFirestore(
  userId: string,
  expense: ExpenseRecord
): Promise<void> {
  const path = `users/${userId}/gastos/${expense.id}`;
  try {
    const expenseDocRef = doc(db, 'users', userId, 'gastos', expense.id);
    // Clean undefined fields before saving to Firestore
    const cleanRecord = Object.fromEntries(
      Object.entries(expense).filter(([_, v]) => v !== undefined)
    );
    await setDoc(expenseDocRef, cleanRecord, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Saves multiple expense records (e.g. installments) atomically in a single writeBatch
 */
export async function saveExpensesBatchToFirestore(
  userId: string,
  expenses: ExpenseRecord[]
): Promise<void> {
  const path = `users/${userId}/gastos`;
  try {
    const batch = writeBatch(db);
    expenses.forEach((exp) => {
      const docRef = doc(db, 'users', userId, 'gastos', exp.id);
      const cleanRecord = Object.fromEntries(
        Object.entries(exp).filter(([_, v]) => v !== undefined)
      );
      batch.set(docRef, cleanRecord, { merge: true });
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Updates an installment purchase series according to chosen scope:
 * - 'single': updates only this single installment
 * - 'this_and_next': updates this and subsequent installments, recalculating remaining amounts if total changed
 * - 'all': updates all installments of the purchase, recalculating amounts and dates
 */
export async function updateInstallmentSeriesInFirestore(
  userId: string,
  editedExpense: ExpenseRecord,
  scope: InstallmentScope,
  newTotalPurchaseAmount: number,
  dueDay?: number
): Promise<void> {
  const path = `users/${userId}/gastos`;
  try {
    if (scope === 'single' || !editedExpense.parcelamentoId) {
      await saveExpenseToFirestore(userId, editedExpense);
      return;
    }

    const expensesRef = collection(db, 'users', userId, 'gastos');
    const q = query(expensesRef, where('parcelamentoId', '==', editedExpense.parcelamentoId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      await saveExpenseToFirestore(userId, editedExpense);
      return;
    }

    const allDocs = snapshot.docs
      .map((d) => ({ ref: d.ref, data: d.data() as ExpenseRecord }))
      .sort((a, b) => (a.data.numeroParcela || 1) - (b.data.numeroParcela || 1));

    const batch = writeBatch(db);
    const nowIso = editedExpense.updatedAt;
    const baseDesc = stripInstallmentSuffix(editedExpense.description);
    const totalParcelas = editedExpense.totalParcelas || allDocs.length;

    if (scope === 'all') {
      const amounts = splitAmountIntoInstallments(newTotalPurchaseAmount, allDocs.length);
      const originalFirstDate = allDocs[0]?.data.date || editedExpense.dataCompra || editedExpense.date;
      const newPurchaseDate = editedExpense.dataCompra || originalFirstDate;
      const shouldRecalcDates = newPurchaseDate !== originalFirstDate;
      const recalcedDates = shouldRecalcDates
        ? calculateInstallmentDates(newPurchaseDate, allDocs.length, dueDay)
        : [];

      allDocs.forEach((item, idx) => {
        const numParcela = item.data.numeroParcela || idx + 1;
        const updatedFields: Partial<ExpenseRecord> = {
          description: formatInstallmentDescription(baseDesc, numParcela, totalParcelas),
          amount: amounts[idx] ?? item.data.amount,
          valorTotalCompra: newTotalPurchaseAmount,
          dataCompra: newPurchaseDate,
          sectorId: editedExpense.sectorId,
          sectorName: editedExpense.sectorName,
          subgroupId: editedExpense.subgroupId,
          subgroupName: editedExpense.subgroupName,
          paymentMethodId: editedExpense.paymentMethodId,
          paymentMethodName: editedExpense.paymentMethodName,
          notes: editedExpense.notes || '',
          updatedAt: nowIso,
        };
        if (shouldRecalcDates && recalcedDates[idx]) {
          updatedFields.date = recalcedDates[idx];
        } else if (item.data.id === editedExpense.id) {
          updatedFields.date = editedExpense.date;
        }
        batch.update(item.ref, updatedFields);
      });
    } else if (scope === 'this_and_next') {
      const currentNum = editedExpense.numeroParcela || 1;
      const previousDocs = allDocs.filter((d) => (d.data.numeroParcela || 1) < currentNum);
      const targetDocs = allDocs.filter((d) => (d.data.numeroParcela || 1) >= currentNum);

      // Calculate how much was already allocated in previous installments
      const previousCents = previousDocs.reduce(
        (sum, d) => sum + Math.round((d.data.amount || 0) * 100),
        0
      );
      const newTotalCents = Math.round(newTotalPurchaseAmount * 100);
      const remainingCents = Math.max(0, newTotalCents - previousCents);
      const remainingAmounts = splitAmountIntoInstallments(
        remainingCents / 100,
        targetDocs.length
      );

      // Check if current installment date changed to recalculate subsequent dates if needed
      const currentOriginalDoc = allDocs.find((d) => d.data.id === editedExpense.id);
      const dateChanged = currentOriginalDoc && currentOriginalDoc.data.date !== editedExpense.date;
      const recalcedRemainingDates = dateChanged
        ? calculateInstallmentDates(editedExpense.date, targetDocs.length, dueDay)
        : [];

      // Update valorTotalCompra on previous docs so the purchase metadata remains unified
      previousDocs.forEach((item) => {
        batch.update(item.ref, {
          valorTotalCompra: newTotalPurchaseAmount,
          updatedAt: nowIso,
        });
      });

      // Update this and subsequent installments
      targetDocs.forEach((item, idx) => {
        const numParcela = item.data.numeroParcela || currentNum + idx;
        const updatedFields: Partial<ExpenseRecord> = {
          description: formatInstallmentDescription(baseDesc, numParcela, totalParcelas),
          amount: remainingAmounts[idx] ?? item.data.amount,
          valorTotalCompra: newTotalPurchaseAmount,
          sectorId: editedExpense.sectorId,
          sectorName: editedExpense.sectorName,
          subgroupId: editedExpense.subgroupId,
          subgroupName: editedExpense.subgroupName,
          paymentMethodId: editedExpense.paymentMethodId,
          paymentMethodName: editedExpense.paymentMethodName,
          notes: editedExpense.notes || '',
          updatedAt: nowIso,
        };
        if (dateChanged && recalcedRemainingDates[idx]) {
          updatedFields.date = recalcedRemainingDates[idx];
        }
        batch.update(item.ref, updatedFields);
      });
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Deletes an expense or installment group according to chosen scope ('single', 'this_and_next', 'all')
 */
export async function deleteInstallmentSeriesFromFirestore(
  userId: string,
  expense: ExpenseRecord,
  scope: InstallmentScope
): Promise<void> {
  const path = `users/${userId}/gastos`;
  try {
    if (scope === 'single' || !expense.parcelamentoId) {
      const expenseDocRef = doc(db, 'users', userId, 'gastos', expense.id);
      await deleteDoc(expenseDocRef);
      return;
    }

    const expensesRef = collection(db, 'users', userId, 'gastos');
    const q = query(expensesRef, where('parcelamentoId', '==', expense.parcelamentoId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      const expenseDocRef = doc(db, 'users', userId, 'gastos', expense.id);
      await deleteDoc(expenseDocRef);
      return;
    }

    const batch = writeBatch(db);
    const currentNum = expense.numeroParcela || 1;

    snapshot.docs.forEach((d) => {
      const data = d.data() as ExpenseRecord;
      const docNum = data.numeroParcela || 1;
      if (scope === 'all') {
        batch.delete(d.ref);
      } else if (scope === 'this_and_next' && docNum >= currentNum) {
        batch.delete(d.ref);
      }
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Deletes a single expense record
 */
export async function deleteExpenseFromFirestore(
  userId: string,
  expenseId: string
): Promise<void> {
  const path = `users/${userId}/gastos/${expenseId}`;
  try {
    const expenseDocRef = doc(db, 'users', userId, 'gastos', expenseId);
    await deleteDoc(expenseDocRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Atomically updates all existing expenses that reference a renamed sector, subgroup, or payment method
 */
export async function batchUpdateExpensesForRename(
  userId: string,
  filterKey: 'sectorId' | 'subgroupId' | 'paymentMethodId',
  filterValue: string,
  updateKey: 'sectorName' | 'subgroupName' | 'paymentMethodName',
  newValue: string
): Promise<number> {
  const path = `users/${userId}/gastos`;
  try {
    const expensesRef = collection(db, 'users', userId, 'gastos');
    const q = query(expensesRef, where(filterKey, '==', filterValue));
    const snapshot = await getDocs(q);

    if (snapshot.empty) return 0;

    const docs = snapshot.docs;
    const chunkSize = 450;
    let updatedCount = 0;

    for (let i = 0; i < docs.length; i += chunkSize) {
      const batch = writeBatch(db);
      const chunk = docs.slice(i, i + chunkSize);
      const nowIso = new Date().toISOString();

      chunk.forEach((d) => {
        batch.update(d.ref, {
          [updateKey]: newValue,
          updatedAt: nowIso,
        });
      });

      await batch.commit();
      updatedCount += chunk.length;
    }

    return updatedCount;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Deletes all user expenses (used when user double-confirms "Apagar todos os lançamentos")
 */
export async function clearAllExpensesFromFirestore(userId: string): Promise<number> {
  const path = `users/${userId}/gastos`;
  try {
    const expensesRef = collection(db, 'users', userId, 'gastos');
    const snapshot = await getDocs(expensesRef);

    if (snapshot.empty) return 0;

    const docs = snapshot.docs;
    const chunkSize = 450;
    let deletedCount = 0;

    for (let i = 0; i < docs.length; i += chunkSize) {
      const batch = writeBatch(db);
      const chunk = docs.slice(i, i + chunkSize);

      chunk.forEach((d) => {
        batch.delete(d.ref);
      });

      await batch.commit();
      deletedCount += chunk.length;
    }

    return deletedCount;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Fetches all expenses regardless of date filter for complete JSON backup download
 */
export async function fetchAllUserExpensesForBackup(userId: string): Promise<ExpenseRecord[]> {
  const path = `users/${userId}/gastos`;
  try {
    const expensesRef = collection(db, 'users', userId, 'gastos');
    const q = query(expensesRef, orderBy('date', 'desc'));
    const snapshot = await getDocs(q);

    const list: ExpenseRecord[] = [];
    snapshot.forEach((d) => {
      list.push(d.data() as ExpenseRecord);
    });

    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Restores all expenses and settings from JSON backup into Firestore (compatible with old and new backups)
 */
export async function restoreAllExpensesToFirestore(
  userId: string,
  backupExpenses: ExpenseRecord[],
  backupSettings: PropertySettings
): Promise<void> {
  const path = `users/${userId}/gastos`;
  try {
    const normalizedSettings: PropertySettings = {
      ...backupSettings,
      paymentMethods: normalizePaymentMethods(backupSettings.paymentMethods || []),
    };

    // Index existing sectors, subgroups, and payment methods
    const sectorMap = new Map<string, string>();
    const subgroupMap = new Map<string, string>();
    normalizedSettings.sectors?.forEach((sec) => {
      sectorMap.set(sec.id, sec.name);
      sec.subgroups?.forEach((sub) => {
        subgroupMap.set(sub.id, sub.name);
      });
    });

    const paymentMap = new Map<string, string>();
    normalizedSettings.paymentMethods?.forEach((pay) => {
      paymentMap.set(pay.id, pay.name);
    });

    // Save settings
    await savePropertyConfig(userId, normalizedSettings);

    // Batch write all expenses, preserving installment fields if present and handling old records cleanly
    const chunkSize = 450;
    for (let i = 0; i < backupExpenses.length; i += chunkSize) {
      const batch = writeBatch(db);
      const chunk = backupExpenses.slice(i, i + chunkSize);

      chunk.forEach((exp) => {
        const docRef = doc(db, 'users', userId, 'gastos', exp.id);
        const syncedRecord: ExpenseRecord = {
          ...exp,
          sectorName: sectorMap.has(exp.sectorId)
            ? sectorMap.get(exp.sectorId)!
            : exp.sectorName || 'Setor Anterior',
          subgroupName: subgroupMap.has(exp.subgroupId)
            ? subgroupMap.get(exp.subgroupId)!
            : exp.subgroupName || 'Subgrupo Anterior',
          paymentMethodName: paymentMap.has(exp.paymentMethodId)
            ? paymentMap.get(exp.paymentMethodId)!
            : exp.paymentMethodName || 'Outro',
        };
        const cleanRecord = Object.fromEntries(
          Object.entries(syncedRecord).filter(([_, v]) => v !== undefined)
        );
        batch.set(docRef, cleanRecord, { merge: true });
      });

      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Migrates local data from localStorage into user's Firestore cloud account
 */
export async function migrateLocalDataToCloud(
  userId: string,
  localExpenses: ExpenseRecord[],
  localSettings?: PropertySettings
): Promise<void> {
  const path = `users/${userId}/gastos`;
  try {
    if (localSettings) {
      await savePropertyConfig(userId, {
        ...localSettings,
        paymentMethods: normalizePaymentMethods(localSettings.paymentMethods || []),
      });
    }

    if (localExpenses.length > 0) {
      const chunkSize = 450;
      for (let i = 0; i < localExpenses.length; i += chunkSize) {
        const batch = writeBatch(db);
        const chunk = localExpenses.slice(i, i + chunkSize);

        chunk.forEach((exp) => {
          const docRef = doc(db, 'users', userId, 'gastos', exp.id);
          const cleanRecord = Object.fromEntries(
            Object.entries(exp).filter(([_, v]) => v !== undefined)
          );
          batch.set(docRef, cleanRecord, { merge: true });
        });

        await batch.commit();
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
