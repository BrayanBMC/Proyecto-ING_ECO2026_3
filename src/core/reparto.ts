import { leerPositivo } from './comun';
import type { ResultadoValidacion } from './cuenta';
import { D, type Dec, type EscalaMonetaria } from './decimal';
import { sub, type Paso } from './explicacion';
import { parseNumeroEsCo } from './parse';
import { MONTO_MAXIMO } from './simulador';
import { numero } from './tasas';

/**
 * HU-20: reparto proporcional directo, inverso y compuesto (sección 7.1 de la propuesta).
 *
 * Método del mayor residuo: cada parte se redondea hacia abajo a la escala monetaria y las
 * unidades que sobran (siempre menos que el número de partes) se entregan, de a una, a las partes
 * con mayor residuo. Los empates se resuelven por orden. Así la suma es EXACTAMENTE el monto.
 */

export type MetodoReparto = 'directo' | 'inverso' | 'compuesto';

export const MIN_PARTES = 2;
export const MAX_PARTES = 20;
const INDICE_MAXIMO = new D('1000000000000');
const CERO = new D(0);

export interface RepartoNumerico {
  /** Parte de cada índice, ya redondeada a la escala. */
  montos: Dec[];
  /** Parte exacta, sin redondear. */
  exactos: Dec[];
  /** true si la parte recibió una unidad extra por mayor residuo. */
  recibioExtra: boolean[];
  /** Cuántas unidades se repartieron por residuo. */
  unidades: number;
}

/** Reparte `monto` en proporción a `pesos` (todos ≥ 0, con suma > 0). */
export function repartirMayorResiduo(monto: Dec, pesos: readonly Dec[], escala: EscalaMonetaria): RepartoNumerico {
  const unidad = escala === 2 ? new D('0.01') : new D(1);
  const total = pesos.reduce((acumulado, w) => acumulado.plus(w), CERO);
  const exactos = pesos.map((w) => monto.times(w).div(total));
  const bases = exactos.map((e) => e.div(unidad).floor().times(unidad));
  const sobrante = monto.minus(bases.reduce((acumulado, b) => acumulado.plus(b), CERO));
  const unidades = sobrante.div(unidad).round().toNumber();

  const orden = exactos
    .map((e, k) => ({ k, residuo: e.minus(bases[k]!) }))
    .sort((a, b) => b.residuo.cmp(a.residuo) || a.k - b.k);
  const recibe = new Set(orden.slice(0, unidades).map((o) => o.k));

  return {
    montos: bases.map((b, k) => (recibe.has(k) ? b.plus(unidad) : b)),
    exactos,
    recibioExtra: bases.map((_, k) => recibe.has(k)),
    unidades,
  };
}

export interface FilaFormularioReparto {
  nombre: string;
  /** Primer índice. */
  x: string;
  /** Segundo índice (solo en el reparto compuesto). */
  y: string;
}

export interface FormularioReparto {
  monto: string;
  metodo: MetodoReparto;
  escala: EscalaMonetaria;
  filas: FilaFormularioReparto[];
}

export interface ErroresReparto {
  monto?: string;
  general?: string;
  /** Un elemento por parte, en el mismo orden que el formulario. */
  filas: { x?: string; y?: string }[];
}

export interface ParteReparto {
  nombre: string;
  x: Dec;
  y: Dec | null;
  peso: Dec;
  exacto: Dec;
  monto: Dec;
  recibioExtra: boolean;
}

export interface ResultadoReparto {
  metodo: MetodoReparto;
  monto: Dec;
  escala: EscalaMonetaria;
  partes: ParteReparto[];
  suma: Dec;
  unidades: number;
  pasos: Paso[];
}

const FORMULA_PESO: Record<MetodoReparto, string> = {
  directo: 'w_k = x_k',
  inverso: 'w_k = 1 / x_k',
  compuesto: 'w_k = x_k · y_k',
};

export function calcularReparto(
  f: FormularioReparto,
  pesos: (monto: Dec) => string,
): ResultadoValidacion<ResultadoReparto, ErroresReparto> {
  const errores: ErroresReparto = { filas: f.filas.map(() => ({})) };

  if (f.filas.length < MIN_PARTES || f.filas.length > MAX_PARTES) {
    errores.general = `Reparte entre ${MIN_PARTES} y ${MAX_PARTES} partes.`;
  }

  const monto = leerPositivo(f.monto, MONTO_MAXIMO);
  if (!monto) {
    errores.monto = 'Escribe el monto a repartir en pesos, mayor que 0, por ejemplo 1.000.000.';
  } else if (monto.decimalPlaces() > f.escala) {
    errores.monto =
      f.escala === 0
        ? 'Con 0 decimales el monto debe ser un número entero.'
        : 'Con 2 decimales el monto no puede tener más de 2 decimales.';
  }

  const xs: Dec[] = [];
  const ys: Dec[] = [];
  f.filas.forEach((fila, k) => {
    const parte = `Parte ${k + 1}`;
    const x = parseNumeroEsCo(fila.x);
    if (!x || x.lt(0) || x.gt(INDICE_MAXIMO)) {
      errores.filas[k]!.x = `${parte}: escribe un índice entre 0 y 1.000.000.000.000.`;
    } else if (f.metodo === 'inverso' && x.isZero()) {
      errores.filas[k]!.x = `${parte}: en el reparto inverso el índice debe ser mayor que 0, porque se divide entre él.`;
    } else {
      xs.push(x);
    }
    if (f.metodo === 'compuesto') {
      const y = parseNumeroEsCo(fila.y);
      if (!y || y.lt(0) || y.gt(INDICE_MAXIMO)) {
        errores.filas[k]!.y = `${parte}: escribe un segundo índice entre 0 y 1.000.000.000.000.`;
      } else {
        ys.push(y);
      }
    }
  });

  const hayErrorDeIndice = errores.filas.some((e) => e.x || e.y);
  let pesosReparto: Dec[] = [];
  if (!hayErrorDeIndice) {
    pesosReparto = xs.map((x, k) => (f.metodo === 'inverso' ? new D(1).div(x) : f.metodo === 'compuesto' ? x.times(ys[k]!) : x));
    if (pesosReparto.reduce((acumulado, w) => acumulado.plus(w), CERO).isZero()) {
      errores.general =
        f.metodo === 'compuesto'
          ? 'La suma de los productos x · y debe ser mayor que 0.'
          : 'La suma de los índices debe ser mayor que 0.';
    }
  }

  if (errores.monto || errores.general || hayErrorDeIndice) {
    return { ok: false, errores };
  }

  const montoReparto = monto as Dec;
  const reparto = repartirMayorResiduo(montoReparto, pesosReparto, f.escala);
  const partes: ParteReparto[] = f.filas.map((fila, k) => ({
    nombre: fila.nombre.trim() || `Parte ${k + 1}`,
    x: xs[k]!,
    y: f.metodo === 'compuesto' ? ys[k]! : null,
    peso: pesosReparto[k]!,
    exacto: reparto.exactos[k]!,
    monto: reparto.montos[k]!,
    recibioExtra: reparto.recibioExtra[k]!,
  }));
  const suma = partes.reduce((acumulado, p) => acumulado.plus(p.monto), CERO);
  const total = pesosReparto.reduce((acumulado, w) => acumulado.plus(w), CERO);
  const unidad = f.escala === 2 ? new D('0.01') : new D(1);

  const detallePeso = (p: ParteReparto): string =>
    f.metodo === 'inverso'
      ? `1 / ${numero(p.x)} = ${numero(p.peso)}`
      : f.metodo === 'compuesto'
        ? `${numero(p.x)} · ${numero(p.y as Dec)} = ${numero(p.peso)}`
        : numero(p.peso);

  const pasos: Paso[] = [
    {
      titulo: 'Peso de cada parte',
      formula: FORMULA_PESO[f.metodo],
      sustitucion: partes.map((p, k) => `w${sub(k + 1)} = ${detallePeso(p)}`).join('; '),
      resultado: `Σw = ${numero(total)}`,
    },
    {
      titulo: 'Parte exacta de cada uno',
      formula: 'C_k = M · w_k / Σw',
      sustitucion: `C${sub(1)} = ${pesos(montoReparto)} · ${numero(partes[0]!.peso)} / ${numero(total)}`,
      resultado: `${numero(partes[0]!.exacto)} (las demás partes se calculan igual)`,
    },
    {
      titulo: 'Ajuste para que la suma sea exacta',
      formula: 'Σ C_k = M',
      sustitucion: `Se redondea cada parte hacia abajo a ${f.escala === 0 ? 'pesos enteros' : 'centavos'} y sobran ${reparto.unidades} unidades de ${pesos(unidad)}`,
      resultado:
        reparto.unidades === 0
          ? 'No hizo falta ajustar: las partes ya suman el monto'
          : `Esas unidades van a las partes con mayor residuo (empate: por orden). Suma = ${pesos(suma)}`,
    },
  ];

  return {
    ok: true,
    datos: { metodo: f.metodo, monto: montoReparto, escala: f.escala, partes, suma, unidades: reparto.unidades, pasos },
  };
}
