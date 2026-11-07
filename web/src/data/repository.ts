import type { Pessoa, Status, Turno } from '../lib/people';

/** O que a tela é avisada quando a sincronização mexe nos dados. */
export interface EventoRepo {
  /** Texto para mostrar ao usuário (ex.: não foi possível desfazer a exclusão). */
  mensagem?: string;
}

/**
 * Ponto de integração com os dados. Os componentes só falam com esta interface.
 * A implementação real é `OfflineRepository` (IndexedDB + fila + API).
 */
export interface PessoasRepository {
  list(): Promise<Pessoa[]>;
  /** A pessoa já vem pronta, com o id gerado no cliente (ver `novaPessoa`). */
  create(pessoa: Pessoa): Promise<Pessoa>;
  update(id: string, patch: Partial<{ nome: string; data: string; turno: Turno; status: Status }>): Promise<Pessoa>;
  /** Exclusão lógica (soft delete): permite desfazer. */
  remove(id: string): Promise<void>;
  restore(id: string): Promise<Pessoa>;
  /**
   * Avisa quando a sincronização alterou os dados locais (pull do servidor, operação recusada,
   * conflito resolvido). A tela deve recarregar `list()`. Devolve a função de cancelar.
   */
  subscribe(ouvinte: (e: EventoRepo) => void): () => void;
}
