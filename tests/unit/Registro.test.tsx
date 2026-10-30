import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ServicioCuenta } from '../../src/adapters/auth/ServicioCuenta';
import { App } from '../../src/ui/App';
import { PaginaRegistro } from '../../src/ui/paginas/Registro';
import { VERSION_POLITICA } from '../../src/core';
import { OK, servicioFalso } from './servicioFalso';

function escribir(etiqueta: string, valor: string) {
  fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });
}

function llenarFormulario({ acepta = true } = {}) {
  escribir('Nombre', 'Ana Pérez');
  escribir('Correo electrónico', ' Ana@Correo.co ');
  escribir('Contraseña', 'una frase larga');
  escribir('Repite la contraseña', 'una frase larga');
  if (acepta) {
    fireEvent.click(screen.getByRole('checkbox'));
  }
}

const crearCuenta = () => fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

afterEach(() => {
  cleanup();
  window.history.pushState(null, '', '/');
});

describe('ui/Registro (HU-01)', () => {
  it('criterio HU-01: sin marcar la política no se crea la cuenta y se muestra el motivo', async () => {
    const servicio = servicioFalso();
    render(<PaginaRegistro servicio={servicio} />);
    llenarFormulario({ acepta: false });
    crearCuenta();

    expect(
      await screen.findByText('Debes aceptar la política de tratamiento de datos para crear la cuenta.'),
    ).toBeTruthy();
    expect(servicio.registrar).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(screen.getByRole('checkbox'));
  });

  it('la casilla de la política empieza sin marcar y enlaza la política vigente', () => {
    render(<PaginaRegistro servicio={servicioFalso()} />);
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
    const enlace = screen.getByRole('link', { name: 'política de tratamiento de datos' });
    expect(enlace.getAttribute('href')).toBe('/politica-de-datos');
  });

  it('muestra los errores de cada campo y pone el foco en el primero', async () => {
    render(<PaginaRegistro servicio={servicioFalso()} />);
    crearCuenta();
    expect(await screen.findByText('Escribe tu nombre.')).toBeTruthy();
    expect(screen.getByText('Escribe un correo válido, por ejemplo nombre@dominio.co.')).toBeTruthy();
    expect(screen.getByText('La contraseña debe tener al menos 10 caracteres.')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText('Nombre'));
  });

  it('criterio HU-01: con datos válidos crea la cuenta, verifica el código y guarda el consentimiento', async () => {
    const servicio = servicioFalso();
    render(<PaginaRegistro servicio={servicio} />);
    llenarFormulario();
    crearCuenta();

    expect(await screen.findByRole('heading', { name: 'Revisa tu correo' })).toBeTruthy();
    expect(servicio.registrar).toHaveBeenCalledWith({
      nombre: 'Ana Pérez',
      correo: 'ana@correo.co',
      contrasena: 'una frase larga',
    });

    escribir('Código de verificación', '123456');
    fireEvent.click(screen.getByRole('button', { name: 'Verificar correo' }));

    expect(await screen.findByRole('heading', { name: 'Tu cuenta está lista' })).toBeTruthy();
    expect(servicio.verificarCorreo).toHaveBeenCalledWith({
      correo: 'ana@correo.co',
      codigo: '123456',
      contrasena: 'una frase larga',
    });
    expect(servicio.registrarConsentimiento).toHaveBeenCalledWith(VERSION_POLITICA);
  });

  it('muestra el error del servicio si el correo ya tiene cuenta', async () => {
    const servicio = servicioFalso({
      registrar: vi.fn(async () => ({ ok: false as const, mensaje: 'Ya existe una cuenta con ese correo.' })),
    });
    render(<PaginaRegistro servicio={servicio} />);
    llenarFormulario();
    crearCuenta();
    expect((await screen.findByRole('alert')).textContent).toBe('Ya existe una cuenta con ese correo.');
    expect(screen.getByRole('heading', { name: 'Crear cuenta' })).toBeTruthy();
  });

  it('valida el formato del código antes de llamar al servicio', async () => {
    const servicio = servicioFalso();
    render(<PaginaRegistro servicio={servicio} />);
    llenarFormulario();
    crearCuenta();
    await screen.findByRole('heading', { name: 'Revisa tu correo' });

    escribir('Código de verificación', '12a4');
    fireEvent.click(screen.getByRole('button', { name: 'Verificar correo' }));
    expect(await screen.findByText('El código tiene solo números. Revísalo en tu correo.')).toBeTruthy();
    expect(servicio.verificarCorreo).not.toHaveBeenCalled();
  });

  it('si el código es incorrecto no guarda el consentimiento', async () => {
    const servicio = servicioFalso({
      verificarCorreo: vi.fn(async () => ({ ok: false as const, mensaje: 'El código no es correcto.' })),
    });
    render(<PaginaRegistro servicio={servicio} />);
    llenarFormulario();
    crearCuenta();
    await screen.findByRole('heading', { name: 'Revisa tu correo' });

    escribir('Código de verificación', '000000');
    fireEvent.click(screen.getByRole('button', { name: 'Verificar correo' }));
    expect((await screen.findByRole('alert')).textContent).toBe('El código no es correcto.');
    expect(servicio.registrarConsentimiento).not.toHaveBeenCalled();
  });

  it('permite pedir otro código', async () => {
    const servicio = servicioFalso();
    render(<PaginaRegistro servicio={servicio} />);
    llenarFormulario();
    crearCuenta();
    await screen.findByRole('heading', { name: 'Revisa tu correo' });

    fireEvent.click(screen.getByRole('button', { name: 'Enviar otro código' }));
    expect((await screen.findByRole('status')).textContent).toBe('Te enviamos un código nuevo a ana@correo.co.');
    expect(servicio.reenviarCodigo).toHaveBeenCalledWith('ana@correo.co');
  });

  it('si falla el consentimiento permite reintentarlo sin repetir la verificación', async () => {
    const registrarConsentimiento = vi
      .fn<ServicioCuenta['registrarConsentimiento']>()
      .mockResolvedValueOnce({ ok: false, mensaje: 'Sin conexión.' })
      .mockResolvedValueOnce(OK);
    const servicio = servicioFalso({ registrarConsentimiento });
    render(<PaginaRegistro servicio={servicio} />);
    llenarFormulario();
    crearCuenta();
    await screen.findByRole('heading', { name: 'Revisa tu correo' });
    escribir('Código de verificación', '123456');
    fireEvent.click(screen.getByRole('button', { name: 'Verificar correo' }));

    expect(await screen.findByRole('heading', { name: 'Falta guardar tu aceptación' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Intentar de nuevo' }));

    expect(await screen.findByRole('heading', { name: 'Tu cuenta está lista' })).toBeTruthy();
    expect(servicio.verificarCorreo).toHaveBeenCalledTimes(1);
    expect(registrarConsentimiento).toHaveBeenCalledTimes(2);
  });

  it('sin configuración de Neon informa que el registro no está disponible', () => {
    render(<PaginaRegistro servicio={null} />);
    expect(screen.getByRole('alert').textContent).toContain('El registro no está disponible');
  });
});

describe('ui/App: navegación de HU-01', () => {
  it('el enlace "Crear cuenta" de la cabecera abre el registro sin recargar', async () => {
    render(<App servicioCuenta={servicioFalso()} />);
    fireEvent.click(screen.getByRole('link', { name: 'Crear cuenta' }));
    await waitFor(() => expect(window.location.pathname).toBe('/registro'));
    expect(screen.getByRole('heading', { level: 1, name: 'Crear cuenta' })).toBeTruthy();
  });

  it('la ruta /politica-de-datos muestra la política con su versión, responsable y derechos', () => {
    window.history.pushState(null, '', '/politica-de-datos');
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Política de tratamiento de datos personales');
    expect(document.body.textContent).toContain(VERSION_POLITICA);
    expect(screen.getByRole('heading', { name: '1. Responsable del tratamiento' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '5. Tus derechos' })).toBeTruthy();
  });

  it('una ruta desconocida muestra "Página no encontrada"', () => {
    window.history.pushState(null, '', '/no-existe');
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Página no encontrada');
  });

  it('el botón Atrás del navegador vuelve a la página anterior', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('link', { name: 'Crear cuenta' }));
    await screen.findByRole('heading', { level: 1, name: 'Crear cuenta' });
    window.history.pushState(null, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Simula tu crédito y entiende cada cuota' })).toBeTruthy();
  });
});
