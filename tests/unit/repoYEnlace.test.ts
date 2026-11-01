import { crearRepoInvitado, repoDeCuenta } from '../../src/adapters/repo/RepoSimulaciones';
import { PREFIJO_HASH, codificarEnlace, crearEnlace, decodificarEnlace } from '../../src/adapters/share/url';
import { LIMITE_GUARDADAS, calcularCredito, type ParametrosCredito, type SimulacionGuardada } from '../../src/core';
import { servicioFalso } from './servicioFalso';

function params(extra: Partial<ParametrosCredito> = {}): ParametrosCredito {
  return {
    monto: '10.000.000',
    plazo: '12',
    frecuenciaPago: 12,
    tasa: '1,5',
    tipoTasa: 'efectiva',
    frecuenciaTasa: 12,
    sistema: 'frances',
    graciaPeriodos: '3',
    graciaTipo: 'intereses',
    escala: 2,
    abono: { periodo: '5', valor: '2.000.000', modo: 'recalcular-cuota' },
    ...extra,
  };
}

/** Hash con cualquier contenido, como lo armaría alguien que altera el enlace a mano. */
function hashDe(json: string): string {
  return PREFIJO_HASH + btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

describe('adapters/share/url (HU-24)', () => {
  it('criterio HU-24: el enlace lleva los parámetros en el hash y al abrirlo se recuperan iguales', () => {
    const hash = codificarEnlace(params());
    expect(hash.startsWith('#c=')).toBe(true);
    expect(decodificarEnlace(hash)).toEqual({ ok: true, datos: params() });
  });

  it('no usa caracteres que rompan una URL (+, / ni =) y es estable', () => {
    const hash = codificarEnlace(params());
    expect(hash).toMatch(/^#c=[A-Za-z0-9_-]+$/);
    expect(codificarEnlace(params())).toBe(hash);
  });

  it('conserva los caracteres con tilde y ñ', () => {
    const p = params({ tasa: 'ñandú' });
    expect(decodificarEnlace(codificarEnlace(p))).toEqual({ ok: true, datos: p });
  });

  it('funciona también sin abono', () => {
    const p = params({ abono: null });
    expect(decodificarEnlace(codificarEnlace(p))).toEqual({ ok: true, datos: p });
  });

  it('crearEnlace arma la dirección completa con el origen y la ruta del simulador', () => {
    expect(crearEnlace('https://amortiza.example', params())).toBe(`https://amortiza.example/simulador${codificarEnlace(params())}`);
  });

  it('rechaza enlaces sin el prefijo, vacíos, demasiado largos o con basura', () => {
    const mensaje = { ok: false, errores: 'El enlace no es válido o está incompleto.' };
    expect(decodificarEnlace('')).toEqual(mensaje);
    expect(decodificarEnlace('#x=abc')).toEqual(mensaje);
    expect(decodificarEnlace('#c=!!!')).toEqual(mensaje);
    expect(decodificarEnlace('#c=' + 'A'.repeat(2000))).toEqual(mensaje);
    expect(decodificarEnlace(hashDe('esto no es json'))).toEqual(mensaje);
  });

  it('rechaza JSON con la forma equivocada', () => {
    expect(decodificarEnlace(hashDe('{"monto":"10.000.000"}')).ok).toBe(false);
    expect(decodificarEnlace(hashDe('[1,2,3]')).ok).toBe(false);
    expect(decodificarEnlace(hashDe('null')).ok).toBe(false);
  });

  it('rechaza bytes que no son UTF-8 válido', () => {
    const hash = PREFIJO_HASH + btoa(String.fromCharCode(0xff, 0xfe, 0xfd)).replace(/=+$/, '');
    expect(decodificarEnlace(hash).ok).toBe(false);
  });

  it('criterio HU-24: un enlace con valores fuera de rango pasa la forma pero NO produce un cálculo', () => {
    const leido = decodificarEnlace(codificarEnlace(params({ plazo: '400' })));
    expect(leido.ok).toBe(true);
    if (!leido.ok) {
      return;
    }
    const calculo = calcularCredito(leido.datos, (m) => m.toString());
    expect(calculo).toEqual({ ok: false, errores: 'El plazo debe ser un número entero de cuotas entre 1 y 360.' });
  });
});

describe('adapters/repo: modo invitado (HU-21, HU-23)', () => {
  function repoConReloj() {
    let ms = Date.UTC(2026, 10, 1, 12, 0, 0);
    return crearRepoInvitado(() => new Date((ms += 1000)));
  }

  it('guarda y lista, la más reciente primero', async () => {
    const repo = repoConReloj();
    const a = await repo.guardar('A', params());
    const b = await repo.guardar('B', params({ tasa: '2' }));
    expect(a.ok && b.ok).toBe(true);
    const lista = await repo.listar();
    expect(lista.ok && lista.datos.map((s) => s.nombre)).toEqual(['B', 'A']);
    expect(lista.ok && new Set(lista.datos.map((s) => s.id)).size).toBe(2);
    expect(lista.ok && lista.datos[1]?.parametros).toEqual(params());
  });

  it('renombrar cambia el nombre y sube la simulación al primer lugar', async () => {
    const repo = repoConReloj();
    const a = await repo.guardar('A', params());
    await repo.guardar('B', params());
    if (!a.ok) {
      throw new Error('no guardó');
    }
    expect(await repo.renombrar(a.datos.id, 'A2')).toEqual({ ok: true, datos: null });
    const lista = await repo.listar();
    expect(lista.ok && lista.datos.map((s) => s.nombre)).toEqual(['A2', 'B']);
  });

  it('criterio HU-21: borrar quita la simulación de la lista', async () => {
    const repo = repoConReloj();
    const a = await repo.guardar('A', params());
    if (!a.ok) {
      throw new Error('no guardó');
    }
    expect(await repo.borrar(a.datos.id)).toEqual({ ok: true, datos: null });
    const lista = await repo.listar();
    expect(lista.ok && lista.datos).toEqual([]);
  });

  it('renombrar o borrar una que no existe da un mensaje', async () => {
    const repo = repoConReloj();
    expect(await repo.renombrar('nada', 'X')).toEqual({ ok: false, mensaje: 'No encontramos esa simulación.' });
    expect(await repo.borrar('nada')).toEqual({ ok: false, mensaje: 'No encontramos esa simulación.' });
  });

  it('respeta el tope de simulaciones guardadas', async () => {
    const repo = repoConReloj();
    for (let k = 0; k < LIMITE_GUARDADAS; k++) {
      expect((await repo.guardar(`S${k}`, params())).ok).toBe(true);
    }
    const r = await repo.guardar('de más', params());
    expect(r).toEqual({ ok: false, mensaje: `Llegaste al límite de ${LIMITE_GUARDADAS} simulaciones. Borra alguna para guardar otra.` });
  });

  it('vaciar deja la sesión sin nada y usa el reloj real por defecto', async () => {
    const repo = crearRepoInvitado();
    await repo.guardar('A', params());
    repo.vaciar();
    const lista = await repo.listar();
    expect(lista.ok && lista.datos).toEqual([]);
  });
});

describe('adapters/repo: modo registrado (HU-21)', () => {
  const guardada: SimulacionGuardada = { id: 'u1', nombre: 'Mi crédito', parametros: params(), actualizadoEn: '2026-11-01T12:00:00.000Z' };

  it('listar y guardar entregan lo del servicio de cuentas', async () => {
    const servicio = servicioFalso({
      listarSimulaciones: vi.fn(async () => ({ ok: true as const, simulaciones: [guardada] })),
      guardarSimulacion: vi.fn(async () => ({ ok: true as const, simulacion: guardada })),
    });
    const repo = repoDeCuenta(servicio);
    expect(await repo.listar()).toEqual({ ok: true, datos: [guardada] });
    expect(await repo.guardar('Mi crédito', params())).toEqual({ ok: true, datos: guardada });
    expect(servicio.guardarSimulacion).toHaveBeenCalledWith('Mi crédito', params());
  });

  it('renombrar y borrar llaman al servicio con el id', async () => {
    const servicio = servicioFalso();
    const repo = repoDeCuenta(servicio);
    expect(await repo.renombrar('u1', 'Nuevo')).toEqual({ ok: true, datos: null });
    expect(await repo.borrar('u1')).toEqual({ ok: true, datos: null });
    expect(servicio.renombrarSimulacion).toHaveBeenCalledWith('u1', 'Nuevo');
    expect(servicio.borrarSimulacion).toHaveBeenCalledWith('u1');
  });

  it('los errores del servicio llegan tal cual', async () => {
    const falla = { ok: false as const, mensaje: 'Sin conexión.' };
    const repo = repoDeCuenta(
      servicioFalso({
        listarSimulaciones: vi.fn(async () => falla),
        guardarSimulacion: vi.fn(async () => falla),
        renombrarSimulacion: vi.fn(async () => falla),
        borrarSimulacion: vi.fn(async () => falla),
      }),
    );
    expect(await repo.listar()).toEqual(falla);
    expect(await repo.guardar('X', params())).toEqual(falla);
    expect(await repo.renombrar('u1', 'X')).toEqual(falla);
    expect(await repo.borrar('u1')).toEqual(falla);
  });
});
