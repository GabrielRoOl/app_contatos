import { useCallback, useEffect, useState } from 'react';
import type { PessoasRepository } from '../data/repository';
import type { Pessoa, Status, Turno } from '../lib/people';

/** Estado da lista com atualização otimista: a tela muda na hora, o repositório grava depois. */
export function usePessoas(repo: PessoasRepository) {
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    repo.list().then((l) => {
      if (alive) {
        setPessoas(l);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [repo]);

  const add = useCallback(
    async (input: { nome: string; data: string; turno: Turno }) => {
      const p = await repo.create(input);
      setPessoas((l) => [...l, p]);
      return p;
    },
    [repo],
  );

  const edit = useCallback(
    async (id: string, patch: { nome: string; data: string; turno: Turno }) => {
      setPessoas((l) => l.map((p) => (p.id === id ? { ...p, ...patch } : p)));
      await repo.update(id, patch);
    },
    [repo],
  );

  /** Tocar no status já ativo volta para pendente. */
  const toggleStatus = useCallback(
    async (p: Pessoa, st: Exclude<Status, null>) => {
      const next: Status = p.status === st ? null : st;
      setPessoas((l) => l.map((q) => (q.id === p.id ? { ...q, status: next } : q)));
      await repo.update(p.id, { status: next });
    },
    [repo],
  );

  const remove = useCallback(
    async (p: Pessoa) => {
      setPessoas((l) => l.filter((q) => q.id !== p.id));
      await repo.remove(p.id);
    },
    [repo],
  );

  const restore = useCallback(
    async (p: Pessoa) => {
      setPessoas((l) => (l.some((q) => q.id === p.id) ? l : [...l, p]));
      await repo.restore(p.id);
    },
    [repo],
  );

  return { pessoas, loading, add, edit, toggleStatus, remove, restore };
}
