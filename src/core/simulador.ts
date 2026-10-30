import type { ResultadoValidacion } from './cuenta';
import { D, type Dec } from './decimal';
import { parseNumeroEsCo } from './parse';
import type { Sistema } from './amortizacion';
import type { Frecuencia, TipoTasa } from './tasas';

/**
 * Validación del formulario del simulador (HU-07, HU-08, HU-09).
 * Rangos del spec (sección 10.7): monto ≥ 1, plazo 1-360, tasa 0,01-100 %.
 */

export const MONTO_MAXIMO = new D('1000000000000'); // 10^12, el rango de las pruebas de propiedades
export const PLAZO_MAXIMO = 360;

export interface FormularioSimulacion {
  monto: string;
  plazo: string;
  frecuenciaPago: Frecuencia;
  tasa: string;
  tipoTasa: TipoTasa;
  frecuenciaTasa: Frecuencia;
  sistema: Sistema;
}

export interface Simulacion {
  monto: Dec;
  plazo: number;
  frecuenciaPago: Frecuencia;
  /** Tasa en decimal (24 % → 0,24). */
  tasa: Dec;
  tipoTasa: TipoTasa;
  frecuenciaTasa: Frecuencia;
  sistema: Sistema;
}

export type ErroresSimulacion = Partial<Record<'monto' | 'plazo' | 'tasa', string>>;

export function validarMonto(texto: string): string | null {
  const monto = parseNumeroEsCo(texto);
  if (!monto) {
    return 'Escribe el monto en pesos, por ejemplo 10.000.000.';
  }
  if (monto.lt(1) || monto.gt(MONTO_MAXIMO)) {
    return 'El monto debe estar entre $ 1 y $ 1.000.000.000.000.';
  }
  return null;
}

export function validarPlazo(texto: string): string | null {
  const plazo = parseNumeroEsCo(texto);
  if (!plazo || !plazo.isInteger() || plazo.lt(1) || plazo.gt(PLAZO_MAXIMO)) {
    return `El plazo debe ser un número entero de cuotas entre 1 y ${PLAZO_MAXIMO}.`;
  }
  return null;
}

export function validarTasa(texto: string, tipo: TipoTasa, frecuenciaTasa: Frecuencia): string | null {
  const tasa = parseNumeroEsCo(texto);
  if (!tasa || tasa.lt('0.01') || tasa.gt(100)) {
    return 'La tasa debe estar entre 0,01 % y 100 %.';
  }
  // HU-09: con tasa anticipada, j_a/m ≥ 1 cobraría todo el capital por adelantado.
  if (tipo === 'nominal-anticipada' && tasa.div(100).div(frecuenciaTasa).gte(1)) {
    return 'Con tasa anticipada, la tasa del periodo (j_a / m) debe ser menor que 100 %.';
  }
  return null;
}

export function validarSimulacion(f: FormularioSimulacion): ResultadoValidacion<Simulacion, ErroresSimulacion> {
  const errores: ErroresSimulacion = {};
  const monto = validarMonto(f.monto);
  const plazo = validarPlazo(f.plazo);
  const tasa = validarTasa(f.tasa, f.tipoTasa, f.frecuenciaTasa);
  for (const [campo, error] of [
    ['monto', monto],
    ['plazo', plazo],
    ['tasa', tasa],
  ] as const) {
    if (error) {
      errores[campo] = error;
    }
  }
  if (monto || plazo || tasa) {
    return { ok: false, errores };
  }
  return {
    ok: true,
    datos: {
      monto: parseNumeroEsCo(f.monto) as Dec,
      plazo: (parseNumeroEsCo(f.plazo) as Dec).toNumber(),
      frecuenciaPago: f.frecuenciaPago,
      tasa: (parseNumeroEsCo(f.tasa) as Dec).div(100),
      tipoTasa: f.tipoTasa,
      frecuenciaTasa: f.frecuenciaTasa,
      sistema: f.sistema,
    },
  };
}
