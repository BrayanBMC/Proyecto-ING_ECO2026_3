import { generarTabla, type AbonoExtra, type Gracia, type Sistema, type Tabla } from './amortizacion';
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
    // Primera cuota de amortización (después de la gracia); el plazo es ≥ 1, así que siempre existe.
    cuotaInicial: tabla.filas.find((f) => f.periodo > 0 && !f.gracia)!.cuota,
    totalIntereses: tabla.totalIntereses,
    totalPagado: tabla.totalPagado,
  };
}

export function compararSistemas(entrada: {
  capital: Dec;
  tasa: Dec;
  plazo: number;
  escala: EscalaMonetaria;
  gracia?: Gracia | undefined;
  abono?: AbonoExtra | undefined;
}): Comparacion {
  const tabla = (sistema: Sistema) => resumir(generarTabla({ ...entrada, sistema }));
  const frances = tabla('frances');
  const aleman = tabla('aleman');
  const sobrecosto = aleman.totalIntereses.isZero()
    ? null
    : frances.totalIntereses.minus(aleman.totalIntereses).div(aleman.totalIntereses);
  return { frances, aleman, sobrecosto };
}

/** HU-13: intereses totales con gracia muerta y con gracia de solo intereses, y la diferencia. */
export function compararGracias(entrada: {
  capital: Dec;
  tasa: Dec;
  plazo: number;
  sistema: Sistema;
  escala: EscalaMonetaria;
  periodos: number;
}) {
  const intereses = (tipo: Gracia['tipo']) =>
    generarTabla({ ...entrada, gracia: { tipo, periodos: entrada.periodos } }).totalIntereses;
  const muerta = intereses('muerta');
  const conIntereses = intereses('intereses');
  return { muerta, conIntereses, diferencia: muerta.minus(conIntereses) };
}
