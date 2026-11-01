-- HU-21: simulaciones guardadas del usuario registrado.
-- Idempotente: se puede ejecutar varias veces sin error.
-- Solo se guardan los parámetros del crédito (texto); la tabla de cuotas se recalcula al abrir.

CREATE TABLE IF NOT EXISTS public.simulacion (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id     UUID        NOT NULL DEFAULT (auth.user_id())::uuid
                             REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  modulo         TEXT        NOT NULL DEFAULT 'credito' CHECK (modulo IN ('credito')),
  nombre         TEXT        NOT NULL CHECK (length(nombre) BETWEEN 1 AND 60),
  parametros     JSONB       NOT NULL CHECK (jsonb_typeof(parametros) = 'object' AND length(parametros::text) <= 2000),
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_simulacion_usuario_fecha ON public.simulacion (usuario_id, actualizado_en DESC);

ALTER TABLE public.simulacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulacion FORCE ROW LEVEL SECURITY;

-- Cada usuario ve, crea, renombra y borra solo sus simulaciones. Se borran en cascada con la cuenta.
DROP POLICY IF EXISTS simulacion_propia ON public.simulacion;
CREATE POLICY simulacion_propia ON public.simulacion
  FOR ALL TO authenticated
  USING (usuario_id::text = auth.user_id())
  WITH CHECK (usuario_id::text = auth.user_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulacion TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anonymous') THEN
    REVOKE ALL ON public.simulacion FROM anonymous;
  END IF;
END
$$;

-- Tope de 50 simulaciones por usuario, para no llenar el plan gratuito de Neon.
-- El código 54000 (program_limit_exceeded) lo traduce la app a un mensaje en español.
CREATE OR REPLACE FUNCTION public.limitar_simulaciones()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (SELECT count(*) FROM public.simulacion WHERE usuario_id = NEW.usuario_id) >= 50 THEN
    RAISE EXCEPTION 'Límite de 50 simulaciones guardadas' USING ERRCODE = '54000';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS simulacion_limite ON public.simulacion;
CREATE TRIGGER simulacion_limite
  BEFORE INSERT ON public.simulacion
  FOR EACH ROW EXECUTE FUNCTION public.limitar_simulaciones();
