"use client";
import {useEffect,useState} from "react";
import {useSearchParams} from "next/navigation";

export default function ComboPage(){
  const sp=useSearchParams(),a=sp.get("a")||"",b=sp.get("b")||"",q=sp.get("q")||"";
  const [data,setData]=useState(null),[loading,setLoading]=useState(true);
  useEffect(()=>{(async()=>{setLoading(true);try{
    const r=await fetch(`/api/combo?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}&q=${encodeURIComponent(q)}`,{cache:"no-store"});
    setData(await r.json());
  }finally{setLoading(false)}})()},[a,b,q]);
  if(loading)return <main className="standalone"><div className="card">正在核对真实组合证据…</div></main>;
  if(!data||data.error)return <main className="standalone"><div className="card">无法加载组合详情。</div></main>;
  return <main className="standalone">
    <a href="/" className="back">← 返回工作台</a>
    <div className="comboHero"><div><div className="eyebrow">COMBINATION DETAIL</div><h1>{a} + {b}</h1>
      <div className="muted">来源于实时 ClinicalTrials.gov + PubMed；原检索：{q||"—"}</div></div>
      <div className="metrics compact"><Metric n={data.evidence.totalTrials} l="真实共现试验"/><Metric n={data.evidence.sameArmTrials} l="同治疗臂明确联合"/><Metric n={data.evidence.riskTrials} l="失败/暂停"/><Metric n={data.publications.length} l="PubMed线索"/></div>
    </div>

    <section className="card section"><h2>组合真实性核对</h2>
      <p><b>同一治疗臂联合：</b>{data.evidence.sameArmTrials} 个。这个数字比“同一个试验中同时出现A和B”更能说明真实联合给药。</p>
      <p><b>当前涉及适应症：</b>{data.indications.join("；")||"暂无"}</p>
      <div className="note">下一阶段可继续加入 A 单药短板、B 的补偿机制、前临床证据及关键疗效数据，实现完整的“为什么A+B可能更好”。</div>
    </section>

    <section className="card section"><h2>真实临床项目</h2>
      <table><thead><tr><th>NCT</th><th>项目</th><th>适应症</th><th>Phase</th><th>Status</th><th>同臂联合</th><th>来源</th></tr></thead>
      <tbody>{data.trials.map(t=>{
        const same=t.arms.some(arm=>{
          const x=(arm.interventionNames||[]).join(" ").toLowerCase();
          return x.includes(a.toLowerCase())&&x.includes(b.toLowerCase());
        });
        return <tr key={t.nctId}><td>{t.nctId}</td><td>{t.title}</td><td>{t.conditions.join("；")}</td><td>{t.phase}</td><td>{t.status}</td><td>{same?"是":"未确认"}</td><td><a href={t.url} target="_blank">查看记录 ↗</a></td></tr>
      })}</tbody></table>
    </section>

    {data.riskTrials.length>0&&<section className="card section"><h2>失败 / 暂停反例</h2>
      {data.riskTrials.map(t=><div className="riskItem" key={t.nctId}><b>{t.nctId} · {t.title}</b><div>{t.status} · {t.conditions.join("；")}</div><a href={t.url} target="_blank">查看失败项目一手记录 ↗</a></div>)}
    </section>}

    <section className="card section"><h2>PubMed证据线索</h2>
      {data.publications.length?data.publications.map(p=><div className="paper" key={p.pmid}><a href={p.url} target="_blank"><b>{p.title}</b></a><div className="small">{p.journal} · {p.pubdate} · PMID {p.pmid}</div></div>):<div className="muted">当前未检索到直接同时包含两种干预名称的PubMed结果。</div>}
    </section>
  </main>
}
function Metric({n,l}){return <div className="metric"><div className="n">{n}</div><div className="muted">{l}</div></div>}
