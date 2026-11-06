import { personMeta, type Pessoa } from '../lib/people';
import { IconCheck, IconX } from './icons';

interface Props {
  pessoa: Pessoa;
  onEdit: () => void;
  onOk: () => void;
  onNao: () => void;
}

export function PersonRow({ pessoa: p, onEdit, onOk, onNao }: Props) {
  const isOk = p.status === 'ok';
  const isNao = p.status === 'nao';
  return (
    <div className={`row ${isNao ? 'is-nao' : ''}`}>
      <button type="button" className="row__main" onClick={onEdit} aria-label={`Editar ${p.nome}`}>
        <span className="avatar">{(p.nome.trim()[0] || '?').toUpperCase()}</span>
        <span className="row__text">
          <span className="row__name">{p.nome}</span>
          <span className="row__meta">{personMeta(p)}</span>
        </span>
      </button>
      <button type="button" className={`mark mark--nao ${isNao ? 'is-on' : ''}`} onClick={onNao} aria-pressed={isNao}
        aria-label={`Marcar ${p.nome} como não foi`}>
        <IconX size={18} />
      </button>
      <button type="button" className={`mark mark--ok ${isOk ? 'is-on' : ''}`} onClick={onOk} aria-pressed={isOk}
        aria-label={`Marcar ${p.nome} como foi`}>
        <IconCheck size={20} />
      </button>
    </div>
  );
}
