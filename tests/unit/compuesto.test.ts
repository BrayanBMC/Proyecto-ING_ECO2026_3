import {
  PERIODOS_MAXIMOS,
  calcularCompuesto,
  calcularTasa,
  cuatroDecimales,
  dec,
  pasosDeTasa,
  periodosCompuesto,
  tasaCompuesta,
  validarTasaLibre,
  valorFuturo,
  valorPresente,
  type Dec,
  type FormularioCompuesto,
  type ResultadoCompuesto,
} from '../../src/core';
import { leerPositivo } from '../../src/core/comun';

const fmt = (x: Dec) => x.toFixed(2);

function form(extra: Partial<FormularioCompuesto> = {}): FormularioCompuesto {
  return {
    incognita: 'n',
    p: '1.000.000',
    s: '2.000.000',
    n: '12',
    tasa: '2',
    tipoTasa: 'efectiva',
    frecuenciaTasa: 12,
    frecuenciaPeriodo: 12,
    ...extra,
  };
}

function resolver(extra: Partial<FormularioCompuesto> = {}): ResultadoCompuesto {
  const r = calcularCompuesto(form(extra), fmt);
  if (!r.ok) {
    throw new Error(`Se esperaba un resultado y hubo errores: ${JSON.stringify(r.errores)}`);
  }
  return r.datos;
}

function errores(extra: Partial<FormularioCompuesto> = {}) {
  const r = calcularCompuesto(form(extra), fmt);
  if (r.ok) {
    throw new Error('Se esperaban errores');
  }
  return r.errores;
}

describe('core/compuesto: fórmulas (HU-18)', () => {
  it('S = P·(1+i)^n', () => {
    expect(valorFuturo(dec(1_000_000), dec('0.02'), dec(10)).toFixed(2)).toBe('1218994.42');
  });

  it('P = S/(1+i)^n deshace el valor futuro', () => {
    const s = valorFuturo(dec(1_000_000), dec('0.02'), dec(35));
    expect(valorPresente(s, dec('0.02'), dec(35)).minus(1_000_000).abs().lt('1e-20')).toBe(true);
  });

  it('i = (S/P)^(1/n) − 1 recupera la tasa usada', () => {
    const s = valorFuturo(dec(1_000_000), dec('0.02'), dec(10));
    expect(tasaCompuesta(dec(1_000_000), s, dec(10)).minus('0.02').abs().lt('1e-20')).toBe(true);
  });

  it('n = ln(S/P)/ln(1+i) con P = 1.000.000, S = 2.000.000, i = 2 %', () => {
    expect(cuatroDecimales(periodosCompuesto(dec(1_000_000), dec(2_000_000), dec('0.02')))).toBe('35,0028');
  });
});

describe('core/compuesto: calcularCompuesto (HU-18)', () => {
  it('criterio HU-18 (T10): al despejar n con P = 1.000.000, S = 2.000.000 e i = 2 % se ven 35,0028 periodos', () => {
    const r = resolver({ incognita: 'n' });
    expect(cuatroDecimales(r.valor)).toBe('35,0028');
    // Resultado fraccionario: se explica entre qué periodos enteros cae.
    const fraccion = r.pasos.find((p) => p.titulo === 'Resultado fraccionario');
    expect(fraccion?.sustitucion).toBe('35,0028 está entre 35 y 36 periodos');
    expect(fraccion?.resultado).toBe('Con 36 periodos completos ya se alcanza S');
  });

  it('criterio HU-18: con una tasa nominal la convierte con la fórmula compuesta, igual que el simulador', () => {
    // 24 % nominal vencida con capitalización mensual = 2 % mensual.
    const r = resolver({ incognita: 'S', n: '12', tasa: '24', tipoTasa: 'nominal-vencida' });
    expect(r.tasaPeriodica.toFixed(10)).toBe('0.0200000000');
    expect(r.ea.toFixed(10)).toBe('0.2682417946');
    expect(fmt(r.valor)).toBe('1268241.79');
    // Los mismos números que calcularTasa (la función del simulador).
    const simulador = calcularTasa({ valor: dec('0.24'), tipo: 'nominal-vencida', frecuenciaTasa: 12, frecuenciaPago: 12 });
    expect(r.ea.eq(simulador.ea)).toBe(true);
    // Incluye los pasos de conversión y el paso del valor futuro.
    expect(r.pasos.map((p) => p.titulo)).toContain('Valor futuro');
    expect(r.pasos.length).toBeGreaterThan(2);
  });

  it('despeja P con su fórmula y sus pasos', () => {
    const r = resolver({ incognita: 'P', s: '2.000.000', n: '35' });
    expect(fmt(r.valor)).toBe(fmt(valorPresente(dec(2_000_000), dec('0.02'), dec(35))));
    expect(r.pasos.at(-1)?.formula).toBe('P = S / (1 + i)^n');
  });

  it('despeja i y la convierte a EA y nominal anual', () => {
    const s = valorFuturo(dec(1_000_000), dec('0.02'), dec(10)).toFixed(10).replace('.', ',');
    const r = resolver({ incognita: 'i', s, n: '10' });
    expect(r.valor.toFixed(8)).toBe('0.02000000');
    expect(r.ea.toFixed(8)).toBe('0.26824179');
    expect(r.nominal.toFixed(8)).toBe('0.24000000');
    expect(r.pasos.map((p) => p.titulo)).toEqual(['Tasa por periodo', 'Tasa efectiva anual equivalente']);
  });

  it('con periodos anuales la tasa despejada ya es la EA y no agrega el paso de conversión', () => {
    const r = resolver({ incognita: 'i', s: '1.210.000', n: '2', frecuenciaPeriodo: 1 });
    expect(r.valor.toFixed(6)).toBe('0.100000');
    expect(r.pasos).toHaveLength(1);
  });

  it('con S = P los periodos son 0 y no se muestra paso fraccionario', () => {
    const r = resolver({ incognita: 'n', s: '1.000.000' });
    expect(r.valor.isZero()).toBe(true);
    expect(r.pasos.some((p) => p.titulo === 'Resultado fraccionario')).toBe(false);
  });

  it('con tasa 0 el valor futuro es igual al capital', () => {
    expect(fmt(resolver({ incognita: 'S', tasa: '0' }).valor)).toBe('1000000.00');
  });

  it('valida los campos que faltan según la incógnita', () => {
    expect(errores({ incognita: 'S', p: '', n: '', tasa: '' })).toEqual({
      p: expect.stringContaining('capital inicial'),
      n: expect.stringContaining('periodos'),
      tasa: 'La tasa debe estar entre 0 % y 100 %.',
    });
    expect(Object.keys(errores({ incognita: 'P', s: '' }))).toEqual(['s']);
    expect(Object.keys(errores({ incognita: 'n', p: '0', s: 'abc' })).sort()).toEqual(['p', 's']);
    expect(Object.keys(errores({ incognita: 'i', p: '', tasa: '' }))).toEqual(['p']);
  });

  it('rechaza más periodos que el máximo y periodos no positivos', () => {
    expect(errores({ incognita: 'S', n: String(PERIODOS_MAXIMOS + 1) }).n).toContain('hasta 1200');
    expect(errores({ incognita: 'S', n: '0' }).n).toContain('mayor que 0');
  });

  it('rechaza S menor que P al despejar n o i', () => {
    expect(errores({ incognita: 'n', s: '500.000' }).s).toContain('mayor o igual que P');
    expect(errores({ incognita: 'i', s: '500.000' }).s).toContain('mayor o igual que P');
  });

  it('con tasa 0 no se puede despejar n', () => {
    expect(errores({ incognita: 'n', tasa: '0' }).tasa).toContain('Con tasa 0');
  });

  it('rechaza un resultado mayor que el máximo del simulador', () => {
    const e = errores({ incognita: 'S', p: '1.000.000.000.000', n: '1200', tasa: '100', tipoTasa: 'efectiva', frecuenciaTasa: 1, frecuenciaPeriodo: 1 });
    expect(e.general).toContain('supera $ 1.000.000.000.000');
  });
});

describe('core/comun', () => {
  it('validarTasaLibre acepta 0 % y rechaza negativos, más de 100 % y texto', () => {
    expect(validarTasaLibre('0', 'efectiva', 12)).toBeNull();
    expect(validarTasaLibre('100', 'efectiva', 1)).toBeNull();
    for (const malo of ['-1', '100,01', 'abc', '']) {
      expect(validarTasaLibre(malo, 'efectiva', 12)).toBe('La tasa debe estar entre 0 % y 100 %.');
    }
  });

  it('validarTasaLibre exige j_a/m < 100 % con tasa anticipada', () => {
    expect(validarTasaLibre('100', 'nominal-anticipada', 1)).toContain('menor que 100 %');
    expect(validarTasaLibre('100', 'nominal-anticipada', 12)).toBeNull();
  });

  it('leerPositivo acepta (0, máximo] y rechaza el resto', () => {
    const maximo = dec(100);
    expect(leerPositivo('100', maximo)?.toString()).toBe('100');
    expect(leerPositivo('0', maximo)).toBeNull();
    expect(leerPositivo('101', maximo)).toBeNull();
    expect(leerPositivo('x', maximo)).toBeNull();
  });

  it('cuatroDecimales usa coma y siempre 4 decimales', () => {
    expect(cuatroDecimales(dec('35.00278'))).toBe('35,0028');
    expect(cuatroDecimales(dec(2))).toBe('2,0000');
  });

  it('pasosDeTasa copia la descripción, la sustitución y el valor', () => {
    const info = calcularTasa({ valor: dec('0.24'), tipo: 'nominal-vencida', frecuenciaTasa: 12, frecuenciaPago: 12 });
    const pasos = pasosDeTasa(info.pasos);
    expect(pasos).toHaveLength(info.pasos.length);
    expect(pasos[0]?.titulo).toBe(info.pasos[0]?.descripcion);
    expect(pasos[0]?.formula).toBe('');
  });
});
