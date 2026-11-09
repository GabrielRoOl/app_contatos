import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { precisaConectar } from '../acesso';
import { ApiClient } from '../api';
import { OfflineRepository } from '../offlineRepository';
import { novaPessoa } from '../../lib/people';
import { FakeServer } from './fakeServer';

let srv: FakeServer;
let n = 0;
let guardado: Map<string, string>;

beforeEach(() => {
  srv = new FakeServer();
  globalThis.fetch = srv.fetch as typeof fetch;
  guardado = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => guardado.get(k) ?? null,
    setItem: (k: string, v: string) => void guardado.set(k, v),
  });
  vi.resetModules();
});
afterEach(() => vi.unstubAllGlobals());

const ana = { nome: 'Ana Souza', data: '2026-11-03', turno: 'manha' as const };
const URL = 'http://api.test/api/v1';

describe('bloqueio por token', () => {
  it('sem token guardado, bloqueia em qualquer estado da sincronização', () => {
    for (const estado of ['ocioso', 'offline', 'sem_config', 'erro', 'sincronizando'] as const) {
      expect(precisaConectar(false, estado)).toBe(true);
    }
  });

  it('sem token no aparelho, temToken é falso; salvar o token libera', async () => {
    const config = await import('../config');
    expect(config.temToken()).toBe(false);
    config.salvarConexao({ url: URL, token: '  segredo  ' });
    expect(config.temToken()).toBe(true);
    expect(config.lerConexao().token).toBe('segredo');
  });

  it('com token guardado, abre sem rede: o token não é conferido online', async () => {
    const config = await import('../config');
    config.salvarConexao({ url: URL, token: 'segredo' });
    srv.fora = true;
    const repo = new OfflineRepository({ api: new ApiClient(config.lerConexao), banco: `acesso-${++n}`, atrasoMs: 60_000 });
    await repo.sincronizar();
    expect(repo.estado).toBe('offline');
    expect(precisaConectar(config.temToken(), repo.estado)).toBe(false);
    // continua usando e gravando localmente
    await repo.create(novaPessoa(ana));
    expect(await repo.list()).toHaveLength(1);
  });

  it('a próxima abertura com token guardado continua liberada mesmo antes de qualquer sincronização', async () => {
    const config = await import('../config');
    config.salvarConexao({ url: URL, token: 'segredo' });
    expect(precisaConectar(config.temToken(), 'ocioso')).toBe(false);
  });

  it('401 volta a bloquear, mantém dados e fila, e o token novo envia tudo', async () => {
    let token = 'errado';
    const repo = new OfflineRepository({ api: new ApiClient(() => ({ url: URL, token })), banco: `acesso-${++n}`, atrasoMs: 60_000 });
    const p = novaPessoa(ana);
    await repo.create(p);
    await repo.sincronizar();

    expect(repo.estado).toBe('nao_autorizado');
    expect(precisaConectar(true, repo.estado)).toBe(true);
    // nada se perde ao bloquear
    expect(await repo.list()).toHaveLength(1);
    expect(await repo.pendentes()).toBe(1);
    expect(srv.pessoas.size).toBe(0);

    // o usuário digita o token válido: a fila sai e o app libera
    token = 'segredo';
    await repo.sincronizar();
    expect(repo.estado).toBe('ocioso');
    expect(precisaConectar(true, repo.estado)).toBe(false);
    expect(await repo.pendentes()).toBe(0);
    expect(srv.pessoas.get(p.id)?.nome).toBe('Ana Souza');
    expect(await repo.list()).toHaveLength(1);
  });
});

describe('endereço da API', () => {
  it('em produção, sem URL salva, usa a origem da página', async () => {
    const { resolverUrlPadrao } = await import('../config');
    expect(resolverUrlPadrao(false, undefined, 'https://app.exemplo.test')).toBe('https://app.exemplo.test/api/v1');
  });

  it('em produção ignora o VITE_API_URL do .env, mesmo que ele seja localhost', async () => {
    const { resolverUrlPadrao } = await import('../config');
    expect(resolverUrlPadrao(false, 'http://localhost:3333/api/v1', 'https://app.exemplo.test')).toBe(
      'https://app.exemplo.test/api/v1',
    );
  });

  it('em desenvolvimento usa o VITE_API_URL', async () => {
    const { resolverUrlPadrao } = await import('../config');
    expect(resolverUrlPadrao(true, ' http://localhost:3333/api/v1 ', 'http://localhost:5173')).toBe('http://localhost:3333/api/v1');
  });

  it('a URL salva do fluxo antigo continua prevalecendo', async () => {
    guardado.set('app-contatos:conexao', JSON.stringify({ url: 'https://antiga.test/api/v1/', token: 'abc' }));
    const config = await import('../config');
    expect(config.lerConexao()).toEqual({ url: 'https://antiga.test/api/v1', token: 'abc' });
  });

  it('sem URL salva, lerConexao cai no padrão', async () => {
    guardado.set('app-contatos:conexao', JSON.stringify({ token: 'abc' }));
    vi.stubGlobal('location', { origin: 'https://app.exemplo.test' });
    const config = await import('../config');
    // no vitest import.meta.env.DEV é verdadeiro: vale o .env de desenvolvimento (ou vazio)
    expect(config.lerConexao().url).toBe(config.resolverUrlPadrao(true, import.meta.env.VITE_API_URL as string | undefined, ''));
  });
});
