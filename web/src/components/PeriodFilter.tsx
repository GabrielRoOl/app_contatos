import { useState } from 'react';
import { parseBR, toBR } from '../lib/dates';
import { Calendar } from './Calendar';
import { DateField } from './DateField';
import { IconCalendar, IconChevronDown, IconChevronUp, IconX } from './icons';

interface Props {
  from: string; // dd/mm/aaaa ou ''
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
  label: string; // "Período: 03/11 a 10/11"
  active: boolean;
  open: boolean;
  onToggle: () => void;
  onClear: () => void;
}

export function PeriodFilter({ from, to, onFrom, onTo, label, active, open, onToggle, onClear }: Props) {
  const [cal, setCal] = useState<'from' | 'to' | null>(null);
  const fromD = parseBR(from);
  const toD = parseBR(to);
  const [a, b] = fromD && toD && fromD > toD ? [toD, fromD] : [fromD, toD];

  const pick = (d: Date) => {
    if (cal === 'from') {
      onFrom(toBR(d));
      setCal('to'); // ao escolher De, passa sozinho para Até
    } else {
      onTo(toBR(d));
      setCal(null);
    }
  };

  return (
    <>
      <div className="period-row">
        <button type="button" className={`period-btn ${active ? 'is-active' : ''}`} onClick={() => { setCal(null); onToggle(); }} aria-expanded={open}>
          <IconCalendar size={18} />
          <span className="period-btn__label">{label}</span>
          {open ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
        </button>
        {active && (
          <button type="button" className="period-clear" onClick={() => { setCal(null); onClear(); }} aria-label="Limpar filtro de período">
            <IconX size={16} />
          </button>
        )}
      </div>

      {open && (
        <div className="period-panel" role="group" aria-label="Filtrar por período">
          <div className="period-panel__fields">
            <DateField id="r-from" label="De" size="sm" value={from} onChange={onFrom} calendarOpen={cal === 'from'}
              onToggleCalendar={() => setCal(cal === 'from' ? null : 'from')} calendarLabel="Escolher data inicial no calendário" />
            <DateField id="r-to" label="Até" size="sm" value={to} onChange={onTo} calendarOpen={cal === 'to'}
              onToggleCalendar={() => setCal(cal === 'to' ? null : 'to')} calendarLabel="Escolher data final no calendário" />
          </div>
          {cal && (
            <Calendar key={cal} variant="panel" from={a} to={b} initialMonth={cal === 'to' ? b || a : a}
              hint={cal === 'from' ? 'Escolha a data inicial' : 'Escolha a data final'} onPick={pick} />
          )}
          <div className="period-panel__actions">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setCal(null); onClear(); }}>Limpar</button>
            <button type="button" className="btn btn--primary btn--sm" onClick={() => { setCal(null); onToggle(); }}>Pronto</button>
          </div>
        </div>
      )}
    </>
  );
}
