import { ExpenseRecord } from '../types';

/**
 * Formats a numeric value into Brazilian Real (R$ 1.234,56)
 */
export function formatCurrency(value: number): string {
  if (isNaN(value)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Formats a number to Brazilian decimal format (1.234,56) without the R$ prefix
 */
export function formatNumberBR(value: number): string {
  if (isNaN(value)) return '0,00';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Formats date string (YYYY-MM-DD) into DD/MM/YYYY
 */
export function formatDateBR(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  }
  return dateStr;
}

/**
 * Returns today's date formatted as YYYY-MM-DD for standard date input
 */
export function getTodayDateStr(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Generates a clean unique ID
 */
export function generateId(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Parse currency input string like "1.234,56" or "1234.56" to number
 */
export function parseCurrencyFromInput(inputStr: string): number {
  if (!inputStr) return 0;
  const clean = inputStr.replace(/[^\d]/g, '');
  if (!clean) return 0;
  return parseFloat(clean) / 100;
}

/**
 * Format raw cents to masked R$ string for input displays (e.g. 15000 -> "150,00")
 */
export function formatCentsToInputString(cents: number): string {
  const value = cents / 100;
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Divides total amount in cents across N installments without losing or creating any cent.
 * Remainder cents are adjusted on the 1st installment.
 */
export function splitAmountIntoInstallments(totalAmount: number, totalParcelas: number): number[] {
  const count = Math.max(1, Math.floor(totalParcelas));
  const totalCents = Math.round(totalAmount * 100);
  if (count === 1) {
    return [totalCents / 100];
  }
  const baseCents = Math.floor(totalCents / count);
  const remainderCents = totalCents - baseCents * count;

  const amounts: number[] = [];
  for (let i = 0; i < count; i++) {
    if (i === 0) {
      amounts.push((baseCents + remainderCents) / 100);
    } else {
      amounts.push(baseCents / 100);
    }
  }
  return amounts;
}

/**
 * Calculates the dates (YYYY-MM-DD) for each installment:
 * - 1st installment is on the informed baseDateStr.
 * - Subsequent installments fall on the same day of following months (or on dueDay if configured).
 * - If the target day does not exist in that month (e.g., 31st in February/April), uses the last day of that month.
 */
export function calculateInstallmentDates(
  baseDateStr: string,
  totalParcelas: number,
  dueDay?: number
): string[] {
  const count = Math.max(1, Math.floor(totalParcelas));
  if (!baseDateStr) return Array(count).fill(getTodayDateStr());

  const parts = baseDateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    return Array(count).fill(baseDateStr);
  }

  const [baseYear, baseMonth, baseDay] = parts; // baseMonth is 1..12
  const validDueDay =
    typeof dueDay === 'number' && dueDay >= 1 && dueDay <= 31 ? Math.floor(dueDay) : undefined;

  const dates: string[] = [];
  for (let i = 0; i < count; i++) {
    if (i === 0) {
      dates.push(baseDateStr);
    } else {
      const totalMonthsZeroBased = baseMonth - 1 + i;
      const targetYear = baseYear + Math.floor(totalMonthsZeroBased / 12);
      const targetMonthZeroBased = totalMonthsZeroBased % 12; // 0..11
      const lastDayOfTargetMonth = new Date(targetYear, targetMonthZeroBased + 1, 0).getDate();

      const desiredDay = validDueDay ?? baseDay;
      const clampedDay = Math.min(desiredDay, lastDayOfTargetMonth);

      const yyyy = String(targetYear);
      const mm = String(targetMonthZeroBased + 1).padStart(2, '0');
      const dd = String(clampedDay).padStart(2, '0');
      dates.push(`${yyyy}-${mm}-${dd}`);
    }
  }

  return dates;
}

/**
 * Strips trailing installment suffix like " (2/5)" from a description
 */
export function stripInstallmentSuffix(description: string): string {
  return (description || '').replace(/\s*\(\d+\/\d+\)\s*$/, '').trim();
}

/**
 * Formats description with installment suffix "(numeroParcela/totalParcelas)"
 */
export function formatInstallmentDescription(
  baseDescription: string,
  numeroParcela: number,
  totalParcelas: number
): string {
  const cleanBase = stripInstallmentSuffix(baseDescription);
  if (totalParcelas <= 1) return cleanBase;
  return `${cleanBase} (${numeroParcela}/${totalParcelas})`;
}

/**
 * Exports expenses to Brazilian Excel CSV (with UTF-8 BOM, semicolon delimiter and comma decimal)
 */
export function generateExcelCSV(
  expenses: ExpenseRecord[],
  propertyName = 'Propriedade Rural'
): string {
  // UTF-8 Byte Order Mark (BOM) ensures Excel recognizes special Portuguese characters (á, ç, õ, etc.)
  const BOM = '\uFEFF';
  const headers = [
    'Data',
    'Descrição',
    'Setor',
    'Subgrupo',
    'Forma de Pagamento',
    'Parcela',
    'Valor (R$)',
    'Valor total da compra',
    'Observações',
  ];

  const rows = expenses.map((exp) => {
    const escapeField = (val: string) => {
      const sanitized = (val || '').replace(/"/g, '""');
      return `"${sanitized}"`;
    };

    const isInstallment = Boolean(exp.totalParcelas && exp.totalParcelas > 1);
    const parcelaStr = isInstallment
      ? `${exp.numeroParcela || 1}/${exp.totalParcelas}`
      : '1/1';
    const valorTotalCompra = exp.valorTotalCompra ?? exp.amount;

    return [
      escapeField(formatDateBR(exp.date)),
      escapeField(exp.description),
      escapeField(exp.sectorName),
      escapeField(exp.subgroupName),
      escapeField(exp.paymentMethodName),
      escapeField(parcelaStr),
      `"${formatNumberBR(exp.amount)}"`,
      `"${formatNumberBR(valorTotalCompra)}"`,
      escapeField(exp.notes || ''),
    ].join(';');
  });

  const total = expenses.reduce((sum, item) => sum + item.amount, 0);
  const totalRow = [
    '"TOTAL GERAL"',
    '""',
    '""',
    '""',
    '""',
    '""',
    `"${formatNumberBR(total)}"`,
    '""',
    '""',
  ].join(';');

  const content = [
    `"Relatório de Gastos - ${propertyName}"`,
    `"Gerado em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}"`,
    `"Total de Lançamentos: ${expenses.length}"`,
    '',
    headers.map((h) => `"${h}"`).join(';'),
    ...rows,
    '',
    totalRow,
  ].join('\r\n');

  return BOM + content;
}

/**
 * Triggers browser download of generated CSV or JSON
 */
export function downloadFile(content: string, fileName: string, contentType = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
