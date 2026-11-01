import { useEffect, useState } from 'react';
import type { ServicioCuenta, Usuario } from '../adapters/auth/ServicioCuenta';
import { VERSION_POLITICA } from '../core';
import { Enlace } from './navegacion';

interface Props {
  servicio: ServicioCuenta | null;
  usuario: Usuario | null;
}

/**
 * Ley 1581: si la política de datos cambió desde la última vez que el usuario la aceptó, se le pide aceptar la
 * nueva versión. Compara las versiones aceptadas (tabla consentimiento) con VERSION_POLITICA. Si no se puede
 * leer el estado, no muestra nada: el aviso nunca bloquea el uso de la app.
 * Se monta con `key` del correo, para no arrastrar el estado de otra cuenta.
 */
export function AvisoPolitica({ servicio, usuario }: Props) {
  const correo = usuario?.correo;
  const [pendiente, setPendiente] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!servicio || !correo) {
      return;
    }
    let vigente = true;
    void servicio.leerConsentimientos().then((lectura) => {
      if (vigente && lectura.ok) {
        setPendiente(!lectura.consentimientos.some((c) => c.version === VERSION_POLITICA));
      }
    });
    return () => {
      vigente = false;
    };
  }, [servicio, correo]);

  if (!servicio || !usuario || !pendiente) {
    return null;
  }

  const aceptar = async () => {
    setEnviando(true);
    setError(null);
    const resultado = await servicio.registrarConsentimiento(VERSION_POLITICA);
    setEnviando(false);
    if (resultado.ok) {
      setPendiente(false);
    } else {
      setError(resultado.mensaje);
    }
  };

  return (
    <section className="tarjeta tarjeta--ancha" aria-labelledby="titulo-politica-nueva">
      <h2 id="titulo-politica-nueva">Actualizamos la política de datos</h2>
      <p className="tarjeta__texto">
        La política de tratamiento de datos personales cambió (versión {VERSION_POLITICA}): ahora explica qué se guarda de
        tus simulaciones y preferencias. Léela y acepta la nueva versión para que quede constancia.
      </p>
      {error && (
        <p role="alert" className="alerta">
          {error}
        </p>
      )}
      <div className="acciones">
        <Enlace className="boton boton--secundario" href="/politica-de-datos">
          Leer la política
        </Enlace>
        <button type="button" className="boton" disabled={enviando} onClick={() => void aceptar()}>
          Acepto la nueva versión
        </button>
      </div>
    </section>
  );
}
