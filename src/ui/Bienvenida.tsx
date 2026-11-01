import { useEffect, useRef } from 'react';
import { Enlace } from './navegacion';

/** Datos de la ficha del proyecto. */
export const FICHA_PROYECTO = {
  autor: 'Brayan Acosta Parrado',
  universidad: 'Universidad Distrital Francisco José de Caldas',
  carrera: 'Ingeniería en Telemática',
  semestre: '2026-3',
} as const;

/**
 * Ventana de bienvenida que se abre al cargar la app. Es un <dialog> modal: el navegador atrapa el foco,
 * deja el resto de la página inerte y la cierra con Esc. El foco inicial va al título, para que el lector
 * de pantalla empiece leyendo de qué trata. Solo aparece una vez por carga de la página (el estado vive
 * en memoria y no se guarda nada en el navegador), así que reaparece al recargar.
 */
export function Bienvenida({ alCerrar }: { alCerrar: () => void }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const el = dialogo.current;
    if (!el) {
      return;
    }
    if (!el.open) {
      if (typeof el.showModal === 'function') {
        el.showModal();
      } else {
        el.setAttribute('open', '');
      }
    }
    titulo.current?.focus();
  }, []);

  const cerrar = () => {
    const el = dialogo.current;
    if (el && typeof el.close === 'function') {
      el.close();
    } else {
      alCerrar();
    }
  };

  return (
    <dialog
      ref={dialogo}
      className="dialogo"
      aria-labelledby="titulo-bienvenida"
      aria-describedby="descripcion-bienvenida"
      onClose={alCerrar}
    >
      <div className="dialogo__cuerpo">
        <p className="dialogo__etiqueta">Amortiza</p>
        <h2 id="titulo-bienvenida" ref={titulo} tabIndex={-1}>
          Simulador de créditos e ingeniería económica
        </h2>
        <dl className="ficha">
          <dt>Autor</dt>
          <dd>{FICHA_PROYECTO.autor}</dd>
          <dt>Universidad</dt>
          <dd>{FICHA_PROYECTO.universidad}</dd>
          <dt>Carrera</dt>
          <dd>{FICHA_PROYECTO.carrera}</dd>
          <dt>Semestre</dt>
          <dd>{FICHA_PROYECTO.semestre}</dd>
        </dl>
        <p id="descripcion-bienvenida">
          Es un proyecto académico para entender créditos, tasas, tablas de amortización y el valor del dinero en el
          tiempo, en pesos colombianos. Escribes los datos de un crédito y ves cuánto pagarías en cada cuota.
        </p>
        <p>
          <strong>Los cálculos son educativos</strong> y no reemplazan la asesoría financiera.
        </p>
        <ul className="dialogo__lista">
          <li>
            Junto a cada campo y a cada resultado hay un botón con el símbolo <strong>?</strong> que lo explica con
            palabras sencillas.
          </li>
          <li>
            Con los botones <strong>Sistema, Claro y Oscuro</strong> de la parte de arriba eliges cómo se ve la app.
          </li>
        </ul>
        <div className="dialogo__enlaces">
          <Enlace href="/politica-de-datos" onClick={cerrar}>
            Política de datos
          </Enlace>
          <Enlace href="/simulador" onClick={cerrar}>
            ¿Cómo se calculó? (en el simulador)
          </Enlace>
        </div>
        <button type="button" className="boton" onClick={cerrar}>
          Entendido
        </button>
      </div>
    </dialog>
  );
}
