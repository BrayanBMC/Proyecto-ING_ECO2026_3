import {
  compararSistemas,
  dec,
  generarTabla,
  validarGracia,
  validarSimulacion,
  type EscalaMonetaria,
  type Sistema,
  type TipoGracia,
} from '../../src/core';

/** Casos en los bordes del rango permitido: una sola cuota, gracia igual al plazo y la tabla más larga posible. */

const SISTEMAS: Sistema[] = ['frances', 'aleman'];
const ESCALAS: EscalaMonetaria[] = [0, 2];
const TIPOS_GRACIA: TipoGracia[] = ['muerta', 'intereses'];

describe('casos límite: un solo periodo (n = 1)', () => {
  it.each(SISTEMAS.flatMap((sistema) => ESCALAS.map((escala) => [sistema, escala] as const)))(
    '%s con escala %i: una cuota que paga el capital más el interés y deja el saldo en 0',
    (sistema, escala) => {
      const t = generarTabla({ capital: dec(1_000_000), tasa: dec('0.015'), plazo: 1, sistema, escala });
      expect(t.filas).toHaveLength(2); // fila 0 + una cuota
      const cuota = t.filas[1]!;
      expect(cuota.interes.toString()).toBe('15000');
      expect(cuota.abono.toString()).toBe('1000000');
      expect(cuota.cuota.toString()).toBe('1015000');
      expect(cuota.saldo.isZero()).toBe(true);
      expect(t.totalIntereses.toString()).toBe('15000');
      expect(t.totalPagado.toString()).toBe('1015000');
    },
  );

  it('con tasa 0 la única cuota es el capital y no hay intereses', () => {
    const t = generarTabla({ capital: dec(500_000), tasa: dec(0), plazo: 1, sistema: 'frances', escala: 0 });
    expect(t.filas[1]!.cuota.toString()).toBe('500000');
    expect(t.totalIntereses.isZero()).toBe(true);
  });

  it('con un monto de $ 1 y un solo periodo el saldo termina en 0', () => {
    const t = generarTabla({ capital: dec(1), tasa: dec('0.015'), plazo: 1, sistema: 'frances', escala: 0 });
    expect(t.filas.at(-1)!.saldo.isZero()).toBe(true);
    expect(t.filas.every((f) => f.saldo.gte(0))).toBe(true);
  });

  it('el comparador de sistemas no falla con un solo periodo y ambos sistemas coinciden', () => {
    const c = compararSistemas({ capital: dec(2_000_000), tasa: dec('0.02'), plazo: 1, escala: 0 });
    expect(c.frances.totalPagado.toString()).toBe(c.aleman.totalPagado.toString());
    expect(c.frances.totalIntereses.toString()).toBe(c.aleman.totalIntereses.toString());
  });

  it('el formulario acepta 1 cuota y rechaza 0', () => {
    const base = { monto: '1.000.000', frecuenciaPago: 12, tasa: '24', tipoTasa: 'nominal-vencida', frecuenciaTasa: 12, sistema: 'frances' } as const;
    expect(validarSimulacion({ ...base, plazo: '1' }).ok).toBe(true);
    expect(validarSimulacion({ ...base, plazo: '0' }).ok).toBe(false);
  });
});

describe('casos límite: gracia igual al plazo', () => {
  it.each(SISTEMAS.flatMap((sistema) => TIPOS_GRACIA.map((tipo) => [sistema, tipo] as const)))(
    '%s con gracia %s de 12 periodos y 12 cuotas: 24 filas, el saldo llega a 0 y lo abonado es el saldo al salir de la gracia',
    (sistema, tipo) => {
      const t = generarTabla({
        capital: dec(10_000_000),
        tasa: dec('0.015'),
        plazo: 12,
        sistema,
        escala: 0,
        gracia: { tipo, periodos: 12 },
      });
      expect(t.filas).toHaveLength(25); // fila 0 + 12 de gracia + 12 cuotas
      expect(t.filas.filter((f) => f.gracia)).toHaveLength(12);
      expect(t.filas.at(-1)!.saldo.isZero()).toBe(true);
      const saldoAlSalir = t.filas[12]!.saldo;
      const abonado = t.filas.slice(13).reduce((suma, f) => suma.plus(f.abono), dec(0));
      expect(abonado.toString()).toBe(saldoAlSalir.toString());
      if (tipo === 'muerta') {
        expect(saldoAlSalir.gt(10_000_000)).toBe(true);
      } else {
        expect(saldoAlSalir.toString()).toBe('10000000');
      }
    },
  );

  it('el máximo permitido (60 periodos de gracia y 360 cuotas) da 421 filas y cierra en 0 con ambos tipos', () => {
    for (const tipo of TIPOS_GRACIA) {
      const t = generarTabla({
        capital: dec(100_000_000),
        tasa: dec('0.01'),
        plazo: 360,
        sistema: 'frances',
        escala: 2,
        gracia: { tipo, periodos: 60 },
      });
      expect(t.filas).toHaveLength(421);
      expect(t.filas.at(-1)!.saldo.isZero()).toBe(true);
      expect(t.filas.every((f) => f.saldo.gte(0))).toBe(true);
    }
  });

  it('el formulario acepta 60 periodos de gracia y rechaza 61', () => {
    expect(validarGracia('60').ok).toBe(true);
    expect(validarGracia('61').ok).toBe(false);
    expect(validarGracia('').ok).toBe(true); // vacío cuenta como 0
  });
});

describe('casos límite: la tabla más larga (60 de gracia + 360 cuotas = 420 periodos)', () => {
  const entrada = {
    capital: dec(1_000_000_000_000),
    tasa: dec('0.0001'),
    plazo: 360,
    escala: 2 as EscalaMonetaria,
    gracia: { tipo: 'muerta' as TipoGracia, periodos: 60 },
  };

  it('se genera en un tiempo razonable (cota holgada: 2 segundos) en ambos sistemas', () => {
    for (const sistema of SISTEMAS) {
      const inicio = performance.now();
      const t = generarTabla({ ...entrada, sistema });
      const ms = performance.now() - inicio;
      expect(t.filas).toHaveLength(421);
      expect(ms, `${sistema}: ${ms.toFixed(0)} ms`).toBeLessThan(2000);
    }
  });

  it('la comparación Francés frente a Alemán de esa tabla también termina a tiempo', () => {
    const inicio = performance.now();
    const c = compararSistemas({ ...entrada });
    const ms = performance.now() - inicio;
    expect(c.frances.totalPagado.gt(0)).toBe(true);
    expect(ms, `${ms.toFixed(0)} ms`).toBeLessThan(4000);
  });
});
