import { compararSistemas, dec } from '../../src/core';

describe('core/comparar (HU-11)', () => {
  it('criterio HU-11: T4 (P = 12.000.000, i = 1 %, n = 12): Alemán paga 780.000 de intereses y el Francés más', () => {
    const c = compararSistemas({ capital: dec(12_000_000), tasa: dec('0.01'), plazo: 12, escala: 0 });
    expect(c.aleman.cuotaInicial.toString()).toBe('1120000');
    expect(c.aleman.totalIntereses.toString()).toBe('780000');
    expect(c.aleman.totalPagado.toString()).toBe('12780000');
    expect(c.frances.cuotaInicial.toString()).toBe('1066186');
    // Francés: ≈ 12 × 1.066.185,87 − 12.000.000 = 794.230 (±6 por el redondeo de cada fila).
    expect(c.frances.totalIntereses.minus(794230).abs().lte(6)).toBe(true);
    expect(c.frances.totalPagado.minus(c.frances.totalIntereses).toString()).toBe('12000000');
    // Δ = (794.230 − 780.000) / 780.000 ≈ 1,82 %
    expect(c.sobrecosto!.times(100).toFixed(2)).toBe('1.82');
  });

  it('criterio HU-11: con i = 0 ambos intereses son 0 y Δ no aplica', () => {
    const c = compararSistemas({ capital: dec(1_200_000), tasa: dec(0), plazo: 12, escala: 0 });
    expect(c.frances.totalIntereses.isZero()).toBe(true);
    expect(c.aleman.totalIntereses.isZero()).toBe(true);
    expect(c.sobrecosto).toBeNull();
  });
});
