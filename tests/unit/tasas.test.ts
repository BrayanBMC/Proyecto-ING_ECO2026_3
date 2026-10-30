import fc from 'fast-check';
import {
  FRECUENCIAS,
  anticipadaAVencida,
  calcularTasa,
  dec,
  eaANominal,
  eaAPeriodica,
  nombreFrecuencia,
  nominalAnticipadaAEA,
  nominalVencidaAEA,
  tasaEquivalente,
  vencidaAAnticipada,
  type Frecuencia,
} from '../../src/core';

const a6 = (x: { toFixed: (d: number) => string }) => x.toFixed(6);

describe('core/tasas (HU-08, HU-09)', () => {
  it('T1: 24 % nominal mensual vencida → EA 26,824179 %; ida y vuelta da 2 % exacto a 30 dígitos', () => {
    const ea = nominalVencidaAEA(dec('0.24'), 12);
    expect(a6(ea.times(100))).toBe('26.824179');
    expect(eaAPeriodica(ea, 12).minus('0.02').abs().lt('1e-30')).toBe(true);
  });

  it('T2: 30 % nominal trimestral anticipada → i_a 7,5 %, i_v 8,108108 %, EA 36,5945 %', () => {
    const ia = dec('0.3').div(4);
    expect(ia.toString()).toBe('0.075');
    expect(a6(anticipadaAVencida(ia).times(100))).toBe('8.108108');
    expect(nominalAnticipadaAEA(dec('0.3'), 4).times(100).toFixed(4)).toBe('36.5945');
  });

  it('anticipada ↔ vencida es ida y vuelta', () => {
    const iv = anticipadaAVencida(dec('0.075'));
    expect(vencidaAAnticipada(iv).minus('0.075').abs().lt('1e-30')).toBe(true);
  });

  it('la equivalencia con la misma frecuencia no opera', () => {
    expect(tasaEquivalente(dec('0.015'), 12, 12).toString()).toBe('0.015');
  });

  it('EA → nominal: 26,824179 % EA es 24 % NMV', () => {
    const ea = nominalVencidaAEA(dec('0.24'), 12);
    expect(eaANominal(ea, 12).minus('0.24').abs().lt('1e-30')).toBe(true);
  });

  it('nombreFrecuencia devuelve nombre, periodo y sigla', () => {
    expect(nombreFrecuencia(4)).toEqual({ valor: 4, nombre: 'Trimestral', periodo: 'trimestre', sigla: 'T' });
    expect(FRECUENCIAS).toHaveLength(8);
  });

  it('propiedad: nominal → EA → periódica devuelve j/m (tolerancia 1e-30)', () => {
    const frecuencias = FRECUENCIAS.map((f) => f.valor);
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10000 }), fc.constantFrom(...frecuencias), (centesimas, m: Frecuencia) => {
        const j = dec(centesimas).div(10000); // 0,01 % a 100 %
        return eaAPeriodica(nominalVencidaAEA(j, m), m).minus(j.div(m)).abs().lt('1e-30');
      }),
      { numRuns: 300 },
    );
  }, 60_000);
});

describe('core/tasas: calcularTasa', () => {
  it('criterio HU-08: 24 % NMV con pago mensual → EA 26,8242 % y tasa mensual 2,0000 %', () => {
    const r = calcularTasa({ valor: dec('0.24'), tipo: 'nominal-vencida', frecuenciaTasa: 12, frecuenciaPago: 12 });
    expect(r.ea.times(100).toFixed(4)).toBe('26.8242');
    expect(r.periodica.times(100).toFixed(4)).toBe('2.0000');
    expect(r.pasos.map((p) => p.descripcion)).toEqual([
      'Tasa del periodo de capitalización: i = j / m = 24,0000 % / 12',
      'EA = (1 + i)^12 − 1',
      'Tasa del periodo de pago: i = (1 + EA)^(1/12) − 1',
    ]);
  });

  it('criterio HU-09: 30 % NTA → EA 36,5945 % y muestra el paso i_v = i_a / (1 − i_a)', () => {
    const r = calcularTasa({ valor: dec('0.3'), tipo: 'nominal-anticipada', frecuenciaTasa: 4, frecuenciaPago: 12 });
    expect(r.ea.times(100).toFixed(4)).toBe('36.5945');
    expect(r.pasos[1]?.descripcion).toBe('Tasa vencida equivalente: i_v = i_a / (1 − i_a)');
    expect(a6(r.pasos[1]!.valor.times(100))).toBe('8.108108');
  });

  it('efectiva mensual 1,5 % con pago mensual vuelve a 1,5 %', () => {
    const r = calcularTasa({ valor: dec('0.015'), tipo: 'efectiva', frecuenciaTasa: 12, frecuenciaPago: 12 });
    expect(r.periodica.minus('0.015').abs().lt('1e-30')).toBe(true);
    expect(r.pasos[0]?.descripcion).toBe('EA = (1 + i)^12 − 1');
  });

  it('efectiva anual con pago anual no cambia y lo explica', () => {
    const r = calcularTasa({ valor: dec('0.2'), tipo: 'efectiva', frecuenciaTasa: 1, frecuenciaPago: 1 });
    expect(r.ea.toString()).toBe('0.2');
    expect(r.periodica.toString()).toBe('0.2');
    expect(r.pasos.map((p) => p.descripcion)).toEqual(['La tasa ya es efectiva anual', 'El periodo de pago es anual: i = EA']);
  });
});
