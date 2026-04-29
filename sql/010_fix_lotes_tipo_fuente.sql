-- Ampliar constraint tipo_fuente en lotes_importacion
-- para incluir valores usados por Importar SUNAT (Tesorería)

ALTER TABLE lotes_importacion
  DROP CONSTRAINT IF EXISTS lotes_importacion_tipo_fuente_check;

ALTER TABLE lotes_importacion
  ADD CONSTRAINT lotes_importacion_tipo_fuente_check
  CHECK (tipo_fuente IN (
    'BCP', 'BBVA', 'INTERBANK', 'SCOTIABANK',
    'MANUAL', 'OTRO',
    'SUNAT_COMPRAS', 'SUNAT_VENTAS',
    'MBD'
  ));
