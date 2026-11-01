import type { ReporteArmado } from '../../core';

/**
 * HU-17: genera el XLSX del reporte con write-excel-file, en el navegador.
 * Los montos van como número con formato COP, así Excel y LibreOffice pueden sumarlos.
 * La librería se carga con import dinámico.
 */
export async function exportarXlsx(reporte: ReporteArmado, escala: 0 | 2): Promise<Blob> {
  const { default: writeXlsxFile } = await import('write-excel-file');
  const formato = escala === 2 ? '#,##0.00' : '#,##0';

  type Celda = { value: string | number | null; type?: typeof String | typeof Number; fontWeight?: 'bold'; format?: string; span?: number };

  const filas: Celda[][] = [];
  filas.push([{ value: reporte.titulo, type: String, fontWeight: 'bold', span: reporte.columnas.length }]);
  for (const linea of reporte.encabezado) {
    filas.push([{ value: linea, type: String, span: reporte.columnas.length }]);
  }
  filas.push([]);

  for (const p of [...reporte.parametros, ...reporte.resumen]) {
    filas.push([{ value: p.etiqueta, type: String, fontWeight: 'bold' }, { value: p.valor, type: String }]);
  }
  filas.push([]);

  filas.push(reporte.columnas.map((texto) => ({ value: texto, type: String, fontWeight: 'bold' })));
  for (const fila of reporte.filasNumero) {
    filas.push(
      fila.map((valor, i) =>
        i === 0 ? { value: valor, type: Number } : { value: valor, type: Number, format: formato },
      ),
    );
  }

  return writeXlsxFile(filas, { columns: reporte.columnas.map(() => ({ width: 16 })) }) as Promise<Blob>;
}
