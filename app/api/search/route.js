export const dynamic = "force-dynamic";

function safe(v, fallback = "") {
  return v ?? fallback;
}

function recencyDays(dateString) {
  if (!dateString) return 99999;
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return 99999;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function classifyTrial(study) {
  const p = study.protocolSection || {};
  const id = p.identificationModule || {};
  const status = p.statusModule || {};
  const design = p.designModule || {};
  const sponsor = p.sponsorCollaboratorsModule || {};
  const cond = p.conditionsModule || {};
  const ai = p.armsInterventionsModule || {};
  const interventions = (ai.interventions || []).map(x => x.name).filter(Boolean);
  const updated = status.lastUpdatePostDateStruct?.date || "";
  const overall = safe(status.overallStatus, "UNKNOWN");
  const phases = design.phases || [];

  let signalType = "ACTIVE";
  let signalLabel = "持续开发";
  if (["TERMINATED", "WITHDRAWN", "SUSPENDED"].includes(overall)) {
    signalType = "RISK";
    signalLabel = "失败/暂停信号";
  } else if (["COMPLETED"].includes(overall)) {
    signalType = "READOUT";
    signalLabel = "已完成，关注结果";
  } else if (recencyDays(updated) <= 60) {
    signalType = "NEW";
    signalLabel = "近期更新";
  }

  const hasCombo = interventions.length >= 2;
  return {
    nctId: id.nctId,
    title: id.briefTitle || id.officialTitle || id.nctId,
    status: overall,
    phase: phases.join(", ") || "NA",
    sponsor: sponsor.leadSponsor?.name || "Unknown",
    conditions: cond.conditions || [],
    interventions,
    updated,
    signalType,
    signalLabel,
    hasCombo,
    url: id.nctId ? `https://clinicaltrials.gov/study/${id.nctId}` : null
  };
}

function buildCombinationInsights(trials, query) {
  const co = new Map();
  const solo = new Map();

  for (const t of trials) {
    const names = [...new Set(t.interventions || [])];
    for (const n of names) {
      if (!solo.has(n)) solo.set(n, { name: n, trials: 0, risk: 0, active: 0 });
      const x = solo.get(n);
      x.trials += 1;
      if (t.signalType === "RISK") x.risk += 1;
      else x.active += 1;
    }
    if (names.length >= 2) {
      for (let i = 0; i < names.length; i++) {
        for (let j = i + 1; j < names.length; j++) {
          const key = [names[i], names[j]].sort().join(" + ");
          if (!co.has(key)) co.set(key, {
            combo: key,
            trials: 0,
            active: 0,
            risk: 0,
            recent: 0,
            examples: []
          });
          const x = co.get(key);
          x.trials += 1;
          if (t.signalType === "RISK") x.risk += 1;
          else x.active += 1;
          if (recencyDays(t.updated) <= 180) x.recent += 1;
          if (x.examples.length < 3) x.examples.push(t.nctId);
        }
      }
    }
  }

  const combos = [...co.values()]
    .map(x => {
      let score = x.active * 3 + x.recent * 2 + x.trials - x.risk * 2;
      let evidence = "早期/有限";
      if (x.trials >= 5 && x.active >= 3) evidence = "较多临床开发证据";
      else if (x.trials >= 2) evidence = "已有多个临床项目";
      return {
        ...x,
        score,
        evidence,
        interpretation:
          x.risk > 0
            ? "已有联合开发，同时存在失败/暂停反例；需要按适应症、剂量、人群和失败原因拆解。"
            : "存在真实联合临床开发，可进一步核对机制互补、疗效增益和安全性。"
      };
    })
    .sort((a,b) => b.score - a.score)
    .slice(0, 8);

  const riskySingles = [...solo.values()]
    .filter(x => x.risk > 0)
    .sort((a,b) => b.risk - a.risk)
    .slice(0, 6)
    .map(x => ({
      molecule: x.name,
      issue: `在检索结果中出现 ${x.risk} 个终止/暂停/撤回试验记录`,
      nextQuestion: "失败是分子/机制问题，还是人群、剂量、终点或战略原因？"
    }));

  return { query, combos, riskySingles };
}

async function fetchTrials(q) {
  const url = new URL("https://clinicaltrials.gov/api/v2/studies");
  url.searchParams.set("query.term", q);
  url.searchParams.set("pageSize", "25");
  url.searchParams.set("format", "json");

  const res = await fetch(url, {
    headers: { "Accept": "application/json" },
    next: { revalidate: 3600 }
  });
  if (!res.ok) throw new Error(`ClinicalTrials.gov ${res.status}`);
  const json = await res.json();
  return (json.studies || []).map(classifyTrial);
}

async function fetchCrossref(q) {
  const since = new Date();
  since.setFullYear(since.getFullYear() - 5);
  const ymd = since.toISOString().slice(0, 10);

  const url = new URL("https://api.crossref.org/works");
  url.searchParams.set("query", q);
  url.searchParams.set("filter", `from-pub-date:${ymd}`);
  url.searchParams.set("rows", "12");
  url.searchParams.set("sort", "published");
  url.searchParams.set("order", "desc");
  url.searchParams.set("select", "DOI,title,published,container-title,publisher,URL,type");

  const res = await fetch(url, {
    headers: { "Accept": "application/json", "User-Agent": "clinical-rd-intelligence/0.1" },
    next: { revalidate: 3600 }
  });
  if (!res.ok) throw new Error(`Crossref ${res.status}`);
  const json = await res.json();
  return (json.message?.items || []).map(x => ({
    title: x.title?.[0] || "Untitled",
    journal: x["container-title"]?.[0] || x.publisher || "",
    doi: x.DOI || "",
    url: x.URL || (x.DOI ? `https://doi.org/${x.DOI}` : null),
    published: x.published?.["date-parts"]?.[0]?.join("-") || "",
    type: x.type || ""
  }));
}

async function fetchPubMed(q) {
  const search = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi");
  search.searchParams.set("db", "pubmed");
  search.searchParams.set("term", q);
  search.searchParams.set("retmode", "json");
  search.searchParams.set("retmax", "10");
  search.searchParams.set("sort", "pub date");
  search.searchParams.set("tool", "clinical_rd_intelligence");

  const sr = await fetch(search, { next: { revalidate: 3600 } });
  if (!sr.ok) throw new Error(`PubMed search ${sr.status}`);
  const sj = await sr.json();
  const ids = sj.esearchresult?.idlist || [];
  if (!ids.length) return [];

  const summary = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi");
  summary.searchParams.set("db", "pubmed");
  summary.searchParams.set("id", ids.join(","));
  summary.searchParams.set("retmode", "json");
  summary.searchParams.set("tool", "clinical_rd_intelligence");

  const rr = await fetch(summary, { next: { revalidate: 3600 } });
  if (!rr.ok) throw new Error(`PubMed summary ${rr.status}`);
  const rj = await rr.json();

  return ids.map(id => {
    const x = rj.result?.[id] || {};
    return {
      pmid: id,
      title: x.title || "Untitled",
      journal: x.fulljournalname || x.source || "",
      pubdate: x.pubdate || "",
      authors: (x.authors || []).slice(0,3).map(a => a.name).join(", "),
      url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`
    };
  });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "PD-L1 VEGF").trim().slice(0, 180);

  const settled = await Promise.allSettled([
    fetchTrials(q),
    fetchCrossref(q),
    fetchPubMed(q)
  ]);

  const trials = settled[0].status === "fulfilled" ? settled[0].value : [];
  const crossref = settled[1].status === "fulfilled" ? settled[1].value : [];
  const pubmed = settled[2].status === "fulfilled" ? settled[2].value : [];

  const errors = settled
    .map((x, i) => x.status === "rejected" ? ["ClinicalTrials.gov","Crossref","PubMed"][i] + ": " + x.reason?.message : null)
    .filter(Boolean);

  const insights = buildCombinationInsights(trials, q);

  return Response.json({
    query: q,
    generatedAt: new Date().toISOString(),
    sources: {
      clinicalTrials: { live: true, count: trials.length },
      crossref: { live: true, count: crossref.length },
      pubmed: { live: true, count: pubmed.length }
    },
    errors,
    trials,
    publications: { crossref, pubmed },
    insights
  });
}
