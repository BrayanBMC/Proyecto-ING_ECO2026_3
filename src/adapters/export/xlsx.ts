import type { ReporteArmado } from '../../core';
import type { SheetData } from 'write-excel-file/browser';

/**
 * HU-17: genera el XLSX del reporte con write-excel-file, en el navegador.
 * Los montos van como número con formato COP, así Excel y LibreOffice pueden sumarlos.
 * La librería se carga con import dinámico desde el punto de entrada de navegador.
 */
export async function exportarXlsx(reporte: ReporteArmado, escala: 0 | 2): Promise<Blob> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const formato = escala === 2 ? '#,##0.00' : '#,##0';

  const filas: SheetData = [];
  filas.push([{ value: reporte.titulo, type: String, fontWeight: 'bold', columnSpan: reporte.columnas.length }]);
  for (const linea of reporte.encabezado) {
    filas.push([{ value: linea, type: String, columnSpan: reporte.columnas.length }]);
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

  const salida = await writeXlsxFile(filas, { columns: reporte.columnas.map(() => ({ width: 16 })) });
  return salida.toBlob();
}
