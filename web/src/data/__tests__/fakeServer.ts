import type { ErroApi, OperacaoApi, PessoaApi, ResultadoApi } from '../api';
import { normalizeName } from '../../lib/people';

/** Servidor em memória que segue o contrato de docs/back.md, só para os testes. */
export class FakeServer {
  pessoas = new Map<string, PessoaApi>();
  relogio = Date.parse('2026-11-03T12:00:00Z');
  fora = false;
  posts: OperacaoApi[][] = [];
  gets: string[] = [];

  agora() {
    this.relogio += 1000;
    return new Date(this.relogio).toISOString();
  }

  /** Mudança feita por outro aparelho. */
  mudar(id: string, campos: Partial<PessoaApi>) {
    const p = this.pessoas.get(id)!;
    Object.assign(p, campos, { versao: p.versao + 1, atualizado_em: this.agora() });
    return p;
  }

  semear(p: Partial<PessoaApi> & { id: string; nome: string; data: string; turno: 'manha' | 'tarde' }) {
    const t = this.agora();
    const r: PessoaApi = { status: null, criado_em: t, atualizado_em: t, excluido_em: null, versao: 1, ...p };
    this.pessoas.set(r.id, r);
    return r;
  }

  private duplicado(p: { id: string; nome: string; data: string; turno: string }) {
    for (const o of this.pessoas.values()) {
      if (o.id !== p.id && !o.excluido_em && o.data === p.data && o.turno === p.turno &&
        normalizeName(o.nome) === normalizeName(p.nome)) return o;
    }
    return undefined;
  }

  private aplicar(o: OperacaoApi): ResultadoApi {
    const atual = this.pessoas.get(o.id);
    const erro = (codigo: string, detalhes?: ErroApi['detalhes']): ResultadoApi => ({ id: o.id, op: o.op, ok: false, erro: { codigo, mensagem: codigo, detalhes } });
    const ok = (pessoa: PessoaApi): ResultadoApi => ({ id: o.id, op: o.op, ok: true, pessoa: { ...pessoa } });
    if (o.op === 'criar') {
      if (atual) return ok(atual);
      const d = o.dados!;
      const dup = this.duplicado({ id: o.id, nome: d.nome!, data: d.data!, turno: d.turno! });
      if (dup) return erro('DUPLICADO', { conflito: { id: dup.id, nome: dup.nome, data: dup.data, turno: dup.turno } });
      const t = this.agora();
      const r: PessoaApi = { id: o.id, nome: d.nome!, data: d.data!, turno: d.turno!, status: d.status ?? null, criado_em: t, atualizado_em: t, excluido_em: null, versao: 1 };
      this.pessoas.set(r.id, r);
      return ok(r);
    }
    if (!atual) return erro('NAO_ENCONTRADO');
    if (o.op === 'alterar') {
      const d = o.dados ?? {};
      // contrato final: mudar nome/data/turno sem versão é 422; só status dispensa a versão
      if (o.versao === undefined && ('nome' in d || 'data' in d || 'turno' in d)) return erro('VALIDACAO');
      if (o.versao !== undefined && o.versao !== atual.versao) return erro('CONFLITO_VERSAO', { atual: { ...atual } });
      const novo = { ...atual, ...o.dados };
      const dup = this.duplicado(novo);
      if (dup) return erro('DUPLICADO', { conflito: { id: dup.id, nome: dup.nome, data: dup.data, turno: dup.turno } });
      return ok(this.mudar(o.id, { ...o.dados }));
    }
    if (o.op === 'excluir') return ok(this.mudar(o.id, { excluido_em: this.agora() }));
    const dup = this.duplicado(atual);
    if (dup) return erro('DUPLICADO', { conflito: { id: dup.id, nome: dup.nome, data: dup.data, turno: dup.turno } });
    return ok(this.mudar(o.id, { excluido_em: null }));
  }

  fetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    if (this.fora) throw new TypeError('Failed to fetch');
    const u = new URL(String(url));
    const auth = (init?.headers as Record<string, string>)?.Authorization;
    if (auth !== 'Bearer segredo') return json(401, { codigo: 'NAO_AUTORIZADO', mensagem: 'Token inválido.' });
    if (u.pathname.endsWith('/sync') && init?.method === 'POST') {
      const ops = JSON.parse(String(init.body)) as OperacaoApi[];
      this.posts.push(ops);
      const resultados = ops.map((o) => this.aplicar(o));
      return json(200, { agora: this.agora(), resultados });
    }
    if (u.pathname.endsWith('/sync')) {
      const desde = u.searchParams.get('desde')!;
      this.gets.push(desde);
      const pessoas = [...this.pessoas.values()].filter((p) => p.atualizado_em > desde);
      return json(200, { agora: this.agora(), pessoas });
    }
    return json(404, { codigo: 'NAO_ENCONTRADO', mensagem: 'Rota inexistente.' });
  };
}

const json = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
