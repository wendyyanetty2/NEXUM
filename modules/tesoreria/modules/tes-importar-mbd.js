// ═══════════════════════════════════════════════════════════════
// Tesorería — Importar MBD (Manual de Bancos Detallado)
// ═══════════════════════════════════════════════════════════════

let mbd_datos_preview = [];

async function renderTabImportarMBD(area) {
  area.innerHTML = `
    <div class="fadeIn">

      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;margin-bottom:4px">
          <h3>📂 Importar MBD desde Excel</h3>
          <button class="btn btn-secundario btn-sm" onclick="exportarPlantillaMBD()">
            📋 Descargar Plantilla MBD
          </button>
        </div>
        <p class="text-muted text-sm" style="margin-bottom:20px">
          Sube el archivo MBD (.xlsx / .xlsm). La hoja debe llamarse <strong>REGISTRO</strong>,
          encabezados en fila 3 y datos desde fila 4. Usa "Descargar Plantilla" para obtener el formato correcto con tus catálogos precargados.
        </p>

        <div id="mbd-drop-zone"
          style="border:2px dashed var(--color-borde);border-radius:var(--radio);
                 padding:40px 20px;text-align:center;cursor:pointer;
                 transition:border-color 0.2s,background 0.2s;margin-bottom:16px"
          ondragover="event.preventDefault();this.style.borderColor='var(--color-primario)';this.style.background='var(--color-fondo-2)'"
          ondragleave="this.style.borderColor='var(--color-borde)';this.style.background=''"
          ondrop="_mbdHandleDrop(event)"
          onclick="document.getElementById('mbd-file-input').click()">
          <div style="font-size:36px;margin-bottom:8px">📊</div>
          <p style="font-weight:500;margin-bottom:4px">Arrastra el archivo MBD aquí</p>
          <p class="text-muted text-sm">o haz clic para seleccionar</p>
          <input type="file" id="mbd-file-input" accept=".xlsx,.xlsm"
                 style="display:none" onchange="_mbdHandleFile(this.files[0])">
        </div>

        <div id="mbd-archivo-info" style="display:none" class="alerta-exito" style="margin-bottom:12px"></div>
      </div>

      <div id="mbd-preview-wrap" style="display:none" class="card" style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
          <h3>👁️ Vista previa — <span id="mbd-preview-count">0</span> registros</h3>
          <div id="mbd-preview-resumen" class="text-sm text-muted"></div>
        </div>
        <div class="table-wrap" style="max-height:320px;overflow-y:auto">
          <table class="tabla" style="font-size:12px">
            <thead>
              <tr>
                <th>N° Op.</th>
                <th>Fecha</th>
                <th>Descripción</th>
                <th>Monto</th>
                <th>Proveedor</th>
                <th>Estado Doc</th>
                <th>Nro Doc</th>
                <th>Val.</th>
              </tr>
            </thead>
            <tbody id="mbd-tbody-preview"></tbody>
          </table>
        </div>
        <div style="display:flex;gap:8px;margin-top:16px">
          <button class="btn btn-secundario" onclick="_mbdCancelarPreview()">Cancelar</button>
          <button class="btn btn-primario" id="mbd-btn-confirmar" onclick="_mbdConfirmarImportacion()">
            ✅ Confirmar importación
          </button>
        </div>
      </div>

      <div id="mbd-progreso" style="display:none" class="card" style="margin-bottom:16px">
        <p id="mbd-progreso-texto" class="text-muted text-sm" style="margin-bottom:8px">Preparando...</p>
        <div style="height:6px;background:var(--color-borde);border-radius:3px;overflow:hidden">
          <div id="mbd-progreso-barra" style="height:100%;background:var(--color-primario);width:0;transition:width 0.3s"></div>
        </div>
      </div>

      <div class="card">
        <h3 style="margin-bottom:12px">📜 Historial de importaciones MBD</h3>
        <div id="mbd-historial">
          <div class="text-center text-muted text-sm" style="padding:20px">Cargando…</div>
        </div>
      </div>
    </div>`;

  await _mbdCargarHistorial();
}

// ── Parseo de fechas Excel ────────────────────────────────────────
function _parsearFechaExcel(val) {
  if (val === null || val === undefined || val === '') return null;

  if (typeof val === 'number') {
    const fecha = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (isNaN(fecha.getTime())) return null;
    const y = fecha.getUTCFullYear();
    const m = String(fecha.getUTCMonth() + 1).padStart(2, '0');
    const d = String(fecha.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, '0');
    const d = String(val.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const s = val.toString().trim();

  // DD/MM/YYYY HH:MM
  const reDateTime = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/;
  const mdt = s.match(reDateTime);
  if (mdt) {
    const [, d, mo, y] = mdt;
    return `${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10);
}

// ── Drag & Drop handlers ──────────────────────────────────────────
function _mbdHandleDrop(e) {
  e.preventDefault();
  const dropZone = document.getElementById('mbd-drop-zone');
  if (dropZone) {
    dropZone.style.borderColor = 'var(--color-borde)';
    dropZone.style.background  = '';
  }
  const file = e.dataTransfer?.files?.[0];
  if (!file) return;
  if (!file.name.match(/\.(xlsx|xlsm)$/i)) {
    mostrarToast('Solo se aceptan archivos .xlsx o .xlsm', 'atencion');
    return;
  }
  _mbdHandleFile(file);
}

function _mbdHandleFile(file) {
  if (!file) return;
  const info = document.getElementById('mbd-archivo-info');
  if (info) {
    info.style.display = 'block';
    info.textContent   = `📂 ${file.name} (${(file.size / 1024).toFixed(1)} KB) — leyendo…`;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array', cellDates: false });

      const wsName = wb.SheetNames.find(n => n.trim().toUpperCase() === 'REGISTRO');
      if (!wsName) {
        mostrarToast('No se encontró la hoja "REGISTRO" en el archivo', 'error');
        if (info) info.style.display = 'none';
        return;
      }

      const ws   = wb.Sheets[wsName];
      const rng  = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      const filas = [];

      // Fila 3 = headers (index 2), datos desde fila 4 (index 3)
      for (let r = 3; r <= rng.e.r; r++) {
        const cel = (col) => {
          const addr = XLSX.utils.encode_cell({ r, c: col });
          const c    = ws[addr];
          return c ? c.v : null;
        };

        const colA = cel(0);
        // Saltar filas completamente vacías
        if (colA === null && cel(1) === null && cel(2) === null) continue;

        const importeRaw = parseFloat(cel(4)) || 0;
        const estadoDocRaw = (cel(12) || '').toString().trim().toUpperCase();
        const estadosValidos = ['EMITIDO','PENDIENTE','OBSERVADO','CANCELADO'];
        const estado_doc = estadosValidos.includes(estadoDocRaw) ? estadoDocRaw : 'PENDIENTE';

        const fechaParsed = _parsearFechaExcel(cel(1));

        filas.push({
          _fila:                r + 1,
          numero_operacion:     colA !== null ? colA.toString().trim() : null,
          fecha:                fechaParsed,
          descripcion:          cel(2) !== null ? cel(2).toString().trim() : null,
          moneda:               cel(3) !== null ? cel(3).toString().trim().toUpperCase() : 'PEN',
          importe:              importeRaw,
          naturaleza:           importeRaw < 0 ? 'CARGO' : 'ABONO',
          nombre_proveedor_raw: cel(5) !== null ? cel(5).toString().trim() : null,
          ruc_dni_raw:          cel(6) !== null ? cel(6).toString().trim() : null,
          cotizacion:           cel(7) !== null ? cel(7).toString().trim() : null,
          oc:                   cel(8) !== null ? cel(8).toString().trim() : null,
          proyecto_raw:         cel(9)  !== null ? cel(9).toString().trim()  : null,
          concepto_raw:         cel(10) !== null ? cel(10).toString().trim() : null,
          empresa_raw:          cel(11) !== null ? cel(11).toString().trim() : null,
          estado_doc,
          numero_documento:     cel(13) !== null ? cel(13).toString().trim() : null,
          tipo_documento_codigo: cel(14) !== null ? cel(14).toString().trim() : null,
          autorizacion_raw:     cel(15) !== null ? cel(15).toString().trim() : null,
          observaciones:        cel(16) !== null ? cel(16).toString().trim() : null,
          detalles_servicio:    cel(17) !== null ? cel(17).toString().trim() : null,
          observaciones_2:      cel(18) !== null ? cel(18).toString().trim() : null,
          _ok: !!fechaParsed && importeRaw !== 0,
        });
      }

      mbd_datos_preview = filas;
      _mbdMostrarPreview(file.name, filas);

    } catch (err) {
      mostrarToast('Error al leer el archivo: ' + err.message, 'error');
      if (info) info.style.display = 'none';
    }
  };
  reader.readAsArrayBuffer(file);
}

function _mbdMostrarPreview(nombre, filas) {
  const wrap  = document.getElementById('mbd-preview-wrap');
  const tbody = document.getElementById('mbd-tbody-preview');
  const info  = document.getElementById('mbd-archivo-info');
  if (!wrap || !tbody) return;

  const validos  = filas.filter(f => f._ok).length;
  const errores  = filas.length - validos;
  const muestra  = filas.slice(0, 10);

  if (info) info.textContent = `📂 ${nombre} — ${filas.length} filas leídas`;

  document.getElementById('mbd-preview-count').textContent = filas.length;
  document.getElementById('mbd-preview-resumen').textContent =
    `✅ ${validos} válidos  ⚠️ ${errores} con errores (se omitirán)`;

  const coloresEstado = {
    EMITIDO:   'badge-activo',
    PENDIENTE: 'badge-warning',
    OBSERVADO: 'badge-info',
    CANCELADO: 'badge-inactivo',
  };

  tbody.innerHTML = muestra.map(f => `
    <tr ${!f._ok ? 'style="background:var(--color-danger-bg,#FFF5F5)"' : ''}>
      <td class="text-mono" style="white-space:nowrap">${escapar(f.numero_operacion || '—')}</td>
      <td style="white-space:nowrap">${f.fecha || '<span class="text-rojo">—</span>'}</td>
      <td class="text-sm">${escapar((f.descripcion || '').slice(0, 35))}${(f.descripcion||'').length > 35 ? '…' : ''}</td>
      <td class="text-right" style="white-space:nowrap">
        ${f.importe !== 0
          ? `<span class="${f.naturaleza === 'CARGO' ? 'text-rojo' : 'text-verde'}">${f.naturaleza === 'CARGO' ? '-' : ''}${formatearMoneda(Math.abs(f.importe), f.moneda)}</span>`
          : '<span class="text-rojo">—</span>'}
      </td>
      <td class="text-sm">${escapar((f.nombre_proveedor_raw || '—').slice(0, 30))}</td>
      <td><span class="badge ${coloresEstado[f.estado_doc] || 'badge-info'}" style="font-size:10px">${f.estado_doc}</span></td>
      <td class="text-mono text-sm">${escapar(f.numero_documento || '—')}</td>
      <td>${f._ok
        ? '<span class="badge badge-activo" style="font-size:10px">OK</span>'
        : '<span class="badge badge-inactivo" style="font-size:10px">Error</span>'}</td>
    </tr>`).join('');

  if (filas.length > 10) {
    const extra = filas.length - 10;
    tbody.innerHTML += `
      <tr>
        <td colspan="8" class="text-center text-muted text-sm" style="padding:8px">
          … y ${extra} filas más (no se muestran en la preview)
        </td>
      </tr>`;
  }

  wrap.style.display = 'block';
}

function _mbdCancelarPreview() {
  mbd_datos_preview = [];
  const wrap  = document.getElementById('mbd-preview-wrap');
  const info  = document.getElementById('mbd-archivo-info');
  const input = document.getElementById('mbd-file-input');
  if (wrap)  wrap.style.display  = 'none';
  if (info)  info.style.display  = 'none';
  if (input) input.value         = '';
}

async function _mbdConfirmarImportacion() {
  const validos = mbd_datos_preview.filter(f => f._ok);
  if (!validos.length) {
    mostrarToast('No hay registros válidos para importar', 'atencion');
    return;
  }

  const btn = document.getElementById('mbd-btn-confirmar');
  if (btn) { btn.disabled = true; btn.textContent = 'Importando…'; }

  const progWrap = document.getElementById('mbd-progreso');
  const progTxt  = document.getElementById('mbd-progreso-texto');
  const progBarra= document.getElementById('mbd-progreso-barra');
  if (progWrap) progWrap.style.display = 'block';

  const nombreArchivo = document.getElementById('mbd-file-input')?.files[0]?.name || 'MBD.xlsx';

  const { data: lote, error: errLote } = await _supabase
    .from('lotes_importacion')
    .insert({
      empresa_operadora_id: empresa_activa.id,
      cuenta_bancaria_id:   null,
      nombre_archivo:       nombreArchivo,
      tipo_fuente:          'MANUAL',
      total_registros:      mbd_datos_preview.length,
      estado:               'PROCESANDO',
      usuario_id:           perfil_usuario?.id || null,
    })
    .select()
    .single();

  if (errLote) {
    mostrarToast('Error al crear lote: ' + errLote.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = '✅ Confirmar importación'; }
    if (progWrap) progWrap.style.display = 'none';
    return;
  }

  const movs = validos.map(f => ({
    empresa_operadora_id:  empresa_activa.id,
    cuenta_bancaria_id:    null,
    fecha:                 f.fecha,
    naturaleza:            f.naturaleza,
    importe:               Math.abs(f.importe),
    moneda:                f.moneda || 'PEN',
    descripcion:           f.descripcion || null,
    numero_operacion:      f.numero_operacion || null,
    tipo_documento_codigo: f.tipo_documento_codigo || null,
    numero_documento:      f.numero_documento || null,
    cotizacion:            f.cotizacion || null,
    oc:                    f.oc || null,
    estado_doc:            f.estado_doc,
    observaciones:         f.observaciones || null,
    detalles_servicio:     f.detalles_servicio || null,
    observaciones_2:       f.observaciones_2 || null,
    estado:                'PENDIENTE',
    conciliado:            false,
    lote_importacion:      lote.id,
    usuario_id:            perfil_usuario?.id || null,
  }));

  let ok = 0;
  let errCount = 0;
  const TAMANO_LOTE = 50;

  for (let i = 0; i < movs.length; i += TAMANO_LOTE) {
    const chunk = movs.slice(i, i + TAMANO_LOTE);
    const { error } = await _supabase.from('movimientos').insert(chunk);
    if (error) {
      errCount += chunk.length;
    } else {
      ok += chunk.length;
    }
    const pct = Math.round(((i + chunk.length) / movs.length) * 100);
    if (progTxt)   progTxt.textContent   = `Importando ${Math.min(i + TAMANO_LOTE, movs.length)}/${movs.length}…`;
    if (progBarra) progBarra.style.width = pct + '%';
  }

  await _supabase.from('lotes_importacion').update({
    estado:          errCount === 0 ? 'COMPLETADO' : 'ERROR',
    registros_ok:    ok,
    registros_error: errCount,
  }).eq('id', lote.id);

  if (btn) { btn.disabled = false; btn.textContent = '✅ Confirmar importación'; }
  if (progWrap) progWrap.style.display = 'none';

  mostrarToast(
    `✓ ${ok} registros importados${errCount ? `, ${errCount} errores` : ''}`,
    errCount > 0 ? 'atencion' : 'exito'
  );

  _mbdCancelarPreview();
  await _mbdCargarHistorial();
}

async function _mbdCargarHistorial() {
  const cont = document.getElementById('mbd-historial');
  if (!cont) return;

  const { data } = await _supabase
    .from('lotes_importacion')
    .select('*')
    .eq('empresa_operadora_id', empresa_activa.id)
    .eq('tipo_fuente', 'MANUAL')
    .order('fecha_creacion', { ascending: false })
    .limit(10);

  const lista = data || [];
  if (!lista.length) {
    cont.innerHTML = '<p class="text-center text-muted text-sm" style="padding:12px">Sin importaciones MBD registradas</p>';
    return;
  }

  const colores = { COMPLETADO: 'badge-activo', PROCESANDO: 'badge-warning', ERROR: 'badge-inactivo' };

  cont.innerHTML = `
    <div class="table-wrap">
      <table class="tabla" style="font-size:13px">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Archivo</th>
            <th>Total</th>
            <th>OK</th>
            <th>Errores</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          ${lista.map(l => `
            <tr>
              <td style="white-space:nowrap">${formatearFecha(l.fecha_creacion?.slice(0,10))}</td>
              <td class="text-sm">${escapar(l.nombre_archivo)}</td>
              <td class="text-center">${l.total_registros}</td>
              <td class="text-center text-verde">${l.registros_ok}</td>
              <td class="text-center ${l.registros_error > 0 ? 'text-rojo' : ''}">${l.registros_error}</td>
              <td><span class="badge ${colores[l.estado] || 'badge-info'}" style="font-size:11px">${l.estado}</span></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

// ── Exportar Plantilla MBD con catálogos precargados ─────────────
async function exportarPlantillaMBD() {
  mostrarToast('Generando plantilla con tus catálogos…', 'info');

  const eid = empresa_activa.id;
  const [resAut, resTiposDoc, resConceptos, resProyectos, resEmpresas] = await Promise.all([
    _supabase.from('autorizaciones').select('nombre').eq('empresa_operadora_id', eid).eq('activo', true).order('nombre'),
    _supabase.from('catalogo_tipos_documento').select('codigo,nombre').eq('activo', true).order('nombre'),
    _supabase.from('conceptos').select('nombre').eq('empresa_operadora_id', eid).eq('activo', true).order('nombre'),
    _supabase.from('proyectos').select('nombre').eq('empresa_operadora_id', eid).eq('activo', true).order('nombre'),
    _supabase.from('empresas_clientes').select('nombre').eq('empresa_operadora_id', eid).eq('activo', true).order('nombre'),
  ]);

  const autorizaciones = (resAut.data    || []).map(a => a.nombre);
  const tiposDoc       = (resTiposDoc.data || []).map(t => `${t.codigo} - ${t.nombre}`);
  const conceptos      = (resConceptos.data || []).map(c => c.nombre);
  const proyectos      = (resProyectos.data || []).map(p => p.nombre);
  const empresas       = (resEmpresas.data  || []).map(e => e.nombre);

  const encabezados = [
    'N° Operación bancaria',
    'Fecha Depósito (DD/MM/YYYY)',
    'Descripción / Detalle Operación',
    'Moneda (PEN/USD/EUR)',
    'Importe (CARGO=negativo, ABONO=positivo)',
    'Proveedor / Empresa / Personal',
    'RUC / DNI',
    'Cotización',
    'OC (Orden de Compra)',
    'Proyecto',
    'Concepto',
    'Empresa',
    'Entrega FA/DOC/RH (EMITIDO/PENDIENTE/OBSERVADO/CANCELADO)',
    'Nº Factura / Boleta / DOC',
    'Tipo DOC (código)',
    'Autorización',
    'Observaciones',
    'Detalles Compra/Servicio',
    'Observaciones 2',
  ];

  const wb = XLSX.utils.book_new();

  // ── Hoja REGISTRO ───────────────────────────────────────────────
  const registroData = [
    [`PLANTILLA MBD — ${empresa_activa.nombre} — ${new Date().toLocaleDateString('es-PE')}`,
     ...Array(18).fill('')],
    ['⚠ NO modificar la estructura. Fila 3 = encabezados. Datos desde fila 4. Ver hoja LISTAS para valores válidos.',
     ...Array(18).fill('')],
    encabezados,
    ...Array(10).fill(Array(19).fill('')),
  ];

  const wsReg = XLSX.utils.aoa_to_sheet(registroData);
  wsReg['!cols'] = [
    {wch:18},{wch:16},{wch:38},{wch:10},{wch:12},
    {wch:30},{wch:14},{wch:14},{wch:14},{wch:20},
    {wch:22},{wch:22},{wch:32},{wch:18},{wch:14},
    {wch:20},{wch:28},{wch:32},{wch:28},
  ];
  XLSX.utils.book_append_sheet(wb, wsReg, 'REGISTRO');

  // ── Hoja LISTAS (valores válidos de catálogos) ──────────────────
  const maxLen = Math.max(autorizaciones.length, tiposDoc.length, conceptos.length,
                          proyectos.length, empresas.length, 4);

  const listasData = [
    ['AUTORIZACIONES', 'TIPOS DOCUMENTO', 'CONCEPTOS', 'PROYECTOS',
     'EMPRESAS CLIENTES', 'ENTREGA FA/DOC/RH', 'MONEDAS'],
    ...Array.from({ length: maxLen }, (_, i) => [
      autorizaciones[i] || '',
      tiposDoc[i]       || '',
      conceptos[i]      || '',
      proyectos[i]      || '',
      empresas[i]       || '',
      ['EMITIDO', 'PENDIENTE', 'OBSERVADO', 'CANCELADO'][i] || '',
      ['PEN', 'USD', 'EUR'][i] || '',
    ]),
  ];

  const wsListas = XLSX.utils.aoa_to_sheet(listasData);
  wsListas['!cols'] = Array(7).fill({ wch: 30 });
  XLSX.utils.book_append_sheet(wb, wsListas, 'LISTAS');

  const fecha = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Plantilla_MBD_${empresa_activa.nombre.replace(/\s+/g, '_')}_${fecha}.xlsx`);
  mostrarToast('✓ Plantilla descargada. Hoja LISTAS tiene los valores válidos para cada campo.', 'exito');
}
