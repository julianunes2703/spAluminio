import { useEffect, useState } from "react";
import Papa from "papaparse";

// helpers
const cleanStr = (s) =>
  String(s ?? "")
    .replace(/\uFEFF/g, "")     // BOM
    .replace(/\u00A0/g, " ")    // NBSP
    .trim();

const norm = (s) =>
  cleanStr(s)
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // sem acento
    .replace(/\s+/g, " ");

const parseNumber = (v) => {
  const s = cleanStr(v);
  if (!s || s === "-") return 0;
  return Number(s.replace(/[^\d,-]/g, "").replace(",", "."));
};
const parsePercent = (v) => parseNumber(v) / 100;

// localiza o índice da coluna cujo cabeçalho bate em algum regex
const findIndex = (headers, tests) => {
  const N = headers.length;
  for (let i = 0; i < N; i++) {
    const h = norm(headers[i]);
    for (const re of tests) {
      if (re.test(h)) return i;
    }
  }
  return -1;
};

export default function useDataProducao(url) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  useEffect(() => {
    if (!url) return;

    (async () => {
      try {
        setLoading(true);

        // baixa CSV bruto
        const csvTextFull = await fetch(url).then(r => r.text());

        // pula qualquer coisa antes da linha que contém "Item"
        const lines = csvTextFull.split(/\r?\n/);
        const headerIdx = lines.findIndex((ln) => /(^|,) *"?item"? *(,|$)/i.test(ln));
        const csvText = headerIdx >= 0 ? lines.slice(headerIdx).join("\n") : csvTextFull;

        // parse como MATRIZ (sem header) para respeitar exatamente as células
        const parsed = Papa.parse(csvText, { header: false, skipEmptyLines: true });
        const rows = parsed.data || [];
        if (!rows.length) { setData([]); setLoading(false); return; }

        const headers = rows[0].map(cleanStr);

        // mapeia índices (regex super permissivos)
        const idx = {
          item:        findIndex(headers, [/^item$/i]),
          pcs:         findIndex(headers, [/^p[çc]s$/i, /^pe[çc]as$/i, /^pe[çc]a$/i]),
          pesoLiq:     findIndex(headers, [/^peso\s*liq/i, /^peso\s*liquido/i]),
          pesoBruto:   findIndex(headers, [/^peso\s*bruto/i]),
          classif:     findIndex(headers, [/^classif/i]),
          cABC:        findIndex(headers, [/^c\.?\s*abc/i]),
          efic:        findIndex(headers, [/^efic/i, /^eficiencia/i]),
          tempo:       findIndex(headers, [/^tempo$/i]),
          prodKgH:     findIndex(headers, [/^prod\s*kg\s*\/\s*h$/i, /^prod\s*kg\s*h/i]),
          gramPerfil:  findIndex(headers, [/^gram\s*perfil/i]),
          gramFerr:    findIndex(headers, [/^gram\s*ferr/i]),
          compTarugo:  findIndex(headers, [/^(comp\.|comprimento)\s*tarugo/i]),
          quantTarugo: findIndex(headers, [/^(quant\.|qtd|quant)\s*tarugo/i]),
          tarH:        findIndex(headers, [/^tar\s*\/\s*h$/i]),
          furos:       findIndex(headers, [/^furos$/i]),
          prodMedFerram: findIndex(headers, [/^produ[cç][aã]o\s*med/i]),
          espessura:   findIndex(headers, [/^espessura/i]),
          custoFerr:   findIndex(headers, [/^custo\s*ferr/i]),
        };

        // transforma as linhas (pulando a primeira, que é o header)
        const out = [];
        for (let r = 1; r < rows.length; r++) {
          const row = rows[r];

          const item = cleanStr(row[idx.item]);
          if (!item) continue;
          const up = item.toUpperCase();
          if (up.includes("CURVA") || up === "TOTAL") continue;

          out.push({
            item,
            pcs:           parseNumber(idx.pcs >= 0 ? row[idx.pcs] : 0),
            pesoLiq:       parseNumber(idx.pesoLiq >= 0 ? row[idx.pesoLiq] : 0),
            pesoBruto:     parseNumber(idx.pesoBruto >= 0 ? row[idx.pesoBruto] : 0),
            classif:       cleanStr(idx.classif >= 0 ? row[idx.classif] : ""),
            cABC:          parsePercent(idx.cABC >= 0 ? row[idx.cABC] : 0),
            efic:          parsePercent(idx.efic >= 0 ? row[idx.efic] : 0),
            tempo:         parseNumber(idx.tempo >= 0 ? row[idx.tempo] : 0),
            prodKgH:       parseNumber(idx.prodKgH >= 0 ? row[idx.prodKgH] : 0),
            gramPerfil:    parseNumber(idx.gramPerfil >= 0 ? row[idx.gramPerfil] : 0),
            gramFerr:      parseNumber(idx.gramFerr >= 0 ? row[idx.gramFerr] : 0),
            compTarugo:    parseNumber(idx.compTarugo >= 0 ? row[idx.compTarugo] : 0),
            quantTarugo:   parseNumber(idx.quantTarugo >= 0 ? row[idx.quantTarugo] : 0),
            tarH:          parseNumber(idx.tarH >= 0 ? row[idx.tarH] : 0),
            furos:         parseNumber(idx.furos >= 0 ? row[idx.furos] : 0),
            prodMedFerram: parseNumber(idx.prodMedFerram >= 0 ? row[idx.prodMedFerram] : 0),
            espessura:     parseNumber(idx.espessura >= 0 ? row[idx.espessura] : 0),
            custoFerr:     parseNumber(idx.custoFerr >= 0 ? row[idx.custoFerr] : 0),
          });
        }

        // debug opcional
        if (out.length && out[0].pcs === 0) {
          console.warn("[useDataProducao] índices detectados:", idx);
          console.warn("[useDataProducao] header detectado:", headers);
          console.warn("[useDataProducao] amostra linha bruta:", rows[1]);
        }

        setData(out);
        setError(null);
      } catch (e) {
        console.error("Erro CSV produção:", e);
        setError(e);
        setData([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [url]);

  return { data, loading, error };
}
