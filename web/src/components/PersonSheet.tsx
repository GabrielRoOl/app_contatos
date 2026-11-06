import { useMemo, useState, type FormEvent } from 'react';
import { isoToBR, parseBR, toBR, toISO } from '../lib/dates';
import { cleanName, defaultTurno, duplicateMessage, findDuplicate, type Pessoa, type Turno } from '../lib/people';
import { Calendar } from './Calendar';
import { DateField } from './DateField';
import { IconSun, IconSunset, IconTrash, IconX } from './icons';

interface Props {
  /** undefined = adicionar; Pessoa = editar */
  pessoa?: Pessoa;
  pessoas: Pessoa[];
  onClose: () => void;
  onSubmit: (data: { nome: string; data: string; turno: Turno }) => void;
  onDelete?: () => void;
}

export function PersonSheet({ pessoa, pessoas, onClose, onSubmit, onDelete }: Props) {
  const isEdit = !!pessoa;
  const [nome, setNome] = useState(pessoa?.nome ?? '');
  const [data, setData] = useState(pessoa ? isoToBR(pessoa.data) : '');
  const [turno, setTurno] = useState<Turno>(pessoa?.turno ?? defaultTurno());
  const [calOpen, setCalOpen] = useState(false);
  const [err, setErr] = useState('');

  const parsed = parseBR(data);
  const dup = useMemo(
    () => (parsed ? findDuplicate(pessoas, { nome, data: toISO(parsed), turno }, pessoa?.id) : undefined),
    [pessoas, nome, parsed?.getTime(), turno, pessoa?.id], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const msg = dup ? duplicateMessage(dup, turno) : err;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = cleanName(nome);
    if (!n) return setErr('Escreva o nome da pessoa.');
    if (!parsed) return setErr('Use uma data válida no formato dd/mm/aaaa.');
    if (dup) return;
    onSubmit({ nome: n, data: toISO(parsed), turno });
  };

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="sheet" onSubmit={submit} aria-label={isEdit ? 'Editar pessoa' : 'Adicionar pessoa'}>
        <div className="sheet__grip" />
        <div className="sheet__head">
          <div>
            <h2>{isEdit ? 'Editar pessoa' : 'Adicionar pessoa'}</h2>
            <p>{isEdit ? 'Corrija o nome, a data ou o turno.' : 'Nome, data e turno.'}</p>
          </div>
          <button type="button" className="icon-btn icon-btn--filled" onClick={onClose} aria-label="Fechar"><IconX size={16} /></button>
        </div>

        <label className="field">
          <span className="field__label">Nome</span>
          <input className="input input--lg" type="text" value={nome} autoComplete="off" placeholder="Nome da pessoa"
            onChange={(e) => { setNome(e.target.value); setErr(''); }} />
        </label>

        <div className="field">
          <DateField id="f-date" label="Data" value={data} onChange={(v) => { setData(v); setErr(''); }}
            calendarOpen={calOpen} onToggleCalendar={() => setCalOpen((o) => !o)} calendarLabel="Escolher data no calendário" />
          {calOpen && (
            <Calendar from={parsed} onPick={(d) => { setData(toBR(d)); setCalOpen(false); setErr(''); }} />
          )}
        </div>

        <div className="field">
          <span id="turno-lbl" className="field__label">Turno</span>
          <div className="turnos" role="group" aria-labelledby="turno-lbl">
            <button type="button" className={turno === 'manha' ? 'is-on' : ''} aria-pressed={turno === 'manha'} onClick={() => setTurno('manha')}>
              <IconSun size={18} /> Manhã
            </button>
            <button type="button" className={turno === 'tarde' ? 'is-on' : ''} aria-pressed={turno === 'tarde'} onClick={() => setTurno('tarde')}>
              <IconSunset size={18} /> Tarde
            </button>
          </div>
        </div>

        {msg && <p className="form-error" role="alert">{msg}</p>}

        <div className="sheet__actions">
          {isEdit ? (
            <button type="button" className="btn btn--danger" onClick={onDelete}><IconTrash size={18} /> Excluir</button>
          ) : (
            <button type="button" className="btn btn--ghost" onClick={onClose}>Cancelar</button>
          )}
          <button type="submit" className="btn btn--primary">{isEdit ? 'Salvar' : 'Adicionar'}</button>
        </div>
      </form>
    </div>
  );
}
