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

function pairKey(a, b) {
  return [norm(a), norm(b)]
    .sort()
    .join("__");
}

function overlap(a = [], b = []) {
  const bSet = new Set(
    b.map((x) => norm(x))
  );

  return a.filter((x) =>
    bSet.has(norm(x))
  );
}

// ============================================================
// High-Value Signal
//
// 这里表示“为什么值得关注”
// 不是潜在组合建议
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

  let primaryType =
    "相关项目";

  let nextCheck =
    "继续关注项目状态和数据更新。";

  if (RISK.has(status)) {
    score += 5;

    reasons.push(
      "项目已终止/暂停/撤回，可能暴露疗效、安全性、患者选择、机制或战略问题"
    );

    primaryType =
      "失败/暂停";

    nextCheck =
      "优先核对终止原因：机制失败、疗效不足、安全性、剂量、人群/biomarker、终点设计还是公司战略。";
  }

  if (
    status ===
    "COMPLETED"
  ) {
    score += 2;

    reasons.push(
      "项目已完成，可能进入结果读出或后续开发决策阶段"
    );

    if (
      primaryType ===
      "相关项目"
    ) {
      primaryType =
        "关键读出";
    }

    nextCheck =
      "核对是否已有结果披露、会议摘要、论文或公司公告。";
  }

  if (hasCombo) {
    score += 2;

    reasons.push(
      `存在真实多干预开发（${interventions.length}个干预），可作为已有联合证据`
    );

    if (
      primaryType ===
      "相关项目"
    ) {
      primaryType =
        "联合开发";
    }

    if (
      !RISK.has(status)
    ) {
      nextCheck =
        "核对为什么这样联合、结果如何，以及组合逻辑能否迁移到其他分子。";
    }
  }

  const phaseText =
    (phases || [])
      .join(" ")
      .toUpperCase();

  if (
    phaseText.includes(
      "PHASE3"
    ) ||
    phaseText.includes(
      "PHASE 3"
    )
  ) {
    score += 3;

    reasons.push(
      "进入III期，结果可能显著影响竞争格局"
    );

    if (
      primaryType ===
      "相关项目"
    ) {
      primaryType =
        "后期临床";
    }
  } else if (
    phaseText.includes(
      "PHASE2"
    ) ||
    phaseText.includes(
      "PHASE 2"
    )
  ) {
    score += 1;

    reasons.push(
      "处于II期，开始具备较强临床验证意义"
    );
  }

  const recency =
    daysAgo(updated);

  if (recency <= 30) {
    score += 2;

    reasons.push(
      "近30天有注册信息更新"
    );

    if (
      primaryType ===
      "相关项目"
    ) {
      primaryType =
        "近期重大更新";
    }
  } else if (
    recency <= 90
  ) {
    score += 1;

    reasons.push(
      "近90天有注册信息更新"
    );
  }

  if (
    reasons.length === 0
  ) {
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

  const interventions =
    (ai.interventions || [])
      .map((x) =>
        clean(x.name)
      )
      .filter(Boolean);

  const conditions =
    (c.conditions || [])
      .map(clean)
      .filter(Boolean);

  const aliases =
    (c.keywords || [])
      .map(clean)
      .filter(Boolean);

  const updated =
    s.lastUpdatePostDateStruct
      ?.date || "";

  const status =
    s.overallStatus ||
    "UNKNOWN";

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

  if (!haystack) {
    return 0;
  }

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
      haystack.includes(
        token
      )
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
      haystack.includes(
        token
      )
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

        cache:
          "no-store",
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
              combo:
                key,

              a:
                pair[0],

              b:
                pair[1],

              trials:
                0,

              active:
                0,

              risk:
                0,

              recent:
                0,

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
    .slice(0, 40);
}

// ============================================================
// Mechanism Dictionary
//
// 先做解释型规则。
// 后面可以继续接外部靶点数据库和AI。
// ============================================================

const MECHANISM_RULES = [
  {
    id:
      "PDL1_VEGF_BISPECIFIC",

    label:
      "PD-L1 × VEGF双功能机制",

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
      "PD-1 × VEGF双功能机制",

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
      "pemetrexed",
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
      id:
        "UNKNOWN",

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
    id:
      "UNKNOWN",

    label:
      "机制待识别",
  };
}

// ============================================================
// Combination Pattern Logic
//
// 这才是关键：
// 不只是说“两个机制一起用了”。
// 还说明：
// 1. 问题是什么
// 2. B补什么
// 3. 为什么可迁移
// 4. 有什么边界
// ============================================================

const PATTERN_LOGIC = {
  "PD1__VEGF": {
    problem:
      "单纯解除PD-1免疫抑制后，肿瘤血管异常及VEGF驱动的免疫抑制微环境仍可能限制T细胞浸润和持续应答。",

    compensation:
      "VEGF/VEGFR抑制可改善异常血管和免疫微环境，为PD-1通路解除免疫抑制提供更有利的效应环境。",

    transferRule:
      "如果新的PD-1类资产仍面临免疫浸润不足或VEGF相关微环境抑制，可参考PD-1 + VEGF这一已有组合模式寻找同机制替代分子。",

    successCondition:
      "适应症具有免疫治疗基础，同时存在明显血管生成/VEGF相关生物学。",

    failureBoundary:
      "需重点关注抗血管生成相关毒性、免疫毒性叠加、剂量以及不同瘤种对VEGF依赖程度。",

    transferable:
      true,
  },

  "PDL1__VEGF": {
    problem:
      "PD-L1阻断能够解除部分免疫逃逸，但VEGF驱动的血管异常和免疫抑制微环境仍可能限制疗效。",

    compensation:
      "VEGF/VEGFR抑制可改善肿瘤血管和免疫微环境，与PD-L1阻断形成机制互补。",

    transferRule:
      "可将已有PD-L1 + VEGF联合规律迁移至其他PD-L1资产或其他VEGF通路资产，但必须重新核对安全性和适应症。",

    successCondition:
      "更适合同时存在免疫治疗敏感性与血管生成驱动因素的肿瘤。",

    failureBoundary:
      "不同VEGF药物强度、半衰期和安全窗不同，不能仅凭同靶点直接认为临床效果等同。",

    transferable:
      true,
  },

  "CHEMOTHERAPY__PD1_VEGF_BISPECIFIC": {
    problem:
      "双功能免疫/抗血管生成机制仍可能受到初始肿瘤负荷、抗原释放不足和快速疾病进展限制。",

    compensation:
      "化疗可实现快速减瘤并促进肿瘤抗原释放，为PD-1×VEGF双功能机制提供更强的初始免疫启动条件。",

    transferRule:
      "如果同类PD-1×VEGF资产存在单药起效深度不足，可参考与化疗联合模式，但应优先迁移至相近瘤种和治疗线次。",

    successCondition:
      "疾病需要快速疾病控制，同时免疫+抗血管生成机制存在长期获益潜力。",

    failureBoundary:
      "骨髓抑制、感染、出血及整体耐受性可能限制联合剂量强度。",

    transferable:
      true,
  },

  "CHEMOTHERAPY__PDL1_VEGF_BISPECIFIC": {
    problem:
      "PD-L1×VEGF双功能机制可能仍存在早期减瘤速度不足或部分患者原发耐药。",

    compensation:
      "化疗提供直接细胞毒作用和抗原释放，与免疫解除抑制及抗血管生成形成三重作用。",

    transferRule:
      "已有PD-L1×VEGF + 化疗项目可作为其他同机制双抗资产联合化疗的参考Pattern。",

    successCondition:
      "适应症已有免疫联合化疗基础，且疾病进展速度要求较快起效。",

    failureBoundary:
      "需关注血小板、骨髓抑制、出血风险以及复杂联合下的剂量优化。",

    transferable:
      true,
  },

  "CTLA4__PD1": {
    problem:
      "单纯PD-1阻断主要作用于外周效应阶段，部分患者可能存在T细胞初始激活不足。",

    compensation:
      "CTLA-4阻断可增强T细胞启动与克隆扩增，与PD-1阻断形成不同免疫阶段的互补。",

    transferRule:
      "如果新的PD-1类资产面临免疫启动不足，可参考PD-1 + CTLA-4模式寻找CTLA-4类联合机会。",

    successCondition:
      "需要更强免疫激活、且患者能够承受更高免疫相关毒性的场景。",

    failureBoundary:
      "免疫相关AE明显增加，剂量、给药频率和患者选择非常关键。",

    transferable:
      true,
  },

  "BCL2__CD20": {
    problem:
      "单纯CD20介导B细胞清除后，部分异常B细胞仍可能通过抗凋亡机制存活。",

    compensation:
      "BCL-2抑制促进异常B细胞凋亡，与CD20介导的细胞清除形成互补。",

    transferRule:
      "在B细胞疾病中，如果新的CD20资产仍存在残留克隆，可参考CD20 + BCL-2模式寻找同机制候选。",

    successCondition:
      "疾病具有明确B细胞依赖及BCL-2抗凋亡特征。",

    failureBoundary:
      "需关注骨髓抑制、感染和肿瘤溶解相关风险。",

    transferable:
      true,
  },

  "BTK__CD20": {
    problem:
      "单纯CD20清除可能无法完全抑制持续存在的BCR信号和异常B细胞存活。",

    compensation:
      "BTK抑制阻断BCR信号，与CD20介导的B细胞清除形成机制互补。",

    transferRule:
      "如果某CD20资产存在B细胞持续信号或残留问题，可参考CD20 + BTK模式寻找其他BTK类资产。",

    successCondition:
      "疾病生物学存在明显BCR/BTK依赖。",

    failureBoundary:
      "感染、出血、心血管风险及长期联合耐受性需重点评价。",

    transferable:
      true,
  },

  "CHEMOTHERAPY__EGFR": {
    problem:
      "EGFR抑制能够针对驱动通路，但可能无法覆盖所有异质性克隆或快速控制高肿瘤负荷。",

    compensation:
      "化疗可提供非靶点依赖的细胞毒作用，帮助覆盖异质性亚克隆。",

    transferRule:
      "如果新EGFR资产单药存在早期疾病控制不足，可参考EGFR + 化疗模式。",

    successCondition:
      "明确EGFR驱动，同时存在需要提高初始疾病控制率的场景。",

    failureBoundary:
      "联合增加骨髓抑制和整体治疗负担，需权衡单药已较好疗效的场景。",

    transferable:
      true,
  },

  "PARP__PD1": {
    problem:
      "PARP抑制造成DNA损伤后可能增加免疫原性，但免疫抑制仍可能限制抗肿瘤免疫。",

    compensation:
      "PD-1阻断可能帮助利用DNA损伤产生的免疫原性信号。",

    transferRule:
      "在DNA修复缺陷或高基因组不稳定人群中，可以参考PARP + PD-1模式探索同机制资产迁移。",

    successCondition:
      "更可能依赖HRD、BRCA或其他DNA修复异常人群选择。",

    failureBoundary:
      "临床获益并非在所有患者中稳定，biomarker选择和骨髓毒性非常重要。",

    transferable:
      true,
  },
};

// ============================================================
// Combination Pattern Engine
// ============================================================

function buildCombinationPatterns(
  existingCombinations
) {
  const patternMap =
    new Map();

  for (
    const combo of
    existingCombinations ||
    []
  ) {
    const ma =
      mechanismOf(combo.a);

    const mb =
      mechanismOf(combo.b);

    if (
      ma.id ===
        "UNKNOWN" ||
      mb.id ===
        "UNKNOWN"
    ) {
      continue;
    }

    const sorted =
      [
        ma,
        mb,
      ].sort(
        (x, y) =>
          x.id.localeCompare(
            y.id
          )
      );

    const patternKey =
      `${sorted[0].id}__${sorted[1].id}`;

    const logic =
      PATTERN_LOGIC[
        patternKey
      ] || {
        problem:
          "已有临床联合提示两个机制可能存在互补，但当前规则库尚未完成具体问题定义。",

        compensation:
          "需要进一步通过机制文献和临床结果解释两者之间的补偿关系。",

        transferRule:
          "暂不自动迁移。",

        successCondition:
          "待补充。",

        failureBoundary:
          "待补充。",

        transferable:
          false,
      };

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

          mechanismAId:
            sorted[0].id,

          mechanismBId:
            sorted[1].id,

          mechanismA:
            sorted[0].label,

          mechanismB:
            sorted[1].label,

          pattern:
            `${sorted[0].label} + ${sorted[1].label}`,

          sourceCombinations:
            [],

          indications:
            new Set(),

          trialCount:
            0,

          activeTrials:
            0,

          failedTrials:
            0,

          problem:
            logic.problem,

          compensation:
            logic.compensation,

          transferRule:
            logic.transferRule,

          successCondition:
            logic.successCondition,

          failureBoundary:
            logic.failureBoundary,

          transferable:
            logic.transferable,
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
            .slice(0, 10),

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
          "项目出现终止/暂停/撤回信号，需要进一步判断是机制失败、分子问题、疗效不足、安全性还是患者选择问题。",

        mechanismNeed:
          "如果问题具有明确可补偿机制，可与已有Combination Pattern进行匹配。",
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
          "项目已完成，需要进一步确认疗效深度、持续性和特定人群获益限制。",

        mechanismNeed:
          "根据结果寻找可以改善疗效深度、持续性或患者选择的组合模式。",
      });
    }
  }

  return problems
    .slice(0, 12);
}

// ============================================================
// 建立“机制 → 当前真实分子”索引
//
// 这一步的作用：
// Pattern告诉我们需要什么机制。
// 然后从当前真实项目中寻找同机制的其他分子。
// ============================================================

function buildMechanismDrugIndex(
  trials
) {
  const map =
    new Map();

  for (const t of trials) {
    for (
      const drug of
      t.interventions || []
    ) {
      const mechanism =
        mechanismOf(drug);

      if (
        mechanism.id ===
        "UNKNOWN"
      ) {
        continue;
      }

      if (
        !map.has(
          mechanism.id
        )
      ) {
        map.set(
          mechanism.id,
          new Map()
        );
      }

      const drugMap =
        map.get(
          mechanism.id
        );

      const drugKey =
        norm(drug);

      if (
        !drugMap.has(
          drugKey
        )
      ) {
        drugMap.set(
          drugKey,
          {
            drug,

            mechanismId:
              mechanism.id,

            mechanism:
              mechanism.label,

            activeTrials:
              0,

            riskTrials:
              0,

            indications:
              new Set(),

            nctIds:
              [],
          }
        );
      }

      const x =
        drugMap.get(
          drugKey
        );

      if (
        RISK.has(
          t.status
        )
      ) {
        x.riskTrials++;
      } else {
        x.activeTrials++;
      }

      for (
        const indication of
        t.conditions || []
      ) {
        x.indications.add(
          indication
        );
      }

      if (
        t.nctId &&
        x.nctIds.length < 5
      ) {
        x.nctIds.push(
          t.nctId
        );
      }
    }
  }

  const result =
    new Map();

  for (
    const [
      mechanismId,
      drugMap,
    ] of map
  ) {
    result.set(
      mechanismId,
      [
        ...drugMap.values(),
      ].map((x) => ({
        ...x,

        indications: [
          ...x.indications,
        ].slice(0, 10),
      }))
    );
  }

  return result;
}

// ============================================================
// ClinicalTrials.gov 全库确认 A+B 是否已经存在
//
// 不是只看当前40条。
// 对候选组合再做一次独立检索。
// ============================================================

async function verifyExactCombination(
  a,
  b
) {
  try {
    const url =
      new URL(
        "https://clinicaltrials.gov/api/v2/studies"
      );

    url.searchParams.set(
      "query.term",
      `${a} AND ${b}`
    );

    url.searchParams.set(
      "pageSize",
      "20"
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

          cache:
            "no-store",
        }
      );

    if (!res.ok) {
      return {
        exists:
          false,

        verified:
          false,

        nctIds:
          [],
      };
    }

    const json =
      await res.json();

    const studies =
      (json.studies || [])
        .map(classify);

    const na =
      norm(a);

    const nb =
      norm(b);

    const hits =
      studies.filter(
        (study) => {
          const names =
            (
              study.interventions ||
              []
            ).map(norm);

          const hasA =
            names.some(
              (x) =>
                x === na ||
                x.includes(na) ||
                na.includes(x)
            );

          const hasB =
            names.some(
              (x) =>
                x === nb ||
                x.includes(nb) ||
                nb.includes(x)
            );

          return (
            hasA &&
            hasB
          );
        }
      );

    return {
      exists:
        hits.length > 0,

      verified:
        true,

      nctIds:
        hits
          .map(
            (x) =>
              x.nctId
          )
          .filter(Boolean)
          .slice(0, 5),
    };
  } catch {
    return {
      exists:
        false,

      verified:
        false,

      nctIds:
        [],
    };
  }
}

// ============================================================
// Potential New Combination Engine V2
//
// 核心逻辑：
//
// Existing Combination
// → Combination Pattern
// → 找同机制其他分子
// → Pattern迁移
// → 当前检索排除已有A+B
// → ClinicalTrials全库再次确认
// → Potential New Combination
// ============================================================

async function buildPotentialCombinations(
  trials,
  existingCombinations,
  combinationPatterns
) {
  const existingSet =
    new Set(
      existingCombinations.map(
        (x) =>
          pairKey(
            x.a,
            x.b
          )
      )
    );

  const mechanismIndex =
    buildMechanismDrugIndex(
      trials
    );

  const candidateMap =
    new Map();

  for (
    const pattern of
    combinationPatterns
  ) {
    if (
      !pattern.transferable
    ) {
      continue;
    }

    const drugsA =
      mechanismIndex.get(
        pattern.mechanismAId
      ) || [];

    const drugsB =
      mechanismIndex.get(
        pattern.mechanismBId
      ) || [];

    if (
      !drugsA.length ||
      !drugsB.length
    ) {
      continue;
    }

    for (
      const a of drugsA
    ) {
      for (
        const b of drugsB
      ) {
        if (
          norm(a.drug) ===
          norm(b.drug)
        ) {
          continue;
        }

        const key =
          pairKey(
            a.drug,
            b.drug
          );

        // 当前检索已经明确存在的组合
        if (
          existingSet.has(
            key
          )
        ) {
          continue;
        }

        // 候选至少一边应有活跃临床开发
        if (
          a.activeTrials === 0 ||
          b.activeTrials === 0
        ) {
          continue;
        }

        const indicationOverlap =
          overlap(
            a.indications,
            b.indications
          );

        const patternIndicationOverlap =
          overlap(
            [
              ...a.indications,
              ...b.indications,
            ],
            pattern.indications
          );

        const sourceExamples =
          pattern
            .sourceCombinations
            .slice(0, 3)
            .map(
              (x) =>
                x.combo
            );

        const score =
          pattern.trialCount * 3 +
          pattern.activeTrials * 2 +
          a.activeTrials +
          b.activeTrials +
          indicationOverlap.length * 3 +
          patternIndicationOverlap.length * 2 -
          a.riskTrials -
          b.riskTrials;

        const candidate = {
          a:
            a.drug,

          b:
            b.drug,

          mechanismA:
            a.mechanism,

          mechanismB:
            b.mechanism,

          problem:
            pattern.problem,

          compensation:
            pattern.compensation,

          rationale:
            `该候选不是随机配对，而是由已有“${pattern.pattern}”临床联合模式迁移而来。参考真实组合包括：${
              sourceExamples.join(
                "；"
              ) ||
              "已有同机制联合项目"
            }。`,

          referencePattern:
            pattern.pattern,

          patternSource:
            sourceExamples,

          transferRule:
            pattern.transferRule,

          successCondition:
            pattern.successCondition,

          failureBoundary:
            pattern.failureBoundary,

          evidenceStrength:
            pattern.evidenceStrength,

          sharedIndications:
            indicationOverlap
              .slice(0, 5),

          patternIndications:
            patternIndicationOverlap
              .slice(0, 5),

          developmentStatus:
            "待进行ClinicalTrials.gov全库组合核对",

          evidenceGap:
            "仍需补充PubMed机制证据、前临床协同、真实临床结果、安全窗以及具体适应症和患者选择依据。",

          score,
        };

        if (
          !candidateMap.has(
            key
          ) ||
          candidate.score >
            candidateMap.get(
              key
            ).score
        ) {
          candidateMap.set(
            key,
            candidate
          );
        }
      }
    }
  }

  const initialCandidates =
    [
      ...candidateMap.values(),
    ]
      .sort(
        (a, b) =>
          b.score -
          a.score
      )
      .slice(0, 12);

  // 对Top候选再查一次ClinicalTrials全库
  const checks =
    await Promise.all(
      initialCandidates.map(
        async (
          candidate
        ) => {
          const check =
            await verifyExactCombination(
              candidate.a,
              candidate.b
            );

          return {
            candidate,
            check,
          };
        }
      )
    );

  const result = [];

  for (
    const {
      candidate,
      check,
    } of checks
  ) {
    // 如果已经明确存在真实A+B，
    // 就不能再作为Potential New Combination
    if (
      check.verified &&
      check.exists
    ) {
      continue;
    }

    result.push({
      ...candidate,

      developmentStatus:
        check.verified
          ? "ClinicalTrials.gov全库暂未发现明确A+B临床开发"
          : "组合核对未完全完成，需人工再次确认",

      verification:
        check.verified
          ? "ClinicalTrials.gov已核对"
          : "ClinicalTrials.gov核对失败/不完整",

      verifiedExistingNctIds:
        check.nctIds,
    });
  }

  return result
    .slice(0, 10);
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
        cache:
          "no-store",
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
        cache:
          "no-store",
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
  // 1. High-Value Signal
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
  // 2. 失败项目
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
  // 4. 已有组合 → Pattern
  // ==========================================================

  const combinationPatterns =
    buildCombinationPatterns(
      existingCombinations
    );

  // ==========================================================
  // 5. 未解决问题
  // ==========================================================

  const unmetProblems =
    buildUnmetProblems(
      trials
    );

  // ==========================================================
  // 6. Pattern → Potential New Combination
  // ==========================================================

  const potentialCombinations =
    await buildPotentialCombinations(
      trials,
      existingCombinations,
      combinationPatterns
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

      transferablePatternCount:
        combinationPatterns.filter(
          (x) =>
            x.transferable
        ).length,

      potentialCombinationCount:
        potentialCombinations.length,
    },
  });
}
