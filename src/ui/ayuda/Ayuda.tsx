import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { GLOSARIO, type Termino, type TerminoId } from './glosario';

/**
 * Ayuda contextual: un botón «?» que explica un campo, un resultado o un término técnico.
 *
 * - Escritorio: el globo aparece al pasar el mouse y al enfocar con el teclado.
 * - Táctil: un toque lo abre y otro lo cierra (no depende de hover).
 * - Se cierra con Esc, al sacar el mouse (si no está fijado), al tocar fuera o al salir con Tab.
 * - Si la entrada tiene explicación larga, el globo ofrece «Saber más» y abre un <dialog> con el detalle.
 *
 * Solo CSS y estado en memoria: sin estilos en línea (CSP) y sin almacenamiento del navegador.
 */

function tieneDetalle(t: Termino): boolean {
  return Boolean(t.larga || t.ejemplo || t.rango || t.errorComun || t.verPasos);
}

export function Ayuda({ id }: { id: TerminoId }) {
  const termino: Termino = GLOSARIO[id];
  const idGlobo = useId();
  const idTexto = useId();
  const raiz = useRef<HTMLSpanElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const globo = useRef<HTMLSpanElement>(null);
  /** true mientras el foco viene de un clic o toque: ahí no se abre el globo por foco (lo decide el clic). */
  const conPuntero = useRef(false);
  const [encima, setEncima] = useState(false);
  const [enfoque, setEnfoque] = useState(false);
  const [fijo, setFijo] = useState(false);
  const [detalle, setDetalle] = useState(false);
  const visible = (encima || enfoque || fijo) && !detalle;

  const cerrarTodo = () => {
    setEncima(false);
    setEnfoque(false);
    setFijo(false);
  };

  // Tocar o hacer clic fuera cierra el globo.
  useEffect(() => {
    if (!visible) {
      return;
    }
    const alPulsar = (evento: PointerEvent) => {
      if (!raiz.current?.contains(evento.target as Node)) {
        setEncima(false);
        setEnfoque(false);
        setFijo(false);
      }
    };
    document.addEventListener('pointerdown', alPulsar);
    return () => document.removeEventListener('pointerdown', alPulsar);
  }, [visible]);

  // Si el globo no cabe, se alinea al borde derecho o se abre hacia arriba. Solo se tocan atributos data-*
  // (los lee el CSS); no hay estilos en línea.
  useLayoutEffect(() => {
    const el = globo.current;
    const ancla = boton.current;
    if (!visible || !el || !ancla) {
      return;
    }
    const caja = ancla.getBoundingClientRect();
    const ancho = document.documentElement.clientWidth;
    const alto = window.innerHeight;
    el.dataset.alFinal = String(caja.left + el.offsetWidth > ancho - 8);
    el.dataset.arriba = String(caja.bottom + el.offsetHeight + 8 > alto && caja.top > el.offsetHeight + 8);
  }, [visible]);

  const alPulsarBoton = () => {
    conPuntero.current = false;
    // Primer clic o toque: fija el globo. Segundo: lo cierra.
    if (fijo) {
      cerrarTodo();
    } else {
      setFijo(true);
    }
  };

  const abrirDetalle = () => {
    cerrarTodo();
    setDetalle(true);
  };

  const cerrarDetalle = () => {
    setDetalle(false);
    // El foco vuelve al botón sin reabrir el globo.
    conPuntero.current = true;
    boton.current?.focus();
  };

  return (
    <span
      ref={raiz}
      className="ayuda"
      onPointerEnter={(e) => {
        if (e.pointerType !== 'touch') {
          setEncima(true);
        }
      }}
      onPointerLeave={() => setEncima(false)}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && visible) {
          e.stopPropagation();
          cerrarTodo();
          conPuntero.current = true;
          boton.current?.focus();
        }
      }}
      onBlur={(e) => {
        conPuntero.current = false;
        if (!raiz.current?.contains(e.relatedTarget as Node | null)) {
          cerrarTodo();
        }
      }}
    >
      <button
        ref={boton}
        type="button"
        className="ayuda__boton"
        aria-label={`¿Qué es «${termino.nombre}»?`}
        aria-expanded={visible}
        aria-controls={idGlobo}
        aria-describedby={idTexto}
        onPointerDown={() => {
          conPuntero.current = true;
        }}
        onFocus={() => {
          if (!conPuntero.current) {
            setEnfoque(true);
          }
        }}
        onClick={alPulsarBoton}
      >
        <span className="ayuda__simbolo" aria-hidden="true">
          ?
        </span>
      </button>
      <span id={idGlobo} ref={globo} className="ayuda__globo" hidden={!visible}>
        <span id={idTexto} className="ayuda__texto">
          {termino.corta}
        </span>
        {tieneDetalle(termino) && (
          <button type="button" className="ayuda__mas" onClick={abrirDetalle}>
            Saber más
          </button>
        )}
      </span>
      {detalle && <DialogoAyuda termino={termino} alCerrar={cerrarDetalle} />}
    </span>
  );
}

function DialogoAyuda({ termino, alCerrar }: { termino: Termino; alCerrar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo || dialogo.open) {
      return;
    }
    if (typeof dialogo.showModal === 'function') {
      dialogo.showModal();
    } else {
      dialogo.setAttribute('open', '');
    }
  }, []);

  const cerrar = () => {
    const dialogo = ref.current;
    if (dialogo && typeof dialogo.close === 'function') {
      dialogo.close();
    } else {
      alCerrar();
    }
  };

  return createPortal(
    <dialog
      ref={ref}
      className="dialogo"
      aria-labelledby={idTitulo}
      onClose={alCerrar}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          cerrar();
        }
      }}
    >
      <div className="dialogo__cuerpo">
        <h2 id={idTitulo}>{termino.nombre}</h2>
        <p>{termino.corta}</p>
        {termino.larga?.split('\n\n').map((parrafo) => <p key={parrafo}>{parrafo}</p>)}
        <DatoAyuda titulo="Ejemplo">{termino.ejemplo}</DatoAyuda>
        <DatoAyuda titulo="Valores permitidos">{termino.rango}</DatoAyuda>
        <DatoAyuda titulo="El error más común">{termino.errorComun}</DatoAyuda>
        {termino.verPasos && (
          <DatoAyuda titulo="¿Cómo se calculó?">
            Cuando veas este resultado en pantalla, abre «¿Cómo se calculó?» para ver la fórmula con tus números.
          </DatoAyuda>
        )}
        <p className="dialogo__aviso">Explicación educativa; no reemplaza la asesoría financiera.</p>
        <button type="button" className="boton" onClick={cerrar}>
          Cerrar
        </button>
      </div>
    </dialog>,
    document.body,
  );
}

function DatoAyuda({ titulo, children }: { titulo: string; children: ReactNode }) {
  if (!children) {
    return null;
  }
  return (
    <section className="dialogo__dato">
      <h3>{titulo}</h3>
      <p>{children}</p>
    </section>
  );
}

/** Etiqueta de un campo con su botón «?» al lado (fuera del <label>, para no ensuciar el nombre del campo). */
export function EtiquetaAyuda({ htmlFor, termino, children }: { htmlFor: string; termino: TerminoId; children: ReactNode }) {
  return (
    <div className="campo__cabecera">
      <label htmlFor={htmlFor}>{children}</label>
      <Ayuda id={termino} />
    </div>
  );
}
