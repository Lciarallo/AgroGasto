import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './config';
import type { ExpenseRecord, ExpenseSaveResult } from '../types';

/**
 * A Firestore write resolves only after server acknowledgement. A matching local
 * snapshot lets the form acknowledge an offline/slow write without calling it
 * cloud-saved. The server promise remains observed for later rejection.
 */
export function withExpenseWriteFeedback(
  userId: string,
  record: ExpenseRecord,
  write: () => Promise<void>,
  onSyncError: (error: unknown) => void
): Promise<ExpenseSaveResult> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let returnedPending = false;
    let lateErrorReported = false;
    let pendingTimer: ReturnType<typeof setTimeout> | undefined;
    let unsubscribe: (() => void) | undefined;
    let completion: Promise<void> | undefined;

    const cleanup = () => {
      unsubscribe?.();
      clearTimeout(pendingTimer);
    };
    const finish = (status: ExpenseSaveResult['status']) => {
      if (settled) return;
      settled = true;
      returnedPending = status === 'pending';
      cleanup();
      resolve(status === 'pending' ? { status, completion } : { status });
    };
    const fail = (error: unknown) => {
      if (settled) {
        if (returnedPending && !lateErrorReported) {
          lateErrorReported = true;
          onSyncError(error);
        }
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    };

    try {
      unsubscribe = onSnapshot(
        doc(db, 'users', userId, 'gastos', record.id),
        { includeMetadataChanges: true },
        (snapshot) => {
          if (
            !settled &&
            pendingTimer === undefined &&
            snapshot.exists() &&
            snapshot.get('updatedAt') === record.updatedAt &&
            snapshot.metadata.hasPendingWrites
          ) {
            // Only acknowledge pending after this write appears in the local
            // Firestore view. For a batch, all records enter that view atomically.
            pendingTimer = setTimeout(
              () => finish('pending'),
              navigator.onLine ? 1600 : 0
            );
          }
        },
        fail
      );
      completion = write();
      completion.then(() => finish('synced'), fail);
    } catch (error) {
      fail(error);
    }
  });
}
