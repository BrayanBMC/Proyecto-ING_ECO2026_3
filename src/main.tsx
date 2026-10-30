import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Solo el subconjunto latino: cubre español (á, é, ñ, ü, ¿, ¡) y evita descargar cirílico, griego y vietnamita.
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import './ui/styles.css';
import { App } from './ui/App';
import { crearServicioCuenta } from './adapters/auth/crearServicioCuenta';

const servicioCuenta = crearServicioCuenta(
  import.meta.env.VITE_NEON_AUTH_URL as string | undefined,
  import.meta.env.VITE_NEON_DATA_API_URL as string | undefined,
);

const raiz = document.getElementById('root');
if (!raiz) {
  throw new Error('No se encontró el elemento #root');
}

createRoot(raiz).render(
  <StrictMode>
    <App servicioCuenta={servicioCuenta} />
  </StrictMode>,
);
