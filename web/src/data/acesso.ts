import type { EstadoSync } from './offlineRepository';

/**
 * O app só abre com token. Sem token guardado, ou com a API tendo recusado o token (401),
 * fica só a tela de conectar. Offline com token guardado não bloqueia: o token não é
 * conferido online a cada abertura.
 */
export const precisaConectar = (temToken: boolean, estado: EstadoSync) => !temToken || estado === 'nao_autorizado';
