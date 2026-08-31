-- ═══════════════════════════════════════════════════════════════
-- NEXUM v3.0 — Migración 016: Conceptos recurrentes bancarios
-- (mejora detección de duplicados en Tesorería → Movimientos)
-- ═══════════════════════════════════════════════════════════════
-- Catálogo por empresa de descripciones de cargos bancarios que se
-- repiten legítimamente (ITF, comisiones de mantenimiento, etc.) y
-- que NO deben tratarse como duplicados solo por compartir monto y
-- descripción con un N° de comprobante genérico (00000000/vacío).
-- Ver js/duplicados.js — _dupRazonMovimiento.

CREATE TABLE IF NOT EXISTS conceptos_recurrentes_bancarios (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_operadora_id UUID NOT NULL REFERENCES empresas_operadoras(id) ON DELETE CASCADE,
  nombre               TEXT NOT NULL,
  activo               BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crb_operadora ON conceptos_recurrentes_bancarios(empresa_operadora_id);

ALTER TABLE conceptos_recurrentes_bancarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crb_superadmin" ON conceptos_recurrentes_bancarios FOR ALL USING (es_super_admin()) WITH CHECK (es_super_admin());
CREATE POLICY "crb_usuario"    ON conceptos_recurrentes_bancarios FOR ALL USING (empresa_operadora_id IN (SELECT mis_empresas()));
