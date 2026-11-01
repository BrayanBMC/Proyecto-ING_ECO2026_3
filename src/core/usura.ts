import { D, type Dec } from './decimal';

/**
 * HU-15: tasa de usura (sección 7.4 de la propuesta). U_EA = 1,5 × IBC_EA.
 * Los datos se copian a mano de la certificación mensual de la Superintendencia Financiera.
 * Sin llamadas de red: la SFC no tiene una API estable.
 */

export interface VigenciaIbc {
  modalidad: string;
  /** IBC efectivo anual, en decimal. */
  ibcEA: string;
  /** Primer y último día de vigencia, en formato AAAA-MM-DD. */
  desde: string;
  hasta: string;
  fuenteUrl: string;
}

export const VIGENCIAS_IBC: readonly VigenciaIbc[] = [
  {
    modalidad: 'Consumo y ordinario',
    ibcEA: '0.1906',
    desde: '2026-10-01',
    hasta: '2026-10-31',
    fuenteUrl:
      'https://www.superfinanciera.gov.co/publicaciones/10116267/superfinanciera-certifica-el-interes-bancario-corriente/',
  },
  {
    // Usura certificada de noviembre: 28,34 %. IBC = 18,89 % (18,89 × 1,5 = 28,335 → 28,34).
    modalidad: 'Consumo y ordinario',
    ibcEA: '0.1889',
    desde: '2026-11-01',
    hasta: '2026-11-30',
    fuenteUrl: 'https://www.superfinanciera.gov.co/publicaciones/10829/sala-de-prensacomunicados-de-prensa-interes-bancario-corriente-10829/',
  },
];

export const FACTOR_USURA = new D('1.5');

export function usuraDesdeIbc(ibcEA: Dec): Dec {
  return ibcEA.times(FACTOR_USURA);
}

/** Fecha local en formato AAAA-MM-DD, para comparar con las vigencias. */
export function fechaIso(fecha: Date): string {
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${m}-${d}`;
}

/** La vigencia que cubre `hoy`, o null si el dato está vencido (o aún no hay dato). */
export function vigenciaActual(hoy: Date, vigencias: readonly VigenciaIbc[] = VIGENCIAS_IBC): VigenciaIbc | null {
  const dia = fechaIso(hoy);
  return vigencias.find((v) => v.desde <= dia && dia <= v.hasta) ?? null;
}

/** La vigencia más reciente, para mostrar hasta cuándo valía el dato vencido. */
export function ultimaVigencia(vigencias: readonly VigenciaIbc[] = VIGENCIAS_IBC): VigenciaIbc {
  return [...vigencias].sort((a, b) => b.hasta.localeCompare(a.hasta))[0]!;
}

export interface EstadoUsura {
  usuraEA: Dec;
  supera: boolean;
  /** EA del crédito − usura, en puntos básicos (positivo si la supera). */
  margenPb: Dec;
}

/** Compara siempre en EA, para no mezclar una nominal con una efectiva. */
export function evaluarUsura(eaCredito: Dec, ibcEA: Dec): EstadoUsura {
  const usuraEA = usuraDesdeIbc(ibcEA);
  return { usuraEA, supera: eaCredito.gt(usuraEA), margenPb: eaCredito.minus(usuraEA).times(10000) };
}
