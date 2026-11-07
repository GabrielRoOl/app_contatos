/** Conexão com a API: URL e token, guardados no aparelho. A URL cai para VITE_API_URL se nada foi salvo. */
export interface Conexao {
  url: string;
  token: string;
}

const KEY = 'app-contatos:conexao';
const ouvintes = new Set<() => void>();

const urlPadrao = () => (import.meta.env.VITE_API_URL as string | undefined)?.trim() ?? '';

/** Tira espaços e barras do fim: "https://x.com/api/v1/" vira "https://x.com/api/v1". */
export const limparUrl = (u: string) => u.trim().replace(/\/+$/, '');

export function lerConexao(): Conexao {
  let salvo: Partial<Conexao> = {};
  try {
    salvo = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Conexao>;
  } catch {
    /* armazenamento indisponível ou corrompido: usa o padrão */
  }
  return { url: limparUrl(salvo.url || urlPadrao()), token: (salvo.token ?? '').trim() };
}

export function salvarConexao(c: Conexao) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ url: limparUrl(c.url), token: c.token.trim() }));
  } catch {
    /* sem armazenamento: vale só até recarregar */
  }
  ouvintes.forEach((f) => f());
}

export const conexaoCompleta = (c: Conexao) => !!(c.url && c.token);

export function aoMudarConexao(f: () => void) {
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
}
