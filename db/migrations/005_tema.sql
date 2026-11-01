-- Tema de color preferido por el usuario (claro, oscuro o el del sistema), guardado en su perfil.
-- Idempotente: se puede ejecutar varias veces sin error ni pérdida de datos.
-- Después de aplicarla: Neon → Data API → "Refresh schema cache".

ALTER TABLE public.perfil
  ADD COLUMN IF NOT EXISTS tema TEXT NOT NULL DEFAULT 'sistema';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'perfil_tema_valido' AND conrelid = 'public.perfil'::regclass
  ) THEN
    ALTER TABLE public.perfil
      ADD CONSTRAINT perfil_tema_valido CHECK (tema IN ('sistema', 'claro', 'oscuro'));
  END IF;
END
$$;

-- La política RLS perfil_propio y los permisos de la tabla (migración 002) ya cubren la columna nueva:
-- cada usuario solo lee y cambia su propia fila.
