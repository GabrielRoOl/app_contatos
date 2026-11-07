import { DIAS_CURTOS, MESES, MESES_CURTOS, fromISO, pad, shortBR, weekStart } from './dates';

export type Turno = 'manha' | 'tarde';
export type Status = 'ok' | 'nao' | null;
export type View = 'dia' | 'semana' | 'mes';
export type StatusFilter = 'todos' | 'ok' | 'nao' | 'pend';

/** Mesmo formato da API (docs/back.md), em camelCase. */
export interface Pessoa {
  id: string;
  nome: string;
  data: string; // YYYY-MM-DD
  turno: Turno;
  status: Status;
  criadoEm: string; // ISO timestamp
  atualizadoEm: string; // ISO timestamp
  /** Última versão conhecida do servidor (0 = ainda não enviada). */
  versao: number;
  /** Erro que o servidor devolveu ao enviar esta pessoa; mostrado ao abrir o registro. */
  erro?: string | null;
}

/** UUID v4 gerado no cliente (criar offline). Funciona também fora de contexto seguro. */
export function newId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Pessoa nova, ainda só local: o id já nasce no cliente. */
export function novaPessoa(input: { nome: string; data: string; turno: Turno }, id = newId()): Pessoa {
  const agora = new Date().toISOString();
  return { id, status: null, criadoEm: agora, atualizadoEm: agora, versao: 0, erro: null, ...input };
}

export const TURNO_LABEL: Record<Turno, string> = { manha: 'Manhã', tarde: 'Tarde' };

export const cleanName = (s: string) => s.trim().replace(/\s+/g, ' ');

/** Minúsculo, sem acentos, espaços colapsados. Igual à regra do servidor. */
export const normalizeName = (s: string) =>
  cleanName(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export const defaultTurno = (now = new Date()): Turno => (now.getHours() < 12 ? 'manha' : 'tarde');

/** Regra: mesmo nome normalizado + mesma data + mesmo turno = duplicata. */
export function findDuplicate(
  people: Pessoa[],
  candidate: { nome: string; data: string; turno: Turno },
  ignoreId?: string,
): Pessoa | undefined {
  const n = normalizeName(candidate.nome);
  if (!n) return undefined;
  return people.find(
    (p) => p.id !== ignoreId && p.data === candidate.data && p.turno === candidate.turno && normalizeName(p.nome) === n,
  );
}

export function duplicateMessage(dup: Pick<Pessoa, 'nome' | 'data'>, turno: Turno) {
  return `${dup.nome} já está na lista em ${shortBR(fromISO(dup.data))} de ${turno === 'manha' ? 'manhã' : 'tarde'}. Mude o turno ou a data.`;
}

/** Data crescente → manhã antes de tarde → ordem de criação. */
export function sortPeople(list: Pessoa[]): Pessoa[] {
  return [...list].sort(
    (a, b) =>
      a.data.localeCompare(b.data) ||
      Number(a.turno === 'tarde') - Number(b.turno === 'tarde') ||
      a.criadoEm.localeCompare(b.criadoEm),
  );
}

/** Período inclusivo; cada lado opcional; inverte se vier trocado. */
export function normalizePeriod(from: Date | null, to: Date | null): [Date | null, Date | null] {
  if (from && to && from > to) return [to, from];
  return [from, to];
}

export function inPeriod(p: Pessoa, from: Date | null, to: Date | null) {
  const d = fromISO(p.data);
  return (!from || d >= from) && (!to || d <= to);
}

export function matchesStatus(p: Pessoa, f: StatusFilter) {
  if (f === 'ok') return p.status === 'ok';
  if (f === 'nao') return p.status === 'nao';
  if (f === 'pend') return !p.status;
  return true;
}

export interface Group {
  key: string;
  label: string;
  tag: string; // "Hoje · 3 pessoas"
  pend: number;
  items: Pessoa[];
}

export function groupPeople(list: Pessoa[], view: View, todayDate: Date): Group[] {
  const groups: Group[] = [];
  const byKey = new Map<string, Group & { extra: string }>();
  const t = todayDate.getTime();
  for (const p of list) {
    const dt = fromISO(p.data);
    let key: string, label: string, extra = '';
    if (view === 'dia') {
      key = p.data;
      label = `${DIAS_CURTOS[dt.getDay()]}, ${pad(dt.getDate())} de ${MESES[dt.getMonth()]}`;
      const diff = Math.round((dt.getTime() - t) / 86400000);
      extra = diff === 0 ? 'Hoje' : diff === 1 ? 'Amanhã' : diff === -1 ? 'Ontem' : '';
    } else if (view === 'semana') {
      const ws = weekStart(dt);
      const we = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + 6);
      key = `w${ws.getTime()}`;
      label = `Semana ${pad(ws.getDate())} ${MESES_CURTOS[ws.getMonth()]} – ${pad(we.getDate())} ${MESES_CURTOS[we.getMonth()]}`;
      extra = t >= ws.getTime() && t <= we.getTime() ? 'Esta semana' : '';
    } else {
      key = p.data.slice(0, 7);
      label = `${MESES[dt.getMonth()]} ${dt.getFullYear()}`;
    }
    let g = byKey.get(key);
    if (!g) {
      g = { key, label, tag: '', pend: 0, items: [], extra };
      byKey.set(key, g);
      groups.push(g);
    }
    g.items.push(p);
    if (!p.status) g.pend++;
  }
  for (const g of groups) {
    const n = g.items.length;
    const extra = byKey.get(g.key)!.extra;
    g.tag = `${extra ? extra + ' · ' : ''}${n} ${n === 1 ? 'pessoa' : 'pessoas'}`;
  }
  const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  return groups.map(({ key, label, tag, pend, items }) => ({ key, label: cap(label), tag, pend, items }));
}

export function personMeta(p: Pessoa) {
  const d = fromISO(p.data);
  return `${DIAS_CURTOS[d.getDay()]}, ${shortBR(d)}/${d.getFullYear()} · ${TURNO_LABEL[p.turno]}`;
}

/** Quem vai para Copiar/WhatsApp conforme o filtro de resultado. */
export function listToSend(periodList: Pessoa[], f: StatusFilter): Pessoa[] {
  if (f === 'nao') return periodList.filter((p) => p.status === 'nao');
  if (f === 'pend') return periodList.filter((p) => !p.status);
  return periodList.filter((p) => p.status === 'ok');
}

export const formatList = (list: Pessoa[]) => list.map((p, i) => `${i + 1}. ${p.nome}`).join('\n');

export function sendSubtitle(f: StatusFilter, n: number) {
  if (f === 'nao') return `${n} ${n === 1 ? 'que não foi' : 'que não foram'}`;
  if (f === 'pend') return `${n} ${n === 1 ? 'pendente' : 'pendentes'}`;
  return `${n} ${n === 1 ? 'que foi' : 'que foram'}`;
}
