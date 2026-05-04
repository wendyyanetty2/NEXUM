// ═══════════════════════════════════════════════════════════════
// Servicio compartido: Parser Excel SUNAT — Compras / Ventas
// Usado por: Tributaria › Importar SUNAT  y  Tesorería › Importar SUNAT
// Mapeo de columnas según plantilla_compras.json y plantilla_ventas.json
// ═══════════════════════════════════════════════════════════════

// ── Helpers de conversión ─────────────────────────────────────────

function sunat_fecha(val) {
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
  return isNaN(d2.getTime()) ? null : d2.toISOString().slice(0, 10);
}

function sunat_num(val) {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

function sunat_str(val) {
  if (val === null || val === undefined || val === '') return null;
  return val.toString().trim().replace(/\s+/g, ' ') || null;
}

function sunat_ruc(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return Math.round(val).toString();
  return val.toString().trim() || null;
}

function sunat_tdoc(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = parseInt(val);
  return isNaN(n) ? val.toString().trim() : String(n).padStart(2, '0');
}

function sunat_moneda(val) {
  if (!val) return 'PEN';
  const s = val.toString().trim().toUpperCase();
  if (['USD', '2', 'US$', '$', 'DO'].includes(s)) return 'USD';
  if (['EUR', '3'].includes(s)) return 'EUR';
  return 'PEN';
}

function sunat_periodo(raw, fecha) {
  const s = sunat_str(raw);
  if (s && /^\d{6}$/.test(s)) return s.slice(0, 4) + '-' + s.slice(4, 6);
  return fecha ? fecha.slice(0, 7) : null;
}

// ── Detectar tipo de registro desde encabezados ───────────────────

function sunat_detectar_tipo(headers) {
  const hdrs = (headers || []).map(h => (h || '').toString().trim());
  if (hdrs.some(h => h === 'BI Gravado DG')) return 'COMPRAS';
  if (hdrs.some(h => h === 'BI Gravada'))    return 'VENTAS';
  return null;
}

// ── Parser fila Compras ───────────────────────────────────────────
// Columnas 0-indexed según plantilla_compras.json:
//  A(0)=RUC empresa   B(1)=RazSoc    C(2)=Periodo   D(3)=CAR
//  E(4)=FecEmision    F(5)=FecVcto   G(6)=TipoCP    H(7)=Serie
//  I(8)=Año(skip)     J(9)=NroCP     K(10)=NroFin
//  L(11)=TipoIdProv   M(12)=NroDocProv(RUC)   N(13)=NombreProv
//  O(14)=BI_GravDG    P(15)=IGV_DG   ...
//  Y(24)=TotalCP      Z(25)=Moneda   AA(26)=TipoCambio
//  ...                AL(37)=Detraccion

function sunat_parsear_compras_row(r, fila) {
  const fecha  = sunat_fecha(r[4]);
  const total  = sunat_num(r[24]);
  const serie  = sunat_str(r[7]);
  const nroRaw = r[9] != null ? (parseInt(r[9]) || sunat_str(r[9])) : null;
  const numero = nroRaw != null ? String(nroRaw) : null;

  const _errores = [];
  if (!fecha)      _errores.push('Sin fecha de emisión');
  if (!serie)      _errores.push('Sin serie de comprobante');
  if (total === 0) _errores.push('Total = 0');

  return {
    _fila:  fila,
    _ok:    _errores.length === 0,
    _errores,
    tipo:   'COMPRAS',
    fecha,
    fecha_vencimiento:     sunat_fecha(r[5]),
    periodo:               sunat_periodo(r[2], fecha),
    tipo_documento_codigo: sunat_tdoc(r[6]),
    serie,
    numero,
    cdp:   serie && numero ? `${serie}-${numero}` : (serie || numero || '—'),
    ruc_proveedor:   sunat_ruc(r[12]),
    nombre_proveedor: sunat_str(r[13]),
    base_imponible:  sunat_num(r[14]),
    igv:             sunat_num(r[15]),
    total,
    moneda:          sunat_moneda(r[25]),
    tipo_cambio:     sunat_num(r[26]) || 1,
    codigo_detraccion: sunat_str(r[37]),
    tiene_detraccion:  !!(r[37] && sunat_str(r[37])),
  };
}

// ── Parser fila Ventas ────────────────────────────────────────────
// Columnas 0-indexed según plantilla_ventas.json:
//  A(0)=RUC   B(1)=RazSoc    C(2)=Periodo   D(3)=CAR
//  E(4)=FecEmision   F(5)=FecVcto   G(6)=TipoCP   H(7)=Serie
//  I(8)=NroCP   J(9)=NroFin
//  K(10)=TipoIdCli   L(11)=NroDocCli(RUC)   M(12)=NombreCli
//  N(13)=ValFacExp   O(14)=BI_Gravada   P(15)=DsctoBi
//  Q(16)=IGV_IPM   ...
//  Z(25)=TotalCP   AA(26)=Moneda   AB(27)=TipoCambio

function sunat_parsear_ventas_row(r, fila) {
  const fecha  = sunat_fecha(r[4]);
  const total  = sunat_num(r[25]);
  const serie  = sunat_str(r[7]);
  const nroRaw = r[8] != null ? (parseInt(r[8]) || sunat_str(r[8])) : null;
  const numero = nroRaw != null ? String(nroRaw) : null;

  const _errores = [];
  if (!fecha)      _errores.push('Sin fecha de emisión');
  if (!serie)      _errores.push('Sin serie de comprobante');
  if (total === 0) _errores.push('Total = 0');

  return {
    _fila:  fila,
    _ok:    _errores.length === 0,
    _errores,
    tipo:   'VENTAS',
    fecha,
    fecha_vencimiento:     sunat_fecha(r[5]),
    periodo:               sunat_periodo(r[2], fecha),
    tipo_documento_codigo: sunat_tdoc(r[6]),
    serie,
    numero,
    cdp:   serie && numero ? `${serie}-${numero}` : (serie || numero || '—'),
    ruc_cliente:    sunat_ruc(r[11]),
    nombre_cliente: sunat_str(r[12]),
    base_imponible: sunat_num(r[14]),
    igv:            sunat_num(r[16]),
    total,
    moneda:         sunat_moneda(r[26]),
    tipo_cambio:    sunat_num(r[27]) || 1,
  };
}

// ── Función principal ─────────────────────────────────────────────
// Parsea un ArrayBuffer de Excel SUNAT.
// tipoForzado: 'COMPRAS' | 'VENTAS' | null (null = auto-detectar)
// Retorna: { tipo, filas, totalFilas }

function sunat_parsear_buffer(buffer, tipoForzado) {
  const wb   = XLSX.read(buffer, { type: 'array', cellDates: false });
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  if (!rows.length) throw new Error('El archivo está vacío');

  // Detectar tipo desde encabezados (primeras 5 filas)
  let tipo = null;
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    tipo = sunat_detectar_tipo(rows[i]);
    if (tipo) break;
  }
  if (!tipo) tipo = tipoForzado || null;
  if (!tipo) return { tipo: null, filas: [], totalFilas: rows.length };

  // Localizar primera fila de datos (col[4] con fecha válida)
  let inicioData = 0;
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    if (rows[i] && rows[i][4] != null && sunat_fecha(rows[i][4])) {
      inicioData = i;
      break;
    }
  }

  const colTotal  = tipo === 'VENTAS' ? 25 : 24;
  const dataRows  = rows.slice(inicioData).filter(r => r && (r[4] != null || r[colTotal] != null));

  const filas = dataRows.map((r, i) =>
    tipo === 'VENTAS'
      ? sunat_parsear_ventas_row(r, inicioData + i + 1)
      : sunat_parsear_compras_row(r, inicioData + i + 1)
  );

  return { tipo, filas, totalFilas: rows.length };
}
