import { validarMonto, validarPlazo, validarSimulacion, validarTasa, type FormularioSimulacion } from '../../src/core';

const VALIDO: FormularioSimulacion = {
  monto: '10.000.000',
  plazo: '12',
  frecuenciaPago: 12,
  tasa: '24',
  tipoTasa: 'nominal-vencida',
  frecuenciaTasa: 12,
  sistema: 'frances',
};

describe('core/simulador: validación (HU-07, HU-08, HU-09)', () => {
  it('acepta datos válidos y convierte la tasa a decimal', () => {
    const r = validarSimulacion(VALIDO);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.datos.monto.toString()).toBe('10000000');
      expect(r.datos.plazo).toBe(12);
      expect(r.datos.tasa.toString()).toBe('0.24');
    }
  });

  it('criterio HU-07: monto 0 y plazo 361 muestran el rango permitido', () => {
    expect(validarMonto('0')).toBe('El monto debe estar entre $ 1 y $ 1.000.000.000.000.');
    expect(validarPlazo('361')).toBe('El plazo debe ser un número entero de cuotas entre 1 y 360.');
    const r = validarSimulacion({ ...VALIDO, monto: '0', plazo: '361' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.errores).sort()).toEqual(['monto', 'plazo']);
    }
  });

  it('rechaza monto mal escrito, plazo decimal o vacío', () => {
    expect(validarMonto('1.5')).toBe('Escribe el monto en pesos, por ejemplo 10.000.000.');
    expect(validarMonto('1.000.000.000.001')).toBe('El monto debe estar entre $ 1 y $ 1.000.000.000.000.');
    expect(validarPlazo('12,5')).not.toBeNull();
    expect(validarPlazo('')).not.toBeNull();
    expect(validarPlazo('360')).toBeNull();
    expect(validarMonto('1')).toBeNull();
  });

  it('criterio HU-08: tasa fuera de 0,01-100 % da error en el campo', () => {
    expect(validarTasa('0', 'efectiva', 1)).toBe('La tasa debe estar entre 0,01 % y 100 %.');
    expect(validarTasa('100,5', 'efectiva', 1)).toBe('La tasa debe estar entre 0,01 % y 100 %.');
    expect(validarTasa('abc', 'efectiva', 1)).not.toBeNull();
    expect(validarTasa('0,01', 'efectiva', 1)).toBeNull();
    const r = validarSimulacion({ ...VALIDO, tasa: '101' });
    expect(!r.ok && r.errores.tasa).toBe('La tasa debe estar entre 0,01 % y 100 %.');
  });

  it('criterio HU-09: con tasa anticipada j_a/m ≥ 1 da error', () => {
    expect(validarTasa('100', 'nominal-anticipada', 1)).toBe(
      'Con tasa anticipada, la tasa del periodo (j_a / m) debe ser menor que 100 %.',
    );
    expect(validarTasa('100', 'nominal-anticipada', 2)).toBeNull();
    expect(validarTasa('30', 'nominal-anticipada', 4)).toBeNull();
  });
});
