import { ExpenseRecord, PaymentMethodItem, PropertySettings } from '../types';

const STORAGE_EXPENSES_KEY = 'agrogasto_expenses_v1';
const STORAGE_SETTINGS_KEY = 'agrogasto_settings_v1';
const STORAGE_LAST_BACKUP_KEY = 'agrogasto_last_backup_v1';
const STORAGE_MIGRATION_CLEANED_SEEDS = 'agrogasto_cleaned_seeds_v2';

export const DEFAULT_SETTINGS: PropertySettings = {
  propertyName: 'Minha Propriedade',
  sectors: [
    {
      id: 'sec_pecuaria',
      name: 'Pecuária',
      subgroups: [
        { id: 'sub_pec_insumos', name: 'Insumos & Ração' },
        { id: 'sub_pec_vacinas', name: 'Medicamentos & Vacinas' },
        { id: 'sub_pec_equip', name: 'Equipamento & Ferramentas' },
        { id: 'sub_pec_maquina', name: 'Gasto de máquina' },
        { id: 'sub_pec_cercas', name: 'Cercas & Pastagem' },
        { id: 'sub_pec_diarias', name: 'Mão de obra & Diárias' },
      ],
    },
    {
      id: 'sec_banana',
      name: 'Banana',
      subgroups: [
        { id: 'sub_ban_adubos', name: 'Insumos & Adubos' },
        { id: 'sub_ban_defensivos', name: 'Defensivos Agrícolas' },
        { id: 'sub_ban_embalagens', name: 'Embalagens & Caixas' },
        { id: 'sub_ban_mudas', name: 'Mudas & Plantio' },
        { id: 'sub_ban_maquina', name: 'Gasto de máquina' },
        { id: 'sub_ban_irrigacao', name: 'Irrigação' },
      ],
    },
    {
      id: 'sec_miscelaneos',
      name: 'Gastos miscelâneos',
      subgroups: [
        { id: 'sub_misc_combustivel', name: 'Combustível & Óleo Diesel' },
        { id: 'sub_misc_manutencao', name: 'Peças & Manutenção' },
        { id: 'sub_misc_energia', name: 'Energia Elétrica & Água' },
        { id: 'sub_misc_impostos', name: 'Impostos, Taxas & DITR' },
        { id: 'sub_misc_rancho', name: 'Alimentação & Rancho' },
        { id: 'sub_misc_outros', name: 'Despesas Gerais' },
      ],
    },
  ],
  paymentMethods: [
    { id: 'pay_pix', name: 'Pix', isCreditCard: false },
    { id: 'pay_dinheiro', name: 'Dinheiro', isCreditCard: false },
    { id: 'pay_debito', name: 'Débito', isCreditCard: false },
    { id: 'pay_cartao_x', name: 'Cartão de crédito X', isCreditCard: true },
    { id: 'pay_boleto', name: 'Boleto Bancário', isCreditCard: false },
    { id: 'pay_prazo', name: 'A Prazo / Faturado', isCreditCard: false },
  ],
};

/**
 * Ensures backwards compatibility for payment methods:
 * Marks "Cartão de crédito X" (or id pay_cartao_x) as isCreditCard: true by default if undefined.
 */
export function normalizePaymentMethods(methods: PaymentMethodItem[]): PaymentMethodItem[] {
  if (!Array.isArray(methods)) return DEFAULT_SETTINGS.paymentMethods;
  return methods.map((m) => {
    if (typeof m.isCreditCard === 'boolean') {
      return m;
    }
    const isDefaultCredit =
      m.id === 'pay_cartao_x' ||
      m.name.toLowerCase().includes('cartão de crédito') ||
      m.name.toLowerCase().includes('cartao de credito');
    return {
      ...m,
      isCreditCard: isDefaultCredit,
    };
  });
}

const SEED_DESCRIPTIONS = new Set([
  'Diesel S10 para trator e gerador (200L)',
  'Adubo NPK 04-14-08 (40 sacos para bananal)',
  'Sal mineral proteico 30kg (15 sacas)',
  'Caixas de papelão modelo exportação banana',
  'Vacina contra Clostridiose e vermífugo gado',
  'Troca de óleo hidráulico e filtros da roçadeira',
  'Diárias de roçada de pasto (2 ajudantes)',
]);

/**
 * Loads settings from localStorage or fallback
 */
export function loadSettings(): PropertySettings {
  try {
    const raw = localStorage.getItem(STORAGE_SETTINGS_KEY);
    if (!raw) {
      saveSettings(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    }
    const parsed = JSON.parse(raw);
    if (!parsed.sectors || !parsed.paymentMethods) {
      return DEFAULT_SETTINGS;
    }

    if (parsed.propertyName === 'Fazenda Santa Maria') {
      parsed.propertyName = 'Minha Propriedade';
    }

    parsed.paymentMethods = normalizePaymentMethods(parsed.paymentMethods);
    return parsed;
  } catch (err) {
    console.error('Erro ao ler configurações do localStorage:', err);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Saves settings to localStorage
 */
export function saveSettings(settings: PropertySettings): void {
  try {
    localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Erro ao salvar configurações no localStorage:', err);
  }
}

/**
 * Loads expense records from localStorage
 * Starts empty by default (no fictitious sample records)
 */
export function loadExpenses(): ExpenseRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_EXPENSES_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const hasCleanedSeeds = localStorage.getItem(STORAGE_MIGRATION_CLEANED_SEEDS);
      if (!hasCleanedSeeds) {
        localStorage.setItem(STORAGE_MIGRATION_CLEANED_SEEDS, 'true');
        const isOnlySeeds =
          parsed.length > 0 &&
          parsed.every((item: ExpenseRecord) => SEED_DESCRIPTIONS.has(item.description));
        if (isOnlySeeds) {
          saveExpenses([]);
          return [];
        }
      }
      return parsed;
    }
    return [];
  } catch (err) {
    console.error('Erro ao ler despesas do localStorage:', err);
    return [];
  }
}

/**
 * Saves expense records to localStorage
 */
export function saveExpenses(expenses: ExpenseRecord[]): void {
  try {
    localStorage.setItem(STORAGE_EXPENSES_KEY, JSON.stringify(expenses));
  } catch (err) {
    console.error('Erro ao salvar despesas no localStorage:', err);
  }
}

/**
 * Loads the ISO timestamp of the last downloaded backup
 */
export function loadLastBackupDate(): string | null {
  try {
    return localStorage.getItem(STORAGE_LAST_BACKUP_KEY);
  } catch (err) {
    console.error('Erro ao ler data do último backup:', err);
    return null;
  }
}

/**
 * Saves the ISO timestamp of the last downloaded backup
 */
export function saveLastBackupDate(isoDate: string): void {
  try {
    localStorage.setItem(STORAGE_LAST_BACKUP_KEY, isoDate);
  } catch (err) {
    console.error('Erro ao salvar data do último backup:', err);
  }
}
