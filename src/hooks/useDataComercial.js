import { useEffect, useMemo, useState } from 'react';

/* =========================================================
   useDataComercial v4 — múltiplas tabelas lado a lado (Google Sheets)
   1) POR CLIENTE           → [cliente, media_pp]
   2) POR PRODUTO (meses)   → [{produto, mes_pt, valor_pp}]
   3) POR SEGMENTO (meses)  → [{segmento, mes_pt, valor_pp}]
   4) QUANTIDADE POR PRODUTO→ [{produto, barras, kg}]
   5) VALOR VENDIDO POR MÊS → [{mes_pt, valor_rs}] + total geral
========================================================= */

/* =============== utils base =============== */
const clean = (s) =>
  String(s ?? '').replace(/[\uFEFF\u200B\u00A0]/g, ' ').replace(/^"+|"+$/g, '').trim();

const norm = (s) =>
  clean(s).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

/* Debug */
const DEBUG = true;
const dlog = (...args) => { if (DEBUG) console.log('[useDataComercial]', ...args); };

function detectSep(text) {
  const f = text.split(/\r?\n/)[0] || '';
  if (f.includes('\t')) return '\t';
  if (f.includes(';')) return ';';
  return ',';
}
function splitCSVLine(line, sep = ',') {
  const out = [];
  let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else { q = false; }
      } else cur += ch;
    } else {
      if (ch === '"') q = true;
      else if (ch === sep) { out.push(cur); cur = ''; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out.map(clean);
}
function parseCSV(text) {
  const sep = detectSep(text);
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const rows = lines.map((l) => splitCSVLine(l, sep));
  const maxCols = Math.max(...rows.map((r) => r.length));
  const grid = rows.map((r) => {
    const a = [...r];
    while (a.length < maxCols) a.push('');
    return a;
  });
  return grid;
}

function toNumberBR(v) {
  if (v == null || v === '') return 0;
  const s0 = String(v);
  const s = s0.replace(/[^0-9.,-]/g, '').trim();
  if (/^\d{1,3}(\.\d{3})+,\d+$/.test(s)) return Number(s.replace(/\./g, '').replace(',', '.'));
  if (/^\d{1,3}(,\d{3})+\.\d+$/.test(s)) return Number(s.replace(/,/g, ''));
  if (/^\d+,\d+$/.test(s)) return Number(s.replace(',', '.'));
  if (/^\d+\.\d+$/.test(s)) return Number(s);
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ''));
  if (/^\d{1,3}(,\d{3})+$/.test(s)) return Number(s.replace(/,/g, ''));
  if (/^[-+]?\d+$/.test(s)) return Number(s);
  return Number(s.replace(/\./g, '').replace(',', '.')) || 0;
}

const MONTHS = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const isMonthPT = (s) => {
  if (!s) return false;
  const t = norm(s).slice(0,3);
  return MONTHS.includes(t);
};
function monthIdFromPt(pt) {
  const idx = MONTHS.indexOf(norm(pt).slice(0, 3));
  if (idx < 0) return undefined;
  const m = String(idx + 1).padStart(2, '0');
  return m;
}

/* =============== grid helpers =============== */
function findCells(grid, match) {
  const hits = [];
  const isReg = match instanceof RegExp;
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const v = norm(grid[r][c]);
      if (isReg ? match.test(v) : v.includes(norm(match))) hits.push({ r, c, text: grid[r][c] });
    }
  }
  return hits;
}

// TÍTULO EXATO
function findTitleExact(grid, title) {
  const target = norm(title);
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (norm(grid[r][c]) === target) return { r, c, text: grid[r][c] };
    }
  }
  return null;
}

// TÍTULO por REGEX ANCORADA (normaliza espaços)
function findTitleRegex(grid, re) {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const t = norm(grid[r][c]).replace(/\s+/g, ' ').trim();
      if (re.test(t)) return { r, c, text: grid[r][c] };
    }
  }
  return null;
}

function readColumn(grid, r0, c0, { stopAtTotal = true } = {}) {
  const out = [];
  let r = r0;
  while (r < grid.length) {
    const key = clean(grid[r][c0]);
    const valRaw = clean(grid[r][c0 + 1]);
    if (!key && !valRaw) break;
    if (stopAtTotal && /^total/i.test(norm(key))) break;
    if (key) {
      const valor = toNumberBR(valRaw);
      if (!Number.isNaN(valor)) out.push({ key, valor });
    }
    r++;
  }
  return out;
}

/* === novo: acha a linha com MAIS meses (jan..dez) perto do título === */
function collectMonthsBest(grid, rTitle, cStart) {
  let best = { r: -1, monthsIdx: [] };

  for (let r = rTitle; r <= rTitle + 3 && r < grid.length; r++) {
    const monthsIdx = [];
    for (let c = cStart + 1; c < grid[r].length; c++) {
      const raw = grid[r][c];
      const h = norm(raw);
      if (!h) continue;
      if (h.startsWith('rotulos') || h.startsWith('rótulos')) continue;
      if (h.startsWith('total')) break;
      if (isMonthPT(raw)) monthsIdx.push({ c, m: norm(raw).slice(0, 3) });
    }
    if (monthsIdx.length > best.monthsIdx.length) best = { r, monthsIdx };
  }

  return best; // { r: linhaDoHeader, monthsIdx: [{c, m}, ...] }
}

/* === robusto: lê a tabela ancorando na “melhor” linha de meses === */
function readTableWithMonthsFlex(grid, rTitle, cStart) {
  const { r: rHeader, monthsIdx } = collectMonthsBest(grid, rTitle, cStart);
  if (!monthsIdx.length) return [];

  const out = [];
  let emptyStreak = 0;

  // começa 1 linha abaixo do header encontrado
  for (let r = rHeader + 1; r < grid.length; r++) {
    const keyCell = clean(grid[r][cStart]);
    const keyNorm = norm(keyCell);

    // chegou em outro bloco/título? encerra
    const looksNextBlock =
      /^por\s+(cliente|produto|segmento)\b/.test(keyNorm) ||
      keyNorm.includes('quantidade vendida') ||
      keyNorm.includes('valor total vendido');
    if (looksNextBlock) break;

    // linha vazia: conta e, se for a 2ª seguida, encerra
    if (!keyCell) {
      emptyStreak++;
      if (emptyStreak >= 2) break;
      continue;
    }
    emptyStreak = 0;

    if (/^total/i.test(keyNorm)) break;

    // lê valores dos meses daquela linha
    for (const { c, m } of monthsIdx) {
      const raw = grid[r][c];
      if (raw == null) continue;
      const s = String(raw).trim();
      if (!s || s === '-' || s === '—') continue;

      const val = toNumberBR(s);
      if (Number.isFinite(val)) out.push({ key: keyCell, mes: m, valor: val });
    }
  }

  return out;
}

/* =============== parser principal =============== */
function parseMultiTablesFromCSV(text) {
  const grid = parseCSV(text);
  dlog('grid size', grid.length, 'x', (grid[0]?.length ?? 0));
  dlog('csv first 8 lines:\n' + text.split('\n').slice(0, 8).join('\n'));

  // 1) POR CLIENTE
  const posCliente = findTitleExact(grid, 'POR CLIENTE');
  let clientes = [];
  if (posCliente) {
    dlog('POR CLIENTE at', posCliente);
    const r0 = posCliente.r + 1;
    const c0 = posCliente.c;
    clientes = readColumn(grid, r0, c0, { stopAtTotal: true })
      .map((x) => ({ cliente: x.key, media_pp: x.valor }));
    dlog('clientes count', clientes.length);
  } else {
    dlog('POR CLIENTE not found');
  }

  // 2) POR PRODUTO (evitar confundir com QUANTIDADE VENDIDA POR PRODUTO)
  const posProd = findTitleExact(grid, 'POR PRODUTO');
  let produtoMes = [];
  if (posProd) {
    dlog('POR PRODUTO at', posProd);
    const rows = readTableWithMonthsFlex(grid, posProd.r, posProd.c);
    produtoMes = rows.map(({ key, mes, valor }) => ({ produto: key, mes_pt: mes, valor_pp: valor }));
    dlog('produtoMes count', produtoMes.length);
  } else {
    dlog('POR PRODUTO not found');
  }

  // 3) POR SEGMENTO — exato OU regex (tolerando espaços)
  let posSeg =
    findTitleExact(grid, 'POR SEGMENTO') ||
    findTitleRegex(grid, /^por\s*segmento$/);
  let segmentoMes = [];
  if (posSeg) {
    dlog('POR SEGMENTO at', posSeg);
    const rows = readTableWithMonthsFlex(grid, posSeg.r, posSeg.c);
    segmentoMes = rows.map(({ key, mes, valor }) => ({ segmento: key, mes_pt: mes, valor_pp: valor }));
    dlog('segmentoMes count', segmentoMes.length);
  } else {
    dlog('POR SEGMENTO not found');
  }

  // 4) QUANTIDADE VENDIDA POR PRODUTO
  const posQtd = findTitleExact(grid, 'QUANTIDADE VENDIDA POR PRODUTO');
  let qtdKgPorProduto = [];
  if (posQtd) {
    dlog('QTD POR PRODUTO at', posQtd);
    const rStart = posQtd.r + 1;
    const cStart = posQtd.c;
    let r = rStart + 1; // pula "Rótulos de Linha"
    while (r < grid.length) {
      const produto = clean(grid[r][cStart]);
      if (!produto) break;
      if (/^total/i.test(norm(produto))) break;
      const barras = toNumberBR(grid[r][cStart + 1]);
      const kg = toNumberBR(grid[r][cStart + 2]);
      qtdKgPorProduto.push({ produto, barras, kg });
      r++;
    }
    dlog('qtdKgPorProduto count', qtdKgPorProduto.length);
  } else {
    dlog('QTD POR PRODUTO not found');
  }

  // 5) VALOR TOTAL VENDIDO POR MÊS
  const posValMesAll = findCells(
    grid,
    /(valor|vlr|soma).*vendido.*mes|valor\s+total\s+vendido.*mes/
  );
  let valorPorMes = [];
  let valorTotalGeral = 0;
  if (posValMesAll.length) {
    const posValMes = posValMesAll[0];
    dlog('VALOR POR MÊS at', posValMes);
    const r = posValMes.r + 1;
    const c = posValMes.c;
    let rr = r + 1; // pula "Rótulos de Linha"
    while (rr < grid.length) {
      const mesPt = clean(grid[rr][c]);
      if (!mesPt) break;
      if (/^total/i.test(norm(mesPt))) break;
      const val = toNumberBR(grid[rr][c + 1]);
      valorPorMes.push({ mes_pt: mesPt.toLowerCase().slice(0, 3), valor_rs: val });
      valorTotalGeral += val;
      rr++;
    }
    dlog('valorPorMes count', valorPorMes.length, 'valorTotalGeral', valorTotalGeral);
  } else {
    dlog('VALOR POR MÊS not found');
  }

  return { clientes, produtoMes, segmentoMes, qtdKgPorProduto, valorPorMes, valorTotalGeral };
}

/* =============== Hook =============== */
export default function useDataComercial(url) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    clientes: [],
    produtoMes: [],
    segmentoMes: [],
    qtdKgPorProduto: [],
    valorPorMes: [],
    valorTotalGeral: 0,
  });

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(url);
        const text = await res.text();
        const parsed = parseMultiTablesFromCSV(text);
        setData(parsed);
      } catch (e) {
        console.error('[useDataComercial v4] erro', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [url]);

  const shaped = useMemo(() => {
    const valorTotalGeral = data.valorTotalGeral || 0;
    const valorPorMes = data.valorPorMes
      .map((x) => ({ mes_id: monthIdFromPt(x.mes_pt), label: x.mes_pt.toUpperCase(), valor: x.valor_rs }));

    const quantidadePorProduto = data.qtdKgPorProduto
      .map((x) => ({ produto: x.produto, qtd: x.barras }))
      .sort((a, b) => b.qtd - a.qtd);

    const pesoPorProduto = data.qtdKgPorProduto
      .map((x) => ({ produto: x.produto, kg: x.kg }))
      .sort((a, b) => b.kg - a.kg);

    const clientesGeral = data.clientes
      .map((x) => ({ cliente: x.cliente, valor: x.media_pp }))
      .sort((a, b) => b.valor - a.valor); // % média

    const produtosPorMesFlat = data.produtoMes
      .map((r) => ({ mes_id: monthIdFromPt(r.mes_pt), label: r.mes_pt.toUpperCase(), produto: r.produto, valor: r.valor_pp }))
      .sort((a, b) => (a.mes_id === b.mes_id ? b.valor - a.valor : (a.mes_id || '').localeCompare(b.mes_id || '')));

    const segmentosPorMesFlat = data.segmentoMes
      .map((r) => ({ mes_id: monthIdFromPt(r.mes_pt), label: r.mes_pt.toUpperCase(), segmento: r.segmento, valor: r.valor_pp }))
      .sort((a, b) => (a.mes_id === b.mes_id ? b.valor - a.valor : (a.mes_id || '').localeCompare(b.mes_id || '')));

      // Margem por cliente: já é a "Média de %" por cliente
  const margemPorCliente = [...clientesGeral];

   // Margem por produto: média da "Média de %" (valor) por produto ao longo dos meses
   const acc = new Map();
   for (const r of produtosPorMesFlat) {
    const k = r.produto;
     if (!acc.has(k)) acc.set(k, { produto: k, sum: 0, n: 0 });
     const o = acc.get(k);
    o.sum += Number(r.valor) || 0;
    o.n += 1;
   }
  const margemPorProduto = Array.from(acc.values())
     .map(o => ({ produto: o.produto, valor: o.n ? o.sum / o.n : 0 }))
    .sort((a,b) => b.valor - a.valor);

    return {
      loading: false,
      valorTotalGeral,
      valorPorMes,
      quantidadePorProduto,
      pesoPorProduto,
      clientesGeral,
      produtosPorMesFlat,
      segmentosPorMesFlat,
      margemPorProduto,
      margemPorCliente,
    };
  }, [data]);


return { loading, ...shaped };

}
