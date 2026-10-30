import fc from 'fast-check';
import {
  D,
  compararGracias,
  cuotasRestantes,
  dec,
  generarTabla,
  validarAbono,
  validarGracia,
  type Sistema,
} from '../../src/core';

const s = (x: { toString: () => string }) => x.toString();
const credito = { capital: dec(10_000_000), tasa: dec('0.015'), plazo: 12, sistema: 'frances' as Sistema, escala: 0 as const };
const T4 = { capital: dec(12_000_000), tasa: dec('0.01'), plazo: 12, sistema: 'aleman' as Sistema, escala: 0 as const };

describe('HU-12: gracia muerta', () => {
  it('T6 y criterio HU-12: g = 3, las filas 1-3 tienen cuota 0 y el saldo crece con el interés', () => {
    const t = generarTabla({ ...credito, gracia: { tipo: 'muerta', periodos: 3 } });
    const gracia = t.filas.slice(1, 4);
    expect(gracia.map((f) => s(f.cuota))).toEqual(['0', '0', '0']);
    expect(gracia.map((f) => s(f.interes))).toEqual(['150000', '152250', '154534']);
    expect(gracia.every((f) => f.gracia)).toBe(true);
    expect(s(t.filas[3]!.saldo)).toBe('10456784');
    expect(s(t.filas[4]!.cuota)).toBe('958678');
    expect(t.filas).toHaveLength(16); // fila 0 + 3 de gracia + 12 cuotas
    expect(t.filas.at(-1)!.saldo.isZero()).toBe(true);
    // Lo pagado de más sobre el capital son exactamente los intereses.
    expect(s(t.totalPagado.minus(t.totalIntereses))).toBe('10000000');
  });

  it('validarGracia: vacío es 0, acepta 0-60 y rechaza 61, decimales y texto', () => {
    expect(validarGracia('')).toEqual({ ok: true, datos: 0 });
    expect(validarGracia('60')).toEqual({ ok: true, datos: 60 });
    for (const malo of ['61', '2,5', 'abc', '-1']) {
      expect(validarGracia(malo)).toEqual({ ok: false, errores: 'Los periodos de gracia deben ser un número entero entre 0 y 60.' });
    }
  });
});

describe('HU-13: gracia con pago de intereses', () => {
  it('T7 y criterio HU-13: las cuotas 1-3 son el interés, el saldo no cambia y luego la cuota es 916.800', () => {
    const t = generarTabla({ ...credito, gracia: { tipo: 'intereses', periodos: 3 } });
    expect(t.filas.slice(1, 4).map((f) => s(f.cuota))).toEqual(['150000', '150000', '150000']);
    expect(t.filas.slice(0, 4).every((f) => s(f.saldo) === '10000000')).toBe(true);
    expect(s(t.filas[4]!.cuota)).toBe('916800');
  });

  it('criterio HU-13: la gracia muerta cuesta más intereses y se ve la diferencia', () => {
    const c = compararGracias({ ...credito, periodos: 3 });
    expect(c.diferencia.gt(0)).toBe(true);
    expect(s(c.muerta.minus(c.conIntereses))).toBe(s(c.diferencia));
  });
});

describe('HU-14: abono extraordinario', () => {
  it('T8 recálculo de cuota: Alemán con E = 2.000.000 al cierre del periodo 2 → A = 800.000, R₃ = 880.000, 10 cuotas restantes', () => {
    const t = generarTabla({ ...T4, abono: { periodo: 2, valor: dec(2_000_000), modo: 'recalcular-cuota' } });
    expect(s(t.filas[2]!.extra)).toBe('2000000');
    expect(s(t.filas[2]!.saldo)).toBe('8000000');
    expect(s(t.filas[3]!.abono)).toBe('800000');
    expect(s(t.filas[3]!.cuota)).toBe('880000');
    expect(t.filas).toHaveLength(13);
    expect(t.filas.at(-1)!.saldo.isZero()).toBe(true);
  });

  it('T8 reducción de plazo y criterio HU-14: misma cuota, menos filas (10 en total) y saldo final 0', () => {
    const t = generarTabla({ ...T4, abono: { periodo: 2, valor: dec(2_000_000), modo: 'reducir-plazo' } });
    expect(t.filas.slice(3).every((f) => s(f.abono) === '1000000')).toBe(true);
    expect(t.filas).toHaveLength(11); // fila 0 + 10 cuotas
    expect(t.filas.at(-1)!.saldo.isZero()).toBe(true);
    // T_P = Σ cuotas + Σ abonos extra; lo que se paga de más son los intereses.
    expect(s(t.totalPagado.minus(t.totalIntereses))).toBe('12000000');
  });

  it('Francés con reducción de plazo: la cuota se mantiene y el plazo baja', () => {
    const sin = generarTabla(credito);
    const con = generarTabla({ ...credito, abono: { periodo: 3, valor: dec(2_000_000), modo: 'reducir-plazo' } });
    expect(con.filas.length).toBeLessThan(sin.filas.length);
    for (const fila of con.filas.slice(4, -1)) {
      expect(s(fila.cuota)).toBe('916800');
    }
    expect(con.filas.at(-1)!.cuota.lte(916810)).toBe(true); // última cuota parcial (± redondeo)
    expect(con.filas.at(-1)!.saldo.isZero()).toBe(true);
    expect(con.totalIntereses.lt(sin.totalIntereses)).toBe(true);
  });

  it('Francés con recálculo de cuota: el plazo se mantiene y la cuota baja', () => {
    const con = generarTabla({ ...credito, abono: { periodo: 3, valor: dec(2_000_000), modo: 'recalcular-cuota' } });
    expect(con.filas).toHaveLength(13);
    expect(con.filas[4]!.cuota.lt(916800)).toBe(true);
  });

  it('con tasa 0 la reducción de plazo usa ⌈S/R⌉', () => {
    const t = generarTabla({
      capital: dec(1_200_000),
      tasa: dec(0),
      plazo: 12,
      sistema: 'frances',
      escala: 0,
      abono: { periodo: 1, valor: dec(300_000), modo: 'reducir-plazo' },
    });
    expect(t.filas).toHaveLength(10); // 1 cuota + abono, quedan 800.000 / 100.000 = 8 cuotas
  });

  it('si el abono es todo el saldo, el crédito termina en ese periodo', () => {
    const t = generarTabla({ ...T4, abono: { periodo: 2, valor: dec(10_000_000), modo: 'reducir-plazo' } });
    expect(t.filas).toHaveLength(3);
    expect(t.filas.at(-1)!.saldo.isZero()).toBe(true);
  });

  it('cuotasRestantes avisa si la cuota no cubre el interés', () => {
    expect(() => cuotasRestantes(dec(1000), dec('0.1'), dec(50), 'frances')).toThrow(
      'La cuota no alcanza a cubrir el interés del saldo.',
    );
    expect(cuotasRestantes(dec(8_000_000), dec('0.01'), dec(1_000_000), 'aleman')).toBe(8);
  });

  it('propiedad: con cualquier abono válido el saldo cierra en 0, Σ abonos = P y los intereses no suben', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 120 }),
        fc.integer({ min: 0, max: 30000 }),
        fc.constantFrom<Sistema>('frances', 'aleman'),
        fc.constantFrom('recalcular-cuota' as const, 'reducir-plazo' as const),
        fc.double({ min: 0.01, max: 1, noNaN: true }),
        (plazo, tasa, sistema, modo, fraccion) => {
          const base = { capital: dec(50_000_000), tasa: dec(tasa).div(1_000_000), plazo, sistema, escala: 0 as const };
          const sin = generarTabla(base);
          const periodo = Math.max(1, Math.floor(plazo / 2));
          const valor = sin.filas[periodo]!.saldo.times(fraccion.toFixed(4)).floor();
          if (valor.lte(0)) {
            return true;
          }
          const con = generarTabla({ ...base, abono: { periodo, valor, modo } });
          const sumaAbonos = con.filas.reduce((suma, f) => suma.plus(f.abono).plus(f.extra), new D(0));
          return (
            con.filas.at(-1)!.saldo.isZero() &&
            con.filas.every((f) => f.saldo.gte(0)) &&
            sumaAbonos.eq(50_000_000) &&
            con.totalIntereses.lte(sin.totalIntereses)
          );
        },
      ),
      { numRuns: 150 },
    );
  }, 60_000);
});

describe('HU-14: validarAbono', () => {
  const sin = generarTabla(T4);
  const base = { saldos: sin.filas.map((f) => f.saldo), gracia: 0, plazo: 12, formatear: (m: { toString: () => string }) => `$ ${s(m)}` };

  it('criterio HU-14: un abono mayor que el saldo del periodo da error con el saldo', () => {
    expect(validarAbono({ ...base, periodo: '5', valor: '8.000.001' })).toEqual({
      ok: false,
      errores: { valor: 'El abono supera el saldo del periodo 5 ($ 7000000).' },
    });
  });

  it('acepta un abono válido', () => {
    const r = validarAbono({ ...base, periodo: '2', valor: '2.000.000' });
    expect(r.ok && r.datos.periodo).toBe(2);
  });

  it('rechaza periodos fuera de la amortización, abonos en 0 y créditos de una cuota', () => {
    expect(validarAbono({ ...base, periodo: '12', valor: '1' })).toEqual({
      ok: false,
      errores: { periodo: 'El abono va al final de un periodo entre 1 y 11.' },
    });
    expect(validarAbono({ ...base, gracia: 3, periodo: '2', valor: '1' })).toEqual({
      ok: false,
      errores: { periodo: 'El abono va al final de un periodo entre 4 y 14.' },
    });
    expect(validarAbono({ ...base, periodo: '2', valor: '0' })).toEqual({
      ok: false,
      errores: { valor: 'Escribe un abono mayor que $ 0.' },
    });
    expect(validarAbono({ ...base, plazo: 1, periodo: '1', valor: '1' })).toEqual({
      ok: false,
      errores: { periodo: 'Con una sola cuota no se puede hacer un abono extraordinario.' },
    });
  });
});
