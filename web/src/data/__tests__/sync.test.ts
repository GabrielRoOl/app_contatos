import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { ApiClient } from '../api';
import { OfflineRepository } from '../offlineRepository';
import type { EventoRepo } from '../repository';
import { novaPessoa } from '../../lib/people';
import { FakeServer } from './fakeServer';

let srv: FakeServer;
let n = 0;
let eventos: EventoRepo[];
let repo: OfflineRepository;

beforeEach(() => {
  srv = new FakeServer();
  globalThis.fetch = srv.fetch as typeof fetch;
  const api = new ApiClient(() => ({ url: 'http://api.test/api/v1', token: 'segredo' }));
  repo = new OfflineRepository({ api, banco: `teste-${++n}`, atrasoMs: 60_000 });
  eventos = [];
  repo.subscribe((e) => eventos.push(e));
});

const ana = { nome: 'Ana Souza', data: '2026-11-03', turno: 'manha' as const };

describe('escrita local e envio', () => {
  it('grava local, cria no servidor com o id do cliente e guarda a versão', async () => {
    const p = novaPessoa(ana);
    await repo.create(p);
    expect(await repo.list()).toHaveLength(1);
    expect(await repo.pendentes()).toBe(1);

    await repo.sincronizar();
    expect(srv.pessoas.get(p.id)?.nome).toBe('Ana Souza');
    expect(await repo.pendentes()).toBe(0);
    expect((await repo.list())[0].versao).toBe(1);
    expect(repo.estado).toBe('ocioso');
  });

  it('junta edições feitas antes do envio numa única operação', async () => {
    const p = novaPessoa(ana);
    await repo.create(p);
    await repo.update(p.id, { status: 'ok' });
    await repo.update(p.id, { nome: 'Ana S.' });
    expect(await repo.pendentes()).toBe(1);
    await repo.sincronizar();
    expect(srv.posts[0]).toHaveLength(1);
    expect(srv.pessoas.get(p.id)).toMatchObject({ nome: 'Ana S.', status: 'ok' });
  });

  it('sem rede mantém a fila e envia depois', async () => {
    const p = novaPessoa(ana);
    await repo.create(p);
    srv.fora = true;
    await repo.sincronizar();
    expect(repo.estado).toBe('offline');
    expect(await repo.pendentes()).toBe(1);
    srv.fora = false;
    await repo.sincronizar();
    expect(await repo.pendentes()).toBe(0);
    expect(srv.pessoas.has(p.id)).toBe(true);
  });

  it('alterar depois de sincronizado usa a versão conhecida', async () => {
    const p = novaPessoa(ana);
    await repo.create(p);
    await repo.sincronizar();
    await repo.update(p.id, { status: 'nao' });
    await repo.sincronizar();
    expect(srv.posts[srv.posts.length - 1][0]).toMatchObject({ op: 'alterar', versao: 1, dados: { status: 'nao' } });
    expect((await repo.list())[0]).toMatchObject({ status: 'nao', versao: 2 });
  });

  it('editar nome/data/turno sempre envia a versão conhecida', async () => {
    const p = novaPessoa(ana);
    await repo.create(p);
    await repo.sincronizar();
    await repo.update(p.id, { nome: 'Ana Maria', turno: 'tarde' });
    await repo.sincronizar();
    expect(srv.posts[srv.posts.length - 1][0].versao).toBe(1);
    expect(srv.pessoas.get(p.id)).toMatchObject({ nome: 'Ana Maria', turno: 'tarde', versao: 2 });
    expect((await repo.list())[0].erro).toBeFalsy();
    // excluir e restaurar também aumentam a versão; a edição seguinte usa a nova
    await repo.remove(p.id);
    await repo.restore(p.id);
    await repo.update(p.id, { nome: 'Ana M.' });
    await repo.sincronizar();
    expect(srv.pessoas.get(p.id)).toMatchObject({ nome: 'Ana M.', versao: 5 });
  });

  it('token errado vira nao_autorizado e preserva a fila', async () => {
    const api = new ApiClient(() => ({ url: 'http://api.test/api/v1', token: 'errado' }));
    const r = new OfflineRepository({ api, banco: `teste-${++n}` });
    await r.create(novaPessoa(ana));
    await r.sincronizar();
    expect(r.estado).toBe('nao_autorizado');
    expect(await r.pendentes()).toBe(1);
  });
});

describe('pull', () => {
  it('traz pessoas do servidor, inclusive excluídas, e usa o agora como próximo desde', async () => {
    const a = srv.semear({ id: 'a', nome: 'Ana', data: '2026-11-03', turno: 'manha' });
    srv.semear({ id: 'b', nome: 'Bia', data: '2026-11-03', turno: 'tarde' });
    await repo.sincronizar();
    expect((await repo.list()).map((p) => p.nome).sort()).toEqual(['Ana', 'Bia']);
    expect(srv.gets[0]).toBe('1970-01-01T00:00:00Z');

    srv.mudar(a.id, { excluido_em: srv.agora() });
    await repo.sincronizar();
    expect((await repo.list()).map((p) => p.nome)).toEqual(['Bia']);
    expect(srv.gets[1] > srv.gets[0]).toBe(true);
    expect(eventos.length).toBeGreaterThan(0);
  });

  it('não sobrescreve mudança local que ainda não foi enviada', async () => {
    srv.semear({ id: 'a', nome: 'Ana', data: '2026-11-03', turno: 'manha' });
    await repo.sincronizar();
    srv.fora = true;
    await repo.update('a', { status: 'ok' });
    srv.fora = false;
    srv.mudar('a', { nome: 'Ana Maria' });
    await repo.sincronizar(); // envia status (conflito de versão, status vence) e puxa o resto
    const [p] = await repo.list();
    expect(p.status).toBe('ok');
    expect(srv.pessoas.get('a')?.status).toBe('ok');
  });
});

describe('erros e conflitos', () => {
  it('DUPLICADO na criação marca o item com o erro e mantém na lista', async () => {
    srv.semear({ id: 'x', nome: 'Ana Souza', data: '2026-11-03', turno: 'manha' });
    const p = novaPessoa({ ...ana, nome: 'ana souza' });
    await repo.create(p);
    await repo.sincronizar();
    const l = await repo.list();
    const meu = l.find((q) => q.id === p.id)!;
    expect(meu.erro).toMatch(/Ana Souza já está na lista em 03\/11 de manhã/);
    expect(await repo.pendentes()).toBe(0);

    // corrigir o turno reenvia como nova criação e limpa o erro
    await repo.update(p.id, { turno: 'tarde' });
    expect(await repo.pendentes()).toBe(1);
    await repo.sincronizar();
    expect((await repo.list()).find((q) => q.id === p.id)?.erro).toBeFalsy();
    expect(srv.pessoas.get(p.id)?.turno).toBe('tarde');
  });

  it('CONFLITO_VERSAO só de status: reenvia sobre a versão do servidor', async () => {
    srv.semear({ id: 'a', nome: 'Ana', data: '2026-11-03', turno: 'manha' });
    await repo.sincronizar();
    // outro aparelho mexe depois de o celular ficar sem rede
    srv.fora = true;
    await repo.update('a', { status: 'ok' });
    srv.fora = false;
    srv.mudar('a', { nome: 'Ana Maria' });
    srv.mudar('a', { status: 'nao' });
    await repo.sincronizar();
    expect(srv.pessoas.get('a')).toMatchObject({ status: 'ok', nome: 'Ana Maria' });
    expect((await repo.list())[0]).toMatchObject({ status: 'ok', nome: 'Ana Maria' });
  });

  it('CONFLITO_VERSAO em campos: servidor mais recente vence e a tela volta a ele', async () => {
    srv.semear({ id: 'a', nome: 'Ana', data: '2026-11-03', turno: 'manha' });
    await repo.sincronizar();
    srv.fora = true;
    await repo.update('a', { nome: 'Ana Local' });
    srv.fora = false;
    // servidor alterado "no futuro" em relação à edição local
    srv.relogio = Date.now() + 3_600_000;
    srv.mudar('a', { nome: 'Ana Servidor' });
    await repo.sincronizar();
    expect((await repo.list())[0].nome).toBe('Ana Servidor');
    expect(await repo.pendentes()).toBe(0);
  });

  it('CONFLITO_VERSAO em campos: alteração local mais recente vence', async () => {
    srv.semear({ id: 'a', nome: 'Ana', data: '2026-11-03', turno: 'manha' });
    await repo.sincronizar();
    srv.mudar('a', { nome: 'Ana Servidor' }); // relógio do servidor em 2026-11-03: bem antes de agora
    srv.fora = true;
    await repo.update('a', { nome: 'Ana Local' });
    srv.fora = false;
    srv.relogio = Date.parse('2020-01-01T00:00:00Z');
    await repo.sincronizar();
    expect(srv.pessoas.get('a')?.nome).toBe('Ana Local');
    expect((await repo.list())[0].nome).toBe('Ana Local');
  });

  it('409 ao restaurar: continua excluída e avisa', async () => {
    const p = novaPessoa(ana);
    await repo.create(p);
    await repo.sincronizar();
    await repo.remove(p.id);
    await repo.sincronizar();
    expect(await repo.list()).toHaveLength(0);

    // outro aparelho ocupa o lugar
    srv.semear({ id: 'y', nome: 'Ana Souza', data: '2026-11-03', turno: 'manha' });
    await repo.restore(p.id);
    expect(await repo.list()).toHaveLength(1); // otimista
    eventos.length = 0;
    await repo.sincronizar();
    const nomes = (await repo.list()).map((q) => q.id);
    expect(nomes).toEqual(['y']);
    expect(eventos.some((e) => /Não foi possível desfazer/.test(e.mensagem ?? ''))).toBe(true);
  });

  it('excluir e desfazer rápido: ambas as operações chegam ao servidor', async () => {
    const p = novaPessoa(ana);
    await repo.create(p);
    await repo.sincronizar();
    await repo.remove(p.id);
    await repo.restore(p.id);
    await repo.sincronizar();
    expect(srv.pessoas.get(p.id)?.excluido_em).toBeNull();
    expect(await repo.list()).toHaveLength(1);
  });

  it('criar e excluir antes de sincronizar não deixa lixo', async () => {
    const p = novaPessoa(ana);
    await repo.create(p);
    await repo.remove(p.id);
    await repo.sincronizar();
    expect(srv.pessoas.get(p.id)?.excluido_em).toBeTruthy();
    expect(await repo.list()).toHaveLength(0);
    expect(await repo.pendentes()).toBe(0);
  });
});
