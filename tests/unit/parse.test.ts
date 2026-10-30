import { parseNumeroEsCo } from '../../src/core';

describe('core/parse: parseNumeroEsCo (convención es-CO)', () => {
  it.each([
    ['10.000.000', '10000000'],
    ['10000000', '10000000'],
    ['1,5', '1.5'],
    ['1.234,56', '1234.56'],
    ['$ 1.000', '1000'],
    ['2,5 %', '2.5'],
    ['0,01', '0.01'],
    ['-3,25', '-3.25'],
    ['1\u00A0000', '1000'],
  ])('interpreta "%s" como %s', (entrada, esperado) => {
    expect(parseNumeroEsCo(entrada)?.toString()).toBe(esperado);
  });

  it.each([
    ['1.5'],
    ['1,2,3'],
    ['12.34.567'],
    ['abc'],
    [''],
    ['1e5'],
    ['--1'],
    [','],
  ])('rechaza "%s" en lugar de adivinar', (entrada) => {
    expect(parseNumeroEsCo(entrada)).toBeNull();
  });

  it('conserva todos los decimales sin pasar por double', () => {
    expect(parseNumeroEsCo('0,1234567890123456789')?.toString()).toBe('0.1234567890123456789');
  });
});
