import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ServicioCuenta, Usuario } from '../../src/adapters/auth/ServicioCuenta';
import { VERSION_POLITICA } from '../../src/core';
import { App } from '../../src/ui/App';
import { OK, servicioFalso } from './servicioFalso';

const ANA: Usuario = { nombre: 'Ana', correo: 'ana@correo.co' };

const conSesion = (cambios: Partial<ServicioCuenta> = {}) =>
  servicioFalso({ sesionActual: vi.fn(async (): Promise<Usuario | null> => ANA), ...cambios });

const consentimientos = (...versiones: string[]) =>
  vi.fn<ServicioCuenta['leerConsentimientos']>(async () => ({
    ok: true,
    consentimientos: versiones.map((version) => ({ version, aceptadoEn: '2026-10-30T15:00:00Z' })),
  }));

afterEach(() => {
  cleanup();
  window.history.pushState(null, '', '/');
});

describe('Política de datos: nueva versión', () => {
  it('la versión actual es posterior a la que no hablaba de simulaciones guardadas', () => {
    expect(VERSION_POLITICA > '2026-10-30').toBe(true);
  });

  it('si el usuario solo aceptó una versión anterior, se le pide aceptar la nueva', async () => {
    const servicio = conSesion({ leerConsentimientos: consentimientos('2026-10-30') });
    render(<App servicioCuenta={servicio} />);
    expect(await screen.findByRole('heading', { name: 'Actualizamos la política de datos' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Leer la política' }).getAttribute('href')).toBe('/politica-de-datos');
  });

  it('«Acepto la nueva versión» guarda el consentimiento con la versión vigente y oculta el aviso', async () => {
    const servicio = conSesion({ leerConsentimientos: consentimientos('2026-10-30') });
    render(<App servicioCuenta={servicio} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Acepto la nueva versión' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Actualizamos la política de datos' })).toBeNull());
    expect(servicio.registrarConsentimiento).toHaveBeenCalledWith(VERSION_POLITICA);
  });

  it('si no se pudo guardar el consentimiento, muestra el error y deja reintentar', async () => {
    const registrarConsentimiento = vi
      .fn<ServicioCuenta['registrarConsentimiento']>()
      .mockResolvedValueOnce({ ok: false, mensaje: 'Sin conexión.' })
      .mockResolvedValueOnce(OK);
    const servicio = conSesion({ leerConsentimientos: consentimientos('2026-10-30'), registrarConsentimiento });
    render(<App servicioCuenta={servicio} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Acepto la nueva versión' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Sin conexión.');
    fireEvent.click(screen.getByRole('button', { name: 'Acepto la nueva versión' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Actualizamos la política de datos' })).toBeNull());
    expect(registrarConsentimiento).toHaveBeenCalledTimes(2);
  });

  it('si ya aceptó la versión vigente, no se muestra nada', async () => {
    const servicio = conSesion({ leerConsentimientos: consentimientos('2026-10-30', VERSION_POLITICA) });
    render(<App servicioCuenta={servicio} />);
    await screen.findByText('Hola, Ana');
    await waitFor(() => expect(servicio.leerConsentimientos).toHaveBeenCalled());
    expect(screen.queryByRole('heading', { name: 'Actualizamos la política de datos' })).toBeNull();
  });

  it('si no se puede leer el estado del consentimiento, no bloquea ni avisa', async () => {
    const servicio = conSesion({
      leerConsentimientos: vi.fn<ServicioCuenta['leerConsentimientos']>(async () => ({ ok: false, mensaje: 'Sin conexión.' })),
    });
    render(<App servicioCuenta={servicio} />);
    await screen.findByText('Hola, Ana');
    await waitFor(() => expect(servicio.leerConsentimientos).toHaveBeenCalled());
    expect(screen.queryByRole('heading', { name: 'Actualizamos la política de datos' })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('el invitado no ve el aviso ni consulta consentimientos', async () => {
    const servicio = servicioFalso();
    render(<App servicioCuenta={servicio} />);
    await waitFor(() => expect(servicio.sesionActual).toHaveBeenCalled());
    expect(servicio.leerConsentimientos).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: 'Actualizamos la política de datos' })).toBeNull();
  });

  it('la política publicada explica que se guardan simulaciones y tema, y qué hace el invitado', () => {
    window.history.pushState(null, '', '/politica-de-datos');
    render(<App />);
    const texto = document.body.textContent ?? '';
    expect(texto).toContain('Las simulaciones que decidas guardar');
    expect(texto).toContain('tema de color');
    expect(texto).toContain('a las 24 horas');
    expect(texto).not.toContain('Más adelante');
  });
});
