/**
 * NEXUM v3.0 - Utilidades generales
 * Formato peruano: DD/MM/YYYY, S/. 1,234.56
 */

// ── Formato de fecha ───────────────────────────────────────────────────────────
function formatearFecha(fecha) {
  if (!fecha) return '—';
  const d = new Date(fecha);
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const anio = d.getFullYear();
  return `${dia}/${mes}/${anio}`;
}

function fechaHoy() {
  return formatearFecha(new Date());
}

// ── Formato de moneda ──────────────────────────────────────────────────────────
function formatearMoneda(monto, moneda = 'PEN') {
  if (monto === null || monto === undefined) return '—';
  const num = parseFloat(monto);
  if (isNaN(num)) return '—';
  const formateado = num.toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return moneda === 'USD' ? `$ ${formateado}` : `S/ ${formateado}`;
}

// ── Toast de notificaciones ────────────────────────────────────────────────────
function mostrarToast(mensaje, tipo = 'info', duracion = 3500) {
  const colores = {
    exito:    { bg: '#2F855A', icono: '✓' },
    error:    { bg: '#C53030', icono: '✕' },
    atencion: { bg: '#D69E2E', icono: '⚠' },
    info:     { bg: '#2C5282', icono: 'ℹ' }
  };
  const conf = colores[tipo] || colores.info;

  const contenedor = document.getElementById('toast-contenedor') || crearContenedorToast();
  const toast = document.createElement('div');
  toast.className = 'nexum-toast';
  toast.style.cssText = `
    background:${conf.bg}; color:#fff; padding:12px 18px; border-radius:8px;
    display:flex; align-items:center; gap:10px; font-size:14px;
    box-shadow:0 4px 12px rgba(0,0,0,0.25); max-width:360px;
    animation: slideIn 0.3s ease; pointer-events:auto;
  `;
  toast.innerHTML = `<span style="font-size:18px">${conf.icono}</span><span>${mensaje}</span>`;
  contenedor.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 280);
  }, duracion);
}

function crearContenedorToast() {
  const div = document.createElement('div');
  div.id = 'toast-contenedor';
  div.style.cssText = `
    position:fixed; top:20px; right:20px; z-index:9999;
    display:flex; flex-direction:column; gap:8px; pointer-events:none;
  `;
  document.body.appendChild(div);
  return div;
}

// ── Modal de confirmación ──────────────────────────────────────────────────────
function confirmar(mensaje, { btnOk = 'Confirmar', btnColor = '#C53030' } = {}) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed; inset:0; background:rgba(0,0,0,0.5);
      display:flex; align-items:center; justify-content:center; z-index:9998;
    `;
    overlay.innerHTML = `
      <div style="background:#fff; border-radius:12px; padding:28px 32px; max-width:380px;
                  box-shadow:0 8px 32px rgba(0,0,0,0.2); text-align:center;">
        <div style="font-size:40px; margin-bottom:12px;">⚠️</div>
        <p style="color:#2D3748; font-size:15px; margin-bottom:24px; line-height:1.5;">${mensaje}</p>
        <div style="display:flex; gap:12px; justify-content:center;">
          <button id="btn-cancelar" style="padding:10px 24px; border:1px solid #CBD5E0;
            border-radius:8px; background:#fff; color:#4A5568; cursor:pointer; font-size:14px;">
            Cancelar
          </button>
          <button id="btn-confirmar" style="padding:10px 24px; border:none;
            border-radius:8px; background:${btnColor}; color:#fff; cursor:pointer; font-size:14px;">
            ${btnOk}
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#btn-confirmar').onclick = () => { overlay.remove(); resolve(true); };
    overlay.querySelector('#btn-cancelar').onclick  = () => { overlay.remove(); resolve(false); };
    overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); resolve(false); } });
  });
}

// ── Sanitizar texto para XSS ──────────────────────────────────────────────────
function escapar(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Validar RUC peruano (11 dígitos) ──────────────────────────────────────────
function validarRUC(ruc) {
  return /^\d{11}$/.test(ruc);
}

// ── Validar DNI peruano (8 dígitos) ───────────────────────────────────────────
function validarDNI(dni) {
  return /^\d{8}$/.test(dni);
}

// ── Truncar texto largo ────────────────────────────────────────────────────────
function truncar(texto, largo = 30) {
  if (!texto) return '—';
  return texto.length > largo ? texto.substring(0, largo) + '…' : texto;
}

// ── Animaciones CSS dinámicas ──────────────────────────────────────────────────
(function inyectarAnimaciones() {
  if (document.getElementById('nexum-animations')) return;
  const style = document.createElement('style');
  style.id = 'nexum-animations';
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(120%); opacity: 0; }
      to   { transform: translateX(0);    opacity: 1; }
    }
    @keyframes slideOut {
      from { transform: translateX(0);    opacity: 1; }
      to   { transform: translateX(120%); opacity: 0; }
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .fadeIn { animation: fadeIn 0.25s ease; }
  `;
  document.head.appendChild(style);
})();
