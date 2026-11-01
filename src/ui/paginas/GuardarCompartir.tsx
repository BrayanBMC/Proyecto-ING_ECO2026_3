import { useState, type FormEvent } from 'react';
import type { ServicioCuenta, Usuario } from '../../adapters/auth/ServicioCuenta';
import { repoDeCuenta } from '../../adapters/repo/RepoSimulaciones';
import { crearEnlace } from '../../adapters/share/url';
import { nombreAutomatico, validarNombreSimulacion, type ParametrosCredito } from '../../core';
import { Campo } from '../Campo';
import { Enlace } from '../navegacion';
import { repoDelInvitado } from '../sesionInvitado';

interface Props {
  parametros: ParametrosCredito;
  servicio: ServicioCuenta | null;
  usuario: Usuario | null;
}

/**
 * HU-21: guardar la simulación (en la cuenta, o solo en la pestaña si es invitado).
 * HU-24: copiar un enlace con los parámetros en el hash; no se envían al servidor.
 */
export function GuardarCompartir({ parametros, servicio, usuario }: Props) {
  const [nombre, setNombre] = useState('');
  const [errorNombre, setErrorNombre] = useState<string | undefined>();
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [enlace, setEnlace] = useState<{ url: string; copiado: boolean } | null>(null);

  const repo = usuario && servicio ? repoDeCuenta(servicio) : repoDelInvitado;

  const guardar = async (evento: FormEvent) => {
    evento.preventDefault();
    const nombreFinal = nombre.trim() === '' ? { ok: true as const, datos: nombreAutomatico(new Date()) } : validarNombreSimulacion(nombre);
    if (!nombreFinal.ok) {
      setErrorNombre(nombreFinal.errores);
      return;
    }
    setErrorNombre(undefined);
    setGuardando(true);
    const r = await repo.guardar(nombreFinal.datos, parametros);
    setGuardando(false);
    if (r.ok) {
      setNombre('');
      setAviso({ ok: true, texto: `Guardada como «${r.datos.nombre}».` });
    } else {
      setAviso({ ok: false, texto: r.mensaje });
    }
  };

  const copiar = async () => {
    const url = crearEnlace(window.location.origin, parametros);
    let copiado = false;
    try {
      await navigator.clipboard.writeText(url);
      copiado = true;
    } catch {
      // Sin permiso o sin portapapeles: se deja el enlace a la vista para copiarlo a mano.
    }
    setEnlace({ url, copiado });
  };

  return (
    <section className="tarjeta tarjeta--ancha" aria-labelledby="titulo-guardar">
      <h2 id="titulo-guardar">Guardar y compartir</h2>
      <p className="tarjeta__texto">
        {usuario
          ? 'Se guarda en tu cuenta y la puedes abrir desde cualquier equipo.'
          : 'Modo invitado: se guarda solo en esta pestaña y se pierde al cerrarla. Inicia sesión para conservarla.'}
      </p>
      <form className="formulario formulario--rejilla" onSubmit={guardar} noValidate>
        <Campo
          nombre="nombre-simulacion"
          etiqueta="Nombre de la simulación"
          placeholder="Mi crédito de vivienda"
          valor={nombre}
          alCambiar={setNombre}
          error={errorNombre}
          ayuda="Opcional. Hasta 60 caracteres."
        />
        <div className="acciones">
          <button type="submit" className="boton" disabled={guardando}>
            Guardar simulación
          </button>
          <button type="button" className="boton boton--secundario" onClick={copiar}>
            Copiar enlace
          </button>
        </div>
      </form>
      {aviso &&
        (aviso.ok ? (
          <p role="status" className="aviso">
            {aviso.texto} <Enlace href="/simulaciones">Ver mis simulaciones</Enlace>
          </p>
        ) : (
          <p role="alert" className="alerta">
            {aviso.texto}
          </p>
        ))}
      {enlace && (
        <div className="campo">
          <p role="status" className="aviso">
            {enlace.copiado
              ? 'Enlace copiado. Quien lo abra verá la misma tabla, sin cuenta.'
              : 'No pudimos copiarlo solo: selecciona el enlace y cópialo.'}
          </p>
          <label htmlFor="enlace-compartir">Enlace para compartir</label>
          <input id="enlace-compartir" readOnly value={enlace.url} onFocus={(e) => e.currentTarget.select()} />
        </div>
      )}
    </section>
  );
}
