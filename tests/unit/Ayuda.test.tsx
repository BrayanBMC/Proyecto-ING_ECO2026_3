import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ServicioCuenta, Usuario } from '../../src/adapters/auth/ServicioCuenta';
import { PLAZO_MAXIMO, type ParametrosCredito, type SimulacionGuardada } from '../../src/core';
import { Ayuda } from '../../src/ui/ayuda/Ayuda';
import { contarPalabras, GLOSARIO, type TerminoId } from '../../src/ui/ayuda/glosario';
import { PaginaAnualidades } from '../../src/ui/paginas/Anualidades';
import { PaginaCompuesto } from '../../src/ui/paginas/Compuesto';
import { PaginaMisSimulaciones } from '../../src/ui/paginas/MisSimulaciones';
import { PaginaPerfil } from '../../src/ui/paginas/Perfil';
import { PaginaReparto } from '../../src/ui/paginas/Reparto';
import { PaginaSimulador } from '../../src/ui/paginas/Simulador';
import { vaciarSesionInvitado } from '../../src/ui/sesionInvitado';
import { servicioFalso } from './servicioFalso';

/** Todo el código de la interfaz como texto, para comprobar que cada entrada del glosario se usa. */
const FUENTES = import.meta.glob<string>('../../src/ui/**/*.tsx', { query: '?raw', import: 'default', eager: true });

const ids = Object.keys(GLOSARIO) as TerminoId[];

afterEach(() => {
  cleanup();
  vaciarSesionInvitado();
  window.history.pushState(null, '', '/');
});

describe('Glosario de la ayuda', () => {
  it('cada entrada tiene nombre y una explicación corta de máximo 45 palabras', () => {
    for (const id of ids) {
      const t = GLOSARIO[id];
      expect(t.nombre.trim().length, `${id}: nombre`).toBeGreaterThan(0);
      expect(t.corta.trim().length, `${id}: corta`).toBeGreaterThan(0);
      expect(contarPalabras(t.corta), `${id}: palabras de «corta»`).toBeLessThanOrEqual(45);
    }
  });

  it('ningún texto queda vacío ni con huecos de plantilla', () => {
    for (const id of ids) {
      for (const [campo, valor] of Object.entries(GLOSARIO[id])) {
        if (typeof valor === 'string') {
          expect(valor.trim().length, `${id}.${campo}`).toBeGreaterThan(0);
          expect(valor, `${id}.${campo}`).not.toMatch(/undefined|NaN|\[object|\$\{/);
        }
      }
    }
  });

  it('los rangos salen de las constantes del motor, no están copiados a mano', () => {
    expect(GLOSARIO.plazo.rango).toContain(String(PLAZO_MAXIMO));
    expect(GLOSARIO.tasa.rango).toContain('0,01 %');
    expect(GLOSARIO.tasa.rango).toContain('100 %');
  });

  it('cada entrada se usa en alguna pantalla (no quedan términos huérfanos)', () => {
    const codigo = Object.entries(FUENTES)
      .filter(([ruta]) => !ruta.endsWith('glosario.ts'))
      .map(([, texto]) => texto)
      .join('\n');
    const huerfanos = ids.filter((id) => !new RegExp(`['"]${id}['"]`).test(codigo));
    expect(huerfanos).toEqual([]);
  });
});

describe('Ayuda: comportamiento del botón «?»', () => {
  const globo = () => document.querySelector<HTMLElement>('.ayuda__globo')!;
  const boton = (id: TerminoId = 'monto') => screen.getByRole('button', { name: `¿Qué es «${GLOSARIO[id].nombre}»?` });

  it('empieza cerrado, con el globo oculto y los atributos de accesibilidad enlazados', () => {
    render(<Ayuda id="monto" />);
    const b = boton();
    expect(b.getAttribute('aria-expanded')).toBe('false');
    expect(globo().hidden).toBe(true);
    expect(b.getAttribute('aria-controls')).toBe(globo().id);
    const descripcion = document.getElementById(b.getAttribute('aria-describedby')!)!;
    expect(descripcion.textContent).toBe(GLOSARIO.monto.corta);
  });

  it('el foco del teclado abre el globo', () => {
    render(<Ayuda id="monto" />);
    fireEvent.focus(boton());
    expect(boton().getAttribute('aria-expanded')).toBe('true');
    expect(globo().hidden).toBe(false);
  });

  it('Esc cierra el globo y el foco queda en el botón', () => {
    render(<Ayuda id="monto" />);
    fireEvent.focus(boton());
    fireEvent.keyDown(boton(), { key: 'Escape' });
    expect(boton().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(boton());
  });

  it('un clic o toque fija el globo y otro clic lo cierra (no depende del hover)', () => {
    render(<Ayuda id="monto" />);
    fireEvent.click(boton());
    expect(boton().getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(boton());
    expect(boton().getAttribute('aria-expanded')).toBe('false');
  });

  it('tocar fuera lo cierra, pero tocar dentro no', () => {
    render(<Ayuda id="monto" />);
    fireEvent.click(boton());
    fireEvent.pointerDown(globo());
    expect(boton().getAttribute('aria-expanded')).toBe('true');
    fireEvent.pointerDown(document.body);
    expect(boton().getAttribute('aria-expanded')).toBe('false');
  });

  it('salir del botón con Tab cierra el globo', () => {
    render(
      <>
        <Ayuda id="monto" />
        <button type="button">Otro</button>
      </>,
    );
    fireEvent.focus(boton());
    fireEvent.blur(boton(), { relatedTarget: screen.getByRole('button', { name: 'Otro' }) });
    expect(boton().getAttribute('aria-expanded')).toBe('false');
  });

  it('el mouse encima abre el globo y al salir lo cierra', () => {
    render(<Ayuda id="monto" />);
    const raiz = document.querySelector('.ayuda')!;
    fireEvent.pointerEnter(raiz, { pointerType: 'mouse' });
    expect(boton().getAttribute('aria-expanded')).toBe('true');
    fireEvent.pointerLeave(raiz, { pointerType: 'mouse' });
    expect(boton().getAttribute('aria-expanded')).toBe('false');
  });

  it('«Saber más» abre el cuadro con el ejemplo y el rango, y al cerrarlo el foco vuelve al botón', async () => {
    render(<Ayuda id="monto" />);
    fireEvent.click(boton());
    fireEvent.click(screen.getByRole('button', { name: 'Saber más' }));
    const cuadro = await screen.findByRole('dialog', { name: GLOSARIO.monto.nombre });
    expect(cuadro.textContent).toContain(GLOSARIO.monto.ejemplo);
    expect(cuadro.textContent).toContain(GLOSARIO.monto.rango);
    expect(cuadro.textContent).toContain('no reemplaza la asesoría financiera');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(boton()));
  });

  it('no usa estilos en línea (CSP) ni guarda nada en el navegador', () => {
    render(<Ayuda id="monto" />);
    fireEvent.click(boton());
    expect(document.querySelector('[style]')).toBeNull();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });
});

/** Campos, grupos de opciones y cifras de `raiz` que NO tienen su botón «?». */
function sinAyuda(raiz: ParentNode): string[] {
  const faltan: string[] = [];
  raiz.querySelectorAll('.campo').forEach((campo) => {
    if (!campo.querySelector('.ayuda__boton')) {
      faltan.push(`campo «${campo.querySelector('label')?.textContent ?? campo.textContent?.slice(0, 30)}»`);
    }
  });
  raiz.querySelectorAll('fieldset.opciones').forEach((grupo) => {
    if (!grupo.querySelector('legend .ayuda__boton')) {
      faltan.push(`grupo «${grupo.querySelector('legend')?.textContent}»`);
    }
  });
  raiz.querySelectorAll('.cifras dt').forEach((dt) => {
    if (!dt.querySelector('.ayuda__boton')) {
      faltan.push(`cifra «${dt.textContent}»`);
    }
  });
  return faltan;
}

const escribir = (etiqueta: string, valor: string) => fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });
const pulsar = (nombre: string) => fireEvent.click(screen.getByRole('button', { name: nombre }));
const elegir = (etiqueta: string) => fireEvent.click(screen.getByLabelText(etiqueta));

describe('Ayuda: cada campo, grupo y resultado tiene su «?» en el glosario', () => {
  it('simulador: formulario, resultados, gracia, abono, usura, comparación y guardar/compartir', async () => {
    const { container } = render(<PaginaSimulador />);
    expect(sinAyuda(container)).toEqual([]);

    escribir('Monto del crédito ($)', '12.000.000');
    escribir('Número de cuotas', '12');
    escribir('Tasa de interés (%)', '24');
    escribir('Periodos de gracia', '2');
    pulsar('Simular');
    expect(sinAyuda(container)).toEqual([]);

    pulsar('Comparar sistemas');
    expect(container.querySelector('.comparar-delta')!.parentElement!.querySelector('.ayuda__boton')).not.toBeNull();

    pulsar('Copiar enlace');
    await screen.findByLabelText('Enlace para compartir');
    expect(sinAyuda(container)).toEqual([]);
  });

  it('interés compuesto: las cuatro incógnitas', () => {
    const { container } = render(<PaginaCompuesto />);
    for (const incognita of ['Calcular el valor presente (P)', 'Calcular la tasa (i)', 'Calcular los periodos (n)', 'Calcular el valor futuro (S)']) {
      elegir(incognita);
      expect(sinAyuda(container), incognita).toEqual([]);
    }
  });

  it('interés compuesto: el resultado trae ayuda en cada cifra', () => {
    const { container } = render(<PaginaCompuesto />);
    escribir('Capital inicial P ($)', '1.000.000');
    escribir('Número de periodos (n)', '12');
    escribir('Tasa de interés (%)', '2');
    pulsar('Calcular');
    expect(container.querySelectorAll('.cifras dt').length).toBeGreaterThan(0);
    expect(sinAyuda(container)).toEqual([]);
  });

  it('anualidades: el formulario con cada objetivo y el resultado', () => {
    const { container } = render(<PaginaAnualidades />);
    expect(sinAyuda(container)).toEqual([]);
    elegir('Calcular la cuota (A) para una meta S');
    expect(sinAyuda(container)).toEqual([]);
    elegir('Calcular la cuota (A) para un valor presente P');
    expect(sinAyuda(container)).toEqual([]);
    elegir('Calcular S y P a partir de la cuota (A)');
    escribir('Cuota periódica A ($)', '500.000');
    escribir('Número de pagos (n)', '12');
    escribir('Tasa de interés (%)', '12');
    pulsar('Calcular');
    expect(container.querySelectorAll('.cifras dt').length).toBeGreaterThan(0);
    expect(sinAyuda(container)).toEqual([]);
  });

  it('reparto: método simple y compuesto, con varias partes', () => {
    const { container } = render(<PaginaReparto />);
    expect(sinAyuda(container)).toEqual([]);
    const compuesto = Array.from(container.querySelectorAll('input[name="metodo"]')).at(-1)!;
    fireEvent.click(compuesto);
    pulsar('Agregar parte');
    expect(container.querySelectorAll('input[name$="-y"]').length).toBeGreaterThan(0);
    expect(sinAyuda(container)).toEqual([]);
  });

  it('perfil: datos, preferencias y eliminar cuenta', async () => {
    const usuario: Usuario = { nombre: 'Ana Pérez', correo: 'ana@correo.co' };
    const { container } = render(
      <PaginaPerfil servicio={servicioFalso()} usuario={usuario} alCambiarSesion={async () => {}} descargar={vi.fn()} />,
    );
    await screen.findByLabelText('Nombre');
    expect(sinAyuda(container)).toEqual([]);
  });

  it('mis simulaciones: las cifras de cada tarjeta y el campo de renombrar', async () => {
    const parametros: ParametrosCredito = {
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
    };
    const guardada: SimulacionGuardada = { id: 'a', nombre: 'Crédito A', parametros, actualizadoEn: '2026-11-01T15:00:00.000Z' };
    const servicio = servicioFalso({
      listarSimulaciones: vi.fn<ServicioCuenta['listarSimulaciones']>(async () => ({ ok: true, simulaciones: [guardada] })),
    });
    const { container } = render(<PaginaMisSimulaciones servicio={servicio} usuario={{ nombre: 'Ana', correo: 'ana@correo.co' }} />);
    await screen.findByRole('heading', { level: 2, name: 'Crédito A' });
    expect(container.querySelectorAll('.cifras dt').length).toBeGreaterThan(0);
    expect(sinAyuda(container)).toEqual([]);
    pulsar('Renombrar Crédito A');
    expect(sinAyuda(container)).toEqual([]);
  });
});
