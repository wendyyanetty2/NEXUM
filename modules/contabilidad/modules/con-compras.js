/* ============================================================
   NEXUM — Contabilidad: Registro de Compras SUNAT (PLE)
   ============================================================ */

const TIPOS_DOC_ID_C = {'1':'DNI','4':'Carnet Extranjería','6':'RUC','7':'Pasaporte','0':'Otros'};
let _mbdLinkCache = []; // Cache para modal de movimiento bancario vinculado

function renderTabCompras(area) {
  const hoy = new Date();
  const mesActual = String(hoy.getMonth() + 1).padStart(2, '0');
  const anioActual = hoy.getFullYear();
  const periodoActual = `${anioActual}${mesActual}`;

  area.innerHTML = `
    <div class="fadeIn">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          <input type="text" id="c-periodo" value="${periodoActual}" placeholder="YYYYMM"
            style="width:100px;padding:8px 12px;border:1px solid var(--color-borde);border-radius:6px;background:var(--color-bg-card);color:var(--color-texto);font-size:13px;font-family:var(--font)">
          <input type="text" id="c-buscar" placeholder="Buscar proveedor, serie…"
            style="width:200px;padding:8px 12px;border:1px solid var(--color-borde);border-radius:6px;background:var(--color-bg-card);color:var(--color-texto);font-size:13px;font-family:var(--font)">
          <button onclick="cargarCompras()" style="padding:8px 14px;background:var(--color-bg-card);color:var(--color-texto);border:1px solid var(--color-borde);border-radius:6px;cursor:pointer;font-family:var(--font);font-size:13px">🔍 Filtrar</button>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button onclick="_conciliarLoteCompras()" style="padding:8px 14px;background:#2C5282;color:#fff;border:none;border-radius:6px;cursor:pointer;font-family:var(--font);font-size:13px">🔗 Conciliar con banco</button>
          <button onclick="exportarExcelCompras()" style="padding:8px 14px;background:var(--color-bg-card);color:var(--color-texto);border:1px solid var(--color-borde);border-radius:6px;cursor:pointer;font-family:var(--font);font-size:13px">📥 Exportar PLE</button>
          <button onclick="document.getElementById('c-sunat-file').click()" style="padding:8px 14px;background:var(--color-bg-card);color:var(--color-texto);border:1px solid var(--color-borde);border-radius:6px;cursor:pointer;font-family:var(--font);font-size:13px">📊 Importar SUNAT</button>
          <input type="file" id="c-sunat-file" accept=".xlsx,.xls" style="display:none" onchange="_cSunatHandleFile(this)">
          <button onclick="abrirModalCompra()" style="padding:8px 16px;background:var(--color-secundario);color:#fff;border:none;border-radius:6px;cursor:pointer;font-family:var(--font);font-size:13px;font-weight:500">+ Nueva compra</button>
        </div>
      </div>
      <div id="c-resumen" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;"></div>
      <div id="c-tabla-wrap" style="overflow-x:auto;">
        <div class="cargando"><div class="spinner"></div><span>Cargando…</span></div>
      </div>
    </div>
  `;

  document.getElementById('c-buscar').addEventListener('keydown', e => { if(e.key==='Enter') cargarCompras(); });
  cargarCompras();
}

async function cargarCompras() {
  const periodo = document.getElementById('c-periodo')?.value.trim();
  const buscar  = document.getElementById('c-buscar')?.value.trim().toLowerCase();
  const wrap    = document.getElementById('c-tabla-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div class="cargando"><div class="spinner"></div><span>Cargando…</span></div>';

  let q = _supabase.from('contabilidad_compras').select('*')
    .eq('empresa_id', empresa_activa.id)
    .order('fecha_emision', { ascending: false });
  if (periodo) q = q.eq('periodo', periodo);

  const { data, error } = await q;
  if (error) { wrap.innerHTML = `<p class="error-texto">Error: ${escapar(error.message)}</p>`; return; }

  let filas = data || [];
  if (buscar) filas = filas.filter(r =>
    (r.proveedor||'').toLowerCase().includes(buscar) ||
    (r.serie_cdp||'').toLowerCase().includes(buscar) ||
    (r.nro_doc_identidad||'').toLowerCase().includes(buscar)
  );

  const totalBI  = filas.reduce((s,r) => s + Number(r.bi_gravado_dg||0), 0);
  const totalIGV = filas.reduce((s,r) => s + Number(r.igv_ipm_dg||0), 0);
  const totalCP  = filas.reduce((s,r) => s + Number(r.total_cp||0), 0);

  if (!filas.length) {
    const resC = document.getElementById('c-resumen');
    if (resC) resC.innerHTML = '';
    wrap.innerHTML = '<p style="text-align:center;color:var(--color-texto-suave);padding:40px">Sin registros en este período.</p>';
    return;
  }

  // MEJORA 7: verificar qué comprobantes tienen movimiento bancario aplicado
  const numeros = filas.map(r => [r.serie_cdp, r.nro_cp_inicial].filter(Boolean).join('-')).filter(Boolean);
  const { data: mbdAplicados } = numeros.length
    ? await _supabase.from('tesoreria_mbd').select('nro_factura_doc, nro_operacion_bancaria, monto, id')
        .eq('empresa_id', empresa_activa.id).eq('entrega_doc', 'EMITIDO').in('nro_factura_doc', numeros)
    : { data: [] };
  const aplicadosMap = new Map((mbdAplicados || []).map(r => [r.nro_factura_doc, r]));

  // Estadísticas de conciliación
  const _nDocC    = r => [r.serie_cdp, r.nro_cp_inicial].filter(Boolean).join('-');
  const countAplicC = filas.filter(r => aplicadosMap.has(_nDocC(r))).length;
  const countPendC  = filas.length - countAplicC;
  const montoAplicC = filas.filter(r => aplicadosMap.has(_nDocC(r))).reduce((s,r) => s + Number(r.total_cp||0), 0);
  const montoPendC  = totalCP - montoAplicC;
  const pctAplicC   = filas.length > 0 ? Math.round(countAplicC / filas.length * 100) : 0;

  const resumen = document.getElementById('c-resumen');
  if (resumen) resumen.innerHTML = `
    <div style="width:100%;flex-basis:100%;display:flex;align-items:center;flex-wrap:wrap;gap:8px;
      padding:8px 12px;background:rgba(128,128,128,.05);border:1px solid var(--color-borde);
      border-radius:8px;font-size:11px;font-weight:600;box-sizing:border-box">
      <span style="background:#2F855A;color:#fff;padding:3px 10px;border-radius:12px">✅ APLICADO ${countAplicC}</span>
      <span style="background:#C53030;color:#fff;padding:3px 10px;border-radius:12px">🔴 PENDIENTE ${countPendC}</span>
      <span style="color:var(--color-texto-suave);font-size:10px;font-weight:400">— ${filas.length} comprobante(s) · ${pctAplicC}% conciliado</span>
    </div>
    <div style="background:var(--color-secundario);color:#fff;padding:12px 16px;border-radius:8px;min-width:130px">
      <div style="font-size:11px;opacity:.8">BI GRAVADO DG</div>
      <div style="font-size:18px;font-weight:700">${formatearMoneda(totalBI)}</div>
    </div>
    <div style="background:#2C7A7B;color:#fff;padding:12px 16px;border-radius:8px;min-width:130px">
      <div style="font-size:11px;opacity:.8">IGV / IPM DG</div>
      <div style="font-size:18px;font-weight:700">${formatearMoneda(totalIGV)}</div>
    </div>
    <div style="background:var(--color-critico);color:#fff;padding:12px 16px;border-radius:8px;min-width:130px">
      <div style="font-size:11px;opacity:.8">TOTAL COMPRAS</div>
      <div style="font-size:18px;font-weight:700">${formatearMoneda(totalCP)}</div>
    </div>
    <div style="background:#276749;color:#fff;padding:12px 16px;border-radius:8px;min-width:130px">
      <div style="font-size:11px;opacity:.8">✅ APLICADOS</div>
      <div style="font-size:18px;font-weight:700">${countAplicC}</div>
      <div style="font-size:11px;opacity:.75">${formatearMoneda(montoAplicC)}</div>
    </div>
    <div style="background:#C53030;color:#fff;padding:12px 16px;border-radius:8px;min-width:130px">
      <div style="font-size:11px;opacity:.8">🔴 PENDIENTES</div>
      <div style="font-size:18px;font-weight:700">${countPendC}</div>
      <div style="font-size:11px;opacity:.75">${formatearMoneda(montoPendC)}</div>
    </div>
  `;

  wrap.innerHTML = `
    <table class="tabla-nexum">
      <thead><tr>
        <th>Período</th><th>Fecha Emisión</th><th>Tipo CP</th><th>Serie</th><th>N° Inicial</th>
        <th>Tipo Doc ID</th><th>N° Documento</th><th>Proveedor</th>
        <th style="text-align:right">B.I. Grav. DG</th>
        <th style="text-align:right">IGV/IPM DG</th>
        <th style="text-align:right">Total CP</th>
        <th>Moneda</th><th style="text-align:center">Banco</th><th style="text-align:center">Acc.</th>
      </tr></thead>
      <tbody>
        ${filas.map(r => {
          const nDoc    = [r.serie_cdp, r.nro_cp_inicial].filter(Boolean).join('-');
          const movLink = aplicadosMap.get(nDoc);
          const bancoHtml = movLink
            ? `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer"
                 title="Click para ver movimiento bancario vinculado"
                 onclick="_verMovBancarioLink('${escapar(nDoc)}','COMPRA')">
                <span style="background:#2F855A;color:#fff;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700">✅ APLIC.</span>
                <span style="font-family:monospace;font-size:9px;color:#22c55e;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapar(movLink.nro_operacion_bancaria||'')}</span>
              </div>`
            : `<span style="background:#C53030;color:#fff;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700;cursor:pointer"
                 title="Click para conciliar"
                 onclick="_conciliarCompraIndividual('${r.id}','${escapar(nDoc)}','${escapar(r.proveedor||'')}',${Number(r.total_cp||0)},'${escapar(r.fecha_emision||'')}')">🔴 PEND.</span>`;
          return `
          <tr>
            <td>${escapar(r.periodo)}</td>
            <td style="white-space:nowrap">${formatearFecha(r.fecha_emision)}</td>
            <td style="text-align:center">${escapar(String(r.tipo_cp_doc))}</td>
            <td>${escapar(r.serie_cdp)}</td>
            <td style="text-align:right">${escapar(String(r.nro_cp_inicial))}</td>
            <td>${escapar(TIPOS_DOC_ID_C[r.tipo_doc_identidad]||r.tipo_doc_identidad)}</td>
            <td>${escapar(r.nro_doc_identidad)}</td>
            <td>${escapar(truncar(r.proveedor,28))}</td>
            <td style="text-align:right">${formatearMoneda(r.bi_gravado_dg, r.moneda==='USD'?'USD':'PEN')}</td>
            <td style="text-align:right">${formatearMoneda(r.igv_ipm_dg, r.moneda==='USD'?'USD':'PEN')}</td>
            <td style="text-align:right;font-weight:600">${formatearMoneda(r.total_cp, r.moneda==='USD'?'USD':'PEN')}</td>
            <td>${escapar(r.moneda)}</td>
            <td style="text-align:center">${bancoHtml}</td>
            <td style="text-align:center;white-space:nowrap">
              <button onclick="abrirModalCompra('${r.id}')" title="Editar" style="padding:4px 8px;background:rgba(44,82,130,.1);color:var(--color-secundario);border:none;border-radius:4px;cursor:pointer;font-size:13px">✏️</button>
              <button onclick="_conciliarCompraIndividual('${r.id}','${escapar(nDoc)}','${escapar(r.proveedor||'')}',${Number(r.total_cp||0)},'${escapar(r.fecha_emision||'')}')" title="Conciliar con movimiento bancario" style="padding:4px 8px;background:rgba(113,71,224,.1);color:#7147e0;border:none;border-radius:4px;cursor:pointer;font-size:13px">🔗</button>
              <button onclick="_bmBuscarMov('COMPRA','${r.id}','${escapar(nDoc)}','${escapar(r.proveedor||'')}',${Number(r.total_cp||0)},'${escapar(r.fecha_emision||'')}')" title="📂 Buscar movimiento bancario manualmente" style="padding:4px 8px;background:rgba(85,60,154,.1);color:#553C9A;border:none;border-radius:4px;cursor:pointer;font-size:13px">📂</button>
              <button onclick="eliminarCompra('${r.id}')" title="Eliminar" style="padding:4px 8px;background:rgba(197,48,48,.1);color:#C53030;border:none;border-radius:4px;cursor:pointer;font-size:13px">🗑️</button>
            </td>
          </tr>
        `}).join('')}
      </tbody>
    </table>
    <p style="font-size:12px;color:var(--color-texto-suave);margin-top:8px">${filas.length} comprobante(s)</p>
  `;
}

async function abrirModalCompra(id = null) {
  let item = null;
  if (id) {
    const { data } = await _supabase.from('contabilidad_compras').select('*').eq('id', id).single();
    item = data;
  }
  const hoy = new Date().toISOString().slice(0,10);
  const periodo = item?.periodo || (() => { const d=new Date(); return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}`; })();

  const mc = document.getElementById('modal-container');
  mc.innerHTML = `
    <div class="modal-overlay" style="display:flex" onclick="if(event.target===this)cerrarModalCompra()">
      <div class="modal" style="max-width:860px;width:95%;max-height:90vh;overflow-y:auto">
        <div class="modal-header">
          <h3>🛒 ${id?'Editar':'Nueva'} Compra — Registro PLE</h3>
          <button class="modal-cerrar" onclick="cerrarModalCompra()">✕</button>
        </div>
        <div class="modal-body">
          <div id="c-alerta" class="alerta-error"></div>

          <p style="font-size:12px;font-weight:600;color:var(--color-texto-suave);margin-bottom:8px;text-transform:uppercase">Datos del comprobante</p>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
            <div class="campo"><label>RUC Empresa <span class="req">*</span></label>
              <input type="text" id="c-ruc" value="${escapar(item?.ruc||empresa_activa.ruc||'')}" maxlength="11"></div>
            <div class="campo" style="grid-column:span 2"><label>Razón Social <span class="req">*</span></label>
              <input type="text" id="c-razon" value="${escapar(item?.razon_social||empresa_activa.nombre||'')}"></div>
            <div class="campo"><label>Período <span class="req">*</span></label>
              <input type="text" id="c-periodo-m" value="${periodo}" placeholder="YYYYMM" maxlength="6"></div>
            <div class="campo"><label>CAR SUNAT</label>
              <input type="text" id="c-car" value="${escapar(item?.car_sunat||'')}"></div>
            <div class="campo"><label>Fecha Emisión <span class="req">*</span></label>
              <input type="date" id="c-fecha" value="${item?.fecha_emision||hoy}"></div>
            <div class="campo"><label>Fecha Vcto/Pago</label>
              <input type="date" id="c-fecha-vcto" value="${item?.fecha_vcto_pago||''}"></div>
            <div class="campo"><label>Tipo CP/Doc <span class="req">*</span></label>
              <input type="number" id="c-tipo-cp" value="${item?.tipo_cp_doc||1}"></div>
            <div class="campo"><label>Serie CDP <span class="req">*</span></label>
              <input type="text" id="c-serie" value="${escapar(item?.serie_cdp||'')}" placeholder="F001"></div>
            <div class="campo"><label>Año</label>
              <input type="number" id="c-anio" value="${item?.anio||new Date().getFullYear()}"></div>
            <div class="campo"><label>N° CP Inicial <span class="req">*</span></label>
              <input type="number" id="c-nro-ini" value="${item?.nro_cp_inicial||''}"></div>
            <div class="campo"><label>N° CP Final</label>
              <input type="number" id="c-nro-fin" value="${item?.nro_cp_final||''}"></div>
          </div>

          <p style="font-size:12px;font-weight:600;color:var(--color-texto-suave);margin-bottom:8px;text-transform:uppercase">Datos del proveedor</p>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
            <div class="campo"><label>Tipo Doc ID <span class="req">*</span></label>
              <select id="c-tipo-id">
                ${Object.entries(TIPOS_DOC_ID_C).map(([k,v])=>`<option value="${k}" ${(item?.tipo_doc_identidad||'6')===k?'selected':''}>${k} — ${v}</option>`).join('')}
              </select></div>
            <div class="campo"><label>N° Doc Identidad <span class="req">*</span></label>
              <input type="text" id="c-nro-id" value="${escapar(item?.nro_doc_identidad||'')}"></div>
            <div class="campo" style="grid-column:span 2"><label>Proveedor <span class="req">*</span></label>
              <input type="text" id="c-proveedor" value="${escapar(item?.proveedor||'')}"></div>
          </div>

          <p style="font-size:12px;font-weight:600;color:var(--color-texto-suave);margin-bottom:8px;text-transform:uppercase">Importes</p>
          <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:16px">
            <div class="campo"><label>BI Grav. DG <span class="req">*</span></label>
              <input type="number" id="c-bi-dg" step="0.01" value="${item?.bi_gravado_dg||0}" onchange="calcTotalCompra()"></div>
            <div class="campo"><label>IGV/IPM DG <span class="req">*</span></label>
              <input type="number" id="c-igv-dg" step="0.01" value="${item?.igv_ipm_dg||0}" onchange="calcTotalCompra()"></div>
            <div class="campo"><label>BI Grav. DGNG</label>
              <input type="number" id="c-bi-dgng" step="0.01" value="${item?.bi_gravado_dgng||0}" onchange="calcTotalCompra()"></div>
            <div class="campo"><label>IGV/IPM DGNG</label>
              <input type="number" id="c-igv-dgng" step="0.01" value="${item?.igv_ipm_dgng||0}" onchange="calcTotalCompra()"></div>
            <div class="campo"><label>BI Grav. DNG</label>
              <input type="number" id="c-bi-dng" step="0.01" value="${item?.bi_gravado_dng||0}" onchange="calcTotalCompra()"></div>
            <div class="campo"><label>IGV/IPM DNG</label>
              <input type="number" id="c-igv-dng" step="0.01" value="${item?.igv_ipm_dng||0}" onchange="calcTotalCompra()"></div>
            <div class="campo"><label>Valor Adq. NG</label>
              <input type="number" id="c-adq-ng" step="0.01" value="${item?.valor_adq_ng||0}" onchange="calcTotalCompra()"></div>
            <div class="campo"><label>ISC</label>
              <input type="number" id="c-isc" step="0.01" value="${item?.isc||0}" onchange="calcTotalCompra()"></div>
            <div class="campo"><label>ICBPER</label>
              <input type="number" id="c-icb" step="0.01" value="${item?.icbper||0}" onchange="calcTotalCompra()"></div>
            <div class="campo"><label>Otros Trib.</label>
              <input type="number" id="c-otros" step="0.01" value="${item?.otros_trib_cargos||0}" onchange="calcTotalCompra()"></div>
            <div class="campo"><label style="font-weight:700;color:var(--color-secundario)">Total CP <span class="req">*</span></label>
              <input type="number" id="c-total" step="0.01" value="${item?.total_cp||0}" style="font-weight:600"></div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin-bottom:16px">
            <div class="campo"><label>Moneda <span class="req">*</span></label>
              <select id="c-moneda">
                <option value="PEN" ${(item?.moneda||'PEN')==='PEN'?'selected':''}>PEN — Soles</option>
                <option value="USD" ${item?.moneda==='USD'?'selected':''}>USD — Dólares</option>
              </select></div>
            <div class="campo"><label>Tipo Cambio <span class="req">*</span></label>
              <input type="number" id="c-tc" step="0.0001" value="${item?.tipo_cambio||1}"></div>
            <div class="campo"><label>Detracción</label>
              <input type="number" id="c-detraccion" step="0.01" value="${item?.detraccion||0}"></div>
            <div class="campo"><label>Est. Comp.</label>
              <input type="number" id="c-est" value="${item?.est_comp||1}"></div>
          </div>

          <details style="margin-bottom:12px">
            <summary style="cursor:pointer;font-size:12px;font-weight:600;color:var(--color-texto-suave);text-transform:uppercase">Doc. Modificado / Adicionales</summary>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:12px">
              <div class="campo"><label>Fecha Emisión Mod.</label>
                <input type="date" id="c-fecha-mod" value="${item?.fecha_emision_mod||''}"></div>
              <div class="campo"><label>Tipo CP Mod.</label>
                <input type="number" id="c-tipo-mod" value="${item?.tipo_cp_modificado||''}"></div>
              <div class="campo"><label>Serie CP Mod.</label>
                <input type="text" id="c-serie-mod" value="${escapar(item?.serie_cp_modificado||'')}"></div>
              <div class="campo"><label>N° CP Mod.</label>
                <input type="text" id="c-nro-mod" value="${escapar(item?.nro_cp_modificado||'')}"></div>
              <div class="campo"><label>COD. DAM o DSI</label>
                <input type="text" id="c-dam" value="${escapar(item?.cod_dam_dsi||'')}"></div>
              <div class="campo"><label>Clasif. Bss y Sss</label>
                <input type="text" id="c-clasif" value="${escapar(item?.clasif_bss_sss||'')}"></div>
              <div class="campo"><label>ID Proyecto</label>
                <input type="text" id="c-proyecto" value="${escapar(item?.id_proyecto||'')}"></div>
              <div class="campo"><label>% Part.</label>
                <input type="number" id="c-porc" step="0.0001" value="${item?.porc_part||0}"></div>
              <div class="campo"><label>IMB</label>
                <input type="number" id="c-imb" step="0.01" value="${item?.imb||0}"></div>
              <div class="campo"><label>CAR Orig / Ind E o I</label>
                <input type="text" id="c-car-orig" value="${escapar(item?.car_orig||'')}"></div>
              <div class="campo"><label>Tipo Nota</label>
                <input type="text" id="c-tipo-nota" value="${escapar(item?.tipo_nota||'')}"></div>
              <div class="campo"><label>Incal</label>
                <input type="number" id="c-incal" step="0.01" value="${item?.incal||0}"></div>
            </div>
          </details>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secundario" onclick="cerrarModalCompra()">Cancelar</button>
          <button class="btn btn-primario" onclick="guardarCompra('${id||''}')">💾 Guardar</button>
        </div>
      </div>
    </div>
  `;
}

function calcTotalCompra() {
  const n = id => parseFloat(document.getElementById(id)?.value)||0;
  const total = n('c-bi-dg') + n('c-igv-dg') + n('c-bi-dgng') + n('c-igv-dgng') +
    n('c-bi-dng') + n('c-igv-dng') + n('c-adq-ng') + n('c-isc') + n('c-icb') + n('c-otros');
  const el = document.getElementById('c-total');
  if (el) el.value = total.toFixed(2);
}

function cerrarModalCompra() {
  const mc = document.getElementById('modal-container');
  if (mc) mc.innerHTML = '';
}

async function guardarCompra(id) {
  const alerta = document.getElementById('c-alerta');
  alerta.classList.remove('visible');

  const ruc    = document.getElementById('c-ruc').value.trim();
  const razon  = document.getElementById('c-razon').value.trim();
  const periodo = document.getElementById('c-periodo-m').value.trim();
  const fecha  = document.getElementById('c-fecha').value;
  const tipoCp = parseInt(document.getElementById('c-tipo-cp').value);
  const serie  = document.getElementById('c-serie').value.trim();
  const nroIni = parseInt(document.getElementById('c-nro-ini').value);
  const tipoId = document.getElementById('c-tipo-id').value;
  const nroId  = document.getElementById('c-nro-id').value.trim();
  const proveedor = document.getElementById('c-proveedor').value.trim();

  if (!ruc||!razon||!periodo||!fecha||isNaN(tipoCp)||!serie||isNaN(nroIni)||!tipoId||!nroId||!proveedor) {
    alerta.textContent = 'Complete todos los campos requeridos (*)'; alerta.classList.add('visible'); return;
  }
  if (!/^\d{6}$/.test(periodo)) {
    alerta.textContent = 'El período debe tener formato YYYYMM'; alerta.classList.add('visible'); return;
  }

  const n = id => parseFloat(document.getElementById(id)?.value)||0;
  const payload = {
    empresa_id: empresa_activa.id,
    ruc, razon_social: razon, periodo,
    car_sunat: document.getElementById('c-car').value.trim()||null,
    fecha_emision: fecha,
    fecha_vcto_pago: document.getElementById('c-fecha-vcto').value||null,
    tipo_cp_doc: tipoCp, serie_cdp: serie,
    anio: parseInt(document.getElementById('c-anio').value)||null,
    nro_cp_inicial: nroIni,
    nro_cp_final: parseInt(document.getElementById('c-nro-fin').value)||null,
    tipo_doc_identidad: tipoId, nro_doc_identidad: nroId, proveedor,
    bi_gravado_dg: n('c-bi-dg'), igv_ipm_dg: n('c-igv-dg'),
    bi_gravado_dgng: n('c-bi-dgng'), igv_ipm_dgng: n('c-igv-dgng'),
    bi_gravado_dng: n('c-bi-dng'), igv_ipm_dng: n('c-igv-dng'),
    valor_adq_ng: n('c-adq-ng'), isc: n('c-isc'), icbper: n('c-icb'),
    otros_trib_cargos: n('c-otros'), total_cp: n('c-total'),
    moneda: document.getElementById('c-moneda').value,
    tipo_cambio: parseFloat(document.getElementById('c-tc').value)||1,
    detraccion: n('c-detraccion'),
    est_comp: parseInt(document.getElementById('c-est').value)||1,
    fecha_emision_mod: document.getElementById('c-fecha-mod').value||null,
    tipo_cp_modificado: parseInt(document.getElementById('c-tipo-mod').value)||null,
    serie_cp_modificado: document.getElementById('c-serie-mod').value.trim()||null,
    cod_dam_dsi: document.getElementById('c-dam').value.trim()||null,
    nro_cp_modificado: document.getElementById('c-nro-mod').value.trim()||null,
    clasif_bss_sss: document.getElementById('c-clasif').value.trim()||null,
    id_proyecto: document.getElementById('c-proyecto').value.trim()||null,
    porc_part: parseFloat(document.getElementById('c-porc').value)||null,
    imb: n('c-imb'), car_orig: document.getElementById('c-car-orig').value.trim()||null,
    tipo_nota: document.getElementById('c-tipo-nota').value.trim()||null,
    incal: n('c-incal'),
    creado_por: perfil_usuario.id,
    fecha_actualizacion: new Date().toISOString(),
  };

  let error;
  if (id) ({ error } = await _supabase.from('contabilidad_compras').update(payload).eq('id', id));
  else    ({ error } = await _supabase.from('contabilidad_compras').insert(payload));

  if (error) { alerta.textContent = 'Error: ' + error.message; alerta.classList.add('visible'); return; }
  mostrarToast(id ? 'Compra actualizada.' : 'Compra registrada.', 'exito');
  cerrarModalCompra();
  cargarCompras();
}

async function eliminarCompra(id) {
  const ok = await confirmar('¿Eliminar este comprobante de compra?', { btnOk: 'Eliminar', btnColor: '#C53030' });
  if (!ok) return;
  const { error } = await _supabase.from('contabilidad_compras').delete().eq('id', id);
  if (error) { mostrarToast('Error al eliminar.', 'error'); return; }
  mostrarToast('Registro eliminado.', 'exito');
  cargarCompras();
}

async function exportarExcelCompras() {
  const periodo = document.getElementById('c-periodo')?.value.trim();
  let q = _supabase.from('contabilidad_compras').select('*')
    .eq('empresa_id', empresa_activa.id).order('fecha_emision');
  if (periodo) q = q.eq('periodo', periodo);
  const { data } = await q;
  if (!data?.length) { mostrarToast('Sin datos para exportar.', 'atencion'); return; }

  const cab = [
    'RUC','Apellidos y Nombres o Razón social','Periodo','CAR SUNAT',
    'Fecha de emisión','Fecha Vcto/Pago','Tipo CP/Doc.','Serie del CDP','Año',
    'Nro CP Nro Inicial (Rango)','Nro Final (Rango)','Tipo Doc Identidad',
    'Nro Doc Identidad','Apellidos Nombres/ Razón Social',
    'BI Gravado DG','IGV / IPM DG','BI Gravado DGNG','IGV / IPM DGNG',
    'BI Gravado DNG','IGV / IPM DNG','Valor Adq. NG','ISC','ICBPER',
    'Otros Trib/ Cargos','Total CP','Moneda','Tipo de Cambio',
    'Fecha Emisión Doc Modificado','Tipo CP Modificado','Serie CP Modificado',
    'COD. DAM O DSI','Nro CP Modificado','Clasif de Bss y Sss',
    'ID Proyecto Operadores','PorcPart','IMB','CAR Orig/ Ind E o I',
    'Detracción','Tipo de Nota','Est. Comp.','Incal'
  ];
  const filas = data.map(r => [
    r.ruc, r.razon_social, r.periodo, r.car_sunat,
    r.fecha_emision, r.fecha_vcto_pago, r.tipo_cp_doc, r.serie_cdp, r.anio,
    r.nro_cp_inicial, r.nro_cp_final, r.tipo_doc_identidad, r.nro_doc_identidad, r.proveedor,
    r.bi_gravado_dg, r.igv_ipm_dg, r.bi_gravado_dgng, r.igv_ipm_dgng,
    r.bi_gravado_dng, r.igv_ipm_dng, r.valor_adq_ng, r.isc, r.icbper,
    r.otros_trib_cargos, r.total_cp, r.moneda, r.tipo_cambio,
    r.fecha_emision_mod, r.tipo_cp_modificado, r.serie_cp_modificado,
    r.cod_dam_dsi, r.nro_cp_modificado, r.clasif_bss_sss,
    r.id_proyecto, r.porc_part, r.imb, r.car_orig,
    r.detraccion, r.tipo_nota, r.est_comp, r.incal
  ]);

  const ws = XLSX.utils.aoa_to_sheet([cab, ...filas]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Hoja1');
  XLSX.writeFile(wb, `RC_${empresa_activa.nombre_corto}_${periodo||'todos'}.xlsx`);
  mostrarToast('Exportado en formato PLE.', 'exito');
}

// ── Importar SUNAT Excel con deduplicación ────────────────────────

let _cSunatDatos = [];

function _cSunatHandleFile(input) {
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

      _cSunatDatos = rows.slice(1).map((r, i) => {
        const serie = _str(r[7]);
        const nro   = parseInt(r[9]) || 0;
        if (!serie && !nro) return null;
        const fecha = _fecha(r[4]);
        const total = Math.abs(_num(r[24]));
        return {
          _fila:    i + 2,
          _clave:   `${serie}-${nro}`,
          _ok:      !!fecha && total > 0,
          empresa_id:           empresa_activa.id,
          ruc:                  _str(empresa_activa.ruc || ''),
          razon_social:         _str(empresa_activa.nombre || ''),
          periodo:              fecha ? fecha.slice(0,7).replace('-','') : '',
          car_sunat:            _str(r[3]),
          fecha_emision:        fecha,
          fecha_vcto_pago:      _fecha(r[5]) || null,
          tipo_cp_doc:          parseInt(r[6]) || 1,
          serie_cdp:            serie,
          anio:                 parseInt(r[8]) || (fecha ? parseInt(fecha.slice(0,4)) : null),
          nro_cp_inicial:       nro,
          nro_cp_final:         parseInt(r[10]) || nro,
          tipo_doc_identidad:   _str(r[11]) || '6',
          nro_doc_identidad:    _str(r[12]),
          proveedor:            _str(r[13]),
          bi_gravado_dg:        _num(r[14]),
          igv_ipm_dg:           _num(r[15]),
          bi_gravado_dgng:      _num(r[16]),
          igv_ipm_dgng:         _num(r[17]),
          bi_gravado_dng:       _num(r[18]),
          igv_ipm_dng:          _num(r[19]),
          valor_adq_ng:         _num(r[20]),
          isc:                  _num(r[21]),
          icbper:               _num(r[22]),
          otros_trib_cargos:    _num(r[23]),
          total_cp:             total,
          moneda:               _mon(r[25]),
          tipo_cambio:          _num(r[26]) || 1,
          est_comp:             parseInt(r[28]) || 1,
          creado_por:           perfil_usuario.id,
          fecha_actualizacion:  new Date().toISOString(),
        };
      }).filter(Boolean);

      const periodo = document.getElementById('c-periodo')?.value.trim() ||
        (_cSunatDatos[0]?.periodo || '');

      const { data: existentes } = await _supabase
        .from('contabilidad_compras').select('serie_cdp, nro_cp_inicial, total_cp')
        .eq('empresa_id', empresa_activa.id)
        .eq('periodo', periodo);

      const mapExist = new Map((existentes||[]).map(r => [`${r.serie_cdp}-${r.nro_cp_inicial}`, r.total_cp]));

      let nuevos = 0, actualizados = 0, sinCambios = 0, invalidos = 0;
      _cSunatDatos.forEach(r => {
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
        <div class="modal-overlay" style="display:flex" onclick="if(event.target===this)_cSunatCerrar()">
          <div class="modal" style="max-width:900px;width:95%;max-height:92vh;overflow-y:auto">
            <div class="modal-header">
              <h3>📊 Importar SUNAT — Registro de Compras</h3>
              <button class="modal-cerrar" onclick="_cSunatCerrar()">✕</button>
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
                    <th>Serie-N°</th><th>Fecha</th><th>Proveedor</th>
                    <th style="text-align:right">BI Grav. DG</th>
                    <th style="text-align:right">IGV</th>
                    <th style="text-align:right">Total</th><th>Mon.</th><th>Estado</th>
                  </tr></thead>
                  <tbody>
                    ${_cSunatDatos.filter(r=>r._ok).slice(0,30).map(r => {
                      const color = r._estado==='NUEVO'?'#2F855A':r._estado==='ACTUALIZAR'?'#2C5282':'#4A5568';
                      const label = r._estado==='NUEVO'?'NUEVO':r._estado==='ACTUALIZAR'?'ACTUALIZAR':'SIN CAMBIO';
                      return `<tr>
                        <td class="text-mono">${escapar(r._clave)}</td>
                        <td style="white-space:nowrap">${r.fecha_emision||'—'}</td>
                        <td style="font-size:11px">${escapar((r.proveedor||'—').slice(0,25))}</td>
                        <td style="text-align:right">${formatearMoneda(r.bi_gravado_dg,r.moneda==='USD'?'USD':'PEN')}</td>
                        <td style="text-align:right">${formatearMoneda(r.igv_ipm_dg,r.moneda==='USD'?'USD':'PEN')}</td>
                        <td style="text-align:right;font-weight:600">${formatearMoneda(r.total_cp,r.moneda==='USD'?'USD':'PEN')}</td>
                        <td>${escapar(r.moneda)}</td>
                        <td><span style="font-size:10px;background:${color};color:#fff;padding:2px 6px;border-radius:8px">${label}</span></td>
                      </tr>`;
                    }).join('')}
                    ${_cSunatDatos.filter(r=>r._ok).length > 30
                      ? `<tr><td colspan="8" style="text-align:center;color:var(--color-texto-suave);padding:8px;font-size:12px">… y ${_cSunatDatos.filter(r=>r._ok).length-30} más</td></tr>`
                      : ''}
                  </tbody>
                </table>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secundario" onclick="_cSunatCerrar()">Cancelar</button>
              <button class="btn btn-primario" id="btn-conf-csunat" onclick="_cSunatConfirmar()"
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

function _cSunatCerrar() {
  _cSunatDatos = [];
  const mc = document.getElementById('modal-container');
  if (mc) mc.innerHTML = '';
}

async function _cSunatConfirmar() {
  const btn = document.getElementById('btn-conf-csunat');
  if (btn) { btn.disabled = true; btn.textContent = 'Importando…'; }

  const nuevos     = _cSunatDatos.filter(r => r._ok && r._estado === 'NUEVO');
  const actualizar = _cSunatDatos.filter(r => r._ok && r._estado === 'ACTUALIZAR');

  let errCount = 0;

  if (nuevos.length) {
    const registros = nuevos.map(({ _fila, _ok, _estado, _clave, ...r }) => r);
    const { error } = await _supabase.from('contabilidad_compras').insert(registros);
    if (error) { errCount++; mostrarToast('Error al insertar: ' + error.message, 'error'); }
  }

  for (const r of actualizar) {
    const { _fila, _ok, _estado, _clave, ...payload } = r;
    const { error } = await _supabase.from('contabilidad_compras')
      .update(payload)
      .eq('empresa_id', empresa_activa.id)
      .eq('serie_cdp', r.serie_cdp)
      .eq('nro_cp_inicial', r.nro_cp_inicial);
    if (error) errCount++;
  }

  _cSunatCerrar();
  if (!errCount) mostrarToast(`✓ ${nuevos.length} nuevo(s) + ${actualizar.length} actualizado(s).`, 'exito');
  else mostrarToast('Importación parcial. Revisa los datos.', 'atencion');
  cargarCompras();
}

// ══════════════════════════════════════════════════════════════════
// CONCILIACIÓN COMPRAS ↔ TESORERÍA MBD
// ══════════════════════════════════════════════════════════════════

// ── Conciliar una compra individual — busca movs que coincidan ────
async function _conciliarCompraIndividual(compraId, nDoc, proveedor, total, fechaEmision) {
  // Buscar en tesoreria_mbd: movimientos sin comprobante + monto cercano
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

  _cAbrirModalConciliar({ id: compraId, nDoc, proveedor, total, fecha: fechaEmision, tipo: 'COMPRA' }, movs || []);
}

// ── Conciliar lote — todos los PEND. del periodo actual ──────────
async function _conciliarLoteCompras() {
  const periodo = document.getElementById('c-periodo')?.value.trim();
  if (!periodo) { mostrarToast('Selecciona un periodo primero', 'atencion'); return; }

  const mc = document.getElementById('modal-container');
  mc.innerHTML = `
    <div class="modal-overlay" style="display:flex">
      <div class="modal" style="max-width:500px;width:95%;padding:32px;text-align:center">
        <div class="spinner" style="margin:0 auto 12px"></div>
        <div style="color:var(--color-texto-suave)">Buscando comprobantes pendientes…</div>
      </div>
    </div>`;

  // Compras pendientes de aplicar
  const { data: compras } = await _supabase
    .from('contabilidad_compras')
    .select('id, serie_cdp, nro_cp_inicial, proveedor, total_cp, fecha_emision')
    .eq('empresa_id', empresa_activa.id)
    .eq('periodo', periodo);

  if (!compras?.length) {
    document.querySelector('.modal-overlay')?.remove();
    mostrarToast('No hay compras en este periodo', 'atencion');
    return;
  }

  const numeros = compras.map(r => [r.serie_cdp, r.nro_cp_inicial].filter(Boolean).join('-')).filter(Boolean);
  const { data: yaAplic } = numeros.length
    ? await _supabase.from('tesoreria_mbd').select('nro_factura_doc').eq('empresa_id', empresa_activa.id).eq('entrega_doc', 'EMITIDO').in('nro_factura_doc', numeros)
    : { data: [] };
  const aplicadosSet = new Set((yaAplic || []).map(r => r.nro_factura_doc));

  const pendientes = compras.filter(r => {
    const nDoc = [r.serie_cdp, r.nro_cp_inicial].filter(Boolean).join('-');
    return !aplicadosSet.has(nDoc);
  });

  document.querySelector('.modal-overlay')?.remove();

  if (!pendientes.length) {
    mostrarToast(`✅ Todas las compras del periodo ${periodo} ya están conciliadas`, 'exito');
    return;
  }

  // Buscar matches automáticos por monto para cada una
  const matches = [];
  for (const c of pendientes.slice(0, 20)) {
    const nDoc    = [c.serie_cdp, c.nro_cp_inicial].filter(Boolean).join('-');
    const total   = Number(c.total_cp || 0);
    const margen  = Math.max(total * 0.05, 5);
    const { data: movs } = await _supabase
      .from('tesoreria_mbd')
      .select('id, fecha_deposito, monto, descripcion, nro_operacion_bancaria, proveedor_empresa_personal, ruc_dni, entrega_doc')
      .eq('empresa_id', empresa_activa.id)
      .neq('entrega_doc', 'EMITIDO')
      .gte('monto', total - margen)
      .lte('monto', total + margen)
      .limit(5);
    if (movs?.length) {
      // Calcular score simple: monto exacto + proveedor
      const mejor = movs.sort((a, b) => {
        const da = Math.abs(Number(a.monto) - total);
        const db = Math.abs(Number(b.monto) - total);
        return da - db;
      })[0];
      matches.push({ compra: { ...c, nDoc }, mov: mejor, total });
    }
  }

  if (!matches.length) {
    mostrarToast(`${pendientes.length} compra(s) pendiente(s) pero sin movimientos bancarios que coincidan`, 'atencion');
    return;
  }

  // Mostrar preview de matches
  const mc2 = document.getElementById('modal-container');
  mc2.innerHTML = `
    <div class="modal-overlay" style="display:flex" onclick="if(event.target===this)this.parentElement.innerHTML=''">
      <div class="modal" style="max-width:760px;width:95%;max-height:90vh;display:flex;flex-direction:column">
        <div class="modal-header" style="flex-shrink:0">
          <h3>🔗 Conciliar Compras con Banco — ${periodo}</h3>
          <button class="modal-cerrar" onclick="this.closest('.modal-overlay').remove()">✕</button>
        </div>
        <div class="modal-body" style="flex:1;overflow-y:auto">
          <p style="font-size:12px;color:var(--color-texto-suave);margin-bottom:12px">
            Se encontraron <strong>${matches.length}</strong> posible(s) match(es) de ${pendientes.length} compra(s) pendientes.
            Marca las que deseas confirmar.
          </p>
          <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap">
            <button onclick="document.querySelectorAll('[id^=cmp-chk-]').forEach(c=>c.checked=true)"
              style="padding:5px 12px;border:1px solid var(--color-borde);border-radius:6px;background:none;cursor:pointer;font-size:12px;font-family:var(--font);color:var(--color-texto)">
              ☑ Marcar todos</button>
            <button onclick="document.querySelectorAll('[id^=cmp-chk-]').forEach(c=>c.checked=false)"
              style="padding:5px 12px;border:1px solid var(--color-borde);border-radius:6px;background:none;cursor:pointer;font-size:12px;font-family:var(--font);color:var(--color-texto)">
              ☐ Desmarcar todos</button>
          </div>
          ${matches.map((m, i) => {
            const diff = Math.abs(Number(m.mov.monto) - m.total);
            const pct  = m.total > 0 ? Math.round(diff / m.total * 100) : 0;
            return `
            <div style="border:1px solid var(--color-borde);border-radius:8px;padding:12px 14px;margin-bottom:8px;background:var(--color-bg-card)">
              <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer">
                <input type="checkbox" id="cmp-chk-${i}" data-idx="${i}" checked
                  style="margin-top:3px;width:16px;height:16px;flex-shrink:0;cursor:pointer">
                <div style="flex:1;min-width:0">
                  <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px;margin-bottom:6px">
                    <span style="font-weight:700;color:var(--color-secundario)">${escapar(m.compra.nDoc)}</span>
                    <span style="font-weight:700;color:var(--color-exito)">${formatearMoneda(m.total)}</span>
                  </div>
                  <div style="font-size:11px;color:var(--color-texto-suave);margin-bottom:6px">${escapar(truncar(m.compra.proveedor||'—',40))} · ${formatearFecha(m.compra.fecha_emision)}</div>
                  <div style="padding:8px 10px;background:rgba(44,82,130,.06);border:1px solid rgba(44,82,130,.2);border-radius:6px;font-size:12px">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
                      <div>
                        <div style="color:var(--color-secundario);font-weight:600;font-family:monospace;font-size:11px">${escapar(m.mov.nro_operacion_bancaria||'—')}</div>
                        <div style="color:var(--color-texto-suave);font-size:11px">${formatearFecha(m.mov.fecha_deposito)} · ${escapar(truncar(m.mov.descripcion||'—',45))}</div>
                        ${m.mov.proveedor_empresa_personal ? `<div style="font-size:11px;margin-top:1px">${escapar(m.mov.proveedor_empresa_personal)}</div>` : ''}
                      </div>
                      <div style="text-align:right;flex-shrink:0">
                        <div style="font-weight:700;color:var(--color-exito)">${formatearMoneda(m.mov.monto)}</div>
                        ${diff > 0 ? `<div style="font-size:10px;color:${pct>5?'#ef4444':'#f59e0b'}">Dif: ${formatearMoneda(diff)} (${pct}%)</div>` : '<div style="font-size:10px;color:#22c55e">✓ Monto exacto</div>'}
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
          <button class="btn btn-primario" onclick="_cAplicarLoteConciliacion(${JSON.stringify(matches.map(m=>({movId:m.mov.id,nDoc:m.compra.nDoc,proveedor:m.compra.proveedor||'',total:m.total})))})">
            ✅ Aplicar seleccionados
          </button>
        </div>
      </div>
    </div>`;
}

// ── Conciliar compra individual — modal de búsqueda ───────────────
function _cAbrirModalConciliar(compra, movs) {
  const mc = document.getElementById('modal-container');
  const movHtml = movs.length
    ? movs.slice(0, 15).map(m => {
        const diff = Math.abs(Number(m.monto) - compra.total);
        const pct  = compra.total > 0 ? Math.round(diff / compra.total * 100) : 0;
        return `
          <div style="border:1px solid var(--color-borde);border-radius:8px;padding:12px;margin-bottom:8px;background:var(--color-bg-card)">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;margin-bottom:6px">
              <div>
                <div style="font-family:monospace;font-size:12px;font-weight:600;color:var(--color-secundario)">${escapar(m.nro_operacion_bancaria||'—')}</div>
                <div style="font-size:11px;color:var(--color-texto-suave)">${formatearFecha(m.fecha_deposito)}</div>
              </div>
              <div style="text-align:right">
                <div style="font-weight:700;color:var(--color-exito)">${formatearMoneda(m.monto)}</div>
                ${diff > 0 ? `<div style="font-size:10px;color:${pct>5?'#ef4444':'#f59e0b'}">Dif: ${formatearMoneda(diff)} (${pct}%)</div>` : '<div style="font-size:10px;color:#22c55e">✓ Monto exacto</div>'}
              </div>
            </div>
            <div style="font-size:11px;color:var(--color-texto);margin-bottom:2px">${escapar(truncar(m.descripcion||'—',60))}</div>
            ${m.proveedor_empresa_personal ? `<div style="font-size:11px;color:var(--color-texto-suave)">${escapar(m.proveedor_empresa_personal)}</div>` : ''}
            <div style="margin-top:8px;text-align:right">
              <span style="font-size:10px;padding:2px 6px;border-radius:4px;${m.entrega_doc==='EMITIDO'?'background:#2F855A;color:#fff':'background:#C53030;color:#fff'}">${escapar(m.entrega_doc||'PENDIENTE')}</span>
              <button onclick="_cVincularMovimiento('${compra.id}','${m.id}','${escapar(compra.nDoc)}','${escapar(compra.tipo||'COMPRA')}')"
                style="margin-left:8px;padding:4px 12px;background:#2C5282;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-family:var(--font)">
                🔗 Vincular
              </button>
            </div>
          </div>`;
      }).join('')
    : '<div style="padding:24px;text-align:center;color:var(--color-texto-suave)">Sin movimientos bancarios con monto similar. Prueba ajustando el filtro.</div>';

  mc.innerHTML = `
    <div class="modal-overlay" style="display:flex" onclick="if(event.target===this)this.parentElement.innerHTML=''">
      <div class="modal" style="max-width:600px;width:95%;max-height:90vh;display:flex;flex-direction:column">
        <div class="modal-header" style="flex-shrink:0">
          <h3>🔗 Conciliar con Banco — ${escapar(compra.nDoc)}</h3>
          <button class="modal-cerrar" onclick="this.closest('.modal-overlay').remove()">✕</button>
        </div>
        <div class="modal-body" style="flex:1;overflow-y:auto">
          <div style="padding:10px 14px;background:rgba(44,82,130,.07);border-radius:8px;margin-bottom:14px;font-size:12px">
            <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px">
              <div><strong>Comprobante:</strong> ${escapar(compra.nDoc)}</div>
              <div><strong>Total:</strong> ${formatearMoneda(compra.total)}</div>
            </div>
            <div style="margin-top:4px"><strong>Proveedor:</strong> ${escapar(truncar(compra.proveedor||'—',40))}</div>
            <div><strong>Fecha:</strong> ${formatearFecha(compra.fecha)}</div>
          </div>
          <p style="font-size:12px;color:var(--color-texto-suave);margin-bottom:10px">
            ${movs.length} movimiento(s) bancario(s) con monto similar encontrado(s):
          </p>
          ${movHtml}
          <div style="margin-top:14px;border-top:1px solid var(--color-borde);padding-top:12px">
            <p style="font-size:12px;color:var(--color-texto-suave);margin-bottom:8px">¿No encuentras el movimiento? Búsqueda manual:</p>
            <div style="display:flex;gap:8px">
              <input type="text" id="c-conc-buscar" placeholder="N° operación o proveedor"
                style="flex:1;padding:7px 10px;border:1px solid var(--color-borde);border-radius:6px;background:var(--color-bg-card);color:var(--color-texto);font-size:12px;font-family:var(--font)">
              <button onclick="_cBuscarMovManual('${compra.id}','${escapar(compra.nDoc)}','${escapar(compra.tipo||'COMPRA')}')"
                class="btn btn-primario" style="font-size:12px;white-space:nowrap">🔍 Buscar</button>
            </div>
            <div id="c-conc-manual-res" style="margin-top:10px"></div>
          </div>
        </div>
        <div class="modal-footer" style="flex-shrink:0">
          <button class="btn btn-secundario" onclick="this.closest('.modal-overlay').remove()">Cerrar</button>
        </div>
      </div>
    </div>`;
}

async function _cBuscarMovManual(compraId, nDoc, tipoDoc) {
  const q   = (document.getElementById('c-conc-buscar')?.value || '').trim().toLowerCase();
  const res = document.getElementById('c-conc-manual-res');
  if (!q || !res) return;
  res.innerHTML = '<div class="spinner" style="margin:8px auto"></div>';

  const { data: movs } = await _supabase
    .from('tesoreria_mbd')
    .select('id, fecha_deposito, monto, descripcion, nro_operacion_bancaria, proveedor_empresa_personal, entrega_doc')
    .eq('empresa_id', empresa_activa.id)
    .or(`nro_operacion_bancaria.ilike.%${q}%,proveedor_empresa_personal.ilike.%${q}%,descripcion.ilike.%${q}%`)
    .limit(8);

  if (!movs?.length) { res.innerHTML = '<p style="font-size:12px;color:var(--color-texto-suave)">Sin resultados</p>'; return; }
  res.innerHTML = movs.map(m => `
    <div style="border:1px solid var(--color-borde);border-radius:6px;padding:10px;margin-bottom:6px;font-size:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
        <div>
          <div style="font-family:monospace;font-weight:600;color:var(--color-secundario)">${escapar(m.nro_operacion_bancaria||'—')}</div>
          <div style="color:var(--color-texto-suave);font-size:11px">${formatearFecha(m.fecha_deposito)} · ${escapar(truncar(m.descripcion||'—',40))}</div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:700">${formatearMoneda(m.monto)}</div>
          <button onclick="_cVincularMovimiento('${compraId}','${m.id}','${escapar(nDoc)}','${escapar(tipoDoc)}')"
            style="padding:3px 10px;background:#2C5282;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px;font-family:var(--font)">
            🔗 Vincular
          </button>
        </div>
      </div>
    </div>`).join('');
}

async function _cVincularMovimiento(compraId, movId, nDoc, tipoDoc) {
  const hoy = new Date().toISOString().slice(0, 10);
  const { error } = await _supabase.from('tesoreria_mbd').update({
    entrega_doc:          'EMITIDO',
    nro_factura_doc:      nDoc,
    tipo_doc:             tipoDoc,
    estado_conciliacion:  'conciliado',
    fecha_actualizacion:  hoy,
  }).eq('id', movId);

  if (error) { mostrarToast('Error al vincular: ' + error.message, 'error'); return; }

  await _supabase.from('conciliaciones').insert({
    empresa_operadora_id: empresa_activa.id,
    movimiento_id:        movId,
    doc_tipo:             tipoDoc,
    doc_id:               compraId,
    score:                0,
    tipo_match:           'MANUAL',
    estado:               'APROBADO',
    usuario_id:           perfil_usuario?.id || null,
  });

  document.querySelector('.modal-overlay')?.remove();
  mostrarToast(`✅ Vinculado: ${nDoc} → movimiento bancario`, 'exito');
  cargarCompras();
}

async function _cAplicarLoteConciliacion(items) {
  const checks = document.querySelectorAll('[id^=cmp-chk-]');
  const hoy    = new Date().toISOString().slice(0, 10);
  let ok = 0, errores = 0;

  for (const chk of checks) {
    if (!chk.checked) continue;
    const idx  = parseInt(chk.dataset.idx, 10);
    const item = items[idx];
    if (!item) continue;

    const { error } = await _supabase.from('tesoreria_mbd').update({
      entrega_doc:          'EMITIDO',
      nro_factura_doc:      item.nDoc,
      tipo_doc:             'COMPRA',
      estado_conciliacion:  'conciliado',
      proveedor_empresa_personal: item.proveedor || undefined,
      fecha_actualizacion:  hoy,
    }).eq('id', item.movId);

    if (!error) {
      await _supabase.from('conciliaciones').insert({
        empresa_operadora_id: empresa_activa.id,
        movimiento_id:        item.movId,
        doc_tipo:             'COMPRA',
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
  cargarCompras();
}

// ══════════════════════════════════════════════════════════════════
// VER MOVIMIENTO BANCARIO VINCULADO (compartido con Ventas)
// ══════════════════════════════════════════════════════════════════

async function _verMovBancarioLink(nDoc, tipo) {
  const mc = document.getElementById('modal-container');
  mc.innerHTML = `
    <div class="modal-overlay" style="display:flex">
      <div class="modal" style="max-width:520px;width:95%;padding:28px;text-align:center">
        <div class="spinner" style="margin:0 auto 10px"></div>
        <div style="color:var(--color-texto-suave);font-size:13px">Cargando movimiento bancario…</div>
      </div>
    </div>`;

  const { data: movs } = await _supabase
    .from('tesoreria_mbd')
    .select('*')
    .eq('empresa_id', empresa_activa.id)
    .eq('nro_factura_doc', nDoc)
    .limit(5);

  _mbdLinkCache = movs || [];

  const filas = _mbdLinkCache.map((m, i) => `
    <div style="padding:12px 14px;border:1px solid var(--color-borde);border-radius:8px;margin-bottom:10px;background:var(--color-bg-card)">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;margin-bottom:10px">
        <div>
          <div style="font-size:10px;color:var(--color-texto-suave);margin-bottom:2px">N° Operación bancaria</div>
          <div style="font-family:monospace;font-weight:700;font-size:13px;color:var(--color-secundario)">${escapar(m.nro_operacion_bancaria||'—')}</div>
        </div>
        <div>
          <div style="font-size:10px;color:var(--color-texto-suave);margin-bottom:2px">Fecha depósito</div>
          <div>${formatearFecha(m.fecha_deposito)}</div>
        </div>
        <div>
          <div style="font-size:10px;color:var(--color-texto-suave);margin-bottom:2px">Monto</div>
          <div style="font-weight:700;font-size:14px;color:${Number(m.monto)<0?'var(--color-critico)':'var(--color-exito)'}">${formatearMoneda(m.monto)}</div>
        </div>
        <div>
          <div style="font-size:10px;color:var(--color-texto-suave);margin-bottom:2px">Estado</div>
          <span style="background:#2F855A;color:#fff;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700">✅ EMITIDO</span>
        </div>
        ${m.proveedor_empresa_personal ? `<div style="grid-column:span 2"><div style="font-size:10px;color:var(--color-texto-suave);margin-bottom:2px">Proveedor / Empresa</div><div style="font-size:12px">${escapar(m.proveedor_empresa_personal)}</div></div>` : ''}
        ${m.descripcion ? `<div style="grid-column:span 2"><div style="font-size:10px;color:var(--color-texto-suave);margin-bottom:2px">Descripción banco</div><div style="font-size:11px;color:var(--color-texto-suave)">${escapar(m.descripcion)}</div></div>` : ''}
        ${m.ruc_dni ? `<div><div style="font-size:10px;color:var(--color-texto-suave);margin-bottom:2px">RUC / DNI</div><div style="font-family:monospace;font-size:12px">${escapar(m.ruc_dni)}</div></div>` : ''}
        ${m.concepto ? `<div><div style="font-size:10px;color:var(--color-texto-suave);margin-bottom:2px">Concepto</div><div style="font-size:12px">${escapar(m.concepto)}</div></div>` : ''}
        ${m.estado_conciliacion ? `<div style="grid-column:span 2"><div style="font-size:10px;color:var(--color-texto-suave);margin-bottom:2px">Estado conciliación</div><span style="color:#22c55e;font-weight:700;font-size:12px">${escapar(m.estado_conciliacion)}</span></div>` : ''}
      </div>
      <div style="text-align:right">
        <button onclick="_desvincularmovLink(${i},'${escapar(nDoc)}','${tipo}')"
          style="padding:5px 14px;background:rgba(197,48,48,.08);color:#C53030;border:1px solid rgba(197,48,48,.3);border-radius:6px;cursor:pointer;font-size:12px;font-family:var(--font)">
          🔓 Desvincular
        </button>
      </div>
    </div>`).join('');

  mc.innerHTML = `
    <div class="modal-overlay" style="display:flex" onclick="if(event.target===this)this.parentElement.innerHTML=''">
      <div class="modal" style="max-width:540px;width:95%;max-height:85vh;display:flex;flex-direction:column">
        <div class="modal-header" style="flex-shrink:0">
          <h3>🏦 Movimiento bancario vinculado</h3>
          <button class="modal-cerrar" onclick="document.getElementById('modal-container').innerHTML=''">✕</button>
        </div>
        <div class="modal-body" style="flex:1;overflow-y:auto">
          <div style="padding:8px 12px;background:rgba(44,82,130,.07);border-radius:6px;margin-bottom:14px;font-size:12px;display:flex;align-items:center;gap:8px">
            <span>Comprobante: <strong style="color:var(--color-texto)">${escapar(nDoc)}</strong></span>
            <span style="background:${tipo==='VENTA'?'#276749':'#2C5282'};color:#fff;padding:1px 8px;border-radius:4px;font-size:10px;font-weight:700">${tipo}</span>
          </div>
          ${_mbdLinkCache.length ? filas : '<p style="text-align:center;color:var(--color-texto-suave);padding:24px">No se encontró movimiento vinculado.</p>'}
        </div>
        <div class="modal-footer" style="flex-shrink:0">
          <button class="btn btn-secundario" onclick="document.getElementById('modal-container').innerHTML=''">Cerrar</button>
        </div>
      </div>
    </div>`;
}

async function _desvincularmovLink(idx, nDoc, tipo) {
  const mov = _mbdLinkCache?.[idx];
  if (!mov) return;
  const ok = await confirmar(
    `¿Desvincular el movimiento ${mov.nro_operacion_bancaria||''} del comprobante ${nDoc}?`,
    { btnOk: 'Desvincular', btnColor: '#C53030' }
  );
  if (!ok) return;
  const { error } = await _supabase.from('tesoreria_mbd').update({
    entrega_doc:         'PENDIENTE',
    nro_factura_doc:     null,
    tipo_doc:            null,
    estado_conciliacion: null,
    fecha_actualizacion: new Date().toISOString().slice(0, 10),
  }).eq('id', mov.id);
  if (error) { mostrarToast('Error: ' + error.message, 'error'); return; }
  mostrarToast('✅ Desvinculado correctamente', 'exito');
  document.getElementById('modal-container').innerHTML = '';
  if (tipo === 'VENTA') cargarVentas();
  else cargarCompras();
}
