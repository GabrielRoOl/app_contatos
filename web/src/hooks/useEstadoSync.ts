import { useSyncExternalStore } from 'react';
import type { EstadoSync, OfflineRepository } from '../data/offlineRepository';

/** Estado da sincronização (ocioso, offline, token recusado...) para a interface reagir. */
export function useEstadoSync(repo: OfflineRepository): EstadoSync {
  return useSyncExternalStore(
    (f) => repo.aoMudarEstado(f),
    () => repo.estado,
  );
}
