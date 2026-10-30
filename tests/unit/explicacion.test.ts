import { calcularTasa, dec, explicarAmortizacion, generarTabla, numero, type Gracia, type Sistema } from '../../src/core';

const pesos = (x: { toString: () => string }) => `$${x.toString()}`;

function explicar(sistema: Sistema, extra: { gracia?: Gracia; tasa?: string; capital?: number; abono?: boolean } = {}) {
  const capital = dec(extra.capital ?? (sistema === 'frances' ? 10_000_000 : 12_000_000));
  const tasa = dec(extra.tasa ?? (sistema === 'frances' ? '0.015' : '0.01'));
  const gracia = extra.gracia ?? { tipo: 'muerta' as const, periodos: 0 };
  const tabla = generarTabla({
    capital,
    tasa,
    plazo: 12,
    sistema,
    escala: 0,
    gracia,
    abono: extra.abono ? { periodo: 1, valor: dec(1_000_000), modo: 'reducir-plazo' } : undefined,
  });
  return explicarAmortizacion({ capital, tasa, plazo: 12, sistema, gracia, tabla }, pesos);
}

describe('core/explicacion (HU-16)', () => {
  it('criterio HU-16: Francés T3b muestra fórmula, valores sustituidos y resultado de cada paso', () => {
    expect(explicar('frances')).toEqual([
      {
        titulo: 'Cuota fija (sistema Francés)',
        formula: 'R = P · i / (1 − (1 + i)^−n)',
        sustitucion: '$10000000 · 0,015 / (1 − (1 + 0,015)^−12)',
        resultado: '$916800',
      },
      { titulo: 'Interés del periodo 1', formula: 'I₁ = S₀ · i', sustitucion: '$10000000 · 0,015', resultado: '$150000' },
      {
        titulo: 'Abono a capital del periodo 1',
        formula: 'A₁ = R − I₁',
        sustitucion: '$916800 − $150000',
        resultado: '$766800',
      },
      { titulo: 'Saldo al final del periodo 1', formula: 'S₁ = S₀ − A₁', sustitucion: '$10000000 − $766800', resultado: '$9233200' },
    ]);
  });

  it('Alemán T4: abono fijo, interés y cuota del primer periodo', () => {
    const pasos = explicar('aleman');
    expect(pasos.map((p) => [p.formula, p.resultado])).toEqual([
      ['A = P / n', '$1000000'],
      ['I₁ = S₀ · i', '$120000'],
      ['R₁ = A + I₁', '$1120000'],
      ['S₁ = S₀ − A₁', '$11000000'],
    ]);
  });

  it('con gracia muerta T6 explica el saldo capitalizado y calcula la cuota sobre S₃', () => {
    const pasos = explicar('frances', { gracia: { tipo: 'muerta', periodos: 3 } });
    expect(pasos[0]).toEqual({
      titulo: 'Saldo al terminar la gracia (3 periodos sin pagar)',
      formula: 'S₃ = P · (1 + i)^3',
      sustitucion: '$10000000 · (1 + 0,015)^3',
      resultado: '$10456784 (redondeando el interés de cada periodo)',
    });
    expect(pasos[1]!.formula).toBe('R = S₃ · i / (1 − (1 + i)^−n)');
    expect(pasos[1]!.resultado).toBe('$958678');
    expect(pasos[2]!.titulo).toBe('Interés del periodo 4');
    expect(pasos[2]!.formula).toBe('I₄ = S₃ · i');
  });

  it('con gracia de intereses explica la cuota de solo intereses', () => {
    const pasos = explicar('frances', { gracia: { tipo: 'intereses', periodos: 3 } });
    expect(pasos[0]).toMatchObject({ formula: 'R = P · i', resultado: '$150000' });
    expect(pasos[1]!.formula).toBe('R = P · i / (1 − (1 + i)^−n)');
  });

  it('con tasa 0 usa R = P / n, y el abono extra aparece en el saldo', () => {
    expect(explicar('frances', { tasa: '0', capital: 1_200_000 })[0]).toMatchObject({
      titulo: 'Cuota fija (tasa 0)',
      formula: 'R = P / n',
      resultado: '$100000',
    });
    const conAbono = explicar('aleman', { abono: true });
    expect(conAbono.at(-1)!.formula).toBe('S₁ = S₀ − A₁ − abono extra');
    expect(conAbono.at(-1)!.sustitucion).toBe('$12000000 − $1000000 − $1000000');
  });

  it('subíndices de dos dígitos', () => {
    const pasos = explicar('frances', { gracia: { tipo: 'muerta', periodos: 12 } });
    expect(pasos[0]!.formula).toBe('S₁₂ = P · (1 + i)^12');
  });
});

describe('core/tasas: sustitución de valores (HU-16)', () => {
  it('nominal vencida: (1 + 0,02)^12 − 1', () => {
    const r = calcularTasa({ valor: dec('0.24'), tipo: 'nominal-vencida', frecuenciaTasa: 12, frecuenciaPago: 12 });
    expect(r.pasos.map((p) => p.sustitucion)).toEqual([
      '0,24 / 12',
      '(1 + 0,02)^12 − 1',
      `(1 + ${numero(r.ea)})^(1/12) − 1`,
    ]);
  });

  it('nominal anticipada: 0,075 / (1 − 0,075)', () => {
    const r = calcularTasa({ valor: dec('0.3'), tipo: 'nominal-anticipada', frecuenciaTasa: 4, frecuenciaPago: 12 });
    expect(r.pasos[1]!.sustitucion).toBe('0,075 / (1 − 0,075)');
  });

  it('efectiva anual con pago anual', () => {
    const r = calcularTasa({ valor: dec('0.2'), tipo: 'efectiva', frecuenciaTasa: 1, frecuenciaPago: 1 });
    expect(r.pasos.map((p) => p.sustitucion)).toEqual(['0,2', '0,2']);
    const m = calcularTasa({ valor: dec('0.015'), tipo: 'efectiva', frecuenciaTasa: 12, frecuenciaPago: 12 });
    expect(m.pasos[0]!.sustitucion).toBe('(1 + 0,015)^12 − 1');
  });

  it('numero redondea a 10 decimales y usa coma', () => {
    expect(numero(dec('0.268241794562545318'))).toBe('0,2682417946');
    expect(numero(dec(12))).toBe('12');
  });
});
