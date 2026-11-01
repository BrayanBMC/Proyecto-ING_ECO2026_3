import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ServicioCuenta } from '../../src/adapters/auth/ServicioCuenta';
import { codificarEnlace, decodificarEnlace } from '../../src/adapters/share/url';
import type { ParametrosCredito, SimulacionGuardada } from '../../src/core';
import { App } from '../../src/ui/App';
import { PaginaMisSimulaciones } from '../../src/ui/paginas/MisSimulaciones';
import { PaginaSimulador } from '../../src/ui/paginas/Simulador';
import { fijarSimulacionPendiente, repoDelInvitado, simulacionPendiente, vaciarSesionInvitado } from '../../src/ui/sesionInvitado';
import { servicioFalso } from './servicioFalso';

/** Intl usa espacio duro entre "$" y el número; se normaliza para comparar. */
const texto = (el: Element | null) => (el?.textContent ?? '').replace(/\s/g, ' ');

const ANA = { nombre: 'Ana', correo: 'ana@correo.co' };

function params(extra: Partial<ParametrosCredito> = {}): ParametrosCredito {
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

function guardada(id: string, nombre: string, extra: Partial<ParametrosCredito> = {}, dia = 1): SimulacionGuardada {
  return {
    id,
    nombre,
    parametros: params(extra),
    actualizadoEn: new Date(Date.UTC(2026, 10, dia, 15, 0, 0)).toISOString(),
  };
}

const A = guardada('a', 'Crédito A', { tasa: '1,5' }, 1);
const B = guardada('b', 'Crédito B', { tasa: '2' }, 2);
const C = guardada('c', 'Crédito C', { tasa: '1' }, 3);

function servicioConLista(...lista: SimulacionGuardada[]) {
  return servicioFalso({
    listarSimulaciones: vi.fn<ServicioCuenta['listarSimulaciones']>(async () => ({ ok: true, simulaciones: lista })),
  });
}

/** Mock de "guardar simulación" que responde bien; se guarda aparte para poder leer sus llamadas con tipos. */
function guardarOk() {
  return vi.fn<ServicioCuenta['guardarSimulacion']>(async (nombre, parametros) => ({
    ok: true,
    simulacion: { id: 'nueva', nombre, parametros, actualizadoEn: '2026-11-01T12:00:00.000Z' },
  }));
}

function escribir(etiqueta: string, valor: string) {
  fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });
}
const pulsar = (nombre: string | RegExp) => fireEvent.click(screen.getByRole('button', { name: nombre }));

/** 10.000.000 al 1,5 % efectivo mensual en 12 cuotas, ya simulado. */
function simularBase() {
  escribir('Monto del crédito ($)', '10.000.000');
  escribir('Número de cuotas', '12');
  escribir('Tasa de interés (%)', '1,5');
  escribir('Tipo de tasa', 'efectiva');
  escribir('Periodo de la tasa', '12');
  pulsar('Simular');
}

function ponerPortapapeles(valor: unknown) {
  Object.defineProperty(navigator, 'clipboard', { value: valor, configurable: true });
}

beforeEach(() => {
  vaciarSesionInvitado();
  window.history.pushState(null, '', '/');
});

afterEach(() => {
  cleanup();
  ponerPortapapeles(undefined);
});

describe('HU-21: Mis simulaciones (registrado)', () => {
  it('criterio HU-21: con 3 guardadas aparecen ordenadas por fecha, con su cuota, EA e intereses', async () => {
    render(<PaginaMisSimulaciones servicio={servicioConLista(C, B, A)} usuario={ANA} />);
    await screen.findByRole('heading', { level: 2, name: 'Crédito A' });
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Crédito C', 'Crédito B', 'Crédito A']);
    expect(screen.getAllByText(/^Actualizada el /)).toHaveLength(3);
    const tarjetaA = screen.getByRole('heading', { level: 2, name: 'Crédito A' }).closest('li')!;
    expect(texto(tarjetaA)).toContain('Primera cuota');
    expect(texto(tarjetaA)).toContain('$ 916.800');
    expect(texto(tarjetaA)).toContain('Efectiva anual (EA)');
    expect(texto(tarjetaA)).toContain('19,56 %');
    expect(texto(tarjetaA)).toContain('Total de intereses');
  });

  it('criterio HU-21: al abrir una, el enlace regenera la misma simulación', async () => {
    render(<PaginaMisSimulaciones servicio={servicioConLista(A)} usuario={ANA} />);
    const enlace = await screen.findByRole('link', { name: 'Abrir Crédito A' });
    const href = enlace.getAttribute('href')!;
    expect(href.startsWith('/simulador#c=')).toBe(true);
    expect(decodificarEnlace(href.slice('/simulador'.length))).toEqual({ ok: true, datos: A.parametros });
  });

  it('sin simulaciones explica cómo guardar la primera', async () => {
    render(<PaginaMisSimulaciones servicio={servicioConLista()} usuario={ANA} />);
    expect(await screen.findByText(/Aún no hay simulaciones guardadas/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Comparar seleccionadas' })).toBeNull();
  });

  it('muestra el error si no se pueden cargar', async () => {
    const servicio = servicioFalso({
      listarSimulaciones: vi.fn<ServicioCuenta['listarSimulaciones']>(async () => ({ ok: false, mensaje: 'Sin conexión.' })),
    });
    render(<PaginaMisSimulaciones servicio={servicio} usuario={ANA} />);
    expect((await screen.findByRole('alert')).textContent).toBe('Sin conexión.');
  });

  it('una simulación cuyos datos ya no son válidos no se puede abrir ni comparar', async () => {
    const rota = guardada('r', 'Rota', { plazo: '999' });
    render(<PaginaMisSimulaciones servicio={servicioConLista(rota)} usuario={ANA} />);
    await screen.findByRole('heading', { level: 2, name: 'Rota' });
    expect(screen.getByText(/No se puede abrir: El plazo debe ser/)).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Abrir Rota' })).toBeNull();
    expect(screen.queryByLabelText(/Comparar/)).toBeNull();
    // Aun así se puede renombrar y borrar.
    expect(screen.getByRole('button', { name: 'Renombrar Rota' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Borrar Rota' })).toBeTruthy();
  });

  it('renombrar guarda el nombre nuevo y recarga la lista', async () => {
    const servicio = servicioConLista(A);
    render(<PaginaMisSimulaciones servicio={servicio} usuario={ANA} />);
    await screen.findByRole('heading', { level: 2, name: 'Crédito A' });
    pulsar('Renombrar Crédito A');
    escribir('Nuevo nombre', '  Casa nueva  ');
    pulsar('Guardar nombre');
    await waitFor(() => expect(servicio.renombrarSimulacion).toHaveBeenCalledWith('a', 'Casa nueva'));
    expect(await screen.findByText('Nombre actualizado.')).toBeTruthy();
    await waitFor(() => expect(servicio.listarSimulaciones).toHaveBeenCalledTimes(2));
    expect(screen.queryByLabelText('Nuevo nombre')).toBeNull();
  });

  it('renombrar valida el nombre y se puede cancelar', async () => {
    const servicio = servicioConLista(A);
    render(<PaginaMisSimulaciones servicio={servicio} usuario={ANA} />);
    await screen.findByRole('heading', { level: 2, name: 'Crédito A' });
    pulsar('Renombrar Crédito A');
    escribir('Nuevo nombre', '   ');
    pulsar('Guardar nombre');
    expect(screen.getByText('El nombre debe tener entre 1 y 60 caracteres.')).toBeTruthy();
    expect(servicio.renombrarSimulacion).not.toHaveBeenCalled();
    pulsar('Cancelar');
    expect(screen.queryByLabelText('Nuevo nombre')).toBeNull();
  });

  it('si renombrar falla muestra el mensaje y deja el nombre como estaba', async () => {
    const servicio = servicioFalso({
      listarSimulaciones: vi.fn<ServicioCuenta['listarSimulaciones']>(async () => ({ ok: true, simulaciones: [A] })),
      renombrarSimulacion: vi.fn<ServicioCuenta['renombrarSimulacion']>(async () => ({ ok: false, mensaje: 'No se pudo.' })),
    });
    render(<PaginaMisSimulaciones servicio={servicio} usuario={ANA} />);
    await screen.findByRole('heading', { level: 2, name: 'Crédito A' });
    pulsar('Renombrar Crédito A');
    escribir('Nuevo nombre', 'Otro');
    pulsar('Guardar nombre');
    expect((await screen.findByRole('alert')).textContent).toBe('No se pudo.');
  });

  it('criterio HU-21: borrar pide confirmación y, al confirmar, la simulación ya no aparece', async () => {
    const listar = vi
      .fn<ServicioCuenta['listarSimulaciones']>()
      .mockResolvedValueOnce({ ok: true, simulaciones: [B, A] })
      .mockResolvedValue({ ok: true, simulaciones: [B] });
    const servicio = servicioFalso({ listarSimulaciones: listar });
    render(<PaginaMisSimulaciones servicio={servicio} usuario={ANA} />);
    await screen.findByRole('heading', { level: 2, name: 'Crédito A' });

    pulsar('Borrar Crédito A');
    expect(screen.getByText(/¿Borrar «Crédito A»\? No se puede deshacer\./)).toBeTruthy();
    expect(servicio.borrarSimulacion).not.toHaveBeenCalled(); // todavía no se borró

    pulsar('Sí, borrar «Crédito A»');
    await waitFor(() => expect(servicio.borrarSimulacion).toHaveBeenCalledWith('a'));
    expect(await screen.findByText('Simulación borrada.')).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('heading', { level: 2, name: 'Crédito A' })).toBeNull());
    expect(screen.getByRole('heading', { level: 2, name: 'Crédito B' })).toBeTruthy();
  });

  it('si el usuario se arrepiente, no se borra nada', async () => {
    const servicio = servicioConLista(A);
    render(<PaginaMisSimulaciones servicio={servicio} usuario={ANA} />);
    await screen.findByRole('heading', { level: 2, name: 'Crédito A' });
    pulsar('Borrar Crédito A');
    pulsar('No, conservar');
    expect(servicio.borrarSimulacion).not.toHaveBeenCalled();
    expect(screen.queryByText(/¿Borrar/)).toBeNull();
  });

  it('si borrar falla muestra el mensaje y no quita la simulación', async () => {
    const servicio = servicioFalso({
      listarSimulaciones: vi.fn<ServicioCuenta['listarSimulaciones']>(async () => ({ ok: true, simulaciones: [A] })),
      borrarSimulacion: vi.fn<ServicioCuenta['borrarSimulacion']>(async () => ({ ok: false, mensaje: 'No se pudo borrar.' })),
    });
    render(<PaginaMisSimulaciones servicio={servicio} usuario={ANA} />);
    await screen.findByRole('heading', { level: 2, name: 'Crédito A' });
    pulsar('Borrar Crédito A');
    pulsar('Sí, borrar «Crédito A»');
    expect((await screen.findByText('No se pudo borrar.')).getAttribute('role')).toBe('alert');
    expect(screen.getByRole('heading', { level: 2, name: 'Crédito A' })).toBeTruthy();
  });
});

describe('HU-23: comparador', () => {
  const tabla = () => screen.getByRole('table', { name: /^Cuota, EA, intereses/ });

  it('criterio HU-23: con 3 simulaciones muestra cuota, EA, intereses y ρ en columnas, con el menor costo resaltado', async () => {
    render(<PaginaMisSimulaciones servicio={servicioConLista(C, B, A)} usuario={ANA} />);
    await screen.findByRole('heading', { level: 2, name: 'Crédito A' });
    for (const nombre of ['Crédito A', 'Crédito B', 'Crédito C']) {
      fireEvent.click(screen.getByLabelText(`Comparar «${nombre}»`));
    }
    pulsar('Comparar seleccionadas');

    const t = tabla();
    const columnas = within(t).getAllByRole('columnheader');
    expect(columnas.map((c) => c.textContent)).toEqual([
      'Concepto',
      'Crédito C ✓ Menor costo', // 1 % mensual: el que menos intereses paga
      'Crédito B',
      'Crédito A',
    ]);
    for (const fila of ['Primera cuota', 'Efectiva anual (EA)', 'Total de intereses', 'Total pagado', 'Intereses por cada peso prestado (ρ)']) {
      expect(within(t).getByRole('rowheader', { name: fila })).toBeTruthy();
    }
    // La celda de ρ de la columna más barata: intereses / capital con 4 decimales.
    const fila = within(t).getByRole('rowheader', { name: 'Intereses por cada peso prestado (ρ)' }).parentElement!;
    expect(fila.querySelectorAll('td')[0]?.textContent).toMatch(/^0,\d{4}$/);
    expect(fila.querySelectorAll('td')[0]?.className).toBe('celda-mejor');
    expect(fila.querySelectorAll('td')[1]?.className).toBe('');
  });

  it('solo se pueden elegir hasta 3 y se necesitan al menos 2', async () => {
    const D = guardada('d', 'Crédito D', { tasa: '3' }, 4);
    render(<PaginaMisSimulaciones servicio={servicioConLista(D, C, B, A)} usuario={ANA} />);
    await screen.findByRole('heading', { level: 2, name: 'Crédito A' });
    const comparar = screen.getByRole('button', { name: 'Comparar seleccionadas' }) as HTMLButtonElement;
    expect(comparar.disabled).toBe(true);

    fireEvent.click(screen.getByLabelText('Comparar «Crédito A»'));
    expect(comparar.disabled).toBe(true); // con una sola no alcanza
    fireEvent.click(screen.getByLabelText('Comparar «Crédito B»'));
    expect(comparar.disabled).toBe(false);
    fireEvent.click(screen.getByLabelText('Comparar «Crédito C»'));
    expect((screen.getByLabelText('Comparar «Crédito D»') as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText('Elige entre 2 y 3 simulaciones (3 elegidas).')).toBeTruthy();

    // Al quitar una se libera la cuarta.
    fireEvent.click(screen.getByLabelText('Comparar «Crédito C»'));
    expect((screen.getByLabelText('Comparar «Crédito D»') as HTMLInputElement).disabled).toBe(false);
  });

  it('cambiar la selección o borrar una simulación cierra el comparador', async () => {
    render(<PaginaMisSimulaciones servicio={servicioConLista(C, B, A)} usuario={ANA} />);
    await screen.findByRole('heading', { level: 2, name: 'Crédito A' });
    fireEvent.click(screen.getByLabelText('Comparar «Crédito A»'));
    fireEvent.click(screen.getByLabelText('Comparar «Crédito B»'));
    pulsar('Comparar seleccionadas');
    expect(tabla()).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Comparar «Crédito C»'));
    expect(screen.queryByRole('table')).toBeNull();

    pulsar('Comparar seleccionadas');
    pulsar('Borrar Crédito A');
    pulsar('Sí, borrar «Crédito A»');
    await waitFor(() => expect(screen.queryByRole('table')).toBeNull());
  });

  it('criterio HU-23: el invitado compara las simulaciones de la sesión, sin cuenta', async () => {
    await repoDelInvitado.guardar('Barata', params({ tasa: '1' }));
    await repoDelInvitado.guardar('Cara', params({ tasa: '2' }));
    render(<PaginaMisSimulaciones servicio={null} usuario={null} />);
    await screen.findByRole('heading', { level: 2, name: 'Barata' });
    expect(screen.getByText(/Modo invitado: estas simulaciones viven solo en esta pestaña/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Inicia sesión' }).getAttribute('href')).toBe('/iniciar-sesion');

    fireEvent.click(screen.getByLabelText('Comparar «Barata»'));
    fireEvent.click(screen.getByLabelText('Comparar «Cara»'));
    pulsar('Comparar seleccionadas');
    expect(within(tabla()).getByRole('columnheader', { name: 'Barata ✓ Menor costo' })).toBeTruthy();
  });
});

describe('HU-21 y HU-24: guardar y compartir desde el simulador', () => {
  it('criterio HU-21: el registrado guarda con nombre y se envían los parámetros reales', async () => {
    const servicio = servicioFalso();
    render(<PaginaSimulador servicio={servicio} usuario={ANA} />);
    simularBase();
    expect(screen.getByText('Se guarda en tu cuenta y la puedes abrir desde cualquier equipo.')).toBeTruthy();
    escribir('Nombre de la simulación', 'Crédito A');
    pulsar('Guardar simulación');

    expect(await screen.findByText(/Guardada como «Crédito A»/)).toBeTruthy();
    expect(servicio.guardarSimulacion).toHaveBeenCalledWith('Crédito A', {
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
    });
    expect(screen.getByRole('link', { name: 'Ver mis simulaciones' }).getAttribute('href')).toBe('/simulaciones');
  });

  it('sin nombre usa uno automático con la fecha', async () => {
    const guardar = guardarOk();
    render(<PaginaSimulador servicio={servicioFalso({ guardarSimulacion: guardar })} usuario={ANA} />);
    simularBase();
    pulsar('Guardar simulación');
    await waitFor(() => expect(guardar).toHaveBeenCalledTimes(1));
    expect(guardar.mock.calls[0]![0]).toMatch(/^Simulación \d{4}-\d{2}-\d{2}$/);
  });

  it('rechaza un nombre de más de 60 caracteres y no guarda', () => {
    const servicio = servicioFalso();
    render(<PaginaSimulador servicio={servicio} usuario={ANA} />);
    simularBase();
    escribir('Nombre de la simulación', 'x'.repeat(61));
    pulsar('Guardar simulación');
    expect(screen.getByText('El nombre debe tener entre 1 y 60 caracteres.')).toBeTruthy();
    expect(servicio.guardarSimulacion).not.toHaveBeenCalled();
  });

  it('si guardar falla muestra el mensaje', async () => {
    const servicio = servicioFalso({
      guardarSimulacion: vi.fn<ServicioCuenta['guardarSimulacion']>(async () => ({
        ok: false,
        mensaje: 'Llegaste al límite de 50 simulaciones guardadas. Borra alguna para guardar otra.',
      })),
    });
    render(<PaginaSimulador servicio={servicio} usuario={ANA} />);
    simularBase();
    pulsar('Guardar simulación');
    expect((await screen.findByRole('alert')).textContent).toContain('límite de 50');
  });

  it('el invitado guarda solo en la pestaña y se le avisa', async () => {
    render(<PaginaSimulador />);
    simularBase();
    expect(screen.getByText(/Modo invitado: se guarda solo en esta pestaña/)).toBeTruthy();
    escribir('Nombre de la simulación', 'Borrador');
    pulsar('Guardar simulación');
    await screen.findByText(/Guardada como «Borrador»/);
    const lista = await repoDelInvitado.listar();
    expect(lista.ok && lista.datos.map((s) => s.nombre)).toEqual(['Borrador']);
  });

  it('criterio HU-24: "Copiar enlace" copia una URL con los parámetros en el hash', async () => {
    const writeText = vi.fn<(texto: string) => Promise<void>>(async () => {});
    ponerPortapapeles({ writeText });
    render(<PaginaSimulador />);
    simularBase();
    pulsar('Copiar enlace');

    expect(await screen.findByText(/Enlace copiado/)).toBeTruthy();
    expect(writeText).toHaveBeenCalledTimes(1);
    const url = writeText.mock.calls[0]![0];
    expect(url.startsWith(`${window.location.origin}/simulador#c=`)).toBe(true);
    // Lo que va en el hash es la simulación en pantalla.
    expect(decodificarEnlace(url.slice(`${window.location.origin}/simulador`.length))).toEqual({
      ok: true,
      datos: expect.objectContaining({ monto: '10.000.000', plazo: '12', tasa: '1,5' }),
    });
    expect((screen.getByLabelText('Enlace para compartir') as HTMLInputElement).value).toBe(url);
  });

  it('si el navegador no deja copiar, deja el enlace a la vista', async () => {
    ponerPortapapeles(undefined);
    render(<PaginaSimulador />);
    simularBase();
    pulsar('Copiar enlace');
    expect(await screen.findByText(/No pudimos copiarlo solo/)).toBeTruthy();
    expect((screen.getByLabelText('Enlace para compartir') as HTMLInputElement).value).toContain('/simulador#c=');
  });

  it('criterio HU-24: al abrir el enlace se reproduce la misma tabla, sin pulsar nada', () => {
    window.history.pushState(null, '', `/simulador${codificarEnlace(params({ graciaPeriodos: '3', graciaTipo: 'muerta' }))}`);
    render(<PaginaSimulador />);
    expect((screen.getByLabelText('Monto del crédito ($)') as HTMLInputElement).value).toBe('10.000.000');
    expect((screen.getByLabelText('Periodos de gracia') as HTMLInputElement).value).toBe('3');
    const tabla = screen.getByRole('table', { name: /^Cuotas por/ });
    expect(within(tabla).getAllByRole('row')).toHaveLength(17); // encabezado + fila 0 + 3 de gracia + 12 cuotas
    expect(texto(within(tabla).getAllByRole('row')[5]!)).toContain('$ 958.678'); // T6: primera cuota después de la gracia
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('un enlace con abono extraordinario reproduce también el abono', () => {
    window.history.pushState(
      null,
      '',
      `/simulador${codificarEnlace(params({ abono: { periodo: '3', valor: '2.000.000', modo: 'reducir-plazo' } }))}`,
    );
    render(<PaginaSimulador />);
    expect(screen.getByRole('columnheader', { name: 'Abono extra' })).toBeTruthy();
  });

  it('un enlace abierto con sesión conserva los decimales del enlace y no los del perfil', async () => {
    window.history.pushState(null, '', `/simulador${codificarEnlace(params({ escala: 2 }))}`);
    const servicio = servicioFalso({
      sesionActual: vi.fn(async () => ANA),
      leerPerfil: vi.fn(async () => ({
        ok: true as const,
        perfil: { nombre: 'Ana', institucion: null, programa: null, escala: 0 as const, baseDiaria: 360 as const },
      })),
    });
    render(<PaginaSimulador servicio={servicio} usuario={ANA} />);
    await waitFor(() => expect(servicio.leerPerfil).toHaveBeenCalled());
    // Se deja pasar la respuesta del perfil (que pide 0 decimales) antes de comprobar.
    await new Promise((resolver) => setTimeout(resolver, 0));
    expect((screen.getByLabelText('2 decimales') as HTMLInputElement).checked).toBe(true);
  });

  it('criterio HU-24: un enlace alterado con valores fuera de rango muestra el error y no calcula', () => {
    window.history.pushState(null, '', `/simulador${codificarEnlace(params({ plazo: '400' }))}`);
    render(<PaginaSimulador />);
    expect(screen.getByRole('alert').textContent).toContain('El plazo debe ser un número entero de cuotas entre 1 y 360.');
    expect(screen.getByRole('alert').textContent).toContain('No se calculó nada');
    expect(screen.queryByRole('table')).toBeNull();
    expect((screen.getByLabelText('Monto del crédito ($)') as HTMLInputElement).value).toBe('');
  });

  it('un enlace dañado muestra que no es válido y no calcula', () => {
    window.history.pushState(null, '', '/simulador#c=xyz');
    render(<PaginaSimulador />);
    expect(screen.getByRole('alert').textContent).toContain('El enlace no es válido o está incompleto.');
    expect(screen.queryByRole('table')).toBeNull();
  });
});

describe('HU-22: llevar la simulación del invitado a su cuenta', () => {
  it('el invitado con una simulación abierta la deja pendiente; si cambia un dato, deja de estar pendiente', () => {
    render(<PaginaSimulador />);
    expect(simulacionPendiente()).toBeNull();
    simularBase();
    expect(simulacionPendiente()?.monto).toBe('10.000.000');
    escribir('Monto del crédito ($)', '5.000.000');
    expect(simulacionPendiente()).toBeNull();
  });

  it('criterio HU-22: al iniciar sesión se ofrece "Guardar esta simulación en mi cuenta" y al aceptar se guarda', async () => {
    fijarSimulacionPendiente(params());
    const guardar = guardarOk();
    render(<App servicioCuenta={servicioFalso({ sesionActual: vi.fn(async () => ANA), guardarSimulacion: guardar })} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Guardar esta simulación en mi cuenta' }));
    await waitFor(() => expect(guardar).toHaveBeenCalledTimes(1));
    const [nombre, guardado] = guardar.mock.calls[0]!;
    expect(nombre).toMatch(/^Simulación \d{4}-\d{2}-\d{2}$/);
    expect(guardado).toEqual(params());
    expect(await screen.findByText(/Guardada en tu cuenta como/)).toBeTruthy();
    expect(simulacionPendiente()).toBeNull();
    expect(screen.queryByRole('button', { name: 'Guardar esta simulación en mi cuenta' })).toBeNull();
  });

  it('criterio HU-22: si rechaza la oferta, no se guardó nada', async () => {
    fijarSimulacionPendiente(params());
    const servicio = servicioFalso({ sesionActual: vi.fn(async () => ANA) });
    render(<App servicioCuenta={servicio} />);

    await screen.findByRole('button', { name: 'Guardar esta simulación en mi cuenta' });
    pulsar('No guardar');
    expect(screen.queryByRole('button', { name: 'Guardar esta simulación en mi cuenta' })).toBeNull();
    expect(simulacionPendiente()).toBeNull();
    expect(servicio.guardarSimulacion).not.toHaveBeenCalled();
  });

  it('si guardar falla, muestra el error y deja la oferta para reintentar', async () => {
    fijarSimulacionPendiente(params());
    const servicio = servicioFalso({
      sesionActual: vi.fn(async () => ANA),
      guardarSimulacion: vi.fn<ServicioCuenta['guardarSimulacion']>(async () => ({ ok: false, mensaje: 'Sin conexión.' })),
    });
    render(<App servicioCuenta={servicio} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Guardar esta simulación en mi cuenta' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Sin conexión.');
    expect(screen.getByRole('button', { name: 'Guardar esta simulación en mi cuenta' })).toBeTruthy();
    expect(simulacionPendiente()).not.toBeNull();
  });

  it('la oferta no aparece para un invitado ni cuando no hay simulación abierta', async () => {
    fijarSimulacionPendiente(params());
    render(<App servicioCuenta={servicioFalso()} />);
    await waitFor(() => expect(screen.getByText('Invitado: no se guarda nada')).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Guardar esta simulación en mi cuenta' })).toBeNull();
    cleanup();

    fijarSimulacionPendiente(null);
    render(<App servicioCuenta={servicioFalso({ sesionActual: vi.fn(async () => ANA) })} />);
    await screen.findByText('Hola, Ana');
    expect(screen.queryByRole('button', { name: 'Guardar esta simulación en mi cuenta' })).toBeNull();
  });

  it('al cerrar sesión no queda nada del invitado en memoria', async () => {
    await repoDelInvitado.guardar('Borrador', params());
    fijarSimulacionPendiente(params());
    render(<App servicioCuenta={servicioFalso({ sesionActual: vi.fn(async () => ANA) })} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));
    await waitFor(() => expect(simulacionPendiente()).toBeNull());
    const lista = await repoDelInvitado.listar();
    expect(lista.ok && lista.datos).toEqual([]);
  });
});

describe('Rutas y cabecera de las simulaciones guardadas', () => {
  it('la ruta /simulaciones abre "Mis simulaciones" y la cabecera enlaza a ella', () => {
    window.history.pushState(null, '', '/simulaciones');
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'Mis simulaciones' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Mis simulaciones' }).getAttribute('href')).toBe('/simulaciones');
  });

  it('con sesión, la cabecera también enlaza a "Mis simulaciones"', async () => {
    render(<App servicioCuenta={servicioFalso({ sesionActual: vi.fn(async () => ANA) })} />);
    const enlace = await screen.findByRole('link', { name: 'Mis simulaciones' });
    expect(enlace.getAttribute('href')).toBe('/simulaciones');
    expect(await screen.findByText('Hola, Ana')).toBeTruthy();
  });
});
