import { ApiClient, HttpError, RedeError, type OperacaoApi, type ResultadoApi } from './api';
import { aoMudarConexao } from './config';
import { abrirBanco, FILA, META, PESSOAS, req, transacao, type Operacao, type Registro } from './db';
import { deApi, paraPessoa } from './mapa';
import type { EventoRepo, PessoasRepository } from './repository';
import { duplicateMessage, type Pessoa, type Status, type Turno } from '../lib/people';

export type EstadoSync = 'ocioso' | 'sincronizando' | 'offline' | 'nao_autorizado' | 'sem_config' | 'erro';

type Patch = Partial<{ nome: string; data: string; turno: Turno; status: Status }>;

const DESDE_INICIAL = '1970-01-01T00:00:00Z';
const MAX_TENTATIVAS_CONFLITO = 3;
const LOTE = 100;

const naoEncontrado = () => new Error('NAO_ENCONTRADO');
const ms = (iso: string) => Date.parse(iso) || 0;

interface Opcoes {
  api?: ApiClient;
  /** Nome do banco (testes usam um por caso). */
  banco?: string;
  /** Espera antes de sincronizar depois de uma escrita local. */
  atrasoMs?: number;
}

/**
 * IndexedDB como cópia local + fila de operações + sincronização com a API.
 * Toda escrita vai primeiro para o banco local e para a fila; a tela responde na hora.
 */
export class OfflineRepository implements PessoasRepository {
  private api: ApiClient;
  private nomeBanco: string;
  private atraso: number;
  private db?: Promise<IDBDatabase>;
  private ouvintes = new Set<(e: EventoRepo) => void>();
  private ouvintesEstado = new Set<(s: EstadoSync) => void>();
  private _estado: EstadoSync = 'ocioso';
  private emVoo = new Set<number>();
  private rodando: Promise<void> | null = null;
  private denovo = false;
  private timer?: ReturnType<typeof setTimeout>;

  constructor(o: Opcoes = {}) {
    this.api = o.api ?? new ApiClient();
    this.nomeBanco = o.banco ?? 'app-contatos';
    this.atraso = o.atrasoMs ?? 300;
  }

  private banco() {
    return (this.db ??= abrirBanco(this.nomeBanco));
  }

  // ---------- leitura e escrita local ----------

  async list(): Promise<Pessoa[]> {
    const db = await this.banco();
    const todos = await req(db.transaction(PESSOAS).objectStore(PESSOAS).getAll() as IDBRequest<Registro[]>);
    return todos.filter((r) => !r.excluidoEm).map(paraPessoa);
  }

  async create(p: Pessoa): Promise<Pessoa> {
    const db = await this.banco();
    const agora = new Date().toISOString();
    const reg: Registro = { ...p, erro: null, excluidoEm: null, naoEnviado: true };
    await transacao(db, [PESSOAS, FILA], async (t) => {
      await req(t.objectStore(PESSOAS).put(reg));
      await req(t.objectStore(FILA).add(this.opCriar(reg, agora)));
    });
    this.agendar();
    return paraPessoa(reg);
  }

  async update(id: string, patch: Patch): Promise<Pessoa> {
    const db = await this.banco();
    const agora = new Date().toISOString();
    const novo = await transacao(db, [PESSOAS, FILA], async (t) => {
      const pes = t.objectStore(PESSOAS);
      const fila = t.objectStore(FILA);
      const r = (await req(pes.get(id))) as Registro | undefined;
      if (!r) throw naoEncontrado();
      const n: Registro = { ...r, ...patch, erro: null, atualizadoEm: agora };
      await req(pes.put(n));
      const ops = await this.opsDe(fila, id);
      const ultima = ops[ops.length - 1];
      if (ultima && (ultima.op === 'criar' || ultima.op === 'alterar') && !this.emVoo.has(ultima.seq!)) {
        // junta com a operação que ainda não saiu: mantém a fila curta
        await req(fila.put({ ...ultima, dados: { ...ultima.dados, ...patch }, em: agora }));
      } else if (n.naoEnviado && !ops.some((o) => o.op === 'criar')) {
        // o servidor recusou a criação antes: a edição vira uma nova tentativa de criar
        await req(fila.add(this.opCriar(n, agora)));
      } else {
        await req(fila.add({ op: 'alterar', id, dados: patch, em: agora, tentativas: 0 } satisfies Operacao));
      }
      return n;
    });
    this.agendar();
    return paraPessoa(novo);
  }

  async remove(id: string): Promise<void> {
    const db = await this.banco();
    const agora = new Date().toISOString();
    await transacao(db, [PESSOAS, FILA], async (t) => {
      const r = (await req(t.objectStore(PESSOAS).get(id))) as Registro | undefined;
      if (!r) throw naoEncontrado();
      await req(t.objectStore(PESSOAS).put({ ...r, excluidoEm: agora, atualizadoEm: agora }));
      await req(t.objectStore(FILA).add({ op: 'excluir', id, em: agora, tentativas: 0 } satisfies Operacao));
    });
    this.agendar();
  }

  async restore(id: string): Promise<Pessoa> {
    const db = await this.banco();
    const agora = new Date().toISOString();
    const novo = await transacao(db, [PESSOAS, FILA], async (t) => {
      const pes = t.objectStore(PESSOAS);
      const fila = t.objectStore(FILA);
      const r = (await req(pes.get(id))) as Registro | undefined;
      if (!r) throw naoEncontrado();
      const n: Registro = { ...r, excluidoEm: null, erro: null, atualizadoEm: agora };
      await req(pes.put(n));
      const ops = await this.opsDe(fila, id);
      if (n.naoEnviado && !ops.some((o) => o.op === 'criar')) await req(fila.add(this.opCriar(n, agora)));
      else await req(fila.add({ op: 'restaurar', id, em: agora, tentativas: 0 } satisfies Operacao));
      return n;
    });
    this.agendar();
    return paraPessoa(novo);
  }

  private opCriar(r: Registro, em: string): Operacao {
    return {
      op: 'criar',
      id: r.id,
      dados: { id: r.id, nome: r.nome, data: r.data, turno: r.turno, status: r.status },
      em,
      tentativas: 0,
    };
  }

  private async opsDe(fila: IDBObjectStore, id: string): Promise<Operacao[]> {
    const todas = (await req(fila.getAll())) as Operacao[];
    return todas.filter((o) => o.id === id).sort((a, b) => a.seq! - b.seq!);
  }

  // ---------- notificações ----------

  subscribe(ouvinte: (e: EventoRepo) => void) {
    this.ouvintes.add(ouvinte);
    return () => {
      this.ouvintes.delete(ouvinte);
    };
  }

  private emitir(e: EventoRepo) {
    this.ouvintes.forEach((f) => f(e));
  }

  get estado() {
    return this._estado;
  }

  aoMudarEstado(f: (s: EstadoSync) => void) {
    this.ouvintesEstado.add(f);
    return () => {
      this.ouvintesEstado.delete(f);
    };
  }

  private setEstado(s: EstadoSync) {
    if (s === this._estado) return;
    this._estado = s;
    this.ouvintesEstado.forEach((f) => f(s));
  }

  /** Quantas operações ainda não chegaram ao servidor. */
  async pendentes(): Promise<number> {
    const db = await this.banco();
    return req(db.transaction(FILA).objectStore(FILA).count());
  }

  // ---------- sincronização ----------

  /** Liga os gatilhos (volta da rede, app voltando ao primeiro plano, intervalo) e sincroniza já. */
  start(): () => void {
    const gatilho = () => void this.sincronizar();
    const visivel = () => document.visibilityState === 'visible' && gatilho();
    window.addEventListener('online', gatilho);
    document.addEventListener('visibilitychange', visivel);
    const intervalo = window.setInterval(() => document.visibilityState === 'visible' && gatilho(), 60_000);
    const semConexao = aoMudarConexao(gatilho);
    gatilho();
    return () => {
      window.removeEventListener('online', gatilho);
      document.removeEventListener('visibilitychange', visivel);
      window.clearInterval(intervalo);
      semConexao();
      clearTimeout(this.timer);
    };
  }

  private agendar() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.sincronizar(), this.atraso);
  }

  /** Uma passada de cada vez; pedidos que chegam durante uma passada geram outra logo depois. */
  sincronizar(): Promise<void> {
    if (this.rodando) {
      this.denovo = true;
      return this.rodando;
    }
    this.rodando = (async () => {
      do {
        this.denovo = false;
        await this.passada();
      } while (this.denovo);
    })().finally(() => {
      this.rodando = null;
    });
    return this.rodando;
  }

  private async passada() {
    if (!this.api.configurada) return this.setEstado('sem_config');
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return this.setEstado('offline');
    this.setEstado('sincronizando');
    const mensagens: string[] = [];
    let mudou = false;
    try {
      mudou = (await this.enviar(mensagens)) || mudou;
      mudou = (await this.puxar()) || mudou;
      await this.limparNaoEnviadosExcluidos();
      this.setEstado('ocioso');
    } catch (e) {
      if (e instanceof RedeError) this.setEstado('offline');
      else if (e instanceof HttpError && e.status === 401) this.setEstado('nao_autorizado');
      else this.setEstado('erro');
    }
    if (mudou || mensagens.length) {
      if (mensagens.length) mensagens.forEach((mensagem) => this.emitir({ mensagem }));
      else this.emitir({});
    }
  }

  /** Manda a fila em ordem. Cada lote leva no máximo uma operação por id, para a versão ficar certa. */
  private async enviar(mensagens: string[]): Promise<boolean> {
    const db = await this.banco();
    let mudou = false;
    for (let volta = 0; volta < 50; volta++) {
      const fila = (
        (await req(db.transaction(FILA).objectStore(FILA).getAll())) as Operacao[]
      ).sort((a, b) => a.seq! - b.seq!);
      if (!fila.length) break;
      const vistos = new Set<string>();
      const lote = fila.filter((o) => !vistos.has(o.id) && vistos.add(o.id)).slice(0, LOTE);
      // marca já, sem await no meio: edições novas não podem mexer numa operação que está saindo
      lote.forEach((o) => this.emVoo.add(o.seq!));
      try {
        const corpo: OperacaoApi[] = [];
        const enviadas: Operacao[] = [];
        for (const o of lote) {
          const reg = (await req(db.transaction(PESSOAS).objectStore(PESSOAS).get(o.id))) as Registro | undefined;
          if (!reg) {
            await req(db.transaction(FILA, 'readwrite').objectStore(FILA).delete(o.seq!));
            continue;
          }
          const op: OperacaoApi = { op: o.op, id: o.id };
          if (o.dados) op.dados = o.dados;
          if (o.op === 'alterar' && reg.versao > 0) op.versao = reg.versao;
          corpo.push(op);
          enviadas.push(o);
        }
        if (!corpo.length) continue;

        const resp = await this.api.push(corpo);
        const porId = new Map<string, ResultadoApi>((resp.resultados ?? []).map((r) => [r.id, r]));
        for (const o of enviadas) {
          const res = porId.get(o.id);
          if (!res) throw new RedeError('Resposta incompleta do servidor.');
          await this.processar(db, o, res, mensagens);
        }
      } finally {
        lote.forEach((o) => this.emVoo.delete(o.seq!));
      }
      mudou = true;
    }
    return mudou;
  }

  private processar(db: IDBDatabase, op: Operacao, res: ResultadoApi, mensagens: string[]) {
    return transacao(db, [PESSOAS, FILA], async (t) => {
      const pes = t.objectStore(PESSOAS);
      const fila = t.objectStore(FILA);
      const reg = (await req(pes.get(op.id))) as Registro | undefined;
      const outras = (await this.opsDe(fila, op.id)).filter((o) => o.seq !== op.seq);
      const descartarOutras = () => Promise.all(outras.map((o) => req(fila.delete(o.seq!))));
      const larguei = () => req(fila.delete(op.seq!));

      // sucesso
      if (res.ok) {
        await larguei();
        if (!res.pessoa) return;
        const srv = deApi(res.pessoa);
        if (!reg || !outras.length) await req(pes.put(srv));
        else await req(pes.put({ ...reg, versao: srv.versao, criadoEm: srv.criadoEm, naoEnviado: false }));
        return;
      }

      const erro = res.erro;
      const dup = erro?.detalhes?.conflito;
      const textoDup = dup?.nome && dup.data && dup.turno
        ? duplicateMessage({ nome: dup.nome, data: dup.data }, dup.turno)
        : 'Já existe uma pessoa igual na lista. Mude o turno ou a data.';

      switch (erro?.codigo) {
        case 'DUPLICADO': {
          await larguei();
          if (op.op === 'restaurar') {
            // 409 ao restaurar: outra pessoa ocupou o lugar. Continua excluída e a tela volta ao estado real.
            await descartarOutras();
            if (reg) await req(pes.put({ ...reg, excluidoEm: reg.excluidoEm ?? new Date().toISOString(), erro: null }));
            mensagens.push(`Não foi possível desfazer: ${textoDup.replace(/ Mude o turno ou a data\.$/, '')}`);
          } else {
            // fica na lista com o erro; a mensagem aparece quando a pessoa abrir o registro
            if (op.op === 'criar') await descartarOutras();
            if (reg) await req(pes.put({ ...reg, erro: textoDup }));
          }
          return;
        }
        case 'CONFLITO_VERSAO': {
          const atual = erro.detalhes?.atual;
          if (reg && atual) {
            const soStatus = !!op.dados && Object.keys(op.dados).every((k) => k === 'status');
            const localMaisNovo = ms(op.em) > ms(atual.atualizado_em);
            if (op.op === 'alterar' && (soStatus || localMaisNovo) && op.tentativas < MAX_TENTATIVAS_CONFLITO) {
              // status: vale a última alteração; campos: vale a mais recente. Reenvia sobre a versão atual.
              await req(fila.put({ ...op, tentativas: op.tentativas + 1 }));
              await req(pes.put({ ...reg, versao: atual.versao }));
              return;
            }
          }
          // o servidor vence: a tela volta para o registro dele
          await larguei();
          await descartarOutras();
          if (atual) await req(pes.put(deApi(atual)));
          return;
        }
        case 'NAO_ENCONTRADO': {
          await larguei();
          await descartarOutras();
          if (reg) await req(pes.delete(op.id));
          if (op.op === 'restaurar') mensagens.push('Não foi possível desfazer a exclusão.');
          return;
        }
        default: {
          // VALIDACAO ou desconhecido: marca o registro com o motivo
          await larguei();
          if (op.op === 'criar') await descartarOutras();
          if (reg) await req(pes.put({ ...reg, erro: erro?.mensagem ?? 'O servidor recusou esta alteração.' }));
        }
      }
    });
  }

  /** Baixa o que mudou no servidor. O `agora` dele é o próximo `desde`. */
  private async puxar(): Promise<boolean> {
    const db = await this.banco();
    const desde = ((await req(db.transaction(META).objectStore(META).get('desde'))) as string | undefined) ?? DESDE_INICIAL;
    const resp = await this.api.pull(desde);
    await transacao(db, [PESSOAS, FILA, META], async (t) => {
      const pes = t.objectStore(PESSOAS);
      const filaIds = new Set(((await req(t.objectStore(FILA).getAll())) as Operacao[]).map((o) => o.id));
      for (const srv of resp.pessoas ?? []) {
        const reg = (await req(pes.get(srv.id))) as Registro | undefined;
        if (filaIds.has(srv.id)) continue; // há mudança local a caminho: ela vence até ser enviada
        if (reg?.erro) continue; // a pessoa ainda precisa corrigir o erro
        if (reg && !reg.naoEnviado && srv.versao < reg.versao) continue; // eco de versão antiga
        await req(pes.put(deApi(srv)));
      }
      await req(t.objectStore(META).put(resp.agora, 'desde'));
    });
    return (resp.pessoas ?? []).length > 0;
  }

  /** Registros que nunca chegaram ao servidor e foram excluídos não têm mais o que enviar. */
  private async limparNaoEnviadosExcluidos() {
    const db = await this.banco();
    await transacao(db, [PESSOAS, FILA], async (t) => {
      const ids = new Set(((await req(t.objectStore(FILA).getAll())) as Operacao[]).map((o) => o.id));
      const todos = (await req(t.objectStore(PESSOAS).getAll())) as Registro[];
      for (const r of todos) {
        if (r.excluidoEm && r.naoEnviado && !ids.has(r.id)) await req(t.objectStore(PESSOAS).delete(r.id));
      }
    });
  }
}
