import { useState, type FormEvent } from 'react';
import { ApiClient, HttpError, RedeError } from '../data/api';
import { lerConexao, salvarConexao } from '../data/config';
import type { EstadoSync } from '../data/offlineRepository';
import { IconX } from './icons';

const ESTADO_TEXTO: Record<EstadoSync, string> = {
  ocioso: 'Conectado e sincronizado.',
  sincronizando: 'Sincronizando…',
  offline: 'Sem conexão com a API. Os dados ficam no aparelho e sobem quando ela voltar.',
  nao_autorizado: 'O backup recusou o token. Cole o token de novo.',
  sem_config: 'Cole o token de acesso. Sem isso, os dados ficam só neste aparelho.',
  erro: 'A API respondeu com erro. O app tenta de novo sozinho.',
};

interface Props {
  estado: EstadoSync;
  onClose: () => void;
}

/** Tela de conectar: só o token. O endereço da API vem da configuração do build (ou de uma conexão já salva). */
export function ConnectSheet({ estado, onClose }: Props) {
  const atual = lerConexao();
  const [token, setToken] = useState(atual.token);
  const [err, setErr] = useState('');
  const [testando, setTestando] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const u = atual.url;
    const t = token.trim();
    if (!u) return setErr('O endereço da API não está configurado neste app.');
    if (!t) return setErr('Cole o token de acesso.');
    setTestando(true);
    setErr('');
    try {
      // confere antes de guardar: um GET leve que exige o token
      await new ApiClient(() => ({ url: u, token: t })).pull(new Date().toISOString());
    } catch (e2) {
      setTestando(false);
      if (e2 instanceof HttpError && e2.status === 401) return setErr('O servidor recusou o token.');
      if (e2 instanceof RedeError) return setErr('Não consegui falar com o servidor. Confira a internet.');
      return setErr('O servidor respondeu com erro. Tente de novo.');
    }
    salvarConexao({ url: u, token: t });
    setTestando(false);
    onClose();
  };

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="sheet" onSubmit={submit} aria-label="Conectar ao backup">
        <div className="sheet__grip" />
        <div className="sheet__head">
          <div>
            <h2>Conectar</h2>
            <p>{ESTADO_TEXTO[estado]}</p>
          </div>
          <button type="button" className="icon-btn icon-btn--filled" onClick={onClose} aria-label="Fechar"><IconX size={16} /></button>
        </div>

        <label className="field">
          <span className="field__label">Token</span>
          <input className="input input--lg" type="password" value={token} autoComplete="off" autoCapitalize="none"
            spellCheck={false} placeholder="Token de acesso"
            onChange={(e) => { setToken(e.target.value); setErr(''); }} />
        </label>

        {err && <p className="form-error" role="alert">{err}</p>}

        <div className="sheet__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>Agora não</button>
          <button type="submit" className="btn btn--primary" disabled={testando}>{testando ? 'Conferindo…' : 'Conectar'}</button>
        </div>
      </form>
    </div>
  );
}
