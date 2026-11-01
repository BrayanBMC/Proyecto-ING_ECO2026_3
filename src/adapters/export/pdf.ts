import type { ReporteArmado } from '../../core';

/**
 * Tipo mínimo de la instancia de pdfmake que usamos.
 * Evitamos el tipo estricto TDocumentDefinitions de @types/pdfmake: la definición
 * se arma como objeto plano y pdfmake la acepta en tiempo de ejecución.
 */
interface InstanciaPdfMake {
  addVirtualFileSystem: (fuentes: Record<string, string>) => void;
  createPdf: (definicion: unknown) => { getBlob: () => Promise<Blob> };
}

/** Los módulos de pdfmake son CommonJS: según el empaquetador el objeto viene en `default` o directo. */
function sinEnvoltura<T>(modulo: unknown): T {
  const m = modulo as { default?: T };
  return m.default ?? (modulo as T);
}

/**
 * HU-17: genera el PDF del reporte con pdfmake, en el navegador.
 * pdfmake y sus fuentes se cargan con import dinámico, así no entran al bundle inicial.
 * La escala de grises del encabezado y la tabla sigue la paleta de la sección 6.
 */
export async function exportarPdf(reporte: ReporteArmado): Promise<Blob> {
  const [moduloPdf, moduloFuentes] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ]);
  const pdfMake = sinEnvoltura<InstanciaPdfMake>(moduloPdf);
  // En pdfmake 0.3 las fuentes se registran con addVirtualFileSystem (ya no existe la propiedad vfs).
  pdfMake.addVirtualFileSystem(sinEnvoltura<Record<string, string>>(moduloFuentes));

  const anchoColumnas = reporte.columnas.map((_, i) => (i === 0 ? 'auto' : '*'));
  const cuerpoTabla = [
    reporte.columnas.map((texto) => ({ text: texto, style: 'th' })),
    ...reporte.filasTexto.map((fila) => fila.map((celda, i) => ({ text: celda, alignment: i === 0 ? 'left' : 'right' }))),
  ];

  const definicion = {
    info: { title: reporte.titulo },
    pageMargins: [36, 48, 36, 48],
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

  return pdfMake.createPdf(definicion).getBlob();
}
