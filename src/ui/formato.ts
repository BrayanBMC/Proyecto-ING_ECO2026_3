import type { Dec, EscalaMonetaria } from '../core';

/** Formato es-CO de la sección 6 de la propuesta. Solo presenta: nunca se recalcula desde este texto. */

const formatos = new Map<EscalaMonetaria, Intl.NumberFormat>();

export function pesos(valor: Dec, escala: EscalaMonetaria): string {
  let formato = formatos.get(escala);
  if (!formato) {
    formato = new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: escala,
      maximumFractionDigits: escala,
    });
    formatos.set(escala, formato);
  }
  // Se pasa como texto para que Intl no convierta a double.
  return formato.format(valor.toFixed(escala) as unknown as number);
}

/** Tasa en decimal → "26,8242 %". */
export function porcentaje(tasa: Dec, decimales = 4): string {
  const [entero = '0', fraccion = ''] = tasa.times(100).toFixed(decimales).split('.');
  const conMiles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${conMiles}${fraccion ? `,${fraccion}` : ''} %`;
}
