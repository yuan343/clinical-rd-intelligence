"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [q, setQ] = useState("PD-L1 VEGF");
  const [active, setActive] = useState("PD-L1 VEGF");
  const [mode, setMode] = useState("auto");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("signals");

  useEffect(() => {
    (async () => {
      setLoading(true);

      try {
        const r = await fetch(
          `/api/search?q=${encodeURIComponent(active)}&mode=${mode}`,
          { cache: "no-store" }
        );

        const json = await r.json();
        setData(json);
      } catch (e) {
        console.error(e);
        setData(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [active, mode]);

  function submit(e) {
    e.preventDefault();

    if (q.trim()) {
      setActive(q.trim());
    }
  }

  return (
    <div className="shell">
      <aside>
        <div className="brand">
          研发情报工作台
          <small>BD & Combination Intelligence</small>
        </div>

        {[
          ["signals", "实时机会"],
          ["potential", "预计可以组合"],
          ["ongoing", "On Going｜在研联合"],
          ["failures", "终止 / 暂停项目"],
          ["trials", "临床项目"],
          ["papers", "文献证据"],
          ["sources", "信息来源"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={"nav " + (tab === id ? "active" : "")}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </aside>

      <main>
        <div className="top">
          <div>
            <h1>{pageTitle(tab)}</h1>

            <div className="muted">
              当前检索：{active}

              {data && (
                <>
                  {" · "}检索方式：
                  <b>
                    {data.selectedMode === "condition"
                      ? "适应症精确检索"
                      : "分子 / 靶点全文检索"}
                  </b>
                </>
              )}
            </div>
          </div>

          <form className="search" onSubmit={submit}>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              <option value="auto">自动判断</option>
              <option value="condition">适应症</option>
              <option value="term">分子 / 靶点</option>
            </select>

            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="SLE / NSCLC / PD-L1 VEGF / CD20"
            />

            <button>实时搜索</button>
          </form>
        </div>

        {loading ? (
          <div className="card">正在读取实时数据…</div>
        ) : !data ? (
          <div className="card">数据读取失败，请稍后重试。</div>
        ) : (
          <>
            {tab === "signals" && (
              <RealtimeSignals
                data={data}
                onOpenPotential={() => {
                  setTab("potential");
                  setTimeout(() => {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }, 0);
                }}
                onOpenOngoing={() => {
                  setTab("ongoing");
                  setTimeout(() => {
                    document
                      .getElementById("ongoing-patterns")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }, 0);
                }}
              />
            )}

            {tab === "potential" && <PotentialCombinations data={data} />}

            {tab === "ongoing" && <OnGoing data={data} />}

            {tab === "failures" && <Failures data={data} />}

            {tab === "trials" && (
              <Trials trials={data.trials || []} />
            )}

            {tab === "papers" && (
              <Papers papers={data.publications || []} />
            )}

            {tab === "sources" && <Sources data={data} />}
          </>
        )}
      </main>
    </div>
  );
}

function pageTitle(tab) {
  if (tab === "potential") return "预计可以组合｜联合机制假设";
  if (tab === "ongoing") return "On Going｜在研联合";
  if (tab === "failures") return "终止 / 暂停项目";
  if (tab === "trials") return "临床项目";
  if (tab === "papers") return "文献证据";
  if (tab === "sources") return "信息来源";

  return "实时研发动态 → 潜在联合机会";
}

/* =========================================================
   实时机会
   ========================================================= */

function RealtimeSignals({ data, onOpenPotential, onOpenOngoing }) {
  const signalHypotheses = data.signalHypotheses || [];

  return (
    <>
      <section
        className="card section"
        style={{
          padding: "14px 18px",
          marginBottom: "14px",
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700 }}>
          核心逻辑：实时 Signal → 研发问题 → 联合假设 → 证据验证 → 时间窗口
        </div>

        <div
          className="muted"
          style={{
            marginTop: 5,
            lineHeight: 1.6,
          }}
        >
          从最新临床、机制和研发变化中识别新的联合机会；
          已有联合项目和 Pattern 主要作为证据支持，不作为新机会的唯一来源。
        </div>
      </section>

      <div className="metrics">
        <Metric
          n={data.highValueSignals?.length || 0}
          l="当前重点 Signal"
        />

        <Metric
          n={data.unmetProblems?.length || 0}
          l="待核对研发问题"
        />

        <Metric
          n={signalHypotheses.length}
          l="最新信号推导候选"
          onClick={() =>
            document
              .getElementById("signal-combination-preview")
              ?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
          hint="点击查看"
        />

        <Metric
          n={data.combinationPatterns?.length || 0}
          l="可参考同类 Pattern"
          onClick={onOpenOngoing}
          hint="点击进入 On Going"
        />
      </div>

      <section className="card section">
        <h2>最新重点 Signal</h2>

        <div className="note">
          当前数据主要来自 ClinicalTrials.gov。
          后续将继续接入临床结果、学术会议、公司公告、
          监管动态和最新机制文献。
        </div>

        {data.highValueSignals?.length ? (
          <table>
            <thead>
              <tr>
                <th>项目</th>
                <th>Signal</th>
                <th>当前状态</th>
                <th>发生了什么</th>
                <th>下一步需要判断</th>
              </tr>
            </thead>

            <tbody>
              {data.highValueSignals.map((t) => (
                <tr key={t.nctId}>
                  <td>
                    <b>{t.title}</b>

                    <div className="small">
                      {t.nctId} · {t.phase}
                    </div>
                  </td>

                  <td>
                    <span
                      className={
                        "signalBadge " +
                        signalClass(t.highValueType)
                      }
                    >
                      {displaySignalType(t.highValueType)}
                    </span>
                  </td>

                  <td>{displayStatus(t.status)}</td>

                  <td>
                    <ul className="compactList">
                      {(t.highValueReasons || []).map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </td>

                  <td>{t.nextCheck}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="muted">
            当前检索暂无重点 Signal。
          </div>
        )}
      </section>

      <section
        id="signal-combination-preview"
        className="card section"
        style={{ scrollMarginTop: 18 }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <h2 style={{ margin: 0 }}>最新信号推导出的潜在组合</h2>

          <button
            type="button"
            className="inlineButton"
            onClick={onOpenPotential}
          >
            查看全部预计组合 →
          </button>
        </div>

        <div className="note">
          上方“最新信号推导候选”的数量就是这里实际展示的候选数。
          完整候选池还会叠加机制推导和同类 Pattern 迁移，因此“预计可以组合”页的总数可能更多。
        </div>

        {signalHypotheses.length ? (
          <table>
            <thead>
              <tr>
                <th>具体候选</th>
                <th>机会分</th>
                <th>竞争时间窗口</th>
                <th>前车之鉴</th>
                <th>触发原因</th>
                <th>详情</th>
              </tr>
            </thead>

            <tbody>
              {signalHypotheses.slice(0, 5).map((x, i) => (
                <tr key={x.a + "__" + x.b + "__home__" + i}>
                  <td>
                    <b>{x.a} + {x.b}</b>
                    <div className="small">
                      {x.mechanismA} + {x.mechanismB}
                    </div>
                  </td>

                  <td>
                    <span className="scorePill">
                      {x.opportunityScore || x.score || "-"} / 100
                    </span>
                  </td>

                  <td>
                    <b>{x.timeWindowLabel || "待评估"}</b>
                    <div className="small">
                      {x.timeWindow ?? "-"} / 15
                    </div>
                  </td>

                  <td>
                    {x.precedentLevel || "待核对"}
                    <div className="small">
                      {x.evidenceLevel || "-"}
                    </div>
                  </td>

                  <td>
                    {x.triggerSignal || x.problem || "-"}
                  </td>

                  <td>
                    <button
                      type="button"
                      className="textLink"
                      onClick={onOpenPotential}
                    >
                      查看完整分析 →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="muted">
            当前检索没有生成最新信号驱动的潜在组合。
          </div>
        )}
      </section>

      <section className="card section">
        <h2>Signal → 联合机会</h2>

        <div className="note">
          实时机会的核心不是复制已有联合，而是从新的医学变化中提出新的联合假设。
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(180px,1fr))",
            gap: 12,
            marginTop: 14,
          }}
        >
          <FlowCard
            title="1. 新 Signal"
            text="临床读出、耐药机制、biomarker、新靶点、项目终止、监管或竞争变化。"
          />

          <FlowCard
            title="2. 研发问题"
            text="判断现有治疗还缺什么：疗效深度、持续性、耐药、安全性或患者选择。"
          />

          <FlowCard
            title="3. 联合假设"
            text="寻找可能解决该问题的互补机制，形成新的候选 A+B。"
          />

          <FlowCard
            title="4. 证据验证"
            text="使用 PubMed、已有联合 Pattern、临床结果和反例验证假设。"
          />

          <FlowCard
            title="5. 时间窗口"
            text="核对领先项目阶段、竞争数量和赛道成熟度，判断现在做是否仍有价值。"
          />
        </div>
      </section>

      <section className="card section">
        <h2>当前能力状态</h2>

        <table>
          <thead>
            <tr>
              <th>能力</th>
              <th>当前状态</th>
              <th>下一步</th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td>ClinicalTrials.gov 动态</td>
              <td>已接入</td>
              <td>识别状态、Phase、联合和项目变化</td>
            </tr>

            <tr>
              <td>PubMed 文献</td>
              <td>已接入基础检索</td>
              <td>升级为机制、耐药和联合依据提取</td>
            </tr>

            <tr>
              <td>实时临床读出</td>
              <td>待增强</td>
              <td>接入会议、公司公告和正式结果</td>
            </tr>

            <tr>
              <td>Signal 驱动联合假设</td>
              <td>下一步开发</td>
              <td>Signal → Problem → Mechanism → Combination</td>
            </tr>

            <tr>
              <td>市场时间窗口</td>
              <td>下一步开发</td>
              <td>领先阶段、竞争密度、时间差和差异化空间</td>
            </tr>
          </tbody>
        </table>
      </section>
    </>
  );
}


/* =========================================================
   预计可以组合
   ========================================================= */

function PotentialCombinations({ data }) {
  const signalHypotheses = data.signalHypotheses || [];
  const patternCandidates = data.potentialCombinations || [];

  const [keyword, setKeyword] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [scoreFilter, setScoreFilter] = useState("all");
  const [windowFilter, setWindowFilter] = useState("all");
  const [precedentFilter, setPrecedentFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [comboFilter, setComboFilter] = useState("");
  const [profileFilter, setProfileFilter] = useState("");
  const [rationaleFilter, setRationaleFilter] = useState("");
  const [developmentFilter, setDevelopmentFilter] = useState("all");

  const allCandidates = [
    ...signalHypotheses.map((x) => ({
      ...x,
      source: "Signal-driven",
    })),
    ...patternCandidates.map((x) => ({
      ...x,
      source: "Pattern transfer",
    })),
  ]
    .sort(
      (a, b) =>
        (b.opportunityScore || b.score || 0) -
        (a.opportunityScore || a.score || 0)
    )
    .slice(0, 32);

  const candidates = allCandidates.filter((x) => {
    const text = [
      x.a,
      x.b,
      x.mechanismA,
      x.mechanismB,
      x.problem,
      x.compensation,
      x.rationale,
      x.profileA?.target,
      x.profileB?.target,
      x.profileA?.payload,
      x.profileB?.payload,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const kw = keyword.trim().toLowerCase();

    if (kw && !text.includes(kw)) {
      return false;
    }

    if (
      sourceFilter !== "all" &&
      x.source !== sourceFilter
    ) {
      return false;
    }

    const score = x.opportunityScore || x.score || 0;

    if (
      scoreFilter !== "all" &&
      score < Number(scoreFilter)
    ) {
      return false;
    }

    const timeWindow = x.timeWindow || 0;

    if (
      windowFilter === "good" &&
      timeWindow < 13
    ) {
      return false;
    }

    if (
      windowFilter === "open" &&
      (timeWindow < 9 || timeWindow >= 13)
    ) {
      return false;
    }

    if (
      windowFilter === "crowded" &&
      timeWindow > 8
    ) {
      return false;
    }

    if (
      precedentFilter === "none" &&
      x.precedentLevel !== "暂无直接前车之鉴"
    ) {
      return false;
    }

    if (
      precedentFilter === "has" &&
      x.precedentLevel === "暂无直接前车之鉴"
    ) {
      return false;
    }

    if (
      riskFilter !== "all" &&
      x.risk !== riskFilter
    ) {
      return false;
    }

    const comboText = [
      x.a,
      x.b,
      x.mechanismA,
      x.mechanismB,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const comboKw = comboFilter.trim().toLowerCase();

    if (
      comboKw &&
      !comboText.includes(comboKw)
    ) {
      return false;
    }

    const profileText = [
      x.profileA?.modality,
      x.profileA?.target,
      x.profileA?.payload,
      x.profileA?.linker,
      x.profileA?.radionuclide,
      x.profileB?.modality,
      x.profileB?.target,
      x.profileB?.payload,
      x.profileB?.linker,
      x.profileB?.radionuclide,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const profileKw = profileFilter.trim().toLowerCase();

    if (
      profileKw &&
      !profileText.includes(profileKw)
    ) {
      return false;
    }

    const rationaleText = [
      x.problem,
      x.compensation,
      x.rationale,
      x.triggerSignal,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const rationaleKw = rationaleFilter.trim().toLowerCase();

    if (
      rationaleKw &&
      !rationaleText.includes(rationaleKw)
    ) {
      return false;
    }

    if (
      developmentFilter === "verified" &&
      !String(x.verification || "").includes("已核对")
    ) {
      return false;
    }

    if (
      developmentFilter === "pending" &&
      !(
        String(x.verification || "").includes("不完整") ||
        String(x.developmentStatus || "").includes("待") ||
        String(x.developmentStatus || "").includes("确认")
      )
    ) {
      return false;
    }

    return true;
  });

  function clearFilters() {
    setKeyword("");
    setSourceFilter("all");
    setScoreFilter("all");
    setWindowFilter("all");
    setPrecedentFilter("all");
    setRiskFilter("all");
    setComboFilter("");
    setProfileFilter("");
    setRationaleFilter("");
    setDevelopmentFilter("all");
  }

  return (
    <>
      <section
        className="card section"
        style={{
          padding: "14px 18px",
          marginBottom: "14px",
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700 }}>
          实时问题 → 机制推导 → 具体分子 → 竞争时间窗口 → 100分机会评分
        </div>

        <div
          className="muted"
          style={{
            marginTop: 5,
            lineHeight: 1.6,
          }}
        >
          前车之鉴只用于验证，不再决定候选生成。系统优先回答“现在还能不能做、和哪个具体分子做”；
          风险单独展示，高风险不等于没有科学价值。
        </div>
      </section>

      <div className="metrics">
        <Metric n={allCandidates.length} l="全部候选联合" />
        <Metric n={candidates.length} l="当前筛选结果" />
        <Metric
          n={candidates.filter((x) => (x.opportunityScore || 0) >= 70).length}
          l="≥70分候选"
        />
        <Metric
          n={candidates.filter((x) => x.risk === "High").length}
          l="高风险"
        />
        <Metric
          n={candidates.filter((x) => (x.timeWindow || 0) >= 12).length}
          l="竞争窗口较好"
        />
      </div>

      <section className="card section filterPanel">
        <div className="filterHeader">
          <div>
            <h2 style={{ margin: 0 }}>筛选候选</h2>
            <div className="small">
              可以组合使用，例如：暂无前车之鉴 + 时间窗口较好 + ≥80分。
            </div>
          </div>

          <button
            type="button"
            className="secondaryButton"
            onClick={clearFilters}
          >
            清空筛选
          </button>
        </div>

        <div className="filterGrid">
          <label className="filterField filterKeyword">
            <span>分子 / 靶点 / 机制</span>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="如 ADC、PARP、BNT327、HER2"
            />
          </label>

          <label className="filterField">
            <span>来源</span>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
            >
              <option value="all">全部</option>
              <option value="Signal-driven">最新信号推导</option>
              <option value="Pattern transfer">同类联合迁移</option>
            </select>
          </label>

          <label className="filterField">
            <span>最低机会分</span>
            <select
              value={scoreFilter}
              onChange={(e) => setScoreFilter(e.target.value)}
            >
              <option value="all">不限</option>
              <option value="70">≥70</option>
              <option value="80">≥80</option>
              <option value="90">≥90</option>
            </select>
          </label>

          <label className="filterField">
            <span>竞争时间窗口</span>
            <select
              value={windowFilter}
              onChange={(e) => setWindowFilter(e.target.value)}
            >
              <option value="all">全部</option>
              <option value="good">窗口较好</option>
              <option value="open">仍有窗口</option>
              <option value="crowded">开始拥挤 / 偏晚</option>
            </select>
          </label>

          <label className="filterField">
            <span>前车之鉴</span>
            <select
              value={precedentFilter}
              onChange={(e) => setPrecedentFilter(e.target.value)}
            >
              <option value="all">全部</option>
              <option value="none">暂无直接前车之鉴</option>
              <option value="has">已有同类前车之鉴</option>
            </select>
          </label>

          <label className="filterField">
            <span>风险</span>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
            >
              <option value="all">全部</option>
              <option value="Low">低风险</option>
              <option value="Medium">中风险</option>
              <option value="High">高风险</option>
            </select>
          </label>
        </div>
      </section>

      <section className="card section">
        <div className="sectionTitleRow">
          <h2 style={{ margin: 0 }}>预计可以组合｜候选池</h2>
          <div className="muted">
            显示 {candidates.length} / {allCandidates.length}
          </div>
        </div>

        <div className="note">
          100分构成：疾病/人群20 + 机制互补25 + Payload/杀伤协同15 +
          解决耐药/未满足需求15 + 竞争时间窗口15 + 分子成熟度10。
          安全性和前车之鉴单独显示，不再混入机会分。
        </div>

        {candidates.length ? (
          <table>
            <thead>
              <tr>
                <th>候选联合</th>
                <th>来源</th>
                <th>机会分</th>
                <th>时间窗口</th>
                <th>前车之鉴</th>
                <th>风险</th>
                <th>药物画像</th>
                <th>为什么可能成立</th>
                <th>现有开发核对</th>
              </tr>

              <tr className="columnFilterRow">
                <th>
                  <input
                    className="columnFilterInput"
                    value={comboFilter}
                    onChange={(e) => setComboFilter(e.target.value)}
                    placeholder="分子 / 机制"
                  />
                </th>

                <th>
                  <select
                    className="columnFilterSelect"
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value)}
                  >
                    <option value="all">全部</option>
                    <option value="Signal-driven">最新信号</option>
                    <option value="Pattern transfer">同类迁移</option>
                  </select>
                </th>

                <th>
                  <select
                    className="columnFilterSelect"
                    value={scoreFilter}
                    onChange={(e) => setScoreFilter(e.target.value)}
                  >
                    <option value="all">不限</option>
                    <option value="70">≥70</option>
                    <option value="80">≥80</option>
                    <option value="90">≥90</option>
                  </select>
                </th>

                <th>
                  <select
                    className="columnFilterSelect"
                    value={windowFilter}
                    onChange={(e) => setWindowFilter(e.target.value)}
                  >
                    <option value="all">全部</option>
                    <option value="good">窗口较好</option>
                    <option value="open">仍有窗口</option>
                    <option value="crowded">拥挤 / 偏晚</option>
                  </select>
                </th>

                <th>
                  <select
                    className="columnFilterSelect"
                    value={precedentFilter}
                    onChange={(e) => setPrecedentFilter(e.target.value)}
                  >
                    <option value="all">全部</option>
                    <option value="none">暂无直接先例</option>
                    <option value="has">已有同类先例</option>
                  </select>
                </th>

                <th>
                  <select
                    className="columnFilterSelect"
                    value={riskFilter}
                    onChange={(e) => setRiskFilter(e.target.value)}
                  >
                    <option value="all">全部</option>
                    <option value="Low">低</option>
                    <option value="Medium">中</option>
                    <option value="High">高</option>
                  </select>
                </th>

                <th>
                  <input
                    className="columnFilterInput"
                    value={profileFilter}
                    onChange={(e) => setProfileFilter(e.target.value)}
                    placeholder="Target / Payload"
                  />
                </th>

                <th>
                  <input
                    className="columnFilterInput"
                    value={rationaleFilter}
                    onChange={(e) => setRationaleFilter(e.target.value)}
                    placeholder="问题 / 互补"
                  />
                </th>

                <th>
                  <select
                    className="columnFilterSelect"
                    value={developmentFilter}
                    onChange={(e) => setDevelopmentFilter(e.target.value)}
                  >
                    <option value="all">全部</option>
                    <option value="verified">已核对</option>
                    <option value="pending">待确认</option>
                  </select>
                </th>
              </tr>
            </thead>

            <tbody>
              {candidates.map((x, i) => (
                <tr key={x.a + "__" + x.b + "__" + i}>
                  <td>
                    <b>{x.a} + {x.b}</b>
                    <div className="small">
                      {x.mechanismA} + {x.mechanismB}
                    </div>
                  </td>

                  <td>
                    {x.source === "Signal-driven"
                      ? "最新信号推导"
                      : x.source === "Pattern transfer"
                      ? "同类联合迁移"
                      : "机制推导"}
                  </td>

                  <td>
                    <div className="scorePill">
                      {x.opportunityScore || x.score || "-"} / 100
                    </div>

                    {x.scoreBreakdown && (
                      <div className="small scoreDetail">
                        疾病 {x.scoreBreakdown.diseaseFit} ·
                        机制 {x.scoreBreakdown.mechanismComplementarity} ·
                        Payload {x.scoreBreakdown.payloadRationale} ·
                        未满足需求 {x.scoreBreakdown.unmetNeedResolution} ·
                        竞争窗口 {x.scoreBreakdown.timeWindow} ·
                        分子成熟度 {x.scoreBreakdown.moleculeMaturity}
                      </div>
                    )}
                  </td>

                  <td>
                    <div className="timeWindowBox">
                      <div className="timeWindowTop">
                        <b>{x.timeWindowLabel || "待评估"}</b>
                        <span className="timeWindowScore">
                          {x.timeWindow ?? "-"} / 15
                        </span>
                      </div>

                      {x.competitionWindow ? (
                        <>
                          <div className="small">
                            领先阶段：<b>{x.competitionWindow.leadingPhase}</b>
                          </div>
                          <div className="small">
                            同类竞争：活跃 {x.competitionWindow.activeTrials} / 总计 {x.competitionWindow.totalTrials}
                            {" · "}密度 {x.competitionWindow.competitionDensity}
                          </div>
                          <div className="small">
                            追赶压力：<b>{x.competitionWindow.estimatedCatchUp}</b>
                          </div>
                          <div className="small timeWindowReason">
                            {x.competitionWindow.differentiationNeed}
                          </div>
                        </>
                      ) : (
                        x.marketWindow && (
                          <div className="small">{x.marketWindow}</div>
                        )
                      )}
                    </div>
                  </td>

                  <td>
                    <b>{x.precedentLevel || "待核对"}</b>
                    <div className="small">
                      {x.evidenceLevel || x.evidenceStrength || "待评估"}
                    </div>
                  </td>

                  <td>
                    <span className={"riskBadge " + riskClass(x.risk)}>
                      {x.risk === "High" ? "高风险" : x.risk === "Medium" ? "中风险" : x.risk === "Low" ? "低风险" : "待评估"}
                    </span>
                    <div className="small">{x.riskRationale || "-"}</div>
                  </td>

                  <td>
                    <DrugProfile profile={x.profileA} />
                    <div className="small" style={{ margin: "5px 0" }}>+</div>
                    <DrugProfile profile={x.profileB} />
                  </td>

                  <td>
                    <div><b>问题：</b>{x.problem || "-"}</div>
                    <div><b>互补：</b>{x.compensation || "-"}</div>
                    <div className="small">{x.rationale || "-"}</div>
                  </td>

                  <td>
                    {x.developmentStatus || "待核对"}
                    {x.verification && (
                      <div className="small">{x.verification}</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="muted">
            当前筛选条件下没有候选。可以放宽机会分、时间窗口或前车之鉴条件。
          </div>
        )}
      </section>
    </>
  );
}

function DrugProfile({ profile }) {
  if (!profile) {
    return <div className="small">药物画像待核对</div>;
  }

  return (
    <div className="profileBox">
      <b>{profile.modality || "Unknown"}</b>
      <div className="small">Target：{profile.target || "-"}</div>
      {profile.payload && (
        <div className="small">Payload：{profile.payload}</div>
      )}
      {profile.linker && (
        <div className="small">Linker：{profile.linker}</div>
      )}
      {profile.dar && (
        <div className="small">DAR：{profile.dar}</div>
      )}
      {profile.radionuclide && (
        <div className="small">核素：{profile.radionuclide}</div>
      )}
      {profile.radiationType && (
        <div className="small">辐射：{profile.radiationType}</div>
      )}
    </div>
  );
}

function riskClass(risk) {
  if (risk === "High") return "high";
  if (risk === "Medium") return "medium";
  if (risk === "Low") return "low";
  return "";
}

/* =========================================================
   On Going｜在研联合
   ========================================================= */

function OnGoing({ data }) {
  const patterns = data.combinationPatterns || [];
  const existing = data.existingCombinations || [];
  const potential = data.potentialCombinations || [];

  return (
    <>
      <section
        className="card section"
        style={{
          padding: "14px 18px",
          marginBottom: "14px",
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700 }}>
          On Going：已有联合证据 → 联合规律 Pattern → 迁移机会
        </div>

        <div
          className="muted"
          style={{
            marginTop: 5,
            lineHeight: 1.6,
          }}
        >
          用于了解当前行业已经在做什么、为什么这样联合，
          以及这些已有联合规律还能否迁移到其他分子。
        </div>
      </section>

      <div className="metrics">
        <Metric
          n={existing.length}
          l="已有联合项目"
        />

        <Metric
          n={patterns.length}
          l="联合规律 Pattern"
        />

        <Metric
          n={potential.length}
          l="Pattern 迁移机会"
        />

        <Metric
          n={data.failures?.length || 0}
          l="终止 / 暂停 Signal"
        />
      </div>

      <section className="card section">
        <h2>已有联合证据</h2>

        <div className="note">
          已经进入临床开发的真实联合项目，是联合规律分析的基础。
        </div>

        {existing.length ? (
          <table>
            <thead>
              <tr>
                <th>联合方案</th>
                <th>适应症</th>
                <th>Phase</th>
                <th>相关试验数</th>
                <th>活跃项目</th>
                <th>终止 / 暂停</th>
              </tr>
            </thead>

            <tbody>
              {existing.slice(0, 12).map((c) => (
                <tr key={c.combo}>
                  <td>
                    <a href={comboHref(data, c)}>
                      <b>{c.combo}</b> ↗
                    </a>
                  </td>

                  <td>
                    {c.indications?.slice(0, 3).join("；") ||
                      "-"}
                  </td>

                  <td>{c.phases?.join("；") || "-"}</td>

                  <td>{c.trials}</td>

                  <td>{c.active}</td>

                  <td>{c.risk}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="muted">
            当前检索暂无已有联合项目。
          </div>
        )}
      </section>

      <section
        id="ongoing-patterns"
        className="card section"
        style={{ scrollMarginTop: 18 }}
      >
        <h2>联合规律 Pattern</h2>

        <div className="note">
          从已有联合中提炼机制互补逻辑、可能成立的条件和主要限制因素。
        </div>

        {patterns.length ? (
          <table>
            <thead>
              <tr>
                <th>联合规律</th>
                <th>当前未解决问题</th>
                <th>潜在互补机制</th>
                <th>可迁移依据</th>
                <th>可能成立的条件</th>
                <th>主要限制因素</th>
              </tr>
            </thead>

            <tbody>
              {patterns.slice(0, 10).map((p) => (
                <tr key={p.id}>
                  <td>
                    <b>{p.pattern}</b>

                    <div className="small">
                      {p.evidenceStrength} · {p.trialCount} 项试验
                    </div>
                  </td>

                  <td>{p.problem}</td>

                  <td>{p.compensation}</td>

                  <td>{p.transferRule}</td>

                  <td>{p.successCondition}</td>

                  <td>{p.failureBoundary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="muted">
            当前检索尚未形成可迁移联合规律。
          </div>
        )}
      </section>

      <section className="card section">
        <h2>Pattern 迁移已移入“预计可以组合”</h2>

        <div className="note">
          On Going 仅保留真实在研联合与已验证 Pattern。
          尚未明确进入临床的迁移候选统一放到“预计可以组合”，避免和真实项目混淆。
        </div>
      </section>
    </>
  );
}

/* =========================================================
   终止 / 暂停项目
   ========================================================= */

function Failures({ data }) {
  return (
    <section className="card">
      <h2>终止 / 暂停项目</h2>

      <div className="note">
        项目终止或暂停不等于机制失败。
        需进一步区分疗效、安全性、剂量、患者选择、
        研究设计和公司战略等因素。
      </div>

      {(data.failures || []).length ? (
        <table>
          <thead>
            <tr>
              <th>项目</th>
              <th>当前状态</th>
              <th>适应症</th>
              <th>干预方案</th>
              <th>重点判断问题</th>
              <th>来源</th>
            </tr>
          </thead>

          <tbody>
            {(data.failures || []).map((t) => (
              <tr key={t.nctId}>
                <td>
                  <b>{t.title}</b>
                  <div className="small">{t.nctId}</div>
                </td>

                <td>{displayStatus(t.status)}</td>

                <td>{t.conditions.join("；")}</td>

                <td>{t.interventions.join(" + ")}</td>

                <td>
                  需判断是否属于机制、分子、疗效、安全性、
                  剂量、人群、设计或战略问题。
                </td>

                <td>
                  <a
                    href={t.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    查看 ↗
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="muted">
          暂无终止 / 暂停项目。
        </div>
      )}
    </section>
  );
}

/* =========================================================
   临床项目
   ========================================================= */

function Trials({ trials }) {
  return (
    <section className="card">
      <h2>临床项目</h2>

      <div className="note">
        数据来源：ClinicalTrials.gov
      </div>

      <table>
        <thead>
          <tr>
            <th>NCT</th>
            <th>项目</th>
            <th>适应症</th>
            <th>Phase</th>
            <th>当前状态</th>
            <th>干预方案</th>
          </tr>
        </thead>

        <tbody>
          {trials.map((t) => (
            <tr key={t.nctId}>
              <td>
                <a
                  href={t.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t.nctId}
                </a>
              </td>

              <td>{t.title}</td>

              <td>{t.conditions.join("；")}</td>

              <td>{t.phase}</td>

              <td>{displayStatus(t.status)}</td>

              <td>{t.interventions.join(" + ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/* =========================================================
   PubMed
   ========================================================= */

function Papers({ papers }) {
  return (
    <section className="card">
      <h2>PubMed 文献证据</h2>

      <div className="note">
        当前用于补充机制和临床证据线索。
      </div>

      {papers.length ? (
        papers.map((p) => (
          <div className="paper" key={p.pmid}>
            <a
              href={p.url}
              target="_blank"
              rel="noreferrer"
            >
              <b>{p.title}</b>
            </a>

            <div className="small">
              {p.journal} · {p.pubdate} · PMID {p.pmid}
            </div>
          </div>
        ))
      ) : (
        <div className="muted">
          暂无 PubMed 结果。
        </div>
      )}
    </section>
  );
}

/* =========================================================
   信息来源
   ========================================================= */

function Sources({ data }) {
  return (
    <section className="card">
      <h2>信息来源</h2>

      <table>
        <thead>
          <tr>
            <th>来源</th>
            <th>当前状态</th>
            <th>主要用途</th>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td>ClinicalTrials.gov</td>
            <td>已接入</td>
            <td>
              项目、Phase、状态、干预、已有联合和竞争核对
            </td>
          </tr>

          <tr>
            <td>PubMed</td>
            <td>已接入基础检索</td>
            <td>
              文献、机制和临床证据线索
            </td>
          </tr>

          <tr>
            <td>公司公告 / Pipeline</td>
            <td>待接入</td>
            <td>
              最新数据读出、项目推进、终止和战略变化
            </td>
          </tr>

          <tr>
            <td>学术会议</td>
            <td>待接入</td>
            <td>
              最新 ORR / PFS / OS / DoR / 安全性结果
            </td>
          </tr>

          <tr>
            <td>监管动态</td>
            <td>待接入</td>
            <td>
              FDA / EMA / NMPA 决策和研发路径变化
            </td>
          </tr>

          <tr>
            <td>BD / 交易动态</td>
            <td>待接入</td>
            <td>
              产业验证、资产热度和竞争趋势
            </td>
          </tr>

          <tr>
            <td>本次更新时间</td>
            <td colSpan="2">{data.generatedAt}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

/* =========================================================
   Helpers
   ========================================================= */

function FlowCard({ title, text }) {
  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: 12,
        padding: 14,
        background: "var(--panel)",
      }}
    >
      <b>{title}</b>

      <div
        className="muted"
        style={{
          marginTop: 7,
          lineHeight: 1.6,
        }}
      >
        {text}
      </div>
    </div>
  );
}

function comboHref(data, c) {
  return `/combo?a=${encodeURIComponent(
    c.a
  )}&b=${encodeURIComponent(
    c.b
  )}&q=${encodeURIComponent(
    data.query
  )}`;
}

function displaySignalType(type) {
  if (type === "失败/暂停") return "终止 / 暂停";
  if (type === "关键读出") return "关键读出";
  if (type === "后期临床") return "后期临床";
  if (type === "联合开发") return "已有联合开发";
  if (type === "近期重大更新") return "近期更新";

  return type || "相关项目";
}

function displayStatus(status) {
  const map = {
    RECRUITING: "招募中",
    NOT_YET_RECRUITING: "尚未开始招募",
    ACTIVE_NOT_RECRUITING: "进行中，已停止招募",
    COMPLETED: "已完成",
    TERMINATED: "已终止",
    SUSPENDED: "已暂停",
    WITHDRAWN: "已撤回",
    ENROLLING_BY_INVITATION: "邀请入组",
    UNKNOWN: "状态未知",
  };

  return map[status] || status;
}

function signalClass(type) {
  if (type === "失败/暂停") return "danger";
  if (type === "关键读出") return "warning";
  if (type === "后期临床") return "purple";
  if (type === "联合开发") return "success";
  if (type === "近期重大更新") return "blue";

  return "";
}

function Metric({ n, l, onClick, hint }) {
  const interactive = typeof onClick === "function";

  return (
    <div
      className={"metric " + (interactive ? "metricInteractive" : "")}
      onClick={onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="n">{n}</div>
      <div className="muted">{l}</div>
      {hint && <div className="metricHint">{hint}</div>}
    </div>
  );
}
