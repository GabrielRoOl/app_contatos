import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertNotice, CopiedToast, UndoSnackbar } from './components/Notices';
import { ConnectSheet } from './components/ConnectSheet';
import { FloatingActions } from './components/FloatingActions';
import { GroupSection } from './components/GroupSection';
import { PeriodFilter } from './components/PeriodFilter';
import { PersonSheet } from './components/PersonSheet';
import { StatusChips } from './components/StatusChips';
import { ViewSwitch } from './components/ViewSwitch';
import { IconChevronDown, IconPlus, IconSliders } from './components/icons';
import { OfflineRepository } from './data/offlineRepository';
import { useCollapseOnScroll } from './hooks/useCollapseOnScroll';
import { useBloqueado } from './hooks/useAcesso';
import { useEstadoSync } from './hooks/useEstadoSync';
import { usePessoas } from './hooks/usePessoas';
import { parseBR, shortBR, today } from './lib/dates';
import {
  formatList, groupPeople, inPeriod, listToSend, matchesStatus, normalizePeriod, sendSubtitle, sortPeople,
  type Pessoa, type StatusFilter, type View,
} from './lib/people';

const repo = new OfflineRepository();

type Sheet = { mode: 'add' } | { mode: 'edit'; pessoa: Pessoa } | null;

const VIEW_LABEL: Record<View, string> = { dia: 'Dia', semana: 'Semana', mes: 'Mês' };
const STATUS_LABEL: Record<StatusFilter, string> = { todos: 'Todos', ok: 'Foram', nao: 'Não foram', pend: 'Pendentes' };

export function App() {
  const { pessoas, aviso, limparAviso, add, edit, toggleStatus, remove, restore } = usePessoas(repo);

  const [view, setView] = useState<View>('dia');
  const [statusF, setStatusF] = useState<StatusFilter>('todos');
  const [rFrom, setRFrom] = useState('');
  const [rTo, setRTo] = useState('');
  const [periodOpen, setPeriodOpen] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const estado = useEstadoSync(repo);
  const bloqueado = useBloqueado(estado);
  const [toast, setToast] = useState<{ count: number; text: string } | null>(null);
  const [undo, setUndo] = useState<Pessoa | null>(null);
  const { collapsed, setCollapsed, onScroll, headerRef } = useCollapseOnScroll();
  const timers = useRef<{ toast?: number; undo?: number }>({});

  useEffect(() => () => { clearTimeout(timers.current.toast); clearTimeout(timers.current.undo); }, []);
  useEffect(() => repo.start(), []);
  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(limparAviso, 6000);
    return () => clearTimeout(t);
  }, [aviso, limparAviso]);

  // ----- dados derivados -----
  const [from, to] = normalizePeriod(parseBR(rFrom), parseBR(rTo));
  const periodActive = !!(from || to);
  const sorted = useMemo(() => sortPeople(pessoas), [pessoas]);
  const inRange = useMemo(() => sorted.filter((p) => inPeriod(p, from, to)), [sorted, from?.getTime(), to?.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps
  const visible = inRange.filter((p) => matchesStatus(p, statusF));
  const groups = groupPeople(visible, view, today());

  const counts: Record<StatusFilter, number> = {
    todos: inRange.length,
    ok: inRange.filter((p) => p.status === 'ok').length,
    nao: inRange.filter((p) => p.status === 'nao').length,
    pend: inRange.filter((p) => !p.status).length,
  };
  const toSend = listToSend(inRange, statusF);
  const text = formatList(toSend);
  const subtitle = sendSubtitle(statusF, toSend.length);

  const anyFilter = periodActive || statusF !== 'todos';
  const summary = `${anyFilter ? `${visible.length} de ${pessoas.length}` : pessoas.length} pessoas · ${counts.ok} ok · ${counts.nao} não`;
  const rangeLabel = !periodActive ? 'todas as datas'
    : from && to ? `${shortBR(from)} a ${shortBR(to)}`
    : from ? `a partir de ${shortBR(from)}` : `até ${shortBR(to!)}`;

  // ----- ações -----
  const showToast = () => {
    setUndo(null);
    setToast({ count: toSend.length, text });
    clearTimeout(timers.current.toast);
    timers.current.toast = window.setTimeout(() => setToast(null), 2600);
  };

  const copy = async () => {
    if (!toSend.length) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    showToast();
  };

  const share = async () => {
    if (!toSend.length) return;
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch (e) {
        if ((e as DOMException)?.name === 'AbortError') return;
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };

  const handleDelete = async (p: Pessoa) => {
    setSheet(null);
    await remove(p);
    setToast(null);
    setUndo(p);
    clearTimeout(timers.current.undo);
    timers.current.undo = window.setTimeout(() => setUndo(null), 5000);
  };

  const handleUndo = async () => {
    if (!undo) return;
    clearTimeout(timers.current.undo);
    const p = undo;
    setUndo(null);
    await restore(p);
  };

  const emptyTitle = !pessoas.length ? 'Nenhuma pessoa ainda'
    : statusF !== 'todos' && inRange.length ? 'Ninguém com esse resultado' : 'Ninguém nesse período';
  const emptyText = !pessoas.length ? 'Toque em Adicionar para começar a lista.' : 'Ajuste os filtros ou toque em Todos.';

  // sem token, ou token recusado: só a tela de conectar. Os dados locais e a fila ficam intactos.
  if (bloqueado) return <div className="app"><ConnectSheet estado={estado} /></div>;

  return (
    <div className="app">
      <header ref={headerRef} className={`header ${collapsed ? 'is-collapsed' : ''}`}>
        <div className="header__top">
          <div>
            <h1>Contatos</h1>
            <p className="header__summary">{summary}</p>
          </div>
          <div className="header__actions">
            <button type="button" className="btn-add" onClick={() => setSheet({ mode: 'add' })}>
              <IconPlus /> Adicionar
            </button>
          </div>
        </div>

        {collapsed ? (
          <button type="button" className="filters-bar" onClick={() => setCollapsed(false)}
            aria-label={`Mostrar filtros: ${VIEW_LABEL[view]} · ${STATUS_LABEL[statusF]} · ${rangeLabel}`}>
            <IconSliders size={18} />
            <span>{VIEW_LABEL[view]} · {STATUS_LABEL[statusF]} · {rangeLabel}</span>
            <IconChevronDown size={18} />
          </button>
        ) : (
          <div className="header__filters">
            <ViewSwitch value={view} onChange={setView} />
            <PeriodFilter from={rFrom} to={rTo} onFrom={setRFrom} onTo={setRTo} label={`Período: ${rangeLabel}`}
              active={periodActive} open={periodOpen} onToggle={() => setPeriodOpen((o) => !o)}
              onClear={() => { setRFrom(''); setRTo(''); }} />
            <StatusChips value={statusF} onChange={setStatusF} counts={counts} />
          </div>
        )}
      </header>

      <main className="list" onScroll={onScroll}>
        {!groups.length && (
          <div className="empty">
            <p className="empty__title">{emptyTitle}</p>
            <p>{emptyText}</p>
          </div>
        )}
        {groups.map((g) => (
          <GroupSection key={g.key} group={g} showPending={statusF !== 'pend'}
            onEdit={(p) => setSheet({ mode: 'edit', pessoa: p })}
            onOk={(p) => toggleStatus(p, 'ok')}
            onNao={(p) => toggleStatus(p, 'nao')} />
        ))}
      </main>

      <FloatingActions disabled={!toSend.length} subtitle={subtitle} onCopy={copy} onShare={share} />

      {aviso ? <AlertNotice message={aviso} /> : toast && <CopiedToast count={toast.count} text={toast.text} />}
      {!aviso && !toast && undo && <UndoSnackbar message={`Excluiu ${undo.nome}`} onUndo={handleUndo} />}

      {sheet && (
        <PersonSheet
          key={sheet.mode === 'edit' ? sheet.pessoa.id : 'new'}
          pessoa={sheet.mode === 'edit' ? sheet.pessoa : undefined}
          pessoas={pessoas}
          onClose={() => setSheet(null)}
          onSubmit={async (data) => {
            if (sheet.mode === 'edit') await edit(sheet.pessoa.id, data);
            else await add(data);
            setSheet(null);
          }}
          onDelete={sheet.mode === 'edit' ? () => handleDelete(sheet.pessoa) : undefined}
        />
      )}
    </div>
  );
}
