export const dynamic = "force-dynamic";

const RISK = new Set(["TERMINATED","WITHDRAWN","SUSPENDED"]);

function clean(x=""){ return String(x || "").trim(); }
function norm(x=""){ return clean(x).toLowerCase().replace(/[^\p{L}\p{N}]+/gu," "); }
function daysAgo(s){
  if(!s) return 99999;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? 99999 : Math.floor((Date.now()-d.getTime())/86400000);
}
function exactTokens(q){ return norm(q).split(/\s+/).filter(Boolean); }

function classify(study){
  const p = study.protocolSection || {};
  const id = p.identificationModule || {};
  const s = p.statusModule || {};
  const d = p.designModule || {};
  const c = p.conditionsModule || {};
  const ai = p.armsInterventionsModule || {};
  const sponsor = p.sponsorCollaboratorsModule || {};
  const interventions = (ai.interventions || []).map(x=>clean(x.name)).filter(Boolean);
  const conditions = (c.conditions || []).map(clean).filter(Boolean);
  const aliases = (c.keywords || []).map(clean).filter(Boolean);
  const updated = s.lastUpdatePostDateStruct?.date || "";
  const status = s.overallStatus || "UNKNOWN";
  const phases = d.phases || [];

  let signalType="ACTIVE", signalLabel="持续开发";
  if(RISK.has(status)){ signalType="RISK"; signalLabel="失败/暂停信号"; }
  else if(status==="COMPLETED"){ signalType="READOUT"; signalLabel="已完成，关注结果"; }
  else if(daysAgo(updated)<=90){ signalType="NEW"; signalLabel="近期更新"; }

  return {
    nctId:id.nctId,
    title:id.briefTitle || id.officialTitle || id.nctId,
    status, phase:phases.join(", ") || "NA",
    sponsor:sponsor.leadSponsor?.name || "Unknown",
    conditions, aliases, interventions, updated,
    signalType, signalLabel,
    url:id.nctId ? `https://clinicaltrials.gov/study/${id.nctId}` : null
  };
}

function conditionRelevance(t,q){
  const nq = norm(q);
  const toks = exactTokens(q);
  const hay = norm([...(t.conditions||[]), ...(t.aliases||[])].join(" "));
  if(!hay) return 0;
  if(hay.includes(nq)) return 100;
  let s=0;
  for(const tok of toks) if(tok.length>1 && hay.includes(tok)) s+=15;
  return s;
}

function generalRelevance(t,q){
  const toks = exactTokens(q);
  const hay = norm([t.title, ...(t.conditions||[]), ...(t.aliases||[]), ...(t.interventions||[]), t.sponsor].join(" "));
  let s=0;
  for(const tok of toks) if(tok.length>1 && hay.includes(tok)) s+=10;
  if(norm(t.title).includes(norm(q))) s+=25;
  return s;
}

async function fetchTrials(q, kind="term", pageSize=40){
  const url = new URL("https://clinicaltrials.gov/api/v2/studies");
  url.searchParams.set(kind==="condition" ? "query.cond" : "query.term", q);
  url.searchParams.set("pageSize", String(pageSize));
  url.searchParams.set("format","json");
  const res = await fetch(url,{headers:{Accept:"application/json"},cache:"no-store"});
  if(!res.ok) throw new Error(`ClinicalTrials.gov ${res.status}`);
  const j=await res.json();
  return (j.studies||[]).map(classify);
}

function dedupe(arr){
  const m=new Map();
  for(const x of arr) if(x.nctId && !m.has(x.nctId)) m.set(x.nctId,x);
  return [...m.values()];
}

function buildCombinations(trials){
  const map=new Map();
  for(const t of trials){
    const names=[...new Set((t.interventions||[]).filter(x=>x.length>1))];
    // 避免把拥有很多干预臂的大型比较研究机械组合成大量“伪组合”
    if(names.length<2 || names.length>6) continue;
    for(let i=0;i<names.length;i++){
      for(let j=i+1;j<names.length;j++){
        const pair=[names[i],names[j]].sort();
        const key=pair.join(" + ");
        if(!map.has(key)) map.set(key,{
          combo:key,a:pair[0],b:pair[1],trials:0,active:0,risk:0,recent:0,
          indications:new Set(), phases:new Set(), ncts:[]
        });
        const x=map.get(key);
        x.trials++;
        if(t.signalType==="RISK") x.risk++; else x.active++;
        if(daysAgo(t.updated)<=180) x.recent++;
        (t.conditions||[]).slice(0,4).forEach(v=>x.indications.add(v));
        if(t.phase && t.phase!=="NA") x.phases.add(t.phase);
        if(x.ncts.length<5) x.ncts.push(t.nctId);
      }
    }
  }
  return [...map.values()].map(x=>({
    ...x,
    indications:[...x.indications].slice(0,6),
    phases:[...x.phases].slice(0,4),
    score:x.active*3+x.recent*2+x.trials-x.risk*2,
    evidence:x.trials>=5&&x.active>=3 ? "较多临床开发证据" : x.trials>=2 ? "已有多个临床项目" : "早期/有限"
  })).sort((a,b)=>b.score-a.score).slice(0,20);
}

async function pubmed(q){
  const u=new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi");
  u.searchParams.set("db","pubmed");u.searchParams.set("term",q);
  u.searchParams.set("retmode","json");u.searchParams.set("retmax","8");u.searchParams.set("sort","pub date");
  const r=await fetch(u,{cache:"no-store"}); if(!r.ok) throw new Error(`PubMed ${r.status}`);
  const j=await r.json(); const ids=j.esearchresult?.idlist||[]; if(!ids.length) return [];
  const s=new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi");
  s.searchParams.set("db","pubmed");s.searchParams.set("id",ids.join(","));s.searchParams.set("retmode","json");
  const rr=await fetch(s,{cache:"no-store"}); const jj=await rr.json();
  return ids.map(id=>{const x=jj.result?.[id]||{}; return {
    pmid:id,title:x.title||"Untitled",journal:x.fulljournalname||x.source||"",pubdate:x.pubdate||"",
    url:`https://pubmed.ncbi.nlm.nih.gov/${id}/`
  }});
}

export async function GET(request){
  const {searchParams}=new URL(request.url);
  const q=clean(searchParams.get("q")||"PD-L1 VEGF").slice(0,180);
  const mode=searchParams.get("mode")||"auto";

  const tasks = mode==="condition"
    ? [fetchTrials(q,"condition"), Promise.resolve([])]
    : mode==="term"
    ? [Promise.resolve([]), fetchTrials(q,"term")]
    : [fetchTrials(q,"condition"), fetchTrials(q,"term")];

  const [condS,termS,pubS]=await Promise.allSettled([...tasks,pubmed(q)]);
  let cond=condS.status==="fulfilled"?condS.value:[];
  let term=termS.status==="fulfilled"?termS.value:[];
  const papers=pubS.status==="fulfilled"?pubS.value:[];

  cond=cond.map(t=>({...t,relevance:conditionRelevance(t,q)})).sort((a,b)=>b.relevance-a.relevance);
  term=term.map(t=>({...t,relevance:generalRelevance(t,q)})).sort((a,b)=>b.relevance-a.relevance);

  let selectedMode=mode;
  let trials=[];
  if(mode==="condition") trials=cond;
  else if(mode==="term") trials=term;
  else {
    const strongCond=cond.filter(x=>x.relevance>=15);
    // 若疾病专用检索返回明确匹配，则优先使用，避免适应症查询被全文噪声淹没
    if(strongCond.length>=3 || (strongCond.length>0 && strongCond[0].relevance>=100)){
      selectedMode="condition";
      trials=strongCond;
    } else {
      selectedMode="term";
      trials=term;
    }
  }

  trials=dedupe(trials).slice(0,40);

  return Response.json({
    query:q, requestedMode:mode, selectedMode, generatedAt:new Date().toISOString(),
    trials, publications:papers, combinations:buildCombinations(trials),
    diagnostics:{
      conditionHits:cond.length, strongConditionHits:cond.filter(x=>x.relevance>=15).length,
      termHits:term.length
    }
  });
}