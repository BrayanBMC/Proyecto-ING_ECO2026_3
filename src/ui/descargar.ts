/** Descarga un objeto como archivo JSON generado en el navegador (sin pasar por ningún servidor). */
export function descargarJson(nombreArchivo: string, datos: unknown): void {
  descargarBlob(nombreArchivo, new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' }));
}

/** Descarga un Blob ya generado (PDF o XLSX) con el nombre dado. */
export function descargarBlob(nombreArchivo: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  enlace.click();
  URL.revokeObjectURL(url);
}
