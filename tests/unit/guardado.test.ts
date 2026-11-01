import {
  LIMITE_GUARDADAS,
  MAX_COMPARAR,
  calcularCredito,
  dec,
  indiceMenorCosto,
  leerParametros,
  nombreAutomatico,
  resumirCredito,
  validarNombreSimulacion,
  type CreditoCalculado,
  type Dec,
  type ParametrosCredito,
  type ResumenCredito,
} from '../../src/core';

const fmt = (x: Dec) => x.toFixed(0);

/** 10.000.000 al 1,5 % efectivo mensual en 12 cuotas (caso T3). */
function base(extra: Partial<ParametrosCredito> = {}): ParametrosCredito {
  return {
    monto: '10.000.000',
    plazo: '12',
    frecuenciaPago: 12,
    tasa: '1,5',
    tipoTasa: 'efectiva',
    frecuenciaTasa: 12,
    sistema: 'frances',
    graciaPeriodos: '',
    graciaTipo: 'muerta',
    escala: 0,
    abono: null,
    ...extra,
  };
}

function calcular(extra: Partial<ParametrosCredito> = {}): CreditoCalculado {
  const r = calcularCredito(base(extra), fmt);
  if (!r.ok) {
    throw new Error(`Se esperaba un cálculo y hubo un error: ${r.errores}`);
  }
  return r.datos;
}

function mensaje(extra: Partial<ParametrosCredito>): string {
  const r = calcularCredito(base(extra), fmt);
  if (r.ok) {
    throw new Error('Se esperaba un error');
  }
  return r.errores;
}

describe('core/guardado: leerParametros (forma de lo que llega de la base de datos o de un enlace)', () => {
  it('acepta parámetros válidos sin cambiarlos', () => {
    const r = leerParametros(base());
    expect(r).toEqual({ ok: true, datos: base() });
  });

  it('acepta un abono bien formado y trata un abono ausente como null', () => {
    const conAbono = base({ abono: { periodo: '3', valor: '2.000.000', modo: 'reducir-plazo' } });
    expect(leerParametros(conAbono)).toEqual({ ok: true, datos: conAbono });
    const { abono: _omitido, ...sinAbono } = base();
    void _omitido;
    expect(leerParametros(sinAbono)).toEqual({ ok: true, datos: base() });
  });

  it('descarta campos que no son parte de la simulación', () => {
    const r = leerParametros({ ...base(), intruso: 'x' });
    expect(r.ok && 'intruso' in r.datos).toBe(false);
  });

  it('rechaza lo que no es un objeto', () => {
    for (const malo of [null, undefined, 'texto', 5, true]) {
      expect(leerParametros(malo)).toEqual({ ok: false, errores: 'Los datos de la simulación no son válidos.' });
    }
  });

  it('rechaza campos con tipo o valor inválido', () => {
    const malos: Record<string, unknown>[] = [
      { monto: 10_000_000 },
      { plazo: null },
      { tasa: undefined },
      { graciaPeriodos: 3 },
      { frecuenciaPago: 7 },
      { frecuenciaTasa: '12' },
      { tipoTasa: 'otra' },
      { sistema: 'americano' },
      { graciaTipo: 'larga' },
      { escala: 1 },
      { monto: 'x'.repeat(41) },
    ];
    for (const cambio of malos) {
      expect(leerParametros({ ...base(), ...cambio }).ok).toBe(false);
    }
  });

  it('rechaza un abono mal formado', () => {
    const malos: unknown[] = [
      'abono',
      { periodo: 3, valor: '1', modo: 'reducir-plazo' },
      { periodo: '3', valor: 1, modo: 'reducir-plazo' },
      { periodo: '3', valor: '1', modo: 'otro' },
    ];
    for (const abono of malos) {
      expect(leerParametros({ ...base(), abono }).ok).toBe(false);
    }
  });
});

describe('core/guardado: calcularCredito', () => {
  it('recalcula el mismo crédito del simulador (T3: cuota 916.800, EA 19,5618 %)', () => {
    const c = calcular();
    const r = resumirCredito(c);
    expect(r.cuota.toString()).toBe('916800');
    expect(r.ea.toFixed(6)).toBe('0.195618');
    expect(r.totalPagado.minus(r.totalIntereses).toString()).toBe('10000000');
    expect(r.rho.toFixed(6)).toBe(r.totalIntereses.div(10_000_000).toFixed(6));
    expect(c.tabla).toBe(c.base); // sin abono, la tabla que se muestra es la base
    expect(c.tabla.filas).toHaveLength(13);
  });

  it('con gracia usa la primera cuota de amortización, no la de gracia', () => {
    const r = resumirCredito(calcular({ graciaPeriodos: '3', graciaTipo: 'muerta' }));
    expect(r.cuota.toString()).toBe('958678'); // T6
  });

  it('el Alemán da un abono fijo', () => {
    const c = calcular({ sistema: 'aleman' });
    expect(resumirCredito(c).cuota.toString()).toBe('983333'); // 833.333 de capital + 150.000 de interés
  });

  it('un abono extraordinario cambia la tabla y baja los intereses', () => {
    const sin = calcular();
    const con = calcular({ abono: { periodo: '3', valor: '2.000.000', modo: 'reducir-plazo' } });
    expect(con.abono?.periodo).toBe(3);
    expect(con.abono?.valor.toString()).toBe('2000000');
    expect(con.tabla).not.toBe(con.base);
    expect(con.tabla.totalIntereses.lt(sin.tabla.totalIntereses)).toBe(true);
    expect(con.tabla.filas.length).toBeLessThan(sin.tabla.filas.length);
  });

  it('criterio HU-24: valores fuera de rango no producen cálculo, producen el mensaje de validación', () => {
    expect(mensaje({ monto: '0' })).toBe('El monto debe estar entre $ 1 y $ 1.000.000.000.000.');
    expect(mensaje({ plazo: '361' })).toBe('El plazo debe ser un número entero de cuotas entre 1 y 360.');
    expect(mensaje({ tasa: '101' })).toBe('La tasa debe estar entre 0,01 % y 100 %.');
    expect(mensaje({ graciaPeriodos: '61' })).toBe('Los periodos de gracia deben ser un número entero entre 0 y 60.');
  });

  it('si fallan varios campos, devuelve el primero (monto, plazo, tasa)', () => {
    expect(mensaje({ monto: '', plazo: '0', tasa: '0' })).toContain('monto');
  });

  it('valida el abono con las reglas del simulador', () => {
    expect(mensaje({ abono: { periodo: '99', valor: '1.000', modo: 'reducir-plazo' } })).toContain('El abono va al final de un periodo');
    expect(mensaje({ abono: { periodo: '3', valor: '999.999.999', modo: 'recalcular-cuota' } })).toContain('supera el saldo');
    expect(mensaje({ abono: { periodo: '3', valor: '0', modo: 'recalcular-cuota' } })).toBe('Escribe un abono mayor que $ 0.');
  });
});

function resumenConIntereses(intereses: number): ResumenCredito {
  return { cuota: dec(1), ea: dec('0.1'), totalIntereses: dec(intereses), totalPagado: dec(intereses + 100), rho: dec(intereses).div(100) };
}

describe('core/guardado: comparación (HU-23)', () => {
  it('el menor costo es la simulación con menos intereses totales', () => {
    expect(indiceMenorCosto([resumenConIntereses(100), resumenConIntereses(50), resumenConIntereses(70)])).toBe(1);
    expect(indiceMenorCosto([resumenConIntereses(30), resumenConIntereses(50)])).toBe(0);
  });

  it('con empate gana la primera y con una sola simulación es ella', () => {
    expect(indiceMenorCosto([resumenConIntereses(50), resumenConIntereses(50)])).toBe(0);
    expect(indiceMenorCosto([resumenConIntereses(9)])).toBe(0);
  });

  it('el comparador admite hasta 3 simulaciones y el tope guardado es 50', () => {
    expect(MAX_COMPARAR).toBe(3);
    expect(LIMITE_GUARDADAS).toBe(50);
  });

  it('un crédito más barato resulta con menor costo al compararlo (1 % frente a 2 %)', () => {
    const barato = resumirCredito(calcular({ tasa: '1' }));
    const caro = resumirCredito(calcular({ tasa: '2' }));
    expect(indiceMenorCosto([caro, barato])).toBe(1);
  });
});

describe('core/guardado: nombres', () => {
  it('recorta los espacios y acepta de 1 a 60 caracteres', () => {
    expect(validarNombreSimulacion('  Mi crédito  ')).toEqual({ ok: true, datos: 'Mi crédito' });
    expect(validarNombreSimulacion('a'.repeat(60)).ok).toBe(true);
  });

  it('rechaza vacío, solo espacios y más de 60', () => {
    const mensajeEsperado = { ok: false, errores: 'El nombre debe tener entre 1 y 60 caracteres.' };
    expect(validarNombreSimulacion('')).toEqual(mensajeEsperado);
    expect(validarNombreSimulacion('   ')).toEqual(mensajeEsperado);
    expect(validarNombreSimulacion('a'.repeat(61))).toEqual(mensajeEsperado);
  });

  it('el nombre automático lleva la fecha local', () => {
    expect(nombreAutomatico(new Date(2026, 10, 1, 9, 30))).toBe('Simulación 2026-11-01');
  });
});
