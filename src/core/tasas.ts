import { D, type Dec } from './decimal';

/**
 * Conversión de tasas (HU-08 y HU-09). Fórmulas de la sección 7.1 de la propuesta.
 * Todas las tasas van en decimal (0,24 = 24 %) y nunca se redondean.
 */

/** Periodos por año (enum `Frecuencia` del spec, sección 4). */
export type Frecuencia = 1 | 2 | 3 | 4 | 6 | 12 | 24 | 360;

export const FRECUENCIAS: readonly { valor: Frecuencia; nombre: string; periodo: string; sigla: string }[] = [
  { valor: 12, nombre: 'Mensual', periodo: 'mes', sigla: 'M' },
  { valor: 24, nombre: 'Quincenal', periodo: 'quincena', sigla: 'Q' },
  { valor: 6, nombre: 'Bimestral', periodo: 'bimestre', sigla: 'B' },
  { valor: 4, nombre: 'Trimestral', periodo: 'trimestre', sigla: 'T' },
  { valor: 3, nombre: 'Cuatrimestral', periodo: 'cuatrimestre', sigla: 'C' },
  { valor: 2, nombre: 'Semestral', periodo: 'semestre', sigla: 'S' },
  { valor: 1, nombre: 'Anual', periodo: 'año', sigla: 'A' },
  { valor: 360, nombre: 'Diaria', periodo: 'día', sigla: 'D' },
];

export function nombreFrecuencia(m: Frecuencia): (typeof FRECUENCIAS)[number] {
  return FRECUENCIAS.find((f) => f.valor === m) as (typeof FRECUENCIAS)[number];
}

const UNO = new D(1);

/** Nominal anual vencida → EA: (1 + j/m)^m − 1. */
export function nominalVencidaAEA(j: Dec, m: Frecuencia): Dec {
  return UNO.plus(j.div(m)).pow(m).minus(1);
}

/** Periódica anticipada → vencida: i_v = i_a / (1 − i_a). */
export function anticipadaAVencida(ia: Dec): Dec {
  return ia.div(UNO.minus(ia));
}

/** Periódica vencida → anticipada: i_a = i_v / (1 + i_v). */
export function vencidaAAnticipada(iv: Dec): Dec {
  return iv.div(UNO.plus(iv));
}

/** Nominal anual anticipada → EA: (1 − j_a/m)^(−m) − 1. Exige j_a/m < 1. */
export function nominalAnticipadaAEA(ja: Dec, m: Frecuencia): Dec {
  return UNO.minus(ja.div(m)).pow(-m).minus(1);
}

/** Equivalencia entre frecuencias: i₂ = (1 + i₁)^(m₁/m₂) − 1. */
export function tasaEquivalente(i1: Dec, m1: Frecuencia, m2: Frecuencia): Dec {
  return m1 === m2 ? new D(i1) : UNO.plus(i1).pow(new D(m1).div(m2)).minus(1);
}

/** EA → tasa periódica del periodo de pago: (1 + EA)^(1/m) − 1. */
export function eaAPeriodica(ea: Dec, m: Frecuencia): Dec {
  return tasaEquivalente(ea, 1, m);
}

/** EA → nominal anual vencida: m·[(1 + EA)^(1/m) − 1]. */
export function eaANominal(ea: Dec, m: Frecuencia): Dec {
  return eaAPeriodica(ea, m).times(m);
}

export type TipoTasa = 'nominal-vencida' | 'nominal-anticipada' | 'efectiva';

export interface PasoTasa {
  /** Qué se calcula y su fórmula, en texto plano. */
  descripcion: string;
  /** La fórmula con los valores del usuario reemplazados (HU-16). */
  sustitucion: string;
  valor: Dec;
}

/** Decimal en formato es-CO con hasta 10 decimales, sin ceros sobrantes: 0,268241795. */
export function numero(x: Dec): string {
  return x.toDecimalPlaces(10).toString().replace('.', ',');
}

export interface ResultadoTasa {
  ea: Dec;
  periodica: Dec;
  pasos: PasoTasa[];
}

const pct = (x: Dec, decimales = 4) => `${x.times(100).toDecimalPlaces(decimales).toFixed(decimales).replace('.', ',')} %`;

/**
 * Convierte la tasa ingresada a la EA y a la tasa del periodo de pago, y devuelve los pasos
 * para mostrar "cómo se calculó".
 *
 * - nominal-vencida: tasa anual con capitalización `frecuenciaTasa` (por ejemplo 24 % NMV).
 * - nominal-anticipada: tasa anual cobrada al inicio de cada periodo (por ejemplo 30 % NTA).
 * - efectiva: tasa efectiva del periodo `frecuenciaTasa` (1 = EA, 12 = efectiva mensual).
 */
export function calcularTasa(entrada: {
  valor: Dec;
  tipo: TipoTasa;
  frecuenciaTasa: Frecuencia;
  frecuenciaPago: Frecuencia;
}): ResultadoTasa {
  const { valor, tipo, frecuenciaTasa: m, frecuenciaPago: mp } = entrada;
  const pasos: PasoTasa[] = [];
  let ea: Dec;

  if (tipo === 'nominal-vencida') {
    const iv = valor.div(m);
    pasos.push({
      descripcion: `Tasa del periodo de capitalización: i = j / m = ${pct(valor)} / ${m}`,
      sustitucion: `${numero(valor)} / ${m}`,
      valor: iv,
    });
    ea = nominalVencidaAEA(valor, m);
    pasos.push({ descripcion: `EA = (1 + i)^${m} − 1`, sustitucion: `(1 + ${numero(iv)})^${m} − 1`, valor: ea });
  } else if (tipo === 'nominal-anticipada') {
    const ia = valor.div(m);
    pasos.push({
      descripcion: `Tasa anticipada del periodo: i_a = j_a / m = ${pct(valor)} / ${m}`,
      sustitucion: `${numero(valor)} / ${m}`,
      valor: ia,
    });
    const iv = anticipadaAVencida(ia);
    pasos.push({
      descripcion: 'Tasa vencida equivalente: i_v = i_a / (1 − i_a)',
      sustitucion: `${numero(ia)} / (1 − ${numero(ia)})`,
      valor: iv,
    });
    ea = UNO.plus(iv).pow(m).minus(1);
    pasos.push({ descripcion: `EA = (1 + i_v)^${m} − 1`, sustitucion: `(1 + ${numero(iv)})^${m} − 1`, valor: ea });
  } else {
    ea = tasaEquivalente(valor, m, 1);
    pasos.push(
      m === 1
        ? { descripcion: 'La tasa ya es efectiva anual', sustitucion: numero(valor), valor: ea }
        : { descripcion: `EA = (1 + i)^${m} − 1`, sustitucion: `(1 + ${numero(valor)})^${m} − 1`, valor: ea },
    );
  }

  const periodica = eaAPeriodica(ea, mp);
  pasos.push(
    mp === 1
      ? { descripcion: 'El periodo de pago es anual: i = EA', sustitucion: numero(ea), valor: periodica }
      : {
          descripcion: `Tasa del periodo de pago: i = (1 + EA)^(1/${mp}) − 1`,
          sustitucion: `(1 + ${numero(ea)})^(1/${mp}) − 1`,
          valor: periodica,
        },
  );
  return { ea, periodica, pasos };
}
