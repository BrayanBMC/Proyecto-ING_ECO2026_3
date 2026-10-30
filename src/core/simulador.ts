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

export const GRACIA_MAXIMA = 60;

/** HU-12: periodos de gracia entre 0 y 60 (rango del spec). Vacío cuenta como 0. */
export function validarGracia(texto: string): ResultadoValidacion<number, string> {
  if (texto.trim() === '') {
    return { ok: true, datos: 0 };
  }
  const g = parseNumeroEsCo(texto);
  if (!g || !g.isInteger() || g.lt(0) || g.gt(GRACIA_MAXIMA)) {
    return { ok: false, errores: `Los periodos de gracia deben ser un número entero entre 0 y ${GRACIA_MAXIMA}.` };
  }
  return { ok: true, datos: g.toNumber() };
}

export type ErroresAbono = Partial<Record<'periodo' | 'valor', string>>;

/**
 * HU-14: el abono va al final de un periodo de amortización que no sea el último,
 * y no puede superar el saldo de ese periodo en la tabla sin abono.
 */
export function validarAbono(entrada: {
  periodo: string;
  valor: string;
  /** Saldo de cada periodo en la tabla sin abono (índice = periodo). */
  saldos: readonly Dec[];
  gracia: number;
  plazo: number;
  formatear: (monto: Dec) => string;
}): ResultadoValidacion<{ periodo: number; valor: Dec }, ErroresAbono> {
  const { gracia, plazo } = entrada;
  const primero = gracia + 1;
  const ultimo = gracia + plazo - 1;
  if (ultimo < primero) {
    return { ok: false, errores: { periodo: 'Con una sola cuota no se puede hacer un abono extraordinario.' } };
  }
  const p = parseNumeroEsCo(entrada.periodo);
  if (!p || !p.isInteger() || p.lt(primero) || p.gt(ultimo)) {
    return { ok: false, errores: { periodo: `El abono va al final de un periodo entre ${primero} y ${ultimo}.` } };
  }
  const periodo = p.toNumber();
  const valor = parseNumeroEsCo(entrada.valor);
  if (!valor || valor.lte(0)) {
    return { ok: false, errores: { valor: 'Escribe un abono mayor que $ 0.' } };
  }
  const saldo = entrada.saldos[periodo]!;
  if (valor.gt(saldo)) {
    return {
      ok: false,
      errores: { valor: `El abono supera el saldo del periodo ${periodo} (${entrada.formatear(saldo)}).` },
    };
  }
  return { ok: true, datos: { periodo, valor } };
}

/** HU-15: IBC ingresado a mano cuando el dato publicado está vencido. */
export function validarIbc(texto: string): ResultadoValidacion<Dec, string> {
  const ibc = parseNumeroEsCo(texto);
  if (!ibc || ibc.lt('0.01') || ibc.gt(100)) {
    return { ok: false, errores: 'El IBC debe estar entre 0,01 % y 100 % EA.' };
  }
  return { ok: true, datos: ibc.div(100) };
}
