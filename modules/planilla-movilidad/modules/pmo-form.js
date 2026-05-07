// ═══════════════════════════════════════════════════════════════
// Planilla de Movilidad — Tab Nueva / Editar
// ═══════════════════════════════════════════════════════════════

let _pmoEditandoId  = null;   // id de planilla en edición (null = nueva)
let _pmoFilasCount  = 0;      // contador de filas de detalle

// ── Render principal del formulario ──────────────────────────────
async function renderTabNueva(area, planillaData = null, detallesData = []) {
  _pmoEditandoId = planillaData?.id || null;

  const hoy    = new Date();
  const mesD   = planillaData?.mes  || `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}`;
  const fechaD = planillaData?.fecha_emision || hoy.toISOString().slice(0, 10);

  // Generar número de planilla sugerido (solo para nuevas)
  let numSugerido = planillaData?.numero_planilla || '';
  if (!numSugerido) numSugerido = await _pmoGenerarNumero(mesD);

  const opts_trabajadores = PM_TRABAJADORES.map(t =>
    `<option value="${t.dni}" data-nombre="${escapar(t.nombre)}" ${planillaData?.trabajador_dni === t.dni ? 'selected' : ''}>
      ${escapar(t.nombre)}
    </option>`).join('');

  area.innerHTML = `
    <div class="fadeIn">
      <div class="card" style="margin-bottom:16px">

        <!-- Título -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">
          <h3 style="margin:0">${_pmoEditandoId ? '✏️ Editar planilla' : '➕ Nueva planilla de movilidad'}</h3>
          <button onclick="activarTab('pm-lista')"
            style="padding:6px 12px;background:none;border:1px solid var(--color-borde);border-radius:6px;cursor:pointer;font-size:12px;color:var(--color-texto)">
            ← Volver al listado
          </button>
        </div>

        <!-- CABECERA DEL DOCUMENTO -->
        <div style="padding:12px 14px;background:rgba(44,82,130,.06);border-radius:8px;border:1px solid rgba(44,82,130,.2);margin-bottom:16px">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--color-secundario);margin-bottom:10px">
            📋 Cabecera del documento
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px">
            <div class="campo">
              <label class="label-filtro">N° Planilla <span style="color:var(--color-critico)">*</span></label>
              <input type="text" id="pmo-num" value="${escapar(numSugerido)}" placeholder="001-MM-AA"
                style="padding:8px 10px;border:1px solid var(--color-borde);border-radius:6px;width:100%;background:var(--color-bg-card);color:var(--color-texto);font-family:var(--font);font-size:13px;box-sizing:border-box;font-weight:700">
            </div>
            <div class="campo">
              <label class="label-filtro">Período (Mes) <span style="color:var(--color-critico)">*</span></label>
              <input type="month" id="pmo-mes" value="${mesD}" onchange="_pmoMesCambio()"
                style="padding:8px 10px;border:1px solid var(--color-borde);border-radius:6px;width:100%;background:var(--color-bg-card);color:var(--color-texto);font-family:var(--font);font-size:13px;box-sizing:border-box">
            </div>
            <div class="campo">
              <label class="label-filtro">Fecha emisión</label>
              <input type="date" id="pmo-fecha" value="${fechaD}"
                style="padding:8px 10px;border:1px solid var(--color-borde);border-radius:6px;width:100%;background:var(--color-bg-card);color:var(--color-texto);font-family:var(--font);font-size:13px;box-sizing:border-box">
            </div>
          </div>
        </div>

        <!-- DATOS DEL TRABAJADOR -->
        <div style="padding:12px 14px;background:rgba(113,71,224,.05);border-radius:8px;border:1px solid rgba(113,71,224,.2);margin-bottom:16px">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#7147e0;margin-bottom:10px">
            👤 Trabajador
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px">
            <div class="campo" style="grid-column:span 2">
              <label class="label-filtro">Trabajador <span style="color:var(--color-critico)">*</span></label>
              <select id="pmo-trabajador" onchange="_pmoSelTrabajador()"
                style="padding:8px 10px;border:1px solid var(--color-borde);border-radius:6px;width:100%;background:var(--color-bg-card);color:var(--color-texto);font-family:var(--font);font-size:13px">
                <option value="">— Seleccionar trabajador —</option>
                ${opts_trabajadores}
              </select>
            </div>
            <div class="campo">
              <label class="label-filtro">DNI</label>
              <input type="text" id="pmo-dni" value="${escapar(planillaData?.trabajador_dni||'')}" readonly
                style="padding:8px 10px;border:1px solid var(--color-borde);border-radius:6px;width:100%;background:var(--color-hover);color:var(--color-texto-suave);font-family:var(--font);font-size:13px;box-sizing:border-box">
            </div>
            <div class="campo">
              <label class="label-filtro">Firma del trabajador</label>
              <label style="display:flex;align-items:center;gap:8px;padding:8px 0;cursor:pointer;font-size:13px">
                <input type="checkbox" id="pmo-firma" ${planillaData?.firma_trabajador ? 'checked' : ''}
                  style="width:16px;height:16px;accent-color:var(--color-secundario)">
                <span>Firmado ✅</span>
              </label>
            </div>
          </div>
          <div class="campo" style="margin-top:8px">
            <label class="label-filtro">Notas / Observaciones</label>
            <textarea id="pmo-notas" rows="2" placeholder="Observaciones adicionales…"
              style="padding:8px 10px;border:1px solid var(--color-borde);border-radius:6px;width:100%;background:var(--color-bg-card);color:var(--color-texto);font-family:var(--font);font-size:13px;resize:vertical;box-sizing:border-box">${escapar(planillaData?.notas||'')}</textarea>
          </div>
        </div>

        <!-- TABLA DE DETALLES -->
        <div style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--color-texto-suave)">
              📍 Detalle de desplazamientos
            </div>
            <button onclick="_pmoAgregarFila()"
              style="padding:5px 12px;background:var(--color-secundario);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-family:var(--font)">
              ➕ Agregar fila
            </button>
          </div>

          <div style="overflow-x:auto;border:1px solid var(--color-borde);border-radius:8px">
            <table style="width:max-content;min-width:100%;border-collapse:collapse;font-size:12px">
              <thead style="background:var(--color-primario);color:#fff">
                <tr>
                  <th style="padding:8px 8px;white-space:nowrap">#</th>
                  <th style="padding:8px 8px;white-space:nowrap;min-width:110px">Fecha <span style="color:#fca5a5">*</span></th>
                  <th style="padding:8px 8px;white-space:nowrap;min-width:200px">Motivo <span style="color:#fca5a5">*</span></th>
                  <th style="padding:8px 8px;white-space:nowrap;min-width:120px">Desde</th>
                  <th style="padding:8px 8px;white-space:nowrap;min-width:120px">Hasta</th>
                  <th style="padding:8px 8px;white-space:nowrap;min-width:140px">Proyecto</th>
                  <th style="padding:8px 8px;white-space:nowrap;min-width:140px">Empresa</th>
                  <th style="padding:8px 8px;white-space:nowrap;min-width:90px;text-align:right">Monto S/ <span style="color:#fca5a5">*</span></th>
                  <th style="padding:8px 8px">—</th>
                </tr>
              </thead>
              <tbody id="pmo-tabla-body">
                <!-- filas dinámicas -->
              </tbody>
            </table>
          </div>

          <!-- Totalizador -->
          <div id="pmo-total-wrap" style="display:flex;justify-content:flex-end;align-items:center;gap:10px;margin-top:10px;padding:10px 14px;background:rgba(44,82,130,.06);border-radius:6px">
            <span style="font-size:13px;color:var(--color-texto-suave)">Total de gastos:</span>
            <span id="pmo-total" style="font-size:18px;font-weight:700;color:var(--color-secundario)">S/ 0.00</span>
          </div>
        </div>

        <!-- Acciones de guardado -->
        <div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;border-top:1px solid var(--color-borde);padding-top:14px">
          <button onclick="activarTab('pm-lista')"
            style="padding:9px 18px;border:1px solid var(--color-borde);border-radius:6px;background:var(--color-bg-card);color:var(--color-texto);cursor:pointer;font-size:13px;font-family:var(--font)">
            Cancelar
          </button>
          <button onclick="_pmoGuardar('BORRADOR')"
            style="padding:9px 18px;border:none;border-radius:6px;background:#718096;color:#fff;cursor:pointer;font-size:13px;font-family:var(--font);font-weight:500">
            💾 Guardar borrador
          </button>
          <button onclick="_pmoGuardar('ENVIADO')"
            style="padding:9px 18px;border:none;border-radius:6px;background:var(--color-secundario);color:#fff;cursor:pointer;font-size:13px;font-family:var(--font);font-weight:500">
            📨 Guardar y enviar
          </button>
        </div>

      </div>
    </div>

    <!-- Data para las selects de filas dinámicas -->
    <script>
      var _pmoOptsMotivos    = ${JSON.stringify(PM_MOTIVOS)};
      var _pmoOptsDistritos  = ${JSON.stringify(PM_DISTRITOS)};
      var _pmoOptsProyectos  = ${JSON.stringify(PM_PROYECTOS)};
      var _pmoOptsEmpresas   = ${JSON.stringify(PM_EMPRESAS_CLIENTE)};
    </script>`;

  _pmoFilasCount = 0;

  // Cargar filas existentes o agregar 1 vacía
  if (detallesData.length) {
    detallesData.forEach(d => _pmoAgregarFila(d));
  } else {
    _pmoAgregarFila();
  }
}

// ── Generar número correlativo ────────────────────────────────────
async function _pmoGenerarNumero(mes) {
  const [yyyy, mm] = mes.split('-');
  const anioCorto  = yyyy.slice(2);

  const { data } = await _supabase
    .from('planillas_movilidad')
    .select('numero_planilla')
    .eq('empresa_operadora_id', empresa_activa.id)
    .like('numero_planilla', `%-${mm}-${anioCorto}`);

  const numeros = (data || [])
    .map(r => parseInt((r.numero_planilla || '000').split('-')[0], 10))
    .filter(n => !isNaN(n));

  const siguiente = numeros.length ? Math.max(...numeros) + 1 : 1;
  return `${String(siguiente).padStart(3, '0')}-${mm}-${anioCorto}`;
}

// ── Actualiza DNI al cambiar trabajador ───────────────────────────
function _pmoSelTrabajador() {
  const sel   = document.getElementById('pmo-trabajador');
  const dniEl = document.getElementById('pmo-dni');
  if (!dniEl || !sel) return;
  const t = PM_TRABAJADORES.find(t => t.dni === sel.value);
  dniEl.value = t ? t.dni : sel.value || '';
}

// ── Actualiza número sugerido al cambiar mes ──────────────────────
async function _pmoMesCambio() {
  if (_pmoEditandoId) return; // no cambiar si estamos editando
  const mes = document.getElementById('pmo-mes')?.value;
  if (!mes) return;
  const num = await _pmoGenerarNumero(mes);
  const el  = document.getElementById('pmo-num');
  if (el) el.value = num;
}

// ── Agregar fila de detalle ───────────────────────────────────────
function _pmoAgregarFila(datos = null) {
  const tbody = document.getElementById('pmo-tabla-body');
  if (!tbody) return;

  const idx  = _pmoFilasCount++;
  const hoy  = new Date().toISOString().slice(0, 10);

  const motivos   = window._pmoOptsMotivos   || PM_MOTIVOS;
  const distritos = window._pmoOptsDistritos || PM_DISTRITOS;
  const proyectos = window._pmoOptsProyectos || PM_PROYECTOS;
  const empresas  = window._pmoOptsEmpresas  || PM_EMPRESAS_CLIENTE;

  const optsMotivos   = motivos.map(m =>
    `<option value="${escapar(m)}" ${datos?.motivo===m?'selected':''}>${escapar(m)}</option>`).join('');
  const optsOrigen    = distritos.map(d =>
    `<option value="${escapar(d)}" ${datos?.origen===d?'selected':''}>${escapar(d)}</option>`).join('');
  const optsDest      = distritos.map(d =>
    `<option value="${escapar(d)}" ${datos?.destino===d?'selected':''}>${escapar(d)}</option>`).join('');
  const optsProyectos = proyectos.map(p =>
    `<option value="${escapar(p)}" ${datos?.proyecto===p?'selected':''}>${escapar(p)}</option>`).join('');
  const optsEmpresas  = empresas.map(e =>
    `<option value="${escapar(e)}" ${datos?.empresa_cliente===e?'selected':''}>${escapar(e)}</option>`).join('');

  const tdStyle   = 'padding:3px 3px;border-bottom:1px solid var(--color-borde);vertical-align:top';
  const inputStyle = 'padding:5px 6px;border:1px solid var(--color-borde);border-radius:4px;width:100%;background:var(--color-bg-card);color:var(--color-texto);font-family:var(--font);font-size:11px;box-sizing:border-box';
  const selStyle   = 'padding:5px 4px;border:1px solid var(--color-borde);border-radius:4px;width:100%;background:var(--color-bg-card);color:var(--color-texto);font-family:var(--font);font-size:11px';

  const tr = document.createElement('tr');
  tr.id = `pmo-fila-${idx}`;
  tr.innerHTML = `
    <td style="${tdStyle};text-align:center;color:var(--color-texto-suave);font-size:11px;padding:7px 4px">${idx+1}</td>
    <td style="${tdStyle};min-width:110px">
      <input type="date" id="pmo-fecha-${idx}" value="${datos?.fecha || hoy}" onchange="_pmoRecalcTotal()" style="${inputStyle}">
    </td>
    <td style="${tdStyle};min-width:200px">
      <select id="pmo-motivo-${idx}" style="${selStyle}">
        ${optsMotivos}
      </select>
    </td>
    <td style="${tdStyle};min-width:120px">
      <select id="pmo-origen-${idx}" style="${selStyle}">
        <option value="">— Desde —</option>
        ${optsOrigen}
      </select>
    </td>
    <td style="${tdStyle};min-width:120px">
      <select id="pmo-destino-${idx}" style="${selStyle}">
        <option value="">— Hasta —</option>
        ${optsDest}
      </select>
    </td>
    <td style="${tdStyle};min-width:140px">
      <select id="pmo-proyecto-${idx}" style="${selStyle}">
        <option value="">— Proyecto —</option>
        ${optsProyectos}
        <option value="__otro__" ${datos?.proyecto && !PM_PROYECTOS.includes(datos.proyecto) ? 'selected' : ''}>Otro…</option>
      </select>
      <input type="text" id="pmo-proyecto-txt-${idx}"
        value="${datos?.proyecto && !PM_PROYECTOS.includes(datos.proyecto) ? escapar(datos.proyecto) : ''}"
        placeholder="Especificar proyecto"
        style="${inputStyle};margin-top:3px;display:${datos?.proyecto && !PM_PROYECTOS.includes(datos.proyecto) ? 'block' : 'none'}">
    </td>
    <td style="${tdStyle};min-width:140px">
      <select id="pmo-empresa-${idx}" style="${selStyle}">
        <option value="">— Empresa —</option>
        ${optsEmpresas}
      </select>
    </td>
    <td style="${tdStyle};min-width:90px;text-align:right">
      <input type="number" id="pmo-monto-${idx}" value="${datos?.monto || ''}" min="0" step="0.50"
        placeholder="0.00" onchange="_pmoRecalcTotal()" oninput="_pmoRecalcTotal()"
        style="${inputStyle};text-align:right;font-weight:600">
    </td>
    <td style="${tdStyle};text-align:center;padding:3px">
      <button onclick="_pmoEliminarFila(${idx})" title="Eliminar fila"
        style="padding:4px 7px;background:rgba(197,48,48,.1);color:#C53030;border:none;border-radius:4px;cursor:pointer;font-size:13px">✕</button>
    </td>`;

  tbody.appendChild(tr);

  // Mostrar input libre de proyecto
  const selProy = document.getElementById(`pmo-proyecto-${idx}`);
  if (selProy) {
    selProy.addEventListener('change', () => {
      const txtEl = document.getElementById(`pmo-proyecto-txt-${idx}`);
      if (txtEl) txtEl.style.display = selProy.value === '__otro__' ? 'block' : 'none';
    });
  }

  _pmoRecalcTotal();
}

// ── Eliminar fila ─────────────────────────────────────────────────
function _pmoEliminarFila(idx) {
  const tr = document.getElementById(`pmo-fila-${idx}`);
  if (tr) tr.remove();
  _pmoRecalcTotal();
  // Re-numerar visualmente
  document.querySelectorAll('#pmo-tabla-body tr').forEach((tr, i) => {
    const td = tr.querySelector('td:first-child');
    if (td) td.textContent = i + 1;
  });
}

// ── Recalcular total ──────────────────────────────────────────────
function _pmoRecalcTotal() {
  let total = 0;
  for (let i = 0; i < _pmoFilasCount; i++) {
    const el = document.getElementById(`pmo-monto-${i}`);
    if (el && el.closest('#pmo-tabla-body')) {
      total += parseFloat(el.value) || 0;
    }
  }
  const totalEl = document.getElementById('pmo-total');
  if (totalEl) totalEl.textContent = `S/ ${total.toFixed(2)}`;
}

// ── Recolectar filas del formulario ──────────────────────────────
function _pmoRecolectarFilas() {
  const filas = [];
  let orden   = 1;
  for (let i = 0; i < _pmoFilasCount; i++) {
    const tr = document.getElementById(`pmo-fila-${i}`);
    if (!tr || !tr.closest('#pmo-tabla-body')) continue;

    const fecha  = document.getElementById(`pmo-fecha-${i}`)?.value  || '';
    const motivo = document.getElementById(`pmo-motivo-${i}`)?.value || '';
    const monto  = parseFloat(document.getElementById(`pmo-monto-${i}`)?.value || '0');

    if (!fecha || !motivo) continue; // fila incompleta

    const selProy = document.getElementById(`pmo-proyecto-${i}`);
    let proyecto  = selProy?.value || '';
    if (proyecto === '__otro__') {
      proyecto = document.getElementById(`pmo-proyecto-txt-${i}`)?.value.trim() || '';
    }

    const empresa_cliente = document.getElementById(`pmo-empresa-${i}`)?.value || null;

    filas.push({
      orden,
      fecha,
      motivo,
      origen:          document.getElementById(`pmo-origen-${i}`)?.value  || null,
      destino:         document.getElementById(`pmo-destino-${i}`)?.value || null,
      proyecto:        proyecto || null,
      empresa_cliente: empresa_cliente || null,
      monto,
    });
    orden++;
  }
  return filas;
}

// ── Guardar planilla ──────────────────────────────────────────────
async function _pmoGuardar(estado) {
  const numPlan    = document.getElementById('pmo-num')?.value.trim();
  const mes        = document.getElementById('pmo-mes')?.value;
  const fecha      = document.getElementById('pmo-fecha')?.value;
  const selTrab    = document.getElementById('pmo-trabajador');
  const trabNombre = selTrab?.options[selTrab?.selectedIndex]?.text?.trim() || '';
  const trabDni    = document.getElementById('pmo-dni')?.value.trim();
  const firma      = document.getElementById('pmo-firma')?.checked || false;
  const notas      = document.getElementById('pmo-notas')?.value.trim() || null;

  if (!numPlan)    { mostrarToast('Ingresa el número de planilla', 'atencion'); return; }
  if (!mes)        { mostrarToast('Selecciona el período (mes)', 'atencion'); return; }
  if (!trabDni)    { mostrarToast('Selecciona un trabajador', 'atencion'); return; }

  const filas = _pmoRecolectarFilas();
  if (!filas.length) { mostrarToast('Agrega al menos una fila de detalle con fecha, motivo y monto', 'atencion'); return; }

  const totalGastos = filas.reduce((s, f) => s + f.monto, 0);

  try {
    let planillaId = _pmoEditandoId;

    const payload = {
      empresa_operadora_id: empresa_activa.id,
      numero_planilla:      numPlan,
      trabajador_nombre:    trabNombre,
      trabajador_dni:       trabDni,
      mes,
      fecha_emision:        fecha,
      total_gastos:         totalGastos,
      estado,
      firma_trabajador:     firma,
      notas,
      updated_at:           new Date().toISOString(),
    };

    if (_pmoEditandoId) {
      const { error } = await _supabase
        .from('planillas_movilidad')
        .update(payload)
        .eq('id', _pmoEditandoId);
      if (error) throw error;

      // Eliminar filas anteriores y reinsertar
      await _supabase.from('planilla_movilidad_detalles').delete().eq('planilla_id', _pmoEditandoId);
    } else {
      payload.creado_por = perfil_usuario?.id || null;
      const { data, error } = await _supabase
        .from('planillas_movilidad')
        .insert(payload)
        .select('id')
        .single();
      if (error) throw error;
      planillaId = data.id;
    }

    // Insertar filas de detalle
    const detallesPayload = filas.map(f => ({
      planilla_id:     planillaId,
      orden:           f.orden,
      fecha:           f.fecha,
      motivo:          f.motivo,
      origen:          f.origen,
      destino:         f.destino,
      proyecto:        f.proyecto,
      empresa_cliente: f.empresa_cliente,
      monto:           f.monto,
    }));

    if (detallesPayload.length) {
      const { error: errD } = await _supabase
        .from('planilla_movilidad_detalles')
        .insert(detallesPayload);
      if (errD) throw errD;
    }

    const estadoLabel = { BORRADOR: 'borrador guardado', ENVIADO: 'enviada', APROBADO: 'aprobada' }[estado] || 'guardada';
    mostrarToast(`✓ Planilla ${estadoLabel} correctamente`, 'exito');
    _pmoEditandoId = null;
    activarTab('pm-lista');

  } catch (err) {
    mostrarToast('Error al guardar: ' + (err.message || String(err)), 'error');
  }
}
