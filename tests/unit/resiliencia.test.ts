import { mensajeDeExcepcion } from '../../src/adapters/auth/mensajes';
import {
  ErrorTiempoAgotado,
  TIEMPO_MAXIMO_MS,
  conReintento,
  conTiempo,
  esErrorTransitorio,
} from '../../src/adapters/auth/resiliencia';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('resiliencia: conTiempo', () => {
  it('entrega el resultado si la operación termina a tiempo', async () => {
    await expect(conTiempo(async () => 'listo')).resolves.toBe('listo');
  });

  it('rechaza con ErrorTiempoAgotado si la operación no termina dentro del plazo', async () => {
    const colgada = conTiempo(() => new Promise<string>(() => {}), 1000);
    const resultado = expect(colgada).rejects.toBeInstanceOf(ErrorTiempoAgotado);
    await vi.advanceTimersByTimeAsync(1000);
    await resultado;
  });

  it('no rechaza antes de tiempo', async () => {
    let respuesta: string | undefined;
    void conTiempo(() => new Promise<string>((resolver) => setTimeout(() => resolver('tarde'), 900)), 1000).then((r) => {
      respuesta = r;
    });
    await vi.advanceTimersByTimeAsync(950);
    expect(respuesta).toBe('tarde');
  });

  it('si la operación falla antes, propaga su error y no deja temporizadores pendientes', async () => {
    await expect(conTiempo(async () => Promise.reject(new Error('fallo')))).rejects.toThrow('fallo');
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('el plazo por defecto es de 15 segundos', () => {
    expect(TIEMPO_MAXIMO_MS).toBe(15_000);
  });
});

describe('resiliencia: esErrorTransitorio', () => {
  it('reconoce caídas del servidor y de la red', () => {
    expect(esErrorTransitorio({ status: 503 })).toBe(true);
    expect(esErrorTransitorio({ message: 'TypeError: Failed to fetch' })).toBe(true);
    expect(esErrorTransitorio({ message: 'connection timeout' })).toBe(true);
  });

  it('no repite errores de datos, de permisos ni la ausencia de error', () => {
    expect(esErrorTransitorio({ code: '42501', message: 'permission denied' })).toBe(false);
    expect(esErrorTransitorio({ code: '54000' })).toBe(false);
    expect(esErrorTransitorio({ status: 400 })).toBe(false);
    expect(esErrorTransitorio(null)).toBe(false);
    expect(esErrorTransitorio(undefined)).toBe(false);
  });
});

describe('resiliencia: conReintento (solo lecturas)', () => {
  it('si la primera vez funciona, no repite', async () => {
    const operacion = vi.fn(async () => ({ data: 1, error: null }));
    await expect(conReintento(operacion)).resolves.toEqual({ data: 1, error: null });
    expect(operacion).toHaveBeenCalledTimes(1);
  });

  it('si la primera llamada lanza una excepción, espera y repite una vez', async () => {
    const operacion = vi
      .fn<() => Promise<{ data: number }>>()
      .mockRejectedValueOnce(new Error('red caída'))
      .mockResolvedValueOnce({ data: 2 });
    const resultado = conReintento(operacion, { esperaMs: 1000 });
    await vi.advanceTimersByTimeAsync(0);
    expect(operacion).toHaveBeenCalledTimes(1); // todavía esperando la pausa
    await vi.advanceTimersByTimeAsync(1000);
    await expect(resultado).resolves.toEqual({ data: 2 });
    expect(operacion).toHaveBeenCalledTimes(2);
  });

  it('si la base estaba dormida (primera llamada colgada), la repite y funciona', async () => {
    const operacion = vi
      .fn<() => Promise<{ data: string }>>()
      .mockImplementationOnce(() => new Promise<{ data: string }>(() => {}))
      .mockResolvedValueOnce({ data: 'despertó' });
    const resultado = conReintento(operacion, { tiempoMs: 5000, esperaMs: 1000 });
    await vi.advanceTimersByTimeAsync(5000 + 1000);
    await expect(resultado).resolves.toEqual({ data: 'despertó' });
    expect(operacion).toHaveBeenCalledTimes(2);
  });

  it('repite una respuesta con error transitorio', async () => {
    const operacion = vi
      .fn<() => Promise<{ data: null | number; error: { status: number } | null }>>()
      .mockResolvedValueOnce({ data: null, error: { status: 503 } })
      .mockResolvedValueOnce({ data: 3, error: null });
    const resultado = conReintento(operacion);
    await vi.advanceTimersByTimeAsync(1000);
    await expect(resultado).resolves.toEqual({ data: 3, error: null });
    expect(operacion).toHaveBeenCalledTimes(2);
  });

  it('no repite un error de datos o de permisos', async () => {
    const operacion = vi.fn(async () => ({ data: null, error: { code: '42501', message: 'permission denied' } }));
    await expect(conReintento(operacion)).resolves.toEqual({ data: null, error: { code: '42501', message: 'permission denied' } });
    expect(operacion).toHaveBeenCalledTimes(1);
  });

  it('solo reintenta una vez: si vuelve a fallar, propaga el error', async () => {
    const operacion = vi.fn<() => Promise<number>>().mockRejectedValue(new Error('sigue caída'));
    const resultado = expect(conReintento(operacion, { esperaMs: 500 })).rejects.toThrow('sigue caída');
    await vi.advanceTimersByTimeAsync(500);
    await resultado;
    expect(operacion).toHaveBeenCalledTimes(2);
  });

  it('si la segunda llamada también se cuelga, termina con ErrorTiempoAgotado', async () => {
    const operacion = vi.fn(() => new Promise<number>(() => {}));
    const resultado = expect(conReintento(operacion, { tiempoMs: 1000, esperaMs: 100 })).rejects.toBeInstanceOf(ErrorTiempoAgotado);
    await vi.advanceTimersByTimeAsync(1000 + 100 + 1000);
    await resultado;
    expect(operacion).toHaveBeenCalledTimes(2);
  });
});

describe('resiliencia: mensajes', () => {
  it('un tiempo agotado tiene su propio mensaje, que invita a revisar antes de repetir un guardado', () => {
    const mensaje = mensajeDeExcepcion(new ErrorTiempoAgotado());
    expect(mensaje).toContain('tardó demasiado');
    expect(mensaje).toContain('Mis simulaciones');
  });

  it('cualquier otra excepción usa el mensaje genérico de conexión', () => {
    expect(mensajeDeExcepcion(new Error('x'))).toContain('Revisa tu conexión');
  });
});
