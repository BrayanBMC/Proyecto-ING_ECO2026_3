import type { Dec } from './decimal';
import type { Paso } from './explicacion';
import { parseNumeroEsCo } from './parse';
import { numero, type Frecuencia, type PasoTasa, type TipoTasa } from './tasas';

/**
 * Piezas compartidas por las calculadoras de las HU-18, HU-19 y HU-20
 * (interés compuesto, anualidades y reparto proporcional).
 */

/** Convierte los pasos de la conversión de tasas al formato de "¿Cómo se calculó?" (HU-16). */
export function pasosDeTasa(pasos: readonly PasoTasa[]): Paso[] {
  return pasos.map((p) => ({
    titulo: p.descripcion,
    formula: '',
    sustitucion: p.sustitucion,
    resultado: numero(p.valor),
  }));
}

/**
 * Valida la tasa de una calculadora. A diferencia del simulador, acepta 0 %
 * (la anualidad con i = 0 es un caso del criterio de la HU-19).
 */
export function validarTasaLibre(texto: string, tipo: TipoTasa, frecuenciaTasa: Frecuencia): string | null {
  const tasa = parseNumeroEsCo(texto);
  if (!tasa || tasa.lt(0) || tasa.gt(100)) {
    return 'La tasa debe estar entre 0 % y 100 %.';
  }
  if (tipo === 'nominal-anticipada' && tasa.div(100).div(frecuenciaTasa).gte(1)) {
    return 'Con tasa anticipada, la tasa del periodo (j_a / m) debe ser menor que 100 %.';
  }
  return null;
}

/** Número mayor que 0 y hasta `maximo`, o null si el texto no cumple. */
export function leerPositivo(texto: string, maximo: Dec): Dec | null {
  const valor = parseNumeroEsCo(texto);
  return valor && valor.gt(0) && valor.lte(maximo) ? valor : null;
}

/** Decimal en formato es-CO con 4 decimales fijos: 35,0028. */
export function cuatroDecimales(x: Dec): string {
  return x.toFixed(4).replace('.', ',');
}
