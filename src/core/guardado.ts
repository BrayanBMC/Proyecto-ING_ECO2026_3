import { generarTabla, type AbonoExtra, type Gracia, type ModoAbono, type Sistema, type Tabla, type TipoGracia } from './amortizacion';
import { compararSistemas, type Comparacion } from './comparar';
import type { ResultadoValidacion } from './cuenta';
import type { Dec, EscalaMonetaria } from './decimal';
import { validarAbono, validarGracia, validarSimulacion, type Simulacion } from './simulador';
import { FRECUENCIAS, calcularTasa, type Frecuencia, type ResultadoTasa, type TipoTasa } from './tasas';
import { fechaIso } from './usura';

/**
 * HU-21 a HU-24: guardar, abrir, comparar y compartir simulaciones de crédito.
 *
 * Una simulación se guarda SOLO con sus parámetros, escritos igual que en el formulario
 * (texto en formato es-CO). La tabla de cuotas no se guarda: se recalcula al abrir con las mismas
 * validaciones y el mismo motor, así que siempre coincide con lo que se vería al simular de nuevo.
 */

/** Tope de simulaciones guardadas por usuario (lo aplica también la base de datos). */
export const LIMITE_GUARDADAS = 50;
/** Cuántas simulaciones se pueden comparar a la vez (HU-23). */
export const MAX_COMPARAR = 3;
export const LONGITUD_MAXIMA_NOMBRE_SIMULACION = 60;

export interface ParametrosCredito {
  monto: string;
  plazo: string;
  frecuenciaPago: Frecuencia;
  tasa: string;
  tipoTasa: TipoTasa;
  frecuenciaTasa: Frecuencia;
  sistema: Sistema;
  graciaPeriodos: string;
  graciaTipo: TipoGracia;
  escala: EscalaMonetaria;
  abono: { periodo: string; valor: string; modo: ModoAbono } | null;
}

export interface SimulacionGuardada {
  id: string;
  nombre: string;
  parametros: ParametrosCredito;
  /** Fecha de la última modificación, en ISO 8601. */
  actualizadoEn: string;
}

const MENSAJE_INVALIDO = 'Los datos de la simulación no son válidos.';
const LONGITUD_MAXIMA_TEXTO = 40;
const TIPOS_TASA: readonly TipoTasa[] = ['nominal-vencida', 'nominal-anticipada', 'efectiva'];
const SISTEMAS: readonly Sistema[] = ['frances', 'aleman'];
const TIPOS_GRACIA: readonly TipoGracia[] = ['muerta', 'intereses'];
const MODOS_ABONO: readonly ModoAbono[] = ['recalcular-cuota', 'reducir-plazo'];
const ESCALAS: readonly EscalaMonetaria[] = [0, 2];

const esTexto = (x: unknown): x is string => typeof x === 'string' && x.length <= LONGITUD_MAXIMA_TEXTO;
const esUno = <T>(x: unknown, opciones: readonly T[]): x is T => opciones.includes(x as T);

/**
 * Comprueba la FORMA de lo que llega de la base de datos o de un enlace (puede venir alterado):
 * tipos y valores permitidos. Los rangos (monto, plazo, tasa…) los valida `calcularCredito`.
 */
export function leerParametros(entrada: unknown): ResultadoValidacion<ParametrosCredito, string> {
  if (typeof entrada !== 'object' || entrada === null) {
    return { ok: false, errores: MENSAJE_INVALIDO };
  }
  const e = entrada as Record<string, unknown>;
  const frecuencias = FRECUENCIAS.map((f) => f.valor);

  if (
    !esTexto(e.monto) ||
    !esTexto(e.plazo) ||
    !esTexto(e.tasa) ||
    !esTexto(e.graciaPeriodos) ||
    !esUno(e.frecuenciaPago, frecuencias) ||
    !esUno(e.frecuenciaTasa, frecuencias) ||
    !esUno(e.tipoTasa, TIPOS_TASA) ||
    !esUno(e.sistema, SISTEMAS) ||
    !esUno(e.graciaTipo, TIPOS_GRACIA) ||
    !esUno(e.escala, ESCALAS)
  ) {
    return { ok: false, errores: MENSAJE_INVALIDO };
  }

  let abono: ParametrosCredito['abono'] = null;
  if (e.abono !== null && e.abono !== undefined) {
    const a = e.abono as Record<string, unknown>;
    if (typeof e.abono !== 'object' || !esTexto(a.periodo) || !esTexto(a.valor) || !esUno(a.modo, MODOS_ABONO)) {
      return { ok: false, errores: MENSAJE_INVALIDO };
    }
    abono = { periodo: a.periodo, valor: a.valor, modo: a.modo };
  }

  return {
    ok: true,
    datos: {
      monto: e.monto,
      plazo: e.plazo,
      frecuenciaPago: e.frecuenciaPago,
      tasa: e.tasa,
      tipoTasa: e.tipoTasa,
      frecuenciaTasa: e.frecuenciaTasa,
      sistema: e.sistema,
      graciaPeriodos: e.graciaPeriodos,
      graciaTipo: e.graciaTipo,
      escala: e.escala,
      abono,
    },
  };
}

export interface CreditoCalculado {
  simulacion: Simulacion;
  tasa: ResultadoTasa;
  gracia: Gracia;
  /** Tabla sin abono extraordinario. */
  base: Tabla;
  abono: AbonoExtra | null;
  /** Tabla que se muestra: la base, o la que incluye el abono. */
  tabla: Tabla;
  comparacion: Comparacion;
}

const primerMensaje = (errores: Partial<Record<string, string>>): string =>
  Object.values(errores).find((m) => m) ?? MENSAJE_INVALIDO;

/**
 * Valida los parámetros con las mismas reglas del simulador y recalcula todo.
 * Si algo está fuera de rango devuelve el mensaje y NO calcula (criterio HU-24 de enlaces alterados).
 */
export function calcularCredito(
  p: ParametrosCredito,
  formatear: (monto: Dec) => string,
): ResultadoValidacion<CreditoCalculado, string> {
  const validacion = validarSimulacion({
    monto: p.monto,
    plazo: p.plazo,
    frecuenciaPago: p.frecuenciaPago,
    tasa: p.tasa,
    tipoTasa: p.tipoTasa,
    frecuenciaTasa: p.frecuenciaTasa,
    sistema: p.sistema,
  });
  if (!validacion.ok) {
    return { ok: false, errores: primerMensaje(validacion.errores) };
  }
  const validacionGracia = validarGracia(p.graciaPeriodos);
  if (!validacionGracia.ok) {
    return { ok: false, errores: validacionGracia.errores };
  }

  const s = validacion.datos;
  const gracia: Gracia = { tipo: p.graciaTipo, periodos: validacionGracia.datos };
  const tasa = calcularTasa({
    valor: s.tasa,
    tipo: s.tipoTasa,
    frecuenciaTasa: s.frecuenciaTasa,
    frecuenciaPago: s.frecuenciaPago,
  });
  const credito = { capital: s.monto, tasa: tasa.periodica, plazo: s.plazo, escala: p.escala, gracia };
  const base = generarTabla({ ...credito, sistema: s.sistema });

  let abono: AbonoExtra | null = null;
  if (p.abono) {
    const validacionAbono = validarAbono({
      periodo: p.abono.periodo,
      valor: p.abono.valor,
      saldos: base.filas.map((f) => f.saldo),
      gracia: gracia.periodos,
      plazo: s.plazo,
      formatear,
    });
    if (!validacionAbono.ok) {
      return { ok: false, errores: primerMensaje(validacionAbono.errores) };
    }
    abono = { ...validacionAbono.datos, modo: p.abono.modo };
  }

  const tabla = abono ? generarTabla({ ...credito, sistema: s.sistema, abono }) : base;
  const comparacion = compararSistemas(credito);
  return { ok: true, datos: { simulacion: s, tasa, gracia, base, abono, tabla, comparacion } };
}

export interface ResumenCredito {
  /** Primera cuota de amortización (después de la gracia). */
  cuota: Dec;
  ea: Dec;
  totalIntereses: Dec;
  totalPagado: Dec;
  /** ρ = intereses totales / capital: pesos de interés por cada peso prestado. */
  rho: Dec;
}

export function resumirCredito(c: CreditoCalculado): ResumenCredito {
  return {
    cuota: c.tabla.filas.find((f) => f.periodo > 0 && !f.gracia)!.cuota,
    ea: c.tasa.ea,
    totalIntereses: c.tabla.totalIntereses,
    totalPagado: c.tabla.totalPagado,
    rho: c.tabla.totalIntereses.div(c.simulacion.monto),
  };
}

/** Posición de la simulación más barata (menos intereses totales). Con empate gana la primera. */
export function indiceMenorCosto(resumenes: readonly ResumenCredito[]): number {
  let mejor = 0;
  resumenes.forEach((r, k) => {
    if (r.totalIntereses.lt(resumenes[mejor]!.totalIntereses)) {
      mejor = k;
    }
  });
  return mejor;
}

/** Nombre de una simulación: entre 1 y 60 caracteres sin contar los espacios de los bordes. */
export function validarNombreSimulacion(texto: string): ResultadoValidacion<string, string> {
  const nombre = texto.trim();
  if (nombre.length < 1 || nombre.length > LONGITUD_MAXIMA_NOMBRE_SIMULACION) {
    return { ok: false, errores: `El nombre debe tener entre 1 y ${LONGITUD_MAXIMA_NOMBRE_SIMULACION} caracteres.` };
  }
  return { ok: true, datos: nombre };
}

/** Nombre por defecto cuando el usuario no escribe uno: "Simulación 2026-11-01". */
export function nombreAutomatico(fecha: Date): string {
  return `Simulación ${fechaIso(fecha)}`;
}
