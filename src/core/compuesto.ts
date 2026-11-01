import { cuatroDecimales, leerPositivo, pasosDeTasa, validarTasaLibre } from './comun';
import type { ResultadoValidacion } from './cuenta';
import { D, type Dec } from './decimal';
import type { Paso } from './explicacion';
import { parseNumeroEsCo } from './parse';
import { MONTO_MAXIMO } from './simulador';
import { calcularTasa, numero, tasaEquivalente, type Frecuencia, type TipoTasa } from './tasas';

/**
 * HU-18: interés compuesto. Se despeja una de las cuatro variables (S, P, i o n)
 * con las fórmulas de la sección 7.1 de la propuesta. Todo en decimal de 34 dígitos.
 * Si la tasa llega como nominal, se convierte con la fórmula compuesta, igual que en el simulador.
 */

const UNO = new D(1);

/** Máximo de periodos que acepta la calculadora (100 años en pagos mensuales). */
export const PERIODOS_MAXIMOS = 1200;
const LIMITE_PERIODOS = new D(PERIODOS_MAXIMOS);

/** S = P · (1 + i)^n */
export function valorFuturo(p: Dec, i: Dec, n: Dec): Dec {
  return p.times(UNO.plus(i).pow(n));
}

/** P = S / (1 + i)^n */
export function valorPresente(s: Dec, i: Dec, n: Dec): Dec {
  return s.div(UNO.plus(i).pow(n));
}

/** i = (S / P)^(1/n) − 1 */
export function tasaCompuesta(p: Dec, s: Dec, n: Dec): Dec {
  return s.div(p).pow(UNO.div(n)).minus(1);
}

/** n = ln(S / P) / ln(1 + i). Puede ser fraccionario. Exige i > 0. */
export function periodosCompuesto(p: Dec, s: Dec, i: Dec): Dec {
  return s.div(p).ln().div(UNO.plus(i).ln());
}

export type Incognita = 'S' | 'P' | 'i' | 'n';

export interface FormularioCompuesto {
  incognita: Incognita;
  /** Capital inicial, en pesos. */
  p: string;
  /** Monto final, en pesos. */
  s: string;
  /** Número de periodos (puede ser fraccionario). */
  n: string;
  tasa: string;
  tipoTasa: TipoTasa;
  frecuenciaTasa: Frecuencia;
  /** Duración de cada periodo: mensual, trimestral, anual… */
  frecuenciaPeriodo: Frecuencia;
}

export type ErroresCompuesto = Partial<Record<'p' | 's' | 'n' | 'tasa' | 'general', string>>;

export interface ResultadoCompuesto {
  incognita: Incognita;
  /** S o P en pesos, i en decimal (0,02 = 2 %) o n en periodos. Sin redondear. */
  valor: Dec;
  /** Tasa del periodo (la ingresada convertida, o la despejada). */
  tasaPeriodica: Dec;
  ea: Dec;
  /** Tasa nominal anual vencida equivalente (periódica × periodos por año). */
  nominal: Dec;
  pasos: Paso[];
}

const porciento = (x: Dec) => `${numero(x.times(100))} %`;
const RESULTADO_GRANDE = 'El resultado supera $ 1.000.000.000.000. Revisa los datos.';

export function calcularCompuesto(
  f: FormularioCompuesto,
  pesos: (monto: Dec) => string,
): ResultadoValidacion<ResultadoCompuesto, ErroresCompuesto> {
  const errores: ErroresCompuesto = {};
  const incognita = f.incognita;

  const p = incognita === 'P' ? null : leerPositivo(f.p, MONTO_MAXIMO);
  const s = incognita === 'S' ? null : leerPositivo(f.s, MONTO_MAXIMO);
  const n = incognita === 'n' ? null : leerPositivo(f.n, LIMITE_PERIODOS);
  if (incognita !== 'P' && !p) {
    errores.p = 'Escribe el capital inicial (P) en pesos, mayor que 0, por ejemplo 1.000.000.';
  }
  if (incognita !== 'S' && !s) {
    errores.s = 'Escribe el monto final (S) en pesos, mayor que 0, por ejemplo 2.000.000.';
  }
  if (incognita !== 'n' && !n) {
    errores.n = `Escribe los periodos (n): un número mayor que 0 y hasta ${PERIODOS_MAXIMOS}.`;
  }

  let tasaIngresada: Dec | null = null;
  if (incognita !== 'i') {
    const error = validarTasaLibre(f.tasa, f.tipoTasa, f.frecuenciaTasa);
    if (error) {
      errores.tasa = error;
    } else {
      tasaIngresada = (parseNumeroEsCo(f.tasa) as Dec).div(100);
    }
  }

  if ((incognita === 'i' || incognita === 'n') && p && s && s.lt(p)) {
    errores.s = 'S debe ser mayor o igual que P: con interés positivo el dinero no disminuye.';
  }
  if (incognita === 'n' && tasaIngresada?.isZero()) {
    errores.tasa = 'Con tasa 0 el capital no crece: ningún número de periodos lleva P a S.';
  }
  if (Object.keys(errores).length > 0) {
    return { ok: false, errores };
  }

  const m = f.frecuenciaPeriodo;
  const pasos: Paso[] = [];
  let valor: Dec;
  let periodica: Dec;
  let ea: Dec;

  if (incognita === 'i') {
    periodica = tasaCompuesta(p!, s!, n!);
    ea = tasaEquivalente(periodica, m, 1);
    valor = periodica;
    pasos.push({
      titulo: 'Tasa por periodo',
      formula: 'i = (S / P)^(1/n) − 1',
      sustitucion: `(${pesos(s!)} / ${pesos(p!)})^(1/${numero(n!)}) − 1`,
      resultado: `${numero(periodica)} (${porciento(periodica)})`,
    });
    if (m !== 1) {
      pasos.push({
        titulo: 'Tasa efectiva anual equivalente',
        formula: 'EA = (1 + i)^m − 1',
        sustitucion: `(1 + ${numero(periodica)})^${m} − 1`,
        resultado: `${numero(ea)} (${porciento(ea)})`,
      });
    }
  } else {
    const info = calcularTasa({
      valor: tasaIngresada!,
      tipo: f.tipoTasa,
      frecuenciaTasa: f.frecuenciaTasa,
      frecuenciaPago: m,
    });
    periodica = info.periodica;
    ea = info.ea;
    pasos.push(...pasosDeTasa(info.pasos));

    if (incognita === 'S') {
      valor = valorFuturo(p!, periodica, n!);
      pasos.push({
        titulo: 'Valor futuro',
        formula: 'S = P · (1 + i)^n',
        sustitucion: `${pesos(p!)} · (1 + ${numero(periodica)})^${numero(n!)}`,
        resultado: pesos(valor),
      });
    } else if (incognita === 'P') {
      valor = valorPresente(s!, periodica, n!);
      pasos.push({
        titulo: 'Valor presente',
        formula: 'P = S / (1 + i)^n',
        sustitucion: `${pesos(s!)} / (1 + ${numero(periodica)})^${numero(n!)}`,
        resultado: pesos(valor),
      });
    } else {
      valor = periodosCompuesto(p!, s!, periodica);
      pasos.push({
        titulo: 'Número de periodos',
        formula: 'n = ln(S / P) / ln(1 + i)',
        sustitucion: `ln(${pesos(s!)} / ${pesos(p!)}) / ln(1 + ${numero(periodica)})`,
        resultado: `${cuatroDecimales(valor)} periodos`,
      });
      if (!valor.isInteger()) {
        const arriba = valor.ceil();
        pasos.push({
          titulo: 'Resultado fraccionario',
          formula: '',
          sustitucion: `${cuatroDecimales(valor)} está entre ${valor.floor().toString()} y ${arriba.toString()} periodos`,
          resultado: `Con ${arriba.toString()} periodos completos ya se alcanza S`,
        });
      }
    }
    if ((incognita === 'S' || incognita === 'P') && valor.gt(MONTO_MAXIMO)) {
      return { ok: false, errores: { general: RESULTADO_GRANDE } };
    }
  }

  return {
    ok: true,
    datos: { incognita, valor, tasaPeriodica: periodica, ea, nominal: periodica.times(m), pasos },
  };
}
