import type { Status, Turno } from '../lib/people';
import { lerConexao, conexaoCompleta, type Conexao } from './config';

// ----- formato da API (snake_case) -----
export interface PessoaApi {
  id: string;
  nome: string;
  data: string;
  turno: Turno;
  status: Status;
  criado_em: string;
  atualizado_em: string;
  excluido_em: string | null;
  versao: number;
}

export type OpNome = 'criar' | 'alterar' | 'excluir' | 'restaurar';

export interface DadosApi {
  id?: string;
  nome?: string;
  data?: string;
  turno?: Turno;
  status?: Status;
}

export interface OperacaoApi {
  op: OpNome;
  id: string;
  dados?: DadosApi;
  versao?: number;
}

export interface ErroApi {
  codigo: string;
  mensagem?: string;
  detalhes?: {
    conflito?: Partial<Pick<PessoaApi, 'id' | 'nome' | 'data' | 'turno'>>;
    atual?: PessoaApi;
    [k: string]: unknown;
  };
}

export interface ResultadoApi {
  id: string;
  op: OpNome;
  ok: boolean;
  pessoa?: PessoaApi;
  erro?: ErroApi;
}

export interface RespostaPush {
  agora: string;
  resultados: ResultadoApi[];
}

export interface RespostaPull {
  agora: string;
  pessoas: PessoaApi[];
}

// ----- erros -----
/** Sem rede, servidor fora do ar, CORS ou resposta ilegível: tenta de novo depois. */
export class RedeError extends Error {}

/** Resposta HTTP de erro da API. */
export class HttpError extends Error {
  constructor(
    public status: number,
    public codigo: string,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

// ----- cliente -----
const TIMEOUT_MS = 20_000;

export class ApiClient {
  constructor(private conexao: () => Conexao = lerConexao) {}

  get configurada() {
    return conexaoCompleta(this.conexao());
  }

  private async chamar<T>(caminho: string, init: RequestInit = {}): Promise<T> {
    const c = this.conexao();
    if (!conexaoCompleta(c)) throw new HttpError(0, 'SEM_CONFIG', 'API não configurada.');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${c.url}${caminho}`, {
        ...init,
        signal: ctrl.signal,
        headers: {
          Accept: 'application/json',
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          Authorization: `Bearer ${c.token}`,
        },
      });
    } catch (e) {
      throw new RedeError((e as Error)?.message || 'Sem conexão.');
    } finally {
      clearTimeout(timer);
    }
    let corpo: unknown = null;
    try {
      const txt = await res.text();
      corpo = txt ? JSON.parse(txt) : null;
    } catch {
      if (res.ok) throw new RedeError('Resposta inválida do servidor.');
    }
    if (!res.ok) {
      const e = (corpo ?? {}) as Partial<ErroApi>;
      throw new HttpError(res.status, e.codigo ?? `HTTP_${res.status}`, e.mensagem ?? `Erro ${res.status}.`);
    }
    return corpo as T;
  }

  /** Envia a fila em lote. A API responde um resultado por operação. */
  push(ops: OperacaoApi[]): Promise<RespostaPush> {
    return this.chamar<RespostaPush>('/sync', { method: 'POST', body: JSON.stringify(ops) });
  }

  /** Tudo que mudou depois de `desde` (inclusive excluídos). O `agora` devolvido é o próximo `desde`. */
  pull(desde: string): Promise<RespostaPull> {
    return this.chamar<RespostaPull>(`/sync?desde=${encodeURIComponent(desde)}`);
  }
}
