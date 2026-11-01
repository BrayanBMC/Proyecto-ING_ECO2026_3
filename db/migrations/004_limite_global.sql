-- Tope GLOBAL de simulaciones guardadas, para no pasar nunca el límite gratuito de Neon.
-- Idempotente: se puede ejecutar varias veces sin error.
--
-- Cuentas: cada simulación pesa como máximo ~2,5 KB (parámetros de hasta 2.000 caracteres más el nombre).
-- Con 50.000 filas el máximo es ~125 MB, una octava parte del GB del plan gratuito (1 GB por proyecto).
-- Además, cada usuario tiene su propio tope de 50 (003_simulaciones.sql).
--
-- Para contar usa la estimación del catálogo (pg_class.reltuples): no depende de RLS, que solo dejaría
-- contar las filas del usuario, y es barata. La estimación se pone al día sola con el autovacuum;
-- con un margen tan amplio no hace falta que sea exacta.

CREATE OR REPLACE FUNCTION public.limitar_simulaciones()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  total_estimado BIGINT;
BEGIN
  -- Tope por usuario (código 54000: program_limit_exceeded).
  IF (SELECT count(*) FROM public.simulacion WHERE usuario_id = NEW.usuario_id) >= 50 THEN
    RAISE EXCEPTION 'Límite de 50 simulaciones guardadas' USING ERRCODE = '54000';
  END IF;

  -- Tope global (código 53100: disk_full). reltuples vale -1 si la tabla nunca se ha analizado.
  SELECT greatest(reltuples, 0)::BIGINT INTO total_estimado
  FROM pg_class
  WHERE oid = 'public.simulacion'::regclass;
  IF total_estimado >= 50000 THEN
    RAISE EXCEPTION 'Límite global de simulaciones guardadas' USING ERRCODE = '53100';
  END IF;

  RETURN NEW;
END
$$;

-- El trigger de 003 ya apunta a esta función; se recrea por si 003 no se ha aplicado en esta base.
DROP TRIGGER IF EXISTS simulacion_limite ON public.simulacion;
CREATE TRIGGER simulacion_limite
  BEFORE INSERT ON public.simulacion
  FOR EACH ROW EXECUTE FUNCTION public.limitar_simulaciones();
