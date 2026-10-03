export interface SubgroupItem {
  id: string;
  name: string;
}

export interface SectorItem {
  id: string;
  name: string;
  subgroups: SubgroupItem[];
}

export interface PaymentMethodItem {
  id: string;
  name: string;
  isCreditCard?: boolean;
  dueDay?: number; // 1 to 31 (optional)
}

export interface ExpenseRecord {
  id: string;
  date: string; // YYYY-MM-DD (installment due/posting date)
  description: string;
  amount: number; // In Reais, float e.g. 1250.75 (installment value)
  sectorId: string;
  sectorName: string;
  subgroupId: string;
  subgroupName: string;
  paymentMethodId: string;
  paymentMethodName: string;
  notes?: string;
  // Installment fields (optional for backwards compatibility with 1x expenses)
  parcelamentoId?: string;
  numeroParcela?: number;
  totalParcelas?: number;
  valorTotalCompra?: number;
  dataCompra?: string; // YYYY-MM-DD (original purchase date)
  createdAt: string;
  updatedAt: string;
}

export type InstallmentScope = 'single' | 'this_and_next' | 'all';

export interface ExpenseSaveResult {
  status: 'synced' | 'pending';
  completion?: Promise<void>;
}

export interface ExpenseFormOrigin {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PropertySettings {
  propertyName: string;
  sectors: SectorItem[];
  paymentMethods: PaymentMethodItem[];
  lastBackupDate?: string;
  updatedAt?: string;
}

export type PeriodFilterOption =
  | 'this_month'
  | 'last_month'
  | 'last_30_days'
  | 'this_year'
  | 'all'
  | 'custom';

export interface FilterState {
  period: PeriodFilterOption;
  customStartDate: string;
  customEndDate: string;
  sectorId: string; // 'all' or specific id
  subgroupId: string; // 'all' or specific id
  paymentMethodId: string; // 'all' or specific id
  searchQuery: string;
  onlyInstallments?: boolean;
}

export type ActiveTab = 'expenses' | 'summary' | 'settings';
