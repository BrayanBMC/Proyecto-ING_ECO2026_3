import { leerPositivo, pasosDeTasa, validarTasaLibre } from './comun';
import type { ResultadoValidacion } from './cuenta';
import { D, type Dec } from './decimal';
import type { Paso } from './explicacion';
import { parseNumeroEsCo } from './parse';
import { MONTO_MAXIMO, PLAZO_MAXIMO } from './simulador';
import { calcularTasa, numero, type Frecuencia, type TipoTasa } from './tasas';

/**
 * HU-19: anualidades vencidas y anticipadas (sección 7.1 de la propuesta).
 * La anticipada es la vencida multiplicada por (1 + i): cada pago gana un periodo más de interés.
 * Con i = 0 no hay interés y S = P = A · n, sin dividir por cero.
 */

const UNO = new D(1);

export type TipoAnualidad = 'vencida' | 'anticipada';

const ajuste = (i: Dec, tipo: TipoAnualidad): Dec => (tipo === 'anticipada' ? UNO.plus(i) : UNO);

/** [(1 + i)^n − 1] / i, o n si i = 0. */
export function factorFuturo(i: Dec, n: Dec): Dec {
  return i.isZero() ? n : UNO.plus(i).pow(n).minus(1).div(i);
}

/** [1 − (1 + i)^−n] / i, o n si i = 0. */
export function factorPresente(i: Dec, n: Dec): Dec {
  return i.isZero() ? n : UNO.minus(UNO.plus(i).pow(n.negated())).div(i);
}

export function valorFuturoAnualidad(a: Dec, i: Dec, n: Dec, tipo: TipoAnualidad): Dec {
  return a.times(factorFuturo(i, n)).times(ajuste(i, tipo));
}

export function valorPresenteAnualidad(a: Dec, i: Dec, n: Dec, tipo: TipoAnualidad): Dec {
  return a.times(factorPresente(i, n)).times(ajuste(i, tipo));
}

/** Cuota que acumula la meta S en n pagos. */
export function cuotaDesdeFuturo(s: Dec, i: Dec, n: Dec, tipo: TipoAnualidad): Dec {
  return s.div(factorFuturo(i, n).times(ajuste(i, tipo)));
}

/** Cuota que equivale al valor presente P en n pagos. */
export function cuotaDesdePresente(p: Dec, i: Dec, n: Dec, tipo: TipoAnualidad): Dec {
  return p.div(factorPresente(i, n).times(ajuste(i, tipo)));
}

/** Qué dato entrega el usuario: la cuota A, la meta S o el valor presente P. */
export type ObjetivoAnualidad = 'valores' | 'cuota-desde-s' | 'cuota-desde-p';

export interface FormularioAnualidad {
  objetivo: ObjetivoAnualidad;
  /** La cuota A, el valor futuro S o el valor presente P, según el objetivo. */
  valor: string;
  /** Número de pagos. */
  n: string;
  tasa: string;
  tipoTasa: TipoTasa;
  frecuenciaTasa: Frecuencia;
  frecuenciaPago: Frecuencia;
}

export type ErroresAnualidad = Partial<Record<'valor' | 'n' | 'tasa' | 'general', string>>;

export interface FilaAnualidad {
  tipo: TipoAnualidad;
  cuota: Dec;
  futuro: Dec;
  presente: Dec;
}

export interface ResultadoAnualidad {
  objetivo: ObjetivoAnualidad;
  tasaPeriodica: Dec;
  ea: Dec;
  /** Vencida primero, anticipada después. */
  filas: [FilaAnualidad, FilaAnualidad];
  pasos: Paso[];
}

const MENSAJE_VALOR: Record<ObjetivoAnualidad, string> = {
  valores: 'Escribe la cuota (A) en pesos, mayor que 0, por ejemplo 500.000.',
  'cuota-desde-s': 'Escribe el valor futuro meta (S) en pesos, mayor que 0, por ejemplo 6.000.000.',
  'cuota-desde-p': 'Escribe el valor presente (P) en pesos, mayor que 0, por ejemplo 5.000.000.',
};

function calcularFila(tipo: TipoAnualidad, objetivo: ObjetivoAnualidad, valor: Dec, i: Dec, n: Dec): FilaAnualidad {
  if (objetivo === 'valores') {
    return {
      tipo,
      cuota: valor,
      futuro: valorFuturoAnualidad(valor, i, n, tipo),
      presente: valorPresenteAnualidad(valor, i, n, tipo),
    };
  }
  if (objetivo === 'cuota-desde-s') {
    const cuota = cuotaDesdeFuturo(valor, i, n, tipo);
    return { tipo, cuota, futuro: valor, presente: valorPresenteAnualidad(cuota, i, n, tipo) };
  }
  const cuota = cuotaDesdePresente(valor, i, n, tipo);
  return { tipo, cuota, futuro: valorFuturoAnualidad(cuota, i, n, tipo), presente: valor };
}

function pasosDeFila(
  fila: FilaAnualidad,
  objetivo: ObjetivoAnualidad,
  i: Dec,
  n: Dec,
  pesos: (monto: Dec) => string,
): Paso[] {
  const anticipada = fila.tipo === 'anticipada';
  const nombre = anticipada ? 'pagos anticipados' : 'pagos vencidos';
  const it = numero(i);
  const nt = n.toString();
  const cero = i.isZero();
  const formulaAjuste = anticipada ? ' · (1 + i)' : '';
  const sustAjuste = anticipada ? ` · (1 + ${it})` : '';
  const divAjuste = anticipada ? ' / (1 + i)' : '';
  const divSust = anticipada ? ` / (1 + ${it})` : '';

  const futuro = (): Paso => ({
    titulo: `Valor futuro (${nombre})`,
    formula: cero ? 'S = A · n' : `S = A · [(1 + i)^n − 1] / i${formulaAjuste}`,
    sustitucion: cero ? `${pesos(fila.cuota)} · ${nt}` : `${pesos(fila.cuota)} · [(1 + ${it})^${nt} − 1] / ${it}${sustAjuste}`,
    resultado: pesos(fila.futuro),
  });
  const presente = (): Paso => ({
    titulo: `Valor presente (${nombre})`,
    formula: cero ? 'P = A · n' : `P = A · [1 − (1 + i)^−n] / i${formulaAjuste}`,
    sustitucion: cero ? `${pesos(fila.cuota)} · ${nt}` : `${pesos(fila.cuota)} · [1 − (1 + ${it})^−${nt}] / ${it}${sustAjuste}`,
    resultado: pesos(fila.presente),
  });
  const cuotaDeS = (): Paso => ({
    titulo: `Cuota (${nombre})`,
    formula: cero ? 'A = S / n' : `A = S · i / [(1 + i)^n − 1]${divAjuste}`,
    sustitucion: cero ? `${pesos(fila.futuro)} / ${nt}` : `${pesos(fila.futuro)} · ${it} / [(1 + ${it})^${nt} − 1]${divSust}`,
    resultado: pesos(fila.cuota),
  });
  const cuotaDeP = (): Paso => ({
    titulo: `Cuota (${nombre})`,
    formula: cero ? 'A = P / n' : `A = P · i / [1 − (1 + i)^−n]${divAjuste}`,
    sustitucion: cero ? `${pesos(fila.presente)} / ${nt}` : `${pesos(fila.presente)} · ${it} / [1 − (1 + ${it})^−${nt}]${divSust}`,
    resultado: pesos(fila.cuota),
  });

  if (objetivo === 'valores') {
    return [futuro(), presente()];
  }
  return objetivo === 'cuota-desde-s' ? [cuotaDeS(), presente()] : [cuotaDeP(), futuro()];
}

export function calcularAnualidad(
  f: FormularioAnualidad,
  pesos: (monto: Dec) => string,
): ResultadoValidacion<ResultadoAnualidad, ErroresAnualidad> {
  const errores: ErroresAnualidad = {};

  const valor = leerPositivo(f.valor, MONTO_MAXIMO);
  if (!valor) {
    errores.valor = MENSAJE_VALOR[f.objetivo];
  }
  const n = parseNumeroEsCo(f.n);
  if (!n || !n.isInteger() || n.lt(1) || n.gt(PLAZO_MAXIMO)) {
    errores.n = `El número de pagos debe ser un entero entre 1 y ${PLAZO_MAXIMO}.`;
  }
  const errorTasa = validarTasaLibre(f.tasa, f.tipoTasa, f.frecuenciaTasa);
  if (errorTasa) {
    errores.tasa = errorTasa;
  }
  if (Object.keys(errores).length > 0) {
    return { ok: false, errores };
  }

  const info = calcularTasa({
    valor: (parseNumeroEsCo(f.tasa) as Dec).div(100),
    tipo: f.tipoTasa,
    frecuenciaTasa: f.frecuenciaTasa,
    frecuenciaPago: f.frecuenciaPago,
  });
  const i = info.periodica;
  const vencida = calcularFila('vencida', f.objetivo, valor!, i, n!);
  const anticipada = calcularFila('anticipada', f.objetivo, valor!, i, n!);

  const desborda = [vencida, anticipada].some((fila) =>
    [fila.cuota, fila.futuro, fila.presente].some((x) => x.gt(MONTO_MAXIMO)),
  );
  if (desborda) {
    return { ok: false, errores: { general: 'El resultado supera $ 1.000.000.000.000. Revisa los datos.' } };
  }

  return {
    ok: true,
    datos: {
      objetivo: f.objetivo,
      tasaPeriodica: i,
      ea: info.ea,
      filas: [vencida, anticipada],
      pasos: [
        ...pasosDeTasa(info.pasos),
        ...pasosDeFila(vencida, f.objetivo, i, n!, pesos),
        ...pasosDeFila(anticipada, f.objetivo, i, n!, pesos),
      ],
    },
  };
}
