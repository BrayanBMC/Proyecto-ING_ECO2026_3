import { generarTabla, type Sistema, type Tabla } from './amortizacion';
import type { Dec, EscalaMonetaria } from './decimal';

/**
 * HU-11: compara Francés y Alemán para el mismo crédito (sección 7.1, "Totales y comparativa").
 * Los totales salen de las tablas ya redondeadas, así que coinciden con lo que se ve en pantalla.
 */

export interface ResumenSistema {
  cuotaInicial: Dec;
  totalIntereses: Dec;
  totalPagado: Dec;
}

export interface Comparacion {
  frances: ResumenSistema;
  aleman: ResumenSistema;
  /** Δ = (T_I Francés − T_I Alemán) / T_I Alemán. null si no hay intereses (i = 0): "no aplica". */
  sobrecosto: Dec | null;
}

function resumir(tabla: Tabla): ResumenSistema {
  return {
    cuotaInicial: tabla.filas[1]!.cuota, // el plazo es ≥ 1, así que la fila 1 siempre existe
    totalIntereses: tabla.totalIntereses,
    totalPagado: tabla.totalPagado,
  };
}

export function compararSistemas(entrada: { capital: Dec; tasa: Dec; plazo: number; escala: EscalaMonetaria }): Comparacion {
  const tabla = (sistema: Sistema) => resumir(generarTabla({ ...entrada, sistema }));
  const frances = tabla('frances');
  const aleman = tabla('aleman');
  const sobrecosto = aleman.totalIntereses.isZero()
    ? null
    : frances.totalIntereses.minus(aleman.totalIntereses).div(aleman.totalIntereses);
  return { frances, aleman, sobrecosto };
}
