/* ============================================================
   NEXUM — Histórico / Respaldo (exportador único de Reportes)

   Genera un Excel integral y restaurable de TODO lo trabajado en
   una empresa entre dos períodos (puede ser un solo mes o varios —
   usa los mismos campos "Período desde/hasta" del resto de
   Reportes). Reemplaza a "Reporte global" y "Cierre mensual": no
   tiene sentido mantener tres exportadores que hacen básicamente
   lo mismo — este es el único, y siempre trae TODO (MBD, EECC,
   Contabilidad, Tributaria, RH recibidos/emitidos, Planilla,
   Movilidad, Asientos, conciliaciones, notas/alertas, y los
   catálogos vigentes de Proyectos/Conceptos/Clientes-Proveedores/
   Autorizaciones/Medios de Pago/Trabajadores) con hoja METADATOS
   para poder restaurarlo más adelante.

   Los estados de Compras/Ventas/RH (APLICADO/PARCIAL/PENDIENTE/
   OBSERVADO/POSIBLE) se calculan con las MISMAS funciones que usan
   los módulos en pantalla (_conCobertura/_conFiltrarPorEmisor de
   consolidacion-estados.js, y _estadoCalculado de con-rh-recibidas.js)
   — no se recalculan aparte, para que nunca queden desactualizados
   respecto a lo que Wendy ve en Contabilidad. Por eso reportes/
   index.html carga esos dos archivos además de los suyos propios.

   Solo lectura sobre las tablas operativas; solo escribe una fila
   de trazabilidad por período (conteos, no datos) en
   periodos_contables — necesaria para, más adelante, poder
   verificar que existe un respaldo válido antes de limpiar un
   período.
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

// ── Lista de períodos "YYYY-MM" entre desde y hasta, ambos incluidos ──
function _histListaPeriodos(desde, hasta) {
  const [y1,m1] = desde.split('-').map(Number);
  const [y2,m2] = hasta.split('-').map(Number);
  const lista = [];
  let y = y1, m = m1;
  while (y < y2 || (y === y2 && m <= m2)) {
    lista.push(`${y}-${String(m).padStart(2,'0')}`);
    m++; if (m > 12) { m = 1; y++; }
  }
  return lista;
}

// ── Etiqueta legible de cobertura bancaria (misma escala que muestran
//    Compras/Ventas en pantalla: PENDIENTE/PARCIAL/EXCEDE/APLICADO/OBSERVADO) ──
function _histEtiquetaCobertura(cov) {
  if (cov.estado === 'PENDIENTE') return 'PENDIENTE';
  if (cov.estado === 'PARCIAL')   return cov.excede ? `EXCEDE (+${cov.excede})` : `PARCIAL (${cov.suma}/${cov.total})`;
  if (cov.estado === 'COMPLETO_EMITIDO')   return 'APLICADO';
  if (cov.estado === 'COMPLETO_OBSERVADO') return 'OBSERVADO';
  return cov.estado || '';
}

// ── Cabeceras (idénticas a las columnas que cada módulo ya usa en su
//    propio exportador) — separadas de las filas para poder concatenar
//    varios períodos en un mismo archivo sin repetir cabecera. ────────
const CAB_MBD = ['N° de operación','Fecha de Deposito','Descripcion','Moneda','Monto',
  'Proveedores / Empresa / Personal','RUC / DNI','COTIZACIÓN','OC','Proyecto',
  'Concepto','Empresa','Entrega de FA / DOC / RRHH','Nª Factura o DOC.','Tipo de DOC','Autorización'];
function _filasMBD(data) {
  return data.map(r => [
    r.nro_operacion_bancaria ? String(r.nro_operacion_bancaria).padStart(8,'0') : '',
    _histFmtFecha(r.fecha_deposito), r.descripcion||'', r.moneda||'S/', r.monto,
    r.proveedor_empresa_personal||'', r.ruc_dni||'', r.cotizacion||'', r.oc||'', r.proyecto||'',
    r.concepto||'', r.empresa||'', r.entrega_doc||'PENDIENTE', r.nro_factura_doc||'', r.tipo_doc||'', r.autorizacion||'',
  ]);
}

const CAB_EECC = ['Período','Fecha','Cuenta','Naturaleza','Importe','Moneda','N° Operación','Descripción',
  'Tipo Operación','Estado','Tiene IGV','Base Imponible','IGV','Tiene Detracción','Monto Detracción','Observaciones'];
function _filasEECC(data, periodo) {
  return data.map(m => [
    periodo, m.fecha, m.cuentas_bancarias?.nombre_alias||'', m.naturaleza, m.importe, m.moneda,
    m.numero_operacion||'', m.descripcion||'', m.tipo_operacion_codigo||'', m.estado,
    m.tiene_igv?'Sí':'No', m.base_imponible||0, m.igv||0,
    m.tiene_detraccion?'Sí':'No', m.monto_detraccion||0, m.observaciones||'',
  ]);
}

const CAB_CONTAB_COMPRAS = ['RUC','Proveedor','Periodo','Fecha de emisión','Tipo CP/Doc.','Serie del CDP',
  'N° Inicial','N° Final','Tipo Doc Identidad','Nro Doc Identidad','BI Gravado DG','IGV / IPM DG','Total CP',
  'Moneda','Estado Conciliación Bancaria','Monto Vinculado','N° Operación / Movs. Vinculados'];
async function _filasContabComprasConEstado(data, empresaId) {
  if (!data.length) return [];
  const numeros = data.map(r => [r.serie_cdp, r.nro_cp_inicial].filter(Boolean).join('-')).filter(Boolean);
  const { data: mbd } = numeros.length
    ? await _supabase.from('tesoreria_mbd').select('nro_factura_doc,nro_operacion_bancaria,monto,id,entrega_doc,ruc_dni,proveedor_empresa_personal')
        .eq('empresa_id', empresaId).in('entrega_doc', ['EMITIDO','OBSERVADO']).in('nro_factura_doc', numeros)
    : { data: [] };
  const mapa = new Map();
  (mbd||[]).forEach(r => { if (!mapa.has(r.nro_factura_doc)) mapa.set(r.nro_factura_doc, []); mapa.get(r.nro_factura_doc).push(r); });
  return data.map(r => {
    const nDoc = [r.serie_cdp, r.nro_cp_inicial].filter(Boolean).join('-');
    const movs = _conFiltrarPorEmisor(mapa.get(nDoc), r.nro_doc_identidad, r.proveedor);
    const cov  = _conCobertura(movs, r.total_cp);
    return [
      r.ruc, r.proveedor||r.razon_social, r.periodo, r.fecha_emision, r.tipo_cp_doc, r.serie_cdp,
      r.nro_cp_inicial, r.nro_cp_final, r.tipo_doc_identidad, r.nro_doc_identidad,
      r.bi_gravado_dg, r.igv_ipm_dg, r.total_cp, r.moneda,
      _histEtiquetaCobertura(cov), cov.suma||0, movs.map(m=>m.nro_operacion_bancaria).filter(Boolean).join(', '),
    ];
  });
}

const CAB_CONTAB_VENTAS = ['RUC','Cliente','Periodo','Fecha de emisión','Tipo CP/Doc.','Serie del CDP',
  'N° Inicial','N° Final','Tipo Doc Identidad','Nro Doc Identidad','BI Gravada','IGV / IPM','Total CP',
  'Moneda','Estado Conciliación Bancaria','Monto Vinculado','N° Operación / Movs. Vinculados'];
async function _filasContabVentasConEstado(data, empresaId) {
  if (!data.length) return [];
  const numeros = data.map(r => [r.serie_cdp, r.nro_cp_inicial].filter(Boolean).join('-')).filter(Boolean);
  const { data: mbd } = numeros.length
    ? await _supabase.from('tesoreria_mbd').select('nro_factura_doc,nro_operacion_bancaria,monto,id,entrega_doc,ruc_dni,proveedor_empresa_personal')
        .eq('empresa_id', empresaId).in('entrega_doc', ['EMITIDO','OBSERVADO']).in('nro_factura_doc', numeros)
    : { data: [] };
  const mapa = new Map();
  (mbd||[]).forEach(r => { if (!mapa.has(r.nro_factura_doc)) mapa.set(r.nro_factura_doc, []); mapa.get(r.nro_factura_doc).push(r); });
  return data.map(r => {
    const nDoc = [r.serie_cdp, r.nro_cp_inicial].filter(Boolean).join('-');
    const movs = _conFiltrarPorEmisor(mapa.get(nDoc), r.nro_doc_identidad, r.cliente);
    const cov  = _conCobertura(movs, r.total_cp);
    return [
      r.ruc, r.cliente||r.razon_social, r.periodo, r.fecha_emision, r.tipo_cp_doc, r.serie_cdp,
      r.nro_cp_inicial, r.nro_cp_final, r.tipo_doc_identidad, r.nro_doc_identidad,
      r.bi_gravada, r.igv_ipm, r.total_cp, r.moneda,
      _histEtiquetaCobertura(cov), cov.suma||0, movs.map(m=>m.nro_operacion_bancaria).filter(Boolean).join(', '),
    ];
  });
}

const CAB_TRIB_COMPRAS = ['Periodo','F. Emisión','F. Vencimiento','Tipo Doc','Serie','Número','RUC Proveedor',
  'Proveedor','Base Imponible','IGV','Total','Tiene Detracción','Monto Detracción','Deducible Renta','Estado'];
function _filasTribCompras(data) {
  return data.map(c => [
    c.periodo, c.fecha_emision, c.fecha_vencimiento||'', c.tipo_documento_codigo||'', c.serie||'', c.numero||'',
    c.ruc_proveedor||'', c.nombre_proveedor||'', c.base_imponible||0, c.igv||0, c.total||0,
    c.tiene_detraccion?'Sí':'No', c.monto_detraccion||0, c.deducible_renta?'Sí':'No', c.estado,
  ]);
}

const CAB_TRIB_VENTAS = ['Periodo','F. Emisión','Tipo Doc','Serie','Número','RUC Cliente','Cliente','Base Imponible','IGV','Total','Moneda','Estado'];
function _filasTribVentas(data) {
  return data.map(v => [
    v.periodo, v.fecha_emision, v.tipo_documento_codigo||'', v.serie||'', v.numero||'',
    v.ruc_cliente||'', v.nombre_cliente||'', v.base_imponible||0, v.igv||0, v.total||0, v.moneda, v.estado,
  ]);
}

const CAB_RH_RECIBIDOS = ['Fecha','N° RH','DNI','Emisor','Concepto','Moneda','Renta Bruta','Retención','Renta Neta','Estado','Monto Pagado','Observaciones'];
async function _filasRHRecibidosConEstado(data) {
  const estados = await Promise.all(data.map(r => r.estado === 'ANULADO'
    ? Promise.resolve({ estado: 'CANCELADO', montoPagado: '' })
    : _estadoCalculado(r)));
  return data.map((r, i) => [
    r.fecha_emision, r.numero_rh||'', r.prestadores_servicios?.dni||r.nro_doc_emisor||'',
    r.prestadores_servicios?.nombre||r.nombre_emisor||'', r.concepto||'', r.moneda||'PEN',
    r.monto_bruto, r.monto_retencion, r.monto_neto, estados[i].estado, estados[i].montoPagado||'', r.observaciones||'',
  ]);
}

const CAB_RH_EMITIDOS = ['Fecha de Emisión','Tipo Doc. Emitido','Nro. Doc. Emitido','Estado Doc. Emitido',
  'Tipo de Doc. Emisor','Nro. Doc. Emisor','Apellidos y Nombres / Razón Social del Emisor',
  'Tipo de Renta','Gratuito','Descripción','Observación','Moneda de Operación',
  'Renta Bruta','Impuesto a la Renta','Renta Neta','Monto Neto Pendiente de Pago'];
function _filasRHEmitidos(data) {
  return data.map(r => [
    r.fecha_emision, r.tipo_doc_emitido, r.nro_doc_emitido,
    r.estado_doc_emitido, r.tipo_doc_emisor, r.nro_doc_emisor,
    r.apellidos_nombres_razon_social, r.tipo_renta,
    r.gratuito, r.descripcion, r.observacion, r.moneda_operacion,
    r.renta_bruta, r.impuesto_renta, r.renta_neta, r.monto_neto_pendiente_pago,
  ]);
}

const CAB_VINCULOS = ['N° RH','Emisor RH','Monto RH (S/)','Fecha Movimiento','N° Operación Mov.','Monto Pagado (S/)','Nivel Confianza','Es Parcial','Confirmado','Fecha Confirmación'];
function _filasVinculos(links) {
  return links.map(l => [
    l.rh_registros?.numero_rh||'', l.rh_registros?.nombre_emisor||'', l.rh_registros?.monto_bruto||0,
    l.movimientos?.fecha||'', l.movimientos?.numero_operacion||'', l.monto_parcial ?? l.movimientos?.importe ?? 0,
    l.nivel_confianza||'', l.es_parcial?'Sí':'No', l.confirmado_en?'Sí':'No',
    l.confirmado_en ? l.confirmado_en.slice(0,10) : '',
  ]);
}

const CAB_CONCILIACIONES = ['Fecha Conciliación','Tipo Documento','Estado','Tipo Match','Fecha Mov.','Descripción Mov.','Importe Mov.','Moneda','Naturaleza','N° Operación'];
function _filasConciliaciones(data) {
  return data.map(c => [
    c.fecha_conciliacion?.slice(0,10)||'', c.doc_tipo||'', c.estado||'', c.tipo_match||'',
    c.movimientos?.fecha||'', c.movimientos?.descripcion||'', c.movimientos?.importe||'',
    c.movimientos?.moneda||'', c.movimientos?.naturaleza||'', c.movimientos?.numero_operacion||'',
  ]);
}

const CAB_PLA_PERIODOS = ['Año','Mes','Tipo','Estado','Total Neto'];
function _filasPlaPeriodos(data) { return data.map(p => [p.anio, p.mes, p.tipo||'', p.estado||'', p.total_neto||0]); }

const CAB_PLA_DETALLE = ['Año','Mes','Tipo','DNI','Trabajador','Días Trabajados','Sueldo Base','Rem. Bruta',
  'Desc. AFP','Desc. ONP','Desc. Renta 5ta','Otros Desc.','Rem. Neta','Aporte EsSalud','Pagado','Fecha Pago'];
function _filasPlaDetalle(data) {
  return data.map(d => [
    d.planilla_periodos?.anio||'', d.planilla_periodos?.mes||'', d.planilla_periodos?.tipo||'',
    d.trabajadores?.dni||'', [d.trabajadores?.apellido_paterno,d.trabajadores?.apellido_materno,d.trabajadores?.nombre].filter(Boolean).join(' '),
    d.dias_trabajados, d.sueldo_base, d.remuneracion_bruta, d.descuento_afp, d.descuento_onp,
    d.descuento_renta5ta, d.otros_descuentos, d.remuneracion_neta, d.aporte_essalud,
    d.pagado?'Sí':'No', d.fecha_pago||'',
  ]);
}

const CAB_ASIENTOS = ['Periodo','Fecha','N° Asiento','Tipo','Glosa','Total Debe','Total Haber','Diferencia','Estado'];
function _filasAsientos(data) {
  return data.map(a => [a.periodo, a.fecha, a.numero_asiento||'', a.tipo||'', a.glosa||'',
    a.total_debe||0, a.total_haber||0, parseFloat(a.total_debe||0)-parseFloat(a.total_haber||0), a.estado]);
}

const CAB_NOTAS_ALERTAS = ['Tipo','Categoría','Prioridad','Título','Descripción','Monto','Fecha Vencimiento','Estado','Fecha Creación'];
function _filasNotasAlertas(alertas, notas) {
  return [
    ...alertas.map(a => ['ALERTA', a.tipo, a.prioridad, a.titulo, a.descripcion||'', a.monto||'', a.fecha_vencimiento||'', a.estado, a.created_at?.slice(0,10)||'']),
    ...notas.map(n => ['NOTA', n.tipo, n.prioridad, n.titulo, n.descripcion||'', n.monto_referencia||'', n.fecha_vencimiento||'', n.estado, n.created_at?.slice(0,10)||'']),
  ];
}

const CAB_PMOV_RES = ['N° Planilla','Mes','F. Emisión','Trabajador','DNI','Total S/','Estado','Firma','N° Filas'];
function _filasPMovResumen(data) {
  return data.map(p => [p.numero_planilla, p.mes, p.fecha_emision||'', p.trabajador_nombre, p.trabajador_dni,
    Number(p.total_gastos||0), p.estado, p.firma_trabajador?'Sí':'No', (p.planilla_movilidad_detalles||[]).length]);
}
const CAB_PMOV_DET = ['N° Planilla','Trabajador','DNI','Mes','Fecha','Motivo','Desde','Hasta','Proyecto','Empresa Cliente','Monto S/'];
function _filasPMovDetalle(data) {
  const filas = [];
  data.forEach(p => (p.planilla_movilidad_detalles||[]).forEach(d => filas.push([
    p.numero_planilla, p.trabajador_nombre, p.trabajador_dni, p.mes, d.fecha, d.motivo||'',
    d.origen||'', d.destino||'', d.proyecto||'', d.empresa_cliente||'', Number(d.monto||0),
  ])));
  return filas;
}

// ── Trae y arma todas las filas de UN período. No genera el archivo —
//    solo devuelve los datos, para poder acumular varios períodos. ────
async function _histDatosPeriodo(empresaId, periodo) {
  const { desde, hasta } = _histRangoMes(periodo);
  const periodoCompacto = periodo.replace('-', ''); // contabilidad_compras/ventas usan "YYYYMM"

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

  // Estos 3 usan la MISMA lógica que Contabilidad → Compras/Ventas/RH en pantalla
  const [filasContabCompras, filasContabVentas, filasRH] = await Promise.all([
    _filasContabComprasConEstado(resContCompras.data||[], empresaId),
    _filasContabVentasConEstado(resContVentas.data||[], empresaId),
    _filasRHRecibidosConEstado(rhData),
  ]);

  const conteos = {
    tesoreria_mbd: (resMbd.data||[]).length, movimientos: movData.length,
    contabilidad_compras: (resContCompras.data||[]).length, contabilidad_ventas: (resContVentas.data||[]).length,
    registro_compras: (resRegCompras.data||[]).length, registro_ventas: (resRegVentas.data||[]).length,
    rh_registros: rhData.length, planilla_rh: (resRHEmitido.data||[]).length,
    rh_movimiento_links: linksPeriodo.length, conciliaciones: (resConcil.data||[]).length,
    planilla_periodos: (resPlaPeriodos.data||[]).length, planilla_detalle: (resPlaDetalle.data||[]).length,
    planillas_movilidad: (resPM.data||[]).length, asientos: (resAsientos.data||[]).length,
    notas_operativas: (resNotas.data||[]).length, alertas_sistema: (resAlertas.data||[]).length,
  };

  return {
    periodo, conteos,
    filas: {
      MBD: _filasMBD(resMbd.data||[]),
      EECC_MOVIMIENTOS: _filasEECC(movData, periodo),
      CONTABILIDAD_COMPRAS: filasContabCompras,
      CONTABILIDAD_VENTAS: filasContabVentas,
      TRIBUTARIA_COMPRAS: _filasTribCompras(resRegCompras.data||[]),
      TRIBUTARIA_VENTAS: _filasTribVentas(resRegVentas.data||[]),
      RH_RECIBIDOS: filasRH,
      RH_EMITIDOS: _filasRHEmitidos(resRHEmitido.data||[]),
      VINCULOS_RH_BANCO: _filasVinculos(linksPeriodo),
      CONCILIACIONES: _filasConciliaciones(resConcil.data||[]),
      PLANILLA_PERIODOS: _filasPlaPeriodos(resPlaPeriodos.data||[]),
      PLANILLA_DETALLE: _filasPlaDetalle(resPlaDetalle.data||[]),
      PLANILLA_MOVILIDAD: _filasPMovResumen(resPM.data||[]),
      PLANILLA_MOVILIDAD_DET: _filasPMovDetalle(resPM.data||[]),
      ASIENTOS: _filasAsientos(resAsientos.data||[]),
      NOTAS_Y_ALERTAS: _filasNotasAlertas(resAlertas.data||[], resNotas.data||[]),
    },
  };
}

const _HIST_CABS = {
  MBD: CAB_MBD, EECC_MOVIMIENTOS: CAB_EECC, CONTABILIDAD_COMPRAS: CAB_CONTAB_COMPRAS,
  CONTABILIDAD_VENTAS: CAB_CONTAB_VENTAS, TRIBUTARIA_COMPRAS: CAB_TRIB_COMPRAS, TRIBUTARIA_VENTAS: CAB_TRIB_VENTAS,
  RH_RECIBIDOS: CAB_RH_RECIBIDOS, RH_EMITIDOS: CAB_RH_EMITIDOS, VINCULOS_RH_BANCO: CAB_VINCULOS,
  CONCILIACIONES: CAB_CONCILIACIONES, PLANILLA_PERIODOS: CAB_PLA_PERIODOS, PLANILLA_DETALLE: CAB_PLA_DETALLE,
  PLANILLA_MOVILIDAD: CAB_PMOV_RES, PLANILLA_MOVILIDAD_DET: CAB_PMOV_DET, ASIENTOS: CAB_ASIENTOS,
  NOTAS_Y_ALERTAS: CAB_NOTAS_ALERTAS,
};

// ── Catálogos (módulo Catálogos): no son datos de un período — son la
//    configuración vigente de la empresa (proyectos, conceptos, clientes/
//    proveedores, autorizaciones, medios de pago, trabajadores). El Word
//    los pide explícitamente ("proyectos; conceptos; ... cualquier otro
//    dato necesario para conservar el trabajo realizado"), así que se
//    incluyen como snapshot completo — se traen UNA sola vez por
//    generación (no por período) y no se limpian nunca desde Reportes. ──
const CAB_PROYECTOS = ['Nombre','Cliente','Descripción','Activo','Fecha Creación'];
const CAB_CONCEPTOS = ['Nombre','Tipo','Activo','Fecha Creación'];
const CAB_CLIENTES  = ['Nombre','RUC/DNI','Tipo','Dirección','Teléfono','Email','Activo','Fecha Creación'];
const CAB_AUTORIZACIONES = ['Nombre','Cargo','Activo','Fecha Creación'];
const CAB_MEDIOS_PAGO = ['Nombre','Banco','N° Cuenta','CCI','Tipo','Moneda','Activo','Fecha Creación'];
const CAB_TRABAJADORES = ['DNI','Nombre','Apellido Paterno','Apellido Materno','Cargo','Área','Fecha Ingreso',
  'Sueldo Base','Tipo Contrato','Banco','N° Cuenta','CCI','AFP/ONP','CUSPP','Activo'];
const CAB_CONCEPTOS_RECURRENTES = ['Nombre','Activo','Fecha Creación'];

async function _histCatalogos(empresaId) {
  const [resProy, resConc, resCli, resAut, resMp, resTrab, resConcRec] = await Promise.all([
    _supabase.from('proyectos').select('*, empresas_clientes(nombre)').eq('empresa_operadora_id', empresaId).order('nombre'),
    _supabase.from('conceptos').select('*').eq('empresa_operadora_id', empresaId).order('nombre'),
    _supabase.from('empresas_clientes').select('*').eq('empresa_operadora_id', empresaId).order('nombre'),
    _supabase.from('autorizaciones').select('*').eq('empresa_operadora_id', empresaId).order('nombre'),
    _supabase.from('medios_pago').select('*').eq('empresa_operadora_id', empresaId).order('nombre'),
    _supabase.from('trabajadores').select('*').eq('empresa_operadora_id', empresaId).order('apellido_paterno'),
    _supabase.from('conceptos_recurrentes_bancarios').select('*').eq('empresa_operadora_id', empresaId).order('nombre'),
  ]);
  return {
    conteos: {
      proyectos: (resProy.data||[]).length, conceptos: (resConc.data||[]).length,
      empresas_clientes: (resCli.data||[]).length, autorizaciones: (resAut.data||[]).length,
      medios_pago: (resMp.data||[]).length, trabajadores: (resTrab.data||[]).length,
      conceptos_recurrentes_bancarios: (resConcRec.data||[]).length,
    },
    hojas: [
      { nombre: 'PROYECTOS', datos: [CAB_PROYECTOS, ...(resProy.data||[]).map(p => [
        p.nombre, p.empresas_clientes?.nombre||'', p.descripcion||'', p.activo?'Sí':'No', p.fecha_creacion,
      ])], esAOA: true },
      { nombre: 'CONCEPTOS', datos: [CAB_CONCEPTOS, ...(resConc.data||[]).map(c => [
        c.nombre, c.tipo||'', c.activo?'Sí':'No', c.fecha_creacion,
      ])], esAOA: true },
      { nombre: 'CLIENTES_PROVEEDORES', datos: [CAB_CLIENTES, ...(resCli.data||[]).map(c => [
        c.nombre, c.ruc_dni||'', c.tipo||'', c.direccion||'', c.telefono||'', c.email||'', c.activo?'Sí':'No', c.fecha_creacion,
      ])], esAOA: true },
      { nombre: 'AUTORIZACIONES', datos: [CAB_AUTORIZACIONES, ...(resAut.data||[]).map(a => [
        a.nombre, a.cargo||'', a.activo?'Sí':'No', a.fecha_creacion,
      ])], esAOA: true },
      { nombre: 'MEDIOS_PAGO', datos: [CAB_MEDIOS_PAGO, ...(resMp.data||[]).map(m => [
        m.nombre, m.banco_codigo||'', m.numero_cuenta||'', m.cci||'', m.tipo||'', m.moneda||'', m.activo?'Sí':'No', m.fecha_creacion,
      ])], esAOA: true },
      { nombre: 'TRABAJADORES', datos: [CAB_TRABAJADORES, ...(resTrab.data||[]).map(t => [
        t.dni, t.nombre, t.apellido_paterno||'', t.apellido_materno||'', t.cargo||'', t.area||'', t.fecha_ingreso||'',
        t.sueldo_base||0, t.tipo_contrato||'', t.banco_codigo||'', t.numero_cuenta||'', t.cci||'', t.afp||'', t.cuspp||'', t.activo?'Sí':'No',
      ])], esAOA: true },
      { nombre: 'CONCEPTOS_RECURRENTES_BCO', datos: [CAB_CONCEPTOS_RECURRENTES, ...(resConcRec.data||[]).map(c => [
        c.nombre, c.activo?'Sí':'No', c.fecha_creacion,
      ])], esAOA: true },
    ],
  };
}

async function generarHistorico(empresaId, desde, hasta, empNombre) {
  if (!empresaId || !desde || !hasta) { mostrarToast('Selecciona empresa y período (desde/hasta)', 'atencion'); return; }
  const periodos = _histListaPeriodos(desde, hasta);
  if (!periodos.length) { mostrarToast('Rango de período inválido', 'atencion'); return; }
  mostrarToast(`Generando histórico completo de ${periodos.length} período(s)… puede tardar unos segundos`, 'info');

  const resultados = [];
  for (const p of periodos) resultados.push(await _histDatosPeriodo(empresaId, p));
  const catalogos = await _histCatalogos(empresaId);

  const sheetKeys = Object.keys(_HIST_CABS);
  const conteosTotal = {};
  const hojas = sheetKeys.map(key => {
    const filas = resultados.flatMap(r => r.filas[key] || []);
    return { nombre: key, datos: [_HIST_CABS[key], ...filas], esAOA: true };
  });
  hojas.push(...catalogos.hojas);
  resultados.forEach(r => Object.entries(r.conteos).forEach(([t,n]) => { conteosTotal[t] = (conteosTotal[t]||0) + n; }));
  Object.entries(catalogos.conteos).forEach(([t,n]) => { conteosTotal[t] = n; });
  const totalRegistros = Object.values(conteosTotal).reduce((s,n)=>s+n, 0);

  if (totalRegistros === 0) {
    mostrarToast('No se encontró información para esa empresa/período', 'atencion');
    return;
  }

  const esUnPeriodo = periodos.length === 1;
  const nombreArchivo = esUnPeriodo
    ? `NEXUM_HISTORICO_${(empNombre||'').replace(/\s+/g,'_')}_${periodos[0]}.xlsx`
    : `NEXUM_HISTORICO_${(empNombre||'').replace(/\s+/g,'_')}_${periodos[0]}_a_${periodos[periodos.length-1]}.xlsx`;
  const generadoEn = new Date().toISOString();

  const instrucciones = [
    ['NEXUM — HISTÓRICO / RESPALDO'],
    [''],
    [`Versión de formato: ${NEXUM_HIST_VERSION}`],
    [''],
    ['Este archivo es un respaldo integral y restaurable de la información trabajada'],
    ['en NEXUM para la empresa y el/los período(s) indicados en la hoja METADATOS.'],
    [''],
    ['Cada hoja usa las mismas columnas legibles que ves en cada módulo — incluyendo'],
    ['el estado real de conciliación bancaria de Compras, Ventas y RH (calculado'],
    ['igual que en pantalla, no un valor guardado aparte).'],
    [''],
    ['Para volver a ver esta información dentro de NEXUM más adelante (por ejemplo si'],
    ['un período fue limpiado de Supabase), usa Reportes → Importar histórico y'],
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
    ['Período(s)', periodos.join(', ')],
    ['Generado en', generadoEn],
    ['Generado por', (typeof perfil_usuario !== 'undefined' && perfil_usuario?.nombre) || ''],
    ['Total de registros', totalRegistros],
    ['', ''],
    ['Tabla', 'Registros'],
    ...Object.entries(conteosTotal).map(([t, n]) => [t, n]),
  ];

  hojas.unshift({ nombre: 'METADATOS', datos: metadatos, esAOA: true });
  hojas.unshift({ nombre: 'INSTRUCCIONES', datos: instrucciones, esAOA: true });

  _descargarExcelConFormato(hojas, nombreArchivo);

  const writes = resultados.map(r => ({
    empresa_id: empresaId, periodo: r.periodo,
    historico_generado_en: generadoEn,
    historico_generado_por: (typeof perfil_usuario !== 'undefined') ? perfil_usuario?.id : null,
    historico_archivo_nombre: nombreArchivo, historico_version: NEXUM_HIST_VERSION,
    historico_modulos: Object.keys(r.conteos), historico_conteo_registros: r.conteos,
  }));
  await _supabase.from('periodos_contables').upsert(writes, { onConflict: 'empresa_id,periodo' });

  mostrarToast(`Histórico generado: ${totalRegistros} registros de ${periodos.length} período(s) en ${hojas.length} hojas`, 'exito');
}
