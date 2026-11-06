import type { Pessoa, Status, Turno } from '../lib/people';

/**
 * Ponto de integração do agente de front.
 * Troque `LocalRepository` por uma implementação com IndexedDB + fila offline + API
 * (contrato em docs/back.md). A interface não deve mudar: os componentes só falam com ela.
 */
export interface PessoasRepository {
  list(): Promise<Pessoa[]>;
  create(input: { nome: string; data: string; turno: Turno }): Promise<Pessoa>;
  update(id: string, patch: Partial<{ nome: string; data: string; turno: Turno; status: Status }>): Promise<Pessoa>;
  /** Exclusão lógica (soft delete) — permite desfazer. */
  remove(id: string): Promise<void>;
  restore(id: string): Promise<Pessoa>;
}

const KEY = 'app-contatos:pessoas';
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

type Stored = Pessoa & { excluidoEm?: string | null };

/** Implementação provisória: localStorage. Só para desenvolver as telas. */
export class LocalRepository implements PessoasRepository {
  private read(): Stored[] {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as Stored[]) : [];
    } catch {
      return [];
    }
  }
  private write(all: Stored[]) {
    try {
      localStorage.setItem(KEY, JSON.stringify(all));
    } catch {
      /* armazenamento indisponível: segue só em memória */
    }
  }
  async list() {
    return this.read().filter((p) => !p.excluidoEm);
  }
  async create(input: { nome: string; data: string; turno: Turno }) {
    const p: Stored = { id: uid(), status: null, criadoEm: new Date().toISOString(), ...input };
    this.write([...this.read(), p]);
    return p;
  }
  async update(id: string, patch: Partial<Pessoa>) {
    const all = this.read();
    const i = all.findIndex((p) => p.id === id);
    if (i < 0) throw new Error('NAO_ENCONTRADO');
    all[i] = { ...all[i], ...patch };
    this.write(all);
    return all[i];
  }
  async remove(id: string) {
    const all = this.read().map((p) => (p.id === id ? { ...p, excluidoEm: new Date().toISOString() } : p));
    this.write(all);
  }
  async restore(id: string) {
    const all = this.read();
    const i = all.findIndex((p) => p.id === id);
    if (i < 0) throw new Error('NAO_ENCONTRADO');
    all[i] = { ...all[i], excluidoEm: null };
    this.write(all);
    return all[i];
  }
}
