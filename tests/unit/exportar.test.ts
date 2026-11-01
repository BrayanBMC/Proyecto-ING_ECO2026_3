// @vitest-environment node
import { exportarPdf } from '../../src/adapters/export/pdf';
import { exportarXlsx } from '../../src/adapters/export/xlsx';
import { armarReporte, calcularTasa, dec, generarTabla, type DatosReporte } from '../../src/core';

// pdfmake 0.3 es un build de navegador: espera `window`.
(globalThis as { window?: unknown }).window ??= globalThis;

function reporteReal() {
  const monto = dec(10_000_000);
  const tasa = calcularTasa({ valor: dec('0.015'), tipo: 'efectiva', frecuenciaTasa: 12, frecuenciaPago: 12 });
  const gracia = { tipo: 'muerta', periodos: 3 } as const;
  const abono = { periodo: 5, valor: dec(2_000_000), modo: 'reducir-plazo' } as const;
  const tabla = generarTabla({ capital: monto, tasa: tasa.periodica, plazo: 12, sistema: 'frances', escala: 0, gracia, abono });
  const datos: DatosReporte = {
    monto,
    plazo: 12,
    frecuenciaPago: 12,
    sistema: 'frances',
    gracia,
    abono,
    tasa,
    tabla,
    escala: 0,
    perfil: { nombre: 'Ana Pérez', institucion: 'Universidad Distrital' },
    generadoEn: new Date('2026-11-01T12:00:00Z'),
  };
  return armarReporte(datos, (x) => `$ ${x.toString()}`);
}

describe('adaptadores de exportación con las librerías reales (HU-17)', () => {
  it('criterio HU-17: exportarPdf devuelve un PDF válido', async () => {
    const blob = await exportarPdf(reporteReal());
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(blob.type).toBe('application/pdf');
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-');
  }, 30_000);

  it('criterio HU-17: exportarXlsx devuelve un libro de Excel válido (zip)', async () => {
    const blob = await exportarXlsx(reporteReal(), 0);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(bytes.length).toBeGreaterThan(100);
    // Un .xlsx es un zip: empieza con "PK".
    expect(String.fromCharCode(bytes[0]!, bytes[1]!)).toBe('PK');
  }, 30_000);
});
