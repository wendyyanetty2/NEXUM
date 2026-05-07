-- ═══════════════════════════════════════════════════════════════
-- NEXUM v3.1 — Migración 014: Planilla de Movilidad
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Tabla cabecera de planillas ───────────────────────────────
CREATE TABLE IF NOT EXISTS planillas_movilidad (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_operadora_id  UUID NOT NULL REFERENCES empresas_operadoras(id) ON DELETE CASCADE,
  numero_planilla       VARCHAR(20) NOT NULL,          -- ej. 007-11-25
  trabajador_nombre     VARCHAR(200) NOT NULL,
  trabajador_dni        VARCHAR(20)  NOT NULL,
  mes                   VARCHAR(7)   NOT NULL,          -- YYYY-MM
  fecha_emision         DATE         NOT NULL DEFAULT CURRENT_DATE,
  total_gastos          NUMERIC(12,2) DEFAULT 0,
  estado                VARCHAR(20)  DEFAULT 'BORRADOR'
                        CHECK (estado IN ('BORRADOR','ENVIADO','APROBADO')),
  firma_trabajador      BOOLEAN      DEFAULT FALSE,
  notas                 TEXT,
  creado_por            UUID REFERENCES usuarios(id),
  created_at            TIMESTAMPTZ  DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE (empresa_operadora_id, numero_planilla)
);

CREATE INDEX IF NOT EXISTS idx_pm_empresa    ON planillas_movilidad(empresa_operadora_id);
CREATE INDEX IF NOT EXISTS idx_pm_mes        ON planillas_movilidad(mes);
CREATE INDEX IF NOT EXISTS idx_pm_trabajador ON planillas_movilidad(trabajador_dni);
CREATE INDEX IF NOT EXISTS idx_pm_estado     ON planillas_movilidad(estado);

ALTER TABLE planillas_movilidad ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pm_sa"  ON planillas_movilidad FOR ALL
  USING (es_super_admin()) WITH CHECK (es_super_admin());
CREATE POLICY "pm_usr" ON planillas_movilidad FOR ALL
  USING (empresa_operadora_id IN (SELECT mis_empresas()));

-- ── 2. Tabla de filas de detalle ─────────────────────────────────
CREATE TABLE IF NOT EXISTS planilla_movilidad_detalles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  planilla_id     UUID NOT NULL REFERENCES planillas_movilidad(id) ON DELETE CASCADE,
  orden           SMALLINT DEFAULT 1,
  fecha           DATE NOT NULL,
  motivo          VARCHAR(300) NOT NULL,
  origen          VARCHAR(150),
  destino         VARCHAR(150),
  proyecto        VARCHAR(200),
  empresa_cliente VARCHAR(200),
  monto           NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pmd_planilla ON planilla_movilidad_detalles(planilla_id);

ALTER TABLE planilla_movilidad_detalles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pmd_sa"  ON planilla_movilidad_detalles FOR ALL
  USING (es_super_admin()) WITH CHECK (es_super_admin());
CREATE POLICY "pmd_usr" ON planilla_movilidad_detalles FOR ALL
  USING (planilla_id IN (
    SELECT id FROM planillas_movilidad
    WHERE empresa_operadora_id IN (SELECT mis_empresas())
  ));
