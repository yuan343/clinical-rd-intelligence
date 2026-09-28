export const dynamic = "force-dynamic";

const RISK = new Set(["TERMINATED", "WITHDRAWN", "SUSPENDED"]);

function clean(x = "") {
  return String(x || "").trim();
}

function norm(x = "") {
  return clean(x)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ");
}

function daysAgo(s) {
  if (!s) return 99999;

  const d = new Date(s);

  return Number.isNaN(d.getTime())
    ? 99999
    : Math.floor((Date.now() - d.getTime()) / 86400000);
}

function exactTokens(q) {
  return norm(q).split(/\s+/).filter(Boolean);
}

function scoreHighValue({
  status,
  phases,
  updated,
  hasCombo,
  interventions,
}) {
  let score = 0;
  const reasons = [];

  let primaryType = "相关项目";
  let nextCheck = "继续关注项目状态和数据更新。";

  if (RISK.has(status)) {
    score += 5;

    reasons.push(
      "项目已终止/暂停/撤回，可能暴露疗效、安全性、患者选择或战略问题"
    );

    primaryType = "失败/暂停";

    nextCheck =
      "优先核对终止原因：机制失败、疗效不足、安全性、剂量、人群/biomarker、终点设计还是公司战略。";
  }

  if (status === "COMPLETED") {
    score += 2;

    reasons.push(
      "项目已完成，可能进入结果读出或后续开发决策阶段"
    );

    if (primaryType === "相关项目") {
      primaryType = "关键读出";
    }

    nextCheck =
      "核对是否已有结果披露、会议摘要、论文或公司公告。";
  }

  if (hasCombo) {
    score += 2;

    reasons.push(
      `存在真实多干预开发（${interventions.length} 个干预），具备组合研究价值`
    );

    if (primaryType === "相关项目") {
      primaryType = "联合开发";
    }

    if (!RISK.has(status)) {
      nextCheck =
        "核对是否为同治疗臂真实联合，以及A/B机制是否互补。";
    }
  }

  const phaseText = (phases || []).join(" ").toUpperCase();

  if (
    phaseText.includes("PHASE3") ||
    phaseText.includes("PHASE 3")
  ) {
    score += 3;

    reasons.push(
      "进入III期，结果可能显著影响竞争格局"
    );

    if (primaryType === "相关项目") {
      primaryType = "后期临床";
    }
  } else if (
    phaseText.includes("PHASE2") ||
    phaseText.includes("PHASE 2")
  ) {
    score += 1;

    reasons.push(
      "处于II期，开始具备较强临床验证意义"
    );
  }

  const recency = daysAgo(updated);

  if (recency <= 30) {
    score += 2;
    reasons.push("近30天有注册信息更新");

    if (primaryType === "相关项目") {
      primaryType = "近期重大更新";
    }
  } else if (recency <= 90) {
    score += 1;
    reasons.push("近90天有注册信息更新");
  }

  if (reasons.length === 0) {
    reasons.push(
      "与当前检索高度相关，但尚未出现足够强的情报触发信号"
    );
  }

  return {
    score,
    reasons,
    primaryType,
    nextCheck,
  };
}

function classify(study) {
  const p = study.protocolSection || {};

  const id = p.identificationModule || {};
  const s = p.statusModule || {};
  const d = p.designModule || {};
  const c = p.conditionsModule || {};
  const ai = p.armsInterventionsModule || {};
  const sp = p.sponsorCollaboratorsModule || {};

  const interventions = (ai.interventions || [])
    .map((x) => clean(x.name))
    .filter(Boolean);

  const conditions = (c.conditions || [])
    .map(clean)
    .filter(Boolean);

  const aliases = (c.keywords || [])
    .map(clean)
    .filter(Boolean);

  const updated =
    s.lastUpdatePostDateStruct?.date || "";

  const status =
    s.overallStatus || "UNKNOWN";

  const phases =
    d.phases || [];

  const hasCombo =
    interventions.length >= 2;

  const value = scoreHighValue({
    status,
    phases,
    updated,
    hasCombo,
    interventions,
  });

  return {
    nctId: id.nctId,

    title:
      id.briefTitle ||
      id.officialTitle ||
      id.nctId,

    status,

    phase:
      phases.join(", ") || "NA",

    sponsor:
      sp.leadSponsor?.name || "Unknown",

    conditions,
    aliases,
    interventions,
    updated,
    hasCombo,

    highValueScore:
      value.score,

    highValueReasons:
      value.reasons,

    highValueType:
      value.primaryType,

    nextCheck:
      value.nextCheck,

    url: id.nctId
      ? `https://clinicaltrials.gov/study/${id.nctId}`
      : null,
  };
}

function conditionRelevance(t, q) {
  const nq = norm(q);

  const tokens =
    exactTokens(q);

  const haystack = norm(
    [
      ...(t.conditions || []),
      ...(t.aliases || []),
    ].join(" ")
  );

  if (!haystack) return 0;

  if (haystack.includes(nq)) {
    return 100;
  }

  let score = 0;

  for (const token of tokens) {
    if (
      token.length > 1 &&
      haystack.includes(token)
    ) {
      score += 15;
    }
  }

  return score;
}

function generalRelevance(t, q) {
  const tokens =
    exactTokens(q);

  const haystack = norm(
    [
      t.title,
      ...(t.conditions || []),
      ...(t.aliases || []),
      ...(t.interventions || []),
      t.sponsor,
    ].join(" ")
  );

  let score = 0;

  for (const token of tokens) {
    if (
      token.length > 1 &&
      haystack.includes(token)
    ) {
      score += 10;
    }
  }

  if (
    norm(t.title).includes(norm(q))
  ) {
    score += 25;
  }

  return score;
}

async function fetchTrials(
  q,
  kind = "term",
  pageSize = 40
) {
  const url = new URL(
    "https://clinicaltrials.gov/api/v2/studies"
  );

  url.searchParams.set(
    kind === "condition"
      ? "query.cond"
      : "query.term",
    q
  );

  url.searchParams.set(
    "pageSize",
    String(pageSize)
  );

  url.searchParams.set(
    "format",
    "json"
  );

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(
      `ClinicalTrials.gov ${res.status}`
    );
  }

  const json =
    await res.json();

  return (
    json.studies || []
  ).map(classify);
}

function dedupe(arr) {
  const map =
    new Map();

  for (const x of arr) {
    if (
      x.nctId &&
      !map.has(x.nctId)
    ) {
      map.set(
        x.nctId,
        x
      );
    }
  }

  return [
    ...map.values(),
  ];
}

function buildExistingCombinations(trials) {
  const map =
    new Map();

  for (const t of trials) {
    const names = [
      ...new Set(
        (
          t.interventions ||
          []
        ).filter(
          (x) =>
            x.length > 1
        )
      ),
    ];

    if (
      names.length < 2 ||
      names.length > 6
    ) {
      continue;
    }

    for (
      let i = 0;
      i < names.length;
      i++
    ) {
      for (
        let j = i + 1;
        j < names.length;
        j++
      ) {
        const pair = [
          names[i],
          names[j],
        ].sort();

        const key =
          pair.join(" + ");

        if (!map.has(key)) {
          map.set(key, {
            combo: key,
            a: pair[0],
            b: pair[1],
            trials: 0,
            active: 0,
            risk: 0,
            recent: 0,
            indications:
              new Set(),
            phases:
              new Set(),
          });
        }

        const x =
          map.get(key);

        x.trials++;

        if (
          RISK.has(
            t.status
          )
        ) {
          x.risk++;
        } else {
          x.active++;
        }

        if (
          daysAgo(
            t.updated
          ) <= 180
        ) {
          x.recent++;
        }

        (
          t.conditions ||
          []
        )
          .slice(0, 4)
          .forEach(
            (v) =>
              x.indications.add(v)
          );

        if (
          t.phase &&
          t.phase !== "NA"
        ) {
          x.phases.add(
            t.phase
          );
        }
      }
    }
  }

  return [
    ...map.values(),
  ]
    .map((x) => ({
      ...x,

      indications: [
        ...x.indications,
      ].slice(0, 6),

      phases: [
        ...x.phases,
      ].slice(0, 4),

      score:
        x.active * 3 +
        x.recent * 2 +
        x.trials -
        x.risk * 2,
    }))
    .sort(
      (a, b) =>
        b.score - a.score
    )
    .slice(0, 30);
}

function buildFailures(trials) {
  return trials
    .filter((t) =>
      RISK.has(t.status)
    )
    .sort(
      (a, b) =>
        b.highValueScore -
        a.highValueScore
    )
    .slice(0, 20);
}

function buildUnmetProblems(trials) {
  const problems = [];

  for (const t of trials) {
    if (
      RISK.has(t.status)
    ) {
      problems.push({
        source:
          t.title,

        nctId:
          t.nctId,

        problem:
          "该项目出现终止/暂停/撤回信号，需要判断失败原因是否可被新的联合策略补偿。",

        mechanismNeed:
          "优先拆解疗效不足、毒性、耐药/逃逸、患者选择和biomarker问题。",
      });
    }

    if (
      t.status ===
      "COMPLETED"
    ) {
      problems.push({
        source:
          t.title,

        nctId:
          t.nctId,

        problem:
          "项目已完成，但尚需核对是否存在疗效深度、持续性或特定人群获益限制。",

        mechanismNeed:
          "根据正式结果判断下一步应增强疗效、延长持续时间还是改善患者选择。",
      });
    }
  }

  return problems
    .slice(0, 12);
}

function buildPotentialCombinations(
  trials,
  existingCombinations
) {
  const existingSet =
    new Set(
      existingCombinations.map(
        (x) =>
          norm(
            [
              x.a,
              x.b,
            ]
              .sort()
              .join(" + ")
          )
      )
    );

  const riskInterventions =
    new Map();

  for (const t of trials) {
    if (
      !RISK.has(t.status)
    ) {
      continue;
    }

    for (
      const drug of
      t.interventions || []
    ) {
      if (
        !riskInterventions.has(
          drug
        )
      ) {
        riskInterventions.set(
          drug,
          {
            drug,
            count: 0,
            trials: [],
          }
        );
      }

      const x =
        riskInterventions.get(
          drug
        );

      x.count++;

      if (
        x.trials.length < 3
      ) {
        x.trials.push(
          t.nctId
        );
      }
    }
  }

  const candidatePool =
    new Map();

  for (const t of trials) {
    if (
      RISK.has(t.status)
    ) {
      continue;
    }

    for (
      const drug of
      t.interventions || []
    ) {
      if (
        !candidatePool.has(
          drug
        )
      ) {
        candidatePool.set(
          drug,
          {
            drug,
            activeTrials: 0,
            indications:
              new Set(),
          }
        );
      }

      const x =
        candidatePool.get(
          drug
        );

      x.activeTrials++;

      for (
        const c of
        t.conditions || []
      ) {
        x.indications.add(c);
      }
    }
  }

  const potential = [];

  for (
    const [
      a,
      riskInfo,
    ] of
      riskInterventions
  ) {
    const candidates = [
      ...candidatePool.values(),
    ]
      .filter(
        (x) =>
          x.drug !== a
      )
      .sort(
        (x, y) =>
          y.activeTrials -
          x.activeTrials
      )
      .slice(0, 8);

    for (
      const candidate of
      candidates
    ) {
      const pairKey =
        norm(
          [
            a,
            candidate.drug,
          ]
            .sort()
            .join(" + ")
        );

      if (
        existingSet.has(
          pairKey
        )
      ) {
        continue;
      }

      potential.push({
        a,

        problem:
          `A 在当前检索结果中出现 ${riskInfo.count} 个失败/暂停相关试验，需要进一步拆解真正限制因素。`,

        b:
          candidate.drug,

        compensation:
          "候选 B 当前有活跃临床开发，可作为潜在补偿机制候选；具体补偿路径仍需机制证据验证。",

        rationale:
          "当前未在本次检索结果中发现明确 A+B 临床开发记录，因此可进入“潜在新组合”观察池，但不能仅凭共现数据判断协同。",

        developmentStatus:
          "当前检索未发现明确 A+B 临床组合",

        evidenceGap:
          "缺少 A 的具体失败机制、B 是否直接作用于该机制、前临床协同与安全性证据。",
      });

      if (
        potential.length >=
        20
      ) {
        return potential;
      }
    }
  }

  return potential;
}

async function pubmed(q) {
  const search =
    new URL(
      "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
    );

  search.searchParams.set(
    "db",
    "pubmed"
  );

  search.searchParams.set(
    "term",
    q
  );

  search.searchParams.set(
    "retmode",
    "json"
  );

  search.searchParams.set(
    "retmax",
    "8"
  );

  search.searchParams.set(
    "sort",
    "pub date"
  );

  const res =
    await fetch(search, {
      cache: "no-store",
    });

  if (!res.ok) {
    return [];
  }

  const json =
    await res.json();

  const ids =
    json.esearchresult
      ?.idlist || [];

  if (!ids.length) {
    return [];
  }

  const summary =
    new URL(
      "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"
    );

  summary.searchParams.set(
    "db",
    "pubmed"
  );

  summary.searchParams.set(
    "id",
    ids.join(",")
  );

  summary.searchParams.set(
    "retmode",
    "json"
  );

  const r =
    await fetch(summary, {
      cache: "no-store",
    });

  const j =
    await r.json();

  return ids.map(
    (id) => {
      const x =
        j.result?.[id] ||
        {};

      return {
        pmid: id,

        title:
          x.title ||
          "Untitled",

        journal:
          x.fulljournalname ||
          x.source ||
          "",

        pubdate:
          x.pubdate ||
          "",

        url:
          `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
      };
    }
  );
}

export async function GET(
  request
) {
  const {
    searchParams,
  } = new URL(
    request.url
  );

  const q = clean(
    searchParams.get(
      "q"
    ) ||
      "PD-L1 VEGF"
  ).slice(0, 180);

  const mode =
    searchParams.get(
      "mode"
    ) || "auto";

  const tasks =
    mode === "condition"
      ? [
          fetchTrials(
            q,
            "condition"
          ),
          Promise.resolve([]),
        ]
      : mode === "term"
      ? [
          Promise.resolve([]),
          fetchTrials(
            q,
            "term"
          ),
        ]
      : [
          fetchTrials(
            q,
            "condition"
          ),
          fetchTrials(
            q,
            "term"
          ),
        ];

  const [
    condResult,
    termResult,
    pubResult,
  ] =
    await Promise.allSettled(
      [
        ...tasks,
        pubmed(q),
      ]
    );

  let conditionTrials =
    condResult.status ===
    "fulfilled"
      ? condResult.value
      : [];

  let termTrials =
    termResult.status ===
    "fulfilled"
      ? termResult.value
      : [];

  const publications =
    pubResult.status ===
    "fulfilled"
      ? pubResult.value
      : [];

  conditionTrials =
    conditionTrials
      .map((t) => ({
        ...t,

        relevance:
          conditionRelevance(
            t,
            q
          ),
      }))
      .sort(
        (a, b) =>
          b.relevance -
          a.relevance
      );

  termTrials =
    termTrials
      .map((t) => ({
        ...t,

        relevance:
          generalRelevance(
            t,
            q
          ),
      }))
      .sort(
        (a, b) =>
          b.relevance -
          a.relevance
      );

  let selectedMode =
    mode;

  let trials =
    [];

  if (
    mode ===
    "condition"
  ) {
    trials =
      conditionTrials;
  } else if (
    mode === "term"
  ) {
    trials =
      termTrials;
  } else {
    const strongConditions =
      conditionTrials.filter(
        (x) =>
          x.relevance >=
          15
      );

    if (
      strongConditions.length >=
        3 ||
      (
        strongConditions.length >
          0 &&
        strongConditions[0]
          .relevance >= 100
      )
    ) {
      selectedMode =
        "condition";

      trials =
        strongConditions;
    } else {
      selectedMode =
        "term";

      trials =
        termTrials;
    }
  }

  trials =
    dedupe(
      trials
    ).slice(0, 40);

  const highValueSignals =
    [...trials]
      .filter(
        (x) =>
          x.highValueScore >=
          3
      )
      .sort(
        (a, b) =>
          b.highValueScore -
            a.highValueScore ||
          b.relevance -
            a.relevance
      )
      .slice(0, 10);

  const failures =
    buildFailures(
      trials
    );

  const existingCombinations =
    buildExistingCombinations(
      trials
    );

  const unmetProblems =
    buildUnmetProblems(
      trials
    );

  const potentialCombinations =
    buildPotentialCombinations(
      trials,
      existingCombinations
    );

  return Response.json({
    query: q,

    requestedMode:
      mode,

    selectedMode,

    generatedAt:
      new Date().toISOString(),

    trials,

    highValueSignals,

    failures,

    existingCombinations,

    unmetProblems,

    potentialCombinations,

    publications,

    diagnostics: {
      conditionHits:
        conditionTrials.length,

      strongConditionHits:
        conditionTrials.filter(
          (x) =>
            x.relevance >=
            15
        ).length,

      termHits:
        termTrials.length,
    },
  });
}
