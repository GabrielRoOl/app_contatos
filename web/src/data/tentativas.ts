/**
 * Limite de tentativas de token na tela de conectar: 5 erros de token dentro de 10 minutos
 * bloqueiam novas tentativas por 10 minutos. Guardado no aparelho para recarregar a página não zerar.
 *
 * É só um freio de uso. Quem chama a API direto não passa por aqui: a proteção de verdade
 * precisa existir também no servidor.
 */
export const MAX_FALHAS = 5;
export const JANELA_MS = 10 * 60_000;
export const BLOQUEIO_MS = 10 * 60_000;

const KEY = 'app-contatos:tentativas';

interface Guardado {
  falhas: number[]; // quando cada erro aconteceu (ms)
  ate: number; // bloqueado até (ms); 0 = livre
}

let memoria: Guardado = { falhas: [], ate: 0 };

function ler(): Guardado {
  try {
    const bruto = localStorage.getItem(KEY);
    if (bruto) {
      const g = JSON.parse(bruto) as Partial<Guardado>;
      return {
        falhas: Array.isArray(g.falhas) ? g.falhas.filter((n) => typeof n === 'number') : [],
        ate: typeof g.ate === 'number' ? g.ate : 0,
      };
    }
  } catch {
    /* armazenamento indisponível ou corrompido: usa a cópia em memória */
  }
  return memoria;
}

function gravar(g: Guardado) {
  memoria = g;
  try {
    localStorage.setItem(KEY, JSON.stringify(g));
  } catch {
    /* sem armazenamento: vale até recarregar */
  }
}

/** Quanto falta (ms) para poder tentar de novo; 0 se já pode. */
export function msParaLiberar(agora = Date.now()): number {
  return Math.max(0, ler().ate - agora);
}

/** Tentativas que ainda restam antes do bloqueio. */
export function tentativasRestantes(agora = Date.now()): number {
  if (msParaLiberar(agora) > 0) return 0;
  const recentes = ler().falhas.filter((t) => agora - t < JANELA_MS);
  return Math.max(0, MAX_FALHAS - recentes.length);
}

/** Registra um token recusado. Na quinta falha seguida dentro da janela, bloqueia. */
export function registrarFalha(agora = Date.now()) {
  const recentes = ler().falhas.filter((t) => agora - t < JANELA_MS);
  recentes.push(agora);
  if (recentes.length >= MAX_FALHAS) gravar({ falhas: [], ate: agora + BLOQUEIO_MS });
  else gravar({ falhas: recentes, ate: 0 });
}

/** Token aceito: limpa o histórico de erros. */
export function zerarTentativas() {
  gravar({ falhas: [], ate: 0 });
}
