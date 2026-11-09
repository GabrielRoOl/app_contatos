/** Conexão com a API: URL e token, guardados no aparelho. Sem URL salva, vale o endereço padrão (ver urlPadrao). */
export interface Conexao {
  url: string;
  token: string;
}

const KEY = 'app-contatos:conexao';
const ouvintes = new Set<() => void>();
/** Cópia em memória: se o armazenamento falhar, o token vale até recarregar em vez de travar o bloqueio. */
let memoria: Partial<Conexao> = {};

/**
 * Endereço padrão da API. Em desenvolvimento vale o VITE_API_URL do .env. Em produção é a mesma
 * origem da página (o servidor web serve a PWA e repassa /api): o VITE_API_URL do .env é de
 * desenvolvimento e nunca deve ir parar no pacote publicado.
 */
export const resolverUrlPadrao = (dev: boolean, envUrl: string | undefined, origem: string) =>
  dev ? (envUrl ?? '').trim() : `${origem}/api/v1`;

const urlPadrao = () =>
  resolverUrlPadrao(
    import.meta.env.DEV,
    // só existe no build de desenvolvimento: no de produção o ramo é descartado e o valor não entra no pacote
    import.meta.env.DEV ? (import.meta.env.VITE_API_URL as string | undefined) : undefined,
    typeof location === 'undefined' ? '' : location.origin,
  );

/** Tira espaços e barras do fim: "https://x.com/api/v1/" vira "https://x.com/api/v1". */
export const limparUrl = (u: string) => u.trim().replace(/\/+$/, '');

export function lerConexao(): Conexao {
  let salvo: Partial<Conexao> = memoria;
  try {
    const guardado = localStorage.getItem(KEY);
    if (guardado) salvo = JSON.parse(guardado) as Partial<Conexao>;
  } catch {
    /* armazenamento indisponível ou corrompido: usa a cópia em memória */
  }
  return { url: limparUrl(salvo.url || urlPadrao()), token: (salvo.token ?? '').trim() };
}

export function salvarConexao(c: Conexao) {
  memoria = { url: limparUrl(c.url), token: c.token.trim() };
  try {
    localStorage.setItem(KEY, JSON.stringify(memoria));
  } catch {
    /* sem armazenamento: vale só até recarregar */
  }
  ouvintes.forEach((f) => f());
}

/** Há token guardado neste aparelho. Não diz se a API ainda o aceita. */
export const temToken = () => !!lerConexao().token;

export const conexaoCompleta = (c: Conexao) => !!(c.url && c.token);

export function aoMudarConexao(f: () => void) {
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
}
