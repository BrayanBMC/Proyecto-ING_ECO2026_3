import { parseNumeroEsCo, validarTasa } from '../../src/core';

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
    ['1.5', '1.5'],
    ['0.05', '0.05'],
    ['12.75', '12.75'],
    ['1.50', '1.5'],
    ['24.5 %', '24.5'],
    ['$ 2.5', '2.5'],
    ['-1.5', '-1.5'],
    ['0.500', '0.5'],
    ['-0.250', '-0.25'],
    ['1,234.56', '1234.56'],
    ['10,000,000.5', '10000000.5'],
  ])('entiende el punto como decimal en "%s" (= %s) sin que el usuario tenga que corregirlo', (entrada, esperado) => {
    expect(parseNumeroEsCo(entrada)?.toString()).toBe(esperado);
  });

  it.each([
    ['1.500', '1500'],
    ['10.000', '10000'],
    ['1.000.000', '1000000'],
    ['1.234.567,89', '1234567.89'],
  ])('un punto seguido de 3 dígitos sigue siendo separador de miles: "%s" = %s', (entrada, esperado) => {
    expect(parseNumeroEsCo(entrada)?.toString()).toBe(esperado);
  });

  it.each([
    ['1,2,3'],
    ['12.34.567'],
    ['1.2.3'],
    ['1,234,567'],
    ['abc'],
    [''],
    ['1e5'],
    ['--1'],
    [','],
    ['.'],
    ['.5'],
    ['1.'],
    ['1.5,5'],
  ])('rechaza "%s" en lugar de adivinar', (entrada) => {
    expect(parseNumeroEsCo(entrada)).toBeNull();
  });

  it('conserva todos los decimales sin pasar por double', () => {
    expect(parseNumeroEsCo('0,1234567890123456789')?.toString()).toBe('0.1234567890123456789');
    expect(parseNumeroEsCo('0.1234567890123456789')?.toString()).toBe('0.1234567890123456789');
  });

  it('una tasa escrita con punto se valida igual que con coma', () => {
    expect(validarTasa('1.5', 'efectiva', 12)).toBeNull();
    expect(validarTasa('1,5', 'efectiva', 12)).toBeNull();
    expect(validarTasa('101.5', 'efectiva', 12)).toBe('La tasa debe estar entre 0,01 % y 100 %.');
  });
});
