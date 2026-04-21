-- ═══════════════════════════════════════════════════════════════
-- NEXUM v3.0 — Migración 003: Datos iniciales (seed)
-- Ejecutar DESPUÉS de 001 y 002
-- ═══════════════════════════════════════════════════════════════

-- ── Monedas ───────────────────────────────────────────────────────
INSERT INTO catalogo_monedas (codigo, nombre, simbolo, activo) VALUES
  ('PEN', 'Sol Peruano',        'S/',  TRUE),
  ('USD', 'Dólar Americano',    '$',   TRUE),
  ('EUR', 'Euro',               '€',   FALSE)
ON CONFLICT (codigo) DO NOTHING;

-- ── Tipos de documento SUNAT ──────────────────────────────────────
INSERT INTO catalogo_tipos_documento (codigo, nombre, activo) VALUES
  ('01', 'Factura',                              TRUE),
  ('02', 'Recibo por Honorarios',                TRUE),
  ('03', 'Boleta de Venta',                      TRUE),
  ('04', 'Liquidación de Compra',                TRUE),
  ('07', 'Nota de Crédito',                      TRUE),
  ('08', 'Nota de Débito',                       TRUE),
  ('09', 'Guía de Remisión - Remitente',         TRUE),
  ('12', 'Ticket o Cinta emitido por máquina',   TRUE),
  ('14', 'Recibo de Servicio Público',           TRUE),
  ('18', 'Documentos emitidos por bancos',       TRUE),
  ('20', 'Comprobante de Retención',             TRUE),
  ('31', 'Guía de Remisión - Transportista',     TRUE),
  ('40', 'Comprobante de Percepción',            TRUE),
  ('56', 'Comprobante de Pago - No domiciliado', FALSE),
  ('87', 'Nota de Crédito Especial',             FALSE),
  ('88', 'Nota de Débito Especial',              FALSE),
  ('91', 'Comprobante No Autorizado',            FALSE),
  ('97', 'Nota de Crédito - No domiciliado',     FALSE),
  ('98', 'Nota de Débito - No domiciliado',      FALSE),
  ('NE', 'No Especificado',                      TRUE)
ON CONFLICT (codigo) DO NOTHING;

-- ── Bancos peruanos ───────────────────────────────────────────────
INSERT INTO catalogo_bancos (codigo, nombre, nombre_corto, activo) VALUES
  ('BCP',     'Banco de Crédito del Perú',                  'BCP',      TRUE),
  ('BBVA',    'BBVA Continental',                           'BBVA',     TRUE),
  ('IBK',     'Interbank',                                  'IBK',      TRUE),
  ('SCOT',    'Scotiabank Perú',                            'Scotiabank',TRUE),
  ('MIB',     'Mibanco',                                    'Mibanco',  TRUE),
  ('BN',      'Banco de la Nación',                         'B. Nación',TRUE),
  ('BANBIF',  'BanBif',                                     'BanBif',   TRUE),
  ('PICHINCHA','Banco Pichincha',                           'Pichincha', TRUE),
  ('GNB',     'Banco GNB Perú',                             'GNB',      TRUE),
  ('CMAC_AQP','Caja Municipal Arequipa',                    'CMAC AQP', TRUE),
  ('CMAC_PIU','Caja Municipal Piura',                       'CMAC PIU', TRUE),
  ('CMAC_CUS','Caja Municipal Cusco',                       'CMAC CUS', TRUE),
  ('CMAC_HUA','Caja Municipal Huancayo',                    'CMAC HUA', TRUE),
  ('ALFIN',   'Alfin Banco',                                'Alfin',    FALSE),
  ('CITIBANK','Citibank Perú',                              'Citi',     FALSE),
  ('CAJA_PAI','Caja Paita',                                 'C. Paita', FALSE),
  ('OTRO',    'Otro banco / Entidad financiera',            'Otro',     TRUE)
ON CONFLICT (codigo) DO NOTHING;

-- ── Tipos de operación bancaria ───────────────────────────────────
INSERT INTO catalogo_tipos_operacion (codigo, nombre, naturaleza, activo) VALUES
  ('TRANS_IN',   'Transferencia recibida',           'ABONO',  TRUE),
  ('TRANS_OUT',  'Transferencia enviada',            'CARGO',  TRUE),
  ('DEP_EFE',    'Depósito en efectivo',             'ABONO',  TRUE),
  ('RET_EFE',    'Retiro en efectivo',               'CARGO',  TRUE),
  ('CHEQUE_IN',  'Cobro de cheque',                  'ABONO',  TRUE),
  ('CHEQUE_OUT', 'Pago con cheque',                  'CARGO',  TRUE),
  ('PAGO_SERV',  'Pago de servicios',                'CARGO',  TRUE),
  ('COBRO_SERV', 'Cobro de servicios',               'ABONO',  TRUE),
  ('COMISION',   'Comisión bancaria',                'CARGO',  TRUE),
  ('INTERES',    'Interés bancario',                 'AMBOS',  TRUE),
  ('ITF',        'Impuesto a las Transacciones Financieras', 'CARGO', TRUE),
  ('DETRACCION', 'Detracción',                       'CARGO',  TRUE),
  ('CCI',        'Abono por CCI',                    'ABONO',  TRUE),
  ('PLANILLA',   'Pago de planilla',                 'CARGO',  TRUE),
  ('PROVEEDOR',  'Pago a proveedor',                 'CARGO',  TRUE),
  ('CLIENTE',    'Cobro a cliente',                  'ABONO',  TRUE),
  ('PRESTAMO',   'Préstamo / Financiamiento',        'AMBOS',  TRUE),
  ('OTRO',       'Otra operación',                   'AMBOS',  TRUE)
ON CONFLICT (codigo) DO NOTHING;

-- ── Estados del sistema ───────────────────────────────────────────
INSERT INTO catalogo_estados (codigo, nombre, modulo, color, activo) VALUES
  -- Tesorería
  ('PENDIENTE',       'Pendiente',          'TESORERIA',    '#D69E2E', TRUE),
  ('EMITIDO',         'Emitido',            'TESORERIA',    '#2C5282', TRUE),
  ('OBSERVADO',       'Observado',          'TESORERIA',    '#C53030', TRUE),
  ('ANULADO',         'Anulado',            'TESORERIA',    '#718096', TRUE),
  ('EN_SIMULACION',   'En simulación',      'TESORERIA',    '#6B46C1', TRUE),
  ('APROBADO',        'Aprobado',           'TESORERIA',    '#2F855A', TRUE),
  ('REQUIERE_RH',     'Requiere RR.HH.',    'TESORERIA',    '#C05621', TRUE),
  -- General
  ('ACTIVO',          'Activo',             'GENERAL',      '#2F855A', TRUE),
  ('INACTIVO',        'Inactivo',           'GENERAL',      '#718096', TRUE),
  ('BORRADOR',        'Borrador',           'GENERAL',      '#D69E2E', TRUE),
  -- Planilla
  ('CALCULADO',       'Calculado',          'PLANILLA',     '#2C5282', TRUE),
  ('PAGADO',          'Pagado',             'PLANILLA',     '#2F855A', TRUE),
  -- Tributaria
  ('POR_DECLARAR',    'Por declarar',       'TRIBUTARIA',   '#D69E2E', TRUE),
  ('DECLARADO',       'Declarado',          'TRIBUTARIA',   '#2F855A', TRUE),
  ('VENCIDO',         'Vencido',            'TRIBUTARIA',   '#C53030', TRUE)
ON CONFLICT (codigo) DO NOTHING;

-- ── Cuentas PCGE principales (nivel 1 y 2) ────────────────────────
INSERT INTO catalogo_cuentas_pcge (codigo, nombre, tipo, nivel, activo) VALUES
  -- Activo
  ('10', 'Efectivo y Equivalentes de Efectivo',    'ACTIVO',    1, TRUE),
  ('11', 'Inversiones Financieras',                'ACTIVO',    1, TRUE),
  ('12', 'Cuentas por Cobrar Comerciales',         'ACTIVO',    1, TRUE),
  ('14', 'Cuentas por Cobrar al Personal',         'ACTIVO',    1, TRUE),
  ('16', 'Cuentas por Cobrar Diversas',            'ACTIVO',    1, TRUE),
  ('17', 'Cuentas por Cobrar a Accionistas',       'ACTIVO',    1, TRUE),
  ('18', 'Servicios y Otros Contratados',          'ACTIVO',    1, TRUE),
  ('19', 'Estimación de Cuentas de Cobranza Dudosa','ACTIVO',   1, TRUE),
  ('20', 'Mercaderías',                            'ACTIVO',    1, TRUE),
  ('25', 'Materiales Auxiliares',                  'ACTIVO',    1, TRUE),
  ('26', 'Envases y Embalajes',                    'ACTIVO',    1, TRUE),
  ('27', 'Activos No Corrientes Mantenidos para Venta','ACTIVO',1, TRUE),
  ('28', 'Existencias por Recibir',                'ACTIVO',    1, TRUE),
  ('29', 'Desvalorización de Existencias',         'ACTIVO',    1, TRUE),
  ('30', 'Inversiones Mobiliarias',                'ACTIVO',    1, TRUE),
  ('31', 'Propiedades de Inversión',               'ACTIVO',    1, TRUE),
  ('32', 'Activos por Derechos de Uso',            'ACTIVO',    1, TRUE),
  ('33', 'Inmuebles, Maquinaria y Equipo',         'ACTIVO',    1, TRUE),
  ('34', 'Intangibles',                            'ACTIVO',    1, TRUE),
  ('35', 'Activos Biológicos',                     'ACTIVO',    1, TRUE),
  ('36', 'Desvalorización de Activo Inmovilizado', 'ACTIVO',    1, TRUE),
  ('37', 'Activo Diferido',                        'ACTIVO',    1, TRUE),
  ('38', 'Otros Activos',                          'ACTIVO',    1, TRUE),
  ('39', 'Depreciación, Amortización y Agotamiento','ACTIVO',   1, TRUE),
  -- Pasivo
  ('40', 'Tributos por Pagar',                     'PASIVO',    1, TRUE),
  ('41', 'Remuneraciones y Participaciones por Pagar','PASIVO', 1, TRUE),
  ('42', 'Cuentas por Pagar Comerciales',          'PASIVO',    1, TRUE),
  ('43', 'Cuentas por Pagar a Vinculadas',         'PASIVO',    1, TRUE),
  ('44', 'Cuentas por Pagar a Accionistas',        'PASIVO',    1, TRUE),
  ('45', 'Obligaciones Financieras',               'PASIVO',    1, TRUE),
  ('46', 'Cuentas por Pagar Diversas',             'PASIVO',    1, TRUE),
  ('47', 'Pasivo Diferido',                        'PASIVO',    1, TRUE),
  ('48', 'Provisiones',                            'PASIVO',    1, TRUE),
  ('49', 'Pasivo por Impuesto a las Ganancias Diferido','PASIVO',1,TRUE),
  -- Patrimonio
  ('50', 'Capital',                                'PATRIMONIO', 1, TRUE),
  ('52', 'Capital Adicional',                      'PATRIMONIO', 1, TRUE),
  ('56', 'Resultados No Realizados',               'PATRIMONIO', 1, TRUE),
  ('57', 'Excedente de Revaluación',               'PATRIMONIO', 1, TRUE),
  ('58', 'Reservas',                               'PATRIMONIO', 1, TRUE),
  ('59', 'Resultados Acumulados',                  'PATRIMONIO', 1, TRUE),
  -- Ingresos
  ('70', 'Ventas',                                 'INGRESO',    1, TRUE),
  ('71', 'Variación de la Producción Almacenada',  'INGRESO',    1, TRUE),
  ('72', 'Producción de Activo Inmovilizado',      'INGRESO',    1, TRUE),
  ('73', 'Descuentos, Rebajas y Bonificaciones Obtenidos','INGRESO',1,TRUE),
  ('74', 'Descuentos, Rebajas y Bonificaciones Concedidos','INGRESO',1,TRUE),
  ('75', 'Otros Ingresos de Gestión',              'INGRESO',    1, TRUE),
  ('76', 'Ganancia por Medición a VR y por Diferencia de Cambio','INGRESO',1,TRUE),
  ('77', 'Ingresos Financieros',                   'INGRESO',    1, TRUE),
  ('78', 'Cargas Cubiertas por Provisiones',       'INGRESO',    1, TRUE),
  ('79', 'Cargas Imputables a Cuentas de Costos',  'INGRESO',    1, TRUE),
  -- Gastos
  ('60', 'Compras',                                'GASTO',      1, TRUE),
  ('61', 'Variación de Existencias',               'GASTO',      1, TRUE),
  ('62', 'Gastos de Personal',                     'GASTO',      1, TRUE),
  ('63', 'Gastos de Servicios Prestados por Terceros','GASTO',   1, TRUE),
  ('64', 'Gastos por Tributos',                    'GASTO',      1, TRUE),
  ('65', 'Otros Gastos de Gestión',                'GASTO',      1, TRUE),
  ('66', 'Pérdida por Medición a VR y por Diferencia de Cambio','GASTO',1,TRUE),
  ('67', 'Gastos Financieros',                     'GASTO',      1, TRUE),
  ('68', 'Valuación y Deterioro de Activos',       'GASTO',      1, TRUE),
  ('69', 'Costo de Ventas',                        'COSTO',      1, TRUE)
ON CONFLICT (codigo) DO NOTHING;

-- ── Configuración global inicial ──────────────────────────────────
INSERT INTO configuracion_global (clave, valor, descripcion, tipo_dato) VALUES
  ('moneda_principal',    'PEN',          'Moneda principal del sistema',          'texto'),
  ('formato_fecha',       'DD/MM/YYYY',   'Formato de fecha de la interfaz',       'texto'),
  ('version_sistema',     '3.0',          'Versión actual del sistema NEXUM',      'texto'),
  ('items_por_pagina',    '20',           'Registros por página en listados',      'numero'),
  ('igv_porcentaje',      '18',           'Porcentaje de IGV vigente',             'numero'),
  ('detraccion_umbral',   '700',          'Monto mínimo para aplicar detracción',  'numero')
ON CONFLICT (clave) DO NOTHING;
