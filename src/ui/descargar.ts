/** Descarga un objeto como archivo JSON generado en el navegador (sin pasar por ningún servidor). */
export function descargarJson(nombreArchivo: string, datos: unknown): void {
  const archivo = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(archivo);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  enlace.click();
  URL.revokeObjectURL(url);
}
