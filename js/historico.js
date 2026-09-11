/* ============================================================
   NEXUM — Histórico / Respaldo mensual (Fase 1: solo exportación)

   Genera un Excel integral y restaurable de TODO lo trabajado en
   una empresa+período: MBD, EECC, Contabilidad, Tributaria, RH,
   Planilla, Planilla de Movilidad, Asientos, conciliaciones y
   notas/alertas del período. No modifica ni borra nada — es de
   solo lectura sobre las tablas operativas, y solo escribe una
   fila de trazabilidad (conteos, no datos) en periodos_contables.

   No reemplaza los botones "Exportar" de cada módulo (formato de
   trabajo, se mantienen igual) — este es el formato de Histórico/
   Restauración, reconocible por la hoja METADATOS con versión
   NEXUM-HIST-1.0. La Fase 2 (Importar/Restaurar) leerá ese mismo
   formato.
   ============================================================ */

const NEXUM_HIST_VERSION = 'NEXUM-HIST-1.0';

function _histRangoMes(periodo) {
  const [y, m] = periodo.split('-').map(Number);
  const desde = `${periodo}-01`;
  const hasta = `${periodo}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
  return { desde, hasta };
}

// ── Aplana un objeto con relaciones anidadas (join de 1 nivel) en
//    columnas con prefijo, para que cada fila del Excel sea legible
//    y no queden campos como "[object Object]". ────────────────────
function _histFlat(row, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(row || {})) {
    if (v === null || v === undefined) { out[prefix + k] = ''; continue; }
    if (Array.isArray(v)) { out[prefix + k] = v.length ? JSON.stringify(v) : ''; continue; }
    if (typeof v === 'object') { Object.assign(out, _histFlat(v, prefix + k + '_')); continue; }
    out[prefix + k] = v;
  }
  return out;
}

async function generarHistorico(empresaId, periodo, empNombre) {
  if (!empresaId || !periodo) { mostrarToast('Selecciona empresa y período', 'atencion'); return; }
  mostrarToast('Generando histórico completo… puede tardar unos segundos', 'info');

  const { desde, hasta } = _histRangoMes(periodo);
  const conteos = {};
  const hojas = [];

  const agregar = (nombreHoja, tabla, filas, mapFn) => {
    conteos[tabla] = filas.length;
    const datos = filas.map(f => _histFlat(mapFn ? mapFn(f) : f));
    hojas.push({ nombre: nombreHoja, datos });
  };

  const [
    resMbd, resMov, resContCompras, resContVentas, resRegCompras, resRegVentas,
    resRH, resRHEmitido, resLinks, resConcil, resPlaPeriodos, resPlaDetalle,
    resPM, resAsientos, resNotas, resAlertas,
  ] = await Promise.all([
    _supabase.from('tesoreria_mbd').select('*').eq('empresa_id', empresaId).gte('fecha_deposito', desde).lte('fecha_deposito', hasta),
    _supabase.from('movimientos').select('*, cuentas_bancarias(nombre_alias)').eq('empresa_operadora_id', empresaId).eq('periodo', periodo),
    _supabase.from('contabilidad_compras').select('*').eq('empresa_id', empresaId).eq('periodo', periodo),
    _supabase.from('contabilidad_ventas').select('*').eq('empresa_id', empresaId).eq('periodo', periodo),
    _supabase.from('registro_compras').select('*').eq('empresa_operadora_id', empresaId).eq('periodo', periodo),
    _supabase.from('registro_ventas').select('*').eq('empresa_operadora_id', empresaId).eq('periodo', periodo),
    _supabase.from('rh_registros').select('*, prestadores_servicios(nombre,dni)').eq('empresa_operadora_id', empresaId).gte('fecha_emision', desde).lte('fecha_emision', hasta),
    _supabase.from('planilla_rh').select('*').eq('empresa_id', empresaId).gte('fecha_emision', desde).lte('fecha_emision', hasta),
    _supabase.from('rh_movimiento_links').select('*, rh_registros(numero_rh,nombre_emisor,monto_bruto), movimientos(fecha,importe,numero_operacion)').eq('empresa_id', empresaId),
    _supabase.from('conciliaciones').select('*').eq('empresa_operadora_id', empresaId).gte('fecha_conciliacion', desde).lte('fecha_conciliacion', hasta),
    _supabase.from('planilla_periodos').select('*').eq('empresa_operadora_id', empresaId).eq('anio', Number(periodo.slice(0,4))).eq('mes', Number(periodo.slice(5,7))),
    _supabase.from('planilla_detalle').select('*, planilla_periodos!inner(anio,mes,tipo), trabajadores(nombre,apellido_paterno,apellido_materno,dni)').eq('empresa_operadora_id', empresaId).eq('planilla_periodos.anio', Number(periodo.slice(0,4))).eq('planilla_periodos.mes', Number(periodo.slice(5,7))),
    _supabase.from('planillas_movilidad').select('*, planilla_movilidad_detalles(*)').eq('empresa_operadora_id', empresaId).eq('mes', periodo),
    _supabase.from('asientos').select('*').eq('empresa_operadora_id', empresaId).eq('periodo', periodo),
    _supabase.from('notas_operativas').select('*').eq('empresa_id', empresaId).gte('created_at', desde).lte('created_at', hasta + 'T23:59:59'),
    _supabase.from('alertas_sistema').select('*').eq('empresa_id', empresaId).gte('created_at', desde).lte('created_at', hasta + 'T23:59:59'),
  ]);

  // Filtra rh_movimiento_links a los que tocan al período (por su RH o su movimiento)
  const rhIds  = new Set((resRH.data || []).map(r => r.id));
  const movIds = new Set((resMov.data || []).map(m => m.id));
  const linksPeriodo = (resLinks.data || []).filter(l => rhIds.has(l.rh_id) || movIds.has(l.movimiento_id));

  agregar('MBD',                 'tesoreria_mbd',        resMbd.data || []);
  agregar('EECC_MOVIMIENTOS',    'movimientos',          resMov.data || []);
  agregar('CONTABILIDAD_COMPRAS','contabilidad_compras', resContCompras.data || []);
  agregar('CONTABILIDAD_VENTAS', 'contabilidad_ventas',  resContVentas.data || []);
  agregar('TRIBUTARIA_COMPRAS',  'registro_compras',     resRegCompras.data || []);
  agregar('TRIBUTARIA_VENTAS',   'registro_ventas',      resRegVentas.data || []);
  agregar('RH_RECIBIDOS',        'rh_registros',         resRH.data || []);
  agregar('RH_EMITIDOS',         'planilla_rh',          resRHEmitido.data || []);
  agregar('VINCULOS_RH_BANCO',   'rh_movimiento_links',  linksPeriodo);
  agregar('CONCILIACIONES',      'conciliaciones',       resConcil.data || []);
  agregar('PLANILLA_PERIODOS',   'planilla_periodos',    resPlaPeriodos.data || []);
  agregar('PLANILLA_DETALLE',    'planilla_detalle',     resPlaDetalle.data || []);
  agregar('ASIENTOS',            'asientos',             resAsientos.data || []);
  agregar('NOTAS',               'notas_operativas',     resNotas.data || []);
  agregar('ALERTAS',             'alertas_sistema',       resAlertas.data || []);

  // Planilla de movilidad: 2 hojas (resumen + detalle), igual que el reporte existente
  const pmList = resPM.data || [];
  conteos['planillas_movilidad'] = pmList.length;
  hojas.push({ nombre: 'PLANILLA_MOVILIDAD', datos: pmList.map(p => _histFlat({ ...p, planilla_movilidad_detalles: undefined })) });
  const pmDetalle = [];
  pmList.forEach(p => (p.planilla_movilidad_detalles || []).forEach(d => pmDetalle.push({ numero_planilla: p.numero_planilla, trabajador_dni: p.trabajador_dni, ...d })));
  conteos['planilla_movilidad_detalles'] = pmDetalle.length;
  hojas.push({ nombre: 'PLANILLA_MOVILIDAD_DET', datos: pmDetalle.map(d => _histFlat(d)) });

  const totalRegistros = Object.values(conteos).reduce((s, n) => s + n, 0);
  if (totalRegistros === 0) {
    mostrarToast('No se encontró información para esa empresa/período', 'atencion');
    return;
  }

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
    ['Para volver a ver esta información dentro de NEXUM más adelante (por ejemplo si'],
    ['este período fue limpiado de Supabase), usa Reportes → Importar histórico y'],
    ['selecciona este mismo archivo, sin modificarlo.'],
    [''],
    ['No modifiques manualmente el contenido de las hojas ni de METADATOS: el'],
    ['importador de NEXUM valida su estructura antes de restaurar cualquier dato.'],
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

  // Registra la trazabilidad (solo conteos y metadatos, no los datos) en periodos_contables
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
