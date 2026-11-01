-- Limpieza diaria de la base de Neon, para mantenerse siempre dentro del plan gratuito.
-- La ejecuta el workflow "Limpieza diaria de la base de datos" (.github/workflows/db-limpieza.yml).
-- Idempotente: repetirla no hace daño. No toca simulaciones ni perfiles de usuarios verificados.
--
-- Los invitados no guardan nada en Neon (sus simulaciones viven en la memoria del navegador y se
-- borran solas a las 24 horas), así que lo único que puede crecer sin que nadie lo pida son:
--   1. cuentas creadas pero nunca verificadas (registros abandonados o de relleno),
--   2. sesiones y códigos de verificación que ya vencieron.
--
-- Better Auth puede nombrar las columnas en camelCase o en snake_case; se detecta cuál se usa.
-- Si no las encuentra, avisa y no borra nada.

DO $$
DECLARE
  col_verificado TEXT;
  col_creado     TEXT;
  col_vence      TEXT;
  tabla          TEXT;
  filas          BIGINT;
BEGIN
  -- 1. Cuentas sin verificar con más de 2 días (se borran en cascada con su perfil y consentimiento).
  SELECT column_name INTO col_verificado FROM information_schema.columns
   WHERE table_schema = 'neon_auth' AND table_name = 'user' AND column_name IN ('emailVerified', 'email_verified')
   LIMIT 1;
  SELECT column_name INTO col_creado FROM information_schema.columns
   WHERE table_schema = 'neon_auth' AND table_name = 'user' AND column_name IN ('createdAt', 'created_at')
   LIMIT 1;

  IF col_verificado IS NULL OR col_creado IS NULL THEN
    RAISE NOTICE 'Cuentas sin verificar: no se limpió porque no encontré las columnas esperadas en neon_auth.user.';
  ELSE
    EXECUTE format(
      'DELETE FROM neon_auth."user" WHERE NOT COALESCE(%I, false) AND %I < now() - interval ''2 days''',
      col_verificado, col_creado
    );
    GET DIAGNOSTICS filas = ROW_COUNT;
    RAISE NOTICE 'Cuentas sin verificar borradas: %', filas;
  END IF;

  -- 2. Sesiones y códigos de verificación vencidos desde hace más de un día.
  FOREACH tabla IN ARRAY ARRAY['session', 'verification'] LOOP
    col_vence := NULL;
    SELECT column_name INTO col_vence FROM information_schema.columns
     WHERE table_schema = 'neon_auth' AND table_name = tabla AND column_name IN ('expiresAt', 'expires_at')
     LIMIT 1;
    IF col_vence IS NOT NULL THEN
      EXECUTE format('DELETE FROM neon_auth.%I WHERE %I < now() - interval ''1 day''', tabla, col_vence);
      GET DIAGNOSTICS filas = ROW_COUNT;
      RAISE NOTICE 'neon_auth.%: filas vencidas borradas: %', tabla, filas;
    END IF;
  END LOOP;
END
$$;

-- Resumen del uso para el registro del workflow.
SELECT
  pg_size_pretty(pg_database_size(current_database())) AS tamano_total,
  (SELECT count(*) FROM neon_auth."user") AS cuentas,
  CASE WHEN to_regclass('public.simulacion') IS NULL
       THEN NULL
       ELSE (SELECT greatest(reltuples, 0)::BIGINT FROM pg_class WHERE oid = to_regclass('public.simulacion'))
  END AS simulaciones_estimadas;
