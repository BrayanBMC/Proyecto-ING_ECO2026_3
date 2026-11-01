import { useState } from 'react';
import type { ServicioCuenta, Usuario } from '../adapters/auth/ServicioCuenta';
import { nombreAutomatico } from '../core';
import { Enlace } from './navegacion';
import { fijarSimulacionPendiente, useSimulacionPendiente } from './sesionInvitado';

interface Props {
  servicio: ServicioCuenta | null;
  usuario: Usuario | null;
}

/**
 * HU-22: cuando un invitado que tenía una simulación abierta se registra o inicia sesión,
 * se le ofrece guardarla en su cuenta. Si la rechaza, no se guarda nada.
 */
export function OfertaGuardar({ servicio, usuario }: Props) {
  const pendiente = useSimulacionPendiente();
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null);

  if (!usuario || !servicio || (!pendiente && !resultado)) {
    return null;
  }

  const aceptar = async () => {
    if (!pendiente) {
      return;
    }
    setGuardando(true);
    const nombre = nombreAutomatico(new Date());
    const r = await servicio.guardarSimulacion(nombre, pendiente);
    setGuardando(false);
    if (r.ok) {
      fijarSimulacionPendiente(null);
      setResultado({ ok: true, texto: `Guardada en tu cuenta como «${r.simulacion.nombre}».` });
    } else {
      setResultado({ ok: false, texto: r.mensaje });
    }
  };

  return (
    <section className="tarjeta tarjeta--ancha" aria-labelledby="titulo-oferta">
      <h2 id="titulo-oferta">Simulación abierta como invitado</h2>
      {resultado?.ok ? (
        <p role="status" className="aviso">
          {resultado.texto} <Enlace href="/simulaciones">Ver mis simulaciones</Enlace>
        </p>
      ) : (
        <>
          <p className="tarjeta__texto">Tenías una simulación abierta. Puedes llevarla a tu cuenta para no repetirla.</p>
          {resultado && (
            <p role="alert" className="alerta">
              {resultado.texto}
            </p>
          )}
          <div className="acciones">
            <button type="button" className="boton" disabled={guardando} onClick={() => void aceptar()}>
              Guardar esta simulación en mi cuenta
            </button>
            <button
              type="button"
              className="boton boton--secundario"
              onClick={() => {
                fijarSimulacionPendiente(null);
                setResultado(null);
              }}
            >
              No guardar
            </button>
          </div>
        </>
      )}
    </section>
  );
}
