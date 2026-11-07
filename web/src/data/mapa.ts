import type { PessoaApi } from './api';
import type { Registro } from './db';
import type { Pessoa } from '../lib/people';

/** snake_case da API -> camelCase do front. */
export function deApi(a: PessoaApi): Registro {
  return {
    id: a.id,
    nome: a.nome,
    data: a.data,
    turno: a.turno,
    status: a.status ?? null,
    criadoEm: a.criado_em,
    atualizadoEm: a.atualizado_em,
    excluidoEm: a.excluido_em ?? null,
    versao: a.versao,
    erro: null,
    naoEnviado: false,
  };
}

/** Registro do banco local -> Pessoa da tela (sem os campos de controle). */
export function paraPessoa(r: Registro): Pessoa {
  const { excluidoEm: _e, naoEnviado: _n, ...p } = r; // eslint-disable-line @typescript-eslint/no-unused-vars
  return p;
}
