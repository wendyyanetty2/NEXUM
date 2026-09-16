// ═══════════════════════════════════════════════════════════════
// Tesorería — Importar EECC desde Excel
// ═══════════════════════════════════════════════════════════════

async function renderTabImportar(area) {
  area.innerHTML = `
    <div class="fadeIn">
      <!-- Panel de importación -->
      <div class="card" style="margin-bottom:16px">
        <h3 style="margin-bottom:4px">⬆️ Importar estado de cuenta bancario</h3>
        <p class="text-muted text-sm" style="margin-bottom:20px">
          Sube el Excel del estado de cuenta del banco. El sistema detecta automáticamente el formato BCP y lo compara contra los movimientos MBD importados. Si aún no sabes a qué cuenta corresponde, puedes importarlo sin asignarla y vincularla después desde el historial.
        </p>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;align-items:end">
          <div class="campo" style="margin:0">
            <label>Cuenta bancaria destino <span class="text-muted text-sm">(opcional)</span></label>
            <select id="imp-cuenta" class="w-full"></select>
          </div>
          <div class="campo" style="margin:0">
            <label>Banco / Fuente</label>
            <select id="imp-fuente" class="w-full">
              <option value="BCP">BCP</option>
              <option value="BBVA">BBVA</option>
              <option value="INTERBANK">Interbank</option>
              <option value="SCOTIABANK">Scotiabank</option>
              <option value="MANUAL">Manual / Otro</option>
            </select>
          </div>
          <div class="campo" style="margin:0">
            <label>Tipo de reporte</label>
            <select id="imp-tipo-reporte" class="w-full">
              <option value="DIARIO">Diario (últimos 20 movimientos)</option>
              <option value="MENSUAL">EECC mensual completo</option>
              <option value="MANUAL">Manual / Otro</option>
            </select>
          </div>
          <div class="campo" style="margin:0">
            <label>Archivo Excel <span class="req">*</span></label>
            <input type="file" id="imp-archivo" accept=".xlsx,.xls,.csv"
                   style="padding:8px;border:2px dashed var(--color-borde);border-radius:var(--radio);width:100%;box-sizing:border-box;cursor:pointer">
          </div>
          <div style="display:flex;gap:8px;align-items:flex-end">
            <button class="btn btn-secundario btn-sm" onclick="descargarPlantilla()">📥 Plantilla</button>
            <button class="btn btn-primario" onclick="procesarImportacion()" id="btn-importar">⬆️ Importar</button>
          </div>
        </div>
        <div style="margin-top:12px;padding:10px 14px;background:rgba(44,82,130,.06);border-radius:6px;border-left:3px solid var(--color-secundario);font-size:12px;color:var(--color-texto-suave)">
          💡 El sistema detecta automáticamente el formato BCP. Los N° de operación del banco (6–8 dígitos) se comparan con los registros MBD buscando coincidencia en los últimos dígitos. Si un movimiento del EECC no tiene N° de operación en MBD, se marca como ⚠️ OBSERVADO.
        </div>
      </div>

      <!-- Preview de datos -->
      <div id="imp-preview" style="display:none" class="card" style="margin-top:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <h3>👁️ Vista previa — <span id="imp-preview-count">0</span> registros</h3>
          <div id="imp-preview-resumen" class="text-sm text-muted"></div>
        </div>
        <div class="table-wrap tabla-nexum-wrap" style="max-height:300px;overflow-y:auto">
          <table class="tabla-nexum" id="tabla-preview">
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
  const cuentas = data || [];
  const sel = document.getElementById('imp-cuenta');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Sin asignar (vincular después) —</option>' +
    cuentas.map(c => `<option value="${c.id}">${escapar(c.nombre_alias)} (${c.moneda})</option>`).join('');
}

let imp_datos_preview    = [];
let imp_movs_validacion  = [];
let imp_val_mostrar_cuenta = false;

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
  const archivo = document.getElementById('imp-archivo')?.files[0];
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
          <td class="celda-truncar text-sm" style="--w:200px" title="${escapar(r.descripcion||'')}">${escapar(r.descripcion||'—')}</td>
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
  imp_val_mostrar_cuenta = false;
  const preview = document.getElementById('imp-preview');
  if (preview) preview.style.display = 'none';
  const val = document.getElementById('imp-validacion');
  if (val) val.style.display = 'none';
}

async function confirmarImportacion() {
  const cuenta      = document.getElementById('imp-cuenta')?.value || null;
  const fuente      = document.getElementById('imp-fuente')?.value || 'MANUAL';
  const tipoReporte = document.getElementById('imp-tipo-reporte')?.value || 'MANUAL';
  const validos = imp_datos_preview.filter(r => r._ok);
  if (!validos.length) { mostrarToast('No hay registros válidos para importar', 'atencion'); return; }

  const btn = document.getElementById('btn-confirmar-imp');
  btn.disabled = true; btn.textContent = 'Analizando…';

  // Este es el "cierre del mes completo" — cada fila se compara contra lo
  // que ya existe en tesoreria_mbd (venga de MBD o de una EECC anterior)
  // usando el mismo motor que "Importar MBD": últimos 6 dígitos del N° de
  // operación + fecha + monto + moneda + descripción. Así, aunque la banca
  // repita movimientos de días anteriores en la descarga de hoy, NEXUM no
  // los vuelve a crear. Ver js/duplicados.js — _dupClasificarLoteMovimientos.
  // tesoreria_mbd.monto lleva el SIGNO real (negativo = CARGO/salida,
  // positivo = ABONO/entrada) — r.importe ya viene como valor absoluto
  // (separado de r.naturaleza), así que hay que volver a aplicar el signo
  // aquí antes de guardar. Wendy lo detectó (2026-09-12): los cargos del
  // Excel (montos negativos) se estaban guardando como positivos.
  const candidatos = validos.map(r => ({
    fecha: r.fecha, descripcion: r.descripcion, moneda: r.moneda,
    monto: r.naturaleza === 'CARGO' ? -Math.abs(r.importe) : Math.abs(r.importe),
    numero_operacion: r.numero_operacion, _orig: r,
  }));
  const clasificados = await _dupClasificarLoteMovimientos(candidatos);

  // Control contra inflación financiera (Wendy 2026-09-15): cada fila del
  // archivo debe caer en EXACTAMENTE una categoría (nuevo/ya_existe/posible).
  // Si por algún motivo el conteo no cuadra, NO se sigue adelante en silencio
  // — se detiene la importación completa y se avisa, en vez de arriesgarse a
  // registrar de más o de menos.
  const sumaImporteArchivo = candidatos.reduce((s, c) => s + Math.abs(Number(c.monto) || 0), 0);
  const sumaImporteClasificado = clasificados.reduce((s, c) => s + Math.abs(Number(c.fila.monto) || 0), 0);
  if (clasificados.length !== candidatos.length || Math.abs(sumaImporteArchivo - sumaImporteClasificado) > 0.01) {
    mostrarToast('⚠️ Importación detenida: el cuadre de integridad no coincide (filas o importes no calzan). No se registró nada — contacta a soporte antes de reintentar.', 'error');
    btn.disabled = false; btn.textContent = '✅ Confirmar e importar';
    return;
  }

  const nuevos       = clasificados.filter(c => c.estado === 'nuevo');
  // Validación de integridad: SIEMPRE se muestra antes de escribir nada en la
  // base (incluso si todo el archivo es nuevo) — cuadre de conteos e importe
  // por moneda, y por fila que ya existe (confiable o "REQUIERE REVISIÓN") la
  // decisión de la persona, incluida la fecha, que ya no se actualiza en
  // silencio. Wendy 2026-09-15: integridad de datos > evitar duplicados >
  // conservar información real > automatización.
  const coincidencias = clasificados.filter(c => c.estado === 'ya_existe' || c.estado === 'posible');

  btn.disabled = false; btn.textContent = '✅ Confirmar e importar';
  const resultado = await _dupMostrarValidacionIntegridad(clasificados);
  if (resultado === null) { mostrarToast('Importación cancelada.', 'atencion'); return; }
  btn.disabled = true; btn.textContent = 'Importando…';
  const { decisiones, resumen } = resultado;

  const paraInsertar   = [...nuevos];
  const paraActualizar = []; // { fila, match, razon, _actualizarFecha }
  coincidencias.forEach((c, i) => {
    const dec = decisiones[i];
    if (dec.accion === 'nuevo') paraInsertar.push(c);
    else paraActualizar.push({ ...c, _actualizarFecha: dec.actualizarFecha });
  });

  // Crear lote de importación (historial — igual que antes)
  const nombreArchivo = document.getElementById('imp-archivo')?.files[0]?.name || 'importacion.xlsx';
  const { data: lote, error: errLote } = await _supabase
    .from('lotes_importacion')
    .insert({
      empresa_operadora_id: empresa_activa.id,
      cuenta_bancaria_id:   cuenta,
      nombre_archivo:       nombreArchivo,
      tipo_fuente:          fuente,
      tipo_reporte:         tipoReporte,
      total_registros:      imp_datos_preview.length,
      registros_duplicados: resumen.duplicados,
      registros_revision:   resumen.revision,
      detalle_validacion:   resumen,
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

  // Insertar en tesoreria_mbd (el registro de negocio que usan Contabilidad/
  // Conciliación/Dashboard) solo lo genuinamente nuevo, con el motor de
  // coincidencia de arriba.
  const movsMbd = paraInsertar.map(c => ({
    empresa_id:                 empresa_activa.id,
    nro_operacion_bancaria:     c.fila.numero_operacion || null,
    fecha_deposito:             c.fila.fecha,
    descripcion:                c.fila.descripcion || null,
    moneda:                     c.fila.moneda || 'S/',
    monto:                      c.fila.monto,
    entrega_doc:                'PENDIENTE',
    origen_importacion:         'EECC',
    lote_importacion:           lote.id,
  }));

  let ok = 0; let err = 0;
  for (let i = 0; i < movsMbd.length; i += 50) {
    const chunk = movsMbd.slice(i, i + 50);
    const { error } = await _supabase.from('tesoreria_mbd').insert(chunk);
    if (error) err += chunk.length;
    else ok += chunk.length;
  }

  // Además, se conserva el registro en "movimientos" — esa tabla es la que
  // usa "🏦 Cuentas bancarias" para reconciliar el saldo por cuenta
  // (tesoreria_mbd no guarda a qué cuenta pertenece cada movimiento). Antes
  // se guardaban TODAS las filas válidas sin verificar, así que reportes
  // diarios que se solapan inflaban el saldo con filas repetidas. Ahora se
  // dedupe también aquí (mismo motor: N° de operación normalizado + monto +
  // moneda + descripción). Wendy 2026-09-15.
  const validosParaMovimientos = await _dupFiltrarNuevosParaMovimientos(validos, cuenta);
  const movsCuenta = validosParaMovimientos.map(r => ({
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
  for (let i = 0; i < movsCuenta.length; i += 50) {
    await _supabase.from('movimientos').insert(movsCuenta.slice(i, i + 50));
  }

  // Lo que ya existía: conservar el N° de operación de EECC como "alt" si el
  // registro (creado por MBD) todavía no tenía uno guardado, y actualizar la
  // fecha SOLO si la persona lo aprobó explícitamente en el reporte de
  // coincidencias (nunca en silencio — Wendy 2026-09-15).
  let modificados = 0;
  for (const c of paraActualizar) {
    const cambios = {};
    if (!c.match.nro_operacion_alt && c.fila.numero_operacion && c.fila.numero_operacion !== c.match.nro_operacion_bancaria) {
      cambios.nro_operacion_alt = c.fila.numero_operacion;
    }
    if (c._actualizarFecha && c.fila.fecha && c.fila.fecha !== (c.match.fecha_deposito || '').slice(0, 10)) {
      cambios.fecha_deposito = c.fila.fecha;
    }
    if (Object.keys(cambios).length) {
      const { error } = await _supabase.from('tesoreria_mbd').update(cambios).eq('id', c.match.id);
      if (!error) modificados++;
    }
  }

  // Control contra inflación financiera: lo que se insertó de verdad en
  // tesoreria_mbd debe cuadrar con lo que se decidió insertar. Si algún
  // chunk falló (err > 0), NO se marca como completado en silencio — el
  // lote queda en ERROR para que se revise antes de confiar en el saldo.
  if (err > 0) {
    mostrarToast(`⚠️ ERROR CRÍTICO: ${err} de ${movsMbd.length} movimiento(s) NO se guardaron correctamente. Revisa el historial antes de confiar en los saldos.`, 'error');
  }

  // Actualizar estado del lote (trazabilidad completa)
  await _supabase.from('lotes_importacion').update({
    estado:                err === 0 ? 'COMPLETADO' : 'ERROR',
    registros_ok:          ok,
    registros_error:       err,
    registros_modificados: modificados,
  }).eq('id', lote.id);

  btn.disabled = false; btn.textContent = '✅ Confirmar e importar';
  const partes = [];
  if (ok) partes.push(`${ok} nuevo(s) importado(s)`);
  if (paraActualizar.length) partes.push(`${paraActualizar.length} ya existían (omitidos)`);
  if (err) partes.push(`${err} error(es)`);
  mostrarToast(partes.length ? partes.join(' · ') : 'Nada nuevo para importar — todo ya estaba registrado.', err ? 'atencion' : 'exito');
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
    <div class="table-wrap tabla-nexum-wrap">
      <table class="tabla-nexum" style="font-size:13px">
        <thead><tr><th>Fecha</th><th>Archivo</th><th>Cuenta</th><th>Fuente</th><th>Total</th><th>OK</th><th>Errores</th><th>Estado</th><th>Acc.</th></tr></thead>
        <tbody>${lista.map(l => `
          <tr>
            <td>${formatearFecha(l.fecha_creacion?.slice(0,10))}</td>
            <td class="text-sm">${escapar(l.nombre_archivo)}</td>
            <td>${l.cuentas_bancarias?.nombre_alias
                    ? escapar(l.cuentas_bancarias.nombre_alias)
                    : '<span class="badge badge-warning" style="font-size:10px">Sin asignar</span>'}</td>
            <td>${escapar(l.tipo_fuente || '—')}</td>
            <td class="text-center">${l.total_registros}</td>
            <td class="text-center text-verde">${l.registros_ok}</td>
            <td class="text-center ${l.registros_error > 0 ? 'text-rojo' : ''}">${l.registros_error}</td>
            <td><span class="badge ${colores[l.estado] || 'badge-info'}" style="font-size:11px">${l.estado}</span></td>
            <td style="white-space:nowrap">
              ${!l.cuenta_bancaria_id ? `
              <button onclick="vincularCuentaLote('${l.id}')"
                style="padding:3px 8px;background:rgba(44,82,130,.1);color:var(--color-secundario);border:none;border-radius:4px;cursor:pointer;font-size:12px"
                title="Vincular esta importación a una cuenta bancaria">🔗 Vincular</button>` : ''}
              <button onclick="quitarLoteDelHistorial('${l.id}')"
                style="padding:3px 8px;background:rgba(113,71,224,.1);color:#7147e0;border:none;border-radius:4px;cursor:pointer;font-size:12px"
                title="Quitar esta fila del historial — NO borra los movimientos ya importados, solo limpia el registro">🗒️ Quitar del historial</button>
              ${l.registros_ok > 0 ? `
              <button onclick="eliminarLoteYMovimientos('${l.id}', ${l.registros_ok || 0})"
                style="padding:3px 8px;background:rgba(197,48,48,.1);color:#C53030;border:none;border-radius:4px;cursor:pointer;font-size:12px"
                title="Deshacer esta importación por completo: además del historial, borra sus ${l.registros_ok} movimiento(s) ya cargados">🗑️ Deshacer importación</button>` : ''}
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

// ── Quitar SOLO la fila del historial (log de la importación) — nunca
//    toca los movimientos ya cargados en Movimientos/tesoreria_mbd. Es la
//    acción normal para mantener el historial limpio (Wendy, 2026-09-12:
//    "que no perjudique todo lo que se armó ya"). ───────────────────────
async function quitarLoteDelHistorial(loteId) {
  if (!await confirmar('¿Quitar esta importación del historial? Los movimientos ya cargados NO se van a borrar.', { btnOk: 'Quitar del historial', btnColor: '#7147e0' })) return;

  const { error } = await _supabase.from('lotes_importacion').delete().eq('id', loteId);
  if (error) { mostrarToast('Error al quitar del historial: ' + error.message, 'error'); return; }

  mostrarToast('Importación quitada del historial. Tus movimientos siguen intactos.', 'exito');
  await cargarHistorialImportaciones();
}

// ── Deshacer la importación por completo: borra también los movimientos
//    reales que trajo (Movimientos y tesoreria_mbd). Acción aparte y con
//    doble confirmación porque SÍ afecta datos ya trabajados — usarla solo
//    cuando de verdad hay que rehacer una importación mal hecha. ─────────
async function eliminarLoteYMovimientos(loteId, cantMovimientos) {
  const ok1 = await confirmar(
    `⚠️ Esto va a borrar ${cantMovimientos} movimiento(s) que ya se importaron y podrían estar vinculados a comprobantes, conciliaciones u otros trabajos. Esta acción no se puede deshacer.\n¿Quieres continuar?`,
    { btnOk: 'Continuar', btnColor: '#C53030' }
  );
  if (!ok1) return;
  const ok2 = await confirmar(
    `🚨 CONFIRMACIÓN FINAL: ¿Borrar definitivamente esta importación y sus ${cantMovimientos} movimiento(s)?`,
    { btnOk: 'Sí, borrar todo', btnColor: '#C53030' }
  );
  if (!ok2) return;

  const { error: errMov } = await _supabase
    .from('movimientos').delete().eq('lote_importacion', loteId);
  if (errMov) { mostrarToast('Error al eliminar movimientos: ' + errMov.message, 'error'); return; }

  // También los que este mismo lote haya creado en tesoreria_mbd (el
  // registro de negocio) — si no, quedarían huérfanos ahí.
  const { error: errMbd } = await _supabase
    .from('tesoreria_mbd').delete().eq('lote_importacion', loteId);
  if (errMbd) { mostrarToast('Error al eliminar movimientos (MBD): ' + errMbd.message, 'error'); return; }

  const { error: errLote } = await _supabase
    .from('lotes_importacion').delete().eq('id', loteId);
  if (errLote) { mostrarToast('Error al eliminar registro: ' + errLote.message, 'error'); return; }

  mostrarToast('Importación y sus movimientos eliminados. Puedes volver a subir el archivo.', 'exito');
  await cargarHistorialImportaciones();
}

// ── Vincular una importación existente (sin cuenta) a una cuenta bancaria ─
async function vincularCuentaLote(loteId) {
  const { data: cuentas } = await _supabase
    .from('cuentas_bancarias')
    .select('id, nombre_alias, moneda')
    .eq('empresa_operadora_id', empresa_activa.id)
    .eq('activo', true)
    .order('nombre_alias');

  if (!cuentas || !cuentas.length) {
    mostrarToast('No hay cuentas bancarias activas registradas para esta empresa', 'atencion');
    return;
  }

  const cuentaId = await _mostrarSelectorCuenta(cuentas);
  if (!cuentaId) return;

  const { error: errLote } = await _supabase
    .from('lotes_importacion')
    .update({ cuenta_bancaria_id: cuentaId })
    .eq('id', loteId);
  if (errLote) { mostrarToast('Error al vincular el lote: ' + errLote.message, 'error'); return; }

  const { error: errMov } = await _supabase
    .from('movimientos')
    .update({ cuenta_bancaria_id: cuentaId })
    .eq('lote_importacion', loteId);
  if (errMov) { mostrarToast('Error al vincular los movimientos: ' + errMov.message, 'error'); return; }

  mostrarToast('Importación vinculada a la cuenta bancaria', 'exito');
  await cargarHistorialImportaciones();
  await _validarLoteVinculado(loteId, cuentaId);
}

function _mostrarSelectorCuenta(cuentas) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed; inset:0; background:rgba(0,0,0,0.5);
      display:flex; align-items:center; justify-content:center; z-index:9998;
    `;
    overlay.innerHTML = `
      <div style="background:var(--color-bg-card); border-radius:12px; padding:28px 32px; max-width:380px; width:90%;
                  box-shadow:var(--sombra-lg); border:1px solid var(--color-borde);">
        <div style="font-size:32px; margin-bottom:8px; text-align:center;">🔗</div>
        <h3 style="text-align:center; margin-bottom:4px;">Vincular a cuenta bancaria</h3>
        <p class="text-muted text-sm" style="text-align:center; margin-bottom:16px;">
          Elige la cuenta a la que corresponde este estado de cuenta. Se actualizarán todos sus movimientos.
        </p>
        <select id="sel-vincular-cuenta" class="w-full" style="margin-bottom:20px">
          <option value="">— Seleccionar cuenta —</option>
          ${cuentas.map(c => `<option value="${c.id}">${escapar(c.nombre_alias)} (${c.moneda})</option>`).join('')}
        </select>
        <div style="display:flex; gap:12px; justify-content:center;">
          <button id="btn-cancelar-vinc" style="padding:10px 24px; border:1px solid var(--color-borde);
            border-radius:8px; background:var(--color-bg-card); color:var(--color-texto); cursor:pointer; font-size:14px; font-family:var(--font);">
            Cancelar
          </button>
          <button id="btn-confirmar-vinc" style="padding:10px 24px; border:none;
            border-radius:8px; background:var(--color-secundario); color:#fff; cursor:pointer; font-size:14px; font-family:var(--font); font-weight:500;">
            Vincular
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#btn-confirmar-vinc').onclick = () => {
      const val = overlay.querySelector('#sel-vincular-cuenta').value;
      if (!val) { mostrarToast('Selecciona una cuenta', 'atencion'); return; }
      overlay.remove(); resolve(val);
    };
    overlay.querySelector('#btn-cancelar-vinc').onclick = () => { overlay.remove(); resolve(null); };
    overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); resolve(null); } });
  });
}

// ── Validar cruzado tras vincular un lote ya importado ────────────────────
async function _validarLoteVinculado(loteId, cuentaId) {
  const cont = document.getElementById('imp-validacion');
  if (!cont) return;

  const { data: filaLote } = await _supabase
    .from('movimientos')
    .select('id, fecha, naturaleza, importe, moneda, descripcion, numero_operacion')
    .eq('lote_importacion', loteId);

  if (!filaLote || !filaLote.length) return;

  const fechas = filaLote.map(r => r.fecha).filter(Boolean).sort();
  const desde  = fechas[0];
  const hasta  = fechas[fechas.length - 1];

  const idsLote = new Set(filaLote.map(r => r.id));
  const { data: otrosRaw } = await _supabase
    .from('movimientos')
    .select('id, fecha, naturaleza, importe, moneda, descripcion, numero_operacion')
    .eq('empresa_operadora_id', empresa_activa.id)
    .eq('cuenta_bancaria_id', cuentaId)
    .gte('fecha', desde)
    .lte('fecha', hasta);

  imp_movs_validacion = (otrosRaw || []).filter(m => !idsLote.has(m.id));
  imp_datos_preview = filaLote.map(r => ({ ...r, _ok: true }));
  imp_val_mostrar_cuenta = false; // la cuenta ya se conoce (cuentaId) — no hace falta la columna
  cont.style.display = 'block';
  _impRenderValidacion();
}

// ── Validación cruzada EECC vs Movimientos bancarios ─────────────
// Ya NO depende de tener cuenta bancaria asignada: si no hay cuenta elegida
// se valida contra todos los movimientos de la empresa (empresa_activa.id)
// en el rango de fechas, y se puede vincular a una cuenta después desde el
// historial. Wendy 2026-09-16: no debe ser obligatorio asignar cuenta para
// poder ver la validación cruzada.
const IMP_TOLERANCIA_DIAS = 3;

function _impSumarDias(fechaISO, dias) {
  const d = new Date(fechaISO + 'T00:00:00');
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

async function _impCargarValidacion() {
  const cont   = document.getElementById('imp-validacion');
  if (!cont) return;

  const cuenta = document.getElementById('imp-cuenta')?.value;
  const validos = imp_datos_preview.filter(r => r._ok);
  if (!validos.length) { cont.style.display = 'none'; return; }

  // Rango de fechas del EECC, ampliado ±3 días: el match real es por N° de
  // operación, no por fecha exacta, así que el rango solo debe ser lo
  // bastante amplio para no perder movimientos que el banco liquidó unos
  // días antes/después.
  const fechas = validos.map(r => r.fecha).filter(Boolean).sort();
  const desde  = _impSumarDias(fechas[0], -IMP_TOLERANCIA_DIAS);
  const hasta  = _impSumarDias(fechas[fechas.length - 1], IMP_TOLERANCIA_DIAS);

  cont.style.display = 'block';
  cont.innerHTML = `<div class="text-center text-muted text-sm" style="padding:16px">🔍 Validando contra movimientos bancarios registrados…</div>`;

  let query = _supabase
    .from('movimientos')
    .select('id, fecha, naturaleza, importe, descripcion, numero_operacion, moneda, cuenta_bancaria_id, cuentas_bancarias(nombre_alias)')
    .eq('empresa_operadora_id', empresa_activa.id)
    .gte('fecha', desde)
    .lte('fecha', hasta);
  if (cuenta) query = query.eq('cuenta_bancaria_id', cuenta);

  const { data: movs } = await query;

  imp_movs_validacion = movs || [];
  imp_val_mostrar_cuenta = !cuenta;
  _impRenderValidacion();
}

function _impFechaEnTolerancia(fechaA, fechaB) {
  if (!fechaA || !fechaB) return false;
  const dA = new Date(fechaA + 'T00:00:00');
  const dB = new Date(fechaB + 'T00:00:00');
  const dias = Math.abs((dA - dB) / 86400000);
  return dias <= IMP_TOLERANCIA_DIAS;
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
        _impFechaEnTolerancia(m.fecha, row.fecha) &&
        m.naturaleza === row.naturaleza &&
        Math.abs(parseFloat(m.importe) - row.importe) <= 0.01
      );
      return { row, match, estado: match ? 'COMISION' : 'SIN_MATCH' };
    }

    // Buscar por últimos 6 dígitos del nro_op (misma moneda — evita agrupar
    // movimientos de cuentas en PEN con otros en USD que compartan dígitos)
    const porNro = movs.filter(m => {
      const nroMov6 = (m.numero_operacion || '').trim().slice(-6);
      return nroMov6 === nroEecc6 && nroMov6 !== '' && (m.moneda || '').toUpperCase() === (row.moneda || '').toUpperCase();
    });

    if (porNro.length) {
      const exacto = porNro.find(m =>
        m.naturaleza === row.naturaleza &&
        Math.abs(parseFloat(m.importe) - row.importe) <= 0.01
      );
      if (exacto) return { row, match: exacto, estado: 'COINCIDE' };

      // El mismo N° de operación puede repartirse en varios comprobantes:
      // si la suma de todos los movimientos con este nro_op cuadra con el
      // importe del EECC, se considera coincidencia agrupada en vez de
      // observada. Wendy 2026-09-16.
      const mismaNat = porNro.filter(m => m.naturaleza === row.naturaleza);
      const suma = mismaNat.reduce((s, m) => s + parseFloat(m.importe || 0), 0);
      if (mismaNat.length > 1 && Math.abs(suma - row.importe) <= 0.01) {
        return { row, match: mismaNat, estado: 'COINCIDE_GRUPO' };
      }
      return { row, match: porNro[0], estado: 'OBSERVADO' };
    }

    // Viceversa: monto + fecha (con tolerancia) coinciden pero no el nro_op
    const porMonto = movs.find(m =>
      _impFechaEnTolerancia(m.fecha, row.fecha) &&
      m.naturaleza === row.naturaleza &&
      Math.abs(parseFloat(m.importe) - row.importe) <= 0.01
    );
    return { row, match: porMonto || null, estado: porMonto ? 'OBSERVADO' : 'SIN_MATCH' };
  });

  const nCoincide  = resultados.filter(r => r.estado === 'COINCIDE').length;
  const nGrupo     = resultados.filter(r => r.estado === 'COINCIDE_GRUPO').length;
  const nObservado = resultados.filter(r => r.estado === 'OBSERVADO').length;
  const nComision  = resultados.filter(r => r.estado === 'COMISION').length;
  const nSinMatch  = resultados.filter(r => r.estado === 'SIN_MATCH').length;
  const mostrarCuenta = imp_val_mostrar_cuenta;

  const badge = (estado) => {
    const cfg = {
      COINCIDE:       { bg:'#C6F6D5', color:'#276749', label:'✅ Coincide' },
      COINCIDE_GRUPO: { bg:'#C6F6D5', color:'#276749', label:'✅ Coincide (agrupado)' },
      OBSERVADO:      { bg:'#FEFCBF', color:'#744210', label:'⚠️ Observado' },
      COMISION:       { bg:'#BEE3F8', color:'#2A4365', label:'🏦 Comisión' },
      SIN_MATCH:      { bg:'#FED7D7', color:'#742A2A', label:'❌ Sin match' },
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
        <span style="padding:3px 10px;border-radius:10px;background:#C6F6D5;color:#276749">✅ ${nCoincide + nGrupo} coinciden${nGrupo ? ` (${nGrupo} agrupados)` : ''}</span>
        ${nObservado ? `<span style="padding:3px 10px;border-radius:10px;background:#FEFCBF;color:#744210">⚠️ ${nObservado} observados</span>` : ''}
        ${nComision  ? `<span style="padding:3px 10px;border-radius:10px;background:#BEE3F8;color:#2A4365">🏦 ${nComision} comisiones</span>` : ''}
        ${nSinMatch  ? `<span style="padding:3px 10px;border-radius:10px;background:#FED7D7;color:#742A2A">❌ ${nSinMatch} sin match</span>` : ''}
      </div>
    </div>
    ${avisoObservados}
    <div class="table-wrap tabla-nexum-wrap" style="max-height:380px;overflow-y:auto">
      <table class="tabla-nexum" style="font-size:12px">
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
            ${mostrarCuenta ? '<th>Cuenta</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${resultados.map(({ row, match, estado }) => {
            const rowBg = estado === 'OBSERVADO' ? 'rgba(254,252,191,.5)'
                        : estado === 'SIN_MATCH'  ? 'rgba(254,215,215,.4)'
                        : '';
            const matches = Array.isArray(match) ? match : (match ? [match] : []);
            const nroOpBanco  = matches.length > 1
              ? `${matches.length} comprobantes`
              : escapar(matches[0]?.numero_operacion || '—');
            const importeBanco = matches.length
              ? matches.reduce((s, m) => s + parseFloat(m.importe || 0), 0)
              : null;
            const descBanco = matches.length > 1
              ? matches.map(m => escapar(m.descripcion || '—')).join(' · ')
              : escapar(matches[0]?.descripcion || '—');
            const cuentas = [...new Set(matches.map(m => m.cuentas_bancarias?.nombre_alias).filter(Boolean))];
            return `
              <tr style="background:${rowBg}">
                <td>${badge(estado)}</td>
                <td style="white-space:nowrap">${row.fecha || '—'}</td>
                <td class="text-mono">${escapar(row.numero_operacion || '—')}</td>
                <td class="text-right ${row.naturaleza==='CARGO'?'text-rojo':'text-verde'}" style="font-weight:500;white-space:nowrap">
                  ${row.naturaleza==='CARGO'?'−':'+'}${formatearMoneda(row.importe, row.moneda)}
                </td>
                <td style="text-align:center;color:var(--color-texto-suave)">⟷</td>
                <td class="text-mono">${matches.length ? nroOpBanco : '<span class="text-muted">—</span>'}</td>
                <td class="text-right ${matches[0]?.naturaleza==='CARGO'?'text-rojo':'text-verde'}" style="font-weight:500;white-space:nowrap">
                  ${matches.length ? `${matches[0].naturaleza==='CARGO'?'−':'+'}${formatearMoneda(importeBanco, matches[0].moneda)}` : '<span class="text-muted">—</span>'}
                </td>
                <td class="celda-truncar text-sm" style="--w:200px" title="${matches.length ? descBanco : ''}">${matches.length ? descBanco : '<span class="text-muted">Sin movimiento registrado</span>'}</td>
                ${mostrarCuenta ? `<td class="text-sm">${cuentas.length ? escapar(cuentas.join(', ')) : '<span class="text-muted">—</span>'}</td>` : ''}
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}
