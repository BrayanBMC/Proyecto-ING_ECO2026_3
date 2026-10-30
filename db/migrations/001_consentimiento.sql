-- HU-01: prueba del consentimiento de tratamiento de datos (Ley 1581 de 2012).
-- Idempotente: se puede ejecutar varias veces sin error.
-- Requiere Managed Better Auth activo (esquema neon_auth) y la Data API (función auth.user_id()).

CREATE TABLE IF NOT EXISTS public.consentimiento (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id       UUID        NOT NULL DEFAULT (auth.user_id())::uuid
                               REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  version_politica TEXT        NOT NULL CHECK (length(version_politica) BETWEEN 1 AND 20),
  aceptado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  revocado_en      TIMESTAMPTZ NULL,
  UNIQUE (usuario_id, version_politica)
);

CREATE INDEX IF NOT EXISTS idx_consentimiento_usuario ON public.consentimiento (usuario_id);

ALTER TABLE public.consentimiento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consentimiento FORCE ROW LEVEL SECURITY;

-- Cada usuario solo ve y crea sus propios consentimientos. No hay políticas de UPDATE ni DELETE:
-- la revocación se hará con una función específica (HU-05) y el borrado ocurre en cascada al eliminar la cuenta.
DROP POLICY IF EXISTS consentimiento_select_propio ON public.consentimiento;
CREATE POLICY consentimiento_select_propio ON public.consentimiento
  FOR SELECT TO authenticated
  USING (usuario_id::text = auth.user_id());

DROP POLICY IF EXISTS consentimiento_insert_propio ON public.consentimiento;
CREATE POLICY consentimiento_insert_propio ON public.consentimiento
  FOR INSERT TO authenticated
  WITH CHECK (usuario_id::text = auth.user_id());

GRANT SELECT, INSERT ON public.consentimiento TO authenticated;
REVOKE UPDATE, DELETE ON public.consentimiento FROM authenticated;

-- El rol "anonymous" solo existe si se configuró acceso anónimo en la Data API.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anonymous') THEN
    REVOKE ALL ON public.consentimiento FROM anonymous;
  END IF;
END
$$;
