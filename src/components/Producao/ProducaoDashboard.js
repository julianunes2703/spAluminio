import React, { useMemo, useState } from "react";
import useDataProducao from "../../hooks/useDataProdução";
import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import "./ProducaoDashboard.css";

// formatadores
const fmtInt = (v) => Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(Math.round(v ?? 0));
const fmtKg  = (v) => Intl.NumberFormat("pt-BR", { style: "unit", unit: "kilogram", maximumFractionDigits: 1 }).format(Number(v ?? 0));
const fmtPct = (v) => `${(Number(v ?? 0) * 100).toFixed(1)}%`;
const toPct = (v) => `${Number(v ?? 0).toFixed(1)}%`;

// helper para ordenar desc por campo
const sortDesc = (arr, key) => [...arr].sort((a,b) => (b[key] ?? 0) - (a[key] ?? 0));

export default function ProducaoDashboard() {
  const url =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQblNwIDjBvoIQk7QFMhAklZWCiATjaCb_RjP68Ofrfom14K5mBh2bmgTI8ll-99g/pub?gid=747913968&single=true&output=csv";

  const { data, loading, error } = useDataProducao(url);

  // --- métricas agregadas
  const kpis = useMemo(() => {
    if (!data?.length) {
      return {
        producaoTotalKg: 0,
        eficienciaMedia: 0,
        produtividadeMedia: 0,
        rendimentoMedio: 0,
        itens: 0,
      };
    }
    const itens = data.length;
    const somaPesoLiq   = data.reduce((s, r) => s + (r.pesoLiq || 0), 0);
    const somaPesoBruto = data.reduce((s, r) => s + (r.pesoBruto || 0), 0);
    const somaEficW     = data.reduce((s, r) => s + (r.efic || 0) * (r.pesoLiq || 0), 0);
    const somaTempo     = data.reduce((s, r) => s + (r.tempo || 0), 0);
    const somaProdKgH   = data.reduce((s, r) => s + (r.prodKgH || 0), 0);

    const eficienciaMedia = somaPesoLiq > 0 ? (somaEficW / somaPesoLiq) : 0; // ponderada por produção
    const produtividadeMedia = itens > 0 ? (somaProdKgH / itens) : 0;
    const rendimentoMedio = somaPesoBruto > 0 ? (somaPesoLiq / somaPesoBruto) : 0;

    return {
      producaoTotalKg: somaPesoLiq,
      eficienciaMedia,
      produtividadeMedia,
      rendimentoMedio,
      itens,
    };
  }, [data]);

  // --- datasets para gráficos/tabela
  const topProducao = useMemo(() => sortDesc(data, "pesoLiq").slice(0, 20)
    .map(r => ({ item: r.item, kg: r.pesoLiq || 0 })), [data]);

  const eficPorItem = useMemo(() => sortDesc(data, "efic").slice(0, 20)
    .map(r => ({ item: r.item, efic: r.efic || 0 })), [data]);

  const [busca, setBusca] = useState("");
  const tabela = useMemo(() => {
    const q = (busca || "").toLowerCase().trim();
    const base = q
      ? data.filter(r =>
          r.item?.toLowerCase().includes(q) ||
          r.classif?.toLowerCase().includes(q)
        )
      : data;
    return sortDesc(base, "pesoLiq");
  }, [data, busca]);

  if (loading) {
    return (
      <div className="pd__page">
        <div className="pd__loading">Carregando dados de produção…</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="pd__page">
        <div className="pd__error">Erro ao carregar CSV de produção.</div>
      </div>
    );
  }

  return (
    <div className="pd__page">
      <header className="pd__header">
        <h1 className="pd__title">Produção — Dashboard</h1>
        <p className="pd__subtitle">Produção (kg) • Eficiência • Produtividade • Rendimento • Itens</p>
      </header>

      {/* KPIs */}
      <section className="pd__kpis">
        <div className="pd__card">
          <span className="pd__cardLabel">Produção total</span>
          <span className="pd__cardValue">{fmtKg(kpis.producaoTotalKg)}</span>
        </div>
        <div className="pd__card">
          <span className="pd__cardLabel">Eficiência média</span>
          <span className="pd__cardValue">{fmtPct(kpis.eficienciaMedia)}</span>
        </div>
        <div className="pd__card">
          <span className="pd__cardLabel">Produtividade média</span>
          <span className="pd__cardValue">{fmtKg(kpis.produtividadeMedia)}/h</span>
        </div>
        <div className="pd__card">
          <span className="pd__cardLabel">Rendimento médio</span>
          <span className="pd__cardValue">{fmtPct(kpis.rendimentoMedio)}</span>
        </div>
        <div className="pd__card">
          <span className="pd__cardLabel">Itens</span>
          <span className="pd__cardValue">{fmtInt(kpis.itens)}</span>
        </div>
      </section>

      {/* Produção por item (kg) */}
      <section className="pd__panel">
        <div className="pd__panelHeader">
          <h2 className="pd__h2">Top 20 — Produção por item (kg)</h2>
        </div>
        <div className="pd__chartWrap">
          <ResponsiveContainer width="100%" height={360}>
            <BarChart
              data={topProducao}
              margin={{ top: 10, right: 10, bottom: 60, left: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#000" />
              <XAxis dataKey="item" angle={-40} textAnchor="end" interval={0} height={80} stroke="#000" />
              <YAxis stroke="#000" />
              <Tooltip formatter={(v) => fmtKg(v)} />
              <Legend />
              <Bar dataKey="kg" name="Kg" fill="#000" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Eficiência por item (%) */}
      <section className="pd__panel">
        <div className="pd__panelHeader">
          <h2 className="pd__h2">Top 20 — Eficiência por item (%)</h2>
        </div>
        <div className="pd__chartWrap">
          <ResponsiveContainer width="100%" height={360}>
            <BarChart
              data={eficPorItem}
              margin={{ top: 10, right: 10, bottom: 60, left: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#000" />
              <XAxis dataKey="item" angle={-40} textAnchor="end" interval={0} height={80} stroke="#000" />
              <YAxis tickFormatter={(v) => toPct(v)} stroke="#000" />
              <Tooltip formatter={(v) => fmtPct(v)} />
              <Legend />
              <Bar dataKey="efic" name="Eficiência (%)" fill="#000" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Tabela detalhada */}
      <section className="pd__panel">
        <div className="pd__panelHeader">
          <h2 className="pd__h2">Itens — detalhamento</h2>
        </div>

        <div className="pd__panelFilters">
          <label className="pd__filterLabel">
            Buscar item:
            <input
              type="text"
              className="pd__input"
              placeholder="Digite o código do item…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </label>
        </div>

        <div className="pd__tableWrap">
          {tabela.length === 0 ? (
            <div className="pd__empty">Sem dados para o filtro.</div>
          ) : (
            <table className="pd__table">
              <thead>
                <tr>
                  <th>Item</th>
                 
                  <th className="pd__thRight">Peso liq (kg)</th>
                  <th className="pd__thRight">Peso bruto (kg)</th>
                  <th className="pd__thRight">Eficiência</th>
                  <th className="pd__thRight">Prod (kg/h)</th>
                  <th className="pd__thRight">Classe</th>
                  <th className="pd__thRight">Tarugos</th>
                  <th className="pd__thRight">Tar/h</th>
                </tr>
              </thead>
              <tbody>
                {tabela.slice(0, 200).map((r, i) => (
                  <tr key={i}>
                    <td>{r.item}</td>
                   
                    <td className="pd__tdRight">{fmtKg(r.pesoLiq)}</td>
                    <td className="pd__tdRight">{fmtKg(r.pesoBruto)}</td>
                    <td className="pd__tdRight">{fmtPct(r.efic)}</td>
                    <td className="pd__tdRight">{fmtKg(r.prodKgH)}/h</td>
                    <td className="pd__tdRight">{r.classif || "-"}</td>
                    <td className="pd__tdRight">{fmtInt(r.quantTarugo || 0)}</td>
                    <td className="pd__tdRight">{(r.tarH ?? 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
