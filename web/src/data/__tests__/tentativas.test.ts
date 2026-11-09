import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let guardado: Map<string, string>;
type Mod = typeof import('../tentativas');
let t: Mod;

beforeEach(async () => {
  guardado = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => guardado.get(k) ?? null,
    setItem: (k: string, v: string) => void guardado.set(k, v),
  });
  vi.resetModules();
  t = await import('../tentativas');
});
afterEach(() => vi.unstubAllGlobals());

const MIN = 60_000;

describe('limite de tentativas de token', () => {
  it('começa com 5 tentativas e livre', () => {
    expect(t.tentativasRestantes(0)).toBe(5);
    expect(t.msParaLiberar(0)).toBe(0);
  });

  it('as 4 primeiras falhas não bloqueiam e a quinta bloqueia por 10 minutos', () => {
    for (let i = 0; i < 4; i++) t.registrarFalha(i * 1000);
    expect(t.msParaLiberar(5000)).toBe(0);
    expect(t.tentativasRestantes(5000)).toBe(1);
    t.registrarFalha(5000);
    expect(t.msParaLiberar(5000)).toBe(10 * MIN);
    expect(t.tentativasRestantes(5000)).toBe(0);
  });

  it('libera depois dos 10 minutos e volta com 5 tentativas', () => {
    for (let i = 0; i < 5; i++) t.registrarFalha(0);
    expect(t.msParaLiberar(9 * MIN)).toBeGreaterThan(0);
    expect(t.msParaLiberar(10 * MIN)).toBe(0);
    expect(t.tentativasRestantes(10 * MIN)).toBe(5);
  });

  it('erros antigos (fora da janela de 10 minutos) não contam', () => {
    for (let i = 0; i < 4; i++) t.registrarFalha(0);
    t.registrarFalha(11 * MIN);
    expect(t.msParaLiberar(11 * MIN)).toBe(0);
    expect(t.tentativasRestantes(11 * MIN)).toBe(4);
  });

  it('token aceito zera o histórico', () => {
    for (let i = 0; i < 4; i++) t.registrarFalha(0);
    t.zerarTentativas();
    expect(t.tentativasRestantes(1)).toBe(5);
  });

  it('recarregar a página não zera: o bloqueio vem do armazenamento', async () => {
    for (let i = 0; i < 5; i++) t.registrarFalha(0);
    vi.resetModules();
    const novo = await import('../tentativas');
    expect(novo.msParaLiberar(MIN)).toBe(9 * MIN);
  });
});
