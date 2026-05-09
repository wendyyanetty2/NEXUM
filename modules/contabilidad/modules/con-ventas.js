/* ============================================================
   NEXUM — Contabilidad: Registro de Ventas SUNAT (PLE)
   ============================================================ */

const TIPOS_DOC_ID_V = {'1':'DNI','4':'Carnet Extranjería','6':'RUC','7':'Pasaporte','0':'Otros'};

function renderTabVentas(area) {
  const hoy = new Date();
  const mesActual = String(hoy.getMonth() + 1).padStart(2, '0');
  const anioActual = hoy.getFullYear();
  const periodoActual = `${anioActual}${mesActual}`;

  area.innerHTML = `
    <div class="fadeIn">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          <input type="text" id="v-periodo" value="${periodoActual}" placeholder="YYYYMM"
            style="width:100px;padding:8px 12px;border:1px solid var(--color-borde);border-radius:6px;background:var(--color-bg-card);color:var(--color-texto);font-size:13px;font-family:var(--font)">
          <input type="text" id="v-buscar" placeholder="Buscar cliente, serie…"
            style="width:200px;padding:8px 12px;border:1px solid var(--color-borde);border-radius:6px;background:var(--color-bg-card);color:var(--color-texto);font-size:13px;font-family:var(--font)">
          <button onclick="cargarVentas()" style="padding:8px 14px;background:var(--color-bg-card);color:var(--color-texto);border:1px solid var(--color-borde);border-radius:6px;cursor:pointer;font-family:var(--font);font-size:13px">🔍 Filtrar</button>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button onclick="_conciliarLoteVentas()" style="padding:8px 14px;background:#2C5282;color:#fff;border:none;border-radius:6px;cursor:pointer;font-family:var(--font);font-size:13px">🔗 Conciliar con banco</button>
          <button onclick="exportarExcelVentas()" style="padding:8px 14px;background:var(--color-bg-card);color:var(--color-texto);border:1px solid var(--color-borde);border-radius:6px;cursor:pointer;font-family:var(--font);font-size:13px">📥 Exportar PLE</button>
          <button onclick="document.getElementById('v-sunat-file').click()" style="padding:8px 14px;background:var(--color-bg-card);color:var(--color-texto);border:1px solid var(--color-borde);border-radius:6px;cursor:pointer;font-family:var(--font);font-size:13px">📊 Importar SUNAT</button>
          <input type="file" id="v-sunat-file" accept=".xlsx,.xls" style="display:none" onchange="_vSunatHandleFile(this)">
          <button onclick="abrirModalVenta()" style="padding:8px 16px;background:var(--color-secundario);color:#fff;border:none;border-radius:6px;cursor:pointer;font-family:var(--font);font-size:13px;font-weight:500">+ Nueva venta</button>
        </div>
      </div>
      <div id="v-resumen" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;"></div>
      <div id="v-tabla-wrap" style="overflow-x:auto;">
        <div class="cargando"><div class="spinner"></div><span>Cargando…</span></div>
      </div>
    </div>
  `;

  document.getElementById('v-buscar').addEventListener('keydown', e => { if(e.key==='Enter') cargarVentas(); });
  cargarVentas();
}

async function cargarVentas() {
  const periodo = document.getElementById('v-periodo')?.value.trim();
  const buscar  = document.getElementById('v-buscar')?.value.trim().toLowerCase();
  const wrap    = document.getElementById('v-tabla-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="cargando"><div class="spinner"></div><span>Cargando…</span></div>';

  let q = _supabase.from('contabilidad_ventas').select('*')
    .eq('empresa_id', empresa_activa.id)
    .order('fecha_emision', { ascending: false });
  if (periodo) q = q.eq('periodo', periodo);

  const { data, error } = await q;
  if (error) { wrap.innerHTML = `<p class="error-texto">Error: ${escapar(error.message)}</p>`; return; }

  let filas = data || [];
  if (buscar) filas = filas.filter(r =>
    (r.cliente||'').toLowerCase().includes(buscar) ||
    (r.serie_cdp||'').toLowerCase().includes(buscar) ||
    (r.nro_doc_identidad||'').toLowerCase().includes(buscar)
  );

  const totalBI    = filas.reduce((s,r) => s + Number(r.bi_gravada||0), 0);
  const totalIGV   = filas.reduce((s,r) => s + Number(r.igv_ipm||0), 0);
  const totalCP    = filas.reduce((s,r) => s + Number(r.total_cp||0), 0);

  if (!filas.length) {
    const resV = document.getElementById('v-resumen');
    if (resV) resV.innerHTML = '';
    wrap.innerHTML = '<p style="text-align:center;color:var(--color-texto-suave);padding:40px">Sin registros en este período.</p>';
    return;
  }

  // MEJORA 7: verificar qué ventas tienen movimiento bancario aplicado
  const numerosV = filas.map(r => [r.serie_cdp, r.nro_cp_inicial].filter(Boolean).join('-')).filter(Boolean);
  const { data: mbdAplicadosV } = numerosV.length
    ? await _supabase.from('tesoreria_mbd').select('nro_factura_doc, nro_operacion_bancaria, monto, id, entrega_doc')
        .eq('empresa_id', empresa_activa.id).in('entrega_doc', ['EMITIDO', 'OBSERVADO']).in('nro_factura_doc', numerosV)
    : { data: [] };
  const aplicadosMapV = new Map((mbdAplicadosV || []).map(r => [r.nro_factura_doc, r]));

  // Estadísticas de conciliación
  const _nDocV    = r => [r.serie_cdp, r.nro_cp_inicial].filter(Boolean).join('-');
  const countAplicV = filas.filter(r => aplicadosMapV.has(_nDocV(r))).length;
  const countPendV  = filas.length - countAplicV;
  const montoAplicV = filas.filter(r => aplicadosMapV.has(_nDocV(r))).reduce((s,r) => s + Number(r.total_cp||0), 0);
  const montoPendV  = totalCP - montoAplicV;
  const pctAplicV   = filas.length > 0 ? Math.round(countAplicV / filas.length * 100) : 0;

  const resumen = document.getElementById('v-resumen');
  if (resumen) resumen.innerHTML = `
    <div style="width:100%;flex-basis:100%;display:flex;align-items:center;flex-wrap:wrap;gap:8px;
      padding:8px 12px;background:rgba(128,128,128,.05);border:1px solid var(--color-borde);
      border-radius:8px;font-size:11px;font-weight:600;box-sizing:border-box">
      <span style="background:#2F855A;color:#fff;padding:3px 10px;border-radius:12px">✅ APLICADO ${countAplicV}</span>
      <span style="background:#C53030;color:#fff;padding:3px 10px;border-radius:12px">🔴 PENDIENTE ${countPendV}</span>
      <span style="color:var(--color-texto-suave);font-size:10px;font-weight:400">— ${filas.length} comprobante(s) · ${pctAplicV}% conciliado</span>
    </div>
    <div style="background:var(--color-secundario);color:#fff;padding:12px 16px;border-radius:8px;min-width:130px">
      <div style="font-size:11px;opacity:.8">BASE IMPONIBLE</div>
      <div style="font-size:18px;font-weight:700">${formatearMoneda(totalBI)}</div>
    </div>
    <div style="background:#2C7A7B;color:#fff;padding:12px 16px;border-radius:8px;min-width:130px">
      <div style="font-size:11px;opacity:.8">IGV / IPM</div>
      <div style="font-size:18px;font-weight:700">${formatearMoneda(totalIGV)}</div>
    </div>
    <div style="background:var(--color-exito);color:#fff;padding:12px 16px;border-radius:8px;min-width:130px">
      <div style="font-size:11px;opacity:.8">TOTAL</div>
      <div style="font-size:18px;font-weight:700">${formatearMoneda(totalCP)}</div>
    </div>
    <div style="background:#276749;color:#fff;padding:12px 16px;border-radius:8px;min-width:130px">
      <div style="font-size:11px;opacity:.8">✅ APLICADOS</div>
      <div style="font-size:18px;font-weight:700">${countAplicV}</div>
      <div style="font-size:11px;opacity:.75">${formatearMoneda(montoAplicV)}</div>
    </div>
    <div style="background:#C53030;color:#fff;padding:12px 16px;border-radius:8px;min-width:130px">
      <div style="font-size:11px;opacity:.8">🔴 PENDIENTES</div>
      <div style="font-size:18px;font-weight:700">${countPendV}</div>
      <div style="font-size:11px;opacity:.75">${formatearMoneda(montoPendV)}</div>
    </div>
  `;

  wrap.innerHTML = `
    <table class="tabla-nexum">
      <thead><tr>
        <th>Período</th><th>Fecha Emisión</th><th>Tipo CP</th><th>Serie</th><th>N° Inicial</th>
        <th>Tipo Doc ID</th><th>N° Documento</th><th>Cliente</th>
        <th style="text-align:right">B.I. Gravada</th>
        <th style="text-align:right">IGV/IPM</th>
        <th style="text-align:right">Total CP</th>
        <th>Moneda</th><th style="text-align:center">Banco</th><th style="text-align:center">Acc.</th>
      </tr></thead>
      <tbody>
        ${filas.map(r => {
          const nDoc    = [r.serie_cdp, r.nro_cp_inicial].filter(Boolean).join('-');
          const movLinkV = aplicadosMapV.get(nDoc);
          const bancoHtml = movLinkV
            ? `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer"
                 title="Click para ver movimiento bancario vinculado"
                 onclick="_verMovBancarioLink('${escapar(nDoc)}','VENTA')">
                <span style="background:${movLinkV.entrega_doc==='OBSERVADO'?'#D97706':'#2F855A'};color:#fff;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700">${movLinkV.entrega_doc==='OBSERVADO'?'⚠️ OBSERV.':'✅ APLIC.'}</span>
                <span style="font-family:monospace;font-size:9px;color:#22c55e;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapar(movLinkV.nro_operacion_bancaria||'')}</span>
              </div>`
            : `<span style="background:#C53030;color:#fff;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700;cursor:pointer"
                 title="Click para conciliar con banco"
                 onclick="_conciliarVentaIndividual('${r.id}','${escapar(nDoc)}','${escapar(r.cliente||'')}',${Number(r.total_cp||0)},'${escapar(r.fecha_emision||'')}')">🔴 PEND.</span>`;
          return `
          <tr>
            <td>${escapar(r.periodo)}</td>
            <td style="white-space:nowrap">${formatearFecha(r.fecha_emision)}</td>
            <td style="text-align:center">${escapar(String(r.tipo_cp_doc))}</td>
            <td>${escapar(r.serie_cdp)}</td>
            <td style="text-align:right">${escapar(String(r.nro_cp_inicial))}</td>
            <td>${escapar(TIPOS_DOC_ID_V[r.tipo_doc_identidad]||r.tipo_doc_identidad)}</td>
            <td>${escapar(r.nro_doc_identidad)}</td>
            <td>${escapar(truncar(r.cliente,28))}</td>
            <td style="text-align:right">${formatearMoneda(r.bi_gravada, r.moneda==='USD'?'USD':'PEN')}</td>
            <td style="text-align:right">${formatearMoneda(r.igv_ipm, r.moneda==='USD'?'USD':'PEN')}</td>
            <td style="text-align:right;font-weight:600">${formatearMoneda(r.total_cp, r.moneda==='USD'?'USD':'PEN')}</td>
            <td>${escapar(r.moneda)}</td>
            <td style="text-align:center">${bancoHtml}</td>
            <td style="text-align:center;white-space:nowrap">
              <button onclick="abrirModalVenta('${r.id}')" style="padding:4px 8px;background:rgba(44,82,130,.1);color:var(--color-secundario);border:none;border-radius:4px;cursor:pointer;font-size:13px" title="Editar">✏️</button>
              <button onclick="_conciliarVentaIndividual('${r.id}','${escapar(nDoc)}','${escapar(r.cliente||'')}',${Number(r.total_cp||0)},'${escapar(r.fecha_emision||'')}')" title="Conciliar con movimiento bancario" style="padding:4px 8px;background:rgba(113,71,224,.1);color:#7147e0;border:none;border-radius:4px;cursor:pointer;font-size:13px">🔗</button>
              <button onclick="_bmBuscarMov('VENTA','${r.id}','${escapar(nDoc)}','${escapar(r.cliente||'')}',${Number(r.total_cp||0)},'${escapar(r.fecha_emision||'')}')" title="Buscar movimiento bancario manualmente" style="padding:4px 8px;background:rgba(85,60,154,.1);color:#553C9A;border:none;border-radius:4px;cursor:pointer;font-size:13px">🔍</button>
              <button onclick="eliminarVenta('${r.id}')" style="padding:4px 8px;background:rgba(197,48,48,.1);color:#C53030;border:none;border-radius:4px;cursor:pointer;font-size:13px" title="Eliminar">🗑️</button>
            </td>
          </tr>
        `}).join('')}
      </tbody>
    </table>
    <p style="font-size:12px;color:var(--color-texto-suave);margin-top:8px">${filas.length} comprobante(s)</p>
  `;
}

async function abrirModalVenta(id = null) {
  let item = null;
  if (id) {
    const { data } = await _supabase.from('contabilidad_ventas').select('*').eq('id', id).single();
    item = data;
  }
  const hoy = new Date().toISOString().slice(0,10);
  const periodo = item?.periodo || (() => { const d=new Date(); return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}`; })();

  const mc = document.getElementById('modal-container');
  mc.innerHTML = `
    <div class="modal-overlay" style="display:flex" onclick="if(event.target===this)cerrarModalVenta()">
      <div class="modal" style="max-width:860px;width:95%;max-height:90vh;overflow-y:auto">
        <div class="modal-header">
          <h3>📋 ${id?'Editar':'Nueva'} Venta — Registro PLE</h3>
          <button class="modal-cerrar" onclick="cerrarModalVenta()">✕</button>
        </div>
        <div class="modal-body">
          <div id="v-alerta" class="alerta-error"></div>

          <p style="font-size:12px;font-weight:600;color:var(--color-texto-suave);margin-bottom:8px;text-transform:uppercase">Datos del comprobante</p>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
            <div class="campo"><label>RUC Empresa <span class="req">*</span></label>
              <input type="text" id="v-ruc" value="${escapar(item?.ruc||empresa_activa.ruc||'')}" maxlength="11"></div>
            <div class="campo" style="grid-column:span 2"><label>Razón Social <span class="req">*</span></label>
              <input type="text" id="v-razon" value="${escapar(item?.razon_social||empresa_activa.nombre||'')}"></div>
            <div class="campo"><label>Período <span class="req">*</span></label>
              <input type="text" id="v-periodo-m" value="${periodo}" placeholder="YYYYMM" maxlength="6"></div>
            <div class="campo"><label>CAR SUNAT</label>
              <input type="text" id="v-car" value="${escapar(item?.car_sunat||'')}"></div>
            <div class="campo"><label>Fecha Emisión <span class="req">*</span></label>
              <input type="date" id="v-fecha" value="${item?.fecha_emision||hoy}"></div>
            <div class="campo"><label>Fecha Vcto/Pago</label>
              <input type="date" id="v-fecha-vcto" value="${item?.fecha_vcto_pago||''}"></div>
            <div class="campo"><label>Tipo CP/Doc <span class="req">*</span></label>
              <input type="number" id="v-tipo-cp" value="${item?.tipo_cp_doc||1}" placeholder="1=FA,7=NC…"></div>
            <div class="campo"><label>Serie CDP <span class="req">*</span></label>
              <input type="text" id="v-serie" value="${escapar(item?.serie_cdp||'')}" placeholder="F001"></div>
            <div class="campo"><label>N° CP Inicial <span class="req">*</span></label>
              <input type="number" id="v-nro-ini" value="${item?.nro_cp_inicial||''}"></div>
            <div class="campo"><label>N° CP Final</label>
              <input type="number" id="v-nro-fin" value="${item?.nro_cp_final||''}"></div>
          </div>

          <p style="font-size:12px;font-weight:600;color:var(--color-texto-suave);margin-bottom:8px;text-transform:uppercase">Datos del cliente</p>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
            <div class="campo"><label>Tipo Doc ID <span class="req">*</span></label>
              <select id="v-tipo-id">
                ${Object.entries(TIPOS_DOC_ID_V).map(([k,v])=>`<option value="${k}" ${(item?.tipo_doc_identidad||'6')===k?'selected':''}>${k} — ${v}</option>`).join('')}
              </select></div>
            <div class="campo"><label>N° Doc Identidad <span class="req">*</span></label>
              <input type="text" id="v-nro-id" value="${escapar(item?.nro_doc_identidad||'')}"></div>
            <div class="campo" style="grid-column:span 2"><label>Cliente <span class="req">*</span></label>
              <input type="text" id="v-cliente" value="${escapar(item?.cliente||'')}"></div>
          </div>

          <p style="font-size:12px;font-weight:600;color:var(--color-texto-suave);margin-bottom:8px;text-transform:uppercase">Importes</p>
          <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:16px">
            <div class="campo"><label>BI Gravada <span class="req">*</span></label>
              <input type="number" id="v-bi" step="0.01" value="${item?.bi_gravada||0}" onchange="calcTotalVenta()"></div>
            <div class="campo"><label>IGV/IPM <span class="req">*</span></label>
              <input type="number" id="v-igv" step="0.01" value="${item?.igv_ipm||0}" onchange="calcTotalVenta()"></div>
            <div class="campo"><label>Mto Exonerado</label>
              <input type="number" id="v-exon" step="0.01" value="${item?.mto_exonerado||0}" onchange="calcTotalVenta()"></div>
            <div class="campo"><label>Mto Inafecto</label>
              <input type="number" id="v-inaf" step="0.01" value="${item?.mto_inafecto||0}" onchange="calcTotalVenta()"></div>
            <div class="campo"><label>Dscto BI</label>
              <input type="number" id="v-dscto-bi" step="0.01" value="${item?.dscto_bi||0}" onchange="calcTotalVenta()"></div>
            <div class="campo"><label>ISC</label>
              <input type="number" id="v-isc" step="0.01" value="${item?.isc||0}" onchange="calcTotalVenta()"></div>
            <div class="campo"><label>ICBPER</label>
              <input type="number" id="v-icb" step="0.01" value="${item?.icbper||0}" onchange="calcTotalVenta()"></div>
            <div class="campo"><label>Otros Tributos</label>
              <input type="number" id="v-otros" step="0.01" value="${item?.otros_tributos||0}" onchange="calcTotalVenta()"></div>
            <div class="campo"><label>Valor Exp.</label>
              <input type="number" id="v-exp" step="0.01" value="${item?.valor_fact_exportacion||0}"></div>
            <div class="campo"><label style="font-weight:700;color:var(--color-secundario)">Total CP <span class="req">*</span></label>
              <input type="number" id="v-total" step="0.01" value="${item?.total_cp||0}" style="font-weight:600"></div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin-bottom:16px">
            <div class="campo"><label>Moneda <span class="req">*</span></label>
              <select id="v-moneda">
                <option value="PEN" ${(item?.moneda||'PEN')==='PEN'?'selected':''}>PEN — Soles</option>
                <option value="USD" ${item?.moneda==='USD'?'selected':''}>USD — Dólares</option>
              </select></div>
            <div class="campo"><label>Tipo Cambio <span class="req">*</span></label>
              <input type="number" id="v-tc" step="0.0001" value="${item?.tipo_cambio||1}"></div>
            <div class="campo"><label>Est. Comp.</label>
              <input type="number" id="v-est" value="${item?.est_comp||1}"></div>
            <div class="campo"><label>Tipo Op.</label>
              <input type="text" id="v-tipo-op" value="${escapar(item?.tipo_operacion||'')}"></div>
          </div>

          <details style="margin-bottom:12px">
            <summary style="cursor:pointer;font-size:12px;font-weight:600;color:var(--color-texto-suave);text-transform:uppercase">Doc. Modificado / Adicionales</summary>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:12px">
              <div class="campo"><label>Fecha Emisión Mod.</label>
                <input type="date" id="v-fecha-mod" value="${item?.fecha_emision_mod||''}"></div>
              <div class="campo"><label>Tipo CP Mod.</label>
                <input type="number" id="v-tipo-mod" value="${item?.tipo_cp_modificado||''}"></div>
              <div class="campo"><label>Serie CP Mod.</label>
                <input type="text" id="v-serie-mod" value="${escapar(item?.serie_cp_modificado||'')}"></div>
              <div class="campo"><label>N° CP Mod.</label>
                <input type="number" id="v-nro-mod" value="${item?.nro_cp_modificado||''}"></div>
              <div class="campo"><label>ID Proyecto</label>
                <input type="text" id="v-proyecto" value="${escapar(item?.id_proyecto||'')}"></div>
              <div class="campo"><label>Tipo Nota</label>
                <input type="number" id="v-tipo-nota" value="${item?.tipo_nota||''}"></div>
              <div class="campo"><label>Valor FOB</label>
                <input type="number" id="v-fob" step="0.01" value="${item?.valor_fob_embarcado||0}"></div>
              <div class="campo"><label>Valor Op. Gratuitas</label>
                <input type="number" id="v-gratuitas" step="0.01" value="${item?.valor_op_gratuitas||0}"></div>
              <div class="campo"><label>DAM/CP</label>
                <input type="text" id="v-dam" value="${escapar(item?.dam_cp||'')}"></div>
              <div class="campo"><label>CLU</label>
                <input type="text" id="v-clu" value="${escapar(item?.clu||'')}"></div>
              <div class="campo"><label>Dscto IGV/IPM</label>
                <input type="number" id="v-dscto-igv" step="0.01" value="${item?.dscto_igv_ipm||0}"></div>
              <div class="campo"><label>BI Grav. IVAP</label>
                <input type="number" id="v-ivap-bi" step="0.01" value="${item?.bi_grav_ivap||0}"></div>
              <div class="campo"><label>IVAP</label>
                <input type="number" id="v-ivap" step="0.01" value="${item?.ivap||0}"></div>
            </div>
          </details>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secundario" onclick="cerrarModalVenta()">Cancelar</button>
          <button class="btn btn-primario" onclick="guardarVenta('${id||''}')">💾 Guardar</button>
        </div>
      </div>
    </div>
  `;
}

function calcTotalVenta() {
  const bi    = parseFloat(document.getElementById('v-bi')?.value)||0;
  const igv   = parseFloat(document.getElementById('v-igv')?.value)||0;
  const exon  = parseFloat(document.getElementById('v-exon')?.value)||0;
  const inaf  = parseFloat(document.getElementById('v-inaf')?.value)||0;
  const isc   = parseFloat(document.getElementById('v-isc')?.value)||0;
  const icb   = parseFloat(document.getElementById('v-icb')?.value)||0;
  const otros = parseFloat(document.getElementById('v-otros')?.value)||0;
  const dscBI = parseFloat(document.getElementById('v-dscto-bi')?.value)||0;
  const total = bi + igv + exon + inaf + isc + icb + otros - dscBI;
  const el = document.getElementById('v-total');
  if (el) el.value = total.toFixed(2);
}

function cerrarModalVenta() {
  const mc = document.getElementById('modal-container');
  if (mc) mc.innerHTML = '';
}

async function guardarVenta(id) {
  const alerta = document.getElementById('v-alerta');
  alerta.classList.remove('visible');

  const ruc    = document.getElementById('v-ruc').value.trim();
  const razon  = document.getElementById('v-razon').value.trim();
  const periodo = document.getElementById('v-periodo-m').value.trim();
  const fecha  = document.getElementById('v-fecha').value;
  const tipoCp = parseInt(document.getElementById('v-tipo-cp').value);
  const serie  = document.getElementById('v-serie').value.trim();
  const nroIni = parseInt(document.getElementById('v-nro-ini').value);
  const tipoId = document.getElementById('v-tipo-id').value;
  const nroId  = document.getElementById('v-nro-id').value.trim();
  const cliente = document.getElementById('v-cliente').value.trim();

  if (!ruc||!razon||!periodo||!fecha||isNaN(tipoCp)||!serie||isNaN(nroIni)||!tipoId||!nroId||!cliente) {
    alerta.textContent = 'Complete todos los campos requeridos (*)'; alerta.classList.add('visible'); return;
  }
  if (!/^\d{6}$/.test(periodo)) {
    alerta.textContent = 'El período debe tener formato YYYYMM (6 dígitos)'; alerta.classList.add('visible'); return;
  }

  const n = id => parseFloat(document.getElementById(id)?.value)||0;
  const payload = {
    empresa_id: empresa_activa.id,
    ruc, razon_social: razon, periodo, car_sunat: document.getElementById('v-car').value.trim()||null,
    fecha_emision: fecha,
    fecha_vcto_pago: document.getElementById('v-fecha-vcto').value||null,
    tipo_cp_doc: tipoCp, serie_cdp: serie, nro_cp_inicial: nroIni,
    nro_cp_final: parseInt(document.getElementById('v-nro-fin').value)||null,
    tipo_doc_identidad: tipoId, nro_doc_identidad: nroId, cliente,
    bi_gravada: n('v-bi'), igv_ipm: n('v-igv'), dscto_bi: n('v-dscto-bi'),
    dscto_igv_ipm: n('v-dscto-igv'), mto_exonerado: n('v-exon'), mto_inafecto: n('v-inaf'),
    isc: n('v-isc'), bi_grav_ivap: n('v-ivap-bi'), ivap: n('v-ivap'),
    icbper: n('v-icb'), otros_tributos: n('v-otros'), total_cp: n('v-total'),
    valor_fact_exportacion: n('v-exp'), valor_fob_embarcado: n('v-fob'),
    valor_op_gratuitas: n('v-gratuitas'),
    moneda: document.getElementById('v-moneda').value,
    tipo_cambio: parseFloat(document.getElementById('v-tc').value)||1,
    est_comp: parseInt(document.getElementById('v-est').value)||1,
    tipo_operacion: document.getElementById('v-tipo-op').value.trim()||null,
    fecha_emision_mod: document.getElementById('v-fecha-mod').value||null,
    tipo_cp_modificado: parseInt(document.getElementById('v-tipo-mod').value)||null,
    serie_cp_modificado: document.getElementById('v-serie-mod').value.trim()||null,
    nro_cp_modificado: parseInt(document.getElementById('v-nro-mod').value)||null,
    id_proyecto: document.getElementById('v-proyecto').value.trim()||null,
    tipo_nota: parseInt(document.getElementById('v-tipo-nota').value)||null,
    dam_cp: document.getElementById('v-dam').value.trim()||null,
    clu: document.getElementById('v-clu').value.trim()||null,
    creado_por: perfil_usuario.id,
    fecha_actualizacion: new Date().toISOString(),
  };

  let error;
  if (id) ({ error } = await _supabase.from('contabilidad_ventas').update(payload).eq('id', id));
  else    ({ error } = await _supabase.from('contabilidad_ventas').insert(payload));

  if (error) { alerta.textContent = 'Error: ' + error.message; alerta.classList.add('visible'); return; }
  mostrarToast(id ? 'Venta actualizada.' : 'Venta registrada.', 'exito');
  cerrarModalVenta();
  cargarVentas();
}

async function eliminarVenta(id) {
  const ok = await confirmar('¿Eliminar este comprobante de venta?', { btnOk: 'Eliminar', btnColor: '#C53030' });
  if (!ok) return;
  const { error } = await _supabase.from('contabilidad_ventas').delete().eq('id', id);
  if (error) { mostrarToast('Error al eliminar.', 'error'); return; }
  mostrarToast('Registro eliminado.', 'exito');
  cargarVentas();
}

async function exportarExcelVentas() {
  const periodo = document.getElementById('v-periodo')?.value.trim();
  let q = _supabase.from('contabilidad_ventas').select('*')
    .eq('empresa_id', empresa_activa.id).order('fecha_emision');
  if (periodo) q = q.eq('periodo', periodo);
  const { data } = await q;
  if (!data?.length) { mostrarToast('Sin datos para exportar.', 'atencion'); return; }

  const cab = [
    'Ruc','Razon Social','Periodo','CAR SUNAT','Fecha de emisión','Fecha Vcto/Pago',
    'Tipo CP/Doc.','Serie del CDP','Nro CP Nro Inicial (Rango)','Nro Final (Rango)',
    'Tipo Doc Identidad','Nro Doc Identidad','Apellidos Nombres/ Razón Social',
    'Valor Facturado Exportación','BI Gravada','Dscto BI','IGV / IPM','Dscto IGV / IPM',
    'Mto Exonerado','Mto Inafecto','ISC','BI Grav IVAP','IVAP','ICBPER','Otros Tributos',
    'Total CP','Moneda','Tipo Cambio','Fecha Emisión Doc Modificado','Tipo CP Modificado',
    'Serie CP Modificado','Nro CP Modificado','ID Proyecto Operadores Atribución',
    'Tipo de Nota','Est. Comp','Valor FOB Embarcado','Valor OP Gratuitas','Tipo Operación','DAM / CP','CLU'
  ];
  const filas = data.map(r => [
    r.ruc, r.razon_social, r.periodo, r.car_sunat, r.fecha_emision, r.fecha_vcto_pago,
    r.tipo_cp_doc, r.serie_cdp, r.nro_cp_inicial, r.nro_cp_final,
    r.tipo_doc_identidad, r.nro_doc_identidad, r.cliente,
    r.valor_fact_exportacion, r.bi_gravada, r.dscto_bi, r.igv_ipm, r.dscto_igv_ipm,
    r.mto_exonerado, r.mto_inafecto, r.isc, r.bi_grav_ivap, r.ivap, r.icbper, r.otros_tributos,
    r.total_cp, r.moneda, r.tipo_cambio, r.fecha_emision_mod, r.tipo_cp_modificado,
    r.serie_cp_modificado, r.nro_cp_modificado, r.id_proyecto,
    r.tipo_nota, r.est_comp, r.valor_fob_embarcado, r.valor_op_gratuitas, r.tipo_operacion, r.dam_cp, r.clu
  ]);

  const ws = XLSX.utils.aoa_to_sheet([cab, ...filas]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Hoja1');
  XLSX.writeFile(wb, `RV_${empresa_activa.nombre_corto}_${periodo||'todos'}.xlsx`);
  mostrarToast('Exportado en formato PLE.', 'exito');
}

// ── Importar SUNAT Excel con deduplicación ────────────────────────

let _vSunatDatos = [];

function _vSunatHandleFile(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';

  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const wb   = XLSX.read(e.target.result, { type: 'array', cellDates: false });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
      if (rows.length < 2) { mostrarToast('El archivo está vacío.', 'atencion'); return; }

      mostrarToast('Leyendo archivo…', 'info');

      const _fecha = v => {
        if (!v) return null;
        const s = v.toString().trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) { const [d,m,y]=s.split('/'); return `${y}-${m}-${d}`; }
        const n = typeof v === 'number' ? new Date(Math.round((v - 25569) * 86400 * 1000)) : new Date(s);
        return isNaN(n) ? null : n.toISOString().slice(0,10);
      };
      const _num  = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
      const _str  = v => (v ?? '').toString().trim();
      const _mon  = v => { const s=_str(v).toUpperCase(); return ['USD','2','$'].includes(s)?'USD':'PEN'; };

      _vSunatDatos = rows.slice(1).map((r, i) => {
        const serie = _str(r[7]);
        const nro   = parseInt(r[8]) || 0;
        if (!serie && !nro) return null;
        const fecha = _fecha(r[4]);
        const total = Math.abs(_num(r[25]));
        return {
          _fila:    i + 2,
          _clave:   `${serie}-${nro}`,
          _ok:      !!fecha && total > 0,
          empresa_id:            empresa_activa.id,
          ruc:                   _str(empresa_activa.ruc || ''),
          razon_social:          _str(empresa_activa.nombre || ''),
          periodo:               fecha ? fecha.slice(0,7).replace('-','') : '',
          car_sunat:             _str(r[3]),
          fecha_emision:         fecha,
          fecha_vcto_pago:       _fecha(r[5]) || null,
          tipo_cp_doc:           parseInt(r[6]) || 1,
          serie_cdp:             serie,
          nro_cp_inicial:        nro,
          nro_cp_final:          parseInt(r[9]) || nro,
          tipo_doc_identidad:    _str(r[10]) || '6',
          nro_doc_identidad:     _str(r[11]),
          cliente:               _str(r[12]),
          valor_fact_exportacion:_num(r[13]),
          bi_gravada:            _num(r[14]),
          dscto_bi:              _num(r[15]),
          igv_ipm:               _num(r[16]),
          dscto_igv_ipm:         _num(r[17]),
          mto_exonerado:         _num(r[18]),
          mto_inafecto:          _num(r[19]),
          isc:                   _num(r[20]),
          bi_grav_ivap:          _num(r[21]),
          ivap:                  _num(r[22]),
          icbper:                _num(r[23]),
          otros_tributos:        _num(r[24]),
          total_cp:              total,
          moneda:                _mon(r[26]),
          tipo_cambio:           _num(r[27]) || 1,
          est_comp:              parseInt(r[28]) || 1,
          creado_por:            perfil_usuario.id,
          fecha_actualizacion:   new Date().toISOString(),
        };
      }).filter(Boolean);

      const periodo = document.getElementById('v-periodo')?.value.trim() ||
        (_vSunatDatos[0]?.periodo || '');

      const { data: existentes } = await _supabase
        .from('contabilidad_ventas').select('serie_cdp, nro_cp_inicial, total_cp')
        .eq('empresa_id', empresa_activa.id)
        .eq('periodo', periodo);

      const mapExist = new Map((existentes||[]).map(r => [`${r.serie_cdp}-${r.nro_cp_inicial}`, r.total_cp]));

      let nuevos = 0, actualizados = 0, sinCambios = 0, invalidos = 0;
      _vSunatDatos.forEach(r => {
        if (!r._ok) { invalidos++; return; }
        const exist = mapExist.get(r._clave);
        if (exist === undefined) r._estado = 'NUEVO';
        else if (Math.abs(Number(exist) - r.total_cp) > 0.01) r._estado = 'ACTUALIZAR';
        else r._estado = 'SIN_CAMBIO';
        if (r._estado === 'NUEVO') nuevos++;
        else if (r._estado === 'ACTUALIZAR') actualizados++;
        else sinCambios++;
      });

      const mc = document.getElementById('modal-container');
      mc.innerHTML = `
        <div class="modal-overlay" style="display:flex" onclick="if(event.target===this)_vSunatCerrar()">
          <div class="modal" style="max-width:900px;width:95%;max-height:92vh;overflow-y:auto">
            <div class="modal-header">
              <h3>📊 Importar SUNAT — Registro de Ventas</h3>
              <button class="modal-cerrar" onclick="_vSunatCerrar()">✕</button>
            </div>
            <div class="modal-body">
              <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">
                <div style="background:#2F855A;color:#fff;padding:10px 16px;border-radius:8px;text-align:center;min-width:100px">
                  <div style="font-size:11px;opacity:.8">NUEVOS</div>
                  <div style="font-size:20px;font-weight:700">${nuevos}</div>
                </div>
                <div style="background:#2C5282;color:#fff;padding:10px 16px;border-radius:8px;text-align:center;min-width:100px">
                  <div style="font-size:11px;opacity:.8">SE ACTUALIZAN</div>
                  <div style="font-size:20px;font-weight:700">${actualizados}</div>
                </div>
                <div style="background:#4A5568;color:#fff;padding:10px 16px;border-radius:8px;text-align:center;min-width:100px">
                  <div style="font-size:11px;opacity:.8">SIN CAMBIOS</div>
                  <div style="font-size:20px;font-weight:700">${sinCambios}</div>
                </div>
                ${invalidos ? `<div style="background:#C53030;color:#fff;padding:10px 16px;border-radius:8px;text-align:center;min-width:100px">
                  <div style="font-size:11px;opacity:.8">OMITIDOS</div>
                  <div style="font-size:20px;font-weight:700">${invalidos}</div>
                </div>` : ''}
              </div>
              <div style="overflow-x:auto;max-height:320px;overflow-y:auto">
                <table class="tabla-nexum" style="font-size:12px">
                  <thead><tr>
                    <th>Serie-N°</th><th>Fecha</th><th>Cliente</th>
                    <th style="text-align:right">BI Gravada</th>
                    <th style="text-align:right">IGV</th>
                    <th style="text-align:right">Total</th><th>Mon.</th><th>Estado</th>
                  </tr></thead>
                  <tbody>
                    ${_vSunatDatos.filter(r=>r._ok).slice(0,30).map(r => {
                      const color = r._estado==='NUEVO'?'#2F855A':r._estado==='ACTUALIZAR'?'#2C5282':'#4A5568';
                      const label = r._estado==='NUEVO'?'NUEVO':r._estado==='ACTUALIZAR'?'ACTUALIZAR':'SIN CAMBIO';
                      return `<tr>
                        <td class="text-mono">${escapar(r._clave)}</td>
                        <td style="white-space:nowrap">${r.fecha_emision||'—'}</td>
                        <td style="font-size:11px">${escapar((r.cliente||'—').slice(0,25))}</td>
                        <td style="text-align:right">${formatearMoneda(r.bi_gravada,r.moneda==='USD'?'USD':'PEN')}</td>
                        <td style="text-align:right">${formatearMoneda(r.igv_ipm,r.moneda==='USD'?'USD':'PEN')}</td>
                        <td style="text-align:right;font-weight:600">${formatearMoneda(r.total_cp,r.moneda==='USD'?'USD':'PEN')}</td>
                        <td>${escapar(r.moneda)}</td>
                        <td><span style="font-size:10px;background:${color};color:#fff;padding:2px 6px;border-radius:8px">${label}</span></td>
                      </tr>`;
                    }).join('')}
                    ${_vSunatDatos.filter(r=>r._ok).length > 30
                      ? `<tr><td colspan="8" style="text-align:center;color:var(--color-texto-suave);padding:8px;font-size:12px">… y ${_vSunatDatos.filter(r=>r._ok).length-30} más</td></tr>`
                      : ''}
                  </tbody>
                </table>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secundario" onclick="_vSunatCerrar()">Cancelar</button>
              <button class="btn btn-primario" id="btn-conf-vsunat" onclick="_vSunatConfirmar()"
                ${!nuevos && !actualizados ? 'disabled' : ''}>
                ✅ Importar ${nuevos + actualizados} registro(s)
              </button>
            </div>
          </div>
        </div>`;
    } catch(err) {
      mostrarToast('Error al leer el archivo: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

function _vSunatCerrar() {
  _vSunatDatos = [];
  const mc = document.getElementById('modal-container');
  if (mc) mc.innerHTML = '';
}

async function _vSunatConfirmar() {
  const btn = document.getElementById('btn-conf-vsunat');
  if (btn) { btn.disabled = true; btn.textContent = 'Importando…'; }

  const nuevos     = _vSunatDatos.filter(r => r._ok && r._estado === 'NUEVO');
  const actualizar = _vSunatDatos.filter(r => r._ok && r._estado === 'ACTUALIZAR');

  let errCount = 0;

  if (nuevos.length) {
    const registros = nuevos.map(({ _fila, _ok, _estado, _clave, ...r }) => r);
    const { error } = await _supabase.from('contabilidad_ventas').insert(registros);
    if (error) { errCount++; mostrarToast('Error al insertar: ' + error.message, 'error'); }
  }

  for (const r of actualizar) {
    const { _fila, _ok, _estado, _clave, ...payload } = r;
    const { error } = await _supabase.from('contabilidad_ventas')
      .update(payload)
      .eq('empresa_id', empresa_activa.id)
      .eq('serie_cdp', r.serie_cdp)
      .eq('nro_cp_inicial', r.nro_cp_inicial);
    if (error) errCount++;
  }

  _vSunatCerrar();
  if (!errCount) mostrarToast(`✓ ${nuevos.length} nuevo(s) + ${actualizar.length} actualizado(s).`, 'exito');
  else mostrarToast('Importación parcial. Revisa los datos.', 'atencion');
  cargarVentas();
}

// ══════════════════════════════════════════════════════════════════
// CONCILIACIÓN VENTAS ↔ TESORERÍA MBD
// Reutiliza helpers de con-compras.js (_cAbrirModalConciliar,
// _cBuscarMovManual, _cVincularMovimiento, _cAplicarLoteConciliacion)
// ══════════════════════════════════════════════════════════════════

async function _conciliarVentaIndividual(ventaId, nDoc, cliente, total, fechaEmision) {
  const margen  = Math.max(total * 0.05, 5);
  const { data: movs } = await _supabase
    .from('tesoreria_mbd')
    .select('*')
    .eq('empresa_id', empresa_activa.id)
    .neq('entrega_doc', 'EMITIDO')
    .gte('monto', total - margen)
    .lte('monto', total + margen)
    .order('fecha_deposito', { ascending: false })
    .limit(30);

  // Buscar movimientos parciales para detectar multi-transferencias
  const { data: movsParciales } = await _supabase
    .from('tesoreria_mbd')
    .select('id,nro_operacion_bancaria,fecha_deposito,monto,descripcion,proveedor_empresa_personal,entrega_doc')
    .eq('empresa_id', empresa_activa.id)
    .neq('entrega_doc', 'EMITIDO')
    .gt('monto', 0)
    .lt('monto', total * 0.99)
    .order('fecha_deposito', { ascending: false })
    .limit(50);

  const multiTransfers = _encontrarMultiTransfer(movsParciales || [], total, margen);

  _cAbrirModalConciliar({ id: ventaId, nDoc, proveedor: cliente, total, fecha: fechaEmision, tipo: 'VENTA' }, movs || [], multiTransfers);
}

async function _conciliarLoteVentas() {
  const periodo = document.getElementById('v-periodo')?.value.trim();
  if (!periodo) { mostrarToast('Selecciona un periodo primero', 'atencion'); return; }

  const mc = document.getElementById('modal-container');
  mc.innerHTML = `
    <div class="modal-overlay" style="display:flex">
      <div class="modal" style="max-width:500px;width:95%;padding:32px;text-align:center">
        <div class="spinner" style="margin:0 auto 12px"></div>
        <div style="color:var(--color-texto-suave)">Buscando ventas pendientes…</div>
      </div>
    </div>`;

  const { data: ventas } = await _supabase
    .from('contabilidad_ventas')
    .select('id, serie_cdp, nro_cp_inicial, cliente, total_cp, fecha_emision')
    .eq('empresa_id', empresa_activa.id)
    .eq('periodo', periodo);

  if (!ventas?.length) {
    document.querySelector('.modal-overlay')?.remove();
    mostrarToast('No hay ventas en este periodo', 'atencion');
    return;
  }

  const numeros = ventas.map(r => [r.serie_cdp, r.nro_cp_inicial].filter(Boolean).join('-')).filter(Boolean);
  const { data: yaAplic } = numeros.length
    ? await _supabase.from('tesoreria_mbd').select('nro_factura_doc').eq('empresa_id', empresa_activa.id).in('entrega_doc', ['EMITIDO', 'OBSERVADO']).in('nro_factura_doc', numeros)
    : { data: [] };
  const aplicadosSet = new Set((yaAplic || []).map(r => r.nro_factura_doc));
  const pendientes   = ventas.filter(r => {
    const nDoc = [r.serie_cdp, r.nro_cp_inicial].filter(Boolean).join('-');
    return !aplicadosSet.has(nDoc);
  });

  document.querySelector('.modal-overlay')?.remove();

  if (!pendientes.length) {
    mostrarToast(`✅ Todas las ventas del periodo ${periodo} ya están conciliadas`, 'exito');
    return;
  }

  const matches = [];
  for (const v of pendientes.slice(0, 20)) {
    const nDoc   = [v.serie_cdp, v.nro_cp_inicial].filter(Boolean).join('-');
    const total  = Number(v.total_cp || 0);
    const margen = Math.max(total * 0.05, 5);
    const { data: movs } = await _supabase
      .from('tesoreria_mbd')
      .select('id, fecha_deposito, monto, descripcion, nro_operacion_bancaria, proveedor_empresa_personal, ruc_dni, entrega_doc')
      .eq('empresa_id', empresa_activa.id)
      .neq('entrega_doc', 'EMITIDO')
      .gte('monto', total - margen)
      .lte('monto', total + margen)
      .limit(5);
    if (movs?.length) {
      const mejor = movs.sort((a, b) => Math.abs(Number(a.monto) - total) - Math.abs(Number(b.monto) - total))[0];
      matches.push({ compra: { ...v, nDoc }, mov: mejor, total });
    }
  }

  if (!matches.length) {
    mostrarToast(`${pendientes.length} venta(s) pendiente(s) pero sin movimientos bancarios que coincidan`, 'atencion');
    return;
  }

  const mc2 = document.getElementById('modal-container');
  mc2.innerHTML = `
    <div class="modal-overlay" style="display:flex" onclick="if(event.target===this)this.parentElement.innerHTML=''">
      <div class="modal" style="max-width:760px;width:95%;max-height:90vh;display:flex;flex-direction:column">
        <div class="modal-header" style="flex-shrink:0">
          <h3>🔗 Conciliar Ventas con Banco — ${periodo}</h3>
          <button class="modal-cerrar" onclick="this.closest('.modal-overlay').remove()">✕</button>
        </div>
        <div class="modal-body" style="flex:1;overflow-y:auto">
          <p style="font-size:12px;color:var(--color-texto-suave);margin-bottom:12px">
            Se encontraron <strong>${matches.length}</strong> posible(s) match(es) de ${pendientes.length} venta(s) pendientes.
          </p>
          <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap">
            <button onclick="document.querySelectorAll('[id^=vnt-chk-]').forEach(c=>c.checked=true)"
              style="padding:5px 12px;border:1px solid var(--color-borde);border-radius:6px;background:none;cursor:pointer;font-size:12px;font-family:var(--font);color:var(--color-texto)">
              ☑ Marcar todos</button>
            <button onclick="document.querySelectorAll('[id^=vnt-chk-]').forEach(c=>c.checked=false)"
              style="padding:5px 12px;border:1px solid var(--color-borde);border-radius:6px;background:none;cursor:pointer;font-size:12px;font-family:var(--font);color:var(--color-texto)">
              ☐ Desmarcar todos</button>
          </div>
          ${matches.map((m, i) => {
            const diff = Math.abs(Number(m.mov.monto) - m.total);
            const pct  = m.total > 0 ? Math.round(diff / m.total * 100) : 0;
            return `
            <div style="border:1px solid var(--color-borde);border-radius:8px;padding:12px 14px;margin-bottom:8px;background:var(--color-bg-card)">
              <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer">
                <input type="checkbox" id="vnt-chk-${i}" data-idx="${i}" checked
                  style="margin-top:3px;width:16px;height:16px;flex-shrink:0;cursor:pointer">
                <div style="flex:1;min-width:0">
                  <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px;margin-bottom:6px">
                    <span style="font-weight:700;color:var(--color-secundario)">${escapar(m.compra.nDoc)}</span>
                    <span style="font-weight:700;color:var(--color-exito)">${formatearMoneda(m.total)}</span>
                  </div>
                  <div style="font-size:11px;color:var(--color-texto-suave);margin-bottom:6px">${escapar(truncar(m.compra.cliente||'—',40))} · ${formatearFecha(m.compra.fecha_emision)}</div>
                  <div style="padding:8px 10px;background:rgba(44,82,130,.06);border:1px solid rgba(44,82,130,.2);border-radius:6px;font-size:12px">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
                      <div>
                        <div style="color:var(--color-secundario);font-weight:600;font-family:monospace;font-size:11px">${escapar(m.mov.nro_operacion_bancaria||'—')}</div>
                        <div style="color:var(--color-texto-suave);font-size:11px">${formatearFecha(m.mov.fecha_deposito)} · ${escapar(truncar(m.mov.descripcion||'—',45))}</div>
                      </div>
                      <div style="text-align:right;flex-shrink:0">
                        <div style="font-weight:700;color:var(--color-exito)">${formatearMoneda(m.mov.monto)}</div>
                        ${diff > 0 ? `<div style="font-size:10px;color:${pct>5?'#ef4444':'#f59e0b'}">Dif: ${formatearMoneda(diff)} (${pct}%)</div>` : '<div style="font-size:10px;color:#22c55e">✓ Exacto</div>'}
                      </div>
                    </div>
                  </div>
                </div>
              </label>
            </div>`;
          }).join('')}
        </div>
        <div class="modal-footer" style="flex-shrink:0;gap:8px">
          <button class="btn btn-secundario" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
          <button class="btn btn-primario"
            onclick="_vAplicarLoteConciliacion(${JSON.stringify(matches.map(m=>({movId:m.mov.id,nDoc:m.compra.nDoc,cliente:m.compra.cliente||'',total:m.total})))})">
            ✅ Aplicar seleccionados
          </button>
        </div>
      </div>
    </div>`;
}

async function _vAplicarLoteConciliacion(items) {
  const checks = document.querySelectorAll('[id^=vnt-chk-]');
  const hoy    = new Date().toISOString().slice(0, 10);
  let ok = 0, errores = 0;

  for (const chk of checks) {
    if (!chk.checked) continue;
    const idx  = parseInt(chk.dataset.idx, 10);
    const item = items[idx];
    if (!item) continue;

    const { error } = await _supabase.from('tesoreria_mbd').update({
      entrega_doc:          'OBSERVADO',
      nro_factura_doc:      item.nDoc,
      tipo_doc:             'VENTA',
      estado_conciliacion:  'conciliado',
      proveedor_empresa_personal: item.cliente || undefined,
      fecha_actualizacion:  hoy,
    }).eq('id', item.movId);

    if (!error) {
      await _supabase.from('conciliaciones').insert({
        empresa_operadora_id: empresa_activa.id,
        movimiento_id:        item.movId,
        doc_tipo:             'VENTA',
        doc_id:               null,
        score:                0,
        tipo_match:           'AUTO_LOTE',
        estado:               'APROBADO',
        usuario_id:           perfil_usuario?.id || null,
      });
      ok++;
    } else {
      errores++;
    }
  }

  document.querySelector('.modal-overlay')?.remove();
  mostrarToast(
    `✅ ${ok} conciliación(es) aplicada(s)${errores ? ` · ${errores} con error` : ''}`,
    ok > 0 ? 'exito' : 'error'
  );
  cargarVentas();
}
