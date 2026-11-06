import { useState } from 'react';
import { INICIAIS_SEMANA, MESES, sameDay, today } from '../lib/dates';
import { IconChevronLeft, IconChevronRight } from './icons';

interface Props {
  /** Data(s) selecionada(s). Com as duas, os dias entre elas ficam destacados (c3). */
  from: Date | null;
  to?: Date | null;
  /** Mês exibido ao abrir. */
  initialMonth?: Date | null;
  hint?: string;
  onPick: (d: Date) => void;
  variant?: 'sheet' | 'panel';
}

export function Calendar({ from, to = null, initialMonth, hint, onPick, variant = 'sheet' }: Props) {
  const base = initialMonth || from || today();
  const [y, setY] = useState(base.getFullYear());
  const [m, setM] = useState(base.getMonth());
  const t = today();

  const shift = (k: number) => {
    const d = new Date(y, m + k, 1);
    setY(d.getFullYear());
    setM(d.getMonth());
  };

  const blanks = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const a = from?.getTime() ?? null;
  const b = to?.getTime() ?? null;

  return (
    <div className={`calendar calendar--${variant}`}>
      <div className="calendar__head">
        <button type="button" className="icon-btn" onClick={() => shift(-1)} aria-label="Mês anterior"><IconChevronLeft /></button>
        <div className="calendar__title">
          <span>{MESES[m]} {y}</span>
          {hint && <small>{hint}</small>}
        </div>
        <button type="button" className="icon-btn" onClick={() => shift(1)} aria-label="Próximo mês"><IconChevronRight /></button>
      </div>
      <div className="calendar__grid" aria-hidden="true">
        {INICIAIS_SEMANA.map((d, i) => <span key={i} className="calendar__wd">{d}</span>)}
      </div>
      <div className="calendar__grid">
        {Array.from({ length: blanks }, (_, i) => <span key={`b${i}`} className="calendar__blank" />)}
        {Array.from({ length: days }, (_, i) => {
          const d = new Date(y, m, i + 1);
          const tm = d.getTime();
          const selected = tm === a || tm === b;
          const between = a !== null && b !== null && tm > a && tm < b;
          const cls = ['calendar__day', selected && 'is-selected', between && 'is-between', sameDay(d, t) && 'is-today']
            .filter(Boolean).join(' ');
          return (
            <button key={i} type="button" className={cls} aria-pressed={selected}
              aria-label={`${i + 1} de ${MESES[m]} de ${y}`} onClick={() => onPick(d)}>
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
