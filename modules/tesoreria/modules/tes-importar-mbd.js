/* ============================================================
   NEXUM — Tesorería: Módulo MBD (Fiel a Plantilla "Movimientos")
   ============================================================ */

function renderTabImportarMBD(area) {
  const hoy = new Date();
  const mesActual = String(hoy.getMonth() + 1).padStart(2, '0');
  const anioActual = hoy.getFullYear();

  area.innerHTML = `
    <div class="fadeIn">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          <select id="mbd-filtro-mes" style="${estiloSelect()}">
            ${Array.from({length:12},(_,i)=>{
              const m = String(i+1).padStart(2,'0');
              const nom = new Date(2000,i,1).toLocaleString('es-PE',{month:'long'});
              return `<option value="${m}" ${m===mesActual?'selected':''}>${nom.charAt(0).toUpperCase()+nom.slice(1)}</option>`;
            }).join('')}
          </select>
          <select id="mbd-filtro-anio" style="${estiloSelect()}">
            ${[anioActual-1, anioActual, anioActual+1].map(a=>`<option value="${a}" ${a===anioActual?'selected':''}>${a}</option>`).join('')}
          </select>
          <button onclick="cargarMBD()" style="${estiloBtnSecundario()}">🔍 Filtrar</button>
        </div>
        <div style="display:flex;gap:8px;">
          <button onclick="importarExcelMBD()" style="${estiloBtnPrimario()}">📂 Importar Plantilla Excel</button>
          <button onclick="abrirModalMBD()" style="${estiloBtnSecundario()}">+ Nuevo Manual</button>
        </div>
      </div>

      <div id="mbd-tabla-wrap" style="overflow-x:auto;">
         <p style="text-align:center;color:var(--color-texto-suave);padding:40px">Selecciona un período y filtra para ver datos.</p>
      </div>

      <!-- PREVIEW PANEL -->
      <div id="mbd-preview-wrap" style="display:none;margin-top:20px;border:2px solid var(--color-secundario);border-radius:8px;padding:16px;background:var(--color-bg-card)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <h3 style="margin:0">👁️ Vista Previa (Hoja: Movimientos)</h3>
          <span id="mbd-prev-info" style="font-weight:700"></span>
        </div>
        <div style="overflow-x:auto;max-height:300px">
          <table class="tabla-nexum" style="font-size:11px">
            <thead>
              <tr>
                <th>Fila</th><th>N° Op</th><th>Fecha</th><th>Monto</th><th>Moneda</th><th>Proveedor</th><th>Concepto</th><th>Estado</th>
              </tr>
            </thead>
            <tbody id="mbd-prev-tbody"></tbody>
          </table>
        </div>
        <div style="display:flex;gap:12px;margin-top:16px">
          <button onclick="cancelarPreviewMBD()" style="${estiloBtnSecundario()}">Cancelar</button>
          <button onclick="confirmarImportMBD()" id="btn-confirmar-mbd" style="${estiloBtnPrimario()}">🚀 Procesar e Importar</button>
        </div>
      </div>
    </div>
    <input type="file" id="mbd-file-input" accept=".xlsx,.xls" style="display:none" onchange="procesarImportMBD(this)">
  `;
}

let _mbdDatosPreview = [];

function procesarImportMBD(input) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      // Buscamos específicamente la hoja "Movimientos"
      const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('movimiento')) || wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

      if (rows.length < 2) { alert("El Excel está vacío o no tiene la hoja 'Movimientos'"); return; }

      // Mapeo exacto según tu JSON de plantilla (Col A=0, Col B=1, etc.)
      _mbdDatosPreview = rows.slice(1).map((r, i) => {
        const monto = parseFloat(r[4]);
        const fechaRaw = r[1];
        
        return {
          _fila: i + 2,
          _ok: !!fechaRaw && !isNaN(monto),
          empresa_id: empresa_activa.id,
          nro_operacion_bancaria:     r[0] ? String(r[0]) : null,     // Col A
          fecha_deposito:             r[1],                           // Col B
          descripcion:                r[2] ? String(r[2]) : null,     // Col C
          moneda:                     r[3] || 'S/',                   // Col D
          monto:                      monto,                          // Col E
          proveedor_empresa_personal: r[5] ? String(r[5]) : null,     // Col F
          ruc_dni:                    r[6] ? String(r[6]) : null,     // Col G
          cotizacion:                 r[7] ? String(r[7]) : null,     // Col H
          oc:                         r[8] ? String(r[8]) : null,     // Col I
          proyecto:                   r[9] ? String(r[9]) : null,     // Col J
          concepto:                   r[10] || null,                  // Col K
          empresa:                    r[11] || null,                  // Col L
          entrega_doc:                r[12] || 'PENDIENTE',           // Col M
          nro_factura_doc:            r[13] ? String(r[13]) : null,   // Col N
          tipo_doc:                   r[14] || null,                  // Col O
          autorizacion:               r[15] || null,                  // Col P
          observaciones:              r[16] ? String(r[16]) : null,   // Col Q
          detalles_compra_servicio:   r[17] ? String(r[17]) : null,   // Col R
          observaciones_2:            r[18] ? String(r[18]) : null,   // Col S
          observaciones_3:            r[19] ? String(r[19]) : null,   // Col T
          observaciones_4:            r[20] ? String(r[20]) : null    // Col U
        };
      });

      const validos = _mbdDatosPreview.filter(r => r._ok);
      document.getElementById('mbd-preview-wrap').style.display = 'block';
      document.getElementById('mbd-prev-info').textContent = `${validos.length} registros listos de ${_mbdDatosPreview.length} totales`;

      const tbody = document.getElementById('mbd-prev-tbody');
      tbody.innerHTML = _mbdDatosPreview.slice(0, 10).map(r => `
        <tr style="${!r._ok ? 'background:rgba(197,48,48,.1)' : ''}">
          <td>${r._fila}</td>
          <td>${r.nro_operacion_bancaria || '-'}</td>
          <td>${r.fecha_deposito || 'ERR'}</td>
          <td>${r.monto || 'ERR'}</td>
          <td>${r.moneda}</td>
          <td>${(r.proveedor_empresa_personal || '').slice(0, 20)}</td>
          <td>${r.concepto || '-'}</td>
          <td>${r._ok ? '✅ OK' : '❌ ERROR'}</td>
        </tr>
      `).join('');

    } catch (err) {
      alert("Error leyendo el Excel: " + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

async function confirmarImportMBD() {
  const registros = _mbdDatosPreview.filter(r => r._ok).map(({ _fila, _ok, ...data }) => data);
  if (!registros.length) return;

  const btn = document.getElementById('btn-confirmar-mbd');
  btn.disabled = true; btn.textContent = 'Guardando en Base de Datos...';

  // Importación por bloques (Chunks) para evitar errores de red
  const SIZE = 50;
  let importados = 0;
  
  for (let i = 0; i < registros.length; i += SIZE) {
    const bloque = registros.slice(i, i + SIZE);
    const { error } = await _supabase.from('tesoreria_mbd').insert(bloque);
    if (error) {
      console.error("Error en bloque:", error);
      alert("Error parcial: " + error.message);
    } else {
      importados += bloque.length;
    }
  }

  alert(`¡Éxito! Se importaron ${importados} registros.`);
  cancelarPreviewMBD();
  cargarMBD();
}

function cancelarPreviewMBD() {
  _mbdDatosPreview = [];
  document.getElementById('mbd-preview-wrap').style.display = 'none';
  document.getElementById('mbd-file-input').value = '';
}

function importarExcelMBD() {
  document.getElementById('mbd-file-input').click();
}

// ... Mantén el resto de funciones (cargarMBD, estilos, etc.) igual que antes
