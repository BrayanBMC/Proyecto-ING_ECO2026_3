import { fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../../src/ui/App';
import { PaginaSimulador } from '../../src/ui/paginas/Simulador';
import { servicioFalso } from './servicioFalso';

/** Intl usa espacio duro entre "$" y el número; se normaliza para comparar. */
const texto = (el: Element | null) => (el?.textContent ?? '').replace(/\s/g, ' ');

function escribir(etiqueta: string, valor: string) {
  fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });
}

function elegir(etiqueta: string, valor: string) {
  fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });
}

function llenar({ monto = '10.000.000', plazo = '12', tasa = '1,5' } = {}) {
  escribir('Monto del crédito ($)', monto);
  escribir('Número de cuotas', plazo);
  escribir('Tasa de interés (%)', tasa);
}

const simular = () => fireEvent.click(screen.getByRole('button', { name: 'Simular' }));

const tablaAmortizacion = () => screen.getByRole('table', { name: /^Cuotas por/ });

const celda = (fila: number, columna: number) =>
  within(tablaAmortizacion()).getAllByRole('row')[fila + 1]!.querySelectorAll('th, td')[columna] ?? null;

/** Celda de la tabla "Comparar sistemas": fila por concepto, columna 1 = Francés, 2 = Alemán. */
const comparada = (concepto: string, columna: 1 | 2) =>
  within(screen.getByRole('table', { name: 'Francés frente a Alemán' }))
    .getByRole('rowheader', { name: concepto })
    .parentElement!.querySelectorAll('th, td')[columna] ?? null;

describe('HU-07: datos del crédito', () => {
  it('criterio HU-07: con plazo 361 o monto 0, al salir del campo muestra el rango y no simula', () => {
    render(<PaginaSimulador />);
    escribir('Monto del crédito ($)', '0');
    fireEvent.blur(screen.getByLabelText('Monto del crédito ($)'));
    expect(screen.getByText('El monto debe estar entre $ 1 y $ 1.000.000.000.000.')).toBeTruthy();

    escribir('Número de cuotas', '361');
    fireEvent.blur(screen.getByLabelText('Número de cuotas'));
    expect(screen.getByText('El plazo debe ser un número entero de cuotas entre 1 y 360.')).toBeTruthy();

    escribir('Tasa de interés (%)', '2');
    simular();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('al corregir el campo y salir, el error desaparece', () => {
    render(<PaginaSimulador />);
    escribir('Número de cuotas', '361');
    fireEvent.blur(screen.getByLabelText('Número de cuotas'));
    escribir('Número de cuotas', '12');
    fireEvent.blur(screen.getByLabelText('Número de cuotas'));
    expect(screen.queryByText('El plazo debe ser un número entero de cuotas entre 1 y 360.')).toBeNull();
  });

  it('criterio HU-07: con datos válidos, "Simular" pasa al cálculo de la tasa', () => {
    render(<PaginaSimulador />);
    llenar({ tasa: '24' });
    simular();
    expect(screen.getByRole('heading', { name: 'Tasa que se aplica' })).toBeTruthy();
  });
});

describe('HU-08 y HU-09: tasa equivalente', () => {
  it('criterio HU-08: 24 % nominal mensual vencida → EA 26,8242 % y tasa mensual 2,0000 %', () => {
    render(<PaginaSimulador />);
    llenar({ tasa: '24' });
    simular();
    const tasa = screen.getByRole('heading', { name: 'Tasa que se aplica' }).closest('section')!;
    expect(texto(tasa)).toContain('24,0000 % NMV');
    expect(texto(tasa)).toContain('26,8242 %');
    expect(texto(within(tasa).getByText('Tasa por mes').nextElementSibling)).toBe('2,0000 %');
  });

  it('criterio HU-08: tasa fuera de 0,01-100 % muestra el error en el campo', () => {
    render(<PaginaSimulador />);
    llenar({ tasa: '150' });
    simular();
    expect(screen.getByText('La tasa debe estar entre 0,01 % y 100 %.')).toBeTruthy();
    expect(screen.getByLabelText('Tasa de interés (%)').getAttribute('aria-invalid')).toBe('true');
  });

  it('criterio HU-09: 30 % trimestral anticipada → EA 36,5945 % y muestra el paso i_v = i_a / (1 − i_a)', () => {
    render(<PaginaSimulador />);
    llenar({ tasa: '30' });
    elegir('Tipo de tasa', 'nominal-anticipada');
    elegir('Capitalización de la tasa', '4');
    simular();
    const tasa = screen.getByRole('heading', { name: 'Tasa que se aplica' }).closest('section')!;
    expect(texto(tasa)).toContain('30,0000 % NTA');
    expect(texto(tasa)).toContain('36,5945 %');
    expect(texto(tasa)).toContain('Tasa vencida equivalente: i_v = i_a / (1 − i_a)');
  });

  it('criterio HU-09: con j_a/m ≥ 1 muestra el error y no genera la tabla', () => {
    render(<PaginaSimulador />);
    llenar({ tasa: '100' });
    elegir('Tipo de tasa', 'nominal-anticipada');
    elegir('Capitalización de la tasa', '1');
    simular();
    expect(screen.getByText('Con tasa anticipada, la tasa del periodo (j_a / m) debe ser menor que 100 %.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });
});

describe('HU-10: tabla de amortización', () => {
  it('criterio HU-10: Francés 10.000.000 al 1,5 % mensual en 12 cuotas → fila 0 con el saldo, cuota 916.800 y saldo final 0', () => {
    render(<PaginaSimulador />);
    llenar();
    elegir('Tipo de tasa', 'efectiva');
    elegir('Periodo de la tasa', '12');
    simular();

    expect(within(tablaAmortizacion()).getAllByRole('row')).toHaveLength(14); // encabezado + filas 0 a 12
    expect(texto(celda(0, 0))).toBe('0');
    expect(texto(celda(0, 4))).toBe('$ 10.000.000');
    expect(texto(celda(1, 1))).toBe('$ 916.800');
    expect(texto(celda(12, 4))).toBe('$ 0');
  });

  it('criterio HU-10: en Alemán el abono es constante y la cuota decrece', () => {
    render(<PaginaSimulador />);
    llenar({ monto: '12.000.000', tasa: '1' });
    elegir('Tipo de tasa', 'efectiva');
    elegir('Periodo de la tasa', '12');
    fireEvent.click(screen.getByLabelText('Alemán (abono fijo)'));
    simular();

    for (let k = 1; k <= 12; k++) {
      expect(texto(celda(k, 3))).toBe('$ 1.000.000');
    }
    expect(texto(celda(1, 1))).toBe('$ 1.120.000');
    expect(texto(celda(12, 1))).toBe('$ 1.010.000');
  });

  it('con 2 decimales muestra la cuota de Excel 916.799,93', () => {
    render(<PaginaSimulador />);
    llenar();
    elegir('Tipo de tasa', 'efectiva');
    elegir('Periodo de la tasa', '12');
    fireEvent.click(screen.getByLabelText('2 decimales'));
    simular();
    expect(texto(celda(1, 1))).toBe('$ 916.799,93');
  });

  it('HU-04: con sesión usa la escala del perfil', async () => {
    const servicio = servicioFalso({
      leerPerfil: vi.fn(async () => ({
        ok: true as const,
        perfil: { nombre: 'Ana', institucion: null, programa: null, escala: 2 as const, baseDiaria: 360 as const },
      })),
    });
    render(<PaginaSimulador servicio={servicio} usuario={{ nombre: 'Ana', correo: 'ana@correo.co' }} />);
    await vi.waitFor(() => expect((screen.getByLabelText('2 decimales') as HTMLInputElement).checked).toBe(true));
  });

  it('HU-06: el invitado abre el simulador desde el inicio sin que se le pida cuenta', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('link', { name: 'Abrir simulador' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Simulador de créditos' })).toBeTruthy();
    window.history.pushState(null, '', '/');
  });
});

describe('HU-11: comparar sistemas', () => {
  it('criterio HU-11: "Comparar sistemas" muestra cuota inicial, intereses y total pagado de ambos, y el sobrecosto Δ', () => {
    render(<PaginaSimulador />);
    llenar({ monto: '12.000.000', tasa: '1' });
    elegir('Tipo de tasa', 'efectiva');
    elegir('Periodo de la tasa', '12');
    simular();

    fireEvent.click(screen.getByText('Comparar sistemas'));

    // Alemán (T4): cuota inicial 1.120.000, intereses 780.000, total 12.780.000.
    expect(texto(comparada('Cuota inicial', 2))).toBe('$ 1.120.000');
    expect(texto(comparada('Total de intereses', 2))).toBe('$ 780.000');
    expect(texto(comparada('Total pagado', 2))).toBe('$ 12.780.000');
    // Francés: cuota fija 1.066.186 (PAGO(1%;12;-12000000) = 1.066.185,87).
    expect(texto(comparada('Cuota inicial', 1))).toBe('$ 1.066.186');
    expect(texto(screen.getByText(/Sobrecosto del Francés/).closest('p'))).toMatch(
      /Sobrecosto del Francés \(Δ\): \d+,\d{2} % más de intereses que el Alemán/,
    );
  });
});
