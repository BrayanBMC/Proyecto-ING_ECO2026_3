import { useSyncExternalStore } from 'react';
import { crearRepoInvitado } from '../adapters/repo/RepoSimulaciones';
import type { ParametrosCredito } from '../core';

/**
 * Memoria de la pestaña para el modo invitado (HU-22 y HU-23). Vive en una variable del módulo,
 * no en localStorage ni sessionStorage: al cerrar o recargar la pestaña no queda nada.
 */

/** Simulaciones que el invitado guardó en esta pestaña. */
export const repoDelInvitado = crearRepoInvitado();

let pendiente: ParametrosCredito | null = null;
const oyentes = new Set<() => void>();

/** La simulación que el invitado tiene abierta, para ofrecerle guardarla si inicia sesión (HU-22). */
export function fijarSimulacionPendiente(parametros: ParametrosCredito | null): void {
  if (parametros === pendiente) {
    return;
  }
  pendiente = parametros;
  oyentes.forEach((avisar) => avisar());
}

export function simulacionPendiente(): ParametrosCredito | null {
  return pendiente;
}

export function useSimulacionPendiente(): ParametrosCredito | null {
  return useSyncExternalStore(
    (avisar) => {
      oyentes.add(avisar);
      return () => {
        oyentes.delete(avisar);
      };
    },
    () => pendiente,
  );
}

/** Borra todo lo del invitado: las simulaciones de la sesión y la pendiente. */
export function vaciarSesionInvitado(): void {
  repoDelInvitado.vaciar();
  fijarSimulacionPendiente(null);
}
