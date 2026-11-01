/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Usuario } from '../../src/adapters/auth/ServicioCuenta';
import { App } from '../../src/ui/App';
import { PaginaSimulador } from '../../src/ui/paginas/Simulador';
import { SelectorTema } from '../../src/ui/SelectorTema';
import { aplicarTema, COLOR_BARRA, esTema, TEMAS } from '../../src/ui/tema';
import { servicioFalso } from './servicioFalso';

// Vitest vacía los .css importados (incluso con ?raw), así que se leen del disco.
const css = readFileSync(resolve(process.cwd(), 'src/ui/styles.css'), 'utf8');
const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

type Tokens = Record<string, string>;

/** Contenido del primer bloque `selector { … }` de styles.css (los bloques de tokens no tienen llaves anidadas). */
function cuerpo(selector: string): string {
  const inicio = css.indexOf(`${selector} {`);
  if (inicio < 0) {
    throw new Error(`styles.css no tiene el bloque ${selector}`);
  }
  const abre = css.indexOf('{', inicio);
  return css.slice(abre + 1, css.indexOf('}', abre));
}

function tokens(texto: string): Tokens {
  const salida: Tokens = {};
  for (const m of texto.matchAll(/--([a-z-]+):\s*([^;]+);/g)) {
    salida[m[1]!] = m[2]!.trim();
  }
  return salida;
}

const CLARO = tokens(cuerpo(':root'));
const OSCURO_SISTEMA = tokens(cuerpo(":root:not([data-tema='claro'])"));
const OSCURO_MANUAL = tokens(cuerpo(":root[data-tema='oscuro']"));
const TEMAS_CSS: [string, Tokens][] = [
  ['claro', CLARO],
  ['oscuro', OSCURO_MANUAL],
];

function valor(t: Tokens, nombre: string): string {
  const v = t[nombre];
  if (!v) {
    throw new Error(`Falta el token --${nombre}`);
  }
  return v;
}

function luminancia(hex: string): number {
  const canal = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(0) + 0.7152 * canal(1) + 0.0722 * canal(2);
}

function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

describe('Tema: tokens de color (WCAG 2.2 AA)', () => {
  it('todos los tokens de color son hexadecimales de 6 dígitos', () => {
    for (const [, t] of TEMAS_CSS) {
      for (const nombre of ['fondo', 'superficie', 'texto', 'texto-secundario', 'acento', 'sobre-acento', 'exito', 'error', 'advertencia', 'borde', 'borde-control']) {
        expect(valor(t, nombre)).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it('el tema oscuro del sistema y el manual tienen exactamente los mismos valores', () => {
    expect(OSCURO_SISTEMA).toEqual(OSCURO_MANUAL);
  });

  it('todo token del tema oscuro existe también en el claro', () => {
    for (const nombre of Object.keys(OSCURO_MANUAL)) {
      expect(CLARO[nombre], `--${nombre} falta en :root`).toBeDefined();
    }
  });

  it.each(TEMAS_CSS)('tema %s: el texto y los colores de estado tienen contraste de 4,5:1 o más sobre fondo y superficie', (_, t) => {
    for (const texto of ['texto', 'texto-secundario', 'acento', 'exito', 'error', 'advertencia']) {
      for (const base of ['fondo', 'superficie']) {
        const razon = contraste(valor(t, texto), valor(t, base));
        expect(razon, `--${texto} sobre --${base}: ${razon.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it.each(TEMAS_CSS)('tema %s: el texto sobre el acento (botones) tiene 4,5:1 o más', (_, t) => {
    expect(contraste(valor(t, 'sobre-acento'), valor(t, 'acento'))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(TEMAS_CSS)('tema %s: el borde de los controles y el foco tienen 3:1 o más (WCAG 1.4.11)', (_, t) => {
    for (const base of ['fondo', 'superficie']) {
      expect(contraste(valor(t, 'borde-control'), valor(t, base))).toBeGreaterThanOrEqual(3);
      expect(contraste(valor(t, 'acento'), valor(t, base))).toBeGreaterThanOrEqual(3);
    }
  });

  it('fuera de las declaraciones de variables no hay colores escritos a mano', () => {
    const sospechosas = css
      .split('\n')
      .filter((linea) => !/^\s*(--|\/?\*)/.test(linea))
      .filter((linea) => /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i.test(linea));
    expect(sospechosas).toEqual([]);
  });

  it('respeta la preferencia de movimiento reducido', () => {
    expect(css).toContain('prefers-reduced-motion');
  });

  it('los botones de ayuda y de tema miden al menos 44 px', () => {
    expect(cuerpo('.ayuda__boton')).toMatch(/min-width:\s*44px/);
    expect(cuerpo('.ayuda__boton')).toMatch(/min-height:\s*44px/);
    expect(cuerpo('.selector-tema__opcion')).toMatch(/min-height:\s*44px/);
  });

  it('el color de la barra del navegador coincide con --fondo de cada tema', () => {
    expect(COLOR_BARRA.claro).toBe(valor(CLARO, 'fondo'));
    expect(COLOR_BARRA.oscuro).toBe(valor(OSCURO_MANUAL, 'fondo'));
    expect(html).toContain(`media="(prefers-color-scheme: light)" content="${COLOR_BARRA.claro}"`);
    expect(html).toContain(`media="(prefers-color-scheme: dark)" content="${COLOR_BARRA.oscuro}"`);
  });
});

describe('Tema: aplicarTema', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-tema');
    document.head.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
  });

  function crearMetas() {
    const claro = document.createElement('meta');
    claro.setAttribute('name', 'theme-color');
    claro.setAttribute('media', '(prefers-color-scheme: light)');
    claro.setAttribute('content', COLOR_BARRA.claro);
    const oscuro = document.createElement('meta');
    oscuro.setAttribute('name', 'theme-color');
    oscuro.setAttribute('media', '(prefers-color-scheme: dark)');
    oscuro.setAttribute('content', COLOR_BARRA.oscuro);
    document.head.append(claro, oscuro);
    return { claro, oscuro };
  }

  it('«oscuro» y «claro» ponen data-tema y «sistema» lo quita', () => {
    aplicarTema('oscuro');
    expect(document.documentElement.getAttribute('data-tema')).toBe('oscuro');
    aplicarTema('claro');
    expect(document.documentElement.getAttribute('data-tema')).toBe('claro');
    aplicarTema('sistema');
    expect(document.documentElement.hasAttribute('data-tema')).toBe(false);
  });

  it('un tema manual fuerza el color de la barra en las dos metas; «sistema» las deja por su media query', () => {
    const { claro, oscuro } = crearMetas();
    aplicarTema('oscuro');
    expect(claro.getAttribute('content')).toBe(COLOR_BARRA.oscuro);
    expect(oscuro.getAttribute('content')).toBe(COLOR_BARRA.oscuro);
    aplicarTema('claro');
    expect(claro.getAttribute('content')).toBe(COLOR_BARRA.claro);
    expect(oscuro.getAttribute('content')).toBe(COLOR_BARRA.claro);
    aplicarTema('sistema');
    expect(claro.getAttribute('content')).toBe(COLOR_BARRA.claro);
    expect(oscuro.getAttribute('content')).toBe(COLOR_BARRA.oscuro);
  });

  it('no usa estilos en línea', () => {
    aplicarTema('oscuro');
    expect(document.documentElement.hasAttribute('style')).toBe(false);
  });

  it('esTema solo acepta los tres valores', () => {
    expect(TEMAS.map((t) => t.valor)).toEqual(['sistema', 'claro', 'oscuro']);
    expect(esTema('oscuro')).toBe(true);
    expect(esTema('morado')).toBe(false);
    expect(esTema(null)).toBe(false);
  });
});

describe('Tema: selector de la cabecera', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-tema');
  });

  it('muestra tres botones, marca el activo con aria-pressed y avisa al elegir otro', () => {
    const elegir = vi.fn();
    render(<SelectorTema tema="claro" alElegir={elegir} />);
    const grupo = screen.getByRole('group', { name: 'Tema de color' });
    expect(grupo.querySelectorAll('button')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Claro' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Oscuro' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Sistema' }).getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'Oscuro' }));
    expect(elegir).toHaveBeenCalledWith('oscuro');
  });

  it('en la app, pulsar «Oscuro» y luego «Sistema» cambia el atributo data-tema', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Oscuro' }));
    expect(document.documentElement.getAttribute('data-tema')).toBe('oscuro');
    expect(screen.getByRole('button', { name: 'Oscuro' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Claro' }));
    expect(document.documentElement.getAttribute('data-tema')).toBe('claro');
    fireEvent.click(screen.getByRole('button', { name: 'Sistema' }));
    expect(document.documentElement.hasAttribute('data-tema')).toBe(false);
  });

  it('sin sesión no intenta guardar nada', () => {
    const servicio = servicioFalso();
    render(<App servicioCuenta={servicio} />);
    fireEvent.click(screen.getByRole('button', { name: 'Oscuro' }));
    expect(servicio.guardarTema).not.toHaveBeenCalled();
  });

  it('con sesión guarda el tema en el perfil al elegirlo', async () => {
    const ana: Usuario = { nombre: 'Ana', correo: 'ana@correo.co' };
    const servicio = servicioFalso({ sesionActual: vi.fn(async (): Promise<Usuario | null> => ana) });
    render(<App servicioCuenta={servicio} />);
    await screen.findByText('Hola, Ana');
    fireEvent.click(screen.getByRole('button', { name: 'Oscuro' }));
    expect(servicio.guardarTema).toHaveBeenCalledWith('oscuro');
    expect(document.documentElement.getAttribute('data-tema')).toBe('oscuro');
  });

  it('con sesión aplica el tema guardado en el perfil', async () => {
    const ana: Usuario = { nombre: 'Ana', correo: 'ana@correo.co' };
    const servicio = servicioFalso({
      sesionActual: vi.fn(async (): Promise<Usuario | null> => ana),
      leerTema: vi.fn(async () => 'oscuro' as const),
    });
    render(<App servicioCuenta={servicio} />);
    await waitFor(() => expect(document.documentElement.getAttribute('data-tema')).toBe('oscuro'));
    expect(screen.getByRole('button', { name: 'Oscuro' }).getAttribute('aria-pressed')).toBe('true');
  });

  it.each(['sistema', 'claro', 'oscuro'] as const)('con el tema %s la página del simulador se muestra completa', (tema) => {
    aplicarTema(tema);
    render(<PaginaSimulador />);
    expect(screen.getByRole('heading', { level: 1, name: 'Simulador de créditos' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Simular' })).toBeTruthy();
  });
});
