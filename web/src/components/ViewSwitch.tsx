import type { View } from '../lib/people';

const VIEWS: { id: View; label: string }[] = [
  { id: 'dia', label: 'Dia' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mês' },
];

export function ViewSwitch({ value, onChange }: { value: View; onChange: (v: View) => void }) {
  return (
    <div className="segmented" role="group" aria-label="Agrupar por">
      {VIEWS.map((v) => (
        <button key={v.id} type="button" className={value === v.id ? 'is-on' : ''} aria-pressed={value === v.id} onClick={() => onChange(v.id)}>
          {v.label}
        </button>
      ))}
    </div>
  );
}
