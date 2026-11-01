import {
  armarReporte,
  calcularTasa,
  dec,
  generarTabla,
  type AbonoExtra,
  type DatosReporte,
  type Gracia,
} from '../../src/core';

const pesos = (x: { toString: () => string }) => `$ ${x.toString()}`;

function datos(extra: Partial<DatosReporte> = {}): DatosReporte {
  const monto = extra.monto ?? dec(10_000_000);
  const plazo = extra.plazo ?? 12;
  const sistema = extra.sistema ?? 'frances';
  const gracia: Gracia = extra.gracia ?? { tipo: 'muerta', periodos: 0 };
  const tasa = calcularTasa({ valor: dec('0.015'), tipo: 'efectiva', frecuenciaTasa: 12, frecuenciaPago: 12 });
  const abono = extra.abono ?? null;
  const tabla = generarTabla({
    capital: monto,
    tasa: tasa.periodica,
    plazo,
    sistema,
    escala: extra.escala ?? 0,
    gracia,
    abono: abono ?? undefined,
  });
  return {
    monto,
    plazo,
    frecuenciaPago: 12,
    sistema,
    gracia,
    abono,
    tasa,
    tabla,
    escala: extra.escala ?? 0,
    perfil: extra.perfil,
    generadoEn: extra.generadoEn ?? new Date('2026-10-30T12:00:00Z'),
  };
}

describe('core/reporte (HU-17)', () => {
  it('criterio HU-17: los parámetros son los reales de la simulación, no valores fijos', () => {
    const d = datos();
    const r = armarReporte(d, pesos);
    const mapa = Object.fromEntries(r.parametros.map((p) => [p.etiqueta, p.valor]));
    expect(mapa['Monto del crédito']).toBe('$ 10000000');
    expect(mapa['Número de cuotas']).toBe('12');
    expect(mapa['Sistema de amortización']).toBe('Francés (cuota fija)');
    // La EA es la real de la simulación: (1,015)^12 − 1 = 19,5618171968 %.
    expect(mapa['Tasa efectiva anual (EA)']).toBe(`${d.tasa.ea.times(100).toDecimalPlaces(10).toString().replace('.', ',')} %`);
    expect(mapa['Tasa efectiva anual (EA)']).toContain('19,5618');
    expect(mapa['Tasa por mes']).toBe('1,5 %');
  });

  it('incluye gracia y abono en los parámetros solo cuando existen', () => {
    const base = armarReporte(datos(), pesos);
    expect(base.parametros.some((p) => p.etiqueta === 'Periodos de gracia')).toBe(false);
    expect(base.parametros.some((p) => p.etiqueta === 'Abono extraordinario')).toBe(false);

    const abono: AbonoExtra = { periodo: 3, valor: dec(2_000_000), modo: 'reducir-plazo' };
    const con = armarReporte(datos({ gracia: { tipo: 'muerta', periodos: 3 }, abono }), pesos);
    const mapa = Object.fromEntries(con.parametros.map((p) => [p.etiqueta, p.valor]));
    expect(mapa['Periodos de gracia']).toBe('3 (muerta)');
    expect(mapa['Abono extraordinario']).toBe('$ 2000000 en el periodo 3 (reduce el plazo)');
    expect(con.hayExtra).toBe(true);
    expect(con.columnas).toContain('Abono extra');
  });

  it('la tabla tiene texto y número para la misma fila, y el número es sumable', () => {
    const r = armarReporte(datos(), pesos);
    expect(r.filasTexto).toHaveLength(13); // fila 0 + 12 cuotas
    expect(r.filasNumero[1]![0]).toBe(1);
    expect(r.filasNumero[1]![1]).toBe(916800); // cuota como número
    expect(r.filasTexto[1]![1]).toBe('$ 916800');
    // Σ de los abonos a capital (columna 3) = monto.
    const sumaAbonos = r.filasNumero.slice(1).reduce((s, fila) => s + fila[3]!, 0);
    expect(sumaAbonos).toBe(10_000_000);
  });

  it('con escala 2 los números llevan dos decimales', () => {
    const r = armarReporte(datos({ escala: 2 }), pesos);
    expect(r.filasNumero[1]![1]).toBe(916799.93);
  });

  it('marca las filas de gracia en el texto', () => {
    const r = armarReporte(datos({ gracia: { tipo: 'muerta', periodos: 2 } }), pesos);
    expect(r.filasTexto[1]![0]).toBe('1 (gracia)');
    expect(r.filasTexto[3]![0]).toBe('3');
  });

  it('el encabezado trae el perfil con institución solo si hay sesión', () => {
    expect(armarReporte(datos(), pesos).encabezado[0]).toMatch(/^Generado el/);
    const conPerfil = armarReporte(datos({ perfil: { nombre: 'Ana Pérez', institucion: 'Universidad Distrital' } }), pesos);
    expect(conPerfil.encabezado[0]).toBe('Ana Pérez · Universidad Distrital');
    const sinInstitucion = armarReporte(datos({ perfil: { nombre: 'Ana', institucion: null } }), pesos);
    expect(sinInstitucion.encabezado[0]).toBe('Ana');
  });

  it('el nombre del archivo lleva la fecha de generación', () => {
    const r = armarReporte(datos({ generadoEn: new Date('2026-11-05T10:00:00Z') }), pesos);
    expect(r.nombreArchivo).toBe('amortiza-simulacion-2026-11-05');
  });
});
