export const dynamic = "force-dynamic";

function clean(x=""){return String(x||"").trim()}
function norm(x=""){return clean(x).toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ")}
function containsName(list,name){
  const n=norm(name);
  return (list||[]).some(x=>norm(x)===n || norm(x).includes(n) || n.includes(norm(x)));
}
function classify(study){
  const p=study.protocolSection||{};
  const id=p.identificationModule||{}, s=p.statusModule||{}, d=p.designModule||{};
  const c=p.conditionsModule||{}, ai=p.armsInterventionsModule||{}, sp=p.sponsorCollaboratorsModule||{};
  const arms=(ai.armGroups||[]).map(a=>({
    label:a.label||"",type:a.type||"",description:a.description||"",
    interventionNames:a.interventionNames||[]
  }));
  return {
    nctId:id.nctId,title:id.briefTitle||id.officialTitle||id.nctId,
    status:s.overallStatus||"UNKNOWN",phase:(d.phases||[]).join(", ")||"NA",
    sponsor:sp.leadSponsor?.name||"Unknown",conditions:c.conditions||[],
    interventions:(ai.interventions||[]).map(x=>x.name).filter(Boolean),
    arms,updated:s.lastUpdatePostDateStruct?.date||"",
    url:id.nctId?`https://clinicaltrials.gov/study/${id.nctId}`:null
  };
}
async function trials(a,b,query){
  const u=new URL("https://clinicaltrials.gov/api/v2/studies");
  u.searchParams.set("query.term",`${a} ${b} ${query||""}`.trim());
  u.searchParams.set("pageSize","60");u.searchParams.set("format","json");
  const r=await fetch(u,{cache:"no-store"}); if(!r.ok) throw new Error(`ClinicalTrials ${r.status}`);
  const j=await r.json();
  return (j.studies||[]).map(classify).filter(t=>containsName(t.interventions,a)&&containsName(t.interventions,b));
}
async function papers(a,b){
  const q=`"${a}" AND "${b}"`;
  const u=new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi");
  u.searchParams.set("db","pubmed");u.searchParams.set("term",q);u.searchParams.set("retmode","json");
  u.searchParams.set("retmax","12");u.searchParams.set("sort","pub date");
  const r=await fetch(u,{cache:"no-store"}); if(!r.ok) return [];
  const j=await r.json(); const ids=j.esearchresult?.idlist||[]; if(!ids.length) return [];
  const s=new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi");
  s.searchParams.set("db","pubmed");s.searchParams.set("id",ids.join(","));s.searchParams.set("retmode","json");
  const rr=await fetch(s,{cache:"no-store"}); const jj=await rr.json();
  return ids.map(id=>{const x=jj.result?.[id]||{};return{
    pmid:id,title:x.title||"Untitled",journal:x.fulljournalname||x.source||"",pubdate:x.pubdate||"",
    url:`https://pubmed.ncbi.nlm.nih.gov/${id}/`
  }});
}
export async function GET(request){
  const {searchParams}=new URL(request.url);
  const a=clean(searchParams.get("a")),b=clean(searchParams.get("b")),q=clean(searchParams.get("q"));
  if(!a||!b) return Response.json({error:"a and b are required"},{status:400});
  const [ts,ps]=await Promise.all([trials(a,b,q),papers(a,b)]);
  const sameArm=ts.filter(t=>t.arms.some(arm=>containsName(arm.interventionNames,a)&&containsName(arm.interventionNames,b)));
  const risk=ts.filter(t=>["TERMINATED","WITHDRAWN","SUSPENDED"].includes(t.status));
  const inds=[...new Set(ts.flatMap(t=>t.conditions))];
  return Response.json({
    a,b,query:q,generatedAt:new Date().toISOString(),
    trials:ts,sameArmTrials:sameArm,riskTrials:risk,publications:ps,indications:inds,
    evidence:{
      totalTrials:ts.length,
      sameArmTrials:sameArm.length,
      activeTrials:ts.filter(t=>!["TERMINATED","WITHDRAWN","SUSPENDED"].includes(t.status)).length,
      riskTrials:risk.length
    }
  });
}