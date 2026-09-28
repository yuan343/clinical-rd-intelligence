"use client";
import {useEffect,useMemo,useState} from "react";

export default function Home(){
  const [q,setQ]=useState("PD-L1 VEGF"),[active,setActive]=useState("PD-L1 VEGF");
  const [mode,setMode]=useState("auto"),[data,setData]=useState(null),[loading,setLoading]=useState(true);
  const [tab,setTab]=useState("radar");
  useEffect(()=>{(async()=>{setLoading(true);try{
    const r=await fetch(`/api/search?q=${encodeURIComponent(active)}&mode=${mode}`,{cache:"no-store"});
    setData(await r.json());
  }finally{setLoading(false)}})()},[active,mode]);
  function submit(e){e.preventDefault();if(q.trim())setActive(q.trim())}
  return <div className="shell">
    <aside><div className="brand">研发情报工作台<small>Live BD & Combination Intelligence</small></div>
      {[["radar","实时情报雷达"],["combo","组合机会池"],["trials","临床项目"],["papers","文献证据"],["sources","信息来源"]].map(([id,l])=>
        <button className={"nav "+(tab===id?"active":"")} key={id} onClick={()=>setTab(id)}>{l}</button>)}
    </aside>
    <main>
      <div className="top">
        <div><h1>{tab==="combo"?"组合机会池":tab==="trials"?"临床项目":tab==="papers"?"文献证据":tab==="sources"?"信息来源":"Signal → Combination"}</h1>
          <div className="muted">当前检索：{active}{data&&<> · 系统采用：<b>{data.selectedMode==="condition"?"适应症精确检索":"分子/靶点全文检索"}</b></>}</div>
        </div>
        <form className="search" onSubmit={submit}>
          <select value={mode} onChange={e=>setMode(e.target.value)}>
            <option value="auto">自动判断</option><option value="condition">适应症</option><option value="term">分子 / 靶点</option>
          </select>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="SLE / NSCLC / PD-L1 VEGF / CD20"/>
          <button>实时搜索</button>
        </form>
      </div>
      {loading?<div className="card">正在读取实时数据…</div>:data&&<>
        {tab==="radar"&&<Radar data={data}/>}
        {tab==="combo"&&<Combos data={data}/>}
        {tab==="trials"&&<Trials trials={data.trials}/>}
        {tab==="papers"&&<Papers papers={data.publications}/>}
        {tab==="sources"&&<Sources data={data}/>}
      </>}
    </main>
  </div>
}

function Radar({data}){
  const risk=data.trials.filter(t=>t.signalType==="RISK");
  return <>
    <div className="metrics">
      <Metric n={data.trials.length} l="高相关临床项目"/><Metric n={data.combinations.length} l="组合候选"/>
      <Metric n={risk.length} l="失败/暂停信号"/><Metric n={data.publications.length} l="PubMed线索"/>
    </div>
    <div className="grid2 section">
      <section className="card"><h2>检索准确性</h2>
        <p>系统同时比较“适应症专用检索”和“全文检索”。疾病查询存在明确匹配时，自动优先适应症结果。</p>
        <div className="diag">适应症命中 {data.diagnostics.conditionHits} · 强匹配 {data.diagnostics.strongConditionHits} · 全文命中 {data.diagnostics.termHits}</div>
      </section>
      <section className="card dark"><h2>核心逻辑</h2><p>新 Signal → 找到真正问题 → 找到可补偿机制 → 识别真实联合 → 查支持证据与反例 → 决定优先跟踪。</p></section>
    </div>
    <section className="card section"><h2>高价值 Signal</h2>
      <table><thead><tr><th>项目</th><th>适应症</th><th>状态</th><th>干预</th><th>一手来源</th></tr></thead>
      <tbody>{data.trials.slice(0,10).map(t=><tr key={t.nctId}><td><b>{t.title}</b><div className="small">{t.nctId}</div></td>
        <td>{t.conditions.join("；")}</td><td>{t.status}</td><td>{t.interventions.join(" + ")}</td>
        <td><a href={t.url} target="_blank">ClinicalTrials ↗</a></td></tr>)}</tbody></table>
    </section>
  </>
}
function comboHref(data,c){
  return `/combo?a=${encodeURIComponent(c.a)}&b=${encodeURIComponent(c.b)}&q=${encodeURIComponent(data.query)}`;
}
function Combos({data}){
  return <section className="card"><h2>组合机会池</h2>
    <div className="note">组合名称可以点击进入详情。详情页会再次核对真实联合试验，并区分“同一试验出现”与“同一治疗臂联合”。</div>
    <table><thead><tr><th>组合</th><th>涉及适应症</th><th>Phase</th><th>临床项目</th><th>活跃</th><th>失败/暂停</th><th>近期更新</th><th>证据</th></tr></thead>
    <tbody>{data.combinations.map(c=><tr key={c.combo}>
      <td><a className="comboLink" href={comboHref(data,c)}><b>{c.combo}</b> ↗</a></td>
      <td>{c.indications.slice(0,3).join("；")||"-"}</td><td>{c.phases.join("；")||"-"}</td>
      <td>{c.trials}</td><td>{c.active}</td><td>{c.risk}</td><td>{c.recent}</td><td>{c.evidence}</td>
    </tr>)}</tbody></table>
  </section>
}
function Trials({trials}){return <section className="card"><h2>ClinicalTrials.gov</h2><table><thead><tr><th>NCT</th><th>项目</th><th>适应症</th><th>Phase</th><th>Status</th><th>干预</th></tr></thead><tbody>
  {trials.map(t=><tr key={t.nctId}><td><a href={t.url} target="_blank">{t.nctId}</a></td><td>{t.title}</td><td>{t.conditions.join("；")}</td><td>{t.phase}</td><td>{t.status}</td><td>{t.interventions.join(" + ")}</td></tr>)}
</tbody></table></section>}
function Papers({papers}){return <section className="card"><h2>PubMed</h2>{papers.map(p=><div className="paper" key={p.pmid}><a href={p.url} target="_blank"><b>{p.title}</b></a><div className="small">{p.journal} · {p.pubdate} · PMID {p.pmid}</div></div>)}</section>}
function Sources({data}){return <section className="card"><h2>信息来源</h2><table><tbody>
  <tr><td>ClinicalTrials.gov</td><td>实时</td><td>试验、适应症、状态、干预、治疗臂</td></tr>
  <tr><td>PubMed</td><td>实时</td><td>机制与临床文献线索</td></tr>
  <tr><td>更新时间</td><td colSpan="2">{data.generatedAt}</td></tr>
</tbody></table></section>}
function Metric({n,l}){return <div className="metric"><div className="n">{n}</div><div className="muted">{l}</div></div>}
