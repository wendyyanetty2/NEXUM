// ═══════════════════════════════════════════════════════════════
// Tributaria — Importador SUNAT universal (Compras / Ventas / RH)
// ═══════════════════════════════════════════════════════════════

let _sunat_preview_data  = [];
let _sunat_preview_tipo  = null;
let _sunat_preview_nombre = null;

// ── Parseo de fecha Excel serial o texto ──────────────────────────
function _sunatFecha(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (isNaN(d.getTime())) return null;
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
  }
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return `${val.getUTCFullYear()}-${String(val.getUTCMonth()+1).padStart(2,'0')}-${String(val.getUTCDate()).padStart(2,'0')}`;
  }
  const s = val.toString().trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d2 = new Date(s);
  return isNaN(d2.getTime()) ? null : d2.toISOString().slice(0,10);
}

function _sunatNum(val) {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

// ── Abrir selector de archivo ─────────────────────────────────────
function importarRegistroComprasSUNAT() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.xlsx,.xls';
  inp.onchange = (e) => { const f = e.target.files[0]; if (f) { const r = new FileReader(); r.onload = (ev) => _procesarComprasSUNAT(ev.target.result, f.name); r.readAsArrayBuffer(f); } };
  inp.click();
}

function importarRegistroVentasSUNAT() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.xlsx,.xls';
  inp.onchange = (e) => { const f = e.target.files[0]; if (f) { const r = new FileReader(); r.onload = (ev) => _procesarVentasSUNAT(ev.target.result, f.name); r.readAsArrayBuffer(f); } };
  inp.click();
}

function importarRegistroRHSUNAT() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.xlsx,.xls';
  inp.onchange = (e) => { const f = e.target.files[0]; if (f) { const r = new FileReader(); r.onload = (ev) => _procesarRHSUNAT(ev.target.result, f.name); r.readAsArrayBuffer(f); } };
  inp.click();
}

// ── Helpers columnas ──────────────────────────────────────────────
function _sunatStr(val) {
  if (val === null || val === undefined || val === '') return null;
  return val.toString().trim().replace(/\s+/g, ' ') || null;
}

// RUC/DNI puede llegar como número grande — convertir sin notación científica
function _sunatRUC(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return Math.round(val).toString().trim();
  return val.toString().trim() || null;
}

function _sunatTDoc(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = parseInt(val);
  return isNaN(n) ? val.toString().trim() : String(n).padStart(2, '0');
}

function _sunatNro(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = parseInt(val);
  return isNaN(n) ? val.toString().trim() : String(n).padStart(8, '0');
}

function _sunatMonedaTri(val) {
  if (!val) return 'PEN';
  const s = val.toString().trim().toUpperCase();
  if (['USD','2','US$','$'].includes(s)) return 'USD';
  if (['EUR','3'].includes(s)) return 'EUR';
  return 'PEN';
}

// ── Parser Registro de Compras SUNAT ─────────────────────────────
// Formato descarga SUNAT (col 0-indexed, fila 0 = encabezados):
//  [0]RUC empresa  [1]RazSoc  [2]Periodo  [3]CAR  [4]Fecha emision
//  [5]Fecha vcto   [6]TipoCP  [7]Serie    [8]Año(concat-skip)
//  [9]NroCP        [10]NroFin [11]TipoIdProv [12]NroDocProv
//  [13]NombreProv  [14]BIGravDG [15]IGV_DG
//  ...             [24]TotalCP [25]Moneda  [26]TipoCambio
//  ...             [37]Detraccion
function _procesarComprasSUNAT(buffer, nombre) {
  try {
    const wb   = XLSX.read(buffer, { type: 'array', cellDates: false });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

    let inicio = 0;
    for (let i = 0; i < Math.min(rows.length, 5); i++) {
      if (_sunatFecha(rows[i][4])) { inicio = i; break; }
    }
    const data = rows.slice(inicio).filter(r => r[4] != null || r[24] != null);

    const parsed = data.map((r, i) => {
      const fecha   = _sunatFecha(r[4]);
      const total   = _sunatNum(r[24]);
      const serie   = _sunatStr(r[7]);
      const nroRaw  = r[9] != null ? parseInt(r[9]) || _sunatStr(r[9]) : null;
      const numero  = nroRaw != null ? String(nroRaw) : null;
      const cdp     = serie && numero ? `${serie}-${numero}` : (serie || numero || null);
      const periodoRaw = _sunatStr(r[2]);
      const periodo = periodoRaw && /^\d{6}$/.test(periodoRaw)
        ? periodoRaw.slice(0,4) + '-' + periodoRaw.slice(4,6)
        : (fecha ? fecha.slice(0, 7) : null);
      return {
        _fila:                 inicio + i + 1,
        fecha,
        fecha_vencimiento:     _sunatFecha(r[5]),
        periodo,
        tipo_documento_codigo: _sunatTDoc(r[6]),
        serie,
        numero,
        cdp,
        ruc_proveedor:         _sunatRUC(r[12]),
        nombre_proveedor:      _sunatStr(r[13]),
        base_imponible:        _sunatNum(r[14]),
        igv:                   _sunatNum(r[15]),
        total,
        moneda:                _sunatMonedaTri(r[25]),
        tipo_cambio:           _sunatNum(r[26]) || 1,
        codigo_detraccion:     _sunatStr(r[37]),
        _ok:                   !!fecha && total !== 0 && !!serie,
      };
    });

    _mostrarPreviewSUNAT(parsed, 'compras', nombre);
  } catch (err) { mostrarToast('Error al leer archivo: ' + err.message, 'error'); }
}

// ── Parser Registro de Ventas SUNAT ──────────────────────────────
// Plantilla / descarga SUNAT (plantilla_ventas.json, col 0-indexed):
//  A(0)=RUC  B(1)=RazSoc  C(2)=Periodo  D(3)=CAR  E(4)=Fecha emision
//  F(5)=FechaVcto  G(6)=TipoCP  H(7)=Serie  I(8)=NroCP  J(9)=NroFin
//  K(10)=TipoIdCli  L(11)=NroDocCli  M(12)=NombreCli
//  N(13)=ValFacExp  O(14)=BIGravada  P(15)=DsctoBi  Q(16)=IGV
//  R(17)=DsctoIGV  S(18)=Exonerado  T(19)=Inafecto  U(20)=ISC
//  V(21)=BIGravIVAP  W(22)=IVAP  X(23)=ICBPER  Y(24)=OtrosTrib
//  Z(25)=TotalCP  AA(26)=Moneda  AB(27)=TipoCambio
function _procesarVentasSUNAT(buffer, nombre) {
  try {
    const wb   = XLSX.read(buffer, { type: 'array', cellDates: false });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

    // Auto-detectar fila de inicio: primera fila donde E(4) tiene un valor con fecha válida
    let inicio = 0;
    for (let i = 0; i < Math.min(rows.length, 5); i++) {
      if (_sunatFecha(rows[i][4])) { inicio = i; break; }
    }

    const data = rows.slice(inicio).filter(r => r[4] != null || r[25] != null);

    const parsed = data.map((r, i) => {
      const fecha  = _sunatFecha(r[4]);
      const total  = _sunatNum(r[25]);
      const serie  = _sunatStr(r[7]);
      const nroRaw = r[8] != null ? parseInt(r[8]) || _sunatStr(r[8]) : null;
      const numero = nroRaw != null ? String(nroRaw) : null;
      const cdp    = serie && numero ? `${serie}-${numero}` : (serie || numero || null);
      // Periodo: leer columna C si tiene formato YYYYMM, sino derivar de fecha
      const periodoRaw = _sunatStr(r[2]);
      const periodo = periodoRaw && /^\d{6}$/.test(periodoRaw)
        ? periodoRaw.slice(0,4) + '-' + periodoRaw.slice(4,6)
        : (fecha ? fecha.slice(0, 7) : null);
      return {
        _fila:                 inicio + i + 1,
        fecha,
        fecha_vencimiento:     _sunatFecha(r[5]),
        periodo,
        tipo_documento_codigo: _sunatTDoc(r[6]),
        serie,
        numero,
        cdp,
        ruc_cliente:           _sunatRUC(r[11]),
        nombre_cliente:        _sunatStr(r[12]),
        base_imponible:        _sunatNum(r[14]),
        igv:                   _sunatNum(r[16]),
        total,
        moneda:                _sunatMonedaTri(r[26]),
        tipo_cambio:           _sunatNum(r[27]) || 1,
        _ok:                   !!fecha && total !== 0 && !!serie,
      };
    });

    _mostrarPreviewSUNAT(parsed, 'ventas', nombre);
  } catch (err) { mostrarToast('Error al leer archivo: ' + err.message, 'error'); }
}

// ── Parser Registro de RH ─────────────────────────────────────────
// Formato: Fecha Emisión | Tipo Doc | Nro Doc | Estado Doc |
//          Tipo Doc Emisor | Nro Doc Emisor (DNI/RUC) | Apellidos/Razón Social |
//          Tipo Renta | Gratuito | Descripción | Observación |
//          Moneda | Renta Bruta | Imp. a la Renta | Renta Neta | Monto Pend.Pago
function _procesarRHSUNAT(buffer, nombre) {
  try {
    const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    const data = rows.slice(1).filter(r => r[0] !== '' || r[12] !== '');

    const parsed = data.map((r, i) => {
      const fecha    = _sunatFecha(r[0]);
      const estadoR  = (r[3] || '').toString().trim().toUpperCase();
      const monedaR  = (r[11]|| '').toString().trim().toUpperCase();
      const bruto    = _sunatNum(r[12]);
      const reten    = _sunatNum(r[13]);
      return {
        _fila:             i + 2,
        fecha,
        periodo:           fecha ? fecha.slice(0,7) : null,
        numero_rh:         (r[2] || '').toString().trim() || null,
        estado:            estadoR.includes('ANULADO') && !estadoR.startsWith('NO') ? 'ANULADO' : 'EMITIDO',
        ruc_dni_prestador: (r[5] || '').toString().trim() || null,
        nombre_prestador:  (r[6] || '').toString().trim().replace(/\s+/g,' ') || null,
        concepto:          (r[9] || '').toString().trim() || 'SERVICIO',
        observaciones:     (r[10]|| '').toString().trim() || null,
        moneda:            monedaR === 'SOLES' || monedaR === 'PEN' ? 'PEN' : (monedaR === 'DOLARES' || monedaR === 'USD' ? 'USD' : 'PEN'),
        monto_bruto:       bruto,
        monto_retencion:   reten,
        monto_neto:        _sunatNum(r[14]),
        tiene_retencion:   reten > 0,
        porcentaje_retencion: bruto > 0 ? Math.round(reten / bruto * 10000) / 100 : 0,
        _ok:               !!fecha && bruto > 0,
      };
    });

    _mostrarPreviewSUNAT(parsed, 'rh', nombre);
  } catch (err) { mostrarToast('Error al leer archivo: ' + err.message, 'error'); }
}

// ── Modal Preview Universal ───────────────────────────────────────
function _mostrarPreviewSUNAT(datos, tipo, nombre) {
  _sunat_preview_data   = datos;
  _sunat_preview_tipo   = tipo;
  _sunat_preview_nombre = nombre;

  const validos = datos.filter(d => d._ok).length;
  const errores = datos.length - validos;
  const muestra = datos.slice(0, 8);

  const titulos = {
    compras: '📥 Importar Registro de Compras (SUNAT)',
    ventas:  '📤 Importar Registro de Ventas (SUNAT)',
    rh:      '📋 Importar Registro de RH (SUNAT)',
  };

  let th = '', td = '';
  if (tipo === 'compras') {
    th = '<th>Fecha</th><th>T.</th><th>CDP (Serie-Número)</th><th>RUC Proveedor</th><th>Proveedor</th><th>Base Imp.</th><th>IGV</th><th>Total</th><th>Detrac.</th><th></th>';
    td = muestra.map(r => `
      <tr ${!r._ok ? 'style="background:var(--color-danger-bg,#fff5f5)"':''}>
        <td style="white-space:nowrap">${r.fecha||'—'}</td>
        <td class="text-mono text-sm">${escapar(r.tipo_documento_codigo||'—')}</td>
        <td class="text-mono text-sm" style="white-space:nowrap">${escapar(r.cdp||'—')}</td>
        <td class="text-mono text-sm">${escapar(r.ruc_proveedor||'—')}</td>
        <td class="text-sm">${escapar((r.nombre_proveedor||'').slice(0,28))}</td>
        <td class="text-right">${formatearMoneda(r.base_imponible)}</td>
        <td class="text-right">${formatearMoneda(r.igv)}</td>
        <td class="text-right" style="font-weight:600">${formatearMoneda(r.total)}</td>
        <td class="text-mono text-sm">${escapar(r.codigo_detraccion||'—')}</td>
        <td>${r._ok?'<span class="badge badge-activo" style="font-size:10px">OK</span>':'<span class="badge badge-inactivo" style="font-size:10px">Err</span>'}</td>
      </tr>`).join('');
  } else if (tipo === 'ventas') {
    th = '<th>Fecha</th><th>T.</th><th>CDP (Serie-Número)</th><th>RUC Cliente</th><th>Cliente</th><th>Base Imp.</th><th>IGV</th><th>Total</th><th></th>';
    td = muestra.map(r => `
      <tr ${!r._ok ? 'style="background:var(--color-danger-bg,#fff5f5)"':''}>
        <td style="white-space:nowrap">${r.fecha||'—'}</td>
        <td class="text-mono text-sm">${escapar(r.tipo_documento_codigo||'—')}</td>
        <td class="text-mono text-sm" style="white-space:nowrap">${escapar(r.cdp||'—')}</td>
        <td class="text-mono text-sm">${escapar(r.ruc_cliente||'—')}</td>
        <td class="text-sm">${escapar((r.nombre_cliente||'').slice(0,28))}</td>
        <td class="text-right">${formatearMoneda(r.base_imponible)}</td>
        <td class="text-right">${formatearMoneda(r.igv)}</td>
        <td class="text-right" style="font-weight:600">${formatearMoneda(r.total)}</td>
        <td>${r._ok?'<span class="badge badge-activo" style="font-size:10px">OK</span>':'<span class="badge badge-inactivo" style="font-size:10px">Err</span>'}</td>
      </tr>`).join('');
  } else {
    th = '<th>Fecha</th><th>N° RH</th><th>RUC/DNI</th><th>Prestador</th><th>Bruto</th><th>Retención</th><th>Neto</th><th></th>';
    td = muestra.map(r => `
      <tr ${!r._ok ? 'style="background:var(--color-danger-bg,#fff5f5)"':''}>
        <td>${r.fecha||'—'}</td>
        <td class="text-mono text-sm">${escapar(r.numero_rh||'—')}</td>
        <td class="text-mono text-sm">${escapar(r.ruc_dni_prestador||'—')}</td>
        <td class="text-sm">${escapar((r.nombre_prestador||'').slice(0,30))}</td>
        <td class="text-right">${formatearMoneda(r.monto_bruto)}</td>
        <td class="text-right">${formatearMoneda(r.monto_retencion)}</td>
        <td class="text-right" style="font-weight:600">${formatearMoneda(r.monto_neto)}</td>
        <td>${r._ok?'<span class="badge badge-activo" style="font-size:10px">OK</span>':'<span class="badge badge-inactivo" style="font-size:10px">Err</span>'}</td>
      </tr>`).join('');
  }

  if (datos.length > 8)
    td += `<tr><td colspan="9" class="text-center text-muted text-sm" style="padding:8px">…y ${datos.length-8} filas más (no mostradas)</td></tr>`;

  document.getElementById('modal-sunat-import')?.remove();

  const m = document.createElement('div');
  m.className = 'modal-overlay';
  m.id = 'modal-sunat-import';
  m.style.display = 'flex';
  m.innerHTML = `
    <div class="modal" style="max-width:900px;width:95vw">
      <div class="modal-header">
        <h3>${titulos[tipo]}</h3>
        <button class="modal-cerrar" onclick="document.getElementById('modal-sunat-import').remove()">✕</button>
      </div>
      <div class="modal-body">
        <div style="padding:10px 14px;background:var(--color-fondo-2);border-radius:var(--radio);margin-bottom:14px;font-size:13px">
          📂 <strong>${escapar(nombre)}</strong> —
          ${datos.length} filas leídas &nbsp;·&nbsp;
          <span class="text-verde">✅ ${validos} válidas</span>
          ${errores ? `&nbsp;·&nbsp; <span class="text-rojo">⚠️ ${errores} errores (se omitirán)</span>` : ''}
          ${tipo === 'rh' ? '<br><span class="text-muted" style="font-size:12px">ℹ Los prestadores nuevos se crearán automáticamente en Prestadores de Servicios.</span>' : ''}
        </div>
        <div class="table-wrap" style="max-height:360px;overflow-y:auto">
          <table class="tabla" style="font-size:12px">
            <thead><tr>${th}</tr></thead>
            <tbody>${td}</tbody>
          </table>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secundario" onclick="document.getElementById('modal-sunat-import').remove()">Cancelar</button>
        <button class="btn btn-primario" id="btn-confirmar-sunat"
                onclick="_confirmarImportSUNAT()" ${validos===0?'disabled':''}>
          ✅ Importar ${validos} registros
        </button>
      </div>
    </div>`;
  document.body.appendChild(m);
}

// ── Confirmar importación ─────────────────────────────────────────
async function _confirmarImportSUNAT() {
  const validos = _sunat_preview_data.filter(d => d._ok);
  if (!validos.length) return;

  const btn = document.getElementById('btn-confirmar-sunat');
  if (btn) { btn.disabled = true; btn.textContent = 'Importando…'; }

  let ok = 0, errCount = 0;

  if (_sunat_preview_tipo === 'compras') {
    const rows = validos.map(r => ({
      empresa_operadora_id:  empresa_activa.id,
      periodo:               r.periodo,
      fecha_emision:         r.fecha,
      fecha_vencimiento:     r.fecha_vencimiento,
      tipo_documento_codigo: r.tipo_documento_codigo,
      serie:                 r.serie,
      numero:                r.numero,
      ruc_proveedor:         r.ruc_proveedor,
      nombre_proveedor:      r.nombre_proveedor,
      base_imponible:        r.base_imponible,
      igv:                   r.igv,
      total:                 r.total,
      moneda:                r.moneda || 'PEN',
      tipo_cambio:           r.tipo_cambio || 1,
      codigo_detraccion:     r.codigo_detraccion,
      estado:                'EMITIDO',
      usuario_id:            perfil_usuario?.id || null,
    }));
    for (let i = 0; i < rows.length; i += 50) {
      const { error } = await _supabase.from('registro_compras').insert(rows.slice(i, i + 50));
      if (error) errCount += Math.min(50, rows.length - i);
      else ok += Math.min(50, rows.length - i);
    }

  } else if (_sunat_preview_tipo === 'ventas') {
    const rows = validos.map(r => ({
      empresa_operadora_id:  empresa_activa.id,
      periodo:               r.periodo,
      fecha_emision:         r.fecha,
      fecha_vencimiento:     r.fecha_vencimiento,
      tipo_documento_codigo: r.tipo_documento_codigo,
      serie:                 r.serie,
      numero:                r.numero,
      ruc_cliente:           r.ruc_cliente,
      nombre_cliente:        r.nombre_cliente,
      base_imponible:        r.base_imponible,
      igv:                   r.igv,
      total:                 r.total,
      moneda:                r.moneda || 'PEN',
      tipo_cambio:           r.tipo_cambio || 1,
      estado:                'EMITIDO',
      usuario_id:            perfil_usuario?.id || null,
    }));
    for (let i = 0; i < rows.length; i += 50) {
      const { error } = await _supabase.from('registro_ventas').insert(rows.slice(i, i + 50));
      if (error) errCount += Math.min(50, rows.length - i);
      else ok += Math.min(50, rows.length - i);
    }

  } else if (_sunat_preview_tipo === 'rh') {
    for (const r of validos) {
      if (!r.ruc_dni_prestador) { errCount++; continue; }

      // Buscar o crear prestador
      let { data: ps } = await _supabase
        .from('prestadores_servicios')
        .select('id')
        .eq('dni', r.ruc_dni_prestador)
        .maybeSingle();

      if (!ps) {
        const { data: nuevo, error: errPS } = await _supabase
          .from('prestadores_servicios')
          .insert({
            dni:    r.ruc_dni_prestador,
            nombre: r.nombre_prestador || r.ruc_dni_prestador,
            ruc:    r.ruc_dni_prestador.length === 11 ? r.ruc_dni_prestador : null,
            activo: true,
          })
          .select()
          .single();
        if (errPS) { errCount++; continue; }
        ps = nuevo;
      }

      const { error } = await _supabase.from('rh_registros').insert({
        empresa_operadora_id:  empresa_activa.id,
        prestador_id:          ps.id,
        periodo:               r.periodo,
        fecha_emision:         r.fecha,
        numero_rh:             r.numero_rh,
        concepto:              r.concepto || 'SERVICIO',
        monto_bruto:           r.monto_bruto,
        tiene_retencion:       r.tiene_retencion,
        porcentaje_retencion:  r.porcentaje_retencion,
        monto_retencion:       r.monto_retencion,
        monto_neto:            r.monto_neto,
        estado:                r.estado,
        observaciones:         r.observaciones,
        usuario_id:            perfil_usuario?.id || null,
      });

      if (error) errCount++; else ok++;
    }
  }

  document.getElementById('modal-sunat-import')?.remove();
  mostrarToast(
    `✓ ${ok} registros importados${errCount ? `, ${errCount} errores` : ''}`,
    errCount > 0 ? 'atencion' : 'exito'
  );

  if (_sunat_preview_tipo === 'compras' && typeof cargarCompras === 'function') await cargarCompras();
  if (_sunat_preview_tipo === 'ventas'  && typeof cargarVentas  === 'function') await cargarVentas();
  if (_sunat_preview_tipo === 'rh'      && typeof cargarRH      === 'function') await cargarRH();
}
