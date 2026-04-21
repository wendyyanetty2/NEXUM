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
            El archivo debe tener las siguientes columnas en la primera hoja:
          </p>
          <div class="table-wrap">
            <table class="tabla" style="font-size:12px">
              <thead><tr><th>Columna</th><th>Ejemplo</th><th>¿Requerida?</th></tr></thead>
              <tbody>
                <tr><td><code>fecha</code></td><td>2026-04-15</td><td>✅ Sí</td></tr>
                <tr><td><code>naturaleza</code></td><td>CARGO o ABONO</td><td>✅ Sí</td></tr>
                <tr><td><code>importe</code></td><td>1500.00</td><td>✅ Sí</td></tr>
                <tr><td><code>descripcion</code></td><td>PAGO PROVEEDOR</td><td>No</td></tr>
                <tr><td><code>numero_operacion</code></td><td>0012345</td><td>No</td></tr>
                <tr><td><code>moneda</code></td><td>PEN / USD / EUR</td><td>No (def: PEN)</td></tr>
              </tbody>
            </table>
          </div>
          <p class="text-muted text-sm" style="margin-top:12px">
            💡 La fecha puede estar en formato <code>YYYY-MM-DD</code> o <code>DD/MM/YYYY</code>.
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

let imp_datos_preview = [];

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
      const wb    = XLSX.read(e.target.result, { type: 'array', cellDates: true });
      const ws    = wb.Sheets[wb.SheetNames[0]];
      const rows  = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (!rows.length) { mostrarToast('El archivo está vacío', 'atencion'); return; }

      imp_datos_preview = rows.map((r, i) => {
        const fecha = _parsearFecha(r.fecha || r.Fecha || r.FECHA || '');
        const nat   = (r.naturaleza || r.Naturaleza || r.NATURALEZA || '').toString().toUpperCase().trim();
        const imp   = parseFloat(r.importe || r.Importe || r.IMPORTE || 0);
        const ok    = fecha && (nat === 'CARGO' || nat === 'ABONO') && imp > 0;
        return {
          _idx:      i + 2,
          fecha,
          naturaleza: nat,
          importe:    imp,
          descripcion: r.descripcion || r.Descripcion || r.DESCRIPCION || '',
          numero_operacion: r.numero_operacion || r['Nro Operacion'] || r['Nro Op'] || '',
          moneda: (r.moneda || r.Moneda || 'PEN').toString().toUpperCase() || 'PEN',
          _ok: ok,
        };
      });

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
  imp_datos_preview = [];
  const preview = document.getElementById('imp-preview');
  if (preview) preview.style.display = 'none';
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
        <thead><tr><th>Fecha</th><th>Archivo</th><th>Cuenta</th><th>Fuente</th><th>Total</th><th>OK</th><th>Errores</th><th>Estado</th></tr></thead>
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
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}
