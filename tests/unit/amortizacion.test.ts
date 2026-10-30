import fc from 'fast-check';
import { D, cuotaFrances, dec, generarTabla, type Sistema } from '../../src/core';

const s = (x: { toString: () => string }) => x.toString();

describe('core/amortizacion: Francés (HU-10)', () => {
  it('T3: P = 10.000.000, i = 1,5 %, n = 12, escala 2', () => {
    const t = generarTabla({ capital: dec(10_000_000), tasa: dec('0.015'), plazo: 12, sistema: 'frances', escala: 2 });
    const [f0, f1, f2] = t.filas;
    expect(s(f0!.saldo)).toBe('10000000');
    expect(f1!.cuota.toFixed(2)).toBe('916799.92');
    expect(f1!.interes.toFixed(2)).toBe('150000.00');
    expect(f1!.abono.toFixed(2)).toBe('766799.92');
    expect(f2!.interes.toFixed(2)).toBe('138498.00');
    expect(t.filas.at(-1)!.saldo.isZero()).toBe(true);
    expect(t.totalIntereses.minus('1001599').abs().lte(1)).toBe(true);
  });

  it('T3b y criterio HU-10: con escala 0 la fila 0 tiene el saldo, la cuota es 916.800 y el saldo final es 0', () => {
    const t = generarTabla({ capital: dec(10_000_000), tasa: dec('0.015'), plazo: 12, sistema: 'frances', escala: 0 });
    expect(t.filas).toHaveLength(13);
    expect(t.filas[0]).toMatchObject({ periodo: 0 });
    expect(s(t.filas[0]!.saldo)).toBe('10000000');
    for (const fila of t.filas.slice(1, 12)) {
      expect(s(fila.cuota)).toBe('916800');
    }
    expect(t.filas[12]!.cuota.minus(916800).abs().lte(6)).toBe(true);
    expect(t.filas[12]!.saldo.isZero()).toBe(true);
    expect(s(t.filas.reduce((suma, f) => suma.plus(f.abono), new D(0)))).toBe('10000000');
  });

  it('T5: con i = 0 la cuota es P/n, no hay intereses y no lanza error', () => {
    const t = generarTabla({ capital: dec(1_200_000), tasa: dec(0), plazo: 12, sistema: 'frances', escala: 0 });
    expect(s(t.filas[1]!.cuota)).toBe('100000');
    expect(t.totalIntereses.isZero()).toBe(true);
    expect(s(t.totalPagado)).toBe('1200000');
    expect(s(cuotaFrances(dec(1_200_000), dec(0), 12))).toBe('100000');
  });

  it('con montos muy pequeños el saldo nunca queda negativo', () => {
    const t = generarTabla({ capital: dec(13), tasa: dec(0), plazo: 8, sistema: 'frances', escala: 0 });
    expect(t.filas.every((f) => f.saldo.gte(0))).toBe(true);
    expect(t.filas.at(-1)!.saldo.isZero()).toBe(true);
  });
});

describe('core/amortizacion: Alemán (HU-10)', () => {
  it('T4 y criterio HU-10: abono constante de 1.000.000 y cuota que decrece de 1.120.000 a 1.010.000', () => {
    const t = generarTabla({ capital: dec(12_000_000), tasa: dec('0.01'), plazo: 12, sistema: 'aleman', escala: 0 });
    const filas = t.filas.slice(1);
    expect(filas.every((f) => s(f.abono) === '1000000')).toBe(true);
    expect(s(filas[0]!.cuota)).toBe('1120000');
    expect(s(filas[11]!.cuota)).toBe('1010000');
    for (let k = 1; k < filas.length; k++) {
      expect(filas[k]!.cuota.lt(filas[k - 1]!.cuota)).toBe(true);
    }
    expect(s(t.totalIntereses)).toBe('780000');
  });
});

describe('core/amortizacion: propiedades (sección 7.3)', () => {
  const entrada = fc.record({
    capital: fc.bigInt({ min: 1n, max: 10n ** 12n }),
    plazo: fc.integer({ min: 1, max: 360 }),
    // tasa periódica de 0 a 10 % en pasos de 0,0001 %
    tasa: fc.integer({ min: 0, max: 100000 }),
    sistema: fc.constantFrom<Sistema>('frances', 'aleman'),
  });

  it('Σ abonos = P, saldo final 0 y ningún saldo negativo', () => {
    fc.assert(
      fc.property(entrada, ({ capital, plazo, tasa, sistema }) => {
        const t = generarTabla({
          capital: dec(capital.toString()),
          tasa: dec(tasa).div(1_000_000),
          plazo,
          sistema,
          escala: 0,
        });
        const sumaAbonos = t.filas.reduce((suma, f) => suma.plus(f.abono), new D(0));
        return (
          sumaAbonos.eq(capital.toString()) &&
          t.filas.at(-1)!.saldo.isZero() &&
          t.filas.every((f) => f.saldo.gte(0)) &&
          t.filas.slice(1).every((f, k, filas) => k === 0 || f.saldo.lte(filas[k - 1]!.saldo))
        );
      }),
      { numRuns: 200 },
    );
  });
});
