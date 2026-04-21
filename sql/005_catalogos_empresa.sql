-- ═══════════════════════════════════════════════════════════════
-- NEXUM v3.0 — Migración 005: Catálogos por empresa operadora
-- ═══════════════════════════════════════════════════════════════

-- ── Empresas-clientes (clientes y/o proveedores de cada operadora) ──
CREATE TABLE IF NOT EXISTS empresas_clientes (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_operadora_id UUID NOT NULL REFERENCES empresas_operadoras(id) ON DELETE CASCADE,
  nombre               TEXT NOT NULL,
  ruc_dni              TEXT,
  tipo                 TEXT NOT NULL DEFAULT 'AMBOS' CHECK (tipo IN ('CLIENTE','PROVEEDOR','AMBOS')),
  direccion            TEXT,
  telefono             TEXT,
  email                TEXT,
  activo               BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Conceptos (rubros de gasto/ingreso por empresa) ──────────────
CREATE TABLE IF NOT EXISTS conceptos (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_operadora_id UUID NOT NULL REFERENCES empresas_operadoras(id) ON DELETE CASCADE,
  nombre               TEXT NOT NULL,
  tipo                 TEXT CHECK (tipo IN ('GASTO','INGRESO','AMBOS')) DEFAULT 'AMBOS',
  activo               BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Autorizaciones (personas que autorizan operaciones) ──────────
CREATE TABLE IF NOT EXISTS autorizaciones (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_operadora_id UUID NOT NULL REFERENCES empresas_operadoras(id) ON DELETE CASCADE,
  nombre               TEXT NOT NULL,
  cargo                TEXT,
  activo               BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Proyectos ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS proyectos (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_operadora_id UUID NOT NULL REFERENCES empresas_operadoras(id) ON DELETE CASCADE,
  nombre               TEXT NOT NULL,
  cliente_id           UUID REFERENCES empresas_clientes(id),
  descripcion          TEXT,
  activo               BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Medios de pago por empresa ────────────────────────────────────
CREATE TABLE IF NOT EXISTS medios_pago (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_operadora_id UUID NOT NULL REFERENCES empresas_operadoras(id) ON DELETE CASCADE,
  nombre               TEXT NOT NULL,
  banco_codigo         TEXT,
  numero_cuenta        TEXT,
  cci                  TEXT,
  tipo                 TEXT CHECK (tipo IN ('EFECTIVO','TRANSFERENCIA','CHEQUE','TARJETA','YAPE','PLIN','OTRO')) DEFAULT 'TRANSFERENCIA',
  moneda               TEXT DEFAULT 'PEN',
  activo               BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Trabajadores ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trabajadores (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_operadora_id UUID NOT NULL REFERENCES empresas_operadoras(id) ON DELETE CASCADE,
  dni                  TEXT NOT NULL,
  nombre               TEXT NOT NULL,
  apellido_paterno     TEXT,
  apellido_materno     TEXT,
  cargo                TEXT,
  area                 TEXT,
  fecha_ingreso        DATE,
  sueldo_base          NUMERIC(10,2),
  tipo_contrato        TEXT CHECK (tipo_contrato IN ('PLANILLA','RECIBO_HONORARIOS','CAS','OTRO')) DEFAULT 'PLANILLA',
  banco_codigo         TEXT,
  numero_cuenta        TEXT,
  cci                  TEXT,
  afp                  TEXT,
  cuspp                TEXT,
  activo               BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Índices ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ec_operadora  ON empresas_clientes(empresa_operadora_id);
CREATE INDEX IF NOT EXISTS idx_con_operadora ON conceptos(empresa_operadora_id);
CREATE INDEX IF NOT EXISTS idx_aut_operadora ON autorizaciones(empresa_operadora_id);
CREATE INDEX IF NOT EXISTS idx_pro_operadora ON proyectos(empresa_operadora_id);
CREATE INDEX IF NOT EXISTS idx_mp_operadora  ON medios_pago(empresa_operadora_id);
CREATE INDEX IF NOT EXISTS idx_trab_operadora ON trabajadores(empresa_operadora_id);

-- ── RLS catálogos por empresa ─────────────────────────────────────
ALTER TABLE empresas_clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ec_superadmin" ON empresas_clientes FOR ALL USING (es_super_admin()) WITH CHECK (es_super_admin());
CREATE POLICY "ec_usuario"    ON empresas_clientes FOR ALL USING (empresa_operadora_id IN (SELECT mis_empresas()));

ALTER TABLE conceptos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "con_superadmin" ON conceptos FOR ALL USING (es_super_admin()) WITH CHECK (es_super_admin());
CREATE POLICY "con_usuario"    ON conceptos FOR ALL USING (empresa_operadora_id IN (SELECT mis_empresas()));

ALTER TABLE autorizaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aut_superadmin" ON autorizaciones FOR ALL USING (es_super_admin()) WITH CHECK (es_super_admin());
CREATE POLICY "aut_usuario"    ON autorizaciones FOR ALL USING (empresa_operadora_id IN (SELECT mis_empresas()));

ALTER TABLE proyectos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pro_superadmin" ON proyectos FOR ALL USING (es_super_admin()) WITH CHECK (es_super_admin());
CREATE POLICY "pro_usuario"    ON proyectos FOR ALL USING (empresa_operadora_id IN (SELECT mis_empresas()));

ALTER TABLE medios_pago ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mp_superadmin" ON medios_pago FOR ALL USING (es_super_admin()) WITH CHECK (es_super_admin());
CREATE POLICY "mp_usuario"    ON medios_pago FOR ALL USING (empresa_operadora_id IN (SELECT mis_empresas()));

ALTER TABLE trabajadores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trab_superadmin" ON trabajadores FOR ALL USING (es_super_admin()) WITH CHECK (es_super_admin());
CREATE POLICY "trab_usuario"    ON trabajadores FOR ALL USING (empresa_operadora_id IN (SELECT mis_empresas()));
