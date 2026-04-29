/* ============================================================
   NEXUM — Contabilidad: RH Recibidas (al nombre de la empresa)
   ============================================================ */

function renderTabRHRecibidas(area) {
  const hoy = new Date();
  const mesActual = String(hoy.getMonth() + 1).padStart(2, '0');
  const anioActual = hoy.getFullYear();

  area.innerHTML = `
    <div class="fadeIn">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          <select id="rhr-mes" style="padding:8px 12px;border:1px solid var(--color-borde);border-radius:6px;background:var(--color-fondo);color:var(--color-texto);font-size:13px;font-family:var(--font)">
            ${Array.from({length:12},(_,i)=>{
              const m = String(i+1).padStart(2,'0');
              const nom = new Date(2000,i,1).toLocaleString('es-PE',{month:'long'});
              return `<option value="${m}" ${m===mesActual?'selected':''}>${nom.charAt(0).toUpperCase()+nom.slice(1)}</option>`;
            }).join('')}
          </select>
          <select id="rhr-anio" style="padding:8px 12px;border:1px solid var(--color-borde);border-radius:6px;background:var(--color-fondo);color:var(--color-texto);font-size:13px;font-family:var(--font)">
            ${[anioActual-1, anioActual, anioActual+1].map(a=>`<option value="${a}" ${a===anioActual?'selected':''}>${a}</option>`).join('')}
          </select>
          <select id="rhr-estado" style="padding:8px 12px;border:1px solid var(--color-borde);border-radius:6px;background:var(--color-fondo);color:var(--color-texto);font-size:13px;font-family:var(--font)">
            <option value="">Todos los estados</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="PAGADO">Pagado</option>
            <option value="CANCELADO">Cancelado</option>
          </select>
          <button onclick="cargarRHRecibidas()" style="padding:8px 14px;background:var(--color-fondo);color:var(--color-texto);border:1px solid var(--color-borde);border-radius:6px;cursor:pointer;font-family:var(--font);font-size:13px">🔍 Filtrar</button>
        </div>
        <div style="display:flex;gap:8px;">
          <button onclick="exportarExcelRHRecibidas()" style="padding:8px 14px;background:var(--color-fondo);color:var(--color-texto);border:1px solid var(--color-borde);border-radius:6px;cursor:pointer;font-family:var(--font);font-size:13px">📥 Exportar Excel</button>
          <button onclick="document.getElementById('rhr-file-input').click()" style="padding:8px 14px;background:var(--color-fondo);color:var(--color-texto);border:1px solid var(--color-borde);border-radius:6px;cursor:pointer;font-family:var(--font);font-size:13px">📂 Importar Excel</button>
          <input type="file" id="rhr-file-input" accept=".xlsx,.xls" style="display:none" onchange="procesarImportRHR(this)">
          <button onclick="abrirModalRHR()" style="padding:8px 16px;background:var(--color-secundario);color:#fff;border:none;border-radius:6px;cursor:pointer;font-family:var(--font);font-size:13px;font-weight:500">+ Nuevo RH</button>
        </div>
      </div>
      <div id="rhr-resumen" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;"></div>
      <div id="rhr-tabla-wrap" style="overflow-x:auto;">
        <div class="cargando"><div class="spinner"></div><span>Cargando…</span></div>
      </div>
    </div>
  `;

  cargarRHRecibidas();
}

async function cargarRHRecibidas() {
  const mes    = document.getElementById('rhr-mes')?.value;
  const anio   = document.getElementById('rhr-anio')?.value;
  const estado = document.getElementById('rhr-estado')?.value;
  const wrap   = document.getElementById('rhr-tabla-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="cargando"><div class="spinner"></div><span>Cargando…</span></div>';

  const desde = `${anio}-${mes}-01`;
  const hasta = `${anio}-${mes}-${new Date(anio, mes, 0).getDate()}`;

  // Fuente única: rh_registros (tabla maestra compartida con Tributaria)
  let q = _supabase.from('rh_registros')
    .select('*, prestadores_servicios(nombre, dni)')
    .eq('empresa_operadora_id', empresa_activa.id)
    .gte('fecha_emision', desde).lte('fecha_emision', hasta)
    .order('fecha_emision', { ascending: false });

  if (estado === 'PENDIENTE')  q = q.eq('conciliado', false).eq('estado', 'EMITIDO');
  else if (estado === 'PAGADO')    q = q.eq('conciliado', true);
  else if (estado === 'CANCELADO') q = q.eq('estado', 'ANULADO');

  const { data, error } = await q;
  if (error) { wrap.innerHTML = `<p class="error-texto">Error: ${escapar(error.message)}</p>`; return; }

  const filas = data || [];

  const totalBruto = filas.reduce((s,r) => s + Number(r.monto_bruto||0), 0);
  const totalRet   = filas.reduce((s,r) => s + Number(r.monto_retencion||0), 0);
  const totalNeto  = filas.reduce((s,r) => s + Number(r.monto_neto||0), 0);
  const pendientes = filas.filter(r => !r.conciliado && r.estado === 'EMITIDO').length;
  const resumen    = document.getElementById('rhr-resumen');
  if (resumen) resumen.innerHTML = `
    <div style="background:var(--color-secundario);color:#fff;padding:12px 16px;border-radius:8px;min-width:140px">
      <div style="font-size:11px;opacity:.8">RENTA BRUTA</div>
      <div style="font-size:18px;font-weight:700">${formatearMoneda(totalBruto)}</div>
    </div>
    <div style="background:var(--color-critico);color:#fff;padding:12px 16px;border-radius:8px;min-width:140px">
      <div style="font-size:11px;opacity:.8">RETENCIÓN</div>
      <div style="font-size:18px;font-weight:700">${formatearMoneda(totalRet)}</div>
    </div>
    <div style="background:var(--color-exito);color:#fff;padding:12px 16px;border-radius:8px;min-width:140px">
      <div style="font-size:11px;opacity:.8">RENTA NETA A PAGAR</div>
      <div style="font-size:18px;font-weight:700">${formatearMoneda(totalNeto)}</div>
    </div>
    <div style="background:${pendientes>0?'var(--color-atencion)':'#4A5568'};color:#fff;padding:12px 16px;border-radius:8px;min-width:120px">
      <div style="font-size:11px;opacity:.8">PENDIENTES</div>
      <div style="font-size:18px;font-weight:700">${pendientes}</div>
    </div>
  `;

  if (!filas.length) {
    wrap.innerHTML = '<p style="text-align:center;color:var(--color-texto-suave);padding:40px">Sin RH recibidas en este período.</p>';
    return;
  }

  wrap.innerHTML = `
    <table class="tabla-nexum">
      <thead><tr>
        <th>Fecha</th><th>N° RH</th><th>N° Doc</th>
        <th>Emisor</th><th>Concepto</th><th>Mon.</th>
        <th style="text-align:right">Renta Bruta</th>
        <th style="text-align:right">Retención</th>
        <th style="text-align:right">Renta Neta</th>
        <th>Estado</th><th style="text-align:center">Acc.</th>
      </tr></thead>
      <tbody>
        ${filas.map(r => {
          const estPago  = r.estado === 'ANULADO' ? 'CANCELADO' : r.conciliado ? 'PAGADO' : 'PENDIENTE';
          const estColor = estPago==='PAGADO'?'#2F855A':estPago==='CANCELADO'?'#4A5568':'#D69E2E';
          const mon      = r.moneda === 'USD' ? 'USD' : 'PEN';
          const nombre   = r.prestadores_servicios?.nombre || r.nombre_emisor || '—';
          const docNum   = r.prestadores_servicios?.dni    || r.nro_doc_emisor || '—';
          return `
          <tr>
            <td style="white-space:nowrap">${formatearFecha(r.fecha_emision)}</td>
            <td style="font-weight:600">${escapar(r.numero_rh||'—')}</td>
            <td>${escapar(docNum)}</td>
            <td>${escapar(truncar(nombre,25))}</td>
            <td>${escapar(truncar(r.concepto||'—',28))}</td>
            <td>${escapar(r.moneda||'PEN')}</td>
            <td style="text-align:right">${formatearMoneda(r.monto_bruto, mon)}</td>
            <td style="text-align:right;color:var(--color-critico)">${formatearMoneda(r.monto_retencion, mon)}</td>
            <td style="text-align:right;font-weight:600;color:var(--color-exito)">${formatearMoneda(r.monto_neto, mon)}</td>
            <td><span style="padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:${estColor};color:#fff">${estPago}</span></td>
            <td style="text-align:center;white-space:nowrap">
              <button onclick="abrirModalRHR('${r.id}')" style="padding:4px 8px;background:rgba(44,82,130,.1);color:var(--color-secundario);border:none;border-radius:4px;cursor:pointer;font-size:13px">✏️</button>
              <button onclick="eliminarRHR('${r.id}')" style="padding:4px 8px;background:rgba(197,48,48,.1);color:#C53030;border:none;border-radius:4px;cursor:pointer;font-size:13px">🗑️</button>
            </td>
          </tr>`; }).join('')}
      </tbody>
    </table>
    <p style="font-size:12px;color:var(--color-texto-suave);margin-top:8px">${filas.length} registro(s)</p>
  `;
}

async function abrirModalRHR(id = null) {
  let item = null;
  if (id) {
    const { data } = await _supabase.from('rh_registros')
      .select('*, prestadores_servicios(nombre, dni)')
      .eq('id', id).single();
    item = data;
  }
  const hoy       = new Date().toISOString().slice(0,10);
  const monedaVal = item?.moneda === 'USD' ? 'USD' : 'PEN';
  const nroDoc    = item?.prestadores_servicios?.dni  || item?.nro_doc_emisor || '';
  const nombre    = item?.prestadores_servicios?.nombre || item?.nombre_emisor || '';

  const mc = document.getElementById('modal-container');
  mc.innerHTML = `
    <div class="modal-overlay" style="display:flex" onclick="if(event.target===this)cerrarModalRHR()">
      <div class="modal" style="max-width:580px;width:95%;max-height:90vh;overflow-y:auto">
        <div class="modal-header">
          <h3>🧾 ${id?'Editar':'Nuevo'} RH Recibido</h3>
          <button class="modal-cerrar" onclick="cerrarModalRHR()">✕</button>
        </div>
        <div class="modal-body">
          <div id="rhr-alerta" class="alerta-error"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="campo"><label>Fecha Emisión <span class="req">*</span></label>
              <input type="date" id="rhr-fecha" value="${item?.fecha_emision||hoy}"></div>
            <div class="campo"><label>N° RH <span class="req">*</span></label>
              <input type="text" id="rhr-nro" value="${escapar(item?.numero_rh||'')}" placeholder="E001-68"></div>
            <div class="campo"><label>DNI / RUC Emisor <span class="req">*</span></label>
              <input type="text" id="rhr-nro-doc" value="${escapar(nroDoc)}" maxlength="11" placeholder="12345678"></div>
            <div class="campo"><label>Nombre Emisor <span class="req">*</span></label>
              <input type="text" id="rhr-nombre" value="${escapar(nombre)}"></div>
            <div class="campo" style="grid-column:span 2"><label>Concepto / Servicio <span class="req">*</span></label>
              <input type="text" id="rhr-desc" value="${escapar(item?.concepto||'')}"></div>
            <div class="campo"><label>Moneda</label>
              <select id="rhr-moneda">
                <option value="PEN" ${monedaVal==='PEN'?'selected':''}>Soles (PEN)</option>
                <option value="USD" ${monedaVal==='USD'?'selected':''}>Dólares (USD)</option>
              </select></div>
            <div class="campo"><label>Estado</label>
              <select id="rhr-estado" ${item?.conciliado?'disabled':''}>
                <option value="EMITIDO" ${(item?.estado||'EMITIDO')==='EMITIDO'?'selected':''}>Emitido</option>
                <option value="ANULADO" ${item?.estado==='ANULADO'?'selected':''}>Anulado</option>
              </select>
              ${item?.conciliado?'<small style="color:#2F855A">✓ Pagado vía conciliación</small>':''}</div>
            <div class="campo"><label>Renta Bruta <span class="req">*</span></label>
              <input type="number" id="rhr-bruta" step="0.01" value="${item?.monto_bruto||''}" onchange="calcRHR()"></div>
            <div class="campo"><label>Retención</label>
              <input type="number" id="rhr-retencion" step="0.01" value="${item?.monto_retencion||0}" onchange="calcRHR()"></div>
            <div class="campo" style="grid-column:span 2">
              <label style="font-weight:700;color:var(--color-secundario)">Renta Neta</label>
              <input type="number" id="rhr-neta" step="0.01" value="${item?.monto_neto||''}">
              <small style="color:var(--color-texto-suave)">Bruta − Retención (editable)</small></div>
            <div class="campo" style="grid-column:span 2"><label>Observaciones</label>
              <input type="text" id="rhr-obs" value="${escapar(item?.observaciones||'')}"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secundario" onclick="cerrarModalRHR()">Cancelar</button>
          <button class="btn btn-primario" onclick="guardarRHR('${id||''}')">💾 Guardar</button>
        </div>
      </div>
    </div>
  `;
}

function calcRHR() {
  const bruta = parseFloat(document.getElementById('rhr-bruta')?.value)||0;
  const ret   = parseFloat(document.getElementById('rhr-retencion')?.value)||0;
  const el    = document.getElementById('rhr-neta');
  if (el) el.value = (bruta - ret).toFixed(2);
}

function cerrarModalRHR() {
  const mc = document.getElementById('modal-container');
  if (mc) mc.innerHTML = '';
}

async function guardarRHR(id) {
  const alerta  = document.getElementById('rhr-alerta');
  alerta.classList.remove('visible');

  const fecha   = document.getElementById('rhr-fecha').value;
  const nroRH   = document.getElementById('rhr-nro').value.trim();
  const nroDoc  = document.getElementById('rhr-nro-doc').value.trim();
  const nombre  = document.getElementById('rhr-nombre').value.trim();
  const concepto = document.getElementById('rhr-desc').value.trim();
  const bruta   = parseFloat(document.getElementById('rhr-bruta').value);
  const neta    = parseFloat(document.getElementById('rhr-neta').value);

  if (!fecha||!nroRH||!nroDoc||!nombre||!concepto||isNaN(bruta)||isNaN(neta)) {
    alerta.textContent = 'Complete todos los campos requeridos (*)';
    alerta.classList.add('visible'); return;
  }

  // Buscar o crear prestador por DNI/RUC
  let { data: ps } = await _supabase
    .from('prestadores_servicios').select('id').eq('dni', nroDoc).maybeSingle();
  if (!ps) {
    const { data: nuevo, error: errPS } = await _supabase
      .from('prestadores_servicios')
      .insert({ dni: nroDoc, nombre, ruc: nroDoc.length === 11 ? nroDoc : null, activo: true })
      .select('id').single();
    if (errPS) { alerta.textContent = 'Error al registrar prestador: ' + errPS.message; alerta.classList.add('visible'); return; }
    ps = nuevo;
  }

  const ret    = parseFloat(document.getElementById('rhr-retencion').value) || 0;
  const moneda = document.getElementById('rhr-moneda').value;
  const estado = document.getElementById('rhr-estado')?.value || 'EMITIDO';

  const payload = {
    empresa_operadora_id: empresa_activa.id,
    prestador_id:         ps.id,
    periodo:              fecha.slice(0, 7),
    fecha_emision:        fecha,
    numero_rh:            nroRH,
    concepto,
    moneda,
    monto_bruto:          bruta,
    tiene_retencion:      ret > 0,
    porcentaje_retencion: bruta > 0 ? Math.round(ret / bruta * 10000) / 100 : 0,
    monto_retencion:      ret,
    monto_neto:           neta,
    estado,
    observaciones:        document.getElementById('rhr-obs').value.trim() || null,
    nro_doc_emisor:       nroDoc,
    nombre_emisor:        nombre,
    usuario_id:           perfil_usuario?.id || null,
  };

  let error;
  if (id) ({ error } = await _supabase.from('rh_registros').update(payload).eq('id', id));
  else    ({ error } = await _supabase.from('rh_registros').insert(payload));

  if (error) { alerta.textContent = 'Error: ' + error.message; alerta.classList.add('visible'); return; }
  mostrarToast(id ? 'RH actualizado.' : 'RH registrado.', 'exito');
  cerrarModalRHR();
  cargarRHRecibidas();
}

async function eliminarRHR(id) {
  const ok = await confirmar('¿Eliminar este RH? Esta acción no se puede deshacer.', { btnOk: 'Eliminar', btnColor: '#C53030' });
  if (!ok) return;
  const { error } = await _supabase.from('rh_registros').delete().eq('id', id);
  if (error) { mostrarToast('Error al eliminar: ' + error.message, 'error'); return; }
  mostrarToast('Registro eliminado.', 'exito');
  cargarRHRecibidas();
}

let _rhrDatosPreview = [];

function procesarImportRHR(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb   = XLSX.read(e.target.result, { type: 'array', cellDates: true });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
      if (rows.length < 2) { mostrarToast('El archivo está vacío.', 'atencion'); return; }

      const toDate = v => {
        if (!v) return null;
        if (v instanceof Date) return v.toISOString().slice(0,10);
        const s = v.toString().trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) { const [d,m,y]=s.split('/'); return `${y}-${m}-${d}`; }
        const d = new Date(s); return isNaN(d) ? null : d.toISOString().slice(0,10);
      };
      const toNum = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

      // Plantilla RH (0-indexed): A(0)=fecha, B(1)=tipo_doc_emitido("RH" — ignorar),
      // C(2)=nro_doc_emitido→nro_rh, D(3)=estado_doc_emitido→estado_pago,
      // E(4)=tipo_doc_emisor, F(5)=nro_doc_emisor, G(6)=nombre_emisor,
      // H(7)=tipo_renta(ignorar), I(8)=gratuito(ignorar), J(9)=descripcion,
      // K(10)=observacion, L(11)=moneda_operacion, M(12)=renta_bruta,
      // N(13)=impuesto_renta→retencion, O(14)=renta_neta
      _rhrDatosPreview = rows.slice(1).map((r, i) => {
        const fecha  = toDate(r[0]);
        const nroRH  = r[2]?.toString().trim() || null;
        const bruta  = toNum(r[12]);
        const ok     = !!fecha && !!nroRH && bruta > 0;
        const estadoDoc = (r[3] || '').toString().trim().toUpperCase();
        return {
          _fila: i + 2, _ok: ok,
          _error: !fecha ? 'Sin fecha' : !nroRH ? 'Sin N° RH' : bruta <= 0 ? 'Sin monto' : null,
          empresa_id:      empresa_activa.id,
          fecha_emision:   fecha,
          nro_rh:          nroRH,
          tipo_doc_emisor: r[4]?.toString().trim() || 'DNI',
          nro_doc_emisor:  r[5]?.toString().trim() || '',
          nombre_emisor:   r[6]?.toString().trim() || '',
          descripcion:     r[9]?.toString().trim() || '',
          observaciones:   r[10]?.toString().trim() || null,
          moneda:          r[11]?.toString().trim() || 'SOLES',
          renta_bruta:     bruta,
          retencion:       toNum(r[13]),
          renta_neta:      toNum(r[14]),
          estado_pago:     estadoDoc === 'ANULADO' ? 'CANCELADO' : 'PENDIENTE',
          fecha_pago:      null,
          nro_mbd:         null,
          creado_por:      perfil_usuario.id,
          fecha_actualizacion: new Date().toISOString(),
        };
      });

      const validos = _rhrDatosPreview.filter(r => r._ok).length;
      const errores = _rhrDatosPreview.length - validos;

      const mc = document.getElementById('modal-container');
      mc.innerHTML = `
        <div class="modal-overlay" style="display:flex" onclick="if(event.target===this)_cerrarPrevRHR()">
          <div class="modal" style="max-width:820px;width:95%;max-height:90vh;overflow-y:auto">
            <div class="modal-header">
              <h3>👁️ Vista previa — ${_rhrDatosPreview.length} registros</h3>
              <button class="modal-cerrar" onclick="_cerrarPrevRHR()">✕</button>
            </div>
            <div class="modal-body">
              <p style="margin-bottom:12px;font-size:13px;color:var(--color-texto-suave)">
                ✅ <strong>${validos}</strong> válidos  ⚠️ <strong>${errores}</strong> con error (se omitirán)
              </p>
              <div style="overflow-x:auto;max-height:320px;overflow-y:auto">
                <table class="tabla-nexum" style="font-size:12px">
                  <thead><tr>
                    <th>#</th><th>Fecha</th><th>N° RH</th><th>Emisor</th>
                    <th>Desc.</th><th>Mon.</th><th style="text-align:right">Bruta</th>
                    <th style="text-align:right">Ret.</th><th style="text-align:right">Neta</th><th>Estado</th>
                  </tr></thead>
                  <tbody>
                    ${_rhrDatosPreview.map(r => `
                      <tr ${!r._ok ? 'style="background:rgba(197,48,48,.05)"' : ''}>
                        <td style="font-size:11px;color:var(--color-texto-suave)">${r._fila}</td>
                        <td style="white-space:nowrap">${r.fecha_emision || `<span style="color:#C53030">${r._error}</span>`}</td>
                        <td style="font-weight:600">${escapar(r.nro_rh||'—')}</td>
                        <td style="font-size:11px">${escapar((r.nombre_emisor||'—').slice(0,20))}</td>
                        <td style="font-size:11px">${escapar((r.descripcion||'—').slice(0,20))}</td>
                        <td>${escapar(r.moneda||'—')}</td>
                        <td style="text-align:right">${formatearMoneda(r.renta_bruta, r.moneda==='DOLARES'?'USD':'PEN')}</td>
                        <td style="text-align:right;color:var(--color-critico)">${formatearMoneda(r.retencion, r.moneda==='DOLARES'?'USD':'PEN')}</td>
                        <td style="text-align:right;font-weight:600;color:var(--color-exito)">${formatearMoneda(r.renta_neta, r.moneda==='DOLARES'?'USD':'PEN')}</td>
                        <td>${r._ok
                          ? '<span style="font-size:10px;background:#2F855A;color:#fff;padding:2px 6px;border-radius:8px">OK</span>'
                          : `<span style="font-size:10px;background:#C53030;color:#fff;padding:2px 6px;border-radius:8px">${escapar(r._error)}</span>`
                        }</td>
                      </tr>`).join('')}
                  </tbody>
                </table>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secundario" onclick="_cerrarPrevRHR()">Cancelar</button>
              <button class="btn btn-primario" onclick="_confirmarImportRHR()" id="btn-conf-rhr"
                ${!validos ? 'disabled' : ''}>✅ Importar ${validos} registro(s)</button>
            </div>
          </div>
        </div>`;
    } catch(err) {
      mostrarToast('Error al leer el archivo: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

function _cerrarPrevRHR() {
  _rhrDatosPreview = [];
  const mc = document.getElementById('modal-container');
  if (mc) mc.innerHTML = '';
}

async function _confirmarImportRHR() {
  const validos = _rhrDatosPreview.filter(r => r._ok);
  if (!validos.length) return;

  const btn = document.getElementById('btn-conf-rhr');
  if (btn) { btn.disabled = true; btn.textContent = 'Importando…'; }

  let ok = 0; let errCount = 0;

  for (const r of validos) {
    const dni = r.nro_doc_emisor?.toString().trim();
    if (!dni) { errCount++; continue; }

    // Buscar o crear prestador por DNI/RUC
    let { data: ps } = await _supabase
      .from('prestadores_servicios')
      .select('id')
      .eq('dni', dni)
      .maybeSingle();

    if (!ps) {
      const { data: nuevo, error: errPS } = await _supabase
        .from('prestadores_servicios')
        .insert({
          dni:    dni,
          nombre: r.nombre_emisor || dni,
          ruc:    dni.length === 11 ? dni : null,
          activo: true,
        })
        .select('id')
        .single();
      if (errPS) { errCount++; continue; }
      ps = nuevo;
    }

    const monedaNorm = (r.moneda || 'SOLES').toUpperCase() === 'DOLARES' ? 'USD' : 'PEN';
    const estadoDoc  = r.estado_pago === 'CANCELADO' ? 'ANULADO' : 'EMITIDO';
    const bruta = r.renta_bruta || 0;
    const ret   = r.retencion   || 0;

    const { error } = await _supabase.from('rh_registros').upsert({
      empresa_operadora_id:  empresa_activa.id,
      prestador_id:          ps.id,
      periodo:               r.fecha_emision?.slice(0, 7) || null,
      fecha_emision:         r.fecha_emision,
      numero_rh:             r.nro_rh,
      concepto:              r.descripcion || 'SERVICIO',
      moneda:                monedaNorm,
      monto_bruto:           bruta,
      tiene_retencion:       ret > 0,
      porcentaje_retencion:  bruta > 0 ? Math.round(ret / bruta * 10000) / 100 : 0,
      monto_retencion:       ret,
      monto_neto:            r.renta_neta || 0,
      estado:                estadoDoc,
      observaciones:         r.observaciones || null,
      nro_doc_emisor:        dni,
      nombre_emisor:         r.nombre_emisor || null,
      usuario_id:            perfil_usuario?.id || null,
    }, {
      onConflict:       'empresa_operadora_id,prestador_id,numero_rh',
      ignoreDuplicates: true,
    });

    if (error) errCount++; else ok++;
  }

  _cerrarPrevRHR();
  if (ok === 0 && errCount > 0) {
    mostrarToast(`Error al importar RH. Revisa que el DNI/RUC del emisor esté completo.`, 'error');
  } else {
    const partes = [`✓ ${ok} RH importado(s)`];
    if (errCount) partes.push(`${errCount} errores`);
    mostrarToast(partes.join(' · '), errCount ? 'atencion' : 'exito');
  }
  cargarRHRecibidas();
}

async function exportarExcelRHRecibidas() {
  const mes  = document.getElementById('rhr-mes')?.value;
  const anio = document.getElementById('rhr-anio')?.value;
  const desde = `${anio}-${mes}-01`;
  const hasta = `${anio}-${mes}-${new Date(anio, mes, 0).getDate()}`;

  const { data } = await _supabase.from('rh_registros')
    .select('*, prestadores_servicios(nombre, dni)')
    .eq('empresa_operadora_id', empresa_activa.id)
    .gte('fecha_emision', desde).lte('fecha_emision', hasta)
    .order('fecha_emision');

  if (!data?.length) { mostrarToast('Sin datos para exportar.', 'atencion'); return; }

  const cab = ['Fecha Emisión','N° RH','N° Doc Emisor','Nombre Emisor',
    'Concepto','Moneda','Renta Bruta','Retención','Renta Neta',
    'Estado','Fecha Pago','Observaciones'];
  const filas = data.map(r => {
    const estPago = r.estado==='ANULADO'?'CANCELADO':r.conciliado?'PAGADO':'PENDIENTE';
    return [
      r.fecha_emision, r.numero_rh,
      r.prestadores_servicios?.dni    || r.nro_doc_emisor,
      r.prestadores_servicios?.nombre || r.nombre_emisor,
      r.concepto, r.moneda,
      r.monto_bruto, r.monto_retencion, r.monto_neto,
      estPago, r.fecha_conciliacion, r.observaciones,
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([cab, ...filas]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'RH Recibidas');
  XLSX.writeFile(wb, `RH_Recibidas_${empresa_activa.nombre_corto}_${anio}${mes}.xlsx`);
  mostrarToast('Archivo exportado.', 'exito');
}
