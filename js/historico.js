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

const NEXUM_HIST_VERSION = 'NEXUM-HIST-1.1';

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

// ── Detalle legible de los movimientos bancarios vinculados a un
//    comprobante (N° operación + fecha + descripción, no solo el número) —
//    Wendy lo pide explícitamente en el histórico: debe verse igual que al
//    hacer clic en el ícono de vínculo dentro del módulo. ──────────────────
function _histDetalleMovs(movs) {
  if (!movs?.length) return { nOperacion: '', fechaMov: '', descripcionMov: '' };
  return {
    nOperacion: movs.map(m => m.nro_operacion_bancaria).filter(Boolean).join(', '),
    fechaMov: movs.map(m => _histFmtFecha(m.fecha_deposito)).filter(Boolean).join(', '),
    descripcionMov: movs.map(m => m.descripcion).filter(Boolean).join(' | '),
  };
}

const CAB_CONTAB_COMPRAS = ['RUC','Proveedor','Periodo','Fecha de emisión','Tipo CP/Doc.','Serie del CDP',
  'N° Inicial','N° Final','Tipo Doc Identidad','Nro Doc Identidad','BI Gravado DG','IGV / IPM DG','Total CP',
  'Moneda','Estado Conciliación Bancaria','Monto Vinculado','N° Operación Vinculado(s)','Fecha Movimiento','Descripción Movimiento'];
async function _filasContabComprasConEstado(data, empresaId) {
  if (!data.length) return [];
  const numeros = data.map(r => [r.serie_cdp, r.nro_cp_inicial].filter(Boolean).join('-')).filter(Boolean);
  const { data: mbd } = numeros.length
    ? await _supabase.from('tesoreria_mbd').select('nro_factura_doc,nro_operacion_bancaria,fecha_deposito,descripcion,monto,id,entrega_doc,ruc_dni,proveedor_empresa_personal')
        .eq('empresa_id', empresaId).in('entrega_doc', ['EMITIDO','OBSERVADO']).in('nro_factura_doc', numeros)
    : { data: [] };
  const mapa = new Map();
  (mbd||[]).forEach(r => { if (!mapa.has(r.nro_factura_doc)) mapa.set(r.nro_factura_doc, []); mapa.get(r.nro_factura_doc).push(r); });
  return data.map(r => {
    const nDoc = [r.serie_cdp, r.nro_cp_inicial].filter(Boolean).join('-');
    const movs = _conFiltrarPorEmisor(mapa.get(nDoc), r.nro_doc_identidad, r.proveedor);
    const cov  = _conCobertura(movs, r.total_cp);
    const vinc = _histDetalleMovs(movs);
    return [
      r.ruc, r.proveedor||r.razon_social, r.periodo, r.fecha_emision, r.tipo_cp_doc, r.serie_cdp,
      r.nro_cp_inicial, r.nro_cp_final, r.tipo_doc_identidad, r.nro_doc_identidad,
      r.bi_gravado_dg, r.igv_ipm_dg, r.total_cp, r.moneda,
      _histEtiquetaCobertura(cov), cov.suma||0, vinc.nOperacion, vinc.fechaMov, vinc.descripcionMov,
    ];
  });
}

const CAB_CONTAB_VENTAS = ['RUC','Cliente','Periodo','Fecha de emisión','Tipo CP/Doc.','Serie del CDP',
  'N° Inicial','N° Final','Tipo Doc Identidad','Nro Doc Identidad','BI Gravada','IGV / IPM','Total CP',
  'Moneda','Estado Conciliación Bancaria','Monto Vinculado','N° Operación Vinculado(s)','Fecha Movimiento','Descripción Movimiento'];
async function _filasContabVentasConEstado(data, empresaId) {
  if (!data.length) return [];
  const numeros = data.map(r => [r.serie_cdp, r.nro_cp_inicial].filter(Boolean).join('-')).filter(Boolean);
  const { data: mbd } = numeros.length
    ? await _supabase.from('tesoreria_mbd').select('nro_factura_doc,nro_operacion_bancaria,fecha_deposito,descripcion,monto,id,entrega_doc,ruc_dni,proveedor_empresa_personal')
        .eq('empresa_id', empresaId).in('entrega_doc', ['EMITIDO','OBSERVADO']).in('nro_factura_doc', numeros)
    : { data: [] };
  const mapa = new Map();
  (mbd||[]).forEach(r => { if (!mapa.has(r.nro_factura_doc)) mapa.set(r.nro_factura_doc, []); mapa.get(r.nro_factura_doc).push(r); });
  return data.map(r => {
    const nDoc = [r.serie_cdp, r.nro_cp_inicial].filter(Boolean).join('-');
    const movs = _conFiltrarPorEmisor(mapa.get(nDoc), r.nro_doc_identidad, r.cliente);
    const cov  = _conCobertura(movs, r.total_cp);
    const vinc = _histDetalleMovs(movs);
    return [
      r.ruc, r.cliente||r.razon_social, r.periodo, r.fecha_emision, r.tipo_cp_doc, r.serie_cdp,
      r.nro_cp_inicial, r.nro_cp_final, r.tipo_doc_identidad, r.nro_doc_identidad,
      r.bi_gravada, r.igv_ipm, r.total_cp, r.moneda,
      _histEtiquetaCobertura(cov), cov.suma||0, vinc.nOperacion, vinc.fechaMov, vinc.descripcionMov,
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

const CAB_RH_RECIBIDOS = ['Fecha','N° RH','DNI','Emisor','Concepto','Moneda','Renta Bruta','Retención','Renta Neta',
  'Estado','N° Operación Vinculado(s)','Fecha Movimiento','Monto Vinculado','Nivel Confianza','Observaciones'];
async function _filasRHRecibidosConEstado(data) {
  const estados = await Promise.all(data.map(r => r.estado === 'ANULADO'
    ? Promise.resolve({ estado: 'CANCELADO', links: [] })
    : _estadoCalculado(r)));
  return data.map((r, i) => {
    const vinc = _rhrDetalleVinculo(estados[i]);
    return [
      r.fecha_emision, r.numero_rh||'', r.prestadores_servicios?.dni||r.nro_doc_emisor||'',
      r.prestadores_servicios?.nombre||r.nombre_emisor||'', r.concepto||'', r.moneda||'PEN',
      r.monto_bruto, r.monto_retencion, r.monto_neto, estados[i].estado,
      vinc.nOperacion, vinc.fechaMov, vinc.montoVinculado||'', vinc.nivelConfianza, r.observaciones||'',
    ];
  });
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

// ── Copia filas quitando las claves de relaciones embebidas (joins) que
//    Supabase agrega al `select('*, tabla(...)')` — no son columnas reales
//    y un insert/upsert directo contra la tabla fallaría con ellas. ──────
function _histCrudo(rows, quitarClaves) {
  return (rows || []).map(r => {
    const c = { ...r };
    (quitarClaves || []).forEach(k => delete c[k]);
    return c;
  });
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

  // ── Filas CRUDAS (columnas reales de cada tabla, sin joins) para poder
  //    RESTAURAR con fidelidad — las hojas "filas" de abajo son para leer,
  //    esta es para importar de vuelta. Se quitan las claves de relaciones
  //    embebidas (join) porque no son columnas reales de la tabla. ────────
  const crudo = {
    tesoreria_mbd: resMbd.data || [],
    movimientos: _histCrudo(movData, ['cuentas_bancarias']),
    contabilidad_compras: resContCompras.data || [],
    contabilidad_ventas: resContVentas.data || [],
    registro_compras: resRegCompras.data || [],
    registro_ventas: resRegVentas.data || [],
    rh_registros: _histCrudo(rhData, ['prestadores_servicios']),
    planilla_rh: resRHEmitido.data || [],
    rh_movimiento_links: _histCrudo(linksPeriodo, ['rh_registros', 'movimientos']),
    conciliaciones: _histCrudo(resConcil.data, ['movimientos']),
    planilla_periodos: resPlaPeriodos.data || [],
    planilla_detalle: _histCrudo(resPlaDetalle.data, ['planilla_periodos', 'trabajadores']),
    planillas_movilidad: _histCrudo(resPM.data, ['planilla_movilidad_detalles']),
    planilla_movilidad_detalles: (resPM.data || []).flatMap(p => p.planilla_movilidad_detalles || []),
    asientos: resAsientos.data || [],
    notas_operativas: resNotas.data || [],
    alertas_sistema: resAlertas.data || [],
  };

  return {
    periodo, conteos, crudo,
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

  // ── Hoja RAW_DATA: filas crudas (columnas reales, sin formatear) de cada
  //    tabla operativa — es lo que usa "Importar histórico" para restaurar
  //    con fidelidad. Las hojas de arriba son para leer, esta es para volver
  //    a cargar. No se genera para catálogos (Limpiar información nunca los
  //    borra, así que no hace falta poder restaurarlos). ───────────────────
  const crudoTotal = {};
  resultados.forEach(r => Object.entries(r.crudo).forEach(([tabla, filasT]) => {
    if (!crudoTotal[tabla]) crudoTotal[tabla] = [];
    crudoTotal[tabla].push(...filasT);
  }));
  const filasRaw = [];
  Object.entries(crudoTotal).forEach(([tabla, filasT]) => {
    filasT.forEach(r => filasRaw.push([tabla, r.id || '', JSON.stringify(r)]));
  });
  hojas.push({ nombre: 'RAW_DATA', datos: [['Tabla', 'ID', 'JSON'], ...filasRaw], esAOA: true });

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

/* ============================================================
   IMPORTAR HISTÓRICO (RESTAURAR)

   Solo AGREGA registros que no existen (por id). Nunca sobrescribe
   ni borra nada — si un registro del archivo ya existe en NEXUM con
   otros valores, se reporta como diferencia para que Wendy decida,
   pero no se toca (ver regla de no modificar datos existentes sin
   aprobación explícita). Requiere la hoja RAW_DATA (histórico
   generado con NEXUM-HIST-1.1 o superior).
   ============================================================ */

async function importarHistoricoClick() {
  document.getElementById('hist-import-file')?.click();
}

async function _histImportarArchivo(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';

  let wb;
  try {
    wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  } catch (e) {
    mostrarToast('No se pudo leer el archivo. ¿Es un Excel válido?', 'error');
    return;
  }

  const wsMeta = wb.Sheets['METADATOS'];
  const wsRaw  = wb.Sheets['RAW_DATA'];
  if (!wsMeta || !wsRaw) {
    mostrarToast('Este archivo no tiene el formato de histórico de NEXUM (faltan hojas METADATOS/RAW_DATA). Los históricos generados antes de esta actualización no se pueden restaurar automáticamente — solo sirven como respaldo de lectura.', 'atencion');
    return;
  }

  const meta = {};
  XLSX.utils.sheet_to_json(wsMeta, { header: 1 }).forEach(r => { if (r[0]) meta[r[0]] = r[1]; });

  if (String(meta['Empresa ID'] || '') !== empresa_activa.id) {
    mostrarToast('Este histórico pertenece a otra empresa. Cambia a la empresa correcta (menú superior) antes de importar.', 'atencion');
    return;
  }

  const version = meta['Versión'] || '';
  if (version !== NEXUM_HIST_VERSION) {
    const continuar = await confirmar(
      `Este archivo fue generado con la versión ${escapar(version || 'desconocida')} y NEXUM espera ${NEXUM_HIST_VERSION}. Puede faltar información para restaurar correctamente.\n¿Continuar de todas formas?`,
      { btnOk: 'Continuar', btnColor: '#D69E2E' }
    );
    if (!continuar) return;
  }

  const porTabla = new Map();
  XLSX.utils.sheet_to_json(wsRaw, { header: 1 }).slice(1).forEach(row => {
    const [tabla, , json] = row;
    if (!tabla || !json) return;
    if (!porTabla.has(tabla)) porTabla.set(tabla, []);
    try { porTabla.get(tabla).push(JSON.parse(json)); } catch (e) { /* fila corrupta, se ignora */ }
  });

  if (!porTabla.size) { mostrarToast('El archivo no contiene registros para restaurar.', 'atencion'); return; }

  const resumenTablas = [...porTabla.entries()].map(([t, filas]) => `${escapar(t)}: ${filas.length} fila(s)`).join('\n');
  const ok = await confirmar(
    `ARCHIVO HISTÓRICO DETECTADO\n\n` +
    `Empresa: ${escapar(meta['Empresa'] || '')}\n` +
    `Período(s): ${escapar(meta['Período(s)'] || '')}\n` +
    `Versión: ${escapar(version)}\n\n` +
    `Registros en el archivo:\n${resumenTablas}\n\n` +
    `Los registros que ya existan en NEXUM NO se duplican ni se sobrescriben — solo se agregan los que falten. ¿Deseas importar este histórico?`,
    { btnOk: 'Importar histórico', btnColor: '#2C5282' }
  );
  if (!ok) return;

  mostrarToast('Restaurando información…', 'info');
  let totalNuevos = 0, totalExistentes = 0, conflictos = [];

  for (const [tabla, filas] of porTabla.entries()) {
    const ids = filas.map(r => r.id).filter(Boolean);
    if (!ids.length) continue;
    const { data: existentes, error: errSel } = await _supabase.from(tabla).select('*').in('id', ids);
    if (errSel) { mostrarToast(`No se pudo verificar ${tabla}: ${errSel.message}`, 'error'); continue; }
    const mapaExistentes = new Map((existentes || []).map(r => [r.id, r]));

    const nuevos = filas.filter(r => !mapaExistentes.has(r.id));
    filas.forEach(r => {
      if (!mapaExistentes.has(r.id)) return;
      const actual = mapaExistentes.get(r.id);
      const distinto = Object.keys(r).some(k => JSON.stringify(actual[k] ?? null) !== JSON.stringify(r[k] ?? null));
      if (distinto) conflictos.push({ tabla, id: r.id });
      else totalExistentes++;
    });

    if (nuevos.length) {
      const { error: errIns } = await _supabase.from(tabla).insert(nuevos);
      if (errIns) { mostrarToast(`Error restaurando ${tabla}: ${errIns.message}`, 'error'); continue; }
      totalNuevos += nuevos.length;
    }
  }

  mostrarToast(
    `Histórico restaurado: ${totalNuevos} registro(s) nuevo(s) agregado(s), ${totalExistentes} ya existían sin cambios${conflictos.length ? `, ${conflictos.length} con diferencias (no se modificaron, revisar manualmente)` : ''}.`,
    conflictos.length ? 'atencion' : 'exito'
  );
}

/* ============================================================
   LIMPIAR INFORMACIÓN

   Borra datos OPERATIVOS de un período+empresa, nunca configuración
   (catálogos, usuarios, plan de cuentas). Exige que exista un
   histórico generado para ese período antes de permitirlo, y pide
   selección de qué tablas limpiar + doble confirmación. Reutiliza
   _histDatosPeriodo (el mismo motor del histórico) para calcular los
   conteos, así el número que Wendy ve ANTES de limpiar es exactamente
   el mismo que ya quedó respaldado en el Excel.
   ============================================================ */

const _HIST_ETIQUETAS_LIMPIEZA = {
  tesoreria_mbd:        'Tesorería — Pagos (MBD)',
  movimientos:          'Tesorería — Extracto bancario (EECC)',
  contabilidad_compras: 'Contabilidad — Compras',
  contabilidad_ventas:  'Contabilidad — Ventas',
  registro_compras:     'Tributaria — Registro de Compras',
  registro_ventas:      'Tributaria — Registro de Ventas',
  rh_registros:         'RH Recibidos',
  planilla_rh:          'Planilla — RH Emitidos',
  conciliaciones:       'Conciliación',
  planilla_periodos:    'Planilla — Remuneraciones',
  planillas_movilidad:  'Planilla — Movilidad',
  asientos:             'Contabilidad — Asientos',
  notas_operativas:     'Notas operativas',
  alertas_sistema:      'Alertas del sistema',
};

// Wendy confirmó (2026-09-11) que su flujo real es: respaldar TODO el
// período con "Generar histórico" y luego limpiar TODO ese mismo período
// de una vez (para liberar espacio) — por eso todas vienen marcadas por
// defecto. Sigue pudiendo desmarcar alguna si quiere una limpieza parcial.
const _HIST_LIMPIEZA_DEFAULT_ON = new Set(Object.keys(_HIST_ETIQUETAS_LIMPIEZA));

// rh_movimiento_links queda fuera a propósito: es la tabla legacy de
// vinculación RH↔banco y no tiene una columna de período propia — limpiarla
// por período requeriría inferir pertenencia desde rh_registros/movimientos
// ya borrados, con riesgo de dejar vínculos huérfanos. Se deja para una
// fase futura si hace falta.

async function limpiarInformacionClick() {
  const { empId, desde, empNom } = _getParams();
  if (!empId || !desde) { mostrarToast('Selecciona empresa y "Periodo desde" (un solo mes)', 'atencion'); return; }
  const periodo = desde;

  mostrarToast('Verificando información del período…', 'info');
  const datosPeriodo = await _histDatosPeriodo(empId, periodo);
  const conteos = datosPeriodo.conteos;
  const totalOperativo = Object.entries(conteos)
    .filter(([t]) => _HIST_ETIQUETAS_LIMPIEZA[t])
    .reduce((s, [, n]) => s + n, 0);

  if (totalOperativo === 0) {
    mostrarToast('No hay información operativa en ese período para limpiar.', 'atencion');
    return;
  }

  const { data: pc } = await _supabase.from('periodos_contables').select('*')
    .eq('empresa_id', empId).eq('periodo', periodo).maybeSingle();

  if (!pc || !pc.historico_generado_en) {
    mostrarToast('No existe un histórico generado para este período. Genera uno primero con "📦 Generar histórico" antes de limpiar.', 'atencion');
    return;
  }

  _histAbrirModalLimpieza(empId, empNom, periodo, conteos, pc);
}

function _histAbrirModalLimpieza(empId, empNom, periodo, conteos, pc) {
  const mc = document.getElementById('modal-container');
  // "Planilla — Remuneraciones" combina periodos + su detalle (el número
  // de trabajadores/registros es lo que realmente representa el impacto).
  const detallePlanilla = conteos.planilla_periodos > 0
    ? `${conteos.planilla_periodos} período(s), ${conteos.planilla_detalle || 0} registro(s)` : '';

  const filas = Object.entries(_HIST_ETIQUETAS_LIMPIEZA)
    .filter(([tabla]) => conteos[tabla] > 0)
    .map(([tabla, etiqueta]) => {
      const esPlanilla = tabla === 'planilla_periodos';
      const dataConteo = esPlanilla ? (conteos.planilla_periodos + (conteos.planilla_detalle || 0)) : conteos[tabla];
      return `
      <label style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--color-borde)">
        <input type="checkbox" class="hist-limp-chk" value="${tabla}" ${_HIST_LIMPIEZA_DEFAULT_ON.has(tabla) ? 'checked' : ''}>
        <span style="flex:1">${escapar(etiqueta)}</span>
        <strong data-conteo="${dataConteo}">${esPlanilla ? detallePlanilla : conteos[tabla]}</strong>
      </label>`;
    }).join('');

  mc.innerHTML = `
    <div class="modal-overlay" style="display:flex" onclick="if(event.target===this)this.parentElement.innerHTML=''">
      <div class="modal" style="max-width:480px;width:95%;max-height:90vh;overflow-y:auto">
        <div class="modal-header">
          <h3>🧹 Limpiar información — ${escapar(periodo)}</h3>
          <button class="modal-cerrar" onclick="this.closest('.modal-overlay').remove()">✕</button>
        </div>
        <div class="modal-body">
          <p style="font-size:13px;color:var(--color-texto-suave);margin-bottom:10px">
            Empresa: <strong>${escapar(empNom)}</strong> · Histórico verificado: generado el
            ${escapar(_histFmtFecha(pc.historico_generado_en?.slice(0,10)))} (${pc.historico_conteo_registros ? Object.values(pc.historico_conteo_registros).reduce((s,n)=>s+n,0) : '—'} registros respaldados).
          </p>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <p style="font-size:13px;margin:0">Selecciona qué información operativa de este período deseas limpiar:</p>
            <label style="font-size:12px;display:flex;align-items:center;gap:4px;white-space:nowrap">
              <input type="checkbox" id="hist-limp-todo" checked onchange="document.querySelectorAll('.hist-limp-chk').forEach(c=>c.checked=this.checked)">
              Todo
            </label>
          </div>
          <div>${filas}</div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secundario" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
          <button class="btn btn-primario" style="background:#C53030" onclick="_histConfirmarLimpieza('${empId}','${escapar(empNom)}','${periodo}')">Continuar</button>
        </div>
      </div>
    </div>`;
}

async function _histConfirmarLimpieza(empId, empNom, periodo) {
  const seleccion = [...document.querySelectorAll('.hist-limp-chk:checked')].map(c => c.value);
  if (!seleccion.length) { mostrarToast('Selecciona al menos una tabla', 'atencion'); return; }

  const conteos = {};
  document.querySelectorAll('.hist-limp-chk').forEach(c => {
    if (seleccion.includes(c.value)) conteos[c.value] = Number(c.closest('label').querySelector('strong').dataset.conteo);
  });
  const total = Object.values(conteos).reduce((s, n) => s + n, 0);
  const detalle = seleccion.map(t => `• ${_HIST_ETIQUETAS_LIMPIEZA[t]}: ${conteos[t]}`).join('\n');

  document.querySelector('.modal-overlay')?.remove();

  const ok1 = await confirmar(
    `⚠️ Estás a punto de limpiar información operativa de NEXUM.\n\n` +
    `Empresa: ${empNom}\nPeríodo: ${periodo}\n\n${detalle}\n\nTotal: ${total} registro(s)\n\n` +
    `Esta acción afectará los registros seleccionados del período indicado. Ya se verificó que existe un histórico respaldado.\n¿Deseas continuar?`,
    { btnOk: 'Continuar', btnColor: '#DD6B20' }
  );
  if (!ok1) return;

  const ok2 = await confirmar(
    `🚨 CONFIRMACIÓN FINAL\n\n¿Estás completamente segura de limpiar la información seleccionada?\n\n` +
    `Empresa: ${empNom}\nPeríodo: ${periodo}\nRegistros afectados: ${total}\n\nEsta acción modificará los datos operativos actuales.`,
    { btnOk: 'Sí, limpiar información', btnColor: '#C53030' }
  );
  if (!ok2) return;

  mostrarToast('Limpiando información…', 'info');
  const resultado = {};
  for (const tabla of seleccion) {
    try {
      if (tabla === 'planilla_periodos') await _histBorrarPlanilla(empId, periodo);
      else if (tabla === 'planillas_movilidad') await _histBorrarPlanillaMovilidad(empId, periodo);
      else await _histBorrarTablaSimple(tabla, empId, periodo);
      resultado[tabla] = 'ok';
    } catch (e) {
      resultado[tabla] = 'error: ' + e.message;
    }
  }

  const errores = Object.entries(resultado).filter(([, v]) => v !== 'ok');
  if (errores.length) {
    mostrarToast(`Limpieza completada con errores en: ${errores.map(([t]) => _HIST_ETIQUETAS_LIMPIEZA[t]).join(', ')}. Revisa esas tablas manualmente.`, 'error');
  } else {
    mostrarToast(`✓ Limpieza completada — ${total} registro(s) de ${periodo} eliminados. NEXUM está listo para trabajar el siguiente período.`, 'exito');
  }
}

// ── Filtros IDÉNTICOS a los usados por _histDatosPeriodo para traer/contar
//    estas mismas filas — así lo que se cuenta es exactamente lo que se borra.
async function _histBorrarTablaSimple(tabla, empresaId, periodo) {
  const { desde, hasta } = _histRangoMes(periodo);
  const periodoCompacto = periodo.replace('-', '');
  const cfg = {
    tesoreria_mbd:        { campo: 'empresa_id', col: 'fecha_deposito', tipo: 'rango' },
    movimientos:          { campo: 'empresa_operadora_id', col: 'periodo', tipo: 'eq', valor: periodo },
    contabilidad_compras: { campo: 'empresa_id', col: 'periodo', tipo: 'eq', valor: periodoCompacto },
    contabilidad_ventas:  { campo: 'empresa_id', col: 'periodo', tipo: 'eq', valor: periodoCompacto },
    registro_compras:     { campo: 'empresa_operadora_id', col: 'periodo', tipo: 'eq', valor: periodo },
    registro_ventas:      { campo: 'empresa_operadora_id', col: 'periodo', tipo: 'eq', valor: periodo },
    rh_registros:         { campo: 'empresa_operadora_id', col: 'fecha_emision', tipo: 'rango' },
    planilla_rh:          { campo: 'empresa_id', col: 'fecha_emision', tipo: 'rango' },
    conciliaciones:       { campo: 'empresa_operadora_id', col: 'fecha_conciliacion', tipo: 'rangoHora' },
    asientos:             { campo: 'empresa_operadora_id', col: 'periodo', tipo: 'eq', valor: periodo },
    notas_operativas:     { campo: 'empresa_id', col: 'created_at', tipo: 'rangoHora' },
    alertas_sistema:      { campo: 'empresa_id', col: 'created_at', tipo: 'rangoHora' },
  }[tabla];
  if (!cfg) throw new Error('Tabla sin configuración de limpieza: ' + tabla);

  let q = _supabase.from(tabla).delete().eq(cfg.campo, empresaId);
  if (cfg.tipo === 'eq') q = q.eq(cfg.col, cfg.valor);
  else if (cfg.tipo === 'rango') q = q.gte(cfg.col, desde).lte(cfg.col, hasta);
  else if (cfg.tipo === 'rangoHora') q = q.gte(cfg.col, desde).lte(cfg.col, hasta + 'T23:59:59');
  const { error } = await q;
  if (error) throw error;
}

async function _histBorrarPlanilla(empresaId, periodo) {
  const anio = Number(periodo.slice(0, 4)), mes = Number(periodo.slice(5, 7));
  const { data: periodos } = await _supabase.from('planilla_periodos').select('id')
    .eq('empresa_operadora_id', empresaId).eq('anio', anio).eq('mes', mes);
  const ids = (periodos || []).map(p => p.id);
  if (!ids.length) return;
  await _supabase.from('planilla_detalle').delete().in('periodo_id', ids);
  const { error } = await _supabase.from('planilla_periodos').delete().in('id', ids);
  if (error) throw error;
}

async function _histBorrarPlanillaMovilidad(empresaId, periodo) {
  const { data: pms } = await _supabase.from('planillas_movilidad').select('id')
    .eq('empresa_operadora_id', empresaId).eq('mes', periodo);
  const ids = (pms || []).map(p => p.id);
  if (!ids.length) return;
  await _supabase.from('planilla_movilidad_detalles').delete().in('planilla_id', ids);
  const { error } = await _supabase.from('planillas_movilidad').delete().in('id', ids);
  if (error) throw error;
}
