import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ServicioCuenta, Usuario } from '../../src/adapters/auth/ServicioCuenta';
import type { Perfil } from '../../src/core';
import { App } from '../../src/ui/App';
import { PaginaPerfil } from '../../src/ui/paginas/Perfil';
import { fallo, servicioFalso } from './servicioFalso';

const ANA: Usuario = { nombre: 'Ana Pérez', correo: 'ana@correo.co' };
const PERFIL_ANA: Perfil = {
  nombre: 'Ana Pérez',
  institucion: 'Universidad Distrital',
  programa: 'Ingeniería Industrial',
  escala: 2,
  baseDiaria: 365,
};

function escribir(etiqueta: string, valor: string) {
  fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });
}

function pintar(servicio: ServicioCuenta, descargar = vi.fn()) {
  const alCambiarSesion = vi.fn(async () => {});
  render(<PaginaPerfil servicio={servicio} usuario={ANA} alCambiarSesion={alCambiarSesion} descargar={descargar} />);
  return { alCambiarSesion, descargar };
}

afterEach(() => {
  window.history.pushState(null, '', '/');
});

describe('HU-04: perfil', () => {
  it('sin perfil guardado, el formulario empieza con el nombre de la cuenta y los valores por defecto', async () => {
    pintar(servicioFalso());
    expect(((await screen.findByLabelText('Nombre')) as HTMLInputElement).value).toBe('Ana Pérez');
    expect((screen.getByLabelText('Sin decimales ($ 916.800)') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('360 (comercial)') as HTMLInputElement).checked).toBe(true);
  });

  it('criterio HU-04: la preferencia guardada (2 decimales) se carga sola al abrir el perfil en otro equipo', async () => {
    pintar(servicioFalso({ leerPerfil: vi.fn(async () => ({ ok: true as const, perfil: PERFIL_ANA })) }));
    expect(((await screen.findByLabelText('Institución (opcional)')) as HTMLInputElement).value).toBe(
      'Universidad Distrital',
    );
    expect((screen.getByLabelText('2 decimales ($ 916.799,92)') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('365 (calendario)') as HTMLInputElement).checked).toBe(true);
  });

  it('criterio HU-04: guarda nombre, institución, programa y preferencias', async () => {
    const servicio = servicioFalso();
    const { alCambiarSesion } = pintar(servicio);
    await screen.findByLabelText('Nombre');

    escribir('Institución (opcional)', 'Universidad Distrital');
    escribir('Programa (opcional)', 'Ingeniería Industrial');
    fireEvent.click(screen.getByLabelText('2 decimales ($ 916.799,92)'));
    fireEvent.click(screen.getByLabelText('365 (calendario)'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar perfil' }));

    expect((await screen.findByRole('status')).textContent).toBe('Perfil guardado.');
    expect(servicio.guardarPerfil).toHaveBeenCalledWith(PERFIL_ANA);
    expect(alCambiarSesion).toHaveBeenCalled();
  });

  it('no guarda si el nombre queda vacío', async () => {
    const servicio = servicioFalso();
    pintar(servicio);
    await screen.findByLabelText('Nombre');
    escribir('Nombre', '  ');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar perfil' }));
    expect(await screen.findByText('Escribe tu nombre.')).toBeTruthy();
    expect(servicio.guardarPerfil).not.toHaveBeenCalled();
  });

  it('muestra el error si no se pudo guardar', async () => {
    pintar(servicioFalso({ guardarPerfil: fallo('No pudimos completar la operación.') }));
    await screen.findByLabelText('Nombre');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar perfil' }));
    expect((await screen.findByRole('alert')).textContent).toBe('No pudimos completar la operación.');
  });

  it('muestra el error si no se pudo leer el perfil', async () => {
    pintar(servicioFalso({ leerPerfil: fallo('Sin conexión.') as unknown as ServicioCuenta['leerPerfil'] }));
    expect((await screen.findByRole('alert')).textContent).toBe('Sin conexión.');
  });

  it('el invitado ve una invitación a iniciar sesión, no un formulario', () => {
    render(<PaginaPerfil servicio={servicioFalso()} usuario={null} alCambiarSesion={vi.fn(async () => {})} />);
    expect(screen.getByRole('link', { name: 'Iniciar sesión' }).getAttribute('href')).toBe('/iniciar-sesion');
    expect(screen.queryByRole('button', { name: 'Guardar perfil' })).toBeNull();
  });

  it('con sesión, la cabecera enlaza "Mi perfil"', async () => {
    render(<App servicioCuenta={servicioFalso({ sesionActual: vi.fn(async () => ANA) })} />);
    expect((await screen.findByRole('link', { name: 'Mi perfil' })).getAttribute('href')).toBe('/perfil');
  });
});

describe('HU-05: descargar mis datos y eliminar mi cuenta', () => {
  it('criterio HU-05: "Descargar mis datos" entrega un JSON con cuenta, perfil y consentimientos', async () => {
    const servicio = servicioFalso({ leerPerfil: vi.fn(async () => ({ ok: true as const, perfil: PERFIL_ANA })) });
    const { descargar } = pintar(servicio);
    await screen.findByLabelText('Nombre');

    fireEvent.click(screen.getByRole('button', { name: 'Descargar mis datos' }));

    await waitFor(() => expect(descargar).toHaveBeenCalledTimes(1));
    const [nombreArchivo, datos] = descargar.mock.calls[0] as [string, Record<string, unknown>];
    expect(nombreArchivo).toMatch(/^amortiza-mis-datos-\d{4}-\d{2}-\d{2}\.json$/);
    expect(datos.cuenta).toEqual({ correo: 'ana@correo.co' });
    expect(datos.perfil).toEqual(PERFIL_ANA);
    expect(datos.consentimientos).toEqual([{ version: '2026-10-30', aceptadoEn: '2026-10-30T15:00:00Z' }]);
    expect(datos.simulaciones).toEqual([]);
  });

  it('si falla la lectura de consentimientos no descarga y muestra el error', async () => {
    const servicio = servicioFalso({
      leerConsentimientos: fallo('Sin conexión.') as unknown as ServicioCuenta['leerConsentimientos'],
    });
    const { descargar } = pintar(servicio);
    await screen.findByLabelText('Nombre');
    fireEvent.click(screen.getByRole('button', { name: 'Descargar mis datos' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Sin conexión.');
    expect(descargar).not.toHaveBeenCalled();
  });

  it('criterio HU-05: "Eliminar mi cuenta" pide la contraseña, borra la cuenta y deja al usuario como invitado', async () => {
    const servicio = servicioFalso();
    const { alCambiarSesion } = pintar(servicio);
    await screen.findByLabelText('Nombre');

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar mi cuenta' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Escribe tu contraseña para confirmar.');
    expect(servicio.eliminarCuenta).not.toHaveBeenCalled();

    escribir('Tu contraseña, para confirmar', 'una frase larga');
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar mi cuenta' }));

    await waitFor(() => expect(window.location.pathname).toBe('/cuenta-eliminada'));
    expect(servicio.eliminarCuenta).toHaveBeenCalledWith('ana@correo.co', 'una frase larga');
    expect(alCambiarSesion).toHaveBeenCalled();
  });

  it('con contraseña incorrecta no elimina y muestra el error', async () => {
    const servicio = servicioFalso({ eliminarCuenta: fallo('Correo o contraseña incorrectos.') });
    pintar(servicio);
    await screen.findByLabelText('Nombre');
    escribir('Tu contraseña, para confirmar', 'otra');
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar mi cuenta' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Correo o contraseña incorrectos.');
    expect(window.location.pathname).toBe('/');
  });

  it('la ruta /cuenta-eliminada confirma el borrado', () => {
    window.history.pushState(null, '', '/cuenta-eliminada');
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Tu cuenta fue eliminada');
  });
});

describe('HU-06: modo invitado', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('criterio HU-06: el invitado usa la app sin que se le pida cuenta', async () => {
    render(<App servicioCuenta={servicioFalso()} />);
    expect(await screen.findByText('Invitado: no se guarda nada')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Simula tu crédito y entiende cada cuota');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('criterio HU-06: navegar como invitado no deja rastro en localStorage, sessionStorage ni cookies', async () => {
    render(<App servicioCuenta={servicioFalso()} />);
    for (const enlace of ['Iniciar sesión', 'Crear cuenta']) {
      fireEvent.click(screen.getByRole('link', { name: enlace }));
      await screen.findByRole('heading', { level: 1, name: enlace });
      fireEvent.click(screen.getByRole('link', { name: 'Amortiza, ir al inicio' }));
    }
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(document.cookie).toBe('');
  });
});
