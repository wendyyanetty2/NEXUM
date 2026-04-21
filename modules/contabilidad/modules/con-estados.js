// ═══════════════════════════════════════════════════════════════
// Contabilidad — Estados Financieros
// ═══════════════════════════════════════════════════════════════

let ef_tab_activo = 'balance';

async function renderTabEstados(area) {
  const hoy = new Date();
  const mesActual = hoy.toISOString().slice(0, 7);
  const anioActual = hoy.getFullYear().toString();
  const mesInicioAnio = `${anioActual}-01`;

  area.innerHTML = `
    <div class="fadeIn">
      <div class="card" style="padding:16px;margin-bottom:20px">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;align-items:end">
          <div>
            <label class="label-filtro">Periodo desde</label>
            <input type="month" id="ef-desde" value="${mesInicioAnio}" class="input-buscar w-full">
          </div>
          <div>
            <label class="label-filtro">Periodo hasta</label>
            <input type="month" id="ef-hasta" value="${mesActual}" class="input-buscar w-full">
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-primario btn-sm w-full" onclick="generarEstados()">📊 Generar</button>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-secundario btn-sm w-full" onclick="exportarEstadosExcel()">⬇ Excel</button>
          </div>
        </div>
      </div>

      <div style="display:flex;gap:4px;margin-bottom:20px;border-bottom:2px solid var(--color-borde)">
        <button class="tab-btn activo" id="ef-tab-balance"    onclick="activarTabEF('balance')">⚖️ Balance General</button>
        <button class="tab-btn"        id="ef-tab-resultados" onclick="activarTabEF('resultados')">📈 Estado de Resultados</button>
      </div>

      <div id="ef-contenido">
        <div style="text-align:center;padding:40px;color:var(--color-texto-suave)">
          Selecciona el rango de periodo y presiona Generar.
        </div>
      </div>
    </div>`;
}

function activarTabEF(tab) {
  ef_tab_activo = tab;
  document.querySelectorAll('#ef-tab-balance, #ef-tab-resultados').forEach(b => b.classList.remove('activo'));
  document.getElementById('ef-tab-' + tab).classList.add('activo');
  const cache = window._ef_cache;
  if (cache) {
    tab === 'balance' ? renderBalance(cache) : renderResultados(cache);
  }
}

async function generarEstados() {
  const desde = document.getElementById('ef-desde')?.value || '';
  const hasta  = document.getElementById('ef-hasta')?.value  || '';
  if (!desde || !hasta) { mostrarToast('Selecciona el rango de periodo', 'atencion'); return; }
  const area = document.getElementById('ef-contenido');
  area.innerHTML = '<div class="cargando"><div class="spinner"></div><span>Calculando…</span></div>';

  const { data: cuentas } = await _supabase
    .from('plan_cuentas')
    .select('codigo, nombre, tipo, naturaleza, nivel, cuenta_padre_codigo')
    .eq('empresa_operadora_id', empresa_activa.id)
    .eq('activo', true)
    .order('codigo');

  const { data: lineas, error } = await _supabase
    .from('asiento_detalle')
    .select('cuenta_codigo, debe, haber, asientos!inner(periodo, estado, empresa_operadora_id)')
    .eq('asientos.empresa_operadora_id', empresa_activa.id)
    .gte('asientos.periodo', desde)
    .lte('asientos.periodo', hasta)
    .neq('asientos.estado', 'ANULADO');

  if (error) { mostrarToast('Error: ' + error.message, 'error'); area.innerHTML = ''; return; }

  const cuentasMap = {};
  (cuentas || []).forEach(c => { cuentasMap[c.codigo] = c; });

  const saldos = {};
  (lineas || []).forEach(l => {
    const cuenta = cuentasMap[l.cuenta_codigo];
    const debe   = parseFloat(l.debe  || 0);
    const haber  = parseFloat(l.haber || 0);
    if (!saldos[l.cuenta_codigo]) saldos[l.cuenta_codigo] = 0;
    if (cuenta) {
      saldos[l.cuenta_codigo] += cuenta.naturaleza === 'ACREEDORA' ? (haber - debe) : (debe - haber);
    } else {
      saldos[l.cuenta_codigo] += (debe - haber);
    }
  });

  window._ef_cache = { cuentas: cuentas || [], saldos, desde, hasta };
  ef_tab_activo === 'balance' ? renderBalance(window._ef_cache) : renderResultados(window._ef_cache);
}

function _agruparPorTipo(cuentas, saldos, tipo) {
  const grupos = {};
  cuentas.filter(c => c.tipo === tipo && c.nivel <= 2).forEach(c => {
    const padre = c.cuenta_padre_codigo || c.codigo;
    if (!grupos[padre]) grupos[padre] = { codigo: padre, nombre: cuentas.find(x => x.codigo === padre)?.nombre || padre, cuentas: [] };
    if (c.nivel === 2) {
      const saldo = saldos[c.codigo] || 0;
      grupos[padre].cuentas.push({ ...c, saldo });
    }
  });
  return Object.values(grupos);
}

function _totalGrupos(grupos) {
  return grupos.reduce((s, g) => s + g.cuentas.reduce((ss, c) => ss + c.saldo, 0), 0);
}

function renderBalance(cache) {
  const { cuentas, saldos } = cache;
  const area = document.getElementById('ef-contenido');

  const grActivo   = _agruparPorTipo(cuentas, saldos, 'ACTIVO');
  const grPasivo   = _agruparPorTipo(cuentas, saldos, 'PASIVO');
  const grPatrim   = _agruparPorTipo(cuentas, saldos, 'PATRIMONIO');
  const totActivo  = _totalGrupos(grActivo);
  const totPasivo  = _totalGrupos(grPasivo);
  const totPatrim  = _totalGrupos(grPatrim);
  const totPasPatr = totPasivo + totPatrim;
  const cuadra     = Math.abs(totActivo - totPasPatr) < 0.02;

  const renderGrupos = (grupos, colorClass) => grupos.map(g => {
    const totalGrupo = g.cuentas.reduce((s, c) => s + c.saldo, 0);
    if (!totalGrupo && !g.cuentas.some(c => c.saldo !== 0)) return '';
    return `
      <tr style="background:var(--color-hover,#f0f4ff)">
        <td colspan="2" style="font-weight:600;font-size:12px;padding:6px 12px;color:var(--color-texto-suave)">${escapar(g.nombre)}</td>
      </tr>
      ${g.cuentas.filter(c => c.saldo !== 0).map(c => `
        <tr>
          <td style="padding-left:24px"><span class="text-mono text-sm">${escapar(c.codigo)}</span> ${escapar(c.nombre)}</td>
          <td class="text-right text-mono ${c.saldo < 0 ? 'text-rojo' : ''}">${formatearMoneda(Math.abs(c.saldo))}</td>
        </tr>`).join('')}
      <tr style="border-top:1px solid var(--color-borde)">
        <td style="padding-left:16px;font-size:12px;color:var(--color-texto-suave)">Subtotal</td>
        <td class="text-right text-mono ${colorClass}" style="font-weight:600">${formatearMoneda(totalGrupo)}</td>
      </tr>`;
  }).join('');

  area.innerHTML = `
    <div class="fadeIn">
      <div class="grid-2" style="gap:24px;align-items:start">
        <div>
          <h4 style="margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid var(--color-primario);color:var(--color-primario)">ACTIVO</h4>
          <div class="table-wrap">
            <table class="tabla">
              <tbody>
                ${renderGrupos(grActivo, 'text-verde')}
                <tr style="background:var(--color-primario);color:#fff">
                  <td style="font-weight:700;padding:10px 12px">TOTAL ACTIVO</td>
                  <td class="text-right text-mono" style="font-weight:700;padding:10px 12px">${formatearMoneda(totActivo)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h4 style="margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid var(--color-secundario);color:var(--color-secundario)">PASIVO Y PATRIMONIO</h4>
          <div class="table-wrap">
            <table class="tabla">
              <tbody>
                <tr style="background:var(--color-bg-card)"><td colspan="2" style="font-weight:700;font-size:13px;padding:8px 12px">PASIVO</td></tr>
                ${renderGrupos(grPasivo, 'text-rojo')}
                <tr style="border-top:1px solid var(--color-borde);font-weight:600">
                  <td style="padding:8px 12px;font-size:13px">Total Pasivo</td>
                  <td class="text-right text-mono" style="font-weight:700;color:var(--color-rojo,#e53e3e)">${formatearMoneda(totPasivo)}</td>
                </tr>
                <tr style="background:var(--color-bg-card)"><td colspan="2" style="font-weight:700;font-size:13px;padding:8px 12px;margin-top:8px">PATRIMONIO</td></tr>
                ${renderGrupos(grPatrim, '')}
                <tr style="border-top:1px solid var(--color-borde);font-weight:600">
                  <td style="padding:8px 12px;font-size:13px">Total Patrimonio</td>
                  <td class="text-right text-mono" style="font-weight:700">${formatearMoneda(totPatrim)}</td>
                </tr>
                <tr style="background:var(--color-secundario,#5a67d8);color:#fff">
                  <td style="font-weight:700;padding:10px 12px">TOTAL PASIVO + PATRIMONIO</td>
                  <td class="text-right text-mono" style="font-weight:700;padding:10px 12px">${formatearMoneda(totPasPatr)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div style="margin-top:16px;padding:12px 16px;border-radius:var(--radio);text-align:center;font-size:13px;background:${cuadra ? 'var(--color-verde-suave,#f0fff4)' : 'var(--color-rojo-suave,#fff5f5)'};color:${cuadra ? 'var(--color-verde,#276749)' : 'var(--color-rojo,#e53e3e)'}">
        ${cuadra ? '✅ Balance cuadra: Activo = Pasivo + Patrimonio' : `⚠ Diferencia: ${formatearMoneda(Math.abs(totActivo - totPasPatr))}`}
      </div>
    </div>`;
}

function renderResultados(cache) {
  const { cuentas, saldos } = cache;
  const area = document.getElementById('ef-contenido');

  const sumarTipo = (tipo) => cuentas
    .filter(c => c.tipo === tipo && c.nivel === 2)
    .reduce((s, c) => s + (saldos[c.codigo] || 0), 0);

  const sumarCodigo = (codigo) => saldos[codigo] || 0;

  const totalIngresos = sumarTipo('INGRESO');
  const totalGastos   = sumarTipo('GASTO');
  const ventas        = sumarCodigo('70');
  const costoVentas   = sumarCodigo('69');
  const utilBruta     = ventas - costoVentas;

  const gastosOperativos = cuentas
    .filter(c => c.tipo === 'GASTO' && c.nivel === 2 && !['69','67'].includes(c.codigo))
    .reduce((s, c) => s + (saldos[c.codigo] || 0), 0);
  const utilOperativa = utilBruta - gastosOperativos;

  const ingFinancieros  = sumarCodigo('77');
  const gastFinancieros = sumarCodigo('67');
  const utilNeta        = utilOperativa + ingFinancieros - gastFinancieros;

  const otrosIngresos = cuentas
    .filter(c => c.tipo === 'INGRESO' && c.nivel === 2)
    .map(c => ({ ...c, saldo: saldos[c.codigo] || 0 }));

  const gastosLineas = cuentas
    .filter(c => c.tipo === 'GASTO' && c.nivel === 2)
    .map(c => ({ ...c, saldo: saldos[c.codigo] || 0 }));

  const filaResult = (label, monto, indent, negrita, separador) => {
    const colorClass = monto < 0 ? 'text-rojo' : monto > 0 ? 'text-verde' : '';
    return `<tr ${separador ? 'style="border-top:2px solid var(--color-borde)"' : ''}>
      <td style="padding-left:${indent}px;${negrita ? 'font-weight:700' : ''};font-size:13px">${label}</td>
      <td class="text-right text-mono ${colorClass}" style="${negrita ? 'font-weight:700' : ''}">${formatearMoneda(monto)}</td>
    </tr>`;
  };

  area.innerHTML = `
    <div class="fadeIn" style="max-width:680px;margin:0 auto">
      <div class="table-wrap">
        <table class="tabla">
          <thead><tr>
            <th>Concepto</th>
            <th class="text-right">Importe (S/.)</th>
          </tr></thead>
          <tbody>
            <tr style="background:var(--color-bg-card)"><td colspan="2" style="font-weight:700;padding:10px 12px;font-size:13px">INGRESOS</td></tr>
            ${otrosIngresos.filter(c => c.saldo !== 0).map(c => filaResult(`${c.codigo} — ${c.nombre}`, c.saldo, 16, false, false)).join('')}
            ${filaResult('Total Ingresos', totalIngresos, 0, true, true)}
            <tr style="background:var(--color-bg-card)"><td colspan="2" style="font-weight:700;padding:10px 12px;font-size:13px">COSTO DE VENTAS</td></tr>
            ${filaResult('69 — Costo de ventas', costoVentas, 16, false, false)}
            ${filaResult('UTILIDAD BRUTA', utilBruta, 0, true, true)}
            <tr style="background:var(--color-bg-card)"><td colspan="2" style="font-weight:700;padding:10px 12px;font-size:13px">GASTOS OPERATIVOS</td></tr>
            ${gastosLineas.filter(c => c.codigo !== '69' && c.codigo !== '67' && c.saldo !== 0).map(c => filaResult(`${c.codigo} — ${c.nombre}`, -c.saldo, 16, false, false)).join('')}
            ${filaResult('Total Gastos Operativos', -gastosOperativos, 0, true, true)}
            ${filaResult('UTILIDAD OPERATIVA', utilOperativa, 0, true, true)}
            <tr style="background:var(--color-bg-card)"><td colspan="2" style="font-weight:700;padding:10px 12px;font-size:13px">RESULTADO FINANCIERO</td></tr>
            ${filaResult('77 — Ingresos financieros', ingFinancieros, 16, false, false)}
            ${filaResult('67 — Gastos financieros', -gastFinancieros, 16, false, false)}
            <tr style="background:${utilNeta >= 0 ? 'var(--color-verde-suave,#f0fff4)' : 'var(--color-rojo-suave,#fff5f5)'};border-top:2px solid var(--color-borde)">
              <td style="font-weight:700;font-size:14px;padding:12px">UTILIDAD NETA DEL PERIODO</td>
              <td class="text-right text-mono ${utilNeta >= 0 ? 'text-verde' : 'text-rojo'}" style="font-weight:700;font-size:14px;padding:12px">${formatearMoneda(utilNeta)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>`;

  window._ef_cache._resultados = { totalIngresos, totalGastos, ventas, costoVentas, utilBruta, gastosOperativos, utilOperativa, ingFinancieros, gastFinancieros, utilNeta, otrosIngresos, gastosLineas };
}

function exportarEstadosExcel() {
  const cache = window._ef_cache;
  if (!cache) { mostrarToast('Primero genera los estados financieros', 'atencion'); return; }
  const { cuentas, saldos, desde, hasta } = cache;

  // Hoja Balance General
  const grActivo = _agruparPorTipo(cuentas, saldos, 'ACTIVO');
  const grPasivo = _agruparPorTipo(cuentas, saldos, 'PASIVO');
  const grPatrim = _agruparPorTipo(cuentas, saldos, 'PATRIMONIO');
  const rowsBG = [['BALANCE GENERAL', empresa_activa.nombre, `Periodo: ${desde} — ${hasta}`]];
  rowsBG.push([]);
  rowsBG.push(['ACTIVO', '', '']);
  grActivo.forEach(g => {
    rowsBG.push([g.nombre, '', '']);
    g.cuentas.filter(c => c.saldo !== 0).forEach(c => rowsBG.push([`  ${c.codigo} ${c.nombre}`, c.saldo, '']));
  });
  rowsBG.push(['TOTAL ACTIVO', _totalGrupos(grActivo), '']);
  rowsBG.push([]);
  rowsBG.push(['PASIVO', '', '']);
  grPasivo.forEach(g => {
    rowsBG.push([g.nombre, '', '']);
    g.cuentas.filter(c => c.saldo !== 0).forEach(c => rowsBG.push([`  ${c.codigo} ${c.nombre}`, c.saldo, '']));
  });
  rowsBG.push(['Total Pasivo', _totalGrupos(grPasivo), '']);
  rowsBG.push([]);
  rowsBG.push(['PATRIMONIO', '', '']);
  grPatrim.forEach(g => {
    rowsBG.push([g.nombre, '', '']);
    g.cuentas.filter(c => c.saldo !== 0).forEach(c => rowsBG.push([`  ${c.codigo} ${c.nombre}`, c.saldo, '']));
  });
  rowsBG.push(['Total Patrimonio', _totalGrupos(grPatrim), '']);
  rowsBG.push(['TOTAL PASIVO + PATRIMONIO', _totalGrupos(grPasivo) + _totalGrupos(grPatrim), '']);

  // Hoja Estado de Resultados
  const r = cache._resultados;
  const rowsER = [['ESTADO DE RESULTADOS', empresa_activa.nombre, `Periodo: ${desde} — ${hasta}`]];
  rowsER.push([]);
  rowsER.push(['INGRESOS', '', '']);
  if (r) {
    r.otrosIngresos.filter(c => c.saldo !== 0).forEach(c => rowsER.push([`  ${c.codigo} — ${c.nombre}`, c.saldo]));
    rowsER.push(['Total Ingresos', r.totalIngresos]);
    rowsER.push([]);
    rowsER.push(['COSTO DE VENTAS', '']);
    rowsER.push(['  69 — Costo de ventas', r.costoVentas]);
    rowsER.push(['UTILIDAD BRUTA', r.utilBruta]);
    rowsER.push([]);
    rowsER.push(['GASTOS OPERATIVOS', '']);
    r.gastosLineas.filter(c => c.codigo !== '69' && c.codigo !== '67' && c.saldo !== 0).forEach(c => rowsER.push([`  ${c.codigo} — ${c.nombre}`, -c.saldo]));
    rowsER.push(['Total Gastos Operativos', -r.gastosOperativos]);
    rowsER.push(['UTILIDAD OPERATIVA', r.utilOperativa]);
    rowsER.push([]);
    rowsER.push(['RESULTADO FINANCIERO', '']);
    rowsER.push(['  77 — Ingresos financieros', r.ingFinancieros]);
    rowsER.push(['  67 — Gastos financieros', -r.gastFinancieros]);
    rowsER.push([]);
    rowsER.push(['UTILIDAD NETA DEL PERIODO', r.utilNeta]);
  }

  const wb = XLSX.utils.book_new();
  const wsBG = XLSX.utils.aoa_to_sheet(rowsBG);
  const wsER = XLSX.utils.aoa_to_sheet(rowsER);
  XLSX.utils.book_append_sheet(wb, wsBG, 'Balance General');
  XLSX.utils.book_append_sheet(wb, wsER, 'Estado de Resultados');
  XLSX.writeFile(wb, `estados_financieros_${empresa_activa.nombre}_${desde}_${hasta}.xlsx`);
}
