import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from '../../src/ui/App';
import { FICHA_PROYECTO } from '../../src/ui/Bienvenida';

afterEach(() => {
  cleanup();
  window.history.pushState(null, '', '/');
});

const cuadro = () => screen.getByRole('dialog', { name: 'Simulador de créditos e ingeniería económica' });

describe('Ventana de bienvenida', () => {
  it('no aparece si la app no la pide (las demás pruebas y páginas no la ven)', () => {
    render(<App />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('muestra el título, el autor, la universidad, la carrera y el semestre', () => {
    render(<App bienvenida />);
    const texto = cuadro().textContent ?? '';
    expect(texto).toContain('Simulador de créditos e ingeniería económica');
    expect(FICHA_PROYECTO).toEqual({
      autor: 'Brayan Acosta Parrado',
      universidad: 'Universidad Distrital Francisco José de Caldas',
      carrera: 'Ingeniería en Telemática',
      semestre: '2026-3',
    });
    for (const dato of Object.values(FICHA_PROYECTO)) {
      expect(texto).toContain(dato);
    }
  });

  it('avisa que los cálculos son educativos y explica el botón «?» y el selector de tema', () => {
    render(<App bienvenida />);
    const texto = cuadro().textContent ?? '';
    expect(texto).toContain('educativos');
    expect(texto).toContain('?');
    expect(texto).toContain('Sistema, Claro y Oscuro');
  });

  it('es un <dialog> con título como encabezado de nivel 2 (la página sigue teniendo un solo h1)', () => {
    render(<App bienvenida />);
    expect(cuadro().tagName).toBe('DIALOG');
    expect(cuadro().getAttribute('aria-labelledby')).toBe('titulo-bienvenida');
    expect(screen.getByRole('heading', { level: 2, name: 'Simulador de créditos e ingeniería económica' })).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('el foco inicial queda en el título de la ventana', () => {
    render(<App bienvenida />);
    expect(document.activeElement?.id).toBe('titulo-bienvenida');
  });

  it('«Entendido» la cierra', async () => {
    render(<App bienvenida />);
    fireEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('Esc la cierra (el navegador cierra el <dialog> y React lo desmonta)', async () => {
    render(<App bienvenida />);
    const dialogo = cuadro() as HTMLDialogElement;
    // jsdom no cierra con Esc por sí solo: se simula el evento que lanza el navegador.
    dialogo.dispatchEvent(new Event('close'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('enlaza a la política de datos y la ventana se cierra al seguir el enlace', async () => {
    render(<App bienvenida />);
    const enlace = within(cuadro()).getByRole('link', { name: 'Política de datos' });
    expect(enlace.getAttribute('href')).toBe('/politica-de-datos');
    fireEvent.click(enlace);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(window.location.pathname).toBe('/politica-de-datos');
  });

  it('enlaza al simulador, donde está «¿Cómo se calculó?»', async () => {
    render(<App bienvenida />);
    const enlace = within(cuadro()).getByRole('link', { name: /¿Cómo se calculó\?/ });
    expect(enlace.getAttribute('href')).toBe('/simulador');
    fireEvent.click(enlace);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(window.location.pathname).toBe('/simulador');
  });

  it('no vuelve a abrirse al navegar dentro de la misma carga de la página', async () => {
    render(<App bienvenida />);
    fireEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(screen.getAllByRole('link', { name: 'Mis simulaciones' })[0]!);
    expect(window.location.pathname).toBe('/simulaciones');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('reaparece al recargar: el estado vive solo en memoria y no se guarda nada en el navegador', async () => {
    const primera = render(<App bienvenida />);
    fireEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    primera.unmount();
    render(<App bienvenida />);
    expect(cuadro()).toBeTruthy();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(document.cookie).toBe('');
  });
});
