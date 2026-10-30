import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent } from 'react';

/**
 * Enrutador mínimo con la History API del navegador. Evita una dependencia más para pocas rutas.
 * El Worker de Cloudflare responde index.html en cualquier ruta (not_found_handling: single-page-application).
 */

const EVENTO = 'amortiza:navegar';

export function navegar(ruta: string): void {
  if (ruta !== window.location.pathname) {
    window.history.pushState(null, '', ruta);
  }
  window.dispatchEvent(new Event(EVENTO));
  window.scrollTo?.(0, 0);
}

export function useRuta(): string {
  const [ruta, setRuta] = useState(() => window.location.pathname);
  useEffect(() => {
    const actualizar = () => setRuta(window.location.pathname);
    window.addEventListener('popstate', actualizar);
    window.addEventListener(EVENTO, actualizar);
    return () => {
      window.removeEventListener('popstate', actualizar);
      window.removeEventListener(EVENTO, actualizar);
    };
  }, []);
  return ruta;
}

type PropsEnlace = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

/** Enlace interno: navega sin recargar, pero respeta Ctrl/Cmd+clic y target="_blank". */
export function Enlace({ href, onClick, target, ...resto }: PropsEnlace) {
  const alPulsar = (evento: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(evento);
    const conModificador = evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey;
    if (evento.defaultPrevented || conModificador || evento.button !== 0 || target === '_blank') {
      return;
    }
    evento.preventDefault();
    navegar(href);
  };
  return <a href={href} target={target} onClick={alPulsar} {...resto} />;
}
