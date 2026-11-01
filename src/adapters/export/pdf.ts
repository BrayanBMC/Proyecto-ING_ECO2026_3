import type { ReporteArmado } from '../../core';

/**
 * HU-17: genera el PDF del reporte con pdfmake, en el navegador.
 * pdfmake y sus fuentes se cargan con import dinámico, así no entran al bundle inicial.
 * La escala de grises del encabezado y la tabla sigue la paleta de la sección 6.
 */
export async function exportarPdf(reporte: ReporteArmado): Promise<Blob> {
  const [{ default: pdfMake }, vfs] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')]);
  // En 0.3 las fuentes vienen como { default: { ... } } o directamente como el objeto.
  pdfMake.vfs = (vfs as { default?: { vfs: Record<string, string> }; vfs?: Record<string, string> }).default?.vfs ??
    (vfs as unknown as { vfs: Record<string, string> }).vfs;

  const anchoColumnas = reporte.columnas.map((_, i) => (i === 0 ? 'auto' : '*'));
  const cuerpoTabla = [
    reporte.columnas.map((texto) => ({ text: texto, style: 'th' })),
    ...reporte.filasTexto.map((fila) => fila.map((celda, i) => ({ text: celda, alignment: i === 0 ? 'left' : 'right' }))),
  ];

  const definicion = {
    info: { title: reporte.titulo },
    pageMargins: [36, 48, 36, 48] as [number, number, number, number],
    defaultStyle: { fontSize: 9 },
    content: [
      { text: reporte.titulo, style: 'titulo' },
      { text: reporte.encabezado.join('\n'), style: 'encabezado' },
      {
        style: 'bloque',
        table: {
          widths: ['auto', '*'],
          body: reporte.parametros.map((p) => [{ text: p.etiqueta, bold: true }, { text: p.valor, alignment: 'right' }]),
        },
        layout: 'lightHorizontalLines',
      },
      {
        style: 'bloque',
        table: {
          widths: ['auto', '*'],
          body: reporte.resumen.map((p) => [{ text: p.etiqueta, bold: true }, { text: p.valor, alignment: 'right' }]),
        },
        layout: 'noBorders',
      },
      {
        table: { headerRows: 1, widths: anchoColumnas, body: cuerpoTabla },
        layout: 'lightHorizontalLines',
      },
    ],
    styles: {
      titulo: { fontSize: 16, bold: true, margin: [0, 0, 0, 4] },
      encabezado: { fontSize: 10, color: '#4b5866', margin: [0, 0, 0, 12] },
      bloque: { margin: [0, 0, 0, 12] },
      th: { bold: true, fillColor: '#0a6b63', color: '#ffffff' },
    },
    footer: (pagina: number, total: number) => ({
      text: `Proyecto académico de Ingeniería Económica · Página ${pagina} de ${total}`,
      alignment: 'center',
      fontSize: 8,
      color: '#4b5866',
      margin: [0, 8, 0, 0],
    }),
  };

  return new Promise<Blob>((resolve) => {
    pdfMake.createPdf(definicion).getBlob((blob: Blob) => resolve(blob));
  });
}
