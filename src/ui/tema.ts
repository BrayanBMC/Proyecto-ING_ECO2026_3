import type { Tema } from '../adapters/auth/ServicioCuenta';

export type { Tema };

/** Las tres opciones del selector. «Sistema» sigue la preferencia del dispositivo. */
export const TEMAS: readonly { valor: Tema; nombre: string }[] = [
  { valor: 'sistema', nombre: 'Sistema' },
  { valor: 'claro', nombre: 'Claro' },
  { valor: 'oscuro', nombre: 'Oscuro' },
];

/**
 * Color de la barra del navegador en cada tema. Deben ser iguales al token --fondo de styles.css
 * y a los <meta name="theme-color"> de index.html (hay una prueba que lo comprueba).
 */
export const COLOR_BARRA = { claro: '#f6f7f4', oscuro: '#0e1417' } as const;

export function esTema(valor: unknown): valor is Tema {
  return valor === 'sistema' || valor === 'claro' || valor === 'oscuro';
}

/**
 * Aplica el tema. Solo pone el atributo data-tema en <html> (lo lee el CSS) y ajusta los
 * <meta name="theme-color">; no hay estilos ni scripts en línea. Sin atributo manda el sistema.
 */
export function aplicarTema(tema: Tema, documento: Document = document): void {
  const raiz = documento.documentElement;
  if (tema === 'sistema') {
    raiz.removeAttribute('data-tema');
  } else {
    raiz.setAttribute('data-tema', tema);
  }
  documento.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    const esDelOscuro = (meta.getAttribute('media') ?? '').includes('dark');
    const efectivo = tema === 'sistema' ? (esDelOscuro ? 'oscuro' : 'claro') : tema;
    meta.setAttribute('content', COLOR_BARRA[efectivo]);
  });
}
