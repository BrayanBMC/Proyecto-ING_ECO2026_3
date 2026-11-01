import type { ErrorServicio } from './mensajes';

/**
 * Tiempo máximo y reintento para las llamadas a Neon.
 * El plan gratuito suspende el cómputo cuando no hay actividad; la primera llamada después de un rato puede tardar
 * unos segundos mientras despierta. Sin esto, una llamada colgada deja la pantalla esperando para siempre.
 */

/** Pasado este tiempo la llamada se da por fallida. El cómputo dormido suele despertar en pocos segundos. */
export const TIEMPO_MAXIMO_MS = 15_000;
/** Pausa antes de repetir una lectura que falló. */
export const ESPERA_REINTENTO_MS = 1_000;

export class ErrorTiempoAgotado extends Error {
  constructor() {
    super('La operación tardó demasiado en responder.');
    this.name = 'ErrorTiempoAgotado';
  }
}

/** Rechaza con ErrorTiempoAgotado si la operación no termina en `ms`. No cancela la llamada, solo deja de esperarla. */
export function conTiempo<T>(operacion: () => PromiseLike<T>, ms: number = TIEMPO_MAXIMO_MS): Promise<T> {
  return new Promise<T>((resolver, rechazar) => {
    const temporizador = setTimeout(() => rechazar(new ErrorTiempoAgotado()), ms);
    Promise.resolve()
      .then(operacion)
      .then(resolver, rechazar)
      .finally(() => clearTimeout(temporizador));
  });
}

/** Un error que vale la pena repetir: caída del servidor o de la red. Los errores de datos o de permisos no. */
export function esErrorTransitorio(error: ErrorServicio | null | undefined): boolean {
  if (!error) {
    return false;
  }
  if (typeof error.status === 'number' && error.status >= 500) {
    return true;
  }
  return /failed to fetch|fetch failed|load failed|network|timeout|timed out/i.test(error.message ?? '');
}

interface OpcionesReintento<T> {
  /** Cuántas veces más se intenta después del primer fallo. */
  reintentos?: number;
  esperaMs?: number;
  tiempoMs?: number;
  /** Decide si una respuesta (sin excepción) se repite. Por defecto mira su campo `error`. */
  repetir?: (respuesta: T) => boolean;
}

const pausa = (ms: number) => new Promise<void>((resolver) => setTimeout(resolver, ms));

/**
 * Para LECTURAS: repite una vez si la llamada lanza una excepción, se pasa del tiempo o responde con un error
 * transitorio. No usar en escrituras: repetir un INSERT podría guardar dos veces.
 */
export async function conReintento<T>(operacion: () => PromiseLike<T>, opciones: OpcionesReintento<T> = {}): Promise<T> {
  const { reintentos = 1, esperaMs = ESPERA_REINTENTO_MS, tiempoMs = TIEMPO_MAXIMO_MS } = opciones;
  const repetir =
    opciones.repetir ?? ((respuesta: T) => esErrorTransitorio((respuesta as { error?: ErrorServicio | null } | null)?.error));
  for (let intento = 0; ; intento++) {
    const quedan = intento < reintentos;
    try {
      const respuesta = await conTiempo(operacion, tiempoMs);
      if (quedan && repetir(respuesta)) {
        await pausa(esperaMs);
        continue;
      }
      return respuesta;
    } catch (error) {
      if (!quedan) {
        throw error;
      }
      await pausa(esperaMs);
    }
  }
}
