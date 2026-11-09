import { useSyncExternalStore } from 'react';
import { precisaConectar } from '../data/acesso';
import { aoMudarConexao, temToken } from '../data/config';
import type { EstadoSync } from '../data/offlineRepository';

/** true enquanto o app deve mostrar só a tela de conectar. */
export function useBloqueado(estado: EstadoSync): boolean {
  const token = useSyncExternalStore(aoMudarConexao, temToken);
  return precisaConectar(token, estado);
}
