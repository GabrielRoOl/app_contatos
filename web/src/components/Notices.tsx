import { IconUndo } from './icons';

export function CopiedToast({ count, text }: { count: number; text: string }) {
  return (
    <div className="notice notice--toast" role="status">
      <strong>{count} {count === 1 ? 'contato foi copiado' : 'contatos foram copiados'}</strong>
      <span className="notice__list">{text}</span>
    </div>
  );
}

/** Só aparece após excluir. */
export function UndoSnackbar({ message, onUndo }: { message: string; onUndo: () => void }) {
  return (
    <div className="notice notice--undo" role="status">
      <span>{message}</span>
      <button type="button" onClick={onUndo}><IconUndo size={16} /> Desfazer</button>
    </div>
  );
}
