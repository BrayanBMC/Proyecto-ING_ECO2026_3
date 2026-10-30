-- HU-04: perfil del usuario. HU-05: eliminar la cuenta propia.
-- Idempotente: se puede ejecutar varias veces sin error.

CREATE TABLE IF NOT EXISTS public.perfil (
  usuario_id       UUID        PRIMARY KEY DEFAULT (auth.user_id())::uuid
                               REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  nombre_mostrar   TEXT        NOT NULL CHECK (length(nombre_mostrar) BETWEEN 1 AND 60),
  institucion      TEXT        NULL CHECK (length(institucion) <= 80),
  programa         TEXT        NULL CHECK (length(programa) <= 80),
  escala_monetaria SMALLINT    NOT NULL DEFAULT 0 CHECK (escala_monetaria IN (0, 2)),
  base_diaria      SMALLINT    NOT NULL DEFAULT 360 CHECK (base_diaria IN (360, 365)),
  actualizado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.perfil ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfil FORCE ROW LEVEL SECURITY;

-- Cada usuario solo ve, crea y edita su propio perfil. Se borra en cascada con la cuenta.
DROP POLICY IF EXISTS perfil_propio ON public.perfil;
CREATE POLICY perfil_propio ON public.perfil
  FOR ALL TO authenticated
  USING (usuario_id::text = auth.user_id())
  WITH CHECK (usuario_id::text = auth.user_id());

GRANT SELECT, INSERT, UPDATE ON public.perfil TO authenticated;
REVOKE DELETE ON public.perfil FROM authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anonymous') THEN
    REVOKE ALL ON public.perfil FROM anonymous;
  END IF;
END
$$;

-- HU-05: borra la cuenta del usuario que llama, y en cascada perfil y consentimientos.
-- SECURITY DEFINER porque el rol authenticated no puede tocar neon_auth. Solo borra la fila
-- cuyo id es el del JWT (auth.user_id()), así nadie puede borrar a otro.
-- La app pide la contraseña y la comprueba antes de llamar esta función.
CREATE OR REPLACE FUNCTION public.eliminar_mi_cuenta()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  yo TEXT := auth.user_id();
BEGIN
  IF yo IS NULL THEN
    RAISE EXCEPTION 'Sin sesión' USING ERRCODE = '42501';
  END IF;
  DELETE FROM neon_auth."user" WHERE id = yo::uuid;
END
$$;

REVOKE ALL ON FUNCTION public.eliminar_mi_cuenta() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.eliminar_mi_cuenta() TO authenticated;
