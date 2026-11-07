import { useState, type FormEvent } from 'react';
import { ApiClient, HttpError, RedeError } from '../data/api';
import { lerConexao, limparUrl, salvarConexao } from '../data/config';
import type { EstadoSync } from '../data/offlineRepository';
import { IconX } from './icons';

const ESTADO_TEXTO: Record<EstadoSync, string> = {
  ocioso: 'Conectado e sincronizado.',
  sincronizando: 'Sincronizando…',
  offline: 'Sem conexão com a API. Os dados ficam no aparelho e sobem quando ela voltar.',
  nao_autorizado: 'A API recusou o token. Confira e salve de novo.',
  sem_config: 'Informe a URL e o token. Sem isso, os dados ficam só neste aparelho.',
  erro: 'A API respondeu com erro. O app tenta de novo sozinho.',
};

interface Props {
  estado: EstadoSync;
  onClose: () => void;
}

/** Tela de conectar: URL da API e token, guardados no aparelho. */
export function ConnectSheet({ estado, onClose }: Props) {
  const atual = lerConexao();
  const [url, setUrl] = useState(atual.url);
  const [token, setToken] = useState(atual.token);
  const [err, setErr] = useState('');
  const [testando, setTestando] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const u = limparUrl(url);
    const t = token.trim();
    if (!/^https?:\/\/[^\s/]+/i.test(u)) return setErr('Use o endereço completo da API, começando com http:// ou https://.');
    if (!t) return setErr('Cole o token de acesso.');
    setTestando(true);
    setErr('');
    try {
      // confere antes de guardar: um GET leve que exige o token
      await new ApiClient(() => ({ url: u, token: t })).pull(new Date().toISOString());
    } catch (e2) {
      setTestando(false);
      if (e2 instanceof HttpError && e2.status === 401) return setErr('A API recusou o token.');
      if (e2 instanceof RedeError) return setErr('Não consegui falar com a API. Confira o endereço e a internet.');
      return setErr('A API respondeu com erro. Confira o endereço.');
    }
    salvarConexao({ url: u, token: t });
    setTestando(false);
    onClose();
  };

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="sheet" onSubmit={submit} aria-label="Conectar à API">
        <div className="sheet__grip" />
        <div className="sheet__head">
          <div>
            <h2>Conectar</h2>
            <p>{ESTADO_TEXTO[estado]}</p>
          </div>
          <button type="button" className="icon-btn icon-btn--filled" onClick={onClose} aria-label="Fechar"><IconX size={16} /></button>
        </div>

        <label className="field">
          <span className="field__label">Endereço da API</span>
          <input className="input input--lg" type="url" inputMode="url" value={url} autoComplete="off" autoCapitalize="none"
            spellCheck={false} placeholder="https://exemplo.com/api/v1"
            onChange={(e) => { setUrl(e.target.value); setErr(''); }} />
        </label>

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
