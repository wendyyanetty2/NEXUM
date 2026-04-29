// ═══════════════════════════════════════════════════════════════
// Tesorería — Importar Registros SUNAT (Compras / Ventas)
// ═══════════════════════════════════════════════════════════════

let sunat_preview_datos = [];
let sunat_tipo_actual   = null; // 'COMPRAS' | 'VENTAS'

async function renderTabImportarSunat(area) {
  area.innerHTML = `
    <div class="fadeIn">

      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;margin-bottom:16px">
          <div>
            <h3>📑 Importar Registros SUNAT</h3>
            <p class="text-muted text-sm" style="margin-top:4px">
              Sube el Excel descargado de SUNAT (Registro de Ventas o Compras).
              El tipo se detecta automáticamente desde los encabezados.
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
          ondragover="event.preventDefault();this.style.borderColor='var(--color-primario)';this.style.background='var(--color-fondo-2)'"
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

      <div id="sunat-preview-wrap" style="display:none" class="card" style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
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
                <th>Fecha</th>
                <th>T.Doc</th>
                <th>CDP (Serie-Número)</th>
                <th>Proveedor / Cliente</th>
                <th>Base Impon.</th>
                <th>IGV</th>
                <th>Total</th>
                <th>Mon.</th>
                <th>Val.</th>
              </tr>
            </thead>
            <tbody id="sunat-tbody-preview"></tbody>
          </table>
        </div>
        <div style="display:flex;gap:8px;margin-top:16px">
          <button class="btn btn-secundario" onclick="_sunatCancelarPreview()">Cancelar</button>
          <button class="btn btn-primario" id="sunat-btn-confirmar" onclick="_sunatConfirmarImportacion()">
            ✅ Confirmar importación
          </button>
        </div>
      </div>

      <div id="sunat-progreso" style="display:none" class="card" style="margin-bottom:16px">
        <p id="sunat-progreso-texto" class="text-muted text-sm" style="margin-bottom:8px">Preparando...</p>
        <div style="height:6px;background:var(--color-borde);border-radius:3px;overflow:hidden">
          <div id="sunat-progreso-barra"
               style="height:100%;background:var(--color-primario);width:0;transition:width 0.3s"></div>
        </div>
      </div>

      <div class="card">
        <h3 style="margin-bottom:12px">📜 Historial de importaciones SUNAT</h3>
        <div id="sunat-historial">
          <div class="text-center text-muted text-sm" style="padding:20px">Cargando…</div>
        </div>
      </div>

    </div>`;

  await _sunatCargarHistorial();
}

function _sunatTipoChange() {
  const tipo = document.querySelector('input[name="sunat-tipo"]:checked')?.value;
  sunat_tipo_actual = tipo || null;
  ['compras', 'ventas'].forEach(t => {
    const lbl = document.getElementById('lbl-sunat-' + t);
    if (lbl) lbl.style.borderColor = tipo === t.toUpperCase()
      ? 'var(--color-primario)' : 'var(--color-borde)';
  });
}

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
  reader.onload = (e) => {
    try {
      const wb   = XLSX.read(e.target.result, { type: 'array', cellDates: false });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });

      if (!rows.length) { mostrarToast('El archivo está vacío', 'atencion'); return; }

      const headers = rows[0] || [];
      let tipoDetectado = null;
      if (headers.some(h => (h || '').toString().trim() === 'BI Gravado DG'))  tipoDetectado = 'COMPRAS';
      else if (headers.some(h => (h || '').toString().trim() === 'BI Gravada')) tipoDetectado = 'VENTAS';

      if (tipoDetectado) {
        sunat_tipo_actual = tipoDetectado;
        const radioEl = document.getElementById('sunat-tipo-' + tipoDetectado.toLowerCase());
        if (radioEl) { radioEl.checked = true; _sunatTipoChange(); }
        mostrarToast(`Formato detectado: ${tipoDetectado === 'COMPRAS' ? '🛒 Compras' : '🏷️ Ventas'}`, 'info');
      } else if (!sunat_tipo_actual) {
        mostrarToast('No se pudo detectar el tipo. Selecciona Compras o Ventas manualmente.', 'atencion');
        if (info) info.style.display = 'none';
        return;
      }

      const tipo = sunat_tipo_actual;
      sunat_preview_datos = rows.slice(1)
        .map((r, i) => _sunatMapearFila(r, i, tipo))
        .filter(Boolean);

      if (info) info.textContent = `📂 ${file.name} — ${rows.length} filas leídas`;
      _sunatMostrarPreview(tipo);

    } catch (err) {
      mostrarToast('Error al leer el archivo: ' + err.message, 'error');
      if (info) info.style.display = 'none';
    }
  };
  reader.readAsArrayBuffer(file);
}

function _parsearFechaExcel(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (isNaN(d.getTime())) return null;
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
  }
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return `${val.getUTCFullYear()}-${String(val.getUTCMonth()+1).padStart(2,'0')}-${String(val.getUTCDate()).padStart(2,'0')}`;
  }
  const s = val.toString().trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d2 = new Date(s);
  return isNaN(d2.getTime()) ? null : d2.toISOString().slice(0, 10);
}

function _sunatMoneda(val) {
  if (!val) return 'PEN';
  const s = val.toString().trim().toUpperCase();
  if (['USD', '2', 'US$', '$', 'DO'].includes(s)) return 'USD';
  return 'PEN';
}

function _sunatTipoDocCodigo(val) {
  if (val === null || val === undefined) return null;
  const n = parseInt(val);
  return isNaN(n) ? null : String(n).padStart(2, '0');
}

function _sunatConstruirCDP(serie, nroRaw) {
  const s   = (serie || '').toString().trim();
  const n   = parseInt(nroRaw) || 0;
  return `${s}-${String(n).padStart(8, '0')}`;
}

function _sunatMapearFila(r, idx, tipo) {
  const esCompras = tipo === 'COMPRAS';

  // Sincronizado con plantilla_ventas.json y estructura SUNAT
  const serie  = (r[7]  || '').toString().trim(); // Col H
  const nroRaw = esCompras ? r[9] : r[8];         // Ventas: Col I

  if (!serie && !nroRaw) return null;

  const cdp     = _sunatConstruirCDP(serie, nroRaw);
  const fecha   = _parsearFechaExcel(r[4]);
  const total   = Math.abs(parseFloat(esCompras ? r[24] : r[25]) || 0);

  const _ok    = !!fecha && total > 0;
  const _error = !fecha ? 'Sin fecha' : total === 0 ? 'Total = 0' : null;

  const moneda  = _sunatMoneda(esCompras ? r[25] : r[26]);
  const tipoDoc = _sunatTipoDocCodigo(r[6]);
  
  // RUC en Col K (10) y Nombre en Col L (11) según tu JSON para Ventas
  const rucEntidad = esCompras ? r[12] : r[10]; 
  const nombreEntidad = (r[esCompras ? 13 : 11] || '').toString().trim();

  const base = parseFloat(r[14]) || 0;
  const igv  = parseFloat(r[esCompras ? 15 : 16]) || 0;

  const detraccion = esCompras ? (r[37] ? String(r[37]).trim() : null) : null;
  const numero = nroRaw != null ? String(parseInt(nroRaw) || nroRaw) : null;
  const periodoRaw = (r[2] || '').toString().trim();
  const periodo = /^\d{6}$/.test(periodoRaw)
    ? periodoRaw.slice(0,4) + '-' + periodoRaw.slice(4,6)
    : (fecha ? fecha.slice(0,7) : null);

  return {
    _idx: idx + 2, _ok, _error,
    cdp, entidad: nombreEntidad, fecha,
    naturaleza: tipo === 'COMPRAS' ? 'CARGO' : 'ABONO',
    importe: total, moneda, tipo_documento_codigo: tipoDoc,
    base_imponible: base, igv: igv, tiene_igv: igv > 0,
    tiene_detraccion: !!detraccion, codigo_detraccion: detraccion, tipo,
    serie, numero, ruc: (rucEntidad || '').toString().trim() || null,
    nombre: nombreEntidad, periodo,
    tipo_cambio: parseFloat(r[esCompras ? 26 : 27]) || 1,
    fecha_vencimiento: _parsearFechaExcel(r[5]),
  };
}

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
      <td>${f._ok ? '<span class="badge badge-activo">OK</span>' : '<span class="badge badge-inactivo">Error</span>'}</td>
    </tr>`).join('');

  wrap.style.display = 'block';
}

function _sunatCancelarPreview() {
  sunat_preview_datos = [];
  document.getElementById('sunat-preview-wrap').style.display = 'none';
  document.getElementById('sunat-archivo-info').style.display = 'none';
  document.getElementById('sunat-file-input').value = '';
}

async function _sunatConfirmarImportacion() {
  const validos = sunat_preview_datos.filter(f => f._ok);
  if (!validos.length) return;

  const btn = document.getElementById('sunat-btn-confirmar');
  btn.disabled = true; btn.textContent = 'Importando…';
  document.getElementById('sunat-progreso').style.display = 'block';

  const tipo = sunat_tipo_actual;
  const esCompras = tipo === 'COMPRAS';
  const tabla = esCompras ? 'registro_compras' : 'registro_ventas';
  
  // Sincronización con las restricciones de la base de datos
  const onConflict = esCompras
    ? 'empresa_operadora_id, tipo_documento_codigo, serie, numero, ruc_proveedor'
    : 'empresa_operadora_id, serie, numero'; 

  const { data: lote, error: errLote } = await _supabase
    .from('lotes_importacion').insert({
      empresa_operadora_id: empresa_activa.id,
      nombre_archivo: document.getElementById('sunat-file-input')?.files[0]?.name || 'sunat.xlsx',
      tipo_fuente: esCompras ? 'SUNAT_COMPRAS' : 'SUNAT_VENTAS',
      total_registros: validos.length,
      estado: 'PROCESANDO',
      usuario_id: perfil_usuario?.id || null,
    }).select().single();

  if (errLote) { mostrarToast('Error al crear lote: ' + errLote.message, 'error'); btn.disabled = false; return; }

  const filas = validos.map(f => esCompras ? {
    empresa_operadora_id:  empresa_activa.id,
    lote_importacion_id:   lote.id,
    periodo: f.periodo, fecha_emision: f.fecha,
    tipo_documento_codigo: f.tipo_documento_codigo,
    serie: f.serie, numero: f.numero, ruc_proveedor: f.ruc,
    nombre_proveedor: f.nombre, base_imponible: f.base_imponible || 0,
    igv: f.igv || 0, total: f.importe, moneda: f.moneda,
    tipo_cambio: f.tipo_cambio || 1, estado: 'EMITIDO', usuario_id: perfil_usuario?.id || null,
  } : {
    empresa_operadora_id:  empresa_activa.id,
    lote_importacion_id:   lote.id,
    periodo: f.periodo, fecha_emision: f.fecha,
    tipo_documento_codigo: f.tipo_documento_codigo,
    serie: f.serie, numero: f.numero, ruc_cliente: f.ruc,
    nombre_cliente: f.nombre, base_imponible: f.base_imponible || 0,
    igv: f.igv || 0, total: f.importe, moneda: f.moneda,
    tipo_cambio: f.tipo_cambio || 1, estado: 'EMITIDO', usuario_id: perfil_usuario?.id || null,
  });

  let ok = 0; let duplicados = 0; let errCount = 0; let primerError = null;
  const CHUNK = 50;
  for (let i = 0; i < filas.length; i += CHUNK) {
    const chunk = filas.slice(i, i + CHUNK);
    const { data: insertados, error } = await _supabase.from(tabla)
      .upsert(chunk, { onConflict, ignoreDuplicates: true }).select('id');

    if (error) { errCount += chunk.length; if (!primerError) primerError = error.message; }
    else { const ins = insertados?.length ?? 0; ok += ins; duplicados += chunk.length - ins; }
  }

  await _supabase.from('lotes_importacion').update({
    estado: errCount === 0 ? 'COMPLETADO' : 'ERROR',
    registros_ok: ok, registros_error: errCount,
  }).eq('id', lote.id);

  btn.disabled = false; btn.textContent = '✅ Confirmar importación';
  document.getElementById('sunat-progreso').style.display = 'none';

  if (primerError) mostrarToast(`Error: ${primerError}`, 'error');
  else mostrarToast(`✓ ${ok} importados · ${duplicados} duplicados`, duplicados ? 'atencion' : 'exito');
  
  _sunatCancelarPreview();
  await _sunatCargarHistorial();
}

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
        <thead><tr><th>Fecha</th><th>Tipo</th><th>Archivo</th><th>OK</th><th>Estado</th><th>Acc.</th></tr></thead>
        <tbody>
          ${lista.map(l => `
            <tr>
              <td>${formatearFecha(l.fecha_creacion?.slice(0, 10))}</td>
              <td><span class="badge ${l.tipo_fuente === 'SUNAT_COMPRAS' ? 'badge-critico' : 'badge-activo'}">${l.tipo_fuente === 'SUNAT_COMPRAS' ? '🛒 Compras' : '🏷️ Ventas'}</span></td>
              <td>${escapar(l.nombre_archivo)}</td>
              <td class="text-center">${l.registros_ok}</td>
              <td><span class="badge">${l.estado}</span></td>
              <td><button onclick="_sunatEliminarLote('${l.id}', ${l.registros_ok}, '${l.tipo_fuente}')" class="btn-rojo-mini">🗑️</button></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

async function _sunatEliminarLote(loteId, cantRegistros, tipoFuente) {
  if (!await confirmar('¿Eliminar esta importación?')) return;
  if (cantRegistros > 0) {
    const tabla = tipoFuente === 'SUNAT_COMPRAS' ? 'registro_compras' : 'registro_ventas';
    await _supabase.from(tabla).delete().eq('lote_importacion_id', loteId);
  }
  await _supabase.from('lotes_importacion').delete().eq('id', loteId);
  mostrarToast('Eliminado', 'exito');
  await _sunatCargarHistorial();
}
