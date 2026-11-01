import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../src/ui/App';
import { PaginaAnualidades } from '../../src/ui/paginas/Anualidades';
import { PaginaCompuesto } from '../../src/ui/paginas/Compuesto';
import { PaginaReparto } from '../../src/ui/paginas/Reparto';

/** Intl usa espacio duro entre "$" y el número; se normaliza para comparar. */
const texto = (el: Element | null) => (el?.textContent ?? '').replace(/\s/g, ' ');

function escribir(etiqueta: string, valor: string) {
  fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });
}

const pulsar = (nombre: string) => fireEvent.click(screen.getByRole('button', { name: nombre }));
const elegir = (etiqueta: string) => fireEvent.click(screen.getByLabelText(etiqueta));
const seccion = (titulo: string) => screen.getByRole('heading', { name: titulo }).closest('section')!;

describe('HU-18: interés compuesto', () => {
  it('criterio HU-18 (T10): con P = 1.000.000, S = 2.000.000 e i = 2 %, al despejar n se ven 35,0028 periodos', () => {
    render(<PaginaCompuesto />);
    elegir('Calcular los periodos (n)');
    escribir('Capital inicial P ($)', '1.000.000');
    escribir('Monto final S ($)', '2.000.000');
    escribir('Tasa de interés (%)', '2');
    pulsar('Calcular');
    expect(texto(seccion('Resultado'))).toContain('35,0028 periodos');
    // Los pasos explican el cálculo y el resultado fraccionario.
    expect(texto(seccion('Resultado'))).toContain('n = ln(S / P) / ln(1 + i)');
    expect(texto(seccion('Resultado'))).toContain('35,0028 está entre 35 y 36 periodos');
  });

  it('criterio HU-18: con una tasa nominal la convierte igual que el simulador (24 % NMV = 2 % mensual)', () => {
    render(<PaginaCompuesto />);
    escribir('Capital inicial P ($)', '1.000.000');
    escribir('Número de periodos (n)', '12');
    escribir('Tasa de interés (%)', '24');
    fireEvent.change(screen.getByLabelText('Tipo de tasa'), { target: { value: 'nominal-vencida' } });
    pulsar('Calcular');
    const resultado = texto(seccion('Resultado'));
    expect(resultado).toContain('$ 1.268.242');
    expect(resultado).toContain('2,0000 %');
    expect(resultado).toContain('26,8242 %');
  });

  it('despeja la tasa i y la muestra por periodo, efectiva anual y nominal', () => {
    render(<PaginaCompuesto />);
    elegir('Calcular la tasa (i)');
    escribir('Capital inicial P ($)', '1.000.000');
    escribir('Monto final S ($)', '1.268.241,79456');
    escribir('Número de periodos (n)', '12');
    expect(screen.queryByLabelText('Tasa de interés (%)')).toBeNull();
    pulsar('Calcular');
    const resultado = texto(seccion('Resultado'));
    expect(resultado).toContain('Tasa por mes');
    expect(resultado).toContain('2,0000 %');
    expect(resultado).toContain('Nominal anual');
    expect(resultado).toContain('24,0000 %');
  });

  it('despeja el valor presente P', () => {
    render(<PaginaCompuesto />);
    elegir('Calcular el valor presente (P)');
    escribir('Monto final S ($)', '1.218.994,42');
    escribir('Número de periodos (n)', '10');
    escribir('Tasa de interés (%)', '2');
    pulsar('Calcular');
    expect(texto(seccion('Resultado'))).toContain('$ 1.000.000');
  });

  it('sin datos muestra los errores y no calcula', () => {
    render(<PaginaCompuesto />);
    pulsar('Calcular');
    expect(screen.getByText(/Escribe el capital inicial/)).toBeTruthy();
    expect(screen.getByText(/Escribe los periodos/)).toBeTruthy();
    expect(screen.getByText('La tasa debe estar entre 0 % y 100 %.')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Resultado' })).toBeNull();
  });

  it('cambiar un dato borra el resultado anterior', () => {
    render(<PaginaCompuesto />);
    escribir('Capital inicial P ($)', '1.000.000');
    escribir('Número de periodos (n)', '12');
    escribir('Tasa de interés (%)', '2');
    pulsar('Calcular');
    expect(screen.getByRole('heading', { name: 'Resultado' })).toBeTruthy();
    escribir('Tasa de interés (%)', '3');
    expect(screen.queryByRole('heading', { name: 'Resultado' })).toBeNull();
  });

  it('avisa si el resultado supera el máximo', () => {
    render(<PaginaCompuesto />);
    escribir('Capital inicial P ($)', '1.000.000.000.000');
    escribir('Número de periodos (n)', '1200');
    escribir('Tasa de interés (%)', '100');
    fireEvent.change(screen.getByLabelText('Periodo de la tasa'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Duración de cada periodo'), { target: { value: '1' } });
    pulsar('Calcular');
    expect(screen.getByRole('alert').textContent).toContain('El resultado supera');
  });
});

describe('HU-19: anualidades', () => {
  it('criterio HU-19 (T9): con A = 500.000, i = 1 % y n = 12 muestra S = 6.404.664,02 y P = 5.683.814,12 anticipadas', () => {
    render(<PaginaAnualidades />);
    escribir('Cuota periódica A ($)', '500.000');
    escribir('Número de pagos (n)', '12');
    escribir('Tasa de interés (%)', '1');
    elegir('2 decimales');
    pulsar('Calcular');
    const tabla = screen.getByRole('table', { name: /^Cuota, valor futuro/ });
    const filas = within(tabla).getAllByRole('row');
    // Encabezado, cuota, valor futuro, valor presente.
    expect(filas).toHaveLength(4);
    expect(texto(filas[2]!)).toContain('Valor futuro (S)');
    expect(texto(filas[2]!)).toContain('$ 6.341.251,51'); // vencida
    expect(texto(filas[2]!)).toContain('$ 6.404.664,02'); // anticipada
    expect(texto(filas[3]!)).toContain('$ 5.683.814,12'); // anticipada
  });

  it('criterio HU-19: con i = 0 muestra S = P = A·n sin error', () => {
    render(<PaginaAnualidades />);
    escribir('Cuota periódica A ($)', '500.000');
    escribir('Número de pagos (n)', '12');
    escribir('Tasa de interés (%)', '0');
    pulsar('Calcular');
    const tabla = screen.getByRole('table', { name: /^Cuota, valor futuro/ });
    expect(texto(tabla).match(/\$ 6\.000\.000/g)).toHaveLength(4);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('calcula la cuota para una meta S', () => {
    render(<PaginaAnualidades />);
    elegir('Calcular la cuota (A) para una meta S');
    escribir('Valor futuro meta S ($)', '6.404.664,02');
    escribir('Número de pagos (n)', '12');
    escribir('Tasa de interés (%)', '1');
    elegir('2 decimales');
    pulsar('Calcular');
    const tabla = screen.getByRole('table', { name: /^Cuota, valor futuro/ });
    expect(texto(tabla)).toContain('$ 500.000,00');
  });

  it('calcula la cuota para un valor presente P', () => {
    render(<PaginaAnualidades />);
    elegir('Calcular la cuota (A) para un valor presente P');
    escribir('Valor presente P ($)', '5.683.814,12');
    escribir('Número de pagos (n)', '12');
    escribir('Tasa de interés (%)', '1');
    elegir('2 decimales');
    pulsar('Calcular');
    expect(texto(screen.getByRole('table', { name: /^Cuota, valor futuro/ }))).toContain('$ 500.000,00');
  });

  it('muestra los errores de validación', () => {
    render(<PaginaAnualidades />);
    escribir('Cuota periódica A ($)', '500.000');
    escribir('Número de pagos (n)', '13,5');
    escribir('Tasa de interés (%)', '1');
    pulsar('Calcular');
    expect(screen.getByText('El número de pagos debe ser un entero entre 1 y 360.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('avisa si el resultado supera el máximo', () => {
    render(<PaginaAnualidades />);
    escribir('Cuota periódica A ($)', '1.000.000.000.000');
    escribir('Número de pagos (n)', '360');
    escribir('Tasa de interés (%)', '100');
    fireEvent.change(screen.getByLabelText('Periodo de la tasa'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Frecuencia de pago'), { target: { value: '1' } });
    pulsar('Calcular');
    expect(screen.getByRole('alert').textContent).toContain('El resultado supera');
  });
});

describe('HU-20: reparto proporcional', () => {
  it('criterio HU-20 (T11): M = 1.000.000 e índices (1, 1, 1) dan 333.334; 333.333; 333.333 y la suma es exacta', () => {
    render(<PaginaReparto />);
    escribir('Monto a repartir ($)', '1.000.000');
    for (const k of [1, 2, 3]) {
      escribir(`Índice de la parte ${k}`, '1');
    }
    pulsar('Repartir');
    const tabla = screen.getByRole('table', { name: 'Parte que recibe cada índice' });
    const filas = within(tabla).getAllByRole('row');
    expect(filas).toHaveLength(5); // encabezado, 3 partes y total
    expect(texto(filas[1]!)).toContain('$ 333.334');
    expect(texto(filas[2]!)).toContain('$ 333.333');
    expect(texto(filas[3]!)).toContain('$ 333.333');
    expect(texto(filas[4]!)).toContain('$ 1.000.000');
    expect(texto(seccion('Resultado del reparto'))).toContain('La suma de las partes es exactamente $ 1.000.000');
  });

  it('criterio HU-20: un índice 0 en el reparto inverso muestra el error en ese índice', () => {
    render(<PaginaReparto />);
    escribir('Monto a repartir ($)', '1.000.000');
    elegir('Inverso: A mayor índice, menor parte.');
    escribir('Índice de la parte 1', '0');
    escribir('Índice de la parte 2', '1');
    escribir('Índice de la parte 3', '1');
    pulsar('Repartir');
    expect(screen.getByText(/Parte 1: en el reparto inverso el índice debe ser mayor que 0/)).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('el reparto compuesto pide un segundo índice por parte', () => {
    render(<PaginaReparto />);
    expect(screen.queryByLabelText('Segundo índice de la parte 1')).toBeNull();
    elegir('Compuesto: Proporcional al producto de dos índices.');
    escribir('Monto a repartir ($)', '300');
    escribir('Índice de la parte 1', '2');
    escribir('Segundo índice de la parte 1', '3');
    escribir('Índice de la parte 2', '1');
    escribir('Segundo índice de la parte 2', '3');
    // La parte 3 se quita para dejar un caso simple.
    pulsar('Quitar la parte 3');
    pulsar('Repartir');
    const tabla = screen.getByRole('table', { name: 'Parte que recibe cada índice' });
    expect(texto(tabla)).toContain('$ 200');
    expect(texto(tabla)).toContain('$ 100');
    expect(within(tabla).getByRole('columnheader', { name: 'Segundo índice' })).toBeTruthy();
  });

  it('permite agregar partes (hasta 20) y quitarlas (hasta quedar 2)', () => {
    render(<PaginaReparto />);
    pulsar('Agregar parte');
    expect(screen.getByLabelText('Índice de la parte 4')).toBeTruthy();
    pulsar('Quitar la parte 4');
    expect(screen.queryByLabelText('Índice de la parte 4')).toBeNull();
    pulsar('Quitar la parte 3');
    expect(screen.queryByRole('button', { name: /^Quitar la parte/ })).toBeNull();
    for (let k = 0; k < 18; k++) {
      pulsar('Agregar parte');
    }
    expect((screen.getByRole('button', { name: 'Agregar parte' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('usa el nombre de cada parte y marca las que recibieron un peso de ajuste', () => {
    render(<PaginaReparto />);
    escribir('Monto a repartir ($)', '10');
    escribir('Nombre de la parte 1', 'Ana');
    for (const k of [1, 2, 3]) {
      escribir(`Índice de la parte ${k}`, '1');
    }
    pulsar('Repartir');
    const tabla = screen.getByRole('table', { name: 'Parte que recibe cada índice' });
    expect(within(tabla).getByRole('rowheader', { name: 'Ana' })).toBeTruthy();
    expect(texto(tabla)).toContain('$ 4 +1 de ajuste');
  });

  it('con 2 decimales reparte centavos', () => {
    render(<PaginaReparto />);
    escribir('Monto a repartir ($)', '100');
    elegir('2 decimales');
    for (const k of [1, 2, 3]) {
      escribir(`Índice de la parte ${k}`, '1');
    }
    pulsar('Repartir');
    const tabla = screen.getByRole('table', { name: 'Parte que recibe cada índice' });
    expect(texto(tabla)).toContain('$ 33,34');
    expect(texto(tabla)).toContain('$ 33,33');
  });

  it('muestra el error general y el del monto', () => {
    render(<PaginaReparto />);
    escribir('Monto a repartir ($)', '100,5');
    escribir('Índice de la parte 1', '0');
    escribir('Índice de la parte 2', '0');
    escribir('Índice de la parte 3', '0');
    pulsar('Repartir');
    expect(screen.getByText('Con 0 decimales el monto debe ser un número entero.')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('La suma de los índices debe ser mayor que 0.');
  });

  it('cambiar el método limpia los errores y el resultado', () => {
    render(<PaginaReparto />);
    escribir('Monto a repartir ($)', '1.000');
    for (const k of [1, 2, 3]) {
      escribir(`Índice de la parte ${k}`, '1');
    }
    pulsar('Repartir');
    expect(screen.getByRole('heading', { name: 'Resultado del reparto' })).toBeTruthy();
    elegir('Inverso: A mayor índice, menor parte.');
    expect(screen.queryByRole('heading', { name: 'Resultado del reparto' })).toBeNull();
  });
});

describe('Inicio y rutas de las calculadoras', () => {
  afterEach(() => {
    cleanup();
    window.history.pushState(null, '', '/');
  });

  it('el inicio enlaza a las tres calculadoras', () => {
    render(<App />);
    const enlaces = screen.getAllByRole('link', { name: 'Abrir calculadora' });
    expect(enlaces.map((a) => a.getAttribute('href'))).toEqual(['/interes-compuesto', '/anualidades', '/reparto']);
    expect(screen.queryByText('En construcción')).toBeNull();
  });

  it.each([
    ['/interes-compuesto', 'Interés compuesto'],
    ['/anualidades', 'Anualidades'],
    ['/reparto', 'Reparto proporcional'],
  ])('la ruta %s abre la calculadora "%s"', (ruta, titulo) => {
    window.history.pushState(null, '', ruta);
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: titulo })).toBeTruthy();
  });
});
