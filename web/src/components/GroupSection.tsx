import type { Group, Pessoa } from '../lib/people';
import { PersonRow } from './PersonRow';

interface Props {
  group: Group;
  showPending: boolean;
  onEdit: (p: Pessoa) => void;
  onOk: (p: Pessoa) => void;
  onNao: (p: Pessoa) => void;
}

export function GroupSection({ group: g, showPending, onEdit, onOk, onNao }: Props) {
  return (
    <section className="group">
      <div className="group__head">
        <h2>{g.label}</h2>
        <div className="group__meta">
          <span>{g.tag}</span>
          {showPending && g.pend > 0 && <span className="badge">{g.pend} sem marcar</span>}
        </div>
      </div>
      <div className="group__card">
        {g.items.map((p) => (
          <PersonRow key={p.id} pessoa={p} onEdit={() => onEdit(p)} onOk={() => onOk(p)} onNao={() => onNao(p)} />
        ))}
      </div>
    </section>
  );
}
