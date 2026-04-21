-- ═══════════════════════════════════════════════════════════════
-- NEXUM v3.0 — Migración 001: Esquema principal
-- Ejecutar en: Supabase → SQL Editor → New query
-- ═══════════════════════════════════════════════════════════════

-- Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Tabla: usuarios ──────────────────────────────────────────────
-- Perfil extendido vinculado a Supabase Auth
CREATE TABLE IF NOT EXISTS usuarios (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id         UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT NOT NULL UNIQUE,
  nombre          TEXT NOT NULL,
  dni             TEXT,
  telefono        TEXT,
  es_super_admin  BOOLEAN NOT NULL DEFAULT FALSE,
  activo          BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_creacion  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabla: empresas_operadoras ────────────────────────────────────
-- Las empresas propias (JVÑ, PEVAL y futuras)
CREATE TABLE IF NOT EXISTS empresas_operadoras (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre          TEXT NOT NULL,
  nombre_corto    TEXT NOT NULL,
  ruc             TEXT NOT NULL UNIQUE,
  direccion       TEXT,
  telefono        TEXT,
  email           TEXT,
  logo_url        TEXT,
  color_primario  TEXT NOT NULL DEFAULT '#2C5282',
  activa          BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_creacion  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabla: usuarios_empresas ──────────────────────────────────────
-- Asignación de usuarios a empresas operadoras con rol
CREATE TABLE IF NOT EXISTS usuarios_empresas (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id            UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  empresa_operadora_id  UUID NOT NULL REFERENCES empresas_operadoras(id) ON DELETE CASCADE,
  rol                   TEXT NOT NULL CHECK (rol IN ('CONTADOR','ASISTENTE','CONSULTA')),
  activo                BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_asignacion      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(usuario_id, empresa_operadora_id)
);

-- ── Tabla: configuracion_global ───────────────────────────────────
-- Parámetros del sistema editables por super-admin
CREATE TABLE IF NOT EXISTS configuracion_global (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clave               TEXT NOT NULL UNIQUE,
  valor               TEXT NOT NULL,
  descripcion         TEXT,
  tipo_dato           TEXT NOT NULL DEFAULT 'texto' CHECK (tipo_dato IN ('texto','numero','booleano','json')),
  actualizado_por     UUID REFERENCES usuarios(id),
  fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabla: historial_cambios ──────────────────────────────────────
-- Auditoría de todas las operaciones CRUD
CREATE TABLE IF NOT EXISTS historial_cambios (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id       UUID REFERENCES empresas_operadoras(id),
  usuario_id       UUID REFERENCES usuarios(id),
  tabla            TEXT NOT NULL,
  registro_id      TEXT NOT NULL,
  accion           TEXT NOT NULL CHECK (accion IN ('CREAR','EDITAR','ELIMINAR','VER')),
  datos_anteriores JSONB,
  datos_nuevos     JSONB,
  fecha            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Catálogo: tipos de documento SUNAT ───────────────────────────
CREATE TABLE IF NOT EXISTS catalogo_tipos_documento (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo      TEXT NOT NULL UNIQUE,
  nombre      TEXT NOT NULL,
  activo      BOOLEAN NOT NULL DEFAULT TRUE
);

-- ── Catálogo: tipos de operación bancaria ────────────────────────
CREATE TABLE IF NOT EXISTS catalogo_tipos_operacion (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo      TEXT NOT NULL UNIQUE,
  nombre      TEXT NOT NULL,
  naturaleza  TEXT CHECK (naturaleza IN ('CARGO','ABONO','AMBOS')),
  activo      BOOLEAN NOT NULL DEFAULT TRUE
);

-- ── Catálogo: cuentas PCGE ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS catalogo_cuentas_pcge (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo      TEXT NOT NULL UNIQUE,
  nombre      TEXT NOT NULL,
  tipo        TEXT CHECK (tipo IN ('ACTIVO','PASIVO','PATRIMONIO','INGRESO','GASTO','COSTO')),
  nivel       INTEGER NOT NULL DEFAULT 1,
  activo      BOOLEAN NOT NULL DEFAULT TRUE
);

-- ── Catálogo: estados ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS catalogo_estados (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo      TEXT NOT NULL UNIQUE,
  nombre      TEXT NOT NULL,
  modulo      TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#718096',
  activo      BOOLEAN NOT NULL DEFAULT TRUE
);

-- ── Catálogo: monedas ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS catalogo_monedas (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo      TEXT NOT NULL UNIQUE,  -- PEN, USD, EUR
  nombre      TEXT NOT NULL,
  simbolo     TEXT NOT NULL,
  activo      BOOLEAN NOT NULL DEFAULT TRUE
);

-- ── Catálogo: bancos ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS catalogo_bancos (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo      TEXT NOT NULL UNIQUE,
  nombre      TEXT NOT NULL,
  nombre_corto TEXT,
  activo      BOOLEAN NOT NULL DEFAULT TRUE
);

-- ── Función: actualizar fecha_actualizacion automáticamente ──────
CREATE OR REPLACE FUNCTION fn_actualizar_fecha()
RETURNS TRIGGER AS $$
BEGIN
  NEW.fecha_actualizacion = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers de actualización automática
CREATE TRIGGER trg_usuarios_fecha
  BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION fn_actualizar_fecha();

CREATE TRIGGER trg_empresas_fecha
  BEFORE UPDATE ON empresas_operadoras
  FOR EACH ROW EXECUTE FUNCTION fn_actualizar_fecha();

CREATE TRIGGER trg_config_fecha
  BEFORE UPDATE ON configuracion_global
  FOR EACH ROW EXECUTE FUNCTION fn_actualizar_fecha();

-- ── Índices para rendimiento ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_usuarios_auth_id   ON usuarios(auth_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_email      ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_ue_usuario          ON usuarios_empresas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_ue_empresa          ON usuarios_empresas(empresa_operadora_id);
CREATE INDEX IF NOT EXISTS idx_historial_empresa   ON historial_cambios(empresa_id);
CREATE INDEX IF NOT EXISTS idx_historial_usuario   ON historial_cambios(usuario_id);
CREATE INDEX IF NOT EXISTS idx_historial_fecha     ON historial_cambios(fecha DESC);
