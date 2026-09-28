export const dynamic = "force-dynamic";

const RISK = new Set([
  "TERMINATED",
  "WITHDRAWN",
  "SUSPENDED",
]);

// ============================================================
// 基础工具
// ============================================================

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
    : Math.floor(
        (Date.now() - d.getTime()) / 86400000
      );
}

function exactTokens(q) {
  return norm(q)
    .split(/\s+/)
    .filter(Boolean);
}

// ============================================================
// High-Value Signal
// 这里只表示“为什么值得关注”，不是潜在组合推荐
// ============================================================

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

  let nextCheck =
    "继续关注项目状态和数据更新。";

  if (RISK.has(status)) {
    score += 5;

    reasons.push(
      "项目已终止/暂停/撤回，可能暴露疗效、安全性、患者选择、机制或战略问题"
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
      `存在真实多干预开发（${interventions.length}个干预），可作为已有联合证据`
    );

    if (primaryType === "相关项目") {
      primaryType = "联合开发";
    }

    if (!RISK.has(status)) {
      nextCheck =
        "核对是否为同治疗臂真实联合，以及为什么这样联合、结果如何、是否具备可迁移逻辑。";
    }
  }

  const phaseText = (phases || [])
    .join(" ")
    .toUpperCase();

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

// ============================================================
// ClinicalTrials.gov 数据标准化
// ============================================================

function classify(study) {
  const p =
    study.protocolSection || {};

  const id =
    p.identificationModule || {};

  const s =
    p.statusModule || {};

  const d =
    p.designModule || {};

  const c =
    p.conditionsModule || {};

  const ai =
    p.armsInterventionsModule || {};

  const sp =
    p.sponsorCollaboratorsModule || {};

  const interventions = (
    ai.interventions || []
  )
    .map((x) => clean(x.name))
    .filter(Boolean);

  const conditions = (
    c.conditions || []
  )
    .map(clean)
    .filter(Boolean);

  const aliases = (
    c.keywords || []
  )
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

  const value =
    scoreHighValue({
      status,
      phases,
      updated,
      hasCombo,
      interventions,
    });

  return {
    nctId:
      id.nctId,

    title:
      id.briefTitle ||
      id.officialTitle ||
      id.nctId,

    status,

    phase:
      phases.join(", ") ||
      "NA",

    sponsor:
      sp.leadSponsor?.name ||
      "Unknown",

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

    url:
      id.nctId
        ? `https://clinicaltrials.gov/study/${id.nctId}`
        : null,
  };
}

// ============================================================
// 检索相关性
// ============================================================

function conditionRelevance(
  t,
  q
) {
  const nq =
    norm(q);

  const tokens =
    exactTokens(q);

  const haystack =
    norm(
      [
        ...(t.conditions || []),
        ...(t.aliases || []),
      ].join(" ")
    );

  if (!haystack) return 0;

  if (
    haystack.includes(nq)
  ) {
    return 100;
  }

  let score = 0;

  for (
    const token of tokens
  ) {
    if (
      token.length > 1 &&
      haystack.includes(token)
    ) {
      score += 15;
    }
  }

  return score;
}

function generalRelevance(
  t,
  q
) {
  const tokens =
    exactTokens(q);

  const haystack =
    norm(
      [
        t.title,
        ...(t.conditions || []),
        ...(t.aliases || []),
        ...(t.interventions || []),
        t.sponsor,
      ].join(" ")
    );

  let score = 0;

  for (
    const token of tokens
  ) {
    if (
      token.length > 1 &&
      haystack.includes(token)
    ) {
      score += 10;
    }
  }

  if (
    norm(t.title).includes(
      norm(q)
    )
  ) {
    score += 25;
  }

  return score;
}

// ============================================================
// ClinicalTrials.gov
// ============================================================

async function fetchTrials(
  q,
  kind = "term",
  pageSize = 40
) {
  const url =
    new URL(
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

  const res =
    await fetch(
      url,
      {
        headers: {
          Accept:
            "application/json",
        },
        cache: "no-store",
      }
    );

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

// ============================================================
// 已有真实组合
// ============================================================

function buildExistingCombinations(
  trials
) {
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

        if (
          !map.has(key)
        ) {
          map.set(
            key,
            {
              combo: key,

              a:
                pair[0],

              b:
                pair[1],

              trials: 0,

              active: 0,

              risk: 0,

              recent: 0,

              indications:
                new Set(),

              phases:
                new Set(),
            }
          );
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
        b.score -
        a.score
    )
    .slice(0, 30);
}

// ============================================================
// Combination Pattern Engine
//
// 注意：
// 这里不是直接推荐新组合。
// 这里负责把已有真实组合转化成“可迁移的组合模式”。
// 后续 Potential Combination 要真正引用这些 Pattern。
// ============================================================

const MECHANISM_RULES = [
  {
    id:
      "PDL1_VEGF_BISPECIFIC",

    label:
      "PD-L1 × VEGF 双功能机制",

    keywords: [
      "bnt327",
      "pm8002",
      "imm2510",
    ],
  },

  {
    id:
      "PD1_VEGF_BISPECIFIC",

    label:
      "PD-1 × VEGF 双功能机制",

    keywords: [
      "ivonescimab",
      "ak112",
    ],
  },

  {
    id: "PD1",

    label: "PD-1",

    keywords: [
      "pd-1",
      "pd1",
      "pembrolizumab",
      "nivolumab",
      "sintilimab",
      "camrelizumab",
      "tislelizumab",
      "toripalimab",
    ],
  },

  {
    id: "PDL1",

    label: "PD-L1",

    keywords: [
      "pd-l1",
      "pdl1",
      "atezolizumab",
      "durvalumab",
      "avelumab",
    ],
  },

  {
    id: "VEGF",

    label:
      "VEGF / VEGFR",

    keywords: [
      "vegf",
      "vegfr",
      "bevacizumab",
      "ramucirumab",
      "apatinib",
      "anlotinib",
      "lenvatinib",
      "axitinib",
      "cabozantinib",
    ],
  },

  {
    id: "CTLA4",

    label: "CTLA-4",

    keywords: [
      "ctla-4",
      "ctla4",
      "ipilimumab",
      "tremelimumab",
    ],
  },

  {
    id: "CD20",

    label: "CD20",

    keywords: [
      "cd20",
      "rituximab",
      "obinutuzumab",
      "ofatumumab",
    ],
  },

  {
    id: "CD19",

    label: "CD19",

    keywords: [
      "cd19",
    ],
  },

  {
    id: "BTK",

    label: "BTK",

    keywords: [
      "btk",
      "ibrutinib",
      "acalabrutinib",
      "zanubrutinib",
      "rilzabrutinib",
    ],
  },

  {
    id: "BCL2",

    label: "BCL-2",

    keywords: [
      "bcl-2",
      "bcl2",
      "venetoclax",
    ],
  },

  {
    id: "JAK",

    label: "JAK",

    keywords: [
      "jak1",
      "jak2",
      "jak3",
      "jak inhibitor",
    ],
  },

  {
    id: "TYK2",

    label: "TYK2",

    keywords: [
      "tyk2",
    ],
  },

  {
    id: "EGFR",

    label: "EGFR",

    keywords: [
      "egfr",
      "osimertinib",
      "gefitinib",
      "erlotinib",
      "afatinib",
    ],
  },

  {
    id: "HER2",

    label: "HER2",

    keywords: [
      "her2",
      "trastuzumab",
      "pertuzumab",
    ],
  },

  {
    id: "KRAS",

    label: "KRAS",

    keywords: [
      "kras",
      "sotorasib",
      "adagrasib",
    ],
  },

  {
    id: "PARP",

    label: "PARP",

    keywords: [
      "parp",
      "olaparib",
      "niraparib",
      "rucaparib",
      "talazoparib",
    ],
  },

  {
    id:
      "CHEMOTHERAPY",

    label:
      "Chemotherapy",

    keywords: [
      "chemotherapy",
      "carboplatin",
      "cisplatin",
      "paclitaxel",
      "docetaxel",
      "gemcitabine",
      "irinotecan",
      "fluorouracil",
      "5-fu",
      "oxaliplatin",
      "capecitabine",
      "etoposide",
    ],
  },
];

function mechanismOf(
  name = ""
) {
  const text =
    norm(name);

  if (!text) {
    return {
      id: "UNKNOWN",
      label:
        "机制待识别",
    };
  }

  for (
    const rule of
    MECHANISM_RULES
  ) {
    const hit =
      rule.keywords.some(
        (keyword) =>
          text.includes(
            norm(keyword)
          )
      );

    if (hit) {
      return {
        id:
          rule.id,

        label:
          rule.label,
      };
    }
  }

  return {
    id: "UNKNOWN",

    label:
      "机制待识别",
  };
}

function buildCombinationPatterns(
  existingCombinations
) {
  const patternMap =
    new Map();

  for (
    const combo of
    existingCombinations || []
  ) {
    const mechanismA =
      mechanismOf(
        combo.a
      );

    const mechanismB =
      mechanismOf(
        combo.b
      );

    // 如果两边机制都不知道，
    // 当前无法形成有意义的 Pattern
    if (
      mechanismA.id ===
        "UNKNOWN" &&
      mechanismB.id ===
        "UNKNOWN"
    ) {
      continue;
    }

    const mechanisms = [
      mechanismA,
      mechanismB,
    ].sort(
      (x, y) =>
        x.id.localeCompare(
          y.id
        )
    );

    const patternKey =
      `${mechanisms[0].id}__${mechanisms[1].id}`;

    if (
      !patternMap.has(
        patternKey
      )
    ) {
      patternMap.set(
        patternKey,
        {
          id:
            patternKey,

          mechanismA:
            mechanisms[0]
              .label,

          mechanismB:
            mechanisms[1]
              .label,

          pattern:
            `${mechanisms[0].label} + ${mechanisms[1].label}`,

          sourceCombinations:
            [],

          indications:
            new Set(),

          trialCount: 0,

          activeTrials: 0,

          failedTrials: 0,

          // 当前阶段先记录“已有临床模式”
          // 下一阶段再加入：
          // Problem / Compensation / Success condition / Failure boundary
          interpretation:
            "该模式来自真实临床联合项目，可作为后续潜在新组合推导的证据输入。",
        }
      );
    }

    const pattern =
      patternMap.get(
        patternKey
      );

    pattern
      .sourceCombinations
      .push({
        a:
          combo.a,

        b:
          combo.b,

        combo:
          combo.combo,

        trials:
          combo.trials,

        active:
          combo.active,

        risk:
          combo.risk,
      });

    pattern.trialCount +=
      combo.trials || 0;

    pattern.activeTrials +=
      combo.active || 0;

    pattern.failedTrials +=
      combo.risk || 0;

    for (
      const indication of
      combo.indications || []
    ) {
      pattern
        .indications
        .add(indication);
    }
  }

  return [
    ...patternMap.values(),
  ]
    .map(
      (pattern) => ({
        ...pattern,

        indications: [
          ...pattern.indications,
        ].slice(0, 8),

        sourceCombinations:
          pattern
            .sourceCombinations
            .slice(0, 8),

        evidenceStrength:
          pattern.trialCount >=
          5
            ? "较多临床开发证据"
            : pattern.trialCount >=
              2
            ? "已有临床验证"
            : "早期临床线索",
      })
    )
    .sort(
      (a, b) =>
        b.trialCount -
        a.trialCount
    )
    .slice(0, 30);
}

// ============================================================
// 失败 / 暂停项目
// ============================================================

function buildFailures(
  trials
) {
  return trials
    .filter(
      (t) =>
        RISK.has(
          t.status
        )
    )
    .sort(
      (a, b) =>
        b.highValueScore -
        a.highValueScore
    )
    .slice(0, 20);
}

// ============================================================
// 未解决问题
//
// 当前仍然是“信号级”识别。
// 下一阶段会把 Problem 真正和 Pattern 连接起来。
// ============================================================

function buildUnmetProblems(
  trials
) {
  const problems = [];

  for (
    const t of trials
  ) {
    if (
      RISK.has(
        t.status
      )
    ) {
      problems.push({
        source:
          t.title,

        nctId:
          t.nctId,

        problem:
          "该项目出现终止/暂停/撤回信号，需要判断失败原因是否可被新的联合策略补偿。",

        mechanismNeed:
          "优先拆解疗效不足、毒性、耐药/逃逸、患者选择、biomarker和研究设计问题。",
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
          "项目已完成，需要进一步核对是否存在疗效深度、持续性或特定人群获益限制。",

        mechanismNeed:
          "根据正式结果判断下一步应增强疗效、延长持续时间还是改善患者选择。",
      });
    }
  }

  return problems
    .slice(0, 12);
}

// ============================================================
// Potential Combination
//
// 重要：
// 当前函数仍保留第一版候选生成逻辑，
// 但后续下一步我们会完整替换这里。
// 真正目标是：
//
// Existing Pattern
// → Problem Match
// → Mechanism Transfer
// → Candidate B
// → Existing A+B Check
// → Potential New Combination
//
// ============================================================

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

  for (
    const t of trials
  ) {
    if (
      !RISK.has(
        t.status
      )
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

  for (
    const t of trials
  ) {
    if (
      RISK.has(
        t.status
      )
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
          "候选B当前有活跃临床开发，但其是否能够补偿A的具体机制问题仍需验证。",

        rationale:
          "当前未在本次检索结果中发现明确A+B临床开发记录，因此暂时进入观察池；该结果目前不是机制推理结论。",

        developmentStatus:
          "当前检索未发现明确A+B临床组合",

        evidenceGap:
          "尚缺A的具体失败机制、已有Combination Pattern迁移依据、B对该问题的补偿证据、前临床协同和安全性证据。",
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

// ============================================================
// PubMed
// ============================================================

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
    await fetch(
      search,
      {
        cache: "no-store",
      }
    );

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
    await fetch(
      summary,
      {
        cache: "no-store",
      }
    );

  if (!r.ok) {
    return [];
  }

  const j =
    await r.json();

  return ids.map(
    (id) => {
      const x =
        j.result?.[id] ||
        {};

      return {
        pmid:
          id,

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

// ============================================================
// API GET
// ============================================================

export async function GET(
  request
) {
  const {
    searchParams,
  } =
    new URL(
      request.url
    );

  const q =
    clean(
      searchParams.get(
        "q"
      ) ||
        "PD-L1 VEGF"
    ).slice(0, 180);

  const mode =
    searchParams.get(
      "mode"
    ) ||
    "auto";

  const tasks =
    mode ===
    "condition"
      ? [
          fetchTrials(
            q,
            "condition"
          ),

          Promise.resolve(
            []
          ),
        ]
      : mode ===
        "term"
      ? [
          Promise.resolve(
            []
          ),

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
      .map(
        (t) => ({
          ...t,

          relevance:
            conditionRelevance(
              t,
              q
            ),
        })
      )
      .sort(
        (a, b) =>
          b.relevance -
          a.relevance
      );

  termTrials =
    termTrials
      .map(
        (t) => ({
          ...t,

          relevance:
            generalRelevance(
              t,
              q
            ),
        })
      )
      .sort(
        (a, b) =>
          b.relevance -
          a.relevance
      );

  let selectedMode =
    mode;

  let trials = [];

  if (
    mode ===
    "condition"
  ) {
    trials =
      conditionTrials;
  } else if (
    mode ===
    "term"
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
          .relevance >=
          100
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

  // ==========================================================
  // 1. 高价值 Signal
  // ==========================================================

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

  // ==========================================================
  // 2. 失败 / 暂停
  // ==========================================================

  const failures =
    buildFailures(
      trials
    );

  // ==========================================================
  // 3. 已有真实组合
  // ==========================================================

  const existingCombinations =
    buildExistingCombinations(
      trials
    );

  // ==========================================================
  // 4. 从已有组合提取 Combination Pattern
  // ==========================================================

  const combinationPatterns =
    buildCombinationPatterns(
      existingCombinations
    );

  // ==========================================================
  // 5. 当前未解决问题
  // ==========================================================

  const unmetProblems =
    buildUnmetProblems(
      trials
    );

  // ==========================================================
  // 6. 潜在组合
  //
  // 下一步我们会重点重写这里：
  // Pattern → Problem → Transfer → New Combination
  // ==========================================================

  const potentialCombinations =
    buildPotentialCombinations(
      trials,
      existingCombinations
    );

  return Response.json({
    query:
      q,

    requestedMode:
      mode,

    selectedMode,

    generatedAt:
      new Date().toISOString(),

    trials,

    highValueSignals,

    failures,

    existingCombinations,

    // 新增：
    // 已有真实组合形成的组合模式库
    combinationPatterns,

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

      existingCombinationCount:
        existingCombinations.length,

      combinationPatternCount:
        combinationPatterns.length,

      potentialCombinationCount:
        potentialCombinations.length,
    },
  });
}
