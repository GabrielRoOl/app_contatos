import type { DadosApi, OpNome } from './api';
import type { Pessoa } from '../lib/people';

/** Registro guardado no IndexedDB: a Pessoa do front mais o controle de sincronização. */
export interface Registro extends Pessoa {
  excluidoEm: string | null;
  /** O servidor ainda não conhece este id (criação pendente ou recusada). */
  naoEnviado?: boolean;
}

/** Operação pendente de envio. `seq` define a ordem. */
export interface Operacao {
  seq?: number;
  op: OpNome;
  id: string;
  /** Campos alterados (alterar) ou o registro inteiro (criar). */
  dados?: DadosApi;
  /** Quando o usuário fez a mudança neste aparelho (para decidir conflitos). */
  em: string;
  tentativas: number;
}

export const PESSOAS = 'pessoas';
export const FILA = 'fila';
export const META = 'meta';

export const req = <T>(r: IDBRequest<T>): Promise<T> =>
  new Promise((ok, err) => {
    r.onsuccess = () => ok(r.result);
    r.onerror = () => err(r.error);
  });

export function abrirBanco(nome = 'app-contatos'): Promise<IDBDatabase> {
  return new Promise((ok, err) => {
    const r = indexedDB.open(nome, 1);
    r.onupgradeneeded = () => {
      const db = r.result;
      db.createObjectStore(PESSOAS, { keyPath: 'id' });
      db.createObjectStore(FILA, { keyPath: 'seq', autoIncrement: true });
      db.createObjectStore(META);
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => err(r.error);
    r.onblocked = () => err(new Error('Banco local bloqueado por outra aba.'));
  });
}

/**
 * Executa `fn` numa única transação (leitura e escrita atômicas).
 * Dentro de `fn` só use requisições do IndexedDB; qualquer outro `await` encerra a transação.
 */
export function transacao<T>(
  db: IDBDatabase,
  lojas: string[],
  fn: (t: IDBTransaction) => Promise<T>,
): Promise<T> {
  return new Promise((ok, err) => {
    const t = db.transaction(lojas, 'readwrite');
    let resultado: T;
    fn(t).then(
      (r) => {
        resultado = r;
      },
      (e) => {
        try {
          t.abort();
        } catch {
          /* já encerrada */
        }
        err(e);
      },
    );
    t.oncomplete = () => ok(resultado);
    t.onerror = () => err(t.error);
    t.onabort = () => err(t.error ?? new Error('Transação cancelada.'));
  });
}
