// ═══════════════════════════════════════════════════════════════
// Tributaria — Importar SUNAT (Compras / Ventas)
// Tab dedicado con vista previa completa y reporte fila por fila.
// RH mantiene flujo modal separado.
// Usa sunat-parser.js como servicio compartido de parseo.
// ═══════════════════════════════════════════════════════════════

let _tri_import_datos  = [];
let _tri_import_tipo   = null; // 'COMPRAS' | 'VENTAS'
let _tri_import_estado = new Map(); // fila# → 'NUEVO'|'ACTUALIZAR'|'SIN_CAMBIO'

// ── Tab principal ─────────────────────────────────────────────────

async function renderTabImportarSunat(area) {
  _tri_import_datos = [];
  _tri_import_tipo  = null;

  area.innerHTML = `
    <div class="fadeIn">

      <!-- Selector de tipo + Drop zone -->
      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;margin-bottom:16px">
          <div>
            <h3>📊 Importar desde SUNAT</h3>
            <p class="text-muted text-sm" style="margin-top:4px">
              Sube el Excel del PLE SUNAT. El tipo (Compras/Ventas) se detecta automáticamente
              desde los encabezados usando la plantilla JSON como mapa de columnas.
            </p>
          </div>
        </div>

        <div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap">
          <label class="tri-tipo-lbl" id="lbl-tri-compras">
            <input type="radio" name="tri-tipo" value="COMPRAS" id="tri-tipo-compras"
                   onchange="_triImportTipoChange()" style="accent-color:var(--color-primario)">
            🛒 Registro de Compras
          </label>
          <label class="tri-tipo-lbl" id="lbl-tri-ventas">
            <input type="radio" name="tri-tipo" value="VENTAS" id="tri-tipo-ventas"
                   onchange="_triImportTipoChange()" style="accent-color:var(--color-primario)">
            🏷️ Registro de Ventas
          </label>
        </div>

        <div id="tri-drop-zone"
          style="border:2px dashed var(--color-borde);border-radius:var(--radio);
                 padding:40px 20px;text-align:center;cursor:pointer;
                 transition:border-color 0.2s,background 0.2s"
          ondragover="event.preventDefault();this.style.borderColor='var(--color-primario)';this.style.background='var(--color-fondo-2,#f7fafc)'"
          ondragleave="this.style.borderColor='var(--color-borde)';this.style.background=''"
          ondrop="_triImportDrop(event)"
          onclick="document.getElementById('tri-file-input').click()">
          <div style="font-size:36px;margin-bottom:8px">📊</div>
          <p style="font-weight:500;margin-bottom:4px">Arrastra el Excel SUNAT aquí</p>
          <p class="text-muted text-sm">o haz clic para seleccionar (.xlsx / .xls)</p>
          <input type="file" id="tri-file-input" accept=".xlsx,.xls"
                 style="display:none" onchange="_triImportHandleFile(this.files[0])">
        </div>

        <div id="tri-archivo-info" style="display:none;margin-top:12px" class="alerta-info"></div>
      </div>

      <!-- Vista previa (aparece tras cargar archivo) -->
      <div id="tri-preview-section" style="display:none" class="card" style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;
                    margin-bottom:12px;flex-wrap:wrap;gap:8px">
          <div style="display:flex;align-items:center;gap:8px">
            <h3>👁️ Vista previa</h3>
            <span id="tri-preview-tipo-badge" class="badge"></span>
          </div>
          <div id="tri-preview-resumen" class="text-sm text-muted"></div>
        </div>

        <div class="table-wrap" style="max-height:420px;overflow-y:auto">
          <table class="tabla" style="font-size:12px">
            <thead><tr id="tri-preview-head"></tr></thead>
            <tbody id="tri-preview-body"></tbody>
          </table>
        </div>

        <div style="display:flex;gap:10px;margin-top:16px;align-items:center;flex-wrap:wrap">
          <button class="btn btn-secundario" onclick="_triImportCancelar()">✕ Cancelar</button>
          <button class="btn btn-primario" id="tri-btn-confirmar" onclick="_triImportConfirmar()">
            ✅ Confirmar importación
          </button>
          <span id="tri-preview-ok-count" class="text-sm text-muted"></span>
        </div>
      </div>

      <!-- Barra de progreso -->
      <div id="tri-progreso" style="display:none" class="card" style="margin-bottom:16px">
        <p id="tri-progreso-texto" class="text-muted text-sm" style="margin-bottom:8px">Importando…</p>
        <div style="height:6px;background:var(--color-borde);border-radius:3px;overflow:hidden">
          <div id="tri-progreso-barra"
               style="height:100%;background:var(--color-primario);width:0;transition:width 0.3s"></div>
        </div>
      </div>

      <!-- Detalle de errores (aparece tras importar si hay filas inválidas) -->
      <div id="tri-errores-section" style="display:none" class="card">
        <h3 style="margin-bottom:12px">⚠️ Filas omitidas por errores</h3>
        <div class="table-wrap">
          <table class="tabla" style="font-size:12px">
            <thead><tr>
              <th>Fila</th><th>CDP (Serie-Número)</th>
              <th>RUC / Nombre</th><th>Motivo del error</th>
            </tr></thead>
            <tbody id="tri-errores-body"></tbody>
          </table>
        </div>
      </div>

    </div>

    <style>
    .tri-tipo-lbl {
      display:flex; align-items:center; gap:8px; cursor:pointer;
      padding:10px 16px; border:2px solid var(--color-borde);
      border-radius:var(--radio); font-size:13px; transition:all 0.2s;
    }
    .tri-tipo-lbl.activo {
      border-color:var(--color-primario);
      background:var(--color-primario-suave,rgba(49,130,206,.08));
    }
    </style>`;
}

// ── Control del tipo seleccionado ─────────────────────────────────

function _triImportTipoChange() {
  const tipo = document.querySelector('input[name="tri-tipo"]:checked')?.value;
  _tri_import_tipo = tipo || null;
  ['compras','ventas'].forEach(t => {
    document.getElementById('lbl-tri-' + t)?.classList.toggle('activo', tipo === t.toUpperCase());
  });
}

// ── Manejo de archivo ─────────────────────────────────────────────

function _triImportDrop(e) {
  e.preventDefault();
  const dz = document.getElementById('tri-drop-zone');
  if (dz) { dz.style.borderColor = 'var(--color-borde)'; dz.style.background = ''; }
  const file = e.dataTransfer?.files?.[0];
  if (!file || !file.name.match(/\.(xlsx|xls)$/i)) {
    mostrarToast('Solo se aceptan archivos .xlsx o .xls', 'atencion');
    return;
  }
  _triImportHandleFile(file);
}

function _triImportHandleFile(file) {
  if (!file) return;
  const info = document.getElementById('tri-archivo-info');
  if (info) { info.style.display = 'block'; info.textContent = `📂 ${file.name} — leyendo…`; }

  const reader = new FileReader();
  reader.onload = async ev => {
    try {
      const resultado = sunat_parsear_buffer(ev.target.result, _tri_import_tipo);

      if (!resultado.tipo) {
        mostrarToast(
          'No se detectó el tipo. Selecciona Compras o Ventas manualmente y vuelve a cargar.',
          'atencion'
        );
        if (info) info.style.display = 'none';
        return;
      }

      _tri_import_tipo   = resultado.tipo;
      _tri_import_datos  = resultado.filas;
      _tri_import_estado = new Map();

      // Sincronizar radio
      const radio = document.getElementById('tri-tipo-' + resultado.tipo.toLowerCase());
      if (radio) { radio.checked = true; _triImportTipoChange(); }

      if (info) info.textContent = `📂 ${file.name} — verificando duplicados…`;
      mostrarToast(
        `Detectado: ${resultado.tipo === 'COMPRAS' ? '🛒 Compras' : '🏷️ Ventas'}`,
        'info'
      );

      // Clasificar vs BD antes de mostrar preview (igual que Contabilidad)
      await _triImportClasificar();
      if (info) info.textContent = `📂 ${file.name} — ${resultado.totalFilas} filas leídas`;
      _triImportMostrarPreview();

    } catch (err) {
      mostrarToast('Error al leer el archivo: ' + err.message, 'error');
      if (info) info.style.display = 'none';
    }
  };
  reader.readAsArrayBuffer(file);
}

// ── Clasificar filas vs BD (patrón Contabilidad) ──────────────────

async function _triImportClasificar() {
  const validos = _tri_import_datos.filter(f => f._ok);
  if (!validos.length) return;

  const esCompras = _tri_import_tipo === 'COMPRAS';
  const tabla     = esCompras ? 'registro_compras' : 'registro_ventas';
  const periodos  = [...new Set(validos.map(f => f.periodo).filter(Boolean))];

  // Consultar registros existentes para los mismos períodos
  let query = _supabase.from(tabla)
    .select('serie,numero,total')
    .eq('empresa_operadora_id', empresa_activa.id);
  if (periodos.length) query = query.in('periodo', periodos);
  const { data: ex } = await query;

  const mapExist = new Map((ex || []).map(r => [
    `${r.serie}-${r.numero}`, Number(r.total || 0)
  ]));

  // Clasificar cada fila válida
  _tri_import_estado = new Map();
  validos.forEach(f => {
    const clave = `${f.serie}-${f.numero}`;
    const exT   = mapExist.get(clave);
    let estado;
    if (exT === undefined) estado = 'NUEVO';
    else if (Math.abs(exT - (f.total || 0)) > 0.01) estado = 'ACTUALIZAR';
    else estado = 'SIN_CAMBIO';
    _tri_import_estado.set(f._fila, estado);
  });
}

// ── Vista previa completa ─────────────────────────────────────────

function _triImportMostrarPreview() {
  const section = document.getElementById('tri-preview-section');
  const thead   = document.getElementById('tri-preview-head');
  const tbody   = document.getElementById('tri-preview-body');
  if (!section || !thead || !tbody) return;

  const esCompras = _tri_import_tipo === 'COMPRAS';
  const validos   = _tri_import_datos.filter(f => f._ok).length;
  const errores   = _tri_import_datos.length - validos;

  document.getElementById('tri-preview-resumen').textContent =
    `🟢 ${nuevos} nuevos · 🔵 ${actualizar} a actualizar · ⚪ ${sinCambios} sin cambios · ⚠️ ${errores} errores`;
  document.getElementById('tri-preview-ok-count').textContent =
    `Se importarán ${nuevos + actualizar} registros (${sinCambios} ya existen sin cambios)`;

  const badge = document.getElementById('tri-preview-tipo-badge');
  if (badge) {
    badge.textContent = esCompras ? '🛒 Compras' : '🏷️ Ventas';
    badge.className   = `badge ${esCompras ? 'badge-critico' : 'badge-activo'}`;
  }

  const nuevos      = [..._tri_import_estado.values()].filter(v => v === 'NUEVO').length;
  const actualizar  = [..._tri_import_estado.values()].filter(v => v === 'ACTUALIZAR').length;
  const sinCambios  = [..._tri_import_estado.values()].filter(v => v === 'SIN_CAMBIO').length;

  thead.innerHTML = `
    <th>Fila</th><th>Fecha</th><th>T.Doc</th><th>CDP</th><th>RUC</th>
    <th>${esCompras ? 'Proveedor' : 'Cliente'}</th>
    <th class="text-right">Base Imp.</th><th class="text-right">IGV</th>
    <th class="text-right">Total</th><th>Estado BD</th>`;

  tbody.innerHTML = _tri_import_datos.map(f => {
    const entidad = esCompras ? f.nombre_proveedor : f.nombre_cliente;
    const ruc     = esCompras ? f.ruc_proveedor    : f.ruc_cliente;
    const bdEstado = _tri_import_estado.get(f._fila);
    let estadoBadge;
    if (!f._ok) {
      estadoBadge = `<span class="badge badge-inactivo" style="font-size:10px"
        title="${escapar((f._errores||[]).join(' · '))}">Error</span>`;
    } else if (bdEstado === 'NUEVO') {
      estadoBadge = '<span style="font-size:10px;background:#2F855A;color:#fff;padding:2px 6px;border-radius:8px">NUEVO</span>';
    } else if (bdEstado === 'ACTUALIZAR') {
      estadoBadge = '<span style="font-size:10px;background:#2C5282;color:#fff;padding:2px 6px;border-radius:8px">ACTUALIZAR</span>';
    } else {
      estadoBadge = '<span style="font-size:10px;background:#4A5568;color:#fff;padding:2px 6px;border-radius:8px">SIN CAMBIO</span>';
    }
    return `<tr ${!f._ok ? 'style="background:rgba(197,48,48,.05)"' : ''}>
      <td class="text-mono text-sm">${f._fila}</td>
      <td style="white-space:nowrap">${f.fecha || '—'}</td>
      <td class="text-mono text-sm">${escapar(f.tipo_documento_codigo || '—')}</td>
      <td class="text-mono text-sm">${escapar(f.cdp || '—')}</td>
      <td class="text-mono text-sm">${escapar(ruc || '—')}</td>
      <td class="text-sm">${escapar((entidad || '—').slice(0, 28))}</td>
      <td class="text-right">${f.base_imponible ? formatearMoneda(f.base_imponible, f.moneda) : '—'}</td>
      <td class="text-right">${f.igv ? formatearMoneda(f.igv, f.moneda) : '—'}</td>
      <td class="text-right" style="font-weight:600">${formatearMoneda(f.total, f.moneda)}</td>
      <td>${estadoBadge}</td>
    </tr>`;
  }).join('');

  const btn = document.getElementById('tri-btn-confirmar');
  if (btn) btn.disabled = validos === 0;

  section.style.display = 'block';
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function _triImportCancelar() {
  _tri_import_datos  = [];
  _tri_import_tipo   = null;
  _tri_import_estado = new Map();
  ['tri-preview-section', 'tri-errores-section'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const info = document.getElementById('tri-archivo-info');
  if (info) info.style.display = 'none';
  const inp = document.getElementById('tri-file-input');
  if (inp) inp.value = '';
  document.querySelectorAll('input[name="tri-tipo"]').forEach(r => r.checked = false);
  ['compras','ventas'].forEach(t => document.getElementById('lbl-tri-'+t)?.classList.remove('activo'));
}

// ── Confirmar importación (patrón Contabilidad: SELECT→INSERT+UPDATE) ──

async function _triImportConfirmar() {
  const validos = _tri_import_datos.filter(f => f._ok);
  if (!validos.length) return;

  const btn = document.getElementById('tri-btn-confirmar');
  btn.disabled = true; btn.textContent = 'Importando…';

  const progreso = document.getElementById('tri-progreso');
  const progTxt  = document.getElementById('tri-progreso-texto');
  const progBar  = document.getElementById('tri-progreso-barra');
  if (progreso) progreso.style.display = 'block';

  const esCompras = _tri_import_tipo === 'COMPRAS';
  const tabla     = esCompras ? 'registro_compras' : 'registro_ventas';

  // ── 1. Usar clasificación ya calculada (o recalcular si no existe) ──
  if (_tri_import_estado.size === 0) await _triImportClasificar();

  const aNuevos     = validos.filter(f => _tri_import_estado.get(f._fila) === 'NUEVO');
  const aActualizar = validos.filter(f => _tri_import_estado.get(f._fila) === 'ACTUALIZAR');
  const aSinCambio  = validos.filter(f => _tri_import_estado.get(f._fila) === 'SIN_CAMBIO');

  // ── 2. Construir payload por tipo ─────────────────────────────────
  const buildRow = f => esCompras ? {
    empresa_operadora_id:  empresa_activa.id,
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
    total:                 f.total,
    moneda:                f.moneda || 'PEN',
    tipo_cambio:           f.tipo_cambio || 1,
    codigo_detraccion:     f.codigo_detraccion,
    tiene_detraccion:      f.tiene_detraccion,
    estado:                'EMITIDO',
    usuario_id:            perfil_usuario?.id || null,
  } : {
    empresa_operadora_id:  empresa_activa.id,
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
    total:                 f.total,
    moneda:                f.moneda || 'PEN',
    tipo_cambio:           f.tipo_cambio || 1,
    estado:                'EMITIDO',
    usuario_id:            perfil_usuario?.id || null,
  };

  let ok = 0, actualizados = 0, errTecnico = 0;
  const CHUNK = 50;

  // ── 3. Insertar nuevos en lotes ────────────────────────────────────
  if (aNuevos.length) {
    if (progTxt) progTxt.textContent = `Insertando ${aNuevos.length} nuevos…`;
    if (progBar) progBar.style.width = '30%';
    for (let i = 0; i < aNuevos.length; i += CHUNK) {
      const chunk = aNuevos.slice(i, i + CHUNK).map(buildRow);
      const { error } = await _supabase.from(tabla).insert(chunk);
      if (error) { errTecnico += chunk.length; }
      else { ok += chunk.length; }
    }
  }

  // ── 4. Actualizar registros cambiados ─────────────────────────────
  if (aActualizar.length) {
    if (progTxt) progTxt.textContent = `Actualizando ${aActualizar.length} cambiados…`;
    if (progBar) progBar.style.width = '70%';
    for (const f of aActualizar) {
      const { error } = await _supabase.from(tabla)
        .update(buildRow(f))
        .eq('empresa_operadora_id', empresa_activa.id)
        .eq('serie', f.serie)
        .eq('numero', f.numero);
      if (error) errTecnico++;
      else actualizados++;
    }
  }

  if (progBar) progBar.style.width = '100%';
  setTimeout(() => { if (progreso) progreso.style.display = 'none'; }, 700);
  btn.disabled = false; btn.textContent = '✅ Confirmar importación';

  // ── Tabla de filas con errores de validación ──────────────────────
  const errRows    = _tri_import_datos.filter(f => !f._ok);
  const errSection = document.getElementById('tri-errores-section');
  const errBody    = document.getElementById('tri-errores-body');
  if (errSection && errBody && errRows.length) {
    errBody.innerHTML = errRows.map(f => {
      const entidad = _tri_import_tipo === 'COMPRAS' ? f.nombre_proveedor : f.nombre_cliente;
      const ruc     = _tri_import_tipo === 'COMPRAS' ? f.ruc_proveedor    : f.ruc_cliente;
      return `<tr>
        <td class="text-mono text-sm">${f._fila}</td>
        <td class="text-mono text-sm">${escapar(f.cdp || '—')}</td>
        <td class="text-sm">${escapar(ruc || '')} ${escapar((entidad || '').slice(0, 30))}</td>
        <td class="text-sm" style="color:#C53030">${f._errores.join(' · ')}</td>
      </tr>`;
    }).join('');
    errSection.style.display = 'block';
  }

  // ── Toast con resumen ─────────────────────────────────────────────
  const partes = [];
  if (ok > 0)          partes.push(`✓ ${ok} nuevos`);
  if (actualizados > 0) partes.push(`${actualizados} actualizados`);
  if (aSinCambio.length > 0) partes.push(`${aSinCambio.length} sin cambios`);
  if (errTecnico > 0)  partes.push(`${errTecnico} errores`);
  mostrarToast(partes.join(' · ') || 'Sin cambios', errTecnico > 0 ? 'atencion' : 'exito');

  // Refrescar tabla destino
  if (esCompras && typeof cargarCompras === 'function') cargarCompras();
  if (!esCompras && typeof cargarVentas  === 'function') cargarVentas();

  const pre = document.getElementById('tri-preview-section');
  if (pre) pre.style.display = 'none';
  _tri_import_estado = new Map();
}

// ── Accesos directos desde botones de compras/ventas ─────────────
// Los botones "📊 Importar SUNAT" en los tabs de compras y ventas
// redirigen al tab dedicado de importación.

function importarRegistroComprasSUNAT() {
  activarTab('importar');
  setTimeout(() => {
    const radio = document.getElementById('tri-tipo-compras');
    if (radio) { radio.checked = true; _triImportTipoChange(); }
  }, 120);
}

function importarRegistroVentasSUNAT() {
  activarTab('importar');
  setTimeout(() => {
    const radio = document.getElementById('tri-tipo-ventas');
    if (radio) { radio.checked = true; _triImportTipoChange(); }
  }, 120);
}

// ═══════════════════════════════════════════════════════════════
// Registro de Honorarios (RH) — mantiene flujo modal separado
// ═══════════════════════════════════════════════════════════════

let _sunat_preview_data   = [];
let _sunat_preview_tipo   = null;
let _sunat_preview_nombre = null;

function importarRegistroRHSUNAT() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.xlsx,.xls';
  inp.onchange = e => {
    const f = e.target.files[0];
    if (f) {
      const r = new FileReader();
      r.onload = ev => _procesarRHSUNAT(ev.target.result, f.name);
      r.readAsArrayBuffer(f);
    }
  };
  inp.click();
}

// Formato RH:
//  [0]FecEmision [1]TipoDoc [2]NroDoc [3]EstadoDoc
//  [4]TipoDocEmisor [5]NroDocEmisor(RUC/DNI) [6]ApellidosRazSoc
//  [7]TipoRenta [8]Gratuito [9]Descripcion [10]Observacion
//  [11]Moneda [12]RentaBruta [13]ImpRenta [14]RentaNeta [15]MontoPendPago

function _procesarRHSUNAT(buffer, nombre) {
  try {
    const wb   = XLSX.read(buffer, { type: 'array', cellDates: false });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    const data   = rows.slice(1).filter(r => r[0] !== '' || r[12] !== '');
    const parsed = data.map((r, i) => {
      const fecha   = sunat_fecha(r[0]);
      const estadoR = (r[3] || '').toString().trim().toUpperCase();
      const monedaR = (r[11]|| '').toString().trim().toUpperCase();
      const bruto   = sunat_num(r[12]);
      const reten   = sunat_num(r[13]);
      return {
        _fila:             i + 2,
        fecha,
        periodo:           fecha ? fecha.slice(0, 7) : null,
        numero_rh:         (r[2] || '').toString().trim() || null,
        estado:            estadoR.includes('ANULADO') && !estadoR.startsWith('NO') ? 'ANULADO' : 'EMITIDO',
        ruc_dni_prestador: (r[5] || '').toString().trim() || null,
        nombre_prestador:  (r[6] || '').toString().trim().replace(/\s+/g, ' ') || null,
        concepto:          (r[9] || '').toString().trim() || 'SERVICIO',
        observaciones:     (r[10]|| '').toString().trim() || null,
        moneda:            monedaR === 'SOLES' || monedaR === 'PEN' ? 'PEN'
                         : monedaR === 'DOLARES' || monedaR === 'USD' ? 'USD' : 'PEN',
        monto_bruto:       bruto,
        monto_retencion:   reten,
        monto_neto:        sunat_num(r[14]),
        tiene_retencion:   reten > 0,
        porcentaje_retencion: bruto > 0 ? Math.round(reten / bruto * 10000) / 100 : 0,
        _ok:               !!fecha && bruto > 0,
        _errores:          (!fecha ? ['Sin fecha'] : []).concat(bruto === 0 ? ['Monto bruto = 0'] : []),
      };
    });

    _mostrarPreviewSUNAT(parsed, 'rh', nombre);
  } catch (err) { mostrarToast('Error al leer archivo: ' + err.message, 'error'); }
}

function _mostrarPreviewSUNAT(datos, tipo, nombre) {
  _sunat_preview_data   = datos;
  _sunat_preview_tipo   = tipo;
  _sunat_preview_nombre = nombre;

  const validos = datos.filter(d => d._ok).length;
  const errores = datos.length - validos;
  const muestra = datos.slice(0, 8);

  const th = '<th>Fecha</th><th>N° RH</th><th>RUC/DNI</th><th>Prestador</th><th>Bruto</th><th>Retención</th><th>Neto</th><th></th>';
  const td = muestra.map(r => `
    <tr ${!r._ok ? 'style="background:var(--color-danger-bg,#fff5f5)"' : ''}>
      <td>${r.fecha || '—'}</td>
      <td class="text-mono text-sm">${escapar(r.numero_rh || '—')}</td>
      <td class="text-mono text-sm">${escapar(r.ruc_dni_prestador || '—')}</td>
      <td class="text-sm">${escapar((r.nombre_prestador || '—').slice(0, 30))}</td>
      <td class="text-right">${formatearMoneda(r.monto_bruto)}</td>
      <td class="text-right">${formatearMoneda(r.monto_retencion)}</td>
      <td class="text-right" style="font-weight:600">${formatearMoneda(r.monto_neto)}</td>
      <td>${r._ok ? '<span class="badge badge-activo" style="font-size:10px">OK</span>'
                  : '<span class="badge badge-inactivo" style="font-size:10px">Err</span>'}</td>
    </tr>`).join('');

  document.getElementById('modal-sunat-import')?.remove();
  const m = document.createElement('div');
  m.className = 'modal-overlay';
  m.id = 'modal-sunat-import';
  m.style.display = 'flex';
  m.innerHTML = `
    <div class="modal" style="max-width:860px;width:95vw">
      <div class="modal-header">
        <h3>📋 Importar Registro de RH (SUNAT)</h3>
        <button class="modal-cerrar" onclick="document.getElementById('modal-sunat-import').remove()">✕</button>
      </div>
      <div class="modal-body">
        <div style="padding:10px 14px;background:var(--color-fondo-2);border-radius:var(--radio);margin-bottom:14px;font-size:13px">
          📂 <strong>${escapar(nombre)}</strong> —
          ${datos.length} filas leídas &nbsp;·&nbsp;
          <span class="text-verde">✅ ${validos} válidas</span>
          ${errores ? `&nbsp;·&nbsp;<span class="text-rojo">⚠️ ${errores} errores (se omitirán)</span>` : ''}
          <br><span class="text-muted" style="font-size:12px">
            ℹ Prestadores nuevos se crearán automáticamente en Prestadores de Servicios.
          </span>
        </div>
        <div class="table-wrap" style="max-height:360px;overflow-y:auto">
          <table class="tabla" style="font-size:12px">
            <thead><tr>${th}</tr></thead>
            <tbody>${td}${datos.length > 8 ? `<tr><td colspan="8" class="text-center text-muted text-sm" style="padding:8px">…y ${datos.length - 8} filas más</td></tr>` : ''}</tbody>
          </table>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secundario" onclick="document.getElementById('modal-sunat-import').remove()">Cancelar</button>
        <button class="btn btn-primario" id="btn-confirmar-sunat"
                onclick="_confirmarImportSUNAT()" ${validos === 0 ? 'disabled' : ''}>
          ✅ Importar ${validos} registros
        </button>
      </div>
    </div>`;
  document.body.appendChild(m);
}

async function _confirmarImportSUNAT() {
  const validos = _sunat_preview_data.filter(d => d._ok);
  if (!validos.length) return;
  const btn = document.getElementById('btn-confirmar-sunat');
  if (btn) { btn.disabled = true; btn.textContent = 'Importando…'; }

  let ok = 0, errCount = 0;

  for (const r of validos) {
    if (!r.ruc_dni_prestador) { errCount++; continue; }
    let { data: ps } = await _supabase
      .from('prestadores_servicios').select('id')
      .eq('dni', r.ruc_dni_prestador).maybeSingle();

    if (!ps) {
      const { data: nuevo, error: errPS } = await _supabase
        .from('prestadores_servicios').insert({
          dni:    r.ruc_dni_prestador,
          nombre: r.nombre_prestador || r.ruc_dni_prestador,
          ruc:    r.ruc_dni_prestador.length === 11 ? r.ruc_dni_prestador : null,
          activo: true,
        }).select().single();
      if (errPS) { errCount++; continue; }
      ps = nuevo;
    }

    const { error } = await _supabase.from('rh_registros').insert({
      empresa_operadora_id: empresa_activa.id,
      prestador_id:         ps.id,
      periodo:              r.periodo,
      fecha_emision:        r.fecha,
      numero_rh:            r.numero_rh,
      concepto:             r.concepto || 'SERVICIO',
      monto_bruto:          r.monto_bruto,
      tiene_retencion:      r.tiene_retencion,
      porcentaje_retencion: r.porcentaje_retencion,
      monto_retencion:      r.monto_retencion,
      monto_neto:           r.monto_neto,
      estado:               r.estado,
      observaciones:        r.observaciones,
      usuario_id:           perfil_usuario?.id || null,
    });
    if (error) errCount++; else ok++;
  }

  document.getElementById('modal-sunat-import')?.remove();
  const duplicados = validos.length - ok - errCount;
  const msg = `✓ ${ok} importados`
    + (duplicados > 0 ? ` · ${duplicados} ya existían` : '')
    + (errCount   > 0 ? ` · ${errCount} errores`       : '');
  mostrarToast(msg, errCount > 0 ? 'atencion' : 'exito');
  if (typeof cargarRH === 'function') await cargarRH();
}
