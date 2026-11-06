import { maskDate } from '../lib/dates';
import { IconCalendar } from './icons';

interface Props {
  id: string;
  label: string;
  value: string; // dd/mm/aaaa (pode estar incompleto enquanto digita)
  onChange: (v: string) => void;
  calendarOpen: boolean;
  onToggleCalendar: () => void;
  calendarLabel: string;
  size?: 'lg' | 'sm';
}

/** Campo de data com máscara + ícone que abre o calendário (o calendário fica a cargo do pai). */
export function DateField({ id, label, value, onChange, calendarOpen, onToggleCalendar, calendarLabel, size = 'lg' }: Props) {
  return (
    <div className={`field date-field date-field--${size}`}>
      <label htmlFor={id} className="field__label">{label}</label>
      <div className="date-field__wrap">
        <input id={id} className={`input ${calendarOpen ? 'is-active' : ''}`} type="text" inputMode="numeric"
          placeholder="dd/mm/aaaa" maxLength={10} value={value} onChange={(e) => onChange(maskDate(e.target.value))} />
        <button type="button" className={`date-field__btn ${calendarOpen ? 'is-on' : ''}`} onClick={onToggleCalendar}
          aria-label={calendarLabel} aria-expanded={calendarOpen}>
          <IconCalendar size={size === 'lg' ? 22 : 20} />
        </button>
      </div>
    </div>
  );
}
