import { D, redondearMonto, type Dec, type EscalaMonetaria } from './decimal';

/**
 * Tabla de amortización Francés y Alemán (HU-10), con periodos de gracia (HU-12, HU-13)
 * y abono extraordinario (HU-14). Fórmulas de la sección 7.1 de la propuesta.
 * Los montos se redondean en cada fila a la escala monetaria; la tasa nunca se redondea.
 * La última fila absorbe el residuo para que el saldo cierre en 0 exacto.
 */

export type Sistema = 'frances' | 'aleman';

/** muerta: no se paga nada y el interés se suma al saldo. intereses: se paga solo el interés. */
export type TipoGracia = 'muerta' | 'intereses';

/** recalcular-cuota: mantiene el plazo y baja la cuota. reducir-plazo: mantiene la cuota y quita filas. */
export type ModoAbono = 'recalcular-cuota' | 'reducir-plazo';

export interface Gracia {
  tipo: TipoGracia;
  periodos: number;
}

export interface AbonoExtra {
  /** Periodo al final del cual se hace el abono (después de pagar su cuota). */
  periodo: number;
  valor: Dec;
  modo: ModoAbono;
}

export interface Fila {
  periodo: number;
  cuota: Dec;
  interes: Dec;
  abono: Dec;
  /** Abono extraordinario hecho al final de este periodo (0 si no hay). */
  extra: Dec;
  saldo: Dec;
  /** true en las filas de gracia. */
  gracia: boolean;
}

export interface Tabla {
  filas: Fila[];
  totalIntereses: Dec;
  /** Σ cuotas + Σ abonos extraordinarios. */
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

/**
 * Cuotas que faltan para pagar `saldo` manteniendo la cuota (reducción de plazo).
 * Francés: n' = ⌈−ln(1 − S·i/R) / ln(1 + i)⌉ (con i = 0: ⌈S/R⌉). Alemán: n' = ⌈S/A⌉.
 */
export function cuotasRestantes(saldo: Dec, i: Dec, fijo: Dec, sistema: Sistema): number {
  if (sistema === 'aleman' || i.isZero()) {
    return saldo.div(fijo).ceil().toNumber();
  }
  const base = UNO.minus(saldo.times(i).div(fijo));
  if (base.lte(0)) {
    throw new Error('La cuota no alcanza a cubrir el interés del saldo.');
  }
  return base.ln().neg().div(UNO.plus(i).ln()).ceil().toNumber();
}

export function generarTabla(entrada: {
  capital: Dec;
  /** Tasa efectiva del periodo de pago, en decimal. */
  tasa: Dec;
  /** Cuotas de amortización (sin contar la gracia). */
  plazo: number;
  sistema: Sistema;
  escala: EscalaMonetaria;
  gracia?: Gracia | undefined;
  abono?: AbonoExtra | undefined;
}): Tabla {
  const { capital, tasa, plazo, sistema, escala, abono: extra } = entrada;
  const g = entrada.gracia?.periodos ?? 0;
  const r = (x: Dec) => redondearMonto(x, escala);
  let saldo = r(capital);
  const filas: Fila[] = [{ periodo: 0, cuota: CERO, interes: CERO, abono: CERO, extra: CERO, saldo, gracia: false }];
  let totalIntereses = CERO;
  let totalPagado = CERO;

  // Gracia (sección 7.1): muerta capitaliza el interés; con pago de intereses el saldo no cambia.
  for (let k = 1; k <= g; k++) {
    const interes = r(saldo.times(tasa));
    const muerta = entrada.gracia?.tipo === 'muerta';
    const cuota = muerta ? CERO : interes;
    if (muerta) {
      saldo = saldo.plus(interes);
    }
    totalIntereses = totalIntereses.plus(interes);
    totalPagado = totalPagado.plus(cuota);
    filas.push({ periodo: k, cuota, interes, abono: CERO, extra: CERO, saldo, gracia: true });
  }

  // Amortización sobre el saldo al terminar la gracia. Francés: cuota fija. Alemán: abono fijo.
  const fijoDe = (s: Dec, n: number) => (sistema === 'frances' ? r(cuotaFrances(s, tasa, n)) : r(s.div(n)));
  let fijo = fijoDe(saldo, plazo);
  let fin = g + plazo;

  for (let k = g + 1; k <= fin; k++) {
    const interes = r(saldo.times(tasa));
    // La última fila abona todo el saldo; antes, nunca se abona más que el saldo.
    const abono = k === fin ? saldo : D.min(sistema === 'frances' ? fijo.minus(interes) : fijo, saldo);
    const cuota = abono.plus(interes);
    saldo = saldo.minus(abono);
    let pagoExtra = CERO;

    // HU-14: abono extraordinario al final del periodo, con el saldo ya reducido por la cuota.
    if (extra && extra.periodo === k && !saldo.isZero()) {
      pagoExtra = D.min(r(extra.valor), saldo);
      saldo = saldo.minus(pagoExtra);
      if (saldo.isZero()) {
        fin = k;
      } else if (extra.modo === 'recalcular-cuota') {
        fijo = fijoDe(saldo, fin - k);
      } else {
        fin = k + cuotasRestantes(saldo, tasa, fijo, sistema);
      }
    }

    totalIntereses = totalIntereses.plus(interes);
    totalPagado = totalPagado.plus(cuota).plus(pagoExtra);
    filas.push({ periodo: k, cuota, interes, abono, extra: pagoExtra, saldo, gracia: false });
    if (saldo.isZero()) {
      break;
    }
  }

  return { filas, totalIntereses, totalPagado };
}
