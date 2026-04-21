// ═══════════════════════════════════════════════════════════════
// Tributaria — Resumen IGV mensual
// ═══════════════════════════════════════════════════════════════

async function renderTabResumen(area) {
  const hoy = new Date();
  const periodoActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;

  area.innerHTML = `
    <div class="fadeIn">
      <div class="card" style="padding:16px;margin-bottom:20px;display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap">
        <div class="campo" style="margin:0">
          <label class="label-filtro">Periodo</label>
          <input type="month" id="res-periodo" value="${periodoActual}" class="input-buscar" style="width:160px">
        </div>
        <button class="btn btn-primario" onclick="calcularResumenIGV()">📊 Calcular resumen</button>
        <button class="btn btn-secundario" onclick="exportarResumenExcel()" id="btn-exp-res" style="display:none">⬇ Excel</button>
      </div>

      <div id="res-contenido">
        <div class="text-center text-muted" style="padding:40px">
          <div style="font-size:48px;margin-bottom:12px">📊</div>
          <p>Selecciona un periodo y haz clic en <strong>Calcular resumen</strong></p>
        </div>
      </div>
    </div>`;
}

let resumen_datos = null;

async function calcularResumenIGV() {
  const periodo = document.getElementById('res-periodo')?.value;
  if (!periodo) { mostrarToast('Selecciona un periodo', 'atencion'); return; }

  const cont = document.getElementById('res-contenido');
  cont.innerHTML = '<div class="cargando"><div class="spinner"></div><span>Calculando…</span></div>';

  const [resVentas, resCompras] = await Promise.all([
    _supabase.from('registro_ventas')
      .select('base_imponible,igv,total,estado')
      .eq('empresa_operadora_id', empresa_activa.id)
      .eq('periodo', periodo),
    _supabase.from('registro_compras')
      .select('base_imponible,igv,total,estado,tiene_detraccion,monto_detraccion,deducible_renta')
      .eq('empresa_operadora_id', empresa_activa.id)
      .eq('periodo', periodo),
  ]);

  const ventas  = (resVentas.data  || []).filter(v => v.estado !== 'ANULADO');
  const compras = (resCompras.data || []).filter(c => c.estado !== 'ANULADO');

  const v_base  = ventas.reduce((s, v) => s + parseFloat(v.base_imponible || 0), 0);
  const v_igv   = ventas.reduce((s, v) => s + parseFloat(v.igv || 0), 0);
  const v_total = ventas.reduce((s, v) => s + parseFloat(v.total || 0), 0);

  const c_base  = compras.reduce((s, c) => s + parseFloat(c.base_imponible || 0), 0);
  const c_igv   = compras.reduce((s, c) => s + parseFloat(c.igv || 0), 0);
  const c_total = compras.reduce((s, c) => s + parseFloat(c.total || 0), 0);
  const c_detrac = compras.filter(c => c.tiene_detraccion)
    .reduce((s, c) => s + parseFloat(c.monto_detraccion || 0), 0);

  const igv_debito   = v_igv;
  const igv_credito  = c_igv;
  const igv_neto     = igv_debito - igv_credito;
  const saldo        = igv_neto < 0 ? 'Saldo a favor' : 'IGV a pagar';

  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const [anio, mes] = periodo.split('-');
  const nombreMes = meses[parseInt(mes) - 1];

  resumen_datos = { periodo, v_base, v_igv, v_total, c_base, c_igv, c_total,
    igv_neto, c_detrac, compras: compras.length, ventas: ventas.length };

  const signo = igv_neto >= 0 ? '+' : '';
  const color  = igv_neto >= 0 ? 'var(--color-critico)' : 'var(--color-exito)';

  cont.innerHTML = `
    <h2 style="margin-bottom:20px">Resumen IGV — ${nombreMes} ${anio}</h2>

    <div class="grid-2" style="gap:16px;margin-bottom:20px">
      <!-- Ventas -->
      <div class="card" style="border-left:4px solid var(--color-exito)">
        <h3 style="margin-bottom:16px;color:var(--color-exito)">📤 Registro de ventas</h3>
        <table style="width:100%;font-size:14px;border-collapse:collapse">
          <tr style="border-bottom:1px solid var(--color-borde)">
            <td class="text-muted" style="padding:6px 0">Comprobantes activos</td>
            <td class="text-right font-medium">${ventas.length}</td>
          </tr>
          <tr style="border-bottom:1px solid var(--color-borde)">
            <td class="text-muted" style="padding:6px 0">Base imponible</td>
            <td class="text-right font-medium">${formatearMoneda(v_base)}</td>
          </tr>
          <tr style="border-bottom:2px solid var(--color-borde)">
            <td class="text-muted" style="padding:6px 0">IGV débito fiscal</td>
            <td class="text-right font-medium text-verde">${formatearMoneda(v_igv)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-weight:600">Total ventas</td>
            <td class="text-right" style="font-weight:700;font-size:16px">${formatearMoneda(v_total)}</td>
          </tr>
        </table>
      </div>

      <!-- Compras -->
      <div class="card" style="border-left:4px solid var(--color-critico)">
        <h3 style="margin-bottom:16px;color:var(--color-critico)">📥 Registro de compras</h3>
        <table style="width:100%;font-size:14px;border-collapse:collapse">
          <tr style="border-bottom:1px solid var(--color-borde)">
            <td class="text-muted" style="padding:6px 0">Comprobantes activos</td>
            <td class="text-right font-medium">${compras.length}</td>
          </tr>
          <tr style="border-bottom:1px solid var(--color-borde)">
            <td class="text-muted" style="padding:6px 0">Base imponible</td>
            <td class="text-right font-medium">${formatearMoneda(c_base)}</td>
          </tr>
          <tr style="border-bottom:1px solid var(--color-borde)">
            <td class="text-muted" style="padding:6px 0">IGV crédito fiscal</td>
            <td class="text-right font-medium text-rojo">${formatearMoneda(c_igv)}</td>
          </tr>
          <tr style="border-bottom:2px solid var(--color-borde)">
            <td class="text-muted" style="padding:6px 0">Total detracciones</td>
            <td class="text-right">${formatearMoneda(c_detrac)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-weight:600">Total compras</td>
            <td class="text-right" style="font-weight:700;font-size:16px">${formatearMoneda(c_total)}</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- Determinación IGV -->
    <div class="card" style="border-left:4px solid ${color}">
      <h3 style="margin-bottom:16px">⚖️ Determinación del IGV</h3>
      <table style="width:100%;font-size:14px;border-collapse:collapse">
        <tr style="border-bottom:1px solid var(--color-borde)">
          <td class="text-muted" style="padding:8px 0">IGV débito fiscal (ventas)</td>
          <td class="text-right font-medium">${formatearMoneda(igv_debito)}</td>
        </tr>
        <tr style="border-bottom:2px solid var(--color-borde)">
          <td class="text-muted" style="padding:8px 0">IGV crédito fiscal (compras)</td>
          <td class="text-right font-medium">(${formatearMoneda(igv_credito)})</td>
        </tr>
        <tr>
          <td style="padding:12px 0;font-weight:700;font-size:16px">${saldo}</td>
          <td class="text-right" style="font-weight:700;font-size:20px;color:${color}">${signo}${formatearMoneda(Math.abs(igv_neto))}</td>
        </tr>
      </table>
      ${igv_neto > 0 ? `
        <div style="margin-top:16px;padding:12px;background:#FFF5F5;border-radius:var(--radio);border:1px solid #FED7D7">
          <p class="text-sm">📅 <strong>Recordatorio:</strong> El IGV a pagar debe declararse antes del vencimiento según el cronograma SUNAT (último dígito RUC).</p>
        </div>` : `
        <div style="margin-top:16px;padding:12px;background:#F0FFF4;border-radius:var(--radio);border:1px solid #C6F6D5">
          <p class="text-sm">✅ <strong>Saldo a favor:</strong> El crédito fiscal excede el débito. Se arrastra al siguiente periodo.</p>
        </div>`}
    </div>

    <div style="display:flex;justify-content:flex-end;margin-top:16px">
      <button class="btn btn-secundario" onclick="exportarResumenExcel()">⬇ Exportar resumen Excel</button>
    </div>`;

  const btnExp = document.getElementById('btn-exp-res');
  if (btnExp) btnExp.style.display = 'inline-flex';
}

function exportarResumenExcel() {
  if (!resumen_datos) { mostrarToast('Primero calcula el resumen', 'atencion'); return; }
  const d = resumen_datos;
  const rows = [
    { Concepto: 'PERIODO',                    Valor: d.periodo },
    { Concepto: '',                            Valor: '' },
    { Concepto: '--- VENTAS ---',              Valor: '' },
    { Concepto: 'Comprobantes activos',        Valor: d.ventas },
    { Concepto: 'Base imponible ventas',       Valor: d.v_base },
    { Concepto: 'IGV débito fiscal',           Valor: d.v_igv },
    { Concepto: 'Total ventas',                Valor: d.v_total },
    { Concepto: '',                            Valor: '' },
    { Concepto: '--- COMPRAS ---',             Valor: '' },
    { Concepto: 'Comprobantes activos',        Valor: d.compras },
    { Concepto: 'Base imponible compras',      Valor: d.c_base },
    { Concepto: 'IGV crédito fiscal',          Valor: d.c_igv },
    { Concepto: 'Total compras',               Valor: d.c_total },
    { Concepto: 'Total detracciones',          Valor: d.c_detrac },
    { Concepto: '',                            Valor: '' },
    { Concepto: '--- DETERMINACIÓN IGV ---',   Valor: '' },
    { Concepto: 'IGV débito - IGV crédito',    Valor: d.igv_neto },
    { Concepto: d.igv_neto >= 0 ? 'IGV A PAGAR' : 'SALDO A FAVOR', Valor: Math.abs(d.igv_neto) },
  ];
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'ResumenIGV');
  XLSX.writeFile(wb, `resumen_igv_${empresa_activa.nombre}_${d.periodo}.xlsx`);
}
