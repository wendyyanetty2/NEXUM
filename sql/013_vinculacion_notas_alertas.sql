-- ═══════════════════════════════════════════════════════════════
-- NEXUM v3.0 — Migración 013: Vinculación RH, Notas, Alertas, Períodos
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Tabla: vinculación RH ↔ Movimientos ───────────────────────
CREATE TABLE IF NOT EXISTS rh_movimiento_links (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        UUID NOT NULL REFERENCES empresas_operadoras(id) ON DELETE CASCADE,
  rh_id             UUID NOT NULL REFERENCES rh_registros(id) ON DELETE CASCADE,
  movimiento_id     UUID NOT NULL REFERENCES movimientos(id) ON DELETE CASCADE,
  nivel_confianza   VARCHAR(10) CHECK (nivel_confianza IN ('alto', 'medio', 'posible')),
  es_parcial        BOOLEAN DEFAULT FALSE,
  monto_parcial     NUMERIC(12,2),
  confirmado_por    UUID REFERENCES usuarios(id),
  confirmado_en     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(rh_id, movimiento_id)
);

CREATE INDEX IF NOT EXISTS idx_rh_links_rh   ON rh_movimiento_links(rh_id);
CREATE INDEX IF NOT EXISTS idx_rh_links_mov  ON rh_movimiento_links(movimiento_id);
CREATE INDEX IF NOT EXISTS idx_rh_links_emp  ON rh_movimiento_links(empresa_id);

ALTER TABLE rh_movimiento_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_links_sa"  ON rh_movimiento_links FOR ALL USING (es_super_admin()) WITH CHECK (es_super_admin());
CREATE POLICY "rh_links_usr" ON rh_movimiento_links FOR ALL USING (empresa_id IN (SELECT mis_empresas()));

-- ── 2. Tabla: notas operativas ────────────────────────────────────
CREATE TABLE IF NOT EXISTS notas_operativas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          UUID NOT NULL REFERENCES empresas_operadoras(id) ON DELETE CASCADE,
  usuario_id          UUID NOT NULL REFERENCES usuarios(id),
  titulo              VARCHAR(200) NOT NULL,
  descripcion         TEXT,
  tipo                VARCHAR(30) DEFAULT 'libre'
                      CHECK (tipo IN ('adelanto','rh_pendiente','comprobante_pendiente','regularizar','descuento_planilla','libre')),
  entidad_tipo        VARCHAR(30) CHECK (entidad_tipo IN ('movimiento','rh','trabajador','factura')),
  entidad_id          UUID,
  monto_referencia    NUMERIC(12,2),
  persona_referencia  VARCHAR(200),
  fecha_vencimiento   DATE,
  prioridad           VARCHAR(10) DEFAULT 'media' CHECK (prioridad IN ('alta','media','baja')),
  estado              VARCHAR(20) DEFAULT 'pendiente'
                      CHECK (estado IN ('pendiente','en_proceso','resuelta','ignorada')),
  resuelta_por        UUID REFERENCES usuarios(id),
  resuelta_en         TIMESTAMPTZ,
  resolucion_comentario TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notas_empresa  ON notas_operativas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_notas_estado   ON notas_operativas(estado);
CREATE INDEX IF NOT EXISTS idx_notas_vence    ON notas_operativas(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_notas_usuario  ON notas_operativas(usuario_id);

ALTER TABLE notas_operativas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notas_sa"  ON notas_operativas FOR ALL USING (es_super_admin()) WITH CHECK (es_super_admin());
CREATE POLICY "notas_usr" ON notas_operativas FOR ALL USING (empresa_id IN (SELECT mis_empresas()));

-- ── 3. Tabla: alertas del sistema ────────────────────────────────
CREATE TABLE IF NOT EXISTS alertas_sistema (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       UUID NOT NULL REFERENCES empresas_operadoras(id) ON DELETE CASCADE,
  tipo             VARCHAR(50) NOT NULL
                   CHECK (tipo IN ('adelanto_pendiente','rh_sin_aplicar','sin_comprobante','posible_duplicado','diferencia_planilla','nota_vence')),
  prioridad        VARCHAR(10) DEFAULT 'media' CHECK (prioridad IN ('alta','media','baja')),
  titulo           VARCHAR(300) NOT NULL,
  descripcion      TEXT,
  entidad_tipo     VARCHAR(30),
  entidad_id       UUID,
  nota_id          UUID REFERENCES notas_operativas(id) ON DELETE SET NULL,
  monto            NUMERIC(12,2),
  fecha_vencimiento DATE,
  estado           VARCHAR(20) DEFAULT 'activa'
                   CHECK (estado IN ('activa','resuelta','ignorada','pospuesta')),
  resuelta_por     UUID REFERENCES usuarios(id),
  resuelta_en      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alertas_empresa ON alertas_sistema(empresa_id);
CREATE INDEX IF NOT EXISTS idx_alertas_estado  ON alertas_sistema(estado);
CREATE INDEX IF NOT EXISTS idx_alertas_tipo    ON alertas_sistema(tipo);

ALTER TABLE alertas_sistema ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alertas_sa"  ON alertas_sistema FOR ALL USING (es_super_admin()) WITH CHECK (es_super_admin());
CREATE POLICY "alertas_usr" ON alertas_sistema FOR ALL USING (empresa_id IN (SELECT mis_empresas()));

-- ── 4. Tabla: períodos contables ──────────────────────────────────
CREATE TABLE IF NOT EXISTS periodos_contables (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id           UUID NOT NULL REFERENCES empresas_operadoras(id) ON DELETE CASCADE,
  periodo              VARCHAR(7) NOT NULL,
  estado               VARCHAR(20) DEFAULT 'abierto' CHECK (estado IN ('abierto','cerrado','archivado')),
  cerrado_por          UUID REFERENCES usuarios(id),
  cerrado_en           TIMESTAMPTZ,
  total_movimientos    INT,
  total_rh             INT,
  monto_total_cargos   NUMERIC(14,2),
  monto_total_abonos   NUMERIC(14,2),
  UNIQUE(empresa_id, periodo)
);

CREATE INDEX IF NOT EXISTS idx_periodos_empresa ON periodos_contables(empresa_id);

ALTER TABLE periodos_contables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "periodos_sa"  ON periodos_contables FOR ALL USING (es_super_admin()) WITH CHECK (es_super_admin());
CREATE POLICY "periodos_usr" ON periodos_contables FOR ALL USING (empresa_id IN (SELECT mis_empresas()));

-- ── 5. Índices de rendimiento por período en tablas existentes ────
CREATE INDEX IF NOT EXISTS idx_movimientos_empresa_periodo
  ON movimientos(empresa_operadora_id, fecha);

CREATE INDEX IF NOT EXISTS idx_rh_empresa_periodo
  ON rh_registros(empresa_operadora_id, periodo);

-- ── 6. Columna periodo en movimientos (si no existe) ─────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'movimientos' AND column_name = 'periodo'
  ) THEN
    ALTER TABLE movimientos ADD COLUMN periodo VARCHAR(7)
      GENERATED ALWAYS AS (TO_CHAR(fecha, 'YYYY-MM')) STORED;
  END IF;
END $$;

-- ── 7. Trigger updated_at para notas_operativas ───────────────────
CREATE OR REPLACE FUNCTION fn_notas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notas_updated ON notas_operativas;
CREATE TRIGGER trg_notas_updated
  BEFORE UPDATE ON notas_operativas
  FOR EACH ROW EXECUTE FUNCTION fn_notas_updated_at();
