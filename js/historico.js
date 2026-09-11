/* ============================================================
   NEXUM — Histórico / Respaldo mensual (Fase 1: solo exportación)

   Genera un Excel integral y restaurable de TODO lo trabajado en
   una empresa+período: MBD, EECC, Contabilidad, Tributaria, RH
   recibidos/emitidos, Planilla, Planilla de Movilidad, Asientos,
   conciliaciones y notas/alertas del período. Solo lectura sobre
   las tablas operativas; solo escribe una fila de trazabilidad
   (conteos, no datos) en periodos_contables.

   Cada hoja usa las MISMAS columnas legibles que el exportador
   propio de su módulo (con-compras.js, con-ventas.js, pla-rh.js,
   tes-importar-mbd.js, modules/reportes/index.html) — nada de IDs
   ni códigos crudos sin resolver. La diferencia con "Reporte
   global" de Reportes no es el formato (debe ser igual de legible)
   sino el alcance: el Histórico cubre TODAS las tablas (incluyendo
   MBD, Contabilidad interna y RH emitidos, que Reporte Global no
   trae) y queda etiquetado con METADATOS para poder restaurarse.

   No reemplaza los botones "Exportar" de cada módulo — este es el
   formato de Histórico/Restauración, reconocible por la hoja
   METADATOS con versión NEXUM-HIST-1.0.
   ============================================================ */

const NEXUM_HIST_VERSION = 'NEXUM-HIST-1.0';

function _histRangoMes(periodo) {
  const [y, m] = periodo.split('-').map(Number);
  const desde = `${periodo}-01`;
  const hasta = `${periodo}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
  return { desde, hasta };
}

function _histFmtFecha(iso) {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
  if (isNaN(d)) return iso;
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

// ── Cada _hist_* arma { cab, filas } listas para aoa_to_sheet, con
//    las mismas columnas y el mismo orden que el exportador propio
//    de ese módulo — así el Histórico se ve igual de legible. ──────

function _histMBD(data) {
  const cab = [
    'N° de operación','Fecha de Deposito','Descripcion','Moneda','Monto',
    'Proveedores / Empresa / Personal','RUC / DNI','COTIZACIÓN','OC','Proyecto',
    'Concepto','Empresa','Entrega de FA / DOC / RRHH','Nª Factura o DOC.',
    'Tipo de DOC','Autorización','Estado Conciliación',
  ];
  const filas = data.map(r => [
    r.nro_operacion_bancaria ? String(r.nro_operacion_bancaria).padStart(8,'0') : '',
    _histFmtFecha(r.fecha_deposito), r.descripcion||'', r.moneda||'S/', r.monto,
    r.proveedor_empresa_personal||'', r.ruc_dni||'', r.cotizacion||'', r.oc||'', r.proyecto||'',
    r.concepto||'', r.empresa||'', r.entrega_doc||'PENDIENTE', r.nro_factura_doc||'',
    r.tipo_doc||'', r.autorizacion||'', r.estado_conciliacion||'',
  ]);
  return { cab, filas };
}

function _histEECC(data) {
  const cab = ['Fecha','Cuenta','Naturaleza','Importe','Moneda','N° Operación','Descripción',
    'Tipo Operación','Estado','Tiene IGV','Base Imponible','IGV','Tiene Detracción','Monto Detracción','Observaciones'];
  const filas = data.map(m => [
    m.fecha, m.cuentas_bancarias?.nombre_alias||'', m.naturaleza, m.importe, m.moneda,
    m.numero_operacion||'', m.descripcion||'', m.tipo_operacion_codigo||'', m.estado,
    m.tiene_igv?'Sí':'No', m.base_imponible||0, m.igv||0,
    m.tiene_detraccion?'Sí':'No', m.monto_detraccion||0, m.observaciones||'',
  ]);
  return { cab, filas };
}

function _histContabCompras(data) {
  const cab = [
    'RUC','Apellidos y Nombres o Razón social','Periodo','CAR SUNAT',
    'Fecha de emisión','Fecha Vcto/Pago','Tipo CP/Doc.','Serie del CDP','Año',
    'Nro CP Nro Inicial (Rango)','Nro Final (Rango)','Tipo Doc Identidad','Nro Doc Identidad',
    'BI Gravado DG','IGV / IPM DG','Total CP','Moneda','Tiene Detracción','Monto Detracción',
    'Deducible Renta','Estado','Tipo de Nota',
  ];
  const filas = data.map(r => [
    r.ruc, r.razon_social||r.proveedor, r.periodo, r.car_sunat,
    r.fecha_emision, r.fecha_vcto_pago, r.tipo_cp_doc, r.serie_cdp, r.anio,
    r.nro_cp_inicial, r.nro_cp_final, r.tipo_doc_identidad, r.nro_doc_identidad,
    r.bi_gravado_dg, r.igv_ipm_dg, r.total_cp, r.moneda,
    r.tiene_detraccion?'Sí':'No', r.monto_detraccion||0, r.deducible_renta?'Sí':'No',
    r.estado, r.tipo_nota,
  ]);
  return { cab, filas };
}

function _histContabVentas(data) {
  const cab = [
    'Ruc','Razon Social','Periodo','CAR SUNAT','Fecha de emisión','Fecha Vcto/Pago',
    'Tipo CP/Doc.','Serie del CDP','Nro CP Nro Inicial (Rango)','Nro Final (Rango)',
    'Tipo Doc Identidad','Nro Doc Identidad','BI Gravada','IGV / IPM','Total CP',
    'Moneda','Tipo de Nota','Estado',
  ];
  const filas = data.map(r => [
    r.ruc, r.razon_social||r.cliente, r.periodo, r.car_sunat, r.fecha_emision, r.fecha_vcto_pago,
    r.tipo_cp_doc, r.serie_cdp, r.nro_cp_inicial, r.nro_cp_final,
    r.tipo_doc_identidad, r.nro_doc_identidad, r.bi_gravada, r.igv_ipm, r.total_cp,
    r.moneda, r.tipo_nota, r.estado,
  ]);
  return { cab, filas };
}

function _histTributariaCompras(data) {
  const cab = ['Periodo','F. Emisión','F. Vencimiento','Tipo Doc','Serie','Número','RUC Proveedor',
    'Proveedor','Base Imponible','IGV','Total','Tiene Detracción','Monto Detracción','Deducible Renta','Estado'];
  const filas = data.map(c => [
    c.periodo, c.fecha_emision, c.fecha_vencimiento||'', c.tipo_documento_codigo||'', c.serie||'', c.numero||'',
    c.ruc_proveedor||'', c.nombre_proveedor||'', c.base_imponible||0, c.igv||0, c.total||0,
    c.tiene_detraccion?'Sí':'No', c.monto_detraccion||0, c.deducible_renta?'Sí':'No', c.estado,
  ]);
  return { cab, filas };
}

function _histTributariaVentas(data) {
  const cab = ['Periodo','F. Emisión','Tipo Doc','Serie','Número','RUC Cliente','Cliente','Base Imponible','IGV','Total','Moneda','Estado'];
  const filas = data.map(v => [
    v.periodo, v.fecha_emision, v.tipo_documento_codigo||'', v.serie||'', v.numero||'',
    v.ruc_cliente||'', v.nombre_cliente||'', v.base_imponible||0, v.igv||0, v.total||0, v.moneda, v.estado,
  ]);
  return { cab, filas };
}

function _histRHRecibidos(data, links) {
  const cab = ['Fecha','N° RH','DNI','Emisor','Concepto','Moneda','Renta Bruta','Retención','Renta Neta','Estado','Monto Pagado','Observaciones'];
  const filas = data.map(r => {
    const rhLinks     = links.filter(l => l.rh_id === r.id);
    const confirmados = rhLinks.filter(l => l.confirmado_en);
    const montoPagado = confirmados.reduce((s,l)=>s+parseFloat(l.monto_parcial??l.movimientos?.importe??0),0);
    const montoRH     = parseFloat(r.monto_bruto||0);
    let estado = 'PENDIENTE';
    if (r.estado === 'ANULADO') estado = 'CANCELADO';
    else if (confirmados.length && Math.abs(montoPagado - montoRH) < 0.01) estado = 'APLICADO';
    else if (confirmados.length && montoPagado > 0) estado = 'PARCIAL';
    else if (rhLinks.some(l => !l.confirmado_en)) estado = 'POSIBLE MATCH';
    return [
      r.fecha_emision, r.numero_rh||'', r.prestadores_servicios?.dni||r.nro_doc_emisor||'',
      r.prestadores_servicios?.nombre||r.nombre_emisor||'', r.concepto||'', r.moneda||'PEN',
      r.monto_bruto, r.monto_retencion, r.monto_neto, estado, montoPagado||'', r.observaciones||'',
    ];
  });
  return { cab, filas };
}

function _histRHEmitido(data) {
  const cab = ['Fecha de Emisión','Tipo Doc. Emitido','Nro. Doc. Emitido','Estado Doc. Emitido',
    'Tipo de Doc. Emisor','Nro. Doc. Emisor','Apellidos y Nombres / Razón Social del Emisor',
    'Tipo de Renta','Gratuito','Descripción','Observación','Moneda de Operación',
    'Renta Bruta','Impuesto a la Renta','Renta Neta','Monto Neto Pendiente de Pago'];
  const filas = data.map(r => [
    r.fecha_emision, r.tipo_doc_emitido, r.nro_doc_emitido,
    r.estado_doc_emitido, r.tipo_doc_emisor, r.nro_doc_emisor,
    r.apellidos_nombres_razon_social, r.tipo_renta,
    r.gratuito, r.descripcion, r.observacion, r.moneda_operacion,
    r.renta_bruta, r.impuesto_renta, r.renta_neta, r.monto_neto_pendiente_pago,
  ]);
  return { cab, filas };
}

function _histVinculos(links) {
  const cab = ['N° RH','Emisor RH','Monto RH (S/)','Fecha Movimiento','N° Operación Mov.','Monto Pagado (S/)','Nivel Confianza','Es Parcial','Confirmado','Fecha Confirmación'];
  const filas = links.map(l => [
    l.rh_registros?.numero_rh||'', l.rh_registros?.nombre_emisor||'', l.rh_registros?.monto_bruto||0,
    l.movimientos?.fecha||'', l.movimientos?.numero_operacion||'', l.monto_parcial ?? l.movimientos?.importe ?? 0,
    l.nivel_confianza||'', l.es_parcial?'Sí':'No', l.confirmado_en?'Sí':'No',
    l.confirmado_en ? l.confirmado_en.slice(0,10) : '',
  ]);
  return { cab, filas };
}

function _histConciliaciones(data) {
  const cab = ['Fecha Conciliación','Tipo Documento','Estado','Tipo Match','Fecha Mov.','Descripción Mov.','Importe Mov.','Moneda','Naturaleza','N° Operación'];
  const filas = data.map(c => [
    c.fecha_conciliacion?.slice(0,10)||'', c.doc_tipo||'', c.estado||'', c.tipo_match||'',
    c.movimientos?.fecha||'', c.movimientos?.descripcion||'', c.movimientos?.importe||'',
    c.movimientos?.moneda||'', c.movimientos?.naturaleza||'', c.movimientos?.numero_operacion||'',
  ]);
  return { cab, filas };
}

function _histPlanillaPeriodos(data) {
  const cab = ['Año','Mes','Tipo','Estado','Total Neto'];
  const filas = data.map(p => [p.anio, p.mes, p.tipo||'', p.estado||'', p.total_neto||0]);
  return { cab, filas };
}

function _histPlanillaDetalle(data) {
  const cab = ['Año','Mes','Tipo','DNI','Trabajador','Días Trabajados','Sueldo Base','Rem. Bruta',
    'Desc. AFP','Desc. ONP','Desc. Renta 5ta','Otros Desc.','Rem. Neta','Aporte EsSalud','Pagado','Fecha Pago'];
  const filas = data.map(d => [
    d.planilla_periodos?.anio||'', d.planilla_periodos?.mes||'', d.planilla_periodos?.tipo||'',
    d.trabajadores?.dni||'', [d.trabajadores?.apellido_paterno,d.trabajadores?.apellido_materno,d.trabajadores?.nombre].filter(Boolean).join(' '),
    d.dias_trabajados, d.sueldo_base, d.remuneracion_bruta, d.descuento_afp, d.descuento_onp,
    d.descuento_renta5ta, d.otros_descuentos, d.remuneracion_neta, d.aporte_essalud,
    d.pagado?'Sí':'No', d.fecha_pago||'',
  ]);
  return { cab, filas };
}

function _histAsientos(data) {
  const cab = ['Periodo','Fecha','N° Asiento','Tipo','Glosa','Total Debe','Total Haber','Diferencia','Estado'];
  const filas = data.map(a => [
    a.periodo, a.fecha, a.numero_asiento||'', a.tipo||'', a.glosa||'',
    a.total_debe||0, a.total_haber||0, parseFloat(a.total_debe||0)-parseFloat(a.total_haber||0), a.estado,
  ]);
  return { cab, filas };
}

function _histNotasAlertas(alertas, notas) {
  const cab = ['Tipo','Categoría','Prioridad','Título','Descripción','Monto','Fecha Vencimiento','Estado','Fecha Creación'];
  const filas = [
    ...alertas.map(a => ['ALERTA', a.tipo, a.prioridad, a.titulo, a.descripcion||'', a.monto||'', a.fecha_vencimiento||'', a.estado, a.created_at?.slice(0,10)||'']),
    ...notas.map(n => ['NOTA', n.tipo, n.prioridad, n.titulo, n.descripcion||'', n.monto_referencia||'', n.fecha_vencimiento||'', n.estado, n.created_at?.slice(0,10)||'']),
  ];
  return { cab, filas };
}

function _histPlanillaMovResumen(data) {
  const cab = ['N° Planilla','Mes','F. Emisión','Trabajador','DNI','Total S/','Estado','Firma','N° Filas'];
  const filas = data.map(p => [
    p.numero_planilla, p.mes, p.fecha_emision||'', p.trabajador_nombre, p.trabajador_dni,
    Number(p.total_gastos||0), p.estado, p.firma_trabajador?'Sí':'No', (p.planilla_movilidad_detalles||[]).length,
  ]);
  return { cab, filas };
}

function _histPlanillaMovDetalle(data) {
  const cab = ['N° Planilla','Trabajador','DNI','Mes','Fecha','Motivo','Desde','Hasta','Proyecto','Empresa Cliente','Monto S/'];
  const filas = [];
  data.forEach(p => (p.planilla_movilidad_detalles||[]).forEach(d => filas.push([
    p.numero_planilla, p.trabajador_nombre, p.trabajador_dni, p.mes, d.fecha, d.motivo||'',
    d.origen||'', d.destino||'', d.proyecto||'', d.empresa_cliente||'', Number(d.monto||0),
  ])));
  return { cab, filas };
}

function _aHoja(nombre, { cab, filas }) {
  return { nombre, datos: [cab, ...filas], esAOA: true };
}

async function generarHistorico(empresaId, periodo, empNombre) {
  if (!empresaId || !periodo) { mostrarToast('Selecciona empresa y período', 'atencion'); return; }
  mostrarToast('Generando histórico completo… puede tardar unos segundos', 'info');

  const { desde, hasta } = _histRangoMes(periodo);
  const periodoCompacto = periodo.replace('-', ''); // contabilidad_compras/ventas usan periodo "YYYYMM"

  const [
    resMbd, resMov, resContCompras, resContVentas, resRegCompras, resRegVentas,
    resRH, resRHEmitido, resLinks, resConcil, resPlaPeriodos, resPlaDetalle,
    resPM, resAsientos, resNotas, resAlertas,
  ] = await Promise.all([
    _supabase.from('tesoreria_mbd').select('*').eq('empresa_id', empresaId).gte('fecha_deposito', desde).lte('fecha_deposito', hasta),
    _supabase.from('movimientos').select('*, cuentas_bancarias(nombre_alias)').eq('empresa_operadora_id', empresaId).eq('periodo', periodo),
    _supabase.from('contabilidad_compras').select('*').eq('empresa_id', empresaId).eq('periodo', periodoCompacto),
    _supabase.from('contabilidad_ventas').select('*').eq('empresa_id', empresaId).eq('periodo', periodoCompacto),
    _supabase.from('registro_compras').select('*').eq('empresa_operadora_id', empresaId).eq('periodo', periodo),
    _supabase.from('registro_ventas').select('*').eq('empresa_operadora_id', empresaId).eq('periodo', periodo),
    _supabase.from('rh_registros').select('*, prestadores_servicios(nombre,dni)').eq('empresa_operadora_id', empresaId).gte('fecha_emision', desde).lte('fecha_emision', hasta),
    _supabase.from('planilla_rh').select('*').eq('empresa_id', empresaId).gte('fecha_emision', desde).lte('fecha_emision', hasta),
    _supabase.from('rh_movimiento_links').select('*, rh_registros(numero_rh,nombre_emisor,monto_bruto), movimientos(fecha,importe,numero_operacion)').eq('empresa_id', empresaId),
    _supabase.from('conciliaciones').select('*, movimientos(fecha,descripcion,importe,moneda,naturaleza,numero_operacion)').eq('empresa_operadora_id', empresaId).gte('fecha_conciliacion', desde).lte('fecha_conciliacion', hasta + 'T23:59:59'),
    _supabase.from('planilla_periodos').select('*').eq('empresa_operadora_id', empresaId).eq('anio', Number(periodo.slice(0,4))).eq('mes', Number(periodo.slice(5,7))),
    _supabase.from('planilla_detalle').select('*, planilla_periodos!inner(anio,mes,tipo), trabajadores(nombre,apellido_paterno,apellido_materno,dni)').eq('empresa_operadora_id', empresaId).eq('planilla_periodos.anio', Number(periodo.slice(0,4))).eq('planilla_periodos.mes', Number(periodo.slice(5,7))),
    _supabase.from('planillas_movilidad').select('*, planilla_movilidad_detalles(*)').eq('empresa_operadora_id', empresaId).eq('mes', periodo),
    _supabase.from('asientos').select('*').eq('empresa_operadora_id', empresaId).eq('periodo', periodo),
    _supabase.from('notas_operativas').select('*').eq('empresa_id', empresaId).gte('created_at', desde).lte('created_at', hasta + 'T23:59:59'),
    _supabase.from('alertas_sistema').select('*').eq('empresa_id', empresaId).gte('created_at', desde).lte('created_at', hasta + 'T23:59:59'),
  ]);

  const rhData    = resRH.data    || [];
  const movData   = resMov.data   || [];
  const linksData = resLinks.data || [];
  const rhIds     = new Set(rhData.map(r => r.id));
  const movIds    = new Set(movData.map(m => m.id));
  const linksPeriodo = linksData.filter(l => rhIds.has(l.rh_id) || movIds.has(l.movimiento_id));

  const conteos = {
    tesoreria_mbd:            (resMbd.data||[]).length,
    movimientos:              movData.length,
    contabilidad_compras:     (resContCompras.data||[]).length,
    contabilidad_ventas:      (resContVentas.data||[]).length,
    registro_compras:         (resRegCompras.data||[]).length,
    registro_ventas:          (resRegVentas.data||[]).length,
    rh_registros:             rhData.length,
    planilla_rh:              (resRHEmitido.data||[]).length,
    rh_movimiento_links:      linksPeriodo.length,
    conciliaciones:           (resConcil.data||[]).length,
    planilla_periodos:        (resPlaPeriodos.data||[]).length,
    planilla_detalle:         (resPlaDetalle.data||[]).length,
    planillas_movilidad:      (resPM.data||[]).length,
    asientos:                 (resAsientos.data||[]).length,
    notas_operativas:         (resNotas.data||[]).length,
    alertas_sistema:          (resAlertas.data||[]).length,
  };
  const totalRegistros = Object.values(conteos).reduce((s, n) => s + n, 0);
  if (totalRegistros === 0) {
    mostrarToast('No se encontró información para esa empresa/período', 'atencion');
    return;
  }

  const hojas = [
    _aHoja('MBD',                  _histMBD(resMbd.data||[])),
    _aHoja('EECC_MOVIMIENTOS',     _histEECC(movData)),
    _aHoja('CONTABILIDAD_COMPRAS', _histContabCompras(resContCompras.data||[])),
    _aHoja('CONTABILIDAD_VENTAS',  _histContabVentas(resContVentas.data||[])),
    _aHoja('TRIBUTARIA_COMPRAS',   _histTributariaCompras(resRegCompras.data||[])),
    _aHoja('TRIBUTARIA_VENTAS',    _histTributariaVentas(resRegVentas.data||[])),
    _aHoja('RH_RECIBIDOS',         _histRHRecibidos(rhData, linksData)),
    _aHoja('RH_EMITIDOS',          _histRHEmitido(resRHEmitido.data||[])),
    _aHoja('VINCULOS_RH_BANCO',    _histVinculos(linksPeriodo)),
    _aHoja('CONCILIACIONES',       _histConciliaciones(resConcil.data||[])),
    _aHoja('PLANILLA_PERIODOS',    _histPlanillaPeriodos(resPlaPeriodos.data||[])),
    _aHoja('PLANILLA_DETALLE',     _histPlanillaDetalle(resPlaDetalle.data||[])),
    _aHoja('PLANILLA_MOVILIDAD',   _histPlanillaMovResumen(resPM.data||[])),
    _aHoja('PLANILLA_MOVILIDAD_DET', _histPlanillaMovDetalle(resPM.data||[])),
    _aHoja('ASIENTOS',             _histAsientos(resAsientos.data||[])),
    _aHoja('NOTAS_Y_ALERTAS',      _histNotasAlertas(resAlertas.data||[], resNotas.data||[])),
  ];

  const nombreArchivo = `NEXUM_HISTORICO_${(empNombre || '').replace(/\s+/g, '_')}_${periodo}.xlsx`;
  const generadoEn = new Date().toISOString();

  const instrucciones = [
    ['NEXUM — HISTÓRICO / RESPALDO MENSUAL'],
    [''],
    [`Versión de formato: ${NEXUM_HIST_VERSION}`],
    [''],
    ['Este archivo es un respaldo integral y restaurable de la información trabajada'],
    ['en NEXUM para la empresa y período indicados en la hoja METADATOS.'],
    [''],
    ['Cada hoja usa las mismas columnas legibles que el Excel que descargas desde'],
    ['cada módulo — no hay IDs internos ni códigos sin traducir.'],
    [''],
    ['Para volver a ver esta información dentro de NEXUM más adelante (por ejemplo si'],
    ['este período fue limpiado de Supabase), usa Reportes → Importar histórico y'],
    ['selecciona este mismo archivo, sin modificarlo.'],
    [''],
    ['Guarda este archivo en un lugar seguro bajo tu control (PC, disco externo, nube).'],
    ['NEXUM no conserva una copia de este archivo una vez descargado.'],
  ];

  const metadatos = [
    ['Campo', 'Valor'],
    ['Versión', NEXUM_HIST_VERSION],
    ['Empresa ID', empresaId],
    ['Empresa', empNombre || ''],
    ['Período', periodo],
    ['Generado en', generadoEn],
    ['Generado por', (typeof perfil_usuario !== 'undefined' && perfil_usuario?.nombre) || ''],
    ['Total de registros', totalRegistros],
    ['', ''],
    ['Tabla', 'Registros'],
    ...Object.entries(conteos).map(([t, n]) => [t, n]),
  ];

  hojas.unshift({ nombre: 'METADATOS', datos: metadatos, esAOA: true });
  hojas.unshift({ nombre: 'INSTRUCCIONES', datos: instrucciones, esAOA: true });

  _descargarExcelConFormato(hojas, nombreArchivo);

  await _supabase.from('periodos_contables').upsert({
    empresa_id: empresaId,
    periodo,
    historico_generado_en: generadoEn,
    historico_generado_por: (typeof perfil_usuario !== 'undefined') ? perfil_usuario?.id : null,
    historico_archivo_nombre: nombreArchivo,
    historico_version: NEXUM_HIST_VERSION,
    historico_modulos: Object.keys(conteos),
    historico_conteo_registros: conteos,
  }, { onConflict: 'empresa_id,periodo' });

  mostrarToast(`Histórico generado: ${totalRegistros} registros en ${hojas.length} hojas`, 'exito');
}
