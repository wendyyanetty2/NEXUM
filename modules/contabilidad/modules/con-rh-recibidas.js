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

  let q = _supabase.from('contabilidad_rh_recibidas').select('*')
    .eq('empresa_id', empresa_activa.id)
    .gte('fecha_emision', desde).lte('fecha_emision', hasta)
    .order('fecha_emision', { ascending: false });
  if (estado) q = q.eq('estado_pago', estado);

  const { data, error } = await q;
  if (error) { wrap.innerHTML = `<p class="error-texto">Error: ${escapar(error.message)}</p>`; return; }

  const filas = data || [];

  const totalBruto = filas.reduce((s,r) => s + Number(r.renta_bruta||0), 0);
  const totalRet   = filas.reduce((s,r) => s + Number(r.retencion||0), 0);
  const totalNeto  = filas.reduce((s,r) => s + Number(r.renta_neta||0), 0);
  const pendientes = filas.filter(r => r.estado_pago === 'PENDIENTE').length;
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
        <th>Fecha</th><th>N° RH</th><th>Tipo Doc</th><th>N° Documento</th>
        <th>Emisor</th><th>Descripción</th><th>Moneda</th>
        <th style="text-align:right">Renta Bruta</th>
        <th style="text-align:right">Retención</th>
        <th style="text-align:right">Renta Neta</th>
        <th>Estado</th><th>N° MBD</th><th style="text-align:center">Acc.</th>
      </tr></thead>
      <tbody>
        ${filas.map(r => `
          <tr>
            <td style="white-space:nowrap">${formatearFecha(r.fecha_emision)}</td>
            <td style="font-weight:600">${escapar(r.nro_rh)}</td>
            <td>${escapar(r.tipo_doc_emisor)}</td>
            <td>${escapar(r.nro_doc_emisor)}</td>
            <td>${escapar(truncar(r.nombre_emisor,25))}</td>
            <td>${escapar(truncar(r.descripcion,28))}</td>
            <td>${escapar(r.moneda)}</td>
            <td style="text-align:right">${formatearMoneda(r.renta_bruta, r.moneda==='DOLARES'?'USD':'PEN')}</td>
            <td style="text-align:right;color:var(--color-critico)">${formatearMoneda(r.retencion, r.moneda==='DOLARES'?'USD':'PEN')}</td>
            <td style="text-align:right;font-weight:600;color:var(--color-exito)">${formatearMoneda(r.renta_neta, r.moneda==='DOLARES'?'USD':'PEN')}</td>
            <td><span style="padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:${r.estado_pago==='PAGADO'?'#2F855A':r.estado_pago==='CANCELADO'?'#4A5568':'#D69E2E'};color:#fff">${escapar(r.estado_pago)}</span></td>
            <td>${escapar(r.nro_mbd||'—')}</td>
            <td style="text-align:center;white-space:nowrap">
              <button onclick="abrirModalRHR('${r.id}')" style="padding:4px 8px;background:rgba(44,82,130,.1);color:var(--color-secundario);border:none;border-radius:4px;cursor:pointer;font-size:13px">✏️</button>
              <button onclick="eliminarRHR('${r.id}')" style="padding:4px 8px;background:rgba(197,48,48,.1);color:#C53030;border:none;border-radius:4px;cursor:pointer;font-size:13px">🗑️</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <p style="font-size:12px;color:var(--color-texto-suave);margin-top:8px">${filas.length} registro(s)</p>
  `;
}

async function abrirModalRHR(id = null) {
  let item = null;
  if (id) {
    const { data } = await _supabase.from('contabilidad_rh_recibidas').select('*').eq('id', id).single();
    item = data;
  }
  const hoy = new Date().toISOString().slice(0,10);

  const mc = document.getElementById('modal-container');
  mc.innerHTML = `
    <div class="modal-overlay" style="display:flex" onclick="if(event.target===this)cerrarModalRHR()">
      <div class="modal" style="max-width:640px;width:95%;max-height:90vh;overflow-y:auto">
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
              <input type="text" id="rhr-nro" value="${escapar(item?.nro_rh||'')}" placeholder="E001-68"></div>
            <div class="campo"><label>Tipo Doc Emisor <span class="req">*</span></label>
              <select id="rhr-tipo-doc">
                <option value="DNI" ${(item?.tipo_doc_emisor||'DNI')==='DNI'?'selected':''}>DNI</option>
                <option value="RUC" ${item?.tipo_doc_emisor==='RUC'?'selected':''}>RUC</option>
              </select></div>
            <div class="campo"><label>N° Doc Emisor <span class="req">*</span></label>
              <input type="text" id="rhr-nro-doc" value="${escapar(item?.nro_doc_emisor||'')}" maxlength="11"></div>
            <div class="campo" style="grid-column:span 2"><label>Nombre / Razón Social Emisor <span class="req">*</span></label>
              <input type="text" id="rhr-nombre" value="${escapar(item?.nombre_emisor||'')}"></div>
            <div class="campo" style="grid-column:span 2"><label>Descripción del Servicio <span class="req">*</span></label>
              <input type="text" id="rhr-desc" value="${escapar(item?.descripcion||'')}"></div>
            <div class="campo"><label>Moneda <span class="req">*</span></label>
              <select id="rhr-moneda">
                <option value="SOLES" ${(item?.moneda||'SOLES')==='SOLES'?'selected':''}>Soles</option>
                <option value="DOLARES" ${item?.moneda==='DOLARES'?'selected':''}>Dólares</option>
              </select></div>
            <div class="campo"><label>Renta Bruta <span class="req">*</span></label>
              <input type="number" id="rhr-bruta" step="0.01" value="${item?.renta_bruta||''}" onchange="calcRHR()"></div>
            <div class="campo"><label>Retención (8%)</label>
              <input type="number" id="rhr-retencion" step="0.01" value="${item?.retencion||0}" onchange="calcRHR()"></div>
            <div class="campo"><label style="font-weight:700;color:var(--color-secundario)">Renta Neta <span class="req">*</span></label>
              <input type="number" id="rhr-neta" step="0.01" value="${item?.renta_neta||''}">
              <small style="color:var(--color-texto-suave)">Renta Bruta − Retención</small></div>
            <div class="campo"><label>Estado de Pago <span class="req">*</span></label>
              <select id="rhr-estado-pago">
                ${['PENDIENTE','PAGADO','CANCELADO'].map(e=>`<option value="${e}" ${(item?.estado_pago||'PENDIENTE')===e?'selected':''}>${e}</option>`).join('')}
              </select></div>
            <div class="campo"><label>Fecha de Pago</label>
              <input type="date" id="rhr-fecha-pago" value="${item?.fecha_pago||''}"></div>
            <div class="campo"><label>N° Movimiento MBD</label>
              <input type="text" id="rhr-nro-mbd" value="${escapar(item?.nro_mbd||'')}" placeholder="Referencia MBD"></div>
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
  const alerta = document.getElementById('rhr-alerta');
  alerta.classList.remove('visible');

  const fecha  = document.getElementById('rhr-fecha').value;
  const nroRH  = document.getElementById('rhr-nro').value.trim();
  const nroDoc = document.getElementById('rhr-nro-doc').value.trim();
  const nombre = document.getElementById('rhr-nombre').value.trim();
  const desc   = document.getElementById('rhr-desc').value.trim();
  const bruta  = parseFloat(document.getElementById('rhr-bruta').value);
  const neta   = parseFloat(document.getElementById('rhr-neta').value);

  if (!fecha||!nroRH||!nroDoc||!nombre||!desc||isNaN(bruta)||isNaN(neta)) {
    alerta.textContent = 'Complete todos los campos requeridos (*)'; alerta.classList.add('visible'); return;
  }

  const payload = {
    empresa_id:     empresa_activa.id,
    fecha_emision:  fecha,
    nro_rh:         nroRH,
    tipo_doc_emisor: document.getElementById('rhr-tipo-doc').value,
    nro_doc_emisor:  nroDoc,
    nombre_emisor:   nombre,
    descripcion:     desc,
    moneda:          document.getElementById('rhr-moneda').value,
    renta_bruta:     bruta,
    retencion:       parseFloat(document.getElementById('rhr-retencion').value)||0,
    renta_neta:      neta,
    estado_pago:     document.getElementById('rhr-estado-pago').value,
    fecha_pago:      document.getElementById('rhr-fecha-pago').value||null,
    nro_mbd:         document.getElementById('rhr-nro-mbd').value.trim()||null,
    observaciones:   document.getElementById('rhr-obs').value.trim()||null,
    creado_por:      perfil_usuario.id,
    fecha_actualizacion: new Date().toISOString(),
  };

  let error;
  if (id) ({ error } = await _supabase.from('contabilidad_rh_recibidas').update(payload).eq('id', id));
  else    ({ error } = await _supabase.from('contabilidad_rh_recibidas').insert(payload));

  if (error) { alerta.textContent = 'Error: ' + error.message; alerta.classList.add('visible'); return; }
  mostrarToast(id ? 'RH actualizado.' : 'RH registrado.', 'exito');
  cerrarModalRHR();
  cargarRHRecibidas();
}

async function eliminarRHR(id) {
  const ok = await confirmar('¿Eliminar este RH recibido?', { btnOk: 'Eliminar', btnColor: '#C53030' });
  if (!ok) return;
  const { error } = await _supabase.from('contabilidad_rh_recibidas').delete().eq('id', id);
  if (error) { mostrarToast('Error al eliminar.', 'error'); return; }
  mostrarToast('Registro eliminado.', 'exito');
  cargarRHRecibidas();
}

async function exportarExcelRHRecibidas() {
  const mes  = document.getElementById('rhr-mes')?.value;
  const anio = document.getElementById('rhr-anio')?.value;
  const desde = `${anio}-${mes}-01`;
  const hasta = `${anio}-${mes}-${new Date(anio, mes, 0).getDate()}`;

  const { data } = await _supabase.from('contabilidad_rh_recibidas').select('*')
    .eq('empresa_id', empresa_activa.id)
    .gte('fecha_emision', desde).lte('fecha_emision', hasta)
    .order('fecha_emision');

  if (!data?.length) { mostrarToast('Sin datos para exportar.', 'atencion'); return; }

  const cab = ['Fecha Emisión','N° RH','Tipo Doc Emisor','N° Doc Emisor',
    'Nombre/Razón Social Emisor','Descripción Servicio','Moneda',
    'Renta Bruta','Retención','Renta Neta','Estado Pago','Fecha Pago','N° MBD','Observaciones'];
  const filas = data.map(r => [
    r.fecha_emision, r.nro_rh, r.tipo_doc_emisor, r.nro_doc_emisor,
    r.nombre_emisor, r.descripcion, r.moneda,
    r.renta_bruta, r.retencion, r.renta_neta,
    r.estado_pago, r.fecha_pago, r.nro_mbd, r.observaciones
  ]);

  const ws = XLSX.utils.aoa_to_sheet([cab, ...filas]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'RH Recibidas');
  XLSX.writeFile(wb, `RH_Recibidas_${empresa_activa.nombre_corto}_${anio}${mes}.xlsx`);
  mostrarToast('Archivo exportado.', 'exito');
}
