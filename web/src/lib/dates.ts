// Datas de calendário (sem hora). Internamente: ISO "YYYY-MM-DD". Na tela: "dd/mm/aaaa".

export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const INICIAIS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export const pad = (n: number) => String(n).padStart(2, '0');

/** Hoje à meia-noite local. */
export function today(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

/** "dd/mm/aaaa" → Date, ou null se não for uma data real. */
export function parseBR(s: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s || '');
  if (!m) return null;
  const d = +m[1], mo = +m[2], y = +m[3];
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return dt;
}

export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const toBR = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
export const isoToBR = (iso: string) => toBR(fromISO(iso));
export const shortBR = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;

/** Máscara de digitação: só dígitos (até 8) → dd, dd/mm, dd/mm/aaaa. */
export function maskDate(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 8);
  if (d.length > 4) return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
  if (d.length > 2) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return d;
}

/** Segunda-feira da semana de `d`. */
export function weekStart(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export const sameDay = (a: Date | null, b: Date | null) => !!a && !!b && a.getTime() === b.getTime();
