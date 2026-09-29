export const dynamic = "force-dynamic";

/* ============================================================
   基础常量
   ============================================================ */

const RISK = new Set([
  "TERMINATED",
  "WITHDRAWN",
  "SUSPENDED",
]);

const ACTIVE_STATUS = new Set([
  "RECRUITING",
  "ACTIVE_NOT_RECRUITING",
  "NOT_YET_RECRUITING",
  "ENROLLING_BY_INVITATION",
]);

/* ============================================================
   基础工具
   ============================================================ */

function clean(x = "") {
  return String(x || "").trim();
}

function norm(x = "") {
  return clean(x)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function daysAgo(s) {
  if (!s) return 99999;

  const d = new Date(s);

  if (Number.isNaN(d.getTime())) {
    return 99999;
  }

  return Math.floor(
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

function unique(arr = []) {
  return [...new Set(arr.filter(Boolean))];
}

function overlap(a = [], b = []) {
  const bSet = new Set(
    b.map((x) => norm(x))
  );

  return a.filter((x) =>
    bSet.has(norm(x))
  );
}

/* ============================================================
   分子名称标准化

   解决：
   BNT327 Dose Level 1
   BNT327 Dose Level 2
   BNT327 (DL1)
   BNT327 20 mg/kg

   被错误识别为不同资产的问题
   ============================================================ */

function normalizeDrugName(name = "") {
  let x = clean(name);

  if (!x) return "";

  x = x
    // Dose Level 1 / Dose Level 2
    .replace(
      /\bdose\s*level\s*\d+\b/gi,
      ""
    )

    // DL1 / DL2
    .replace(
      /\bDL\s*\d+\b/gi,
      ""
    )

    // (DL1)
    .replace(
      /\(\s*DL\s*\d+\s*\)/gi,
      ""
    )

    // Cohort 1 / cohort A
    .replace(
      /\bcohort\s*[A-Za-z0-9-]+\b/gi,
      ""
    )

    // 20 mg / 10 mg/kg / 200 mg Q3W
    .replace(
      /\b\d+(\.\d+)?\s*(mg|mcg|µg|ug|g)(\/kg)?\b/gi,
      ""
    )

    // QW/Q2W/Q3W/Q4W
    .replace(
      /\bQ\d?W\b/gi,
      ""
    )

    .replace(/\s+/g, " ")
    .replace(/\(\s*\)/g, "")
    .trim();

  return x || clean(name);
}

/* ============================================================
   机制字典
   ============================================================ */

const MECHANISM_RULES = [
  {
    id: "PDL1_VEGF_BISPECIFIC",
    label: "PD-L1 × VEGF 双功能机制",
    keywords: [
      "bnt327",
      "pm8002",
      "imm2510",
    ],
  },

  {
    id: "PD1_VEGF_BISPECIFIC",
    label: "PD-1 × VEGF 双功能机制",
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
    label: "VEGF / VEGFR",
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
    id: "ADC",
    label: "ADC / 抗体偶联药物",
    keywords: [
      "deruxtecan",
      "vedotin",
      "govitecan",
      "tirumotecan",
      "emtansine",
      "mafodotin",
      "tesirine",
      "ozogamicin",
      "soravtansine",
      "bnt324",
      "db-1311",
      "skb264",
      "mk-2870",
      "rc48",
      "disitamab",
      "enfortumab",
      "datopotamab",
      "sacituzumab",
      "antibody drug conjugate",
      "adc",
    ],
  },

  {
    id: "RPT",
    label: "Radiopharmaceutical / 核素治疗",
    keywords: [
      "177lu",
      "lu-177",
      "lutetium",
      "225ac",
      "ac-225",
      "actinium",
      "212pb",
      "pb-212",
      "radioligand",
      "radiopharmaceutical",
      "pluvicto",
      "lutathera",
      "vipivotide",
      "dotatate",
      "psma-617",
    ],
  },

  {
    id: "ARPI",
    label: "AR pathway inhibitor",
    keywords: [
      "arpi",
      "androgen receptor pathway inhibitor",
      "enzalutamide",
      "abiraterone",
      "apalutamide",
      "darolutamide",
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
    id: "CHEMOTHERAPY",
    label: "Chemotherapy",
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

function mechanismOf(name = "") {
  const text = norm(
    normalizeDrugName(name)
  );

  if (!text) {
    return {
      id: "UNKNOWN",
      label: "机制待识别",
    };
  }

  for (const rule of MECHANISM_RULES) {
    const hit = rule.keywords.some(
      (keyword) =>
        text.includes(
          norm(keyword)
        )
    );

    if (hit) {
      return {
        id: rule.id,
        label: rule.label,
      };
    }
  }

  return {
    id: "UNKNOWN",
    label: "机制待识别",
  };
}


/* ============================================================
   Drug profile + explainable combination scoring
   ============================================================ */

const ADC_TARGET_RULES = [
  { keywords: ["trastuzumab deruxtecan", "t-dxd", "enhertu"], target: "HER2" },
  { keywords: ["datopotamab deruxtecan", "dato-dxd"], target: "TROP2" },
  { keywords: ["sacituzumab govitecan", "trodelvy"], target: "TROP2" },
  { keywords: ["sacituzumab tirumotecan", "skb264", "mk-2870"], target: "TROP2" },
  { keywords: ["enfortumab vedotin", "padcev"], target: "Nectin-4" },
  { keywords: ["disitamab vedotin", "rc48"], target: "HER2" },
  { keywords: ["bnt324", "db-1311"], target: "B7-H3" },
  { keywords: ["trastuzumab emtansine", "t-dm1", "kadcyla"], target: "HER2" },
  { keywords: ["mirvetuximab soravtansine", "elahere"], target: "FRα" },
  { keywords: ["tisotumab vedotin", "tivdak"], target: "Tissue Factor" },
  { keywords: ["polatuzumab vedotin", "polivy"], target: "CD79b" },
  { keywords: ["brentuximab vedotin", "adcetris"], target: "CD30" },
  { keywords: ["loncastuximab tesirine", "zynlonta"], target: "CD19" },
  { keywords: ["belantamab mafodotin", "blenrep"], target: "BCMA" },
];

function inferAdcPayload(name = "") {
  const x = norm(name);

  if (x.includes("deruxtecan")) {
    return {
      payload: "DXd / Topoisomerase-I inhibitor",
      linker: "cleavable linker",
      toxicityTags: ["myelosuppression", "ILD"],
    };
  }

  if (x.includes("vedotin")) {
    return {
      payload: "MMAE / microtubule inhibitor",
      linker: "protease-cleavable linker",
      toxicityTags: ["myelosuppression", "neuropathy"],
    };
  }

  if (x.includes("govitecan")) {
    return {
      payload: "SN-38 / Topoisomerase-I inhibitor",
      linker: "cleavable linker",
      toxicityTags: ["myelosuppression", "diarrhea"],
    };
  }

  if (x.includes("tirumotecan")) {
    return {
      payload: "Topoisomerase-I inhibitor payload",
      linker: "cleavable linker",
      toxicityTags: ["myelosuppression"],
    };
  }

  if (x.includes("emtansine")) {
    return {
      payload: "DM1 / microtubule inhibitor",
      linker: "non-cleavable linker",
      toxicityTags: ["thrombocytopenia", "hepatotoxicity"],
    };
  }

  return {
    payload: "Payload 待核对",
    linker: "Linker 待核对",
    toxicityTags: [],
  };
}

function toxicityTagsForMechanism(mechanismId) {
  const map = {
    PARP: ["myelosuppression"],
    CHEMOTHERAPY: ["myelosuppression"],
    VEGF: ["bleeding", "hypertension"],
    PD1: ["immune"],
    PDL1: ["immune"],
    CTLA4: ["immune"],
    PD1_VEGF_BISPECIFIC: ["immune", "bleeding", "hypertension"],
    PDL1_VEGF_BISPECIFIC: ["immune", "bleeding", "hypertension"],
    ARPI: ["cardiometabolic"],
  };

  return map[mechanismId] || [];
}

function drugProfile(name = "", knownMechanismId = null) {
  const cleanName = normalizeDrugName(name);
  const x = norm(cleanName);
  const mechanism = knownMechanismId
    ? MECHANISM_RULES.find((r) => r.id === knownMechanismId) || mechanismOf(cleanName)
    : mechanismOf(cleanName);

  if (mechanism.id === "ADC") {
    const targetRule = ADC_TARGET_RULES.find((rule) =>
      rule.keywords.some((k) => x.includes(norm(k)))
    );
    const payloadInfo = inferAdcPayload(cleanName);

    return {
      modality: "ADC",
      target: targetRule?.target || "Target 待核对",
      payload: payloadInfo.payload,
      linker: payloadInfo.linker,
      dar: "DAR 待核对具体分子",
      radionuclide: null,
      radiationType: null,
      toxicityTags: payloadInfo.toxicityTags,
    };
  }

  if (mechanism.id === "RPT") {
    let target = "Target 待核对";
    if (x.includes("psma")) target = "PSMA";
    if (x.includes("dotatate") || x.includes("lutathera")) target = "SSTR";

    let radionuclide = "核素待核对";
    let radiationType = "辐射类型待核对";

    if (x.includes("177lu") || x.includes("lu 177") || x.includes("lutetium")) {
      radionuclide = "Lu-177";
      radiationType = "β-emitter";
    }

    if (x.includes("225ac") || x.includes("ac 225") || x.includes("actinium")) {
      radionuclide = "Ac-225";
      radiationType = "α-emitter";
    }

    if (x.includes("212pb") || x.includes("pb 212")) {
      radionuclide = "Pb-212";
      radiationType = "α-emitting decay chain";
    }

    return {
      modality: "RPT",
      target,
      payload: null,
      linker: "Chelator / targeting construct 待核对",
      dar: null,
      radionuclide,
      radiationType,
      toxicityTags: ["myelosuppression", "renal"],
    };
  }

  return {
    modality: mechanism.label || "机制待识别",
    target: mechanism.label || "Target 待核对",
    payload: null,
    linker: null,
    dar: null,
    radionuclide: null,
    radiationType: null,
    toxicityTags: toxicityTagsForMechanism(mechanism.id),
  };
}

function mechanismPairKey(a, b) {
  return [a, b].sort().join("__");
}

const COMPLEMENTARITY_SCORE = {
  ADC__PD1: 23,
  ADC__PDL1: 23,
  ADC__PD1_VEGF_BISPECIFIC: 25,
  ADC__PDL1_VEGF_BISPECIFIC: 25,
  ADC__VEGF: 20,
  ADC__PARP: 24,
  ARPI__RPT: 22,
  PARP__RPT: 24,
  PD1__RPT: 21,
  PDL1__RPT: 21,
  PD1__VEGF: 23,
  PDL1__VEGF: 23,
  CTLA4__PD1: 22,
  CTLA4__PDL1: 22,
  BCL2__CD20: 23,
  BTK__CD20: 22,
};

function assessSafety(profileA, profileB, mechanismAId, mechanismBId) {
  const a = new Set(profileA?.toxicityTags || []);
  const b = new Set(profileB?.toxicityTags || []);
  const overlapTags = [...a].filter((x) => b.has(x));
  const pair = mechanismPairKey(mechanismAId, mechanismBId);

  let risk = "Low";
  let safetyScore = 10;

  if (
    overlapTags.length >= 2 ||
    pair === "ADC__PARP" ||
    pair === "PARP__RPT"
  ) {
    risk = "High";
    safetyScore = 4;
  } else if (
    overlapTags.length === 1 ||
    a.size === 0 ||
    b.size === 0
  ) {
    risk = "Medium";
    safetyScore = 7;
  }

  return {
    risk,
    safetyScore,
    overlapTags,
    rationale: overlapTags.length
      ? "主要重叠风险：" + overlapTags.join("、")
      : risk === "Low"
      ? "当前规则未识别明显主要毒性重叠"
      : "安全性信息仍有缺口，暂不按低风险处理",
  };
}

function classifyCombinationStrategy({
  mechanismAId,
  mechanismBId,
  designType = null,
}) {
  if (designType === "BISPECIFIC_ADC") return "双靶点设计";
  if (designType === "DUAL_PAYLOAD_ADC") return "双Payload设计";
  if (designType === "MODALITY_UPGRADE") return "Modality升级";

  const pair = mechanismPairKey(mechanismAId, mechanismBId);

  if (
    pair.includes("ADC") &&
    (
      pair.includes("PARP") ||
      pair.includes("EGFR") ||
      pair.includes("VEGF") ||
      pair.includes("KRAS") ||
      pair.includes("BTK")
    )
  ) {
    return "靶向联合";
  }

  return "药物间联合";
}

function evidenceTierForCombination({
  samePattern,
  mechanismAId,
  mechanismBId,
  novelDesign = false,
}) {
  if (novelDesign) {
    return {
      code: "L4",
      label: "机制推演 / 分子设计假设",
    };
  }

  const leadingPhaseRank =
    samePattern?.leadingPhaseRank || 0;

  if (leadingPhaseRank >= 3) {
    return {
      code: "L1",
      label: "III期 / 注册性临床验证",
    };
  }

  if ((samePattern?.trialCount || 0) > 0) {
    return {
      code: "L2",
      label: "已有临床联合探索",
    };
  }

  const pair =
    mechanismPairKey(
      mechanismAId,
      mechanismBId
    );

  if (COMPLEMENTARITY_SCORE[pair] != null) {
    return {
      code: "L3",
      label: "同机制 / 规则支持，暂无直接临床联合",
    };
  }

  return {
    code: "L4",
    label: "主要为机制推演",
  };
}

function buildPredictionBasis({
  mechanismAId,
  mechanismBId,
  profileA,
  profileB,
  scoreBreakdown,
}) {
  const items = [];

  const targetA = profileA?.target || "";
  const targetB = profileB?.target || "";

  if (
    targetA &&
    targetB &&
    !targetA.includes("待核对") &&
    !targetB.includes("待核对") &&
    norm(targetA) !== norm(targetB)
  ) {
    items.push(
      "靶点 / 作用层面互补：" +
      targetA +
      " ↔ " +
      targetB
    );
  }

  if (
    (scoreBreakdown?.mechanismComplementarity || 0) >= 22
  ) {
    items.push("机制互补：高");
  } else if (
    (scoreBreakdown?.mechanismComplementarity || 0) >= 17
  ) {
    items.push("机制互补：中高");
  }

  if (
    (scoreBreakdown?.payloadRationale || 0) >= 13
  ) {
    items.push("Payload / 杀伤协同：高");
  }

  if (
    (scoreBreakdown?.unmetNeedResolution || 0) >= 13
  ) {
    items.push("耐药 / 未满足需求互补：高");
  }

  const pair =
    mechanismPairKey(
      mechanismAId,
      mechanismBId
    );

  if (
    pair.includes("ADC") &&
    (
      pair.includes("PD1") ||
      pair.includes("PDL1") ||
      pair.includes("VEGF")
    )
  ) {
    items.push("TME / 免疫协同：值得优先验证");
  }

  return items;
}

function scoreCombination({
  mechanismAId,
  mechanismBId,
  indicationOverlap = [],
  samePattern = null,
  candidateDrug = null,
  profileA,
  profileB,
}) {
  const pair = mechanismPairKey(mechanismAId, mechanismBId);

  const diseaseFit =
    indicationOverlap.length >= 2
      ? 20
      : indicationOverlap.length === 1
      ? 17
      : candidateDrug
      ? 11
      : 8;

  const mechanismComplementarity =
    COMPLEMENTARITY_SCORE[pair] ??
    (mechanismAId !== mechanismBId &&
    mechanismAId !== "UNKNOWN" &&
    mechanismBId !== "UNKNOWN"
      ? 17
      : 8);

  let payloadRationale = 6;

  if (pair === "ADC__PARP" || pair === "PARP__RPT") {
    payloadRationale = 15;
  } else if (
    pair === "ADC__PD1" ||
    pair === "ADC__PDL1" ||
    pair === "ADC__PD1_VEGF_BISPECIFIC" ||
    pair === "ADC__PDL1_VEGF_BISPECIFIC"
  ) {
    payloadRationale = 13;
  } else if (pair.includes("ADC") || pair.includes("RPT")) {
    payloadRationale = 10;
  }

  let unmetNeedResolution = 10;

  if (
    pair === "ADC__PARP" ||
    pair === "PARP__RPT" ||
    pair === "ADC__PD1_VEGF_BISPECIFIC" ||
    pair === "ADC__PDL1_VEGF_BISPECIFIC"
  ) {
    unmetNeedResolution = 15;
  } else if (
    mechanismAId !== mechanismBId &&
    mechanismAId !== "UNKNOWN" &&
    mechanismBId !== "UNKNOWN"
  ) {
    unmetNeedResolution = 12;
  }

  const patternTrials = samePattern?.trialCount || 0;

  const competitionWindow =
    assessCompetitionWindow({
      samePattern,
      candidateDrug,
    });

  const timeWindow =
    competitionWindow.score;

  const moleculeMaturity =
    candidateDrug?.activeTrials >= 5
      ? 10
      : candidateDrug?.activeTrials >= 2
      ? 9
      : candidateDrug?.activeTrials >= 1
      ? 8
      : candidateDrug?.source === "catalog"
      ? 7
      : 6;

  const evidenceLevel =
    patternTrials >= 5
      ? "同类联合临床证据较多"
      : patternTrials >= 2
      ? "已有同类联合临床验证"
      : patternTrials === 1
      ? "存在早期同类临床线索"
      : "主要为机制推导";

  const evidenceTier =
    evidenceTierForCombination({
      samePattern,
      mechanismAId,
      mechanismBId,
    });

  const combinationStrategy =
    classifyCombinationStrategy({
      mechanismAId,
      mechanismBId,
    });

  const precedentLevel =
    patternTrials > 0
      ? "已有同类前车之鉴"
      : "暂无直接前车之鉴";

  const timeWindowLabel =
    competitionWindow.label;

  const safety = assessSafety(
    profileA,
    profileB,
    mechanismAId,
    mechanismBId
  );

  const scoreBreakdown = {
    diseaseFit,
    mechanismComplementarity,
    payloadRationale,
    unmetNeedResolution,
    timeWindow,
    moleculeMaturity,
  };

  const predictionBasis =
    buildPredictionBasis({
      mechanismAId,
      mechanismBId,
      profileA,
      profileB,
      scoreBreakdown,
    });

  return {
    opportunityScore: Object.values(scoreBreakdown).reduce(
      (sum, value) => sum + value,
      0
    ),
    scoreBreakdown,
    risk: safety.risk,
    riskRationale: safety.rationale,
    evidenceLevel,
    evidenceTier,
    combinationStrategy,
    predictionBasis,
    precedentLevel,
    timeWindow,
    timeWindowLabel,
    competitionWindow,
  };
}

/* ============================================================
   High-Value Signal
   ============================================================ */

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
      "项目出现终止、暂停或撤回，需要进一步核对具体原因"
    );

    primaryType =
      "失败/暂停";

    nextCheck =
      "优先区分疗效、安全性、剂量、人群选择、研究设计、机制及公司战略因素。";
  }

  if (
    status === "COMPLETED"
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
      "重点核对正式临床结果、会议摘要、论文及公司公告。";
  }

  if (hasCombo) {
    score += 2;

    reasons.push(
      `存在真实多干预开发（${interventions.length}个干预），可作为联合开发证据`
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
        "核对联合原因、疗效、安全性，以及该联合规律能否支持新的研发假设。";
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
      "已进入III期，后续结果可能影响竞争格局"
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

  if (!reasons.length) {
    reasons.push(
      "与当前检索相关，但暂未出现强情报触发信号"
    );
  }

  return {
    score,
    reasons,
    primaryType,
    nextCheck,
  };
}

/* ============================================================
   ClinicalTrials.gov 数据标准化
   ============================================================ */

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

  const rawInterventions =
    (ai.interventions || [])
      .map((x) =>
        clean(x.name)
      )
      .filter(Boolean);

  const interventions =
    unique(
      rawInterventions
        .map(normalizeDrugName)
        .filter(Boolean)
    );

  const conditions =
    unique(
      (c.conditions || [])
        .map(clean)
        .filter(Boolean)
    );

  const aliases =
    unique(
      (c.keywords || [])
        .map(clean)
        .filter(Boolean)
    );

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

    phases,

    sponsor:
      sp.leadSponsor?.name ||
      "Unknown",

    conditions,

    aliases,

    interventions,

    rawInterventions,

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

/* ============================================================
   相关性
   ============================================================ */

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

/* ============================================================
   ClinicalTrials.gov
   ============================================================ */

async function fetchTrials(
  q,
  kind = "term",
  pageSize = 50
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

/* ============================================================
   竞争阶段 / 时间窗口基础函数
   ============================================================ */

function phaseRank(phases = []) {
  const text = (phases || [])
    .join(" ")
    .toUpperCase();

  if (text.includes("PHASE4") || text.includes("PHASE 4")) return 4;
  if (text.includes("PHASE3") || text.includes("PHASE 3")) return 3;
  if (text.includes("PHASE2") || text.includes("PHASE 2")) return 2;
  if (
    text.includes("PHASE1") ||
    text.includes("PHASE 1") ||
    text.includes("EARLY_PHASE1") ||
    text.includes("EARLY PHASE 1")
  ) return 1;

  return 0;
}

function phaseLabel(rank = 0) {
  if (rank >= 4) return "IV期 / 上市后";
  if (rank === 3) return "III期";
  if (rank === 2) return "II期";
  if (rank === 1) return "I期 / 早期";
  return "未发现明确领先临床阶段";
}

function estimateCatchUpGap(rank = 0) {
  if (rank >= 4) return "≥5年";
  if (rank === 3) return "约4–6年";
  if (rank === 2) return "约2–4年";
  if (rank === 1) return "约0–2年";
  return "尚未形成明确阶段差";
}

function assessCompetitionWindow({
  samePattern,
  candidateDrug,
}) {
  const totalTrials = samePattern?.trialCount || 0;
  const activeTrials = samePattern?.activeTrials || 0;
  const leadingPhaseRank = samePattern?.leadingPhaseRank || 0;
  const leadingPhase = phaseLabel(leadingPhaseRank);

  let score = 15;

  if (leadingPhaseRank >= 4) score -= 7;
  else if (leadingPhaseRank === 3) score -= 6;
  else if (leadingPhaseRank === 2) score -= 3;
  else if (leadingPhaseRank === 1) score -= 1;

  if (activeTrials >= 8) score -= 3;
  else if (activeTrials >= 4) score -= 2;
  else if (activeTrials >= 2) score -= 1;

  if (totalTrials >= 12) score -= 2;
  else if (totalTrials >= 6) score -= 1;

  score = Math.max(0, Math.min(15, score));

  const label =
    score >= 13 ? "窗口较好" :
    score >= 9 ? "仍有窗口" :
    score >= 5 ? "开始拥挤" : "窗口偏晚";

  const competitionDensity =
    activeTrials >= 8 || totalTrials >= 12 ? "很高" :
    activeTrials >= 4 || totalTrials >= 6 ? "高" :
    activeTrials >= 2 || totalTrials >= 3 ? "中" : "低";

  const differentiationNeed =
    score >= 13
      ? "可优先验证机制与人群，不必依赖强差异化"
      : score >= 9
      ? "建议至少具备适应症、biomarker、分子或给药方案之一的差异化"
      : score >= 5
      ? "需要较强差异化，否则时间成本可能削弱商业价值"
      : "除非存在非常明确的差异化优势，否则进入时机偏晚";

  const estimatedCatchUp = estimateCatchUpGap(leadingPhaseRank);

  const leadingExamples =
    (samePattern?.sourceCombinations || [])
      .slice(0, 3)
      .map((x) => x.combo)
      .filter(Boolean);

  const partnerReadiness =
    candidateDrug?.activeTrials >= 3
      ? "Partner已有较多临床开发，可降低组合启动准备成本"
      : candidateDrug?.activeTrials >= 1
      ? "Partner已有临床开发基础"
      : candidateDrug?.source === "catalog"
      ? "Partner为候选目录资产，仍需核对可获得性和开发成熟度"
      : "Partner成熟度仍需进一步核对";

  const summary =
    totalTrials === 0
      ? "当前检索未发现明确同类联合临床开发，竞争窗口相对靠前。"
      : "同类联合最高已到" + leadingPhase +
        "；活跃项目" + activeTrials + "项 / 总计" + totalTrials +
        "项；按当前阶段差粗略估算追赶压力" + estimatedCatchUp + "。";

  return {
    score,
    label,
    leadingPhase,
    leadingPhaseRank,
    activeTrials,
    totalTrials,
    competitionDensity,
    estimatedCatchUp,
    differentiationNeed,
    leadingExamples,
    partnerReadiness,
    summary,
  };
}
/* ============================================================
   已有联合
   ============================================================ */

function buildExistingCombinations(
  trials
) {
  const map =
    new Map();

  for (const t of trials) {
    const names =
      unique(
        (
          t.interventions ||
          []
        )
          .map(
            normalizeDrugName
          )
          .filter(
            (x) =>
              x.length > 1
          )
      );

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

              nctIds:
                [],
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
        } else if (
          ACTIVE_STATUS.has(
            t.status
          ) ||
          t.status ===
            "COMPLETED"
        ) {
          x.active++;
        }

        if (
          daysAgo(
            t.updated
          ) <= 180
        ) {
          x.recent++;
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
          t.phase &&
          t.phase !== "NA"
        ) {
          x.phases.add(
            t.phase
          );
        }

        if (
          t.nctId &&
          x.nctIds.length < 6
        ) {
          x.nctIds.push(
            t.nctId
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

      indications:
        [
          ...x.indications,
        ].slice(0, 8),

      phases:
        [
          ...x.phases,
        ].slice(0, 5),

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
    .slice(0, 50);
}

/* ============================================================
   On Going Pattern 逻辑
   ============================================================ */

const PATTERN_LOGIC = {
  "PD1__VEGF": {
    problem:
      "PD-1阻断后，VEGF驱动的异常血管及免疫抑制微环境仍可能限制T细胞浸润和持续应答。",

    compensation:
      "VEGF/VEGFR抑制可能改善肿瘤血管和免疫微环境，与PD-1通路形成机制互补。",

    transferRule:
      "如果其他PD-1类资产仍受到VEGF相关免疫抑制限制，可参考该联合规律。",

    successCondition:
      "适应症同时存在免疫治疗基础及较明显的血管生成生物学。",

    failureBoundary:
      "需要关注抗血管生成相关毒性、免疫毒性、剂量及不同瘤种的VEGF依赖程度。",

    transferable:
      true,
  },

  "PDL1__VEGF": {
    problem:
      "PD-L1阻断解除部分免疫逃逸，但VEGF驱动的免疫抑制微环境仍可能限制疗效。",

    compensation:
      "VEGF/VEGFR抑制可能改善肿瘤血管和免疫微环境，与PD-L1阻断形成互补。",

    transferRule:
      "可作为其他PD-L1资产或其他VEGF通路资产的联合参考，但需重新验证适应症和安全窗。",

    successCondition:
      "更适合同时具有免疫治疗基础和血管生成驱动特征的疾病。",

    failureBoundary:
      "不同分子的强度、半衰期及安全性不同，同靶点并不意味着结果可以直接复制。",

    transferable:
      true,
  },

  "CTLA4__PD1": {
    problem:
      "PD-1阻断主要作用于效应阶段，部分患者可能存在T细胞初始激活不足。",

    compensation:
      "CTLA-4阻断可增强T细胞启动和克隆扩增，与PD-1形成不同免疫阶段的互补。",

    transferRule:
      "若新的PD-1资产仍存在免疫启动不足，可参考PD-1 + CTLA-4联合规律。",

    successCondition:
      "需要更强免疫激活，且患者能够承受更高免疫相关毒性的场景。",

    failureBoundary:
      "免疫相关AE可能明显增加，剂量和患者选择非常关键。",

    transferable:
      true,
  },

  "BCL2__CD20": {
    problem:
      "CD20介导B细胞清除后，部分异常B细胞仍可能通过抗凋亡机制存活。",

    compensation:
      "BCL-2抑制促进异常B细胞凋亡，与CD20介导的细胞清除形成互补。",

    transferRule:
      "在B细胞疾病中，可参考CD20 + BCL-2联合规律寻找其他同机制资产。",

    successCondition:
      "疾病具有明确B细胞依赖和BCL-2抗凋亡特征。",

    failureBoundary:
      "需关注骨髓抑制、感染和肿瘤溶解风险。",

    transferable:
      true,
  },

  "BTK__CD20": {
    problem:
      "CD20清除可能无法完全抑制持续存在的BCR/BTK信号。",

    compensation:
      "BTK抑制阻断BCR信号，与CD20介导的B细胞清除形成机制互补。",

    transferRule:
      "如果CD20资产存在持续B细胞信号或残留问题，可参考CD20 + BTK模式。",

    successCondition:
      "疾病存在明显BCR/BTK依赖。",

    failureBoundary:
      "感染、出血、心血管风险和长期联合耐受性需重点关注。",

    transferable:
      true,
  },

  "CHEMOTHERAPY__PD1_VEGF_BISPECIFIC": {
    problem:
      "PD-1×VEGF双功能机制可能仍受到高肿瘤负荷、抗原释放不足和快速进展限制。",

    compensation:
      "化疗可实现快速减瘤并促进抗原释放，为免疫和抗血管生成机制提供更强初始条件。",

    transferRule:
      "如果同类PD-1×VEGF资产单药起效深度不足，可参考与化疗联合的开发规律。",

    successCondition:
      "疾病需要快速控制，同时免疫+抗血管生成机制具有长期获益潜力。",

    failureBoundary:
      "骨髓抑制、感染、出血及整体耐受性可能限制联合剂量。",

    transferable:
      true,
  },

  "CHEMOTHERAPY__PDL1_VEGF_BISPECIFIC": {
    problem:
      "PD-L1×VEGF双功能机制仍可能存在早期减瘤不足或部分患者原发耐药。",

    compensation:
      "化疗提供直接细胞毒作用和抗原释放，与免疫解除抑制及抗血管生成形成互补。",

    transferRule:
      "已有PD-L1×VEGF + 化疗开发可作为其他同机制资产的参考。",

    successCondition:
      "适应症已有免疫联合化疗基础，且疾病进展速度要求较快起效。",

    failureBoundary:
      "需关注骨髓抑制、血小板、出血风险以及复杂联合下的剂量优化。",

    transferable:
      true,
  },
};

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
      ma.id === "UNKNOWN" ||
      mb.id === "UNKNOWN"
    ) {
      continue;
    }

    const sorted =
      [ma, mb].sort(
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
          "已有临床联合提示两个机制可能存在互补，但当前尚缺完整机制解释。",

        compensation:
          "需要结合机制研究和临床结果进一步判断互补关系。",

        transferRule:
          "暂不自动迁移。",

        successCondition:
          "待进一步验证。",

        failureBoundary:
          "待进一步验证。",

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

          leadingPhaseRank:
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

    const p =
      patternMap.get(
        patternKey
      );

    p.sourceCombinations.push({
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

      phases:
        combo.phases || [],
    });

    p.trialCount +=
      combo.trials || 0;

    p.activeTrials +=
      combo.active || 0;

    p.failedTrials +=
      combo.risk || 0;

    p.leadingPhaseRank =
      Math.max(
        p.leadingPhaseRank || 0,
        phaseRank(combo.phases || [])
      );

    for (
      const indication of
      combo.indications || []
    ) {
      p.indications.add(
        indication
      );
    }
  }

  return [
    ...patternMap.values(),
  ]
    .map((p) => ({
      ...p,

      indications:
        [
          ...p.indications,
        ].slice(0, 8),

      sourceCombinations:
        p.sourceCombinations
          .slice(0, 10),

      evidenceStrength:
        p.trialCount >= 5
          ? "较多临床开发证据"
          : p.trialCount >= 2
          ? "已有临床验证"
          : "早期临床线索",
    }))
    .sort(
      (a, b) =>
        b.trialCount -
        a.trialCount
    )
    .slice(0, 30);
}

/* ============================================================
   终止 / 暂停
   ============================================================ */

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

/* ============================================================
   未解决问题
   ============================================================ */

function buildUnmetProblems(
  trials
) {
  const problems = [];

  for (const t of trials) {
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

        signalType:
          "终止 / 暂停",

        problem:
          "项目出现终止或暂停，需要进一步确认是否存在疗效、安全性、剂量、人群、机制或战略问题。",

        mechanismNeed:
          "若问题具有明确可补偿机制，可进一步形成新的联合假设。",
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

        signalType:
          "关键读出",

        problem:
          "项目已完成，需要进一步核对疗效深度、持续性、安全性和患者分层结果。",

        mechanismNeed:
          "如果正式结果暴露明确短板，可进一步寻找互补机制。",
      });
    }
  }

  return problems
    .slice(0, 15);
}

/* ============================================================
   机制 → 分子索引
   ============================================================ */

function buildMechanismDrugIndex(
  trials
) {
  const map =
    new Map();

  for (const t of trials) {
    for (
      const rawDrug of
      t.interventions || []
    ) {
      const drug =
        normalizeDrugName(
          rawDrug
        );

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

      const key =
        norm(drug);

      if (
        !drugMap.has(key)
      ) {
        drugMap.set(
          key,
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
        drugMap.get(key);

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

        indications:
          [
            ...x.indications,
          ].slice(0, 10),
      }))
    );
  }

  return result;
}

/* ============================================================
   A+B 现有开发核对
   ============================================================ */

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
      norm(
        normalizeDrugName(a)
      );

    const nb =
      norm(
        normalizeDrugName(b)
      );

    const hits =
      studies.filter(
        (study) => {
          const names =
            (
              study.interventions ||
              []
            ).map(
              (x) =>
                norm(
                  normalizeDrugName(
                    x
                  )
                )
            );

          const hasA =
            names.some(
              (x) =>
                x === na ||
                x.includes(
                  na
                ) ||
                na.includes(
                  x
                )
            );

          const hasB =
            names.some(
              (x) =>
                x === nb ||
                x.includes(
                  nb
                ) ||
                nb.includes(
                  x
                )
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

/* ============================================================
   On Going Pattern 迁移机会

   这一部分继续服务：
   On Going｜在研联合
   ============================================================ */

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

        if (
          existingSet.has(
            key
          )
        ) {
          continue;
        }

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
          indicationOverlap.length * 3;

        const profileA =
          drugProfile(
            a.drug,
            pattern.mechanismAId
          );

        const profileB =
          drugProfile(
            b.drug,
            pattern.mechanismBId
          );

        const assessment =
          scoreCombination({
            mechanismAId:
              pattern.mechanismAId,

            mechanismBId:
              pattern.mechanismBId,

            indicationOverlap,

            samePattern:
              pattern,

            candidateDrug:
              b,

            profileA,

            profileB,
          });

        const candidate = {
          a:
            a.drug,

          b:
            b.drug,

          mechanismA:
            a.mechanism,

          mechanismB:
            b.mechanism,

          mechanismAId:
            pattern.mechanismAId,

          mechanismBId:
            pattern.mechanismBId,

          profileA,

          profileB,

          opportunityScore:
            assessment.opportunityScore,

          scoreBreakdown:
            assessment.scoreBreakdown,

          risk:
            assessment.risk,

          riskRationale:
            assessment.riskRationale,

          evidenceLevel:
            assessment.evidenceLevel,

          evidenceTier:
            assessment.evidenceTier,

          combinationStrategy:
            assessment.combinationStrategy,

          predictionBasis:
            assessment.predictionBasis,

          precedentLevel:
            assessment.precedentLevel,

          timeWindow:
            assessment.timeWindow,

          timeWindowLabel:
            assessment.timeWindowLabel,

          competitionWindow:
            assessment.competitionWindow,

          problem:
            pattern.problem,

          compensation:
            pattern.compensation,

          rationale:
            `该候选由已有“${pattern.pattern}”联合规律迁移而来。参考联合包括：${
              sourceExamples.join(
                "；"
              ) ||
              "已有同机制临床联合"
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

          developmentStatus:
            "待进一步核对现有开发情况",

          evidenceGap:
            "仍需补充具体机制、前临床协同、临床疗效和安全性证据。",

          marketWindow:
            assessment.competitionWindow?.summary || "",

          score:
            assessment.opportunityScore,
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

  const initial =
    [
      ...candidateMap.values(),
    ]
      .sort(
        (a, b) =>
          b.score -
          a.score
      )
      .slice(0, 10);

  const checks =
    await Promise.all(
      initial.map(
        async (
          candidate
        ) => ({
          candidate,

          check:
            await verifyExactCombination(
              candidate.a,
              candidate.b
            ),
        })
      )
    );

  const result = [];

  for (
    const {
      candidate,
      check,
    } of checks
  ) {
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
          ? "ClinicalTrials.gov 暂未发现明确 A+B 临床开发"
          : "现有开发状态待进一步确认",

      verification:
        check.verified
          ? "ClinicalTrials.gov 已核对"
          : "ClinicalTrials.gov 核对不完整",
    });
  }

  return result.slice(
    0,
    8
  );
}

/* ============================================================
   Signal-driven Combination Engine V1

   这是这一版真正新增的核心。

   不再从“已有联合”开始。

   而是：

   最新 Signal
   ↓
   识别当前问题
   ↓
   寻找可能互补机制
   ↓
   候选联合
   ↓
   已有证据作为支持
   ↓
   核对现有开发
   ↓
   判断时间窗口
   ============================================================ */

/*
  这里是“机制假设库”。

  它和 PATTERN_LOGIC 不一样：

  PATTERN_LOGIC：
  来自已经存在的联合。

  SIGNAL_RULES：
  用于在出现新 Signal 后，
  判断“下一步可能需要什么机制”。

  后面接入最新论文、会议和公司公告后，
  这里会进一步动态化。
*/

const SIGNAL_RULES = {
  PD1: [
    {
      targetMechanismId:
        "VEGF",

      problem:
        "如果最新 Signal 提示PD-1类资产仍存在免疫浸润不足、原发耐药或持续应答不足，需要考虑肿瘤微环境因素。",

      compensation:
        "VEGF/VEGFR通路抑制可能改善异常血管和免疫抑制微环境。",

      rationale:
        "由当前PD-1项目动态触发，重点验证VEGF相关微环境是否构成新的联合切入点。",
    },

    {
      targetMechanismId:
        "CTLA4",

      problem:
        "如果最新 Signal 提示PD-1阻断后仍存在免疫启动不足，可进一步考虑T细胞初始激活环节。",

      compensation:
        "CTLA-4阻断可能增强T细胞启动和克隆扩增。",

      rationale:
        "由PD-1项目的最新研发变化触发，重点判断是否存在免疫启动不足这一可补偿问题。",
    },
  ],

  PDL1: [
    {
      targetMechanismId:
        "VEGF",

      problem:
        "如果最新 Signal 提示PD-L1资产疗效深度或持续性仍有限，需要进一步判断肿瘤血管和免疫抑制微环境的影响。",

      compensation:
        "VEGF/VEGFR抑制可能改善肿瘤血管和免疫微环境。",

      rationale:
        "由PD-L1资产的最新动态触发，验证抗血管生成机制是否具备互补价值。",
    },
  ],

  PDL1_VEGF_BISPECIFIC: [
    {
      targetMechanismId:
        "CTLA4",

      problem:
        "如果PD-L1×VEGF双功能机制已经改善免疫抑制和血管环境，但部分患者仍存在免疫启动不足，可继续关注上游T细胞激活。",

      compensation:
        "CTLA-4机制可能进一步增强T细胞启动和克隆扩增。",

      rationale:
        "由双功能资产的最新临床 Signal 触发，探索是否仍存在免疫启动层面的未解决问题。",
    },

    {
      targetMechanismId:
        "CHEMOTHERAPY",

      problem:
        "如果双功能资产存在早期减瘤速度、原发耐药或高肿瘤负荷场景下的疾病控制不足，需要考虑快速减瘤机制。",

      compensation:
        "化疗可提供直接细胞毒作用并促进抗原释放。",

      rationale:
        "由双功能资产最新临床动态触发，判断是否需要增强早期疾病控制。",
    },
  ],

  PD1_VEGF_BISPECIFIC: [
    {
      targetMechanismId:
        "CTLA4",

      problem:
        "如果PD-1×VEGF资产仍存在免疫启动不足，可进一步关注CTLA-4层面的互补机制。",

      compensation:
        "CTLA-4机制可能加强T细胞启动和扩增。",

      rationale:
        "由双功能资产最新研发 Signal 触发，寻找剩余免疫瓶颈。",
    },

    {
      targetMechanismId:
        "CHEMOTHERAPY",

      problem:
        "如果双功能资产的早期疾病控制仍不足，可考虑增加直接细胞毒作用。",

      compensation:
        "化疗可能提供快速减瘤及抗原释放。",

      rationale:
        "由最新临床 Signal 触发，判断是否需要加强早期疾病控制能力。",
    },
  ],

  ADC: [
    {
      targetMechanismId:
        "PD1",

      problem:
        "如果ADC已经具备直接肿瘤杀伤，但疗效深度或持续性仍有限，需要判断是否存在免疫抑制导致的残留疾病。",

      compensation:
        "PD-1阻断可解除T细胞抑制，与ADC导致的肿瘤细胞死亡和抗原释放形成互补。",

      rationale:
        "由ADC项目动态触发，重点验证细胞毒杀伤与免疫激活能否形成互补。",
    },

    {
      targetMechanismId:
        "PDL1_VEGF_BISPECIFIC",

      problem:
        "如果ADC单药存在肿瘤微环境抑制、异质性或持续应答不足，可同时考虑免疫和血管生成两个维度。",

      compensation:
        "PD-L1×VEGF机制可能同时解除免疫抑制并改善肿瘤血管/TME，与ADC直接杀伤形成三层互补。",

      rationale:
        "由ADC项目动态触发，探索ADC + IO + VEGF方向。",
    },

    {
      targetMechanismId:
        "PARP",

      problem:
        "如果ADC payload通过DNA损伤发挥作用，但肿瘤仍可通过DNA损伤修复存活，可关注DDR相关耐药。",

      compensation:
        "PARP抑制可能降低DNA损伤修复能力，形成payload-level协同。",

      rationale:
        "由ADC payload机制触发，优先在Topo-I等DNA损伤型payload中验证。",
    },
  ],

  RPT: [
    {
      targetMechanismId:
        "ARPI",

      problem:
        "如果靶向核素治疗后仍存在AR通路驱动疾病，可考虑同时压制肿瘤生物学驱动。",

      compensation:
        "ARPI抑制前列腺癌关键驱动通路，与核素产生的DNA损伤形成不同层面的互补。",

      rationale:
        "由RPT项目动态触发，重点用于PSMA相关前列腺癌场景判断。",
    },

    {
      targetMechanismId:
        "PARP",

      problem:
        "核素治疗造成DNA损伤后，肿瘤细胞可能依赖DNA损伤修复维持存活。",

      compensation:
        "PARP抑制可能削弱DNA修复能力，与放射性损伤形成机制协同。",

      rationale:
        "由RPT的DNA损伤机制触发，但骨髓抑制重叠风险需要单独评估。",
    },

    {
      targetMechanismId:
        "PD1",

      problem:
        "如果核素治疗产生局部肿瘤损伤但系统免疫应答仍不足，可关注免疫抑制环节。",

      compensation:
        "PD-1阻断可能放大肿瘤损伤后的免疫效应。",

      rationale:
        "由RPT项目动态触发，作为机制假设进行验证。",
    },
  ],

  CD20: [
    {
      targetMechanismId:
        "BTK",

      problem:
        "如果B细胞清除后仍存在持续BCR信号或残留异常B细胞，需要关注细胞内存活信号。",

      compensation:
        "BTK抑制可能阻断BCR信号并减少异常B细胞持续存活。",

      rationale:
        "由CD20类项目动态触发，寻找B细胞清除之外的持续信号控制机制。",
    },

    {
      targetMechanismId:
        "BCL2",

      problem:
        "如果CD20介导的清除后仍存在残留异常B细胞，可进一步关注抗凋亡机制。",

      compensation:
        "BCL-2抑制可能促进残留异常B细胞进入凋亡。",

      rationale:
        "由CD20类项目最新 Signal 触发，判断是否存在抗凋亡导致的残留问题。",
    },
  ],

  EGFR: [
    {
      targetMechanismId:
        "CHEMOTHERAPY",

      problem:
        "如果EGFR靶向后仍存在异质性克隆或快速疾病进展，需要考虑非靶点依赖的疾病控制机制。",

      compensation:
        "化疗可能帮助覆盖部分异质性克隆并增强初始疾病控制。",

      rationale:
        "由EGFR项目最新 Signal 触发，重点判断是否存在异质性和早期疾病控制不足。",
    },
  ],
};

/* ============================================================
   根据 Signal 判断触发类型
   ============================================================ */

function describeTriggerSignal(
  signal
) {
  const parts = [];

  if (
    RISK.has(
      signal.status
    )
  ) {
    parts.push(
      `${signal.title} 出现${signal.status}状态`
    );
  }

  if (
    signal.status ===
    "COMPLETED"
  ) {
    parts.push(
      `${signal.title} 已完成，进入结果核对阶段`
    );
  }

  if (
    daysAgo(
      signal.updated
    ) <= 30
  ) {
    parts.push(
      "近30天注册信息有更新"
    );
  }

  if (
    signal.phase
      ?.toUpperCase()
      .includes("PHASE3")
  ) {
    parts.push(
      "项目已进入III期"
    );
  }

  if (
    signal.hasCombo
  ) {
    parts.push(
      "项目存在真实联合开发"
    );
  }

  return (
    parts.join("；") ||
    `${signal.title} 出现新的研发 Signal`
  );
}

/* ============================================================
   时间窗口判断

   这不是商业价值结论，
   只是根据竞争成熟度给出提示。
   ============================================================ */

function assessMarketWindow({
  samePattern,
  candidateDrug,
  targetMechanism,
}) {
  const patternTrials =
    samePattern?.trialCount ||
    0;

  const candidateTrials =
    candidateDrug
      ?.activeTrials ||
    0;

  if (
    patternTrials >= 8
  ) {
    return (
      "同类联合已较拥挤，时间成本明显增加；若没有适应症、biomarker、分子或安全性差异化，进入窗口偏晚。"
    );
  }

  if (
    patternTrials >= 3
  ) {
    return (
      "已有一定同机制验证，仍需结合领先项目阶段和差异化空间判断窗口。"
    );
  }

  if (
    candidateTrials >= 3
  ) {
    return (
      `${targetMechanism}机制本身已有一定临床开发基础，` +
      "但当前联合方向相对较早，建议进一步核对竞争格局。"
    );
  }

  return (
    "当前公开数据中同类联合开发相对有限，" +
    "可能处于较早探索阶段，但需要更多机制和临床证据确认。"
  );
}

/* ============================================================
   找同机制候选分子
   ============================================================ */

const PARTNER_ASSET_CATALOG = {
  PD1: ["pembrolizumab", "nivolumab", "tislelizumab", "sintilimab"],
  PDL1: ["atezolizumab", "durvalumab"],
  VEGF: ["bevacizumab", "ramucirumab", "lenvatinib"],
  CTLA4: ["ipilimumab", "tremelimumab"],
  PARP: ["olaparib", "niraparib", "talazoparib"],
  ARPI: ["enzalutamide", "abiraterone", "darolutamide"],
  PDL1_VEGF_BISPECIFIC: ["BNT327", "IMM2510", "PM8002"],
  PD1_VEGF_BISPECIFIC: ["ivonescimab"],
  CHEMOTHERAPY: ["carboplatin", "pemetrexed", "paclitaxel"],
  ADC: [
    "datopotamab deruxtecan",
    "trastuzumab deruxtecan",
    "sacituzumab tirumotecan",
    "BNT324",
  ],
  RPT: ["177Lu-PSMA-617", "225Ac-PSMA"],
};

function isGenericInterventionName(name = "") {
  const x = norm(name);

  return (
    !x ||
    x.includes("antibodies") ||
    x.includes("antibody class") ||
    x.includes("inhibitors") ||
    x === "chemotherapy" ||
    x.includes("standard therapy") ||
    x.includes("investigator choice") ||
    x.includes("placebo")
  );
}

function chooseCandidateDrug(
  mechanismIndex,
  mechanismId,
  anchorDrug
) {
  const liveCandidates =
    (mechanismIndex.get(mechanismId) || [])
      .filter(
        (x) =>
          norm(x.drug) !== norm(anchorDrug) &&
          !isGenericInterventionName(x.drug)
      )
      .sort(
        (a, b) =>
          b.activeTrials - a.activeTrials ||
          a.riskTrials - b.riskTrials
      );

  if (liveCandidates.length) {
    return {
      ...liveCandidates[0],
      source: "live",
    };
  }

  const fallback =
    (PARTNER_ASSET_CATALOG[mechanismId] || [])
      .find(
        (name) =>
          norm(name) !== norm(anchorDrug)
      );

  if (!fallback) {
    return null;
  }

  const mechanism =
    MECHANISM_RULES.find(
      (x) => x.id === mechanismId
    );

  return {
    drug: fallback,
    mechanismId,
    mechanism: mechanism?.label || mechanismId,
    activeTrials: 0,
    riskTrials: 0,
    indications: [],
    nctIds: [],
    source: "catalog",
  };
}

/* ============================================================
   Signal Hypothesis Engine
   ============================================================ */

async function buildSignalHypotheses({
  trials,
  highValueSignals,
  existingCombinations,
  combinationPatterns,
}) {
  const mechanismIndex =
    buildMechanismDrugIndex(
      trials
    );

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

  const hypotheses =
    new Map();

  /*
    只从真正值得关注的最新 Signal 开始，
    而不是遍历所有项目随机配对。
  */

  for (
    const signal of
    highValueSignals.slice(
      0,
      10
    )
  ) {
    /*
      一个项目可能包含多个干预，
      我们分别判断每个已识别资产。
    */

    for (
      const rawAnchor of
      signal.interventions || []
    ) {
      const anchor =
        normalizeDrugName(
          rawAnchor
        );

      const anchorMechanism =
        mechanismOf(
          anchor
        );

      if (
        anchorMechanism.id ===
        "UNKNOWN"
      ) {
        continue;
      }

      const rules =
        SIGNAL_RULES[
          anchorMechanism.id
        ] || [];

      if (!rules.length) {
        continue;
      }

      for (
        const rule of
        rules
      ) {
        const targetRule =
          MECHANISM_RULES.find(
            (x) =>
              x.id ===
              rule.targetMechanismId
          );

        if (!targetRule) {
          continue;
        }

        const candidateDrug =
          chooseCandidateDrug(
            mechanismIndex,
            rule.targetMechanismId,
            anchor
          );

        /*
          如果当前搜索结果里没有具体B，
          仍然可以形成“靶点级联合假设”。

          这样系统不会因为当前40-50条临床项目里
          恰好没有B，就完全错过一个潜在方向。
        */

        if (!candidateDrug) {
          continue;
        }

        const b =
          candidateDrug.drug;

        const bMechanism =
          candidateDrug.mechanism ||
          targetRule.label;

        const key =
          pairKey(
            anchor,
            b
          );

        /*
          如果已经是明确存在的当前联合，
          不作为实时新机会。
          它应该进入 On Going。
        */

        if (
          candidateDrug &&
          existingSet.has(
            key
          )
        ) {
          continue;
        }

        /*
          找有没有相同机制 Pattern。

          注意：
          Pattern只是“支持证据”，
          不再是生成假设的起点。
        */

        const patternIds =
          [
            anchorMechanism.id,
            rule.targetMechanismId,
          ].sort();

        const patternId =
          `${patternIds[0]}__${patternIds[1]}`;

        const samePattern =
          combinationPatterns.find(
            (p) =>
              p.id ===
              patternId
          );

        const triggerSignal =
          describeTriggerSignal(
            signal
          );

        const profileA =
          drugProfile(
            anchor,
            anchorMechanism.id
          );

        const profileB =
          drugProfile(
            b,
            rule.targetMechanismId
          );

        const indicationOverlap =
          candidateDrug
            ? overlap(
                signal.conditions || [],
                candidateDrug.indications || []
              )
            : [];

        const assessment =
          scoreCombination({
            mechanismAId:
              anchorMechanism.id,

            mechanismBId:
              rule.targetMechanismId,

            indicationOverlap,

            samePattern,

            candidateDrug,

            profileA,

            profileB,
          });

        const hypothesis = {
          a:
            anchor,

          b,

          mechanismA:
            anchorMechanism.label,

          mechanismB:
            bMechanism,

          mechanismAId:
            anchorMechanism.id,

          mechanismBId:
            rule.targetMechanismId,

          profileA,

          profileB,

          opportunityScore:
            assessment.opportunityScore,

          scoreBreakdown:
            assessment.scoreBreakdown,

          risk:
            assessment.risk,

          riskRationale:
            assessment.riskRationale,

          evidenceLevel:
            assessment.evidenceLevel,

          evidenceTier:
            assessment.evidenceTier,

          combinationStrategy:
            assessment.combinationStrategy,

          predictionBasis:
            assessment.predictionBasis,

          precedentLevel:
            assessment.precedentLevel,

          timeWindow:
            assessment.timeWindow,

          timeWindowLabel:
            assessment.timeWindowLabel,

          competitionWindow:
            assessment.competitionWindow,

          triggerSignal,

          triggerProject:
            signal.title,

          triggerNctId:
            signal.nctId,

          triggerStatus:
            signal.status,

          triggerUpdated:
            signal.updated,

          problem:
            rule.problem,

          compensation:
            rule.compensation,

          rationale:
            samePattern
              ? `${rule.rationale} 同时已有“${samePattern.pattern}”联合规律可作为支持证据，但该假设的触发来源仍是当前最新 Signal。`
              : `${rule.rationale} 当前主要属于机制驱动假设，尚需进一步补充直接临床联合证据。`,

          referencePattern:
            samePattern
              ?.pattern ||
            null,

          evidenceSupport:
            samePattern
              ? samePattern
                  .evidenceStrength
              : "暂无直接已有 Pattern 支持",

          developmentStatus:
            candidateDrug
              ? "待进行A+B现有开发核对"
              : "目前为靶点级联合假设，待筛选具体B资产",

          marketWindow:
            assessment.competitionWindow?.summary ||
            assessMarketWindow({
              samePattern,
              candidateDrug,
              targetMechanism:
                targetRule.label,
            }),

          sourceType:
            "Signal-driven",

          score:
            assessment.opportunityScore,
        };

        if (
          !hypotheses.has(
            key
          ) ||
          hypothesis.score >
            hypotheses.get(
              key
            ).score
        ) {
          hypotheses.set(
            key,
            hypothesis
          );
        }
      }
    }
  }

  const initial =
    [
      ...hypotheses.values(),
    ]
      .sort(
        (a, b) =>
          b.score -
          a.score
      )
      .slice(0, 10);

  /*
    对具体“分子 + 分子”候选再次查询 ClinicalTrials.gov。

    如果B仍只是“VEGF类资产”这种靶点级假设，
    则不做假装精确的A+B核对。
  */

  const checked =
    await Promise.all(
      initial.map(
        async (x) => {
          const check =
            await verifyExactCombination(
              x.a,
              x.b
            );

          if (
            check.verified &&
            check.exists
          ) {
            return null;
          }

          return {
            ...x,

            developmentStatus:
              check.verified
                ? "ClinicalTrials.gov 暂未发现明确 A+B 临床开发"
                : "现有开发状态待进一步确认",

            verification:
              check.verified
                ? "ClinicalTrials.gov 已核对"
                : "ClinicalTrials.gov 核对不完整",
          };
        }
      )
    );

  return checked
    .filter(Boolean)
    .slice(0, 8);
}


/* ============================================================
   分子内组合 / Next-generation modality

   仍属于 Potential Combination，
   但不是 A+B 两个药直接联用。

   当前先生成“设计级假设”，避免在缺少共表达/
   内吞/组织表达证据时虚构第二靶点或第二Payload。
   ============================================================ */

function buildIntramolecularHypotheses({
  highValueSignals,
}) {
  const hypotheses =
    new Map();

  const templates = [
    {
      designType: "BISPECIFIC_ADC",
      strategy: "双靶点设计",
      shortLabel: "双靶点ADC设计",
      scoreBreakdown: {
        diseaseFit: 16,
        mechanismComplementarity: 22,
        payloadRationale: 10,
        unmetNeedResolution: 15,
        timeWindow: 10,
        moleculeMaturity: 8,
      },
      risk: "Medium",
      riskRationale:
        "需要同时验证双靶点共表达、内吞效率、正常组织表达及双靶结合带来的安全性边界。",
      problem:
        "单靶点ADC可能受到靶点异质性、抗原逃逸或部分肿瘤细胞内吞不足影响。",
      compensation:
        "在保留原ADC杀伤机制的同时，引入第二靶点以扩大可捕获肿瘤细胞范围，并争取改善内吞与递送。",
      designNextStep:
        "优先按共表达、内吞、正常组织表达和耐药逃逸筛选第二靶点，再做具体分子设计。",
    },
    {
      designType: "DUAL_PAYLOAD_ADC",
      strategy: "双Payload设计",
      shortLabel: "双Payload ADC设计",
      scoreBreakdown: {
        diseaseFit: 16,
        mechanismComplementarity: 21,
        payloadRationale: 15,
        unmetNeedResolution: 15,
        timeWindow: 9,
        moleculeMaturity: 8,
      },
      risk: "High",
      riskRationale:
        "双Payload可能增加骨髓抑制、非靶向毒性、稳定性及CMC复杂度，需要先验证治疗窗。",
      problem:
        "单一Payload可能出现敏感性差异、Payload耐药或肿瘤内部杀伤机制单一的问题。",
      compensation:
        "第二Payload可选择不同杀伤机制，尝试覆盖不同敏感克隆并降低单一Payload耐药带来的失效风险。",
      designNextStep:
        "先根据现有Payload的作用机制与主要毒性，筛选机制互补且毒性不过度重叠的第二Payload。",
    },
    {
      designType: "MODALITY_UPGRADE",
      strategy: "Modality升级",
      shortLabel: "新型偶联 / 递送升级",
      scoreBreakdown: {
        diseaseFit: 14,
        mechanismComplementarity: 18,
        payloadRationale: 13,
        unmetNeedResolution: 13,
        timeWindow: 10,
        moleculeMaturity: 7,
      },
      risk: "Medium",
      riskRationale:
        "更换偶联或递送形式可能改变组织分布、暴露、毒性和制造复杂度，需要重新建立完整开发假设。",
      problem:
        "如果现有ADC受限于递送效率、Payload治疗窗、组织分布或耐药，可考虑从单一ADC框架向其他偶联/递送模式扩展。",
      compensation:
        "根据靶点生物学与毒性限制，评估ARC、RDC/GNC或其他新型偶联模式是否能改变递送与杀伤方式。",
      designNextStep:
        "先明确当前ADC的主要瓶颈属于靶点、Payload、递送还是毒性，再选择对应的下一代Modality。",
    },
  ];

  for (
    const signal of
    (highValueSignals || []).slice(0, 10)
  ) {
    for (
      const rawAnchor of
      signal.interventions || []
    ) {
      const anchor =
        normalizeDrugName(
          rawAnchor
        );

      const mechanism =
        mechanismOf(
          anchor
        );

      if (
        mechanism.id !==
        "ADC"
      ) {
        continue;
      }

      const profileA =
        drugProfile(
          anchor,
          "ADC"
        );

      const anchorTarget =
        profileA?.target &&
        !profileA.target.includes("待核对")
          ? profileA.target
          : "当前ADC靶点";

      for (
        const template of
        templates
      ) {
        const evidenceTier =
          evidenceTierForCombination({
            samePattern: null,
            mechanismAId: "ADC",
            mechanismBId: template.designType,
            novelDesign: true,
          });

        const opportunityScore =
          Object.values(
            template.scoreBreakdown
          ).reduce(
            (sum, value) =>
              sum + value,
            0
          );

        const profileB =
          template.designType === "BISPECIFIC_ADC"
            ? {
                modality: "Bispecific ADC design",
                target: anchorTarget + " × 第二靶点待筛选",
                payload: profileA?.payload || "沿用 / 重选Payload待评估",
                linker: profileA?.linker || "Linker待核对",
                dar: "需重新优化",
                toxicityTags: [],
              }
            : template.designType === "DUAL_PAYLOAD_ADC"
            ? {
                modality: "Dual-payload ADC design",
                target: anchorTarget,
                payload: "第二Payload待筛选（需与现Payload机制互补）",
                linker: "双Payload构型 / 释放机制待设计",
                dar: "需重新优化",
                toxicityTags: [],
              }
            : {
                modality: "Next-generation conjugate / delivery",
                target: anchorTarget,
                payload: "ARC / RDC / GNC 等方向需按瓶颈重新选择",
                linker: "递送 / 偶联体系待设计",
                dar: null,
                toxicityTags: [],
              };

        const predictionBasis = [
          template.designType === "BISPECIFIC_ADC"
            ? "靶点异质性 / 抗原逃逸：作为主要设计问题"
            : template.designType === "DUAL_PAYLOAD_ADC"
            ? "Payload耐药 / 杀伤机制单一：作为主要设计问题"
            : "递送、治疗窗或组织分布：作为Modality升级触发条件",
          template.designType === "DUAL_PAYLOAD_ADC"
            ? "Payload-level synergy：需优先验证"
            : "分子内组合：不依赖两个药分别开发后再联用",
          "前车之鉴：当前按设计级假设处理，后续需专项检索",
        ];

        const competitionWindow = {
          score: template.scoreBreakdown.timeWindow,
          label: "需专项核对",
          leadingPhase: "需按具体设计检索",
          leadingPhaseRank: 0,
          activeTrials: 0,
          totalTrials: 0,
          competitionDensity: "待核对",
          estimatedCatchUp: "待核对",
          differentiationNeed:
            "先明确第二靶点 / 第二Payload / 新Modality，再专项检索同类在研项目和领先阶段。",
          leadingExamples: [],
          partnerReadiness:
            "当前为分子设计级假设，不使用普通A+B Partner成熟度口径。",
          summary:
            "当前为分子内设计假设，不能直接用A+B临床项目数量替代竞争时间窗口判断。",
          isDesignLevel: true,
        };

        const displayName =
          template.designType === "BISPECIFIC_ADC"
            ? anchor + " → " + anchorTarget + " × 第二靶点 双抗ADC"
            : template.designType === "DUAL_PAYLOAD_ADC"
            ? anchor + " → 双Payload ADC"
            : anchor + " → 新型偶联 / 递送升级";

        const key =
          norm(anchor) +
          "__" +
          template.designType;

        const hypothesis = {
          a: anchor,
          b: template.shortLabel,
          displayName,

          mechanismA:
            "ADC / 抗体偶联药物",

          mechanismB:
            template.strategy,

          mechanismAId:
            "ADC",

          mechanismBId:
            template.designType,

          profileA,
          profileB,

          combinationStrategy:
            template.strategy,

          opportunityScore,
          scoreBreakdown:
            template.scoreBreakdown,

          risk:
            template.risk,

          riskRationale:
            template.riskRationale,

          evidenceLevel:
            "设计级证据：当前主要为机制与分子架构推演",

          evidenceTier,

          precedentLevel:
            "暂无直接前车之鉴（设计级）",

          predictionBasis,

          timeWindow:
            template.scoreBreakdown.timeWindow,

          timeWindowLabel:
            "需专项核对",

          competitionWindow,

          triggerSignal:
            describeTriggerSignal(
              signal
            ),

          triggerProject:
            signal.title,

          triggerNctId:
            signal.nctId,

          triggerStatus:
            signal.status,

          triggerUpdated:
            signal.updated,

          problem:
            template.problem,

          compensation:
            template.compensation,

          rationale:
            "该候选不是A+B直接联用，而是把组合思路前移到一个分子内部。",

          designNextStep:
            template.designNextStep,

          developmentStatus:
            "分子设计级假设；需完成具体靶点 / Payload / 构型后再核对现有开发",

          verification:
            "未按A+B方式核对",

          marketWindow:
            competitionWindow.summary,

          sourceType:
            "Molecule design",

          score:
            opportunityScore,
        };

        if (
          !hypotheses.has(
            key
          ) ||
          hypothesis.score >
            hypotheses.get(
              key
            ).score
        ) {
          hypotheses.set(
            key,
            hypothesis
          );
        }
      }
    }
  }

  return [
    ...hypotheses.values(),
  ]
    .sort(
      (a, b) =>
        b.score -
        a.score
    )
    .slice(0, 9);
}

/* ============================================================
   PubMed
   ============================================================ */

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
    "10"
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

/* ============================================================
   GET
   ============================================================ */

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
    ).slice(
      0,
      180
    );

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
    ).slice(
      0,
      50
    );

  /* ==========================================================
     1. 最新重点 Signal
     ========================================================== */

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
      .slice(
        0,
        12
      );

  /* ==========================================================
     2. 终止 / 暂停
     ========================================================== */

  const failures =
    buildFailures(
      trials
    );

  /* ==========================================================
     3. 已有联合
     ========================================================== */

  const existingCombinations =
    buildExistingCombinations(
      trials
    );

  /* ==========================================================
     4. On Going Pattern
     ========================================================== */

  const combinationPatterns =
    buildCombinationPatterns(
      existingCombinations
    );

  /* ==========================================================
     5. 研发问题
     ========================================================== */

  const unmetProblems =
    buildUnmetProblems(
      trials
    );

  /* ==========================================================
     6. On Going迁移机会
     ========================================================== */

  const potentialCombinations =
    await buildPotentialCombinations(
      trials,
      existingCombinations,
      combinationPatterns
    );

  /* ==========================================================
     7. 实时 Signal 驱动的新联合假设
     ========================================================== */

  const signalHypotheses =
    await buildSignalHypotheses({
      trials,

      highValueSignals,

      existingCombinations,

      combinationPatterns,
    });

  /* ==========================================================
     8. 分子内组合 / Next-generation modality
     ========================================================== */

  const intramolecularHypotheses =
    buildIntramolecularHypotheses({
      highValueSignals,
    });

  /* ==========================================================
     OUTPUT
     ========================================================== */

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

    unmetProblems,

    /*
      首页：
      实时 Signal 驱动
    */

    signalHypotheses,

    /*
      Potential：
      分子内组合 / Next-generation modality
    */

    intramolecularHypotheses,

    /*
      On Going：
      已有联合逻辑
    */

    existingCombinations,

    combinationPatterns,

    potentialCombinations,

    failures,

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

      highValueSignalCount:
        highValueSignals.length,

      existingCombinationCount:
        existingCombinations.length,

      patternCount:
        combinationPatterns.length,

      ongoingOpportunityCount:
        potentialCombinations.length,

      signalHypothesisCount:
        signalHypotheses.length,

      intramolecularHypothesisCount:
        intramolecularHypotheses.length,
    },
  });
}
