-- ═══════════════════════════════════════════════════════════════
-- NEXUM v3.0 — Migración 004: Crear super-admin
-- IMPORTANTE: Ejecutar DESPUÉS de crear el usuario en Supabase Auth
--             Reemplazar el UUID con el id real del usuario creado
-- ═══════════════════════════════════════════════════════════════

-- Paso 1: Busca el auth_id del usuario recién creado
-- (Supabase lo genera automáticamente al crear el usuario)
-- Ejecuta esto primero para obtener el UUID:
--
--   SELECT id FROM auth.users WHERE email = 'wendyyanetty2@gmail.com';
--
-- Paso 2: Reemplaza '<UUID_DEL_USUARIO>' con el resultado y ejecuta:

INSERT INTO usuarios (auth_id, email, nombre, es_super_admin, activo)
SELECT
  id,
  'wendyyanetty2@gmail.com',
  'Wendy',
  TRUE,
  TRUE
FROM auth.users
WHERE email = 'wendyyanetty2@gmail.com'
ON CONFLICT (email) DO UPDATE SET
  auth_id        = EXCLUDED.auth_id,
  es_super_admin = TRUE,
  activo         = TRUE;
