import { D, dec, redondearMonto } from '../../src/core';

describe('core/decimal: configuración del motor', () => {
  it('usa 34 dígitos significativos (decimal128)', () => {
    expect(D.precision).toBe(34);
    const tercio = dec(1).div(3).toString();
    // "0." seguido de 34 treses
    expect(tercio).toBe(`0.${'3'.repeat(34)}`);
  });

  it('suma 0,1 + 0,2 exactamente (donde double da 0.30000000000000004)', () => {
    expect(dec('0.1').plus('0.2').toString()).toBe('0.3');
    expect(0.1 + 0.2).not.toBe(0.3);
  });

  it('no usa notación científica al serializar valores pequeños o grandes', () => {
    expect(dec('0.000000000123').toString()).toBe('0.000000000123');
    expect(dec('1e25').toString()).toBe('10000000000000000000000000');
  });
});

describe('core/decimal: redondearMonto', () => {
  it('redondea al peso con ROUND_HALF_UP (como REDONDEAR de Excel)', () => {
    expect(redondearMonto(dec('916799.5'), 0).toString()).toBe('916800');
    expect(redondearMonto(dec('916799.49'), 0).toString()).toBe('916799');
    expect(redondearMonto(dec('2.5'), 0).toString()).toBe('3');
  });

  it('redondea los negativos alejándose de cero en el medio, como Excel', () => {
    expect(redondearMonto(dec('-2.5'), 0).toString()).toBe('-3');
  });

  it('redondea a centavos con escala 2', () => {
    expect(redondearMonto(dec('916799.924'), 2).toString()).toBe('916799.92');
    expect(redondearMonto(dec('0.005'), 2).toString()).toBe('0.01');
  });

  it('no modifica el valor original (inmutabilidad)', () => {
    const original = dec('10.555');
    redondearMonto(original, 2);
    expect(original.toString()).toBe('10.555');
  });
});
