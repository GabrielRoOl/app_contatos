import { useEffect, useState, type FormEvent } from 'react';
import { ApiClient, HttpError, RedeError } from '../data/api';
import { lerConexao, salvarConexao } from '../data/config';
import type { EstadoSync } from '../data/offlineRepository';
import { msParaLiberar, registrarFalha, tentativasRestantes, zerarTentativas } from '../data/tentativas';

const relogio = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

interface Props {
  estado: EstadoSync;
}

/**
 * Tela de conectar, em tela cheia e sem como fechar: aparece quando não há token ou a API o recusou.
 * Só o token é pedido. O endereço da API vem da configuração do build (ou de uma conexão já salva).
 * Trocar o token não mexe nos dados do aparelho nem na fila de envio.
 */
export function ConnectSheet({ estado }: Props) {
  const atual = lerConexao();
  const [token, setToken] = useState('');
  const [err, setErr] = useState('');
  const [testando, setTestando] = useState(false);
  const [espera, setEspera] = useState(() => msParaLiberar());

  // contagem regressiva enquanto estiver bloqueado por excesso de tentativas
  useEffect(() => {
    if (espera <= 0) return;
    const t = setInterval(() => setEspera(msParaLiberar()), 500);
    return () => clearInterval(t);
  }, [espera > 0]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const faltam = msParaLiberar();
    if (faltam > 0) return setEspera(faltam);
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
      if (e2 instanceof HttpError && e2.status === 401) {
        registrarFalha();
        const faltam = msParaLiberar();
        if (faltam > 0) {
          setEspera(faltam);
          return setErr('Muitas tentativas com token errado.');
        }
        const r = tentativasRestantes();
        return setErr(`O servidor recusou o token. ${r === 1 ? 'Resta 1 tentativa' : `Restam ${r} tentativas`}.`);
      }
      if (e2 instanceof RedeError) return setErr('Não consegui falar com o servidor. Confira a internet.');
      return setErr('O servidor respondeu com erro. Tente de novo.');
    }
    zerarTentativas();
    salvarConexao({ url: u, token: t });
    setTestando(false);
  };

  return (
    <div className="lock" role="dialog" aria-modal="true" aria-label="Conectar ao backup">
      <form className="lock__form" onSubmit={submit}>
        <div className="sheet__head">
          <div>
            <h2>Conectar</h2>
            <p>
              {estado === 'nao_autorizado'
                ? 'O backup recusou o token. Cole o token de novo. Seus contatos continuam guardados neste aparelho.'
                : 'Cole o token de acesso para usar o app.'}
            </p>
          </div>
        </div>

        <label className="field">
          <span className="field__label">Token</span>
          <input className="input input--lg" type="password" value={token} autoComplete="off" autoCapitalize="none"
            spellCheck={false} placeholder="Token de acesso" autoFocus disabled={espera > 0}
            onChange={(e) => { setToken(e.target.value); setErr(''); }} />
        </label>

        {espera > 0 && (
          <p className="form-error" role="alert">
            Muitas tentativas com token errado. Tente de novo em {relogio(espera)}.
          </p>
        )}
        {err && espera <= 0 && <p className="form-error" role="alert">{err}</p>}

        <button type="submit" className="btn btn--primary" disabled={testando || espera > 0}>
          {testando ? 'Conferindo…' : espera > 0 ? `Aguarde ${relogio(espera)}` : 'Conectar'}
        </button>
      </form>
    </div>
  );
}
