// ═══════════════════════════════════════════════════════════════
// Contabilidad — Libro Mayor
// ═══════════════════════════════════════════════════════════════

let mayor_cuentas = [];

async function renderTabMayor(area) {
  const hoy   = new Date();
  const mesActual = hoy.toISOString().slice(0, 7);

  area.innerHTML = `
    <div class="fadeIn">
      <div class="card" style="padding:16px;margin-bottom:20px">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;align-items:end">
          <div>
            <label class="label-filtro">Cuenta (código)</label>
            <input type="text" id="may-cuenta" list="dl-may-cuentas" class="input-buscar w-full" placeholder="Ej: 10">
            <datalist id="dl-may-cuentas"></datalist>
          </div>
          <div>
            <label class="label-filtro">Periodo desde</label>
            <input type="month" id="may-desde" value="${mesActual}" class="input-buscar w-full">
          </div>
          <div>
            <label class="label-filtro">Periodo hasta</label>
            <input type="month" id="may-hasta" value="${mesActual}" class="input-buscar w-full">
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-primario btn-sm w-full" onclick="consultarMayor()">🔍 Consultar</button>
          </div>
        </div>
      </div>

      <div id="mayor-resultado"></div>
    </div>`;

  await _cargarCuentasParaMayor();
}

async function _cargarCuentasParaMayor() {
  const { data } = await _supabase
    .from('plan_cuentas')
    .select('codigo, nombre, naturaleza')
    .eq('empresa_operadora_id', empresa_activa.id)
    .eq('acepta_movimientos', true)
    .eq('activo', true)
    .order('codigo');
  mayor_cuentas = data || [];
  const dl = document.getElementById('dl-may-cuentas');
  if (dl) dl.innerHTML = mayor_cuentas.map(c => `<option value="${escapar(c.codigo)}">${escapar(c.codigo)} — ${escapar(c.nombre)}</option>`).join('');
}

async function consultarMayor() {
  const codigo = (document.getElementById('may-cuenta')?.value || '').trim();
  const desde  = document.getElementById('may-desde')?.value || '';
  const hasta  = document.getElementById('may-hasta')?.value || '';
  const area   = document.getElementById('mayor-resultado');
  if (!codigo) { mostrarToast('Ingresa el código de cuenta', 'atencion'); return; }
  if (!desde || !hasta) { mostrarToast('Selecciona el rango de periodo', 'atencion'); return; }
  area.innerHTML = '<div class="cargando"><div class="spinner"></div><span>Consultando…</span></div>';
  const cuenta = mayor_cuentas.find(c => c.codigo === codigo);
  const { data, error } = await _supabase
    .from('asiento_detalle')
    .select('*, asientos!inner(id, fecha, numero_asiento, glosa, periodo, estado, empresa_operadora_id)')
    .eq('cuenta_codigo', codigo)
    .eq('asientos.empresa_operadora_id', empresa_activa.id)
    .gte('asientos.periodo', desde)
    .lte('asientos.periodo', hasta)
    .neq('asientos.estado', 'ANULADO')
    .order('asientos(fecha)', { ascending: true })
    .order('asientos(numero_asiento)', { ascending: true });
  if (error) { mostrarToast('Error: ' + error.message, 'error'); area.innerHTML = ''; return; }
  const lineas = data || [];
  if (!lineas.length) {
    area.innerHTML = `<div class="card" style="padding:24px;text-align:center;color:var(--color-texto-suave)">Sin movimientos para la cuenta ${escapar(codigo)} en el periodo seleccionado.</div>`;
    return;
  }
  const esAcreedora = cuenta?.naturaleza === 'ACREEDORA';
  let saldo = 0;
  let totalDebe = 0, totalHaber = 0;
  const filas = lineas.map(l => {
    const debe  = parseFloat(l.debe  || 0);
    const haber = parseFloat(l.haber || 0);
    totalDebe  += debe;
    totalHaber += haber;
    saldo += esAcreedora ? (haber - debe) : (debe - haber);
    const saldoClass = saldo >= 0 ? 'text-verde' : 'text-rojo';
    return `<tr>
      <td>${formatearFecha(l.asientos.fecha)}</td>
      <td class="text-mono text-sm">${escapar(l.asientos.numero_asiento || '—')}</td>
      <td class="text-sm">${escapar((l.asientos.glosa||'').slice(0,50))}${(l.asientos.glosa||'').length>50?'…':''}</td>
      <td>${escapar(l.descripcion||'—')}</td>
      <td class="text-right text-mono">${debe > 0 ? formatearMoneda(debe) : '—'}</td>
      <td class="text-right text-mono">${haber > 0 ? formatearMoneda(haber) : '—'}</td>
      <td class="text-right text-mono ${saldoClass}">${formatearMoneda(Math.abs(saldo))} ${saldo < 0 ? '(Acr.)' : ''}</td>
    </tr>`;
  }).join('');
  const saldoFinalClass = saldo >= 0 ? 'text-verde' : 'text-rojo';
  area.innerHTML = `
    <div class="fadeIn">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:12px">
        <div>
          <h3 style="margin:0;font-size:15px">
            Cuenta: <span class="text-mono">${escapar(codigo)}</span>
            — ${escapar(cuenta?.nombre || codigo)}
            <span class="badge badge-info" style="margin-left:8px;font-size:11px">${cuenta?.naturaleza || ''}</span>
          </h3>
          <p class="text-muted text-sm" style="margin:4px 0 0">
            Periodo: ${desde} al ${hasta} · ${lineas.length} movimiento(s)
          </p>
        </div>
        <button class="btn btn-secundario btn-sm" onclick="exportarMayorExcel('${escapar(codigo)}','${escapar(cuenta?.nombre||codigo)}')">⬇ Excel</button>
      </div>
      <div class="table-wrap">
        <table class="tabla">
          <thead><tr>
            <th>Fecha</th><th>Nro Asiento</th><th>Glosa</th><th>Descripción</th>
            <th class="text-right">Debe</th><th class="text-right">Haber</th><th class="text-right">Saldo acum.</th>
          </tr></thead>
          <tbody>
            ${filas}
            <tr style="border-top:2px solid var(--color-borde);font-weight:600;background:var(--color-bg-card)">
              <td colspan="4" class="text-right" style="font-size:13px">TOTALES</td>
              <td class="text-right text-mono">${formatearMoneda(totalDebe)}</td>
              <td class="text-right text-mono">${formatearMoneda(totalHaber)}</td>
              <td class="text-right text-mono ${saldoFinalClass}">${formatearMoneda(Math.abs(saldo))} ${saldo < 0 ? '(Acr.)' : ''}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>`;
  window._mayor_data_cache = { codigo, nombre: cuenta?.nombre || codigo, desde, hasta, lineas, totalDebe, totalHaber, saldo, esAcreedora };
}

function exportarMayorExcel(codigo, nombre) {
  const cache = window._mayor_data_cache;
  if (!cache || !cache.lineas.length) { mostrarToast('Primero consulta el mayor', 'atencion'); return; }
  let saldoAcum = 0;
  const rows = cache.lineas.map(l => {
    const debe  = parseFloat(l.debe  || 0);
    const haber = parseFloat(l.haber || 0);
    saldoAcum += cache.esAcreedora ? (haber - debe) : (debe - haber);
    return {
      Fecha:          l.asientos.fecha,
      'Nro Asiento':  l.asientos.numero_asiento || '',
      Glosa:          l.asientos.glosa || '',
      Descripción:    l.descripcion || '',
      Debe:           debe || '',
      Haber:          haber || '',
      'Saldo Acum.':  saldoAcum,
    };
  });
  rows.push({ Fecha: '', 'Nro Asiento': '', Glosa: 'TOTALES', Descripción: '', Debe: cache.totalDebe, Haber: cache.totalHaber, 'Saldo Acum.': cache.saldo });
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.sheet_add_aoa(ws, [[`Libro Mayor — ${cache.codigo} ${cache.nombre}`]], { origin: 'A1' });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Libro Mayor');
  XLSX.writeFile(wb, `mayor_${cache.codigo}_${empresa_activa.nombre}_${new Date().toISOString().slice(0,10)}.xlsx`);
}
