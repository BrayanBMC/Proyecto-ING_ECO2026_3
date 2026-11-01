import { LIMITE_GUARDADAS, type ParametrosCredito, type SimulacionGuardada } from '../../core';
import type { ServicioCuenta } from '../auth/ServicioCuenta';

/**
 * Puerto de simulaciones guardadas. La UI usa siempre esta interfaz; hay dos implementaciones:
 * - Registrado: las guarda en Neon, aisladas por usuario con RLS (a través de ServicioCuenta).
 * - Invitado: las guarda solo en memoria de la pestaña; al cerrarla no queda nada.
 */

export type ResultadoRepo<T> = { ok: true; datos: T } | { ok: false; mensaje: string };

export interface RepoSimulaciones {
  /** Más recientes primero. */
  listar(): Promise<ResultadoRepo<SimulacionGuardada[]>>;
  guardar(nombre: string, parametros: ParametrosCredito): Promise<ResultadoRepo<SimulacionGuardada>>;
  renombrar(id: string, nombre: string): Promise<ResultadoRepo<null>>;
  borrar(id: string): Promise<ResultadoRepo<null>>;
}

/** Modo registrado: delega en el servicio de cuentas (Neon). */
export function repoDeCuenta(servicio: ServicioCuenta): RepoSimulaciones {
  return {
    listar: async () => {
      const r = await servicio.listarSimulaciones();
      return r.ok ? { ok: true, datos: r.simulaciones } : r;
    },
    guardar: async (nombre, parametros) => {
      const r = await servicio.guardarSimulacion(nombre, parametros);
      return r.ok ? { ok: true, datos: r.simulacion } : r;
    },
    renombrar: async (id, nombre) => {
      const r = await servicio.renombrarSimulacion(id, nombre);
      return r.ok ? { ok: true, datos: null } : r;
    },
    borrar: async (id) => {
      const r = await servicio.borrarSimulacion(id);
      return r.ok ? { ok: true, datos: null } : r;
    },
  };
}

export interface RepoInvitado extends RepoSimulaciones {
  /** Borra todo lo guardado en la sesión. */
  vaciar(): void;
}

const NO_ENCONTRADA = 'No encontramos esa simulación.';

/** Lo que el invitado guarda en la pestaña se borra pasado un día, aunque la deje abierta. */
export const VIGENCIA_INVITADO_MS = 24 * 60 * 60 * 1000;

/**
 * Modo invitado: una lista en memoria, sin red ni almacenamiento del navegador.
 * Nada de esto llega a Neon, así que no gasta cuota de la base de datos. Cada simulación se
 * borra sola 24 horas después de su última modificación (y todas al cerrar la pestaña).
 */
export function crearRepoInvitado(
  ahora: () => Date = () => new Date(),
  vigenciaMs: number = VIGENCIA_INVITADO_MS,
): RepoInvitado {
  let guardadas: SimulacionGuardada[] = [];
  let contador = 0;

  /** Quita las que ya cumplieron su día. Se llama antes de cada operación. */
  const depurar = () => {
    const limite = ahora().getTime() - vigenciaMs;
    guardadas = guardadas.filter((s) => new Date(s.actualizadoEn).getTime() > limite);
  };

  return {
    listar: async () => {
      depurar();
      return {
        ok: true,
        // Más reciente primero. `guardadas` ya guarda la última al inicio y el orden es estable.
        datos: [...guardadas].sort((a, b) => b.actualizadoEn.localeCompare(a.actualizadoEn)),
      };
    },
    guardar: async (nombre, parametros) => {
      depurar();
      if (guardadas.length >= LIMITE_GUARDADAS) {
        return { ok: false, mensaje: `Llegaste al límite de ${LIMITE_GUARDADAS} simulaciones. Borra alguna para guardar otra.` };
      }
      contador += 1;
      const nueva: SimulacionGuardada = {
        id: `invitado-${contador}`,
        nombre,
        parametros,
        actualizadoEn: ahora().toISOString(),
      };
      guardadas = [nueva, ...guardadas];
      return { ok: true, datos: nueva };
    },
    renombrar: async (id, nombre) => {
      depurar();
      if (!guardadas.some((s) => s.id === id)) {
        return { ok: false, mensaje: NO_ENCONTRADA };
      }
      guardadas = guardadas.map((s) => (s.id === id ? { ...s, nombre, actualizadoEn: ahora().toISOString() } : s));
      return { ok: true, datos: null };
    },
    borrar: async (id) => {
      depurar();
      if (!guardadas.some((s) => s.id === id)) {
        return { ok: false, mensaje: NO_ENCONTRADA };
      }
      guardadas = guardadas.filter((s) => s.id !== id);
      return { ok: true, datos: null };
    },
    vaciar: () => {
      guardadas = [];
    },
  };
}
