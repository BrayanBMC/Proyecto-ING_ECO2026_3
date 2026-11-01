import { leerParametros, type ParametrosCredito, type ResultadoValidacion } from '../../core';

/**
 * HU-24: enlace para compartir una simulación.
 * Los parámetros viajan en el hash (#c=…), que el navegador NUNCA envía al servidor: no queda en
 * ningún log y no hace falta cuenta. Al abrir el enlace se vuelven a validar y recalcular.
 */

export const PREFIJO_HASH = '#c=';
const LARGO_MAXIMO = 1500;
const MENSAJE_ENLACE = 'El enlace no es válido o está incompleto.';

function aBase64Url(texto: string): string {
  const bytes = new TextEncoder().encode(texto);
  let binario = '';
  for (const b of bytes) {
    binario += String.fromCharCode(b);
  }
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function deBase64Url(codificado: string): string {
  const base64 = codificado.replace(/-/g, '+').replace(/_/g, '/');
  const binario = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

/** Hash que representa la simulación: "#c=eyJtb250byI6…". */
export function codificarEnlace(p: ParametrosCredito): string {
  // Orden fijo de los campos: el mismo crédito siempre da el mismo enlace.
  const ordenado: ParametrosCredito = {
    monto: p.monto,
    plazo: p.plazo,
    frecuenciaPago: p.frecuenciaPago,
    tasa: p.tasa,
    tipoTasa: p.tipoTasa,
    frecuenciaTasa: p.frecuenciaTasa,
    sistema: p.sistema,
    graciaPeriodos: p.graciaPeriodos,
    graciaTipo: p.graciaTipo,
    escala: p.escala,
    abono: p.abono ? { periodo: p.abono.periodo, valor: p.abono.valor, modo: p.abono.modo } : null,
  };
  return PREFIJO_HASH + aBase64Url(JSON.stringify(ordenado));
}

/**
 * Lee el hash de un enlace. Solo comprueba la forma; los rangos los valida `calcularCredito`,
 * así que un enlace con valores fuera de rango nunca produce un cálculo.
 */
export function decodificarEnlace(hash: string): ResultadoValidacion<ParametrosCredito, string> {
  if (!hash.startsWith(PREFIJO_HASH) || hash.length > LARGO_MAXIMO) {
    return { ok: false, errores: MENSAJE_ENLACE };
  }
  try {
    return leerParametros(JSON.parse(deBase64Url(hash.slice(PREFIJO_HASH.length))));
  } catch {
    return { ok: false, errores: MENSAJE_ENLACE };
  }
}

/** Dirección completa que se copia: origen + /simulador + hash. */
export function crearEnlace(origen: string, p: ParametrosCredito): string {
  return `${origen}/simulador${codificarEnlace(p)}`;
}
