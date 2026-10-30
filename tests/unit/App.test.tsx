import { render, screen } from '@testing-library/react';
import { App, NOMBRE_APP } from '../../src/ui/App';

describe('ui/App: página inicial', () => {
  it('muestra el nombre de la aplicación en la cabecera', () => {
    render(<App />);
    expect(NOMBRE_APP).toBe('Amortiza');
    expect(screen.getByRole('banner').textContent).toContain(NOMBRE_APP);
  });

  it('el pie solo indica que es un proyecto académico', () => {
    render(<App />);
    expect(screen.getByRole('contentinfo').textContent?.trim()).toBe('Proyecto académico de Ingeniería Económica.');
  });

  it('muestra el título principal y los cuatro módulos del spec', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
    for (const nombre of ['Simulador de créditos', 'Interés compuesto', 'Anualidades', 'Reparto proporcional']) {
      expect(screen.getByRole('heading', { level: 3, name: nombre })).toBeTruthy();
    }
  });

  it('indica que el modo invitado no guarda datos', () => {
    render(<App />);
    expect(screen.getByRole('status').textContent).toContain('no se guarda nada');
  });

  it('ofrece el enlace "Saltar al contenido" para navegación con teclado', () => {
    render(<App />);
    const enlace = screen.getByRole('link', { name: 'Saltar al contenido' });
    expect(enlace.getAttribute('href')).toBe('#contenido');
  });
});
