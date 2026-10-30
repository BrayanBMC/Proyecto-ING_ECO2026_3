import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ServicioCuenta } from '../../src/adapters/auth/ServicioCuenta';
import { App } from '../../src/ui/App';
import { PaginaRecuperar } from '../../src/ui/paginas/RecuperarContrasena';
import { fallo, servicioFalso } from './servicioFalso';

const ANA = { nombre: 'Ana Pérez', correo: 'ana@correo.co' };

function escribir(etiqueta: string, valor: string) {
  fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });
}

afterEach(() => {
  window.history.pushState(null, '', '/');
});

describe('HU-02: iniciar y cerrar sesión', () => {
  it('criterio HU-02: con contraseña incorrecta muestra "Correo o contraseña incorrectos" y sigue como invitado', async () => {
    const servicio = servicioFalso({ iniciarSesion: fallo('Correo o contraseña incorrectos.') });
    window.history.pushState(null, '', '/iniciar-sesion');
    render(<App servicioCuenta={servicio} />);

    escribir('Correo electrónico', 'ana@correo.co');
    escribir('Contraseña', 'otra cosa');
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Correo o contraseña incorrectos.');
    expect(servicio.iniciarSesion).toHaveBeenCalledWith('ana@correo.co', 'otra cosa');
    expect(screen.getByText('Invitado: no se guarda nada')).toBeTruthy();
  });

  it('valida el formulario antes de llamar al servicio', async () => {
    const servicio = servicioFalso();
    window.history.pushState(null, '', '/iniciar-sesion');
    render(<App servicioCuenta={servicio} />);

    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Escribe tu contraseña.')).toBeTruthy();
    expect(servicio.iniciarSesion).not.toHaveBeenCalled();
  });

  it('al entrar, la cabecera muestra al usuario y oculta "Invitado", "Iniciar sesión" y "Crear cuenta"', async () => {
    // Al abrir la app no hay sesión; después de entrar, sí.
    const sesionActual = vi.fn<ServicioCuenta['sesionActual']>().mockResolvedValueOnce(null).mockResolvedValue(ANA);
    const servicio = servicioFalso({ sesionActual });
    window.history.pushState(null, '', '/iniciar-sesion');
    render(<App servicioCuenta={servicio} />);

    escribir('Correo electrónico', 'ana@correo.co');
    escribir('Contraseña', 'una frase larga');
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Hola, Ana Pérez')).toBeTruthy();
    expect(window.location.pathname).toBe('/');
    expect(screen.queryByText('Invitado: no se guarda nada')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Crear cuenta' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Iniciar sesión' })).toBeNull();
  });

  it('si ya hay sesión al abrir la app, la cabecera muestra al usuario', async () => {
    const servicio = servicioFalso({ sesionActual: vi.fn(async () => ANA) });
    render(<App servicioCuenta={servicio} />);
    expect(await screen.findByRole('button', { name: 'Cerrar sesión' })).toBeTruthy();
  });

  it('criterio HU-02: al cerrar sesión vuelve a entrar como invitado', async () => {
    const servicio = servicioFalso({ sesionActual: vi.fn(async () => ANA) });
    window.history.pushState(null, '', '/registro');
    render(<App servicioCuenta={servicio} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));

    expect(await screen.findByText('Invitado: no se guarda nada')).toBeTruthy();
    expect(servicio.cerrarSesion).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Hola, Ana Pérez')).toBeNull();
    expect(window.location.pathname).toBe('/');
  });

  it('la página de inicio de sesión enlaza la recuperación de contraseña', () => {
    window.history.pushState(null, '', '/iniciar-sesion');
    render(<App servicioCuenta={servicioFalso()} />);
    expect(screen.getByRole('link', { name: '¿Olvidaste tu contraseña?' }).getAttribute('href')).toBe(
      '/recuperar-contrasena',
    );
  });

  it('sin configuración de Neon informa que no está disponible', () => {
    window.history.pushState(null, '', '/iniciar-sesion');
    render(<App />);
    expect(screen.getByRole('alert').textContent).toContain('no está disponible');
  });
});

describe('HU-03: recuperar la contraseña', () => {
  async function pedirCodigo(servicio: ReturnType<typeof servicioFalso>) {
    render(<PaginaRecuperar servicio={servicio} />);
    escribir('Correo electrónico', ' Ana@Correo.co ');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }));
    await screen.findByRole('heading', { name: 'Escribe el código y tu nueva contraseña' });
  }

  function escribirNueva(codigo: string, contrasena: string, confirmacion = contrasena) {
    escribir('Código', codigo);
    escribir('Nueva contraseña', contrasena);
    escribir('Repite la nueva contraseña', confirmacion);
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
  }

  it('criterio HU-03: con el código del correo define una nueva contraseña y ofrece entrar con ella', async () => {
    const servicio = servicioFalso();
    await pedirCodigo(servicio);
    expect(servicio.pedirCodigoRecuperacion).toHaveBeenCalledWith('ana@correo.co');

    escribirNueva('123456', 'otra frase larga');

    expect(await screen.findByRole('heading', { name: 'Contraseña actualizada' })).toBeTruthy();
    expect(servicio.restablecerContrasena).toHaveBeenCalledWith({
      correo: 'ana@correo.co',
      codigo: '123456',
      contrasena: 'otra frase larga',
    });
    expect(screen.getByRole('link', { name: 'Iniciar sesión' }).getAttribute('href')).toBe('/iniciar-sesion');
  });

  it('criterio HU-03: con un código usado o vencido avisa que no es válido y permite pedir otro', async () => {
    const servicio = servicioFalso({ restablecerContrasena: fallo('El código venció. Pide uno nuevo.') });
    await pedirCodigo(servicio);

    escribirNueva('123456', 'otra frase larga');
    expect((await screen.findByRole('alert')).textContent).toBe('El código venció. Pide uno nuevo.');

    fireEvent.click(screen.getByRole('button', { name: 'Enviar otro código' }));
    expect((await screen.findByRole('status')).textContent).toBe('Te enviamos un código nuevo a ana@correo.co.');
    expect(servicio.pedirCodigoRecuperacion).toHaveBeenCalledTimes(2);
  });

  it('rechaza un correo inválido sin llamar al servicio', async () => {
    const servicio = servicioFalso();
    render(<PaginaRecuperar servicio={servicio} />);
    escribir('Correo electrónico', 'ana');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }));
    expect(await screen.findByText('Escribe un correo válido, por ejemplo nombre@dominio.co.')).toBeTruthy();
    expect(servicio.pedirCodigoRecuperacion).not.toHaveBeenCalled();
  });

  it('muestra el error si no se pudo enviar el código', async () => {
    const servicio = servicioFalso({ pedirCodigoRecuperacion: fallo('Demasiados intentos.') });
    render(<PaginaRecuperar servicio={servicio} />);
    escribir('Correo electrónico', 'ana@correo.co');
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Demasiados intentos.');
  });

  it('valida código, longitud y confirmación antes de llamar al servicio', async () => {
    const servicio = servicioFalso();
    await pedirCodigo(servicio);

    escribirNueva('12a', 'corta', 'distinta');

    expect(await screen.findByText('El código tiene solo números. Revísalo en tu correo.')).toBeTruthy();
    expect(screen.getByText('La contraseña debe tener al menos 10 caracteres.')).toBeTruthy();
    expect(screen.getByText('Las contraseñas no coinciden.')).toBeTruthy();
    expect(servicio.restablecerContrasena).not.toHaveBeenCalled();
  });

  it('sin configuración de Neon informa que no está disponible', () => {
    render(<PaginaRecuperar servicio={null} />);
    expect(screen.getByRole('alert').textContent).toContain('no está disponible');
  });
});

describe('navegación HU-02/HU-03', () => {
  it('el botón "Iniciar sesión" de la cabecera abre la página de inicio de sesión', async () => {
    render(<App servicioCuenta={servicioFalso()} />);
    fireEvent.click(screen.getByRole('link', { name: 'Iniciar sesión' }));
    await waitFor(() => expect(window.location.pathname).toBe('/iniciar-sesion'));
    expect(screen.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeTruthy();
  });
});
