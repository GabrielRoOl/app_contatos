import type { StatusFilter } from '../lib/people';
import { IconCheck, IconClock, IconX } from './icons';

interface Props {
  value: StatusFilter;
  onChange: (v: StatusFilter) => void;
  counts: Record<StatusFilter, number>;
}

const CHIPS: { id: StatusFilter; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'ok', label: 'Foram' },
  { id: 'nao', label: 'Não foram' },
  { id: 'pend', label: 'Pendentes' },
];

export function StatusChips({ value, onChange, counts }: Props) {
  return (
    <div className="chips" role="group" aria-label="Filtrar por resultado">
      {CHIPS.map((c) => {
        const on = value === c.id;
        return (
          <button key={c.id} type="button" className={`chip chip--${c.id} ${on ? 'is-on' : ''}`} aria-pressed={on}
            aria-label={`${c.label}: ${counts[c.id]}`} onClick={() => onChange(c.id)}>
            <span className="chip__top">
              {c.id === 'ok' && <IconCheck size={14} strokeWidth={3} />}
              {c.id === 'nao' && <IconX size={13} strokeWidth={3} />}
              {c.id === 'pend' && <IconClock size={14} />}
              {counts[c.id]}
            </span>
            <span className="chip__label">{c.label}</span>
          </button>
        );
      })}
    </div>
  );
}
