// ═══════════════════════════════════════════════════════════════
// Tesorería — Importar Registros SUNAT (Compras / Ventas)
// Propósito: verificar que cada comprobante importado tiene su
// movimiento bancario correspondiente en tesoreria_mbd.
// Usa sunat-parser.js como servicio compartido de parseo.
// ═══════════════════════════════════════════════════════════════

let sunat_preview_datos = [];
let sunat_tipo_actual   = null; // 'COMPRAS' | 'VENTAS'

async function renderTabImportarSunat(area) {
  area.innerHTML = `
    <div class="fadeIn">

      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;
                    flex-wrap:wrap;gap:8px;margin-bottom:16px">
          <div>
            <h3>📑 Importar Registros SUNAT</h3>
            <p class="text-muted text-sm" style="margin-top:4px">
              Sube el Excel del PLE SUNAT. Tras la importación se muestra si cada
              comprobante ya tiene un movimiento bancario vinculado en MBD.
            </p>
          </div>
        </div>

        <div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;
                        padding:10px 16px;border:2px solid var(--color-borde);
                        border-radius:var(--radio);font-size:13px;transition:all 0.2s"
                 id="lbl-sunat-compras">
            <input type="radio" name="sunat-tipo" value="COMPRAS" id="sunat-tipo-compras"
                   onchange="_sunatTipoChange()" style="accent-color:var(--color-primario)">
            🛒 Registro de Compras
          </label>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;
                        padding:10px 16px;border:2px solid var(--color-borde);
                        border-radius:var(--radio);font-size:13px;transition:all 0.2s"
                 id="lbl-sunat-ventas">
            <input type="radio" name="sunat-tipo" value="VENTAS" id="sunat-tipo-ventas"
                   onchange="_sunatTipoChange()" style="accent-color:var(--color-primario)">
            🏷️ Registro de Ventas
          </label>
        </div>

        <div id="sunat-drop-zone"
          style="border:2px dashed var(--color-borde);border-radius:var(--radio);
                 padding:40px 20px;text-align:center;cursor:pointer;
                 transition:border-color 0.2s,background 0.2s;margin-bottom:16px"
          ondragover="event.preventDefault();this.style.borderColor='var(--color-primario)';this.style.background='var(--color-fondo-2,#f7fafc)'"
          ondragleave="this.style.borderColor='var(--color-borde)';this.style.background=''"
          ondrop="_sunatHandleDrop(event)"
          onclick="document.getElementById('sunat-file-input').click()">
          <div style="font-size:36px;margin-bottom:8px">📊</div>
          <p style="font-weight:500;margin-bottom:4px">Arrastra el Excel SUNAT aquí</p>
          <p class="text-muted text-sm">o haz clic para seleccionar (.xlsx)</p>
          <input type="file" id="sunat-file-input" accept=".xlsx,.xls"
                 style="display:none" onchange="_sunatHandleFile(this.files[0])">
        </div>

        <div id="sunat-archivo-info" style="display:none" class="alerta-info"></div>
      </div>

      <!-- Vista previa -->
      <div id="sunat-preview-wrap" style="display:none" class="card" style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;
                    margin-bottom:12px;flex-wrap:wrap;gap:8px">
          <h3 style="display:flex;align-items:center;gap:8px">
            👁️ Vista previa —
            <span id="sunat-preview-count">0</span> registros
            <span id="sunat-tipo-badge" class="badge" style="font-size:11px"></span>
          </h3>
          <div id="sunat-preview-resumen" class="text-sm text-muted"></div>
        </div>
        <div class="table-wrap" style="max-height:360px;overflow-y:auto">
          <table class="tabla" style="font-size:12px">
            <thead>
              <tr>
                <th>Fecha</th><th>T.Doc</th><th>CDP (Serie-Número)</th>
                <th>Proveedor / Cliente</th>
                <th class="text-right">Base Imp.</th>
                <th class="text-right">IGV</th>
                <th class="text-right">Total</th>
                <th>Mon.</th><th>Val.</th>
              </tr>
            </thead>
            <tbody id="sunat-tbody-preview"></tbody>
          </table>
        </div>
        <div style="display:flex;gap:8px;margin-top:16px">
          <button class="btn btn-secundario" onclick="_sunatCancelarPreview()">Cancelar</button>
          <button class="btn btn-primario" id="sunat-btn-confirmar"
                  onclick="_sunatConfirmarImportacion()">
            ✅ Confirmar importación
          </button>
        </div>
      </div>

      <!-- Progreso -->
      <div id="sunat-progreso" style="display:none" class="card" style="margin-bottom:16px">
        <p id="sunat-progreso-texto" class="text-muted text-sm" style="margin-bottom:8px">Preparando...</p>
        <div style="height:6px;background:var(--color-borde);border-radius:3px;overflow:hidden">
          <div id="sunat-progreso-barra"
               style="height:100%;background:var(--color-primario);width:0;transition:width 0.3s"></div>
        </div>
      </div>

      <!-- Estado de conciliación (aparece tras importar) -->
      <div id="sunat-conciliacion-wrap" style="display:none" class="card" style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;
                    margin-bottom:12px;flex-wrap:wrap;gap:8px">
          <h3>🔗 Estado de conciliación bancaria</h3>
          <span class="text-muted text-sm" id="sunat-concil-resumen"></span>
        </div>
        <p class="text-muted text-sm" style="margin-bottom:12px">
          Indica si cada comprobante importado tiene un movimiento bancario vinculado
          en MBD (campo <em>N° Factura/Doc</em>).
        </p>
        <div class="table-wrap" style="max-height:400px;overflow-y:auto">
          <table class="tabla" style="font-size:12px">
            <thead><tr>
              <th>Fecha</th><th>CDP</th><th>Proveedor / Cliente</th><th>RUC</th>
              <th class="text-right">Total</th><th>Mon.</th><th>Estado conciliación</th>
            </tr></thead>
            <tbody id="sunat-concil-body"></tbody>
          </table>
        </div>
        <p class="text-muted text-sm" style="margin-top:10px;font-size:11px">
          ⚠️ La coincidencia es automática por N° de documento. Verifica manualmente si hay dudas.
        </p>
      </div>

      <!-- Historial -->
      <div class="card">
        <h3 style="margin-bottom:12px">📜 Historial de importaciones SUNAT</h3>
        <div id="sunat-historial">
          <div class="text-center text-muted text-sm" style="padding:20px">Cargando…</div>
        </div>
      </div>

    </div>`;

  await _sunatCargarHistorial();
}

// ── Control de tipo ───────────────────────────────────────────────

function _sunatTipoChange() {
  const tipo = document.querySelector('input[name="sunat-tipo"]:checked')?.value;
  sunat_tipo_actual = tipo || null;
  ['compras','ventas'].forEach(t => {
    const lbl = document.getElementById('lbl-sunat-' + t);
    if (lbl) lbl.style.borderColor = tipo === t.toUpperCase()
      ? 'var(--color-primario)' : 'var(--color-borde)';
  });
}

// ── Manejo de archivo ─────────────────────────────────────────────

function _sunatHandleDrop(e) {
  e.preventDefault();
  const dz = document.getElementById('sunat-drop-zone');
  if (dz) { dz.style.borderColor = 'var(--color-borde)'; dz.style.background = ''; }
  const file = e.dataTransfer?.files?.[0];
  if (!file || !file.name.match(/\.(xlsx|xls)$/i)) {
    mostrarToast('Solo se aceptan archivos .xlsx', 'atencion');
    return;
  }
  _sunatHandleFile(file);
}

function _sunatHandleFile(file) {
  if (!file) return;
  const info = document.getElementById('sunat-archivo-info');
  if (info) { info.style.display = 'block'; info.textContent = `📂 ${file.name} — leyendo…`; }

  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const resultado = sunat_parsear_buffer(ev.target.result, sunat_tipo_actual);

      if (!resultado.tipo) {
        mostrarToast('No se detectó el tipo. Selecciona Compras o Ventas manualmente.', 'atencion');
        if (info) info.style.display = 'none';
        return;
      }

      sunat_tipo_actual = resultado.tipo;

      // Sincronizar radio
      const radio = document.getElementById('sunat-tipo-' + resultado.tipo.toLowerCase());
      if (radio) { radio.checked = true; _sunatTipoChange(); }

      // Adaptar campos al formato de preview existente
      sunat_preview_datos = resultado.filas.map(f => ({
        ...f,
        entidad: f.nombre_proveedor || f.nombre_cliente || '',
        importe: f.total,
      }));

      if (info) info.textContent = `📂 ${file.name} — ${resultado.totalFilas} filas leídas`;
      mostrarToast(`Formato detectado: ${resultado.tipo === 'COMPRAS' ? '🛒 Compras' : '🏷️ Ventas'}`, 'info');
      _sunatMostrarPreview(resultado.tipo);

    } catch (err) {
      mostrarToast('Error al leer el archivo: ' + err.message, 'error');
      if (info) info.style.display = 'none';
    }
  };
  reader.readAsArrayBuffer(file);
}

// ── Vista previa ──────────────────────────────────────────────────

function _sunatMostrarPreview(tipo) {
  const wrap  = document.getElementById('sunat-preview-wrap');
  const tbody = document.getElementById('sunat-tbody-preview');
  if (!wrap || !tbody) return;

  const validos = sunat_preview_datos.filter(f => f._ok).length;
  const errores = sunat_preview_datos.length - validos;

  document.getElementById('sunat-preview-count').textContent = sunat_preview_datos.length;
  document.getElementById('sunat-preview-resumen').textContent =
    `✅ ${validos} válidos  ⚠️ ${errores} con errores (se omitirán)`;

  const badge = document.getElementById('sunat-tipo-badge');
  if (badge) {
    badge.textContent = tipo === 'COMPRAS' ? '🛒 Compras' : '🏷️ Ventas';
    badge.className   = `badge ${tipo === 'COMPRAS' ? 'badge-critico' : 'badge-activo'}`;
  }

  const muestra = sunat_preview_datos.slice(0, 15);
  tbody.innerHTML = muestra.map(f => `
    <tr ${!f._ok ? 'style="background:rgba(197,48,48,0.05)"' : ''}>
      <td style="white-space:nowrap">${f.fecha || '—'}</td>
      <td class="text-mono text-sm">${escapar(f.tipo_documento_codigo || '—')}</td>
      <td class="text-mono">${escapar(f.cdp || '—')}</td>
      <td class="text-sm">${escapar((f.entidad || '—').slice(0, 30))}</td>
      <td class="text-right">${f.base_imponible ? formatearMoneda(f.base_imponible, f.moneda) : '—'}</td>
      <td class="text-right">${f.igv ? formatearMoneda(f.igv, f.moneda) : '—'}</td>
      <td class="text-right" style="font-weight:600">${formatearMoneda(f.importe, f.moneda)}</td>
      <td>${escapar(f.moneda || '—')}</td>
      <td>${f._ok
        ? '<span class="badge badge-activo">OK</span>'
        : `<span class="badge badge-inactivo" title="${escapar((f._errores||[]).join(', '))}">Error</span>`}
      </td>
    </tr>`).join('');

  wrap.style.display = 'block';
}

function _sunatCancelarPreview() {
  sunat_preview_datos = [];
  document.getElementById('sunat-preview-wrap').style.display = 'none';
  document.getElementById('sunat-archivo-info').style.display = 'none';
  document.getElementById('sunat-conciliacion-wrap').style.display = 'none';
  document.getElementById('sunat-file-input').value = '';
}

// ── Confirmar importación ─────────────────────────────────────────

async function _sunatConfirmarImportacion() {
  const validos = sunat_preview_datos.filter(f => f._ok);
  if (!validos.length) return;

  const btn = document.getElementById('sunat-btn-confirmar');
  btn.disabled = true; btn.textContent = 'Importando…';
  document.getElementById('sunat-progreso').style.display = 'block';

  const tipo      = sunat_tipo_actual;
  const esCompras = tipo === 'COMPRAS';
  const tabla     = esCompras ? 'registro_compras' : 'registro_ventas';
  const onConflict = esCompras
    ? 'empresa_operadora_id,tipo_documento_codigo,serie,numero,ruc_proveedor'
    : 'empresa_operadora_id,serie,numero';

  const { data: lote, error: errLote } = await _supabase
    .from('lotes_importacion').insert({
      empresa_operadora_id: empresa_activa.id,
      nombre_archivo: document.getElementById('sunat-file-input')?.files[0]?.name || 'sunat.xlsx',
      tipo_fuente: esCompras ? 'SUNAT_COMPRAS' : 'SUNAT_VENTAS',
      total_registros: validos.length,
      estado: 'PROCESANDO',
      usuario_id: perfil_usuario?.id || null,
    }).select().single();

  if (errLote) {
    mostrarToast('Error al crear lote: ' + errLote.message, 'error');
    btn.disabled = false; btn.textContent = '✅ Confirmar importación';
    document.getElementById('sunat-progreso').style.display = 'none';
    return;
  }

  const filas = validos.map(f => esCompras ? {
    empresa_operadora_id:  empresa_activa.id,
    lote_importacion_id:   lote.id,
    periodo:               f.periodo,
    fecha_emision:         f.fecha,
    fecha_vencimiento:     f.fecha_vencimiento,
    tipo_documento_codigo: f.tipo_documento_codigo,
    serie:                 f.serie,
    numero:                f.numero,
    ruc_proveedor:         f.ruc_proveedor,
    nombre_proveedor:      f.nombre_proveedor,
    base_imponible:        f.base_imponible || 0,
    igv:                   f.igv || 0,
    total:                 f.importe,
    moneda:                f.moneda,
    tipo_cambio:           f.tipo_cambio || 1,
    tiene_detraccion:      f.tiene_detraccion,
    codigo_detraccion:     f.codigo_detraccion,
    estado:                'EMITIDO',
    usuario_id:            perfil_usuario?.id || null,
  } : {
    empresa_operadora_id:  empresa_activa.id,
    lote_importacion_id:   lote.id,
    periodo:               f.periodo,
    fecha_emision:         f.fecha,
    fecha_vencimiento:     f.fecha_vencimiento,
    tipo_documento_codigo: f.tipo_documento_codigo,
    serie:                 f.serie,
    numero:                f.numero,
    ruc_cliente:           f.ruc_cliente,
    nombre_cliente:        f.nombre_cliente,
    base_imponible:        f.base_imponible || 0,
    igv:                   f.igv || 0,
    total:                 f.importe,
    moneda:                f.moneda,
    tipo_cambio:           f.tipo_cambio || 1,
    estado:                'EMITIDO',
    usuario_id:            perfil_usuario?.id || null,
  });

  let ok = 0, duplicados = 0, errCount = 0, primerError = null;
  const CHUNK = 50;
  const progBar  = document.getElementById('sunat-progreso-barra');
  const progTxt  = document.getElementById('sunat-progreso-texto');

  for (let i = 0; i < filas.length; i += CHUNK) {
    const chunk = filas.slice(i, i + CHUNK);
    const pct   = Math.round(((i + chunk.length) / filas.length) * 100);
    if (progTxt) progTxt.textContent = `Importando ${i + chunk.length} / ${filas.length}…`;
    if (progBar) progBar.style.width = pct + '%';

    const { data: insertados, error } = await _supabase.from(tabla)
      .upsert(chunk, { onConflict, ignoreDuplicates: true }).select('id');

    if (error) { errCount += chunk.length; if (!primerError) primerError = error.message; }
    else { const ins = insertados?.length ?? 0; ok += ins; duplicados += chunk.length - ins; }
  }

  await _supabase.from('lotes_importacion').update({
    estado: errCount === 0 ? 'COMPLETADO' : 'ERROR',
    registros_ok: ok, registros_error: errCount,
  }).eq('id', lote.id);

  if (progBar) progBar.style.width = '100%';
  setTimeout(() => { document.getElementById('sunat-progreso').style.display = 'none'; }, 600);
  btn.disabled = false; btn.textContent = '✅ Confirmar importación';

  if (primerError) mostrarToast(`Error: ${primerError}`, 'error');
  else mostrarToast(`✓ ${ok} importados · ${duplicados} duplicados`, duplicados ? 'atencion' : 'exito');

  _sunatCancelarPreview();
  await _sunatCargarHistorial();

  // Mostrar estado de conciliación
  if (ok > 0) await _sunatMostrarConciliacion(lote.id, tipo);
}

// ── Estado de conciliación bancaria ──────────────────────────────

function _normDocKey(s) {
  return (s || '').toString().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

async function _sunatMostrarConciliacion(loteId, tipo) {
  const wrap = document.getElementById('sunat-conciliacion-wrap');
  const body = document.getElementById('sunat-concil-body');
  if (!wrap || !body) return;

  const esCompras = tipo === 'COMPRAS';
  const tabla = esCompras ? 'registro_compras' : 'registro_ventas';

  // Obtener registros del lote
  const { data: importados } = await _supabase
    .from(tabla)
    .select(esCompras
      ? 'id,fecha_emision,nombre_proveedor,ruc_proveedor,serie,numero,total,moneda,tipo_documento_codigo'
      : 'id,fecha_emision,nombre_cliente,ruc_cliente,serie,numero,total,moneda,tipo_documento_codigo')
    .eq('lote_importacion_id', loteId)
    .order('fecha_emision');

  if (!importados?.length) return;

  // Obtener registros MBD de la empresa para comparar
  const { data: mbdRecs } = await _supabase
    .from('tesoreria_mbd')
    .select('nro_factura_doc')
    .eq('empresa_id', empresa_activa.id)
    .not('nro_factura_doc', 'is', null);

  const mbdKeys = new Set((mbdRecs || []).map(m => _normDocKey(m.nro_factura_doc)));

  let vinculados = 0;
  body.innerHTML = importados.map(r => {
    const cdpNorm = _normDocKey(`${r.serie || ''}${r.numero || ''}`);
    const vinculado = cdpNorm.length > 3 && mbdKeys.has(cdpNorm);
    if (vinculado) vinculados++;

    const entidad = esCompras
      ? `${r.ruc_proveedor || ''} ${r.nombre_proveedor || ''}`.trim()
      : `${r.ruc_cliente || ''} ${r.nombre_cliente || ''}`.trim();
    const ruc = esCompras ? r.ruc_proveedor : r.ruc_cliente;
    const cdp = `${r.serie || ''}${r.numero ? '-' + r.numero : ''}`;

    const estadoBadge = vinculado
      ? '<span class="badge badge-activo">✅ Vinculado</span>'
      : '<span class="badge badge-warning">⏳ Pendiente</span>';

    return `<tr>
      <td style="white-space:nowrap">${formatearFecha(r.fecha_emision)}</td>
      <td class="text-mono text-sm">${escapar(cdp)}</td>
      <td class="text-sm">${escapar((entidad).slice(0, 32))}</td>
      <td class="text-mono text-sm">${escapar(ruc || '—')}</td>
      <td class="text-right" style="font-weight:600">${formatearMoneda(r.total, r.moneda)}</td>
      <td>${escapar(r.moneda || 'PEN')}</td>
      <td>${estadoBadge}</td>
    </tr>`;
  }).join('');

  const pendientes = importados.length - vinculados;
  document.getElementById('sunat-concil-resumen').textContent =
    `✅ ${vinculados} vinculados · ⏳ ${pendientes} pendientes`;

  wrap.style.display = 'block';
  wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Historial ─────────────────────────────────────────────────────

async function _sunatCargarHistorial() {
  const cont = document.getElementById('sunat-historial');
  if (!cont) return;
  const { data } = await _supabase.from('lotes_importacion').select('*')
    .eq('empresa_operadora_id', empresa_activa.id)
    .in('tipo_fuente', ['SUNAT_COMPRAS', 'SUNAT_VENTAS'])
    .order('fecha_creacion', { ascending: false }).limit(10);

  const lista = data || [];
  if (!lista.length) { cont.innerHTML = '<p class="text-center text-muted">Sin historial</p>'; return; }

  cont.innerHTML = `
    <div class="table-wrap">
      <table class="tabla" style="font-size:13px">
        <thead><tr><th>Fecha</th><th>Tipo</th><th>Archivo</th><th>OK</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          ${lista.map(l => `
            <tr>
              <td>${formatearFecha(l.fecha_creacion?.slice(0, 10))}</td>
              <td><span class="badge ${l.tipo_fuente === 'SUNAT_COMPRAS' ? 'badge-critico' : 'badge-activo'}">
                ${l.tipo_fuente === 'SUNAT_COMPRAS' ? '🛒 Compras' : '🏷️ Ventas'}</span></td>
              <td>${escapar(l.nombre_archivo)}</td>
              <td class="text-center">${l.registros_ok}</td>
              <td><span class="badge">${l.estado}</span></td>
              <td>
                <button onclick="_sunatVerConciliacionLote('${l.id}','${l.tipo_fuente}')"
                        class="btn-icono" title="Ver estado de conciliación">🔗</button>
                <button onclick="_sunatEliminarLote('${l.id}',${l.registros_ok},'${l.tipo_fuente}')"
                        class="btn-icono peligro">🗑️</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

async function _sunatVerConciliacionLote(loteId, tipoFuente) {
  const tipo = tipoFuente === 'SUNAT_COMPRAS' ? 'COMPRAS' : 'VENTAS';
  await _sunatMostrarConciliacion(loteId, tipo);
}

async function _sunatEliminarLote(loteId, cantRegistros, tipoFuente) {
  if (!await confirmar('¿Eliminar esta importación y sus registros?',
    { btnOk: 'Eliminar', btnColor: '#C53030' })) return;
  if (cantRegistros > 0) {
    const tabla = tipoFuente === 'SUNAT_COMPRAS' ? 'registro_compras' : 'registro_ventas';
    await _supabase.from(tabla).delete().eq('lote_importacion_id', loteId);
  }
  await _supabase.from('lotes_importacion').delete().eq('id', loteId);
  mostrarToast('Eliminado', 'exito');
  document.getElementById('sunat-conciliacion-wrap').style.display = 'none';
  await _sunatCargarHistorial();
}
