import fc from 'fast-check';
import {
  MAX_PARTES,
  calcularReparto,
  dec,
  repartirMayorResiduo,
  type Dec,
  type EscalaMonetaria,
  type FormularioReparto,
  type MetodoReparto,
  type ResultadoReparto,
} from '../../src/core';

const fmt = (x: Dec) => x.toString();

function formulario(
  indices: readonly (string | [string, string])[],
  extra: Partial<FormularioReparto> = {},
): FormularioReparto {
  return {
    monto: '1.000.000',
    metodo: 'directo',
    escala: 0,
    filas: indices.map((i) => (typeof i === 'string' ? { nombre: '', x: i, y: '' } : { nombre: '', x: i[0], y: i[1] })),
    ...extra,
  };
}

function repartir(f: FormularioReparto): ResultadoReparto {
  const r = calcularReparto(f, fmt);
  if (!r.ok) {
    throw new Error(`Se esperaba un resultado y hubo errores: ${JSON.stringify(r.errores)}`);
  }
  return r.datos;
}

function errores(f: FormularioReparto) {
  const r = calcularReparto(f, fmt);
  if (r.ok) {
    throw new Error('Se esperaban errores');
  }
  return r.errores;
}

describe('core/reparto: método del mayor residuo (HU-20)', () => {
  it('criterio HU-20 (T11): M = 1.000.000 e índices (1, 1, 1) dan 333.334; 333.333; 333.333 y la suma es exacta', () => {
    const r = repartir(formulario(['1', '1', '1']));
    expect(r.partes.map((p) => fmt(p.monto))).toEqual(['333334', '333333', '333333']);
    expect(fmt(r.suma)).toBe('1000000');
    expect(r.unidades).toBe(1);
    expect(r.partes.map((p) => p.recibioExtra)).toEqual([true, false, false]);
  });

  it('con 2 decimales reparte centavos: 100 entre 3 da 33,34; 33,33; 33,33', () => {
    const r = repartir(formulario(['1', '1', '1'], { monto: '100', escala: 2 }));
    expect(r.partes.map((p) => p.monto.toFixed(2))).toEqual(['33.34', '33.33', '33.33']);
    expect(r.suma.toFixed(2)).toBe('100.00');
    expect(r.unidades).toBe(1);
  });

  it('los empates de residuo se resuelven por orden y el mayor residuo gana', () => {
    // 10 entre (1, 2, 2): exactos 2, 4, 4 → sin residuo.
    expect(repartir(formulario(['1', '2', '2'], { monto: '10' })).unidades).toBe(0);
    // 10 entre (1, 1, 1): exactos 3,33… cada uno; sobra 1 y va al primero.
    expect(repartir(formulario(['1', '1', '1'], { monto: '10' })).partes.map((p) => fmt(p.monto))).toEqual(['4', '3', '3']);
    // 11 entre (3, 3, 1): exactos 4,71; 4,71; 1,57 → sobran 2 para los dos primeros (residuo 0,71 > 0,57).
    expect(repartir(formulario(['3', '3', '1'], { monto: '11' })).partes.map((p) => fmt(p.monto))).toEqual(['5', '5', '1']);
  });

  it('reparto directo: un índice 0 recibe 0', () => {
    const r = repartir(formulario(['0', '1', '1'], { monto: '100' }));
    expect(r.partes.map((p) => fmt(p.monto))).toEqual(['0', '50', '50']);
  });

  it('reparto inverso: a mayor índice, menor parte (700 entre 1, 2 y 4 da 400, 200 y 100)', () => {
    const r = repartir(formulario(['1', '2', '4'], { monto: '700', metodo: 'inverso' }));
    expect(r.partes.map((p) => fmt(p.monto))).toEqual(['400', '200', '100']);
    expect(r.unidades).toBe(0);
    expect(r.pasos[0]?.formula).toBe('w_k = 1 / x_k');
    expect(r.pasos[0]?.sustitucion).toContain('w₂ = 1 / 2 = 0.5'.replace('.', ','));
    expect(r.pasos[2]?.resultado).toBe('No hizo falta ajustar: las partes ya suman el monto');
  });

  it('reparto inverso con pesos que no terminan (1/3) sigue sumando exacto', () => {
    const r = repartir(formulario(['3', '3', '3'], { monto: '100', metodo: 'inverso' }));
    expect(fmt(r.suma)).toBe('100');
    expect(r.partes.map((p) => fmt(p.monto))).toEqual(['34', '33', '33']);
  });

  it('reparto compuesto: proporcional al producto x·y (300 entre 2·3 y 1·3 da 200 y 100)', () => {
    const r = repartir(formulario([['2', '3'], ['1', '3']], { monto: '300', metodo: 'compuesto' }));
    expect(r.partes.map((p) => fmt(p.monto))).toEqual(['200', '100']);
    expect(r.partes.map((p) => fmt(p.peso))).toEqual(['6', '3']);
    expect(r.pasos[0]?.formula).toBe('w_k = x_k · y_k');
    expect(r.pasos[0]?.sustitucion).toContain('2 · 3 = 6');
  });

  it('compuesto con y = 1 se reduce al directo', () => {
    const compuesto = repartir(formulario([['1', '1'], ['2', '1'], ['4', '1']], { monto: '777', metodo: 'compuesto' }));
    const directo = repartir(formulario(['1', '2', '4'], { monto: '777' }));
    expect(compuesto.partes.map((p) => fmt(p.monto))).toEqual(directo.partes.map((p) => fmt(p.monto)));
  });

  it('usa "Parte k" cuando no hay nombre y recorta los espacios del nombre', () => {
    const f = formulario(['1', '1']);
    f.filas[1]!.nombre = '  Ana  ';
    expect(repartir(f).partes.map((p) => p.nombre)).toEqual(['Parte 1', 'Ana']);
  });
});

describe('core/reparto: validación (HU-20)', () => {
  it('criterio HU-20: un índice 0 en el reparto inverso muestra el error en ese índice', () => {
    const e = errores(formulario(['2', '0', '4'], { metodo: 'inverso' }));
    expect(e.filas[0]).toEqual({});
    expect(e.filas[1]?.x).toContain('Parte 2');
    expect(e.filas[1]?.x).toContain('mayor que 0');
    expect(e.filas[2]).toEqual({});
  });

  it('rechaza índices negativos, vacíos o con texto, indicando la parte', () => {
    const e = errores(formulario(['-1', '', 'abc']));
    expect(e.filas[0]?.x).toContain('Parte 1');
    expect(e.filas[1]?.x).toContain('Parte 2');
    expect(e.filas[2]?.x).toContain('Parte 3');
  });

  it('rechaza un índice mayor que el máximo', () => {
    expect(errores(formulario(['1.000.000.000.001', '1'])).filas[0]?.x).toContain('entre 0 y 1.000.000.000.000');
  });

  it('el reparto compuesto valida también el segundo índice', () => {
    const e = errores(formulario([['1', ''], ['2', '-1']], { metodo: 'compuesto' }));
    expect(e.filas[0]?.y).toContain('segundo índice');
    expect(e.filas[1]?.y).toContain('Parte 2');
  });

  it('rechaza que todos los índices sean 0 (la suma debe ser mayor que 0)', () => {
    expect(errores(formulario(['0', '0'])).general).toBe('La suma de los índices debe ser mayor que 0.');
    expect(errores(formulario([['0', '5'], ['3', '0']], { metodo: 'compuesto' })).general).toBe(
      'La suma de los productos x · y debe ser mayor que 0.',
    );
  });

  it('valida el monto y su relación con los decimales', () => {
    expect(errores(formulario(['1', '1'], { monto: '' })).monto).toContain('Escribe el monto');
    expect(errores(formulario(['1', '1'], { monto: '0' })).monto).toContain('Escribe el monto');
    expect(errores(formulario(['1', '1'], { monto: '100,5' })).monto).toBe('Con 0 decimales el monto debe ser un número entero.');
    expect(errores(formulario(['1', '1'], { monto: '100,555', escala: 2 })).monto).toBe(
      'Con 2 decimales el monto no puede tener más de 2 decimales.',
    );
    expect(repartir(formulario(['1', '1'], { monto: '100,55', escala: 2 })).suma.toFixed(2)).toBe('100.55');
  });

  it('exige entre 2 y 20 partes', () => {
    expect(errores(formulario(['1'])).general).toBe('Reparte entre 2 y 20 partes.');
    const muchas = Array.from({ length: MAX_PARTES + 1 }, () => '1');
    expect(errores(formulario(muchas)).general).toBe('Reparte entre 2 y 20 partes.');
    expect(repartir(formulario(Array.from({ length: MAX_PARTES }, () => '1'), { monto: '1.000' })).suma.toString()).toBe('1000');
  });
});

describe('core/reparto: propiedad Σ partes = M', () => {
  const escalas: EscalaMonetaria[] = [0, 2];
  const metodos: MetodoReparto[] = ['directo', 'inverso'];

  it('repartirMayorResiduo suma exactamente el monto y cada parte está a menos de una unidad de la exacta', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000_000 }),
        fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 2, maxLength: 20 }),
        fc.constantFrom(...escalas),
        (centavos, indices, escala) => {
          const monto = escala === 2 ? dec(centavos).div(100) : dec(centavos);
          const pesos = indices.map((x) => dec(x));
          const r = repartirMayorResiduo(monto, pesos, escala);
          const unidad = escala === 2 ? dec('0.01') : dec(1);
          const suma = r.montos.reduce((a, m) => a.plus(m), dec(0));
          expect(suma.eq(monto)).toBe(true);
          r.montos.forEach((m, k) => {
            expect(m.gte(0)).toBe(true);
            expect(m.minus(r.exactos[k]!).abs().lt(unidad)).toBe(true);
          });
        },
      ),
      { numRuns: 200 },
    );
  }, 60_000);

  it('calcularReparto suma exactamente el monto en los métodos directo e inverso', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000_000 }),
        fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 2, maxLength: 20 }),
        fc.constantFrom(...metodos),
        fc.constantFrom(...escalas),
        (centavos, indices, metodo, escala) => {
          const monto = escala === 2 ? dec(centavos).div(100) : dec(centavos);
          const f = formulario(indices.map(String), { monto: monto.toFixed(escala).replace('.', ','), metodo, escala });
          const r = repartir(f);
          expect(r.suma.eq(monto)).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  }, 60_000);
});
