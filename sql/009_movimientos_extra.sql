-- ═══════════════════════════════════════════════════════════════
-- NEXUM v3.0 — Migración 009: Movimientos extra + Prestadores + RH + Conciliaciones
-- ═══════════════════════════════════════════════════════════════

-- ── Columnas adicionales en movimientos ──────────────────────────
ALTER TABLE movimientos
  ADD COLUMN IF NOT EXISTS cotizacion        TEXT,
  ADD COLUMN IF NOT EXISTS oc                TEXT,
  ADD COLUMN IF NOT EXISTS estado_doc        TEXT DEFAULT 'PENDIENTE'
    CHECK (estado_doc IN ('EMITIDO','PENDIENTE','OBSERVADO','CANCELADO')),
  ADD COLUMN IF NOT EXISTS detalles_servicio TEXT,
  ADD COLUMN IF NOT EXISTS observaciones_2   TEXT;

-- ── Prestadores de servicios (GLOBAL, sin empresa_operadora_id) ──
CREATE TABLE IF NOT EXISTS prestadores_servicios (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dni              TEXT NOT NULL UNIQUE,
  nombre           TEXT NOT NULL,
  ruc              TEXT,
  email            TEXT,
  celular          TEXT,
  banco            TEXT,
  numero_cuenta    TEXT,
  activo           BOOLEAN DEFAULT TRUE,
  tiene_suspension BOOLEAN DEFAULT FALSE,
  fecha_suspension DATE,
  fecha_creacion   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE prestadores_servicios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps_superadmin" ON prestadores_servicios FOR ALL USING (es_super_admin()) WITH CHECK (es_super_admin());
CREATE POLICY "ps_lectura"    ON prestadores_servicios FOR SELECT USING (true);
CREATE POLICY "ps_escritura"  ON prestadores_servicios FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- ── Recibos por Honorarios ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rh_registros (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_operadora_id UUID NOT NULL REFERENCES empresas_operadoras(id) ON DELETE CASCADE,
  prestador_id         UUID NOT NULL REFERENCES prestadores_servicios(id),
  periodo              TEXT NOT NULL,
  fecha_emision        DATE NOT NULL,
  numero_rh            TEXT,
  concepto             TEXT NOT NULL,
  monto_bruto          NUMERIC(14,2) NOT NULL,
  tiene_retencion      BOOLEAN DEFAULT TRUE,
  porcentaje_retencion NUMERIC(5,2) DEFAULT 8.00,
  monto_retencion      NUMERIC(14,2) DEFAULT 0,
  monto_neto           NUMERIC(14,2) NOT NULL,
  estado               TEXT DEFAULT 'EMITIDO' CHECK (estado IN ('BORRADOR','EMITIDO','ANULADO')),
  observaciones        TEXT,
  usuario_id           UUID REFERENCES usuarios(id),
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE rh_registros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_sa" ON rh_registros FOR ALL USING (es_super_admin()) WITH CHECK (es_super_admin());
CREATE POLICY "rh_u"  ON rh_registros FOR ALL USING (empresa_operadora_id IN (SELECT mis_empresas()));

-- ── Conciliaciones ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conciliaciones (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_operadora_id UUID NOT NULL REFERENCES empresas_operadoras(id) ON DELETE CASCADE,
  movimiento_id        UUID NOT NULL REFERENCES movimientos(id),
  doc_tipo             TEXT NOT NULL CHECK (doc_tipo IN ('COMPRA','VENTA','RH','OTRO')),
  doc_id               UUID,
  score                INTEGER DEFAULT 0,
  tipo_match           TEXT NOT NULL CHECK (tipo_match IN ('EXACTO','POSIBLE','MANUAL')),
  estado               TEXT DEFAULT 'APROBADO' CHECK (estado IN ('APROBADO','RECHAZADO')),
  clasificacion_manual TEXT,
  usuario_id           UUID REFERENCES usuarios(id),
  fecha_conciliacion   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE conciliaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "con_sa" ON conciliaciones FOR ALL USING (es_super_admin()) WITH CHECK (es_super_admin());
CREATE POLICY "con_u"  ON conciliaciones FOR ALL USING (empresa_operadora_id IN (SELECT mis_empresas()));

-- ── Índices ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_mov_cotizacion    ON movimientos(cotizacion);
CREATE INDEX IF NOT EXISTS idx_mov_estado_doc    ON movimientos(estado_doc);

CREATE INDEX IF NOT EXISTS idx_ps_dni            ON prestadores_servicios(dni);
CREATE INDEX IF NOT EXISTS idx_ps_ruc            ON prestadores_servicios(ruc);
CREATE INDEX IF NOT EXISTS idx_ps_activo         ON prestadores_servicios(activo);

CREATE INDEX IF NOT EXISTS idx_rh_operadora      ON rh_registros(empresa_operadora_id);
CREATE INDEX IF NOT EXISTS idx_rh_periodo        ON rh_registros(empresa_operadora_id, periodo);
CREATE INDEX IF NOT EXISTS idx_rh_prestador      ON rh_registros(prestador_id);
CREATE INDEX IF NOT EXISTS idx_rh_estado         ON rh_registros(estado);

CREATE INDEX IF NOT EXISTS idx_con_operadora     ON conciliaciones(empresa_operadora_id);
CREATE INDEX IF NOT EXISTS idx_con_movimiento    ON conciliaciones(movimiento_id);
CREATE INDEX IF NOT EXISTS idx_con_doc           ON conciliaciones(doc_tipo, doc_id);
CREATE INDEX IF NOT EXISTS idx_con_estado        ON conciliaciones(estado);
