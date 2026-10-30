import { D, redondearMonto, type Dec, type EscalaMonetaria } from './decimal';

/**
 * Tabla de amortización Francés y Alemán (HU-10). Fórmulas de la sección 7.1 de la propuesta.
 * Los montos se redondean en cada fila a la escala monetaria; la tasa nunca se redondea.
 * La última fila absorbe el residuo para que el saldo cierre en 0 exacto.
 */

export type Sistema = 'frances' | 'aleman';

export interface Fila {
  periodo: number;
  cuota: Dec;
  interes: Dec;
  abono: Dec;
  saldo: Dec;
}

export interface Tabla {
  filas: Fila[];
  totalIntereses: Dec;
  totalPagado: Dec;
}

const CERO = new D(0);
const UNO = new D(1);

/** Cuota del sistema Francés: R = P·i / (1 − (1 + i)^−n); si i = 0, R = P / n. Sin redondear. */
export function cuotaFrances(capital: Dec, i: Dec, n: number): Dec {
  if (i.isZero()) {
    return capital.div(n);
  }
  return capital.times(i).div(UNO.minus(UNO.plus(i).pow(-n)));
}

export function generarTabla(entrada: {
  capital: Dec;
  /** Tasa efectiva del periodo de pago, en decimal. */
  tasa: Dec;
  plazo: number;
  sistema: Sistema;
  escala: EscalaMonetaria;
}): Tabla {
  const { capital, tasa, plazo, sistema, escala } = entrada;
  const r = (x: Dec) => redondearMonto(x, escala);
  const filas: Fila[] = [{ periodo: 0, cuota: CERO, interes: CERO, abono: CERO, saldo: r(capital) }];

  // Francés: cuota fija. Alemán: abono fijo.
  const fijo = sistema === 'frances' ? r(cuotaFrances(capital, tasa, plazo)) : r(capital.div(plazo));
  let saldo = r(capital);
  let totalIntereses = CERO;
  let totalPagado = CERO;

  for (let k = 1; k <= plazo; k++) {
    const interes = r(saldo.times(tasa));
    let abono: Dec;
    if (k === plazo) {
      abono = saldo; // cierre exacto: el residuo de redondeo queda en la última cuota
    } else {
      // Con montos muy pequeños el redondeo puede pedir más abono que el saldo; nunca se pasa de 0.
      abono = D.min(sistema === 'frances' ? fijo.minus(interes) : fijo, saldo);
    }
    const cuota = abono.plus(interes);
    saldo = saldo.minus(abono);
    totalIntereses = totalIntereses.plus(interes);
    totalPagado = totalPagado.plus(cuota);
    filas.push({ periodo: k, cuota, interes, abono, saldo });
  }

  return { filas, totalIntereses, totalPagado };
}
