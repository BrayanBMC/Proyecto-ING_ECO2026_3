import { D, type Dec } from './decimal';

/**
 * Convierte un número escrito con la convención es-CO a decimal, sin pasar por `parseFloat`.
 *
 * Convención es-CO: punto = separador de miles, coma = separador decimal.
 * Acepta: "10.000.000", "10000000", "1,5", "1.234,56", "$ 1.000", "2,5 %".
 * Rechaza (devuelve null) los textos ambiguos o mal formados, por ejemplo "1.5"
 * (en es-CO el punto agrupa de a 3 dígitos) o "1,2,3". Así nunca se interpreta
 * mal un valor en silencio.
 */
const CON_MILES = /^-?\d{1,3}(\.\d{3})+(,\d+)?$/;
const SIN_MILES = /^-?\d+(,\d+)?$/;

export function parseNumeroEsCo(texto: string): Dec | null {
  const limpio = texto
    .replace(/[\s\u00A0\u202F]/g, '')
    .replace(/^\$/, '')
    .replace(/%$/, '');

  if (!CON_MILES.test(limpio) && !SIN_MILES.test(limpio)) {
    return null;
  }

  const normalizado = limpio.replace(/\./g, '').replace(',', '.');
  return new D(normalizado);
}
