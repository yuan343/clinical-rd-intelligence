"use client";

import { useEffect, useMemo, useState } from "react";

const typeClass = {
  RISK: "red",
  NEW: "blue",
  ACTIVE: "green",
  READOUT: "amber"
};

export default function Home() {
  const [query, setQuery] = useState("PD-L1 VEGF");
  const [activeQuery, setActiveQuery] = useState("PD-L1 VEGF");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("radar");

  async function load(q) {
    setLoading(true);
    try {
      const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      const j = await r.json();
      setData(j);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(activeQuery); }, [activeQuery]);

  const priorityTrials = useMemo(() => {
    if (!data) return [];
    return [...data.trials]
      .sort((a,b) => {
        const rank = {RISK:0, NEW:1, READOUT:2, ACTIVE:3};
        return (rank[a.signalType] ?? 9) - (rank[b.signalType] ?? 9);
      })
      .slice(0,8);
  }, [data]);

  function search(e) {
    e.preventDefault();
    if (query.trim()) setActiveQuery(query.trim());
  }

  return (
    <div className="shell">
      <aside>
        <div className="brand">研发情报工作台<small>Live BD & Combination Intelligence</small></div>
        {[
          ["radar","实时情报雷达"],
          ["combo","组合机会池"],
          ["trials","临床项目"],
          ["papers","文献证据"],
          ["sources","信息来源"]
        ].map(([id,label]) => (
          <button key={id} className={tab===id ? "nav active" : "nav"} onClick={()=>setTab(id)}>{label}</button>
        ))}
      </aside>

      <main>
        <div className="top">
          <div>
            <h1>{tab==="radar" ? "Signal → Combination" : {
              combo:"组合机会池", trials:"临床项目", papers:"文献证据", sources:"信息来源"
            }[tab]}</h1>
            <div className="muted">实时搜索公开临床试验与学术元数据；当前检索：{activeQuery}</div>
          </div>
          <form className="search" onSubmit={search}>
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="例如：PD-L1 VEGF / CD20 CD19 / TIGIT NSCLC"/>
            <button>实时搜索</button>
          </form>
        </div>

        {loading && <div className="loading">正在读取 ClinicalTrials.gov、PubMed、Crossref…</div>}
        {!loading && data && (
          <>
            {data.errors?.length > 0 && <div className="warning">部分数据源暂时不可用：{data.errors.join("；")}</div>}

            {tab==="radar" && <Radar data={data} priorityTrials={priorityTrials}/>}
            {tab==="combo" && <Combos data={data}/>}
            {tab==="trials" && <Trials trials={data.trials}/>}
            {tab==="papers" && <Papers pubs={data.publications}/>}
            {tab==="sources" && <Sources data={data}/>}
          </>
        )}
      </main>
    </div>
  );
}

function Radar({data, priorityTrials}) {
  const topCombos = data.insights?.combos || [];
  const risky = data.insights?.riskySingles || [];
  return <>
    <div className="metrics">
      <Metric n={data.trials.length} label="实时临床试验"/>
      <Metric n={data.publications.pubmed.length} label="PubMed结果"/>
      <Metric n={topCombos.length} label="真实联合候选"/>
      <Metric n={risky.length} label="需拆解失败信号"/>
    </div>

    <div className="grid2 section">
      <section className="card">
        <h2>最新/高价值 Signal</h2>
        <div className="stack">
          {priorityTrials.slice(0,5).map(t => <article className="signal" key={t.nctId}>
            <div className="row">
              <b>{t.title}</b><span className={`pill ${typeClass[t.signalType]}`}>{t.signalLabel}</span>
            </div>
            <div className="small">{t.nctId} · {t.phase} · {t.status} · 更新 {t.updated || "未知"}</div>
            <p><b>为什么值得看：</b>{t.signalType==="RISK"
              ? "出现终止/暂停/撤回信号，需判断失败的是机制、分子、人群、剂量还是项目战略。"
              : t.hasCombo
              ? "属于真实联合临床开发，可用于验证组合逻辑及竞争格局。"
              : "近期项目状态/记录可作为单药开发与后续组合判断的输入。"
            }</p>
            {t.url && <a href={t.url} target="_blank">查看一手试验记录 ↗</a>}
          </article>)}
        </div>
      </section>

      <section className="card dark">
        <h2>今天优先回答</h2>
        <p>1. 哪个单药/项目暴露出了真正的限制因素？</p>
        <p>2. 失败是否真的否定靶点机制？</p>
        <p>3. 哪个B能直接补A的短板？</p>
        <p>4. 哪些A+B已经进入真实临床开发？</p>
        <p>5. 哪个组合既有支持证据，也有需要警惕的反例？</p>
      </section>
    </div>

    <section className="card section">
      <h2>Signal → Problem → Potential Combination → Evidence → Priority</h2>
      <div className="logic">
        <div className="node"><b>Signal</b><p>{risky[0]?.molecule || "检索项目"} 出现失败/暂停或疗效限制信号。</p></div>
        <div className="arrow">→</div>
        <div className="node"><b>Problem</b><p>先区分机制失败、分子失败、暴露/安全窗、人群、biomarker、终点或战略原因。</p></div>
        <div className="arrow">→</div>
        <div className="node">
          <b>Potential Combination</b>
          {(topCombos.slice(0,3)).map(c=><div className="mini" key={c.combo}><strong>{c.combo}</strong><br/>{c.evidence}</div>)}
          {!topCombos.length && <p>当前检索未发现足够联合项目，需扩大关键词。</p>}
        </div>
        <div className="arrow">→</div>
        <div className="node"><b>Priority</b><p>{topCombos[0] ? `${topCombos[0].combo}：当前检索中临床开发证据最多，优先进一步拆解机制、适应症与反例。` : "等待真实联合证据。"}</p></div>
      </div>
    </section>

    <div className="grid2 section">
      <section className="card">
        <h2>One Signal, Multiple Opportunities</h2>
        <table>
          <thead><tr><th>组合</th><th>试验数</th><th>活跃/非风险</th><th>风险记录</th><th>解释</th></tr></thead>
          <tbody>{topCombos.slice(0,5).map(c=><tr key={c.combo}>
            <td><b>{c.combo}</b></td><td>{c.trials}</td><td>{c.active}</td><td>{c.risk}</td><td>{c.interpretation}</td>
          </tr>)}</tbody>
        </table>
      </section>
      <section className="card">
        <h2>失败信号待拆解</h2>
        {risky.length ? risky.map(x=><div className="insight" key={x.molecule}>
          <b>{x.molecule}</b><p>{x.issue}</p><div className="small">{x.nextQuestion}</div>
        </div>) : <div className="muted">本次检索没有明显失败/暂停单药信号。</div>}
      </section>
    </div>
  </>;
}

function Combos({data}) {
  const combos = data.insights?.combos || [];
  return <section className="card">
    <h2>从真实试验共现关系得到的联合候选</h2>
    <div className="note">这里的“优先级”不是医学结论，而是基于本次检索中的联合试验数量、活跃状态和近期更新做的情报排序；后续还需要机制与临床结果层验证。</div>
    <table>
      <thead><tr><th>组合</th><th>临床项目</th><th>活跃</th><th>失败/暂停</th><th>近期更新</th><th>证据判断</th></tr></thead>
      <tbody>{combos.map(c=><tr key={c.combo}><td><b>{c.combo}</b></td><td>{c.trials}</td><td>{c.active}</td><td>{c.risk}</td><td>{c.recent}</td><td>{c.evidence}</td></tr>)}</tbody>
    </table>
  </section>;
}

function Trials({trials}) {
  return <section className="card">
    <h2>ClinicalTrials.gov 实时结果</h2>
    <table>
      <thead><tr><th>NCT</th><th>项目</th><th>Phase</th><th>Status</th><th>干预</th><th>更新</th></tr></thead>
      <tbody>{trials.map(t=><tr key={t.nctId}>
        <td><a href={t.url} target="_blank">{t.nctId}</a></td><td>{t.title}</td><td>{t.phase}</td><td>{t.status}</td><td>{t.interventions.join(" + ") || "-"}</td><td>{t.updated || "-"}</td>
      </tr>)}</tbody>
    </table>
  </section>;
}

function Papers({pubs}) {
  return <div className="grid2">
    <section className="card"><h2>PubMed</h2>{pubs.pubmed.map(p=><div className="paper" key={p.pmid}><a href={p.url} target="_blank"><b>{p.title}</b></a><div className="small">{p.journal} · {p.pubdate} · PMID {p.pmid}</div></div>)}</section>
    <section className="card"><h2>Crossref</h2>{pubs.crossref.map((p,i)=><div className="paper" key={p.doi || i}><a href={p.url} target="_blank"><b>{p.title}</b></a><div className="small">{p.journal} · {p.published} {p.doi ? `· ${p.doi}` : ""}</div></div>)}</section>
  </div>;
}

function Sources({data}) {
  return <>
    <section className="card">
      <h2>当前已真实接入</h2>
      <table><thead><tr><th>来源</th><th>状态</th><th>本次结果</th><th>用途</th></tr></thead>
      <tbody>
        <tr><td>ClinicalTrials.gov</td><td><span className="pill green">LIVE</span></td><td>{data.sources.clinicalTrials.count}</td><td>试验状态、阶段、干预、联合关系、更新时间</td></tr>
        <tr><td>PubMed</td><td><span className="pill green">LIVE</span></td><td>{data.sources.pubmed.count}</td><td>学术文献与机制/临床证据线索</td></tr>
        <tr><td>Crossref</td><td><span className="pill green">LIVE</span></td><td>{data.sources.crossref.count}</td><td>最新出版物元数据与DOI</td></tr>
      </tbody></table>
    </section>
    <section className="card section">
      <h2>下一层接入</h2>
      <p>公司官网 / Pipeline / Press Release：项目终止、里程碑、读出时间、License-in/out。</p>
      <p>ASCO / ESMO / AACR / WCLC：会议摘要与首次临床数据。</p>
      <p>FDA / EMA / NMPA / CDE：监管进展和安全性信号。</p>
      <p>BD交易与行业新闻：合作、并购、资产交易与竞争格局。</p>
    </section>
    <div className="small section">本次刷新时间：{data.generatedAt}</div>
  </>;
}

function Metric({n,label}) {
  return <div className="metric"><div className="n">{n}</div><div className="muted">{label}</div></div>
}
