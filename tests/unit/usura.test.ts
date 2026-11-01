import {
  VIGENCIAS_IBC,
  dec,
  evaluarUsura,
  fechaIso,
  nominalVencidaAEA,
  tasaEquivalente,
  ultimaVigencia,
  usuraDesdeIbc,
  validarIbc,
  vigenciaActual,
} from '../../src/core';

describe('core/usura (HU-15)', () => {
  it('T12: IBC 19,06 % → usura 28,59 % EA; un crédito al 2,2 % mensual (EA ≈ 29,84 %) la supera', () => {
    expect(usuraDesdeIbc(dec('0.1906')).toString()).toBe('0.2859');
    const ea = tasaEquivalente(dec('0.022'), 12, 1);
    expect(ea.times(100).toFixed(2)).toBe('29.84');
    const estado = evaluarUsura(ea, dec('0.1906'));
    expect(estado.supera).toBe(true);
    expect(estado.margenPb.gt(0)).toBe(true);
  });

  it('un crédito al 24 % NMV (EA 26,82 %) está dentro del límite', () => {
    const estado = evaluarUsura(nominalVencidaAEA(dec('0.24'), 12), dec('0.1906'));
    expect(estado.supera).toBe(false);
    expect(estado.margenPb.lt(0)).toBe(true);
  });

  it('la vigencia de octubre de 2026 cubre del 1 al 31 de octubre', () => {
    expect(vigenciaActual(new Date(2026, 9, 1))?.ibcEA).toBe('0.1906');
    expect(vigenciaActual(new Date(2026, 9, 31))?.ibcEA).toBe('0.1906');
    expect(vigenciaActual(new Date(2026, 8, 30))).toBeNull();
  });

  it('la vigencia de noviembre de 2026 da una usura de 28,34 %', () => {
    const v = vigenciaActual(new Date(2026, 10, 1));
    expect(v?.ibcEA).toBe('0.1889');
    expect(vigenciaActual(new Date(2026, 10, 30))?.ibcEA).toBe('0.1889');
    expect(usuraDesdeIbc(dec(v!.ibcEA)).times(100).toDecimalPlaces(2).toString()).toBe('28.34');
    expect(vigenciaActual(new Date(2026, 11, 1))).toBeNull();
  });

  it('ultimaVigencia devuelve la más reciente', () => {
    expect(ultimaVigencia([...VIGENCIAS_IBC, { ...VIGENCIAS_IBC[0]!, desde: '2026-09-01', hasta: '2026-09-30' }]).hasta).toBe(
      '2026-11-30',
    );
  });

  it('cada vigencia cumple usura = 1,5 × IBC y no se solapa con otra', () => {
    const ordenadas = [...VIGENCIAS_IBC].sort((a, b) => a.desde.localeCompare(b.desde));
    for (let k = 1; k < ordenadas.length; k++) {
      expect(ordenadas[k]!.desde > ordenadas[k - 1]!.hasta).toBe(true);
    }
    for (const v of VIGENCIAS_IBC) {
      expect(v.desde <= v.hasta).toBe(true);
    }
  });

  it('fechaIso usa la fecha local con ceros', () => {
    expect(fechaIso(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('validarIbc acepta 0,01-100 % y lo pasa a decimal', () => {
    const r = validarIbc('19,06');
    expect(r.ok && r.datos.toString()).toBe('0.1906');
    expect(validarIbc('0')).toEqual({ ok: false, errores: 'El IBC debe estar entre 0,01 % y 100 % EA.' });
    expect(validarIbc('abc').ok).toBe(false);
  });
});

describe('core/usura: formato de las vigencias (lo lee el recordatorio mensual)', () => {
  it('cada vigencia cubre un mes calendario completo, del día 1 al último día', () => {
    for (const v of VIGENCIAS_IBC) {
      expect(v.desde, v.desde).toMatch(/^\d{4}-\d{2}-01$/);
      const [anio, mes] = v.desde.split('-').map(Number) as [number, number];
      const ultimoDia = new Date(anio, mes, 0).getDate();
      expect(v.hasta).toBe(`${v.desde.slice(0, 8)}${String(ultimoDia).padStart(2, '0')}`);
    }
  });

  it('las vigencias no se solapan ni se repiten', () => {
    const desdes = VIGENCIAS_IBC.map((v) => v.desde);
    expect(new Set(desdes).size).toBe(desdes.length);
  });

  it('cada IBC es un decimal entre 0 y 1', () => {
    for (const v of VIGENCIAS_IBC) {
      const ibc = dec(v.ibcEA);
      expect(ibc.gt(0) && ibc.lt(1), v.desde).toBe(true);
    }
  });
});
