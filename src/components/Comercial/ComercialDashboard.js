import React, { useState, useMemo } from "react";
import useDataComercial from "../../hooks/useDataComercial";
import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import "./ComercialDashboard.css";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmtBRL = (v) => BRL.format(v ?? 0);
const fmtPct  = (v) => `${Number(v ?? 0).toFixed(1)}%`;

// ordem dos meses para ordenar o dropdown
const MONTHS = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
const monthIdx = (lab) => MONTHS.indexOf(String(lab || "").slice(0,3).toUpperCase());

export default function ComercialDashboard() {
  const url =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQWTlRgOnM1iBoBqn7XXNy9J9xTQr_Dtpe7Rt9H6MUEcPI2N0bFIcM1WFEr00JaOx9DWSBK8HdD9kvL/pub?gid=1245651258&single=true&output=csv";

  const {
    loading,
    valorTotalGeral,
    valorPorMes,
    quantidadePorProduto,
    pesoPorProduto,
    clientesGeral,
    produtosPorMesFlat,
    segmentosPorMesFlat,
    // novos (ver patch do hook que te passei)
    margemPorProduto = [],
    margemPorCliente = [],
  } = useDataComercial(url);

  // accordions
  const [openClientes,  setOpenClientes]  = useState(false);
  const [openProdutos,  setOpenProdutos]  = useState(false);
  const [openSegmentos, setOpenSegmentos] = useState(false);

  // ----- filtros de mês (Produtos e Segmentos)
  const monthOptionsProd = useMemo(() => {
    const set = new Set(produtosPorMesFlat.map(x => x.label));
    return ["Todos", ...[...set].sort((a,b)=>monthIdx(a)-monthIdx(b))];
  }, [produtosPorMesFlat]);

  const monthOptionsSeg = useMemo(() => {
    const set = new Set(segmentosPorMesFlat.map(x => x.label));
    return ["Todos", ...[...set].sort((a,b)=>monthIdx(a)-monthIdx(b))];
  }, [segmentosPorMesFlat]);

  const [mesProd, setMesProd] = useState("Todos");
  const [mesSeg,  setMesSeg]  = useState("Todos");

  const produtosFiltrados  = useMemo(
    () => (mesProd === "Todos" ? produtosPorMesFlat
                               : produtosPorMesFlat.filter(r => r.label === mesProd)),
    [produtosPorMesFlat, mesProd]
  );
  const segmentosFiltrados = useMemo(
    () => (mesSeg  === "Todos" ? segmentosPorMesFlat
                               : segmentosPorMesFlat.filter(r => r.label === mesSeg)),
    [segmentosPorMesFlat, mesSeg]
  );

  // ----- filtro de cliente (NOVO)
  const clienteOptions = useMemo(() => {
    const set = new Set(clientesGeral.map(x => x.cliente));
    return ["Todos", ...[...set].sort((a, b) => a.localeCompare(b))];
  }, [clientesGeral]);

  const [clienteFiltro, setClienteFiltro] = useState("Todos");

  const clientesFiltrados = useMemo(() => {
    if (clienteFiltro === "Todos") return clientesGeral;
    return clientesGeral.filter(c => c.cliente === clienteFiltro);
  }, [clientesGeral, clienteFiltro]);

  // --- médias para os cards novos
  const margemMediaProduto = useMemo(() => {
    if (!margemPorProduto.length) return 0;
    const s = margemPorProduto.reduce((acc, r) => acc + (Number(r.valor) || 0), 0);
    return s / margemPorProduto.length;
  }, [margemPorProduto]);

  const margemMediaCliente = useMemo(() => {
    if (!margemPorCliente.length) return 0;
    const s = margemPorCliente.reduce((acc, r) => acc + (Number(r.valor) || 0), 0);
    return s / margemPorCliente.length;
  }, [margemPorCliente]);

  if (loading) {
    return (
      <div className="cd__page">
        <div className="cd__loading">Carregando…</div>
      </div>
    );
  }

  return (
    <div className="cd__page">
      <header className="cd__header">
        <h1 className="cd__title">Comercial — Dashboard</h1>
        <p className="cd__subtitle">Cliente | Produto | Segmento | Vendas por Mês | Valor Total de Vendas</p>
      </header>

      {/* KPIs */}
      <section className="cd__kpis">
        <div className="cd__card">
          <span className="cd__cardLabel">Valor Total Vendido</span>
          <span className="cd__cardValue">{fmtBRL(valorTotalGeral)}</span>
        </div>
        <div className="cd__card">
          <span className="cd__cardLabel">Média Mensal</span>
          <span className="cd__cardValue">
            {fmtBRL(
              (valorPorMes?.reduce((s, x) => s + (x.valor || 0), 0) || 0) /
              Math.max(1, valorPorMes?.length || 0)
            )}
          </span>
        </div>
      </section>

      {/* Novo quadro: Margens */}
      <section className="cd__kpis">
        <div className="cd__card">
          <span className="cd__cardLabel">Margem média por produto</span>
          <span className="cd__cardValue">{fmtPct(margemMediaProduto)}</span>
          {!margemPorProduto.length && <span className="cd__cardHint">Sem dados</span>}
        </div>
        <div className="cd__card">
          <span className="cd__cardLabel">Margem média por cliente</span>
          <span className="cd__cardValue">{fmtPct(margemMediaCliente)}</span>
          {!margemPorCliente.length && <span className="cd__cardHint">Sem dados</span>}
        </div>
      </section>

      {/* Valor por mês (R$) */}
      <section className="cd__panel">
        <div className="cd__panelHeader">
          <h2 className="cd__h2">Valor vendido por mês</h2>
        </div>
        <div className="cd__chartWrap">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={valorPorMes}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip formatter={(v) => fmtBRL(v)} />
              <Legend />
              <Bar dataKey="valor" name="Valor (R$)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Quantidade por produto (geral) */}
      <section className="cd__panel">
        <div className="cd__panelHeader">
          <h2 className="cd__h2">Quantidade vendida por produto - geral</h2>
        </div>
        <div className="cd__chartWrap">
          <ResponsiveContainer width="100%" height={360}>
            <BarChart
              data={quantidadePorProduto.slice(0, 20)}
              margin={{ top: 10, right: 10, bottom: 60, left: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="produto" angle={-40} textAnchor="end" interval={0} height={80} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="qtd" name="Quantidade (UN)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Peso por produto (geral) */}
      <section className="cd__panel">
        <div className="cd__panelHeader">
          <h2 className="cd__h2">Peso vendido por produto (kg) — geral</h2>
        </div>
        <div className="cd__chartWrap">
          <ResponsiveContainer width="100%" height={360}>
            <BarChart
              data={pesoPorProduto.slice(0, 20)}
              margin={{ top: 10, right: 10, bottom: 60, left: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="produto" angle={-40} textAnchor="end" interval={0} height={80} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="kg" name="Peso (kg)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Clientes — accordion (com filtro) */}
      <section className="cd__panel">
        <button
          type="button"
          className="cd__accordionBtn"
          onClick={() => setOpenClientes(v => !v)}
          aria-expanded={openClientes}
        >
          <h2 className="cd__h2">Clientes — geral </h2>
          <span className={`cd__chev ${openClientes ? "open" : ""}`} aria-hidden>▾</span>
        </button>

        {openClientes && (
          <>
            {/* filtro de cliente */}
            <div className="cd__panelFilters">
              <label className="cd__filterLabel">
                Cliente:
                <select
                  className="cd__select"
                  value={clienteFiltro}
                  onChange={(e) => setClienteFiltro(e.target.value)}
                >
                  {clienteOptions.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="cd__tableWrap">
              {clientesFiltrados.length === 0 ? (
                <div className="cd__empty">Sem dados para o cliente selecionado.</div>
              ) : (
                <table className="cd__table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th className="cd__thRight">Média (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientesFiltrados.map((r, i) => (
                      <tr key={i}>
                        <td>{r.cliente}</td>
                        <td className="cd__tdRight">{fmtPct(r.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </section>

      {/* Produto por mês — accordion + filtro */}
      <section className="cd__panel">
        <button
          type="button"
          className="cd__accordionBtn"
          onClick={() => setOpenProdutos(v => !v)}
          aria-expanded={openProdutos}
        >
          <h2 className="cd__h2">Produto por mês </h2>
          <span className={`cd__chev ${openProdutos ? "open" : ""}`} aria-hidden>▾</span>
        </button>

        {openProdutos && (
          <>
            <div className="cd__panelFilters">
              <label className="cd__filterLabel">
                Mês:
                <select
                  className="cd__select"
                  value={mesProd}
                  onChange={(e) => setMesProd(e.target.value)}
                >
                  {monthOptionsProd.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="cd__tableWrap">
              {produtosFiltrados.length === 0 ? (
                <div className="cd__empty">
                  Sem dados para o mês selecionado.
                </div>
              ) : (
                <table className="cd__table">
                  <thead>
                    <tr>
                      <th>Mês</th>
                      <th>Produto</th>
                      <th className="cd__thRight">Média (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {produtosFiltrados.map((r, i) => (
                      <tr key={i}>
                        <td>{r.label}</td>
                        <td>{r.produto}</td>
                        <td className="cd__tdRight">{fmtPct(r.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </section>

      {/* Segmento por mês — accordion + filtro */}
      <section className="cd__panel">
        <button
          type="button"
          className="cd__accordionBtn"
          onClick={() => setOpenSegmentos(v => !v)}
          aria-expanded={openSegmentos}
        >
          <h2 className="cd__h2">Segmento por mês</h2>
          <span className={`cd__chev ${openSegmentos ? "open" : ""}`} aria-hidden>▾</span>
        </button>

        {openSegmentos && (
          <>
            <div className="cd__panelFilters">
              <label className="cd__filterLabel">
                Mês:
                <select
                  className="cd__select"
                  value={mesSeg}
                  onChange={(e) => setMesSeg(e.target.value)}
                >
                  {monthOptionsSeg.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="cd__tableWrap">
              {segmentosFiltrados.length === 0 ? (
                <div className="cd__empty">
                  Sem dados para o mês selecionado.
                </div>
              ) : (
                <table className="cd__table">
                  <thead>
                    <tr>
                      <th>Mês</th>
                      <th>Segmento</th>
                      <th className="cd__thRight">Média (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {segmentosFiltrados.map((r, i) => (
                      <tr key={i}>
                        <td>{r.label}</td>
                        <td>{r.segmento}</td>
                        <td className="cd__tdRight">{fmtPct(r.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </section>

      {/* (OPCIONAL) Painel com 2 gráficos de Margem */}
      <section className="cd__panel">
        <div className="cd__panelHeader">
          <h2 className="cd__h2">Margem (%) — Top 20</h2>
        </div>
        <div className="cd__twoCols">
          <div className="cd__chartWrap">
            <ResponsiveContainer width="100%" height={360}>
              <h2>Produtos</h2>
              <BarChart
                data={margemPorProduto.slice(0, 20)}
                margin={{ top: 10, right: 10, bottom: 60, left: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="produto" angle={-40} textAnchor="end" interval={0} height={80} />
                <YAxis />
                <Tooltip formatter={(v) => fmtPct(v)} />
                <Legend />
                <Bar dataKey="valor" name="Margem (%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="cd__chartWrap">
            <ResponsiveContainer width="100%" height={360}>
              <h2>Clientes</h2>
              <BarChart
                data={margemPorCliente.slice(0, 20)}
                margin={{ top: 10, right: 10, bottom: 60, left: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="cliente" angle={-40} textAnchor="end" interval={0} height={80} />
                <YAxis />
                <Tooltip formatter={(v) => fmtPct(v)} />
                <Legend />
                <Bar dataKey="valor" name="Margem (%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </div>
  );
}
