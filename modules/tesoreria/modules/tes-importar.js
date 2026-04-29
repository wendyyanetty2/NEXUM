// ═══════════════════════════════════════════════════════════════
// Tesorería — Importar EECC desde Excel
// ═══════════════════════════════════════════════════════════════

async function renderTabImportar(area) {
  area.innerHTML = `
    <div class="fadeIn">
      <div class="grid-2" style="gap:16px;align-items:start">

        <!-- Panel de importación -->
        <div class="card">
          <h3 style="margin-bottom:4px">⬆️ Importar estado de cuenta</h3>
          <p class="text-muted text-sm" style="margin-bottom:20px">
            Sube un archivo Excel con los movimientos del banco.
            Descarga la plantilla para ver el formato requerido.
          </p>

          <div class="campo">
            <label>Cuenta bancaria destino <span class="req">*</span></label>
            <select id="imp-cuenta" class="w-full"></select>
          </div>
          <div class="campo">
            <label>Banco / Fuente</label>
            <select id="imp-fuente" class="w-full">
              <option value="BCP">BCP</option>
              <option value="BBVA">BBVA</option>
              <option value="INTERBANK">Interbank</option>
              <option value="SCOTIABANK">Scotiabank</option>
              <option value="MANUAL">Manual / Otro</option>
            </select>
          </div>
          <div class="campo">
            <label>Archivo Excel <span class="req">*</span></label>
            <input type="file" id="imp-archivo" accept=".xlsx,.xls,.csv"
                   style="padding:8px;border:2px dashed var(--color-borde);border-radius:var(--radio);width:100%;box-sizing:border-box;cursor:pointer">
          </div>

          <div style="display:flex;gap:8px;margin-top:8px">
            <button class="btn btn-secundario btn-sm" onclick="descargarPlantilla()">📥 Plantilla Excel</button>
            <button class="btn btn-primario" onclick="procesarImportacion()" id="btn-importar">
              ⬆️ Importar
            </button>
          </div>
        </div>

        <!-- Panel de instrucciones -->
        <div class="card">
          <h3 style="margin-bottom:12px">📋 Formato requerido</h3>
          <p class="text-muted text-sm" style="margin-bottom:12px">
            Soporta 2 formatos automáticamente:
          </p>
          <div class="table-wrap">
            <table class="tabla" style="font-size:11px">
              <thead><tr><th colspan="3" style="background:#EBF8FF;color:#2B6CB0">Formato BCP (EECC convertido de PDF)</th></tr>
              <tr><th>Columna</th><th>Ejemplo</th><th>Notas</th></tr></thead>
              <tbody>
                <tr><td><code>Fecha</code></td><td>02/01/2026</td><td>DD/MM/YYYY</td></tr>
                <tr><td><code>Descripcion</code></td><td>TRAN.CTAS.TERC.BM</td><td></td></tr>
                <tr><td><code>Moneda</code></td><td>S/ o $</td><td>S/ = PEN, $ = USD</td></tr>
                <tr><td><code>Monto</code></td><td>-1500 / 5000</td><td>Negativo=CARGO, Positivo=ABONO</td></tr>
                <tr><td><code>Numero de Operacion</code></td><td>790418</td><td></td></tr>
              </tbody>
              <thead><tr><th colspan="3" style="background:#F0FFF4;color:#276749">Formato NEXUM (plantilla propia)</th></tr>
              <tr><th>Columna</th><th>Ejemplo</th><th>¿Requerida?</th></tr></thead>
              <tbody>
                <tr><td><code>fecha</code></td><td>2026-04-15</td><td>✅</td></tr>
                <tr><td><code>naturaleza</code></td><td>CARGO o ABONO</td><td>✅</td></tr>
                <tr><td><code>importe</code></td><td>1500.00</td><td>✅</td></tr>
                <tr><td><code>descripcion</code></td><td>PAGO PROVEEDOR</td><td></td></tr>
                <tr><td><code>numero_operacion</code></td><td>0012345</td><td></td></tr>
              </tbody>
            </table>
          </div>
          <p class="text-muted text-sm" style="margin-top:10px">
            💡 Para EECC del BCP: usa la hoja <code>ESTADO_CUENTA</code>. El sistema detecta el formato automáticamente.
          </p>
        </div>
      </div>

      <!-- Preview de datos -->
      <div id="imp-preview" style="display:none" class="card" style="margin-top:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <h3>👁️ Vista previa — <span id="imp-preview-count">0</span> registros</h3>
          <div id="imp-preview-resumen" class="text-sm text-muted"></div>
        </div>
        <div class="table-wrap" style="max-height:300px;overflow-y:auto">
          <table class="tabla" id="tabla-preview">
            <thead><tr><th>#</th><th>Fecha</th><th>Naturaleza</th><th>Importe</th><th>Descripción</th><th>Nro Op.</th><th>Estado</th></tr></thead>
            <tbody id="tbody-preview"></tbody>
          </table>
        </div>
        <div style="margin-top:16px;display:flex;gap:8px">
          <button class="btn btn-secundario" onclick="cancelarPreview()">Cancelar</button>
          <button class="btn btn-primario" onclick="confirmarImportacion()" id="btn-confirmar-imp">
            ✅ Confirmar e importar
          </button>
        </div>
      </div>

      <!-- Validación cruzada EECC vs Movimientos -->
      <div id="imp-validacion" class="card" style="display:none;margin-top:16px"></div>

      <!-- Historial de importaciones -->
      <div class="card" style="margin-top:16px">
        <h3 style="margin-bottom:12px">📜 Historial de importaciones</h3>
        <div id="historial-importaciones">
          <div class="text-center text-muted text-sm" style="padding:20px">Cargando…</div>
        </div>
      </div>
    </div>`;

  await Promise.all([_cargarCuentasImp(), cargarHistorialImportaciones()]);
}

async function _cargarCuentasImp() {
  const { data } = await _supabase
    .from('cuentas_bancarias')
    .select('id, nombre_alias, moneda')
    .eq('empresa_operadora_id', empresa_activa.id)
    .eq('activo', true)
    .order('nombre_alias');
  const sel = document.getElementById('imp-cuenta');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Seleccionar cuenta —</option>' +
    (data || []).map(c => `<option value="${c.id}">${escapar(c.nombre_alias)} (${c.moneda})</option>`).join('');
}

let imp_datos_preview    = [];
let imp_movs_validacion  = [];

function descargarPlantilla() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['fecha', 'naturaleza', 'importe', 'descripcion', 'numero_operacion', 'moneda'],
    ['2026-04-15', 'CARGO', '1500.00', 'PAGO PROVEEDOR ABC', '0012345', 'PEN'],
    ['2026-04-16', 'ABONO', '5000.00', 'COBRO CLIENTE XYZ', '0098765', 'PEN'],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');
  XLSX.writeFile(wb, 'plantilla_EECC_NEXUM.xlsx');
}

function procesarImportacion() {
  const cuenta  = document.getElementById('imp-cuenta')?.value;
  const archivo = document.getElementById('imp-archivo')?.files[0];
  if (!cuenta)  { mostrarToast('Selecciona una cuenta bancaria', 'atencion'); return; }
  if (!archivo) { mostrarToast('Selecciona un archivo Excel', 'atencion'); return; }

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array', cellDates: false });

      // Detectar hoja: preferir ESTADO_CUENTA (formato BCP), si no la primera
      const wsName = wb.SheetNames.find(n => n.trim().toUpperCase() === 'ESTADO_CUENTA')
                     || wb.SheetNames[0];
      const ws   = wb.Sheets[wsName];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (!rows.length) { mostrarToast('El archivo está vacío', 'atencion'); return; }

      // Auto-detectar formato BCP
      // Soporta EECC con columnas estándar ("Fecha", "Monto") y el formato
      // exportado donde la fecha aparece como "Columna1" y el nro de op como "Numero de Operacion2"
      const primeraFila = rows[0] || {};
      const esBCP = (('Monto' in primeraFila || 'monto' in primeraFila) &&
                     ('Descripcion' in primeraFila || 'descripcion' in primeraFila) &&
                     !('naturaleza' in primeraFila) && !('Naturaleza' in primeraFila))
                    || 'Columna1' in primeraFila;

      const _monedaBCP = (v) => {
        const s = (v || '').toString().trim();
        if (s === 'S/' || s === 'S/.' || s === 'PEN') return 'PEN';
        if (s === '$' || s === 'USD' || s === 'US$') return 'USD';
        if (s === '€' || s === 'EUR') return 'EUR';
        return 'PEN';
      };

      imp_datos_preview = rows.map((r, i) => {
        let fecha, nat, imp, desc, nro_op, moneda;

        if (esBCP) {
          // Formato BCP: acepta "Fecha" clásico y "Columna1" del EECC exportado
          fecha   = _parsearFecha(r['Fecha'] || r['fecha'] || r['Columna1'] || '');
          const m = parseFloat(r['Monto'] || r['monto'] || 0);
          imp     = Math.abs(m);
          nat     = m < 0 ? 'CARGO' : 'ABONO';
          desc    = (r['Descripcion'] || r['descripcion'] || r['Columna2'] || '').toString().trim();
          // "Numero de Operacion2" es el nombre real en el EECC BCP exportado
          nro_op  = (r['Numero de Operacion'] || r['Numero de Operacion2'] || r['Número de Operación'] || r['NroOp'] || '').toString().trim();
          moneda  = _monedaBCP(r['Moneda'] || r['moneda']);
        } else {
          // Formato NEXUM estándar
          fecha  = _parsearFecha(r.fecha || r.Fecha || r.FECHA || '');
          nat    = (r.naturaleza || r.Naturaleza || r.NATURALEZA || '').toString().toUpperCase().trim();
          imp    = parseFloat(r.importe || r.Importe || r.IMPORTE || 0);
          desc   = (r.descripcion || r.Descripcion || r.DESCRIPCION || '').toString();
          nro_op = (r.numero_operacion || r['Nro Operacion'] || r['Nro Op'] || '').toString();
          moneda = (r.moneda || r.Moneda || 'PEN').toString().toUpperCase() || 'PEN';
        }

        const ok = !!fecha && (nat === 'CARGO' || nat === 'ABONO') && imp > 0;
        return {
          _idx: i + 2,
          fecha,
          naturaleza: nat,
          importe: imp,
          descripcion: desc,
          numero_operacion: nro_op,
          moneda,
          _ok: ok,
        };
      });

      // Notificar formato detectado
      if (esBCP) mostrarToast(`Formato BCP detectado (${rows.length} filas)`, 'info');

      const preview = document.getElementById('imp-preview');
      const tbody   = document.getElementById('tbody-preview');
      if (!preview || !tbody) return;

      preview.style.display = 'block';
      document.getElementById('imp-preview-count').textContent = imp_datos_preview.length;
      const errores = imp_datos_preview.filter(r => !r._ok).length;
      document.getElementById('imp-preview-resumen').textContent =
        `✅ ${imp_datos_preview.length - errores} válidos  ⚠️ ${errores} con errores (se omitirán)`;

      tbody.innerHTML = imp_datos_preview.map(r => `
        <tr ${!r._ok ? 'style="background:#FFF5F5"' : ''}>
          <td>${r._idx}</td>
          <td>${r.fecha || '<span style="color:red">—</span>'}</td>
          <td>${r.naturaleza || '<span style="color:red">—</span>'}</td>
          <td class="text-right">${r.importe ? formatearMoneda(r.importe, r.moneda) : '<span style="color:red">—</span>'}</td>
          <td class="text-sm">${escapar((r.descripcion||'').slice(0,40))}</td>
          <td class="text-mono text-sm">${escapar(r.numero_operacion||'—')}</td>
          <td>${r._ok ? '<span class="badge badge-activo" style="font-size:10px">OK</span>' : '<span class="badge badge-inactivo" style="font-size:10px">Error</span>'}</td>
        </tr>`).join('');

      _impCargarValidacion();

    } catch (err) {
      mostrarToast('Error al leer el archivo: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(archivo);
}

function _parsearFecha(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  const s = val.toString().trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/');
    return `${y}-${m}-${d}`;
  }
  const d = new Date(s);
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
}

function cancelarPreview() {
  imp_datos_preview   = [];
  imp_movs_validacion = [];
  const preview = document.getElementById('imp-preview');
  if (preview) preview.style.display = 'none';
  const val = document.getElementById('imp-validacion');
  if (val) val.style.display = 'none';
}

async function confirmarImportacion() {
  const cuenta  = document.getElementById('imp-cuenta')?.value;
  const fuente  = document.getElementById('imp-fuente')?.value || 'MANUAL';
  const validos = imp_datos_preview.filter(r => r._ok);
  if (!validos.length) { mostrarToast('No hay registros válidos para importar', 'atencion'); return; }

  const btn = document.getElementById('btn-confirmar-imp');
  btn.disabled = true; btn.textContent = 'Importando…';

  // Crear lote de importación
  const nombreArchivo = document.getElementById('imp-archivo')?.files[0]?.name || 'importacion.xlsx';
  const { data: lote, error: errLote } = await _supabase
    .from('lotes_importacion')
    .insert({
      empresa_operadora_id: empresa_activa.id,
      cuenta_bancaria_id:   cuenta,
      nombre_archivo:       nombreArchivo,
      tipo_fuente:          fuente,
      total_registros:      imp_datos_preview.length,
      estado:               'PROCESANDO',
      usuario_id:           perfil_usuario?.id || null,
    })
    .select()
    .single();

  if (errLote) {
    mostrarToast('Error al crear lote: ' + errLote.message, 'error');
    btn.disabled = false; btn.textContent = '✅ Confirmar e importar';
    return;
  }

  // Insertar movimientos en lotes de 50
  const movs = validos.map(r => ({
    empresa_operadora_id: empresa_activa.id,
    cuenta_bancaria_id:   cuenta,
    fecha:                r.fecha,
    naturaleza:           r.naturaleza,
    importe:              r.importe,
    moneda:               r.moneda || 'PEN',
    descripcion:          r.descripcion || null,
    numero_operacion:     r.numero_operacion || null,
    estado:               'PENDIENTE',
    lote_importacion:     lote.id,
    usuario_id:           perfil_usuario?.id || null,
  }));

  let ok = 0; let err = 0;
  for (let i = 0; i < movs.length; i += 50) {
    const chunk = movs.slice(i, i + 50);
    const { error } = await _supabase.from('movimientos').insert(chunk);
    if (error) err += chunk.length;
    else ok += chunk.length;
  }

  // Actualizar estado del lote
  await _supabase.from('lotes_importacion').update({
    estado:           err === 0 ? 'COMPLETADO' : 'ERROR',
    registros_ok:     ok,
    registros_error:  err,
  }).eq('id', lote.id);

  btn.disabled = false; btn.textContent = '✅ Confirmar e importar';
  mostrarToast(`Importación completada: ${ok} registros. ${err ? err + ' errores.' : ''}`, 'exito');
  cancelarPreview();
  await cargarHistorialImportaciones();
}

async function cargarHistorialImportaciones() {
  const { data } = await _supabase
    .from('lotes_importacion')
    .select('*, cuentas_bancarias(nombre_alias)')
    .eq('empresa_operadora_id', empresa_activa.id)
    .order('fecha_creacion', { ascending: false })
    .limit(10);

  const cont = document.getElementById('historial-importaciones');
  if (!cont) return;
  const lista = data || [];

  if (!lista.length) {
    cont.innerHTML = '<p class="text-center text-muted text-sm" style="padding:12px">Sin importaciones registradas</p>';
    return;
  }

  const colores = { COMPLETADO: 'badge-activo', PROCESANDO: 'badge-warning', ERROR: 'badge-inactivo' };
  cont.innerHTML = `
    <div class="table-wrap">
      <table class="tabla" style="font-size:13px">
        <thead><tr><th>Fecha</th><th>Archivo</th><th>Cuenta</th><th>Fuente</th><th>Total</th><th>OK</th><th>Errores</th><th>Estado</th><th>Acc.</th></tr></thead>
        <tbody>${lista.map(l => `
          <tr>
            <td>${formatearFecha(l.fecha_creacion?.slice(0,10))}</td>
            <td class="text-sm">${escapar(l.nombre_archivo)}</td>
            <td>${escapar(l.cuentas_bancarias?.nombre_alias || '—')}</td>
            <td>${escapar(l.tipo_fuente || '—')}</td>
            <td class="text-center">${l.total_registros}</td>
            <td class="text-center text-verde">${l.registros_ok}</td>
            <td class="text-center ${l.registros_error > 0 ? 'text-rojo' : ''}">${l.registros_error}</td>
            <td><span class="badge ${colores[l.estado] || 'badge-info'}" style="font-size:11px">${l.estado}</span></td>
            <td>
              <button onclick="eliminarLoteEECC('${l.id}', ${l.registros_ok || 0})"
                style="padding:3px 8px;background:rgba(197,48,48,.1);color:#C53030;border:none;border-radius:4px;cursor:pointer;font-size:12px"
                title="Eliminar esta importación y sus movimientos">🗑️</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

async function eliminarLoteEECC(loteId, cantMovimientos) {
  const msg = cantMovimientos > 0
    ? `¿Eliminar esta importación y sus ${cantMovimientos} movimiento(s)? Podrás volver a subir el archivo.`
    : '¿Eliminar esta importación del historial?';
  if (!await confirmar(msg, { btnOk: 'Eliminar', btnColor: '#C53030' })) return;

  if (cantMovimientos > 0) {
    const { error: errMov } = await _supabase
      .from('movimientos').delete().eq('lote_importacion', loteId);
    if (errMov) { mostrarToast('Error al eliminar movimientos: ' + errMov.message, 'error'); return; }
  }

  const { error: errLote } = await _supabase
    .from('lotes_importacion').delete().eq('id', loteId);
  if (errLote) { mostrarToast('Error al eliminar registro: ' + errLote.message, 'error'); return; }

  mostrarToast('Importación eliminada. Puedes volver a subir el archivo.', 'exito');
  await cargarHistorialImportaciones();
}

// ── Validación cruzada EECC vs Movimientos bancarios ─────────────
async function _impCargarValidacion() {
  const cont   = document.getElementById('imp-validacion');
  if (!cont) return;

  const cuenta = document.getElementById('imp-cuenta')?.value;
  const validos = imp_datos_preview.filter(r => r._ok);
  if (!cuenta || !validos.length) { cont.style.display = 'none'; return; }

  // Rango de fechas del EECC
  const fechas = validos.map(r => r.fecha).filter(Boolean).sort();
  const desde  = fechas[0];
  const hasta  = fechas[fechas.length - 1];

  cont.style.display = 'block';
  cont.innerHTML = `<div class="text-center text-muted text-sm" style="padding:16px">🔍 Validando contra movimientos bancarios registrados…</div>`;

  const { data: movs } = await _supabase
    .from('movimientos')
    .select('id, fecha, naturaleza, importe, descripcion, numero_operacion, moneda')
    .eq('empresa_operadora_id', empresa_activa.id)
    .eq('cuenta_bancaria_id', cuenta)
    .gte('fecha', desde)
    .lte('fecha', hasta);

  imp_movs_validacion = movs || [];
  _impRenderValidacion();
}

function _impRenderValidacion() {
  const cont   = document.getElementById('imp-validacion');
  if (!cont) return;

  const movs   = imp_movs_validacion;
  const validos = imp_datos_preview.filter(r => r._ok);

  const resultados = validos.map(row => {
    const nroRaw    = (row.numero_operacion || '').trim();
    const esComision = !nroRaw || /^0+$/.test(nroRaw);
    const nroEecc6  = nroRaw.slice(-6);

    if (esComision) {
      const match = movs.find(m =>
        m.fecha === row.fecha &&
        m.naturaleza === row.naturaleza &&
        Math.abs(parseFloat(m.importe) - row.importe) <= 0.01
      );
      return { row, match, estado: match ? 'COMISION' : 'SIN_MATCH' };
    }

    // Buscar por últimos 6 dígitos del nro_op
    const porNro = movs.filter(m => {
      const nroMov6 = (m.numero_operacion || '').trim().slice(-6);
      return nroMov6 === nroEecc6 && nroMov6 !== '';
    });

    if (porNro.length) {
      const exacto = porNro.find(m =>
        m.naturaleza === row.naturaleza &&
        Math.abs(parseFloat(m.importe) - row.importe) <= 0.01
      );
      return { row, match: exacto || porNro[0], estado: exacto ? 'COINCIDE' : 'OBSERVADO' };
    }

    // Viceversa: monto + fecha coinciden pero no el nro_op
    const porMonto = movs.find(m =>
      m.fecha === row.fecha &&
      m.naturaleza === row.naturaleza &&
      Math.abs(parseFloat(m.importe) - row.importe) <= 0.01
    );
    return { row, match: porMonto || null, estado: porMonto ? 'OBSERVADO' : 'SIN_MATCH' };
  });

  const nCoincide  = resultados.filter(r => r.estado === 'COINCIDE').length;
  const nObservado = resultados.filter(r => r.estado === 'OBSERVADO').length;
  const nComision  = resultados.filter(r => r.estado === 'COMISION').length;
  const nSinMatch  = resultados.filter(r => r.estado === 'SIN_MATCH').length;

  const badge = (estado) => {
    const cfg = {
      COINCIDE:  { bg:'#C6F6D5', color:'#276749', label:'✅ Coincide' },
      OBSERVADO: { bg:'#FEFCBF', color:'#744210', label:'⚠️ Observado' },
      COMISION:  { bg:'#BEE3F8', color:'#2A4365', label:'🏦 Comisión' },
      SIN_MATCH: { bg:'#FED7D7', color:'#742A2A', label:'❌ Sin match' },
    };
    const c = cfg[estado] || cfg.SIN_MATCH;
    return `<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:${c.bg};color:${c.color}">${c.label}</span>`;
  };

  const avisoObservados = (nObservado || nSinMatch)
    ? `<p class="text-sm" style="color:#744210;margin-bottom:10px;padding:8px 12px;background:#FFFFF0;border-left:3px solid #D69E2E;border-radius:4px">
        ⚠️ Hay ${nObservado + nSinMatch} registro(s) con observaciones. Revísalos antes de confirmar la importación.
       </p>` : '';

  cont.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <h3 style="font-size:14px">🔍 Validación cruzada con Movimientos Bancarios</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;font-size:12px;font-weight:600">
        <span style="padding:3px 10px;border-radius:10px;background:#C6F6D5;color:#276749">✅ ${nCoincide} coinciden</span>
        ${nObservado ? `<span style="padding:3px 10px;border-radius:10px;background:#FEFCBF;color:#744210">⚠️ ${nObservado} observados</span>` : ''}
        ${nComision  ? `<span style="padding:3px 10px;border-radius:10px;background:#BEE3F8;color:#2A4365">🏦 ${nComision} comisiones</span>` : ''}
        ${nSinMatch  ? `<span style="padding:3px 10px;border-radius:10px;background:#FED7D7;color:#742A2A">❌ ${nSinMatch} sin match</span>` : ''}
      </div>
    </div>
    ${avisoObservados}
    <div class="table-wrap" style="max-height:380px;overflow-y:auto">
      <table class="tabla" style="font-size:12px">
        <thead>
          <tr>
            <th style="min-width:120px">Estado</th>
            <th>Fecha</th>
            <th>Nro Op (EECC)</th>
            <th class="text-right">Importe EECC</th>
            <th style="text-align:center">⟷</th>
            <th>Nro Op (Banco)</th>
            <th class="text-right">Importe Banco</th>
            <th>Descripción Banco</th>
          </tr>
        </thead>
        <tbody>
          ${resultados.map(({ row, match, estado }) => {
            const rowBg = estado === 'OBSERVADO' ? 'rgba(254,252,191,.5)'
                        : estado === 'SIN_MATCH'  ? 'rgba(254,215,215,.4)'
                        : '';
            return `
              <tr style="background:${rowBg}">
                <td>${badge(estado)}</td>
                <td style="white-space:nowrap">${row.fecha || '—'}</td>
                <td class="text-mono">${escapar(row.numero_operacion || '—')}</td>
                <td class="text-right ${row.naturaleza==='CARGO'?'text-rojo':'text-verde'}" style="font-weight:500;white-space:nowrap">
                  ${row.naturaleza==='CARGO'?'−':'+'}${formatearMoneda(row.importe, row.moneda)}
                </td>
                <td style="text-align:center;color:var(--color-texto-suave)">⟷</td>
                <td class="text-mono">${match ? escapar((match.numero_operacion||'—')) : '<span class="text-muted">—</span>'}</td>
                <td class="text-right ${match?.naturaleza==='CARGO'?'text-rojo':'text-verde'}" style="font-weight:500;white-space:nowrap">
                  ${match ? `${match.naturaleza==='CARGO'?'−':'+'}${formatearMoneda(match.importe, match.moneda)}` : '<span class="text-muted">—</span>'}
                </td>
                <td class="text-sm">${match ? escapar((match.descripcion||'—').slice(0,32)) : '<span class="text-muted">Sin movimiento registrado</span>'}</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}
