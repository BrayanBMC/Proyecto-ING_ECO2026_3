import { D, type Dec } from './decimal';

/**
 * Convierte un número escrito por el usuario a decimal, sin pasar por `parseFloat`.
 *
 * Convención es-CO: punto = separador de miles, coma = separador decimal.
 * Acepta: "10.000.000", "10000000", "1,5", "1.234,56", "$ 1.000", "2,5 %".
 *
 * Para que nadie tenga que corregir su escritura, también entiende en silencio el punto como
 * decimal cuando no puede ser un separador de miles: "1.5", "0.05", "12.75" (= 1,5; 0,05; 12,75)
 * y el estilo de EE. UU. "1,234.56" (= 1.234,56). Un punto seguido de exactamente 3 dígitos
 * ("1.500", "10.000") sigue siendo separador de miles, igual que antes; la única excepción es un
 * cero a la izquierda ("0.500" = 0,5), porque un número no empieza con un grupo de miles en cero.
 *
 * Rechaza (devuelve null) los textos que siguen siendo ambiguos o mal formados, por ejemplo
 * "1,2,3" o "12.34.567". Así nunca se interpreta mal un valor en silencio.
 */
const CON_MILES = /^-?\d{1,3}(\.\d{3})+(,\d+)?$/;
const SIN_MILES = /^-?\d+(,\d+)?$/;
/** "1.5", "12.75": un solo punto, que no puede ser de miles. */
const PUNTO_DECIMAL = /^-?\d+\.\d+$/;
/** "0.5", "0.500": un cero antes del punto no puede ser un grupo de miles. */
const CERO_PUNTO = /^-?0\.\d+$/;
/** "1,234.56": miles con coma y decimales con punto (estilo de EE. UU.). */
const MILES_COMA_DECIMAL_PUNTO = /^-?\d{1,3}(,\d{3})+\.\d+$/;

export function parseNumeroEsCo(texto: string): Dec | null {
  const limpio = texto
    .replace(/[\s\u00A0\u202F]/g, '')
    .replace(/^\$/, '')
    .replace(/%$/, '');

  if (CERO_PUNTO.test(limpio)) {
    return new D(limpio);
  }
  if (CON_MILES.test(limpio) || SIN_MILES.test(limpio)) {
    return new D(limpio.replace(/\./g, '').replace(',', '.'));
  }
  if (PUNTO_DECIMAL.test(limpio)) {
    return new D(limpio);
  }
  if (MILES_COMA_DECIMAL_PUNTO.test(limpio)) {
    return new D(limpio.replace(/,/g, ''));
  }
  return null;
}
