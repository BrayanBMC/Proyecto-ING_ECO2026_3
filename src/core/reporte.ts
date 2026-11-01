import type { AbonoExtra, Gracia, Sistema, Tabla } from './amortizacion';
import type { Dec, EscalaMonetaria } from './decimal';
import { nombreFrecuencia, numero, type Frecuencia, type ResultadoTasa } from './tasas';

/**
 * HU-17: modelo del reporte (PDF y XLSX). Módulo puro: arma los datos que verán los adaptadores,
 * con los parámetros reales de la simulación. No sabe de pdfmake ni de Excel.
 */

export interface DatosReporte {
  monto: Dec;
  plazo: number;
  frecuenciaPago: Frecuencia;
  sistema: Sistema;
  gracia: Gracia;
  abono: AbonoExtra | null;
  tasa: ResultadoTasa;
  tabla: Tabla;
  escala: EscalaMonetaria;
  /** Nombre e institución del perfil; vacío en modo invitado. */
  perfil?: { nombre: string; institucion: string | null } | undefined;
  generadoEn: Date;
}

export interface ReporteArmado {
  titulo: string;
  /** Líneas del encabezado: perfil (si hay) y fecha. */
  encabezado: string[];
  /** Pares etiqueta/valor de los parámetros reales del crédito. */
  parametros: { etiqueta: string; valor: string }[];
  resumen: { etiqueta: string; valor: string }[];
  columnas: string[];
  /** Filas de la tabla como texto ya formateado, para el PDF. */
  filasTexto: string[][];
  /** Filas como número, para que el XLSX las pueda sumar. */
  filasNumero: number[][];
  /** Si hay abono extraordinario, se incluye la columna "Abono extra". */
  hayExtra: boolean;
  nombreArchivo: string;
}

const SISTEMAS: Record<Sistema, string> = { frances: 'Francés (cuota fija)', aleman: 'Alemán (abono fijo)' };

function pct(x: Dec): string {
  return `${numero(x.times(100))} %`;
}

export function armarReporte(datos: DatosReporte, pesos: (monto: Dec) => string): ReporteArmado {
  const { tabla, escala, gracia, abono, tasa } = datos;
  const hayExtra = tabla.filas.some((f) => !f.extra.isZero());
  const periodo = nombreFrecuencia(datos.frecuenciaPago);

  const parametros: { etiqueta: string; valor: string }[] = [
    { etiqueta: 'Monto del crédito', valor: pesos(datos.monto) },
    { etiqueta: 'Número de cuotas', valor: String(datos.plazo) },
    { etiqueta: 'Frecuencia de pago', valor: periodo.nombre },
    { etiqueta: 'Sistema de amortización', valor: SISTEMAS[datos.sistema] },
    { etiqueta: 'Tasa efectiva anual (EA)', valor: pct(tasa.ea) },
    { etiqueta: `Tasa por ${periodo.periodo}`, valor: pct(tasa.periodica) },
  ];
  if (gracia.periodos > 0) {
    parametros.push({
      etiqueta: 'Periodos de gracia',
      valor: `${gracia.periodos} (${gracia.tipo === 'muerta' ? 'muerta' : 'con pago de intereses'})`,
    });
  }
  if (abono) {
    parametros.push({
      etiqueta: 'Abono extraordinario',
      valor: `${pesos(abono.valor)} en el periodo ${abono.periodo} (${abono.modo === 'reducir-plazo' ? 'reduce el plazo' : 'reduce la cuota'})`,
    });
  }

  const resumen = [
    { etiqueta: 'Total de intereses', valor: pesos(tabla.totalIntereses) },
    { etiqueta: 'Total pagado', valor: pesos(tabla.totalPagado) },
  ];

  const columnas = ['Periodo', 'Cuota', 'Interés', 'Abono a capital', ...(hayExtra ? ['Abono extra'] : []), 'Saldo'];

  const filasTexto = tabla.filas.map((f) => [
    f.gracia ? `${f.periodo} (gracia)` : String(f.periodo),
    pesos(f.cuota),
    pesos(f.interes),
    pesos(f.abono),
    ...(hayExtra ? [pesos(f.extra)] : []),
    pesos(f.saldo),
  ]);

  // El XLSX escribe números ya redondeados a la escala (enteros o 2 decimales): exactos en Excel.
  const n = (x: Dec) => Number(x.toFixed(escala));
  const filasNumero = tabla.filas.map((f) => [
    f.periodo,
    n(f.cuota),
    n(f.interes),
    n(f.abono),
    ...(hayExtra ? [n(f.extra)] : []),
    n(f.saldo),
  ]);

  const fecha = datos.generadoEn.toISOString().slice(0, 10);
  const encabezado: string[] = [];
  if (datos.perfil) {
    encabezado.push(datos.perfil.institucion ? `${datos.perfil.nombre} · ${datos.perfil.institucion}` : datos.perfil.nombre);
  }
  encabezado.push(`Generado el ${datos.generadoEn.toLocaleDateString('es-CO')}`);

  return {
    titulo: 'Amortiza · Tabla de amortización',
    encabezado,
    parametros,
    resumen,
    columnas,
    filasTexto,
    filasNumero,
    hayExtra,
    nombreArchivo: `amortiza-simulacion-${fecha}`,
  };
}
