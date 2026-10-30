import Decimal from 'decimal.js';

/**
 * Constructor decimal del motor financiero (sección 7.2 de la propuesta).
 *
 * - 34 dígitos significativos: la precisión de IEEE 754 decimal128.
 * - ROUND_HALF_UP: el mismo criterio que REDONDEAR de Excel y que un extracto bancario.
 * - toExpNeg/toExpPos amplios para que `toString()` nunca use notación científica
 *   al serializar tasas muy pequeñas o montos grandes.
 */
export const D = Decimal.clone({
  precision: 34,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -40,
  toExpPos: 40,
});

export type Dec = Decimal;

/** Escalas monetarias soportadas: 0 (pesos, por defecto) o 2 (centavos, para contrastar con Excel). */
export type EscalaMonetaria = 0 | 2;

/** Crea un decimal del motor. Acepta string o number; preferir string para no heredar errores de double. */
export function dec(valor: Decimal.Value): Dec {
  return new D(valor);
}

/**
 * Redondea un monto a la escala monetaria. Solo se usa en los montos de cada fila
 * (cuota, interés, abono, saldo); las tasas nunca se redondean internamente.
 */
export function redondearMonto(valor: Dec, escala: EscalaMonetaria): Dec {
  return new D(valor).toDecimalPlaces(escala, Decimal.ROUND_HALF_UP);
}
