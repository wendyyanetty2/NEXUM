/* ============================================================
   NEXUM — Planilla: Recibos por Honorarios Emitidos
   ============================================================ */

function renderTabRH(area) {
  const hoy = new Date();
  const mesActual = String(hoy.getMonth() + 1).padStart(2, '0');
  const anioActual = hoy.getFullYear();

  area.innerHTML = `
    <div class="fadeIn">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          <select id="rh-mes" style="padding:8px 12px;border:1px solid var(--color-borde);border-radius:6px;background:var(--color-bg-card);color:var(--color-texto);font-size:13px;font-family:var(--font)">
            ${Array.from({length:12},(_,i)=>{
              const m = String(i+1).padStart(2,'0');
              const nom = new Date(2000,i,1).toLocaleString('es-PE',{month:'long'});
              return `<option value="${m}" ${m===mesActual?'selected':''}>${nom.charAt(0).toUpperCase()+nom.slice(1)}</option>`;
            }).join('')}
          </select>
          <select id="rh-anio" style="padding:8px 12px;border:1px solid var(--color-borde);border-radius:6px;background:var(--color-bg-card);color:var(--color-texto);font-size:13px;font-family:var(--font)">
            ${[anioActual-1, anioActual, anioActual+1].map(a=>`<option value="${a}" ${a===anioActual?'selected':''}>${a}</option>`).join('')}
          </select>
          <select id="rh-estado" style="padding:8px 12px;border:1px solid var(--color-borde);border-radius:6px;background:var(--color-bg-card);color:var(--color-texto);font-size:13px;font-family:var(--font)">
            <option value="">Todos</option>
            <option value="NO ANULADO">No Anulado</option>
            <option value="ANULADO">Anulado</option>
          </select>
          <button onclick="cargarRH()" style="padding:8px 14px;background:var(--color-bg-card);color:var(--color-texto);border:1px solid var(--color-borde);border-radius:6px;cursor:pointer;font-family:var(--font);font-size:13px">🔍 Filtrar</button>
        </div>
        <div style="display:flex;gap:8px;">
          <button onclick="exportarExcelRH()" style="padding:8px 14px;background:var(--color-bg-card);color:var(--color-texto);border:1px solid var(--color-borde);border-radius:6px;cursor:pointer;font-family:var(--font);font-size:13px">📥 Exportar Excel</button>
          <button onclick="abrirModalRH()" style="padding:8px 16px;background:var(--color-secundario);color:#fff;border:none;border-radius:6px;cursor:pointer;font-family:var(--font);font-size:13px;font-weight:500">+ Nuevo RH</button>
        </div>
      </div>
      <div id="rh-resumen" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;"></div>
      <div id="rh-tabla-wrap" style="overflow-x:auto;">
        <div class="cargando"><div class="spinner"></div><span>Cargando…</span></div>
      </div>
    </div>
  `;

  cargarRH();
}

async function cargarRH() {
  const mes    = document.getElementById('rh-mes')?.value;
  const anio   = document.getElementById('rh-anio')?.value;
  const estado = document.getElementById('rh-estado')?.value;
  const wrap   = document.getElementById('rh-tabla-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="cargando"><div class="spinner"></div><span>Cargando…</span></div>';

  const desde = `${anio}-${mes}-01`;
  const hasta = `${anio}-${mes}-${new Date(anio, mes, 0).getDate()}`;

  let q = _supabase.from('planilla_rh').select('*')
    .eq('empresa_id', empresa_activa.id)
    .gte('fecha_emision', desde).lte('fecha_emision', hasta)
    .order('fecha_emision', { ascending: false });
  if (estado) q = q.eq('estado_doc_emitido', estado);

  const { data, error } = await q;
  if (error) { wrap.innerHTML = `<p class="error-texto">Error: ${escapar(error.message)}</p>`; return; }

  const filas = (data || []).filter(r => r.estado_doc_emitido !== 'ANULADO' || estado === 'ANULADO');
  const activos = (data || []).filter(r => r.estado_doc_emitido === 'NO ANULADO');
  const totalBruta = activos.reduce((s,r) => s + Number(r.renta_bruta||0), 0);
  const totalIR    = activos.reduce((s,r) => s + Number(r.impuesto_renta||0), 0);
  const totalNeta  = activos.reduce((s,r) => s + Number(r.renta_neta||0), 0);
  const pendientes = activos.filter(r => Number(r.monto_neto_pendiente_pago||0) > 0).length;

  const resumen = document.getElementById('rh-resumen');
  if (resumen) resumen.innerHTML = `
    <div style="background:var(--color-secundario);color:#fff;padding:12px 16px;border-radius:8px;min-width:140px">
      <div style="font-size:11px;opacity:.8">RENTA BRUTA</div>
      <div style="font-size:18px;font-weight:700">${formatearMoneda(totalBruta)}</div>
    </div>
    <div style="background:var(--color-critico);color:#fff;padding:12px 16px;border-radius:8px;min-width:140px">
      <div style="font-size:11px;opacity:.8">IMPUESTO A LA RENTA</div>
      <div style="font-size:18px;font-weight:700">${formatearMoneda(totalIR)}</div>
    </div>
    <div style="background:var(--color-exito);color:#fff;padding:12px 16px;border-radius:8px;min-width:140px">
      <div style="font-size:11px;opacity:.8">RENTA NETA</div>
      <div style="font-size:18px;font-weight:700">${formatearMoneda(totalNeta)}</div>
    </div>
    <div style="background:${pendientes>0?'var(--color-atencion)':'#4A5568'};color:#fff;padding:12px 16px;border-radius:8px;min-width:120px">
      <div style="font-size:11px;opacity:.8">CON SALDO PENDIENTE</div>
      <div style="font-size:18px;font-weight:700">${pendientes}</div>
    </div>
    <div style="background:#4A5568;color:#fff;padding:12px 16px;border-radius:8px;min-width:120px">
      <div style="font-size:11px;opacity:.8">TOTAL RH</div>
      <div style="font-size:18px;font-weight:700">${(data||[]).length}</div>
    </div>
  `;

  if (!(data||[]).length) {
    wrap.innerHTML = '<p style="text-align:center;color:var(--color-texto-suave);padding:40px">Sin RH en este período.</p>';
    return;
  }

  const todos = estado ? filas : (data || []);
  wrap.innerHTML = `
    <table class="tabla-nexum">
      <thead><tr>
        <th>Fecha</th><th>N° Doc</th><th>Estado</th>
        <th>Tipo Doc</th><th>N° Documento</th><th>Emisor</th>
        <th>Tipo Renta</th><th>Descripción</th><th>Moneda</th>
        <th style="text-align:right">Renta Bruta</th>
        <th style="text-align:right">Imp. Renta</th>
        <th style="text-align:right">Renta Neta</th>
        <th style="text-align:right">Saldo Pend.</th>
        <th style="text-align:center">Acc.</th>
      </tr></thead>
      <tbody>
        ${todos.map(r => `
          <tr style="${r.estado_doc_emitido==='ANULADO'?'opacity:.5;text-decoration:line-through':''}">
            <td style="white-space:nowrap">${formatearFecha(r.fecha_emision)}</td>
            <td style="font-weight:600">${escapar(r.nro_doc_emitido)}</td>
            <td><span style="padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:${r.estado_doc_emitido==='NO ANULADO'?'#2F855A':'#C53030'};color:#fff">${escapar(r.estado_doc_emitido)}</span></td>
            <td>${escapar(r.tipo_doc_emisor)}</td>
            <td>${escapar(r.nro_doc_emisor)}</td>
            <td>${escapar(truncar(r.apellidos_nombres_razon_social,22))}</td>
            <td><span style="padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:var(--color-secundario);color:#fff" title="${r.tipo_renta==='A'?'4ta Categoría':'5ta Categoría'}">${escapar(r.tipo_renta)}</span></td>
            <td>${escapar(truncar(r.descripcion,25))}</td>
            <td>${escapar(r.moneda_operacion==='SOLES'?'S/':'$')}</td>
            <td style="text-align:right">${formatearMoneda(r.renta_bruta, r.moneda_operacion==='DOLARES'?'USD':'PEN')}</td>
            <td style="text-align:right;color:var(--color-critico)">${formatearMoneda(r.impuesto_renta, r.moneda_operacion==='DOLARES'?'USD':'PEN')}</td>
            <td style="text-align:right;font-weight:600;color:var(--color-exito)">${formatearMoneda(r.renta_neta, r.moneda_operacion==='DOLARES'?'USD':'PEN')}</td>
            <td style="text-align:right;color:${Number(r.monto_neto_pendiente_pago||0)>0?'var(--color-atencion)':'var(--color-texto-suave)'}">${Number(r.monto_neto_pendiente_pago||0)>0?formatearMoneda(r.monto_neto_pendiente_pago, r.moneda_operacion==='DOLARES'?'USD':'PEN'):'—'}</td>
            <td style="text-align:center;white-space:nowrap">
              <button onclick="abrirModalRH('${r.id}')" style="padding:4px 8px;background:rgba(44,82,130,.1);color:var(--color-secundario);border:none;border-radius:4px;cursor:pointer;font-size:13px">✏️</button>
              <button onclick="eliminarRH('${r.id}')" style="padding:4px 8px;background:rgba(197,48,48,.1);color:#C53030;border:none;border-radius:4px;cursor:pointer;font-size:13px">🗑️</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <p style="font-size:12px;color:var(--color-texto-suave);margin-top:8px">${todos.length} registro(s)</p>
  `;
}

async function abrirModalRH(id = null) {
  let item = null;
  if (id) {
    const { data } = await _supabase.from('planilla_rh').select('*').eq('id', id).single();
    item = data;
  }
  const hoy = new Date().toISOString().slice(0,10);

  const mc = document.getElementById('modal-container');
  mc.innerHTML = `
    <div class="modal-overlay" style="display:flex" onclick="if(event.target===this)cerrarModalRH()">
      <div class="modal" style="max-width:700px;width:95%;max-height:90vh;overflow-y:auto">
        <div class="modal-header">
          <h3>📄 ${id?'Editar':'Nuevo'} Recibo por Honorarios</h3>
          <button class="modal-cerrar" onclick="cerrarModalRH()">✕</button>
        </div>
        <div class="modal-body">
          <div id="rh-alerta" class="alerta-error"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
            <div class="campo"><label>Fecha Emisión <span class="req">*</span></label>
              <input type="date" id="rh-fecha" value="${item?.fecha_emision||hoy}"></div>
            <div class="campo"><label>Tipo Doc Emitido <span class="req">*</span></label>
              <input type="text" id="rh-tipo-em" value="${escapar(item?.tipo_doc_emitido||'RH')}" readonly style="background:var(--color-fondo-alt,#f7f7f7)"></div>
            <div class="campo"><label>N° Doc Emitido <span class="req">*</span></label>
              <input type="text" id="rh-nro-em" value="${escapar(item?.nro_doc_emitido||'')}" placeholder="E001-1"></div>
            <div class="campo"><label>Estado Doc <span class="req">*</span></label>
              <select id="rh-estado-doc">
                <option value="NO ANULADO" ${(item?.estado_doc_emitido||'NO ANULADO')==='NO ANULADO'?'selected':''}>No Anulado</option>
                <option value="ANULADO" ${item?.estado_doc_emitido==='ANULADO'?'selected':''}>Anulado</option>
              </select></div>
            <div class="campo"><label>Tipo Doc Emisor <span class="req">*</span></label>
              <select id="rh-tipo-emi">
                <option value="DNI" ${(item?.tipo_doc_emisor||'DNI')==='DNI'?'selected':''}>DNI</option>
                <option value="RUC" ${item?.tipo_doc_emisor==='RUC'?'selected':''}>RUC</option>
              </select></div>
            <div class="campo"><label>N° Doc Emisor <span class="req">*</span></label>
              <input type="text" id="rh-nro-emi" value="${escapar(item?.nro_doc_emisor||'')}" maxlength="11"></div>
            <div class="campo" style="grid-column:span 3"><label>Apellidos y Nombres / Razón Social <span class="req">*</span></label>
              <input type="text" id="rh-nombre" value="${escapar(item?.apellidos_nombres_razon_social||'')}"></div>
            <div class="campo"><label>Tipo Renta <span class="req">*</span></label>
              <select id="rh-tipo-renta">
                <option value="A" ${(item?.tipo_renta||'A')==='A'?'selected':''}>A — 4ta Categoría</option>
                <option value="B" ${item?.tipo_renta==='B'?'selected':''}>B — 5ta Categoría</option>
              </select></div>
            <div class="campo"><label>¿Gratuito? <span class="req">*</span></label>
              <select id="rh-gratuito">
                <option value="NO" ${(item?.gratuito||'NO')==='NO'?'selected':''}>No</option>
                <option value="SI" ${item?.gratuito==='SI'?'selected':''}>Sí</option>
              </select></div>
            <div class="campo"><label>Moneda <span class="req">*</span></label>
              <select id="rh-moneda">
                <option value="SOLES" ${(item?.moneda_operacion||'SOLES')==='SOLES'?'selected':''}>Soles</option>
                <option value="DOLARES" ${item?.moneda_operacion==='DOLARES'?'selected':''}>Dólares</option>
              </select></div>
            <div class="campo" style="grid-column:span 3"><label>Descripción <span class="req">*</span></label>
              <input type="text" id="rh-desc" value="${escapar(item?.descripcion||'')}"></div>
            <div class="campo" style="grid-column:span 3"><label>Observación</label>
              <input type="text" id="rh-obs" value="${escapar(item?.observacion||'')}"></div>
            <div class="campo"><label>Renta Bruta <span class="req">*</span></label>
              <input type="number" id="rh-bruta" step="0.01" value="${item?.renta_bruta||''}" onchange="calcRH()"></div>
            <div class="campo"><label>Impuesto a la Renta <span class="req">*</span></label>
              <input type="number" id="rh-imp" step="0.01" value="${item?.impuesto_renta||0}" onchange="calcRH()"></div>
            <div class="campo"><label style="font-weight:700;color:var(--color-secundario)">Renta Neta <span class="req">*</span></label>
              <input type="number" id="rh-neta" step="0.01" value="${item?.renta_neta||''}"></div>
            <div class="campo"><label>Monto Neto Pendiente de Pago</label>
              <input type="number" id="rh-pendiente" step="0.01" value="${item?.monto_neto_pendiente_pago||''}"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secundario" onclick="cerrarModalRH()">Cancelar</button>
          <button class="btn btn-primario" onclick="guardarRH('${id||''}')">💾 Guardar</button>
        </div>
      </div>
    </div>
  `;
}

function calcRH() {
  const bruta = parseFloat(document.getElementById('rh-bruta')?.value)||0;
  const imp   = parseFloat(document.getElementById('rh-imp')?.value)||0;
  const el    = document.getElementById('rh-neta');
  if (el) el.value = (bruta - imp).toFixed(2);
}

function cerrarModalRH() {
  const mc = document.getElementById('modal-container');
  if (mc) mc.innerHTML = '';
}

async function guardarRH(id) {
  const alerta = document.getElementById('rh-alerta');
  alerta.classList.remove('visible');

  const fecha  = document.getElementById('rh-fecha').value;
  const nroEm  = document.getElementById('rh-nro-em').value.trim();
  const nroEmi = document.getElementById('rh-nro-emi').value.trim();
  const nombre = document.getElementById('rh-nombre').value.trim();
  const desc   = document.getElementById('rh-desc').value.trim();
  const bruta  = parseFloat(document.getElementById('rh-bruta').value);
  const imp    = parseFloat(document.getElementById('rh-imp').value)||0;
  const neta   = parseFloat(document.getElementById('rh-neta').value);

  if (!fecha||!nroEm||!nroEmi||!nombre||!desc||isNaN(bruta)||isNaN(neta)) {
    alerta.textContent = 'Complete todos los campos requeridos (*)'; alerta.classList.add('visible'); return;
  }

  const pendiente = parseFloat(document.getElementById('rh-pendiente').value);
  const payload = {
    empresa_id:                    empresa_activa.id,
    fecha_emision:                 fecha,
    tipo_doc_emitido:              'RH',
    nro_doc_emitido:               nroEm,
    estado_doc_emitido:            document.getElementById('rh-estado-doc').value,
    tipo_doc_emisor:               document.getElementById('rh-tipo-emi').value,
    nro_doc_emisor:                nroEmi,
    apellidos_nombres_razon_social: nombre,
    tipo_renta:                    document.getElementById('rh-tipo-renta').value,
    gratuito:                      document.getElementById('rh-gratuito').value,
    descripcion:                   desc,
    observacion:                   document.getElementById('rh-obs').value.trim()||null,
    moneda_operacion:              document.getElementById('rh-moneda').value,
    renta_bruta:                   bruta,
    impuesto_renta:                imp,
    renta_neta:                    neta,
    monto_neto_pendiente_pago:     isNaN(pendiente) ? null : pendiente,
    creado_por:                    perfil_usuario.id,
    fecha_actualizacion:           new Date().toISOString(),
  };

  let error;
  if (id) ({ error } = await _supabase.from('planilla_rh').update(payload).eq('id', id));
  else    ({ error } = await _supabase.from('planilla_rh').insert(payload));

  if (error) { alerta.textContent = 'Error: ' + error.message; alerta.classList.add('visible'); return; }
  mostrarToast(id ? 'RH actualizado.' : 'RH registrado.', 'exito');
  cerrarModalRH();
  cargarRH();
}

async function eliminarRH(id) {
  const ok = await confirmar('¿Eliminar este recibo por honorarios?', { btnOk: 'Eliminar', btnColor: '#C53030' });
  if (!ok) return;
  const { error } = await _supabase.from('planilla_rh').delete().eq('id', id);
  if (error) { mostrarToast('Error al eliminar.', 'error'); return; }
  mostrarToast('Registro eliminado.', 'exito');
  cargarRH();
}

async function exportarExcelRH() {
  const mes  = document.getElementById('rh-mes')?.value;
  const anio = document.getElementById('rh-anio')?.value;
  const desde = `${anio}-${mes}-01`;
  const hasta = `${anio}-${mes}-${new Date(anio, mes, 0).getDate()}`;

  const { data } = await _supabase.from('planilla_rh').select('*')
    .eq('empresa_id', empresa_activa.id)
    .gte('fecha_emision', desde).lte('fecha_emision', hasta)
    .order('fecha_emision');

  if (!data?.length) { mostrarToast('Sin datos para exportar.', 'atencion'); return; }

  const cab = ['Fecha de Emisión','Tipo Doc. Emitido','Nro. Doc. Emitido',
    'Estado Doc. Emitido','Tipo de Doc. Emisor','Nro. Doc. Emisor',
    'Apellidos y Nombres / Razón Social del Emisor','Tipo de Renta',
    'Gratuito','Descripción','Observación','Moneda de Operación',
    'Renta Bruta','Impuesto a la Renta','Renta Neta','Monto Neto Pendiente de Pago'];
  const filas = data.map(r => [
    r.fecha_emision, r.tipo_doc_emitido, r.nro_doc_emitido,
    r.estado_doc_emitido, r.tipo_doc_emisor, r.nro_doc_emisor,
    r.apellidos_nombres_razon_social, r.tipo_renta,
    r.gratuito, r.descripcion, r.observacion, r.moneda_operacion,
    r.renta_bruta, r.impuesto_renta, r.renta_neta, r.monto_neto_pendiente_pago
  ]);

  const ws = XLSX.utils.aoa_to_sheet([cab, ...filas]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Hoja1');
  XLSX.writeFile(wb, `RH_${empresa_activa.nombre_corto}_${anio}${mes}.xlsx`);
  mostrarToast('Archivo exportado.', 'exito');
}
