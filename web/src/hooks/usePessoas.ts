import { useCallback, useEffect, useState } from 'react';
import type { PessoasRepository } from '../data/repository';
import { novaPessoa, type Pessoa, type Status, type Turno } from '../lib/people';

/**
 * Estado da lista com atualização otimista: a tela muda na hora, o repositório grava depois.
 * Se a gravação falhar, a tela volta ao que está no repositório e um aviso é mostrado.
 * Mudanças vindas da sincronização (servidor, operação recusada) também recarregam a lista.
 */
export function usePessoas(repo: PessoasRepository) {
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [loading, setLoading] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    setPessoas(await repo.list());
  }, [repo]);

  useEffect(() => {
    let alive = true;
    repo
      .list()
      .then((l) => alive && setPessoas(l))
      .catch(() => alive && setAviso('Não foi possível abrir os dados salvos no aparelho.'))
      .finally(() => alive && setLoading(false));
    const sair = repo.subscribe((e) => {
      if (e.mensagem) setAviso(e.mensagem);
      repo.list().then((l) => alive && setPessoas(l)).catch(() => {});
    });
    return () => {
      alive = false;
      sair();
    };
  }, [repo]);

  /** Roda a gravação; se falhar, reverte a tela e avisa. */
  const gravar = useCallback(
    async (acao: () => Promise<unknown>, falha: string) => {
      try {
        await acao();
      } catch {
        setAviso(falha);
        await recarregar().catch(() => {});
      }
    },
    [recarregar],
  );

  const add = useCallback(
    async (input: { nome: string; data: string; turno: Turno }) => {
      const p = novaPessoa(input);
      setPessoas((l) => [...l, p]);
      await gravar(() => repo.create(p), 'Não foi possível salvar a pessoa.');
      return p;
    },
    [repo, gravar],
  );

  const edit = useCallback(
    async (id: string, patch: { nome: string; data: string; turno: Turno }) => {
      setPessoas((l) => l.map((p) => (p.id === id ? { ...p, ...patch, erro: null } : p)));
      await gravar(() => repo.update(id, patch), 'Não foi possível salvar a alteração.');
    },
    [repo, gravar],
  );

  /** Tocar no status já ativo volta para pendente. */
  const toggleStatus = useCallback(
    async (p: Pessoa, st: Exclude<Status, null>) => {
      const next: Status = p.status === st ? null : st;
      setPessoas((l) => l.map((q) => (q.id === p.id ? { ...q, status: next } : q)));
      await gravar(() => repo.update(p.id, { status: next }), 'Não foi possível salvar a marcação.');
    },
    [repo, gravar],
  );

  const remove = useCallback(
    async (p: Pessoa) => {
      setPessoas((l) => l.filter((q) => q.id !== p.id));
      await gravar(() => repo.remove(p.id), 'Não foi possível excluir a pessoa.');
    },
    [repo, gravar],
  );

  const restore = useCallback(
    async (p: Pessoa) => {
      setPessoas((l) => (l.some((q) => q.id === p.id) ? l : [...l, p]));
      await gravar(() => repo.restore(p.id), 'Não foi possível desfazer a exclusão.');
    },
    [repo, gravar],
  );

  const limparAviso = useCallback(() => setAviso(null), []);

  return { pessoas, loading, aviso, limparAviso, add, edit, toggleStatus, remove, restore };
}
