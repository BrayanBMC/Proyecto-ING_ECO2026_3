import {
  calcularAnualidad,
  cuotaDesdeFuturo,
  cuotaDesdePresente,
  dec,
  factorFuturo,
  factorPresente,
  valorFuturoAnualidad,
  valorPresenteAnualidad,
  type Dec,
  type FormularioAnualidad,
  type ObjetivoAnualidad,
  type ResultadoAnualidad,
} from '../../src/core';

const fmt = (x: Dec) => x.toFixed(2);
const cerca = (a: Dec, b: Dec) => a.minus(b).abs().lt('1e-20');

function form(extra: Partial<FormularioAnualidad> = {}): FormularioAnualidad {
  return {
    objetivo: 'valores',
    valor: '500.000',
    n: '12',
    tasa: '1',
    tipoTasa: 'efectiva',
    frecuenciaTasa: 12,
    frecuenciaPago: 12,
    ...extra,
  };
}

function resolver(extra: Partial<FormularioAnualidad> = {}): ResultadoAnualidad {
  const r = calcularAnualidad(form(extra), fmt);
  if (!r.ok) {
    throw new Error(`Se esperaba un resultado y hubo errores: ${JSON.stringify(r.errores)}`);
  }
  return r.datos;
}

function errores(extra: Partial<FormularioAnualidad> = {}) {
  const r = calcularAnualidad(form(extra), fmt);
  if (r.ok) {
    throw new Error('Se esperaban errores');
  }
  return r.errores;
}

const A = dec(500_000);
const I = dec('0.01');
const N = dec(12);

describe('core/anualidades: fórmulas (HU-19)', () => {
  it('criterio HU-19 (T9): anticipada con A = 500.000, i = 1 % y n = 12 da S = 6.404.664,02', () => {
    expect(fmt(valorFuturoAnualidad(A, I, N, 'anticipada'))).toBe('6404664.02');
  });

  it('criterio HU-19 (T9): anticipada con A = 500.000, i = 1 % y n = 12 da P = 5.683.814,12', () => {
    // La propuesta decía 5.683.814,15; el valor correcto (Excel: =VA(1%;12;-500000;0;1)) es 5.683.814,12.
    expect(fmt(valorPresenteAnualidad(A, I, N, 'anticipada'))).toBe('5683814.12');
  });

  it('vencida: S = A·[(1+i)^n − 1]/i', () => {
    expect(fmt(valorFuturoAnualidad(A, I, N, 'vencida'))).toBe('6341251.51');
  });

  it('la anticipada es la vencida por (1 + i), en S y en P', () => {
    const uno = dec(1).plus(I);
    expect(cerca(valorFuturoAnualidad(A, I, N, 'anticipada'), valorFuturoAnualidad(A, I, N, 'vencida').times(uno))).toBe(true);
    expect(cerca(valorPresenteAnualidad(A, I, N, 'anticipada'), valorPresenteAnualidad(A, I, N, 'vencida').times(uno))).toBe(true);
  });

  it('la cuota desde S y desde P deshace S y P, en los dos tipos', () => {
    for (const tipo of ['vencida', 'anticipada'] as const) {
      const s = valorFuturoAnualidad(A, I, N, tipo);
      const p = valorPresenteAnualidad(A, I, N, tipo);
      expect(cerca(cuotaDesdeFuturo(s, I, N, tipo), A)).toBe(true);
      expect(cerca(cuotaDesdePresente(p, I, N, tipo), A)).toBe(true);
    }
  });

  it('criterio HU-19: con i = 0 los factores valen n y S = P = A·n sin error', () => {
    const cero = dec(0);
    expect(factorFuturo(cero, N).eq(12)).toBe(true);
    expect(factorPresente(cero, N).eq(12)).toBe(true);
    for (const tipo of ['vencida', 'anticipada'] as const) {
      expect(valorFuturoAnualidad(A, cero, N, tipo).eq(6_000_000)).toBe(true);
      expect(valorPresenteAnualidad(A, cero, N, tipo).eq(6_000_000)).toBe(true);
      expect(cuotaDesdeFuturo(dec(6_000_000), cero, N, tipo).eq(500_000)).toBe(true);
      expect(cuotaDesdePresente(dec(6_000_000), cero, N, tipo).eq(500_000)).toBe(true);
    }
  });
});

describe('core/anualidades: calcularAnualidad (HU-19)', () => {
  it('criterio HU-19 (T9): con la cuota calcula S y P de ambos tipos, lado a lado', () => {
    const r = resolver();
    const [vencida, anticipada] = r.filas;
    expect(vencida.tipo).toBe('vencida');
    expect(anticipada.tipo).toBe('anticipada');
    expect(fmt(anticipada.futuro)).toBe('6404664.02');
    expect(fmt(anticipada.presente)).toBe('5683814.12');
    expect(fmt(vencida.futuro)).toBe('6341251.51');
    expect(fmt(vencida.cuota)).toBe('500000.00');
    expect(r.tasaPeriodica.toFixed(8)).toBe('0.01000000');
    expect(r.pasos.map((p) => p.titulo)).toEqual(
      expect.arrayContaining(['Valor futuro (pagos vencidos)', 'Valor presente (pagos anticipados)']),
    );
  });

  it('criterio HU-19: con i = 0 muestra S = P = A·n sin error', () => {
    const r = resolver({ tasa: '0' });
    for (const fila of r.filas) {
      expect(fmt(fila.futuro)).toBe('6000000.00');
      expect(fmt(fila.presente)).toBe('6000000.00');
    }
    expect(r.pasos.find((p) => p.formula === 'S = A · n')).toBeDefined();
    expect(r.pasos.find((p) => p.formula === 'P = A · n')).toBeDefined();
  });

  it('calcula la cuota para una meta S (vencida y anticipada)', () => {
    const r = resolver({ objetivo: 'cuota-desde-s', valor: '6.404.664,02' });
    const [vencida, anticipada] = r.filas;
    expect(fmt(anticipada.cuota)).toBe('500000.00');
    expect(fmt(anticipada.futuro)).toBe('6404664.02');
    expect(vencida.cuota.gt(anticipada.cuota)).toBe(true); // la vencida necesita una cuota mayor
    expect(r.pasos.map((p) => p.formula)).toContain('A = S · i / [(1 + i)^n − 1] / (1 + i)');
  });

  it('calcula la cuota para un valor presente P (vencida y anticipada)', () => {
    const r = resolver({ objetivo: 'cuota-desde-p', valor: '5.683.814,12' });
    const [vencida, anticipada] = r.filas;
    expect(fmt(anticipada.cuota)).toBe('500000.00');
    expect(fmt(anticipada.presente)).toBe('5683814.12');
    expect(vencida.cuota.gt(anticipada.cuota)).toBe(true);
    expect(r.pasos.map((p) => p.formula)).toContain('A = P · i / [1 − (1 + i)^−n]');
  });

  it('con i = 0 la cuota es la meta (o el valor presente) entre n', () => {
    const desdeS = resolver({ objetivo: 'cuota-desde-s', valor: '6.000.000', tasa: '0' });
    const desdeP = resolver({ objetivo: 'cuota-desde-p', valor: '6.000.000', tasa: '0' });
    for (const fila of [...desdeS.filas, ...desdeP.filas]) {
      expect(fmt(fila.cuota)).toBe('500000.00');
    }
    expect(desdeS.pasos.find((p) => p.formula === 'A = S / n')).toBeDefined();
    expect(desdeP.pasos.find((p) => p.formula === 'A = P / n')).toBeDefined();
  });

  it('cada objetivo, con y sin interés, explica el cálculo de los dos tipos', () => {
    const objetivos: ObjetivoAnualidad[] = ['valores', 'cuota-desde-s', 'cuota-desde-p'];
    for (const objetivo of objetivos) {
      for (const tasa of ['0', '1']) {
        const r = resolver({ objetivo, tasa });
        const titulos = r.pasos.map((p) => p.titulo);
        expect(titulos.filter((t) => t.includes('pagos vencidos'))).toHaveLength(2);
        expect(titulos.filter((t) => t.includes('pagos anticipados'))).toHaveLength(2);
      }
    }
  });

  it('convierte una tasa nominal al periodo de pago', () => {
    const r = resolver({ tasa: '12', tipoTasa: 'nominal-vencida', frecuenciaTasa: 12 });
    expect(r.tasaPeriodica.toFixed(8)).toBe('0.01000000');
  });

  it('valida el valor según el objetivo', () => {
    expect(errores({ valor: '' }).valor).toContain('cuota (A)');
    expect(errores({ objetivo: 'cuota-desde-s', valor: '0' }).valor).toContain('valor futuro meta (S)');
    expect(errores({ objetivo: 'cuota-desde-p', valor: 'abc' }).valor).toContain('valor presente (P)');
  });

  it('valida el número de pagos: entero entre 1 y 360', () => {
    for (const malo of ['', '0', '361', '2,5', 'x']) {
      expect(errores({ n: malo }).n).toBe('El número de pagos debe ser un entero entre 1 y 360.');
    }
  });

  it('valida la tasa', () => {
    expect(errores({ tasa: '-2' }).tasa).toBe('La tasa debe estar entre 0 % y 100 %.');
  });

  it('rechaza un resultado mayor que el máximo del simulador', () => {
    const e = errores({ valor: '1.000.000.000.000', n: '360', tasa: '100', frecuenciaTasa: 1, frecuenciaPago: 1 });
    expect(e.general).toContain('supera $ 1.000.000.000.000');
  });
});
