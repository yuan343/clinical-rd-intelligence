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
            {tab === "signals" && <RealtimeSignals data={data} />}

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
  if (tab === "ongoing") return "On Going｜在研联合";
  if (tab === "failures") return "终止 / 暂停项目";
  if (tab === "trials") return "临床项目";
  if (tab === "papers") return "文献证据";
  if (tab === "sources") return "信息来源";

  return "实时研发动态 → 潜在联合机会";
}

/* =========================================================
   实时机会
   新的主页面
   ========================================================= */

function RealtimeSignals({ data }) {
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
          已有联合项目和 Pattern 主要作为证据支持，而不是新机会的唯一来源。
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
          n={data.combinationPatterns?.length || 0}
          l="可参考联合 Pattern"
        />

        <Metric
          n={data.potentialCombinations?.length || 0}
          l="On Going 迁移机会"
        />
      </div>

      <section className="card section">
        <h2>最新重点 Signal</h2>

        <div className="note">
          当前数据主要来自 ClinicalTrials.gov；
          下一阶段将接入临床结果、会议、公司公告、监管和最新机制文献，
          用于真正的实时联合机会推导。
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

      <section className="card section">
  <h2>预计可组合方向</h2>

  <div className="note">
    这里展示基于当前研发 Signal 和已有联合规律形成的候选联合方向。
    下一步将进一步升级为实时 Signal 驱动的联合假设。
  </div>

  {(data.potentialCombinations || []).length ? (
    <table>
      <thead>
        <tr>
          <th>预计联合方向</th>
          <th>触发依据</th>
          <th>潜在互补逻辑</th>
          <th>参考 Pattern</th>
          <th>现有开发核对</th>
          <th>时间窗口</th>
        </tr>
      </thead>

      <tbody>
        {data.potentialCombinations.slice(0, 8).map((x, i) => (
          <tr key={i}>
            <td>
              <b>{x.a} + {x.b}</b>

              <div className="small">
                {x.mechanismA} + {x.mechanismB}
              </div>
            </td>

            <td>
              {x.problem || "基于当前研发 Signal / Pattern 推导"}
            </td>

            <td>{x.compensation}</td>

            <td>{x.referencePattern || "-"}</td>

            <td>{x.developmentStatus}</td>

            <td>当前待评估</td>
          </tr>
        ))}
      </tbody>
    </table>
  ) : (
    <div className="muted">
      当前检索暂未形成可展示的联合假设。
    </div>
  )}
</section>    
      <section className="card section">
        <h2>Signal → 联合机会</h2>

        <div className="note">
          这一部分将成为系统的核心：
          从实时医学动态中形成新的 Combination Hypothesis。
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
            text="这个变化说明现有治疗还缺什么？疗效深度、持续性、耐药、安全性还是患者选择？"
          />

          <FlowCard
            title="3. 联合假设"
            text="哪些新的机制可能解决这个问题？形成候选 A+B。"
          />

          <FlowCard
            title="4. 证据验证"
            text="用已有联合 Pattern、PubMed、临床数据和反例验证逻辑。"
          />

          <FlowCard
            title="5. 时间窗口"
            text="核对竞争阶段、领先项目和赛道拥挤度，判断现在做是否仍有价值。"
          />
        </div>
      </section>

      <section className="card section">
        <h2>当前待升级能力</h2>

        <div className="note">
          这一页目前已经完成 Signal 展示，但尚未完成真正的
          “实时 Signal → 新联合假设”自动推导。
        </div>

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
              <td>临床试验动态</td>
              <td>已接入</td>
              <td>继续识别状态、Phase和项目变化</td>
            </tr>

            <tr>
              <td>PubMed文献</td>
              <td>已接入基础检索</td>
              <td>升级为机制、耐药和联合依据提取</td>
            </tr>

            <tr>
              <td>实时临床读出</td>
              <td>待接入</td>
              <td>会议 / 公司公告 / 论文结果结构化</td>
            </tr>

            <tr>
              <td>新联合假设</td>
              <td>待开发</td>
              <td>Signal → Problem → Mechanism → Combination</td>
            </tr>

            <tr>
              <td>市场时间窗口</td>
              <td>待开发</td>
              <td>领先阶段、竞争数量、预计时间差</td>
            </tr>
          </tbody>
        </table>
      </section>
    </>
  );
}

/* =========================================================
   ON GOING
   把我们之前已经做好的整个体系收进这里
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
          l="迁移机会"
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

      <section className="card section">
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
        <h2>基于 On Going Pattern 的迁移机会</h2>

        <div className="note">
          这一部分来自已有临床联合规律的迁移，
          科学依据通常更成熟，但需要特别关注竞争进度和市场时间窗口。
        </div>

        {potential.length ? (
          <table>
            <thead>
              <tr>
                <th>候选联合</th>
                <th>参考 Pattern</th>
                <th>推导依据</th>
                <th>可能成立的条件</th>
                <th>主要限制因素</th>
                <th>现有开发核对</th>
              </tr>
            </thead>

            <tbody>
              {potential.map((x, i) => (
                <tr key={i}>
                  <td>
                    <b>
                      {x.a} + {x.b}
                    </b>

                    <div className="small">
                      {x.mechanismA} + {x.mechanismB}
                    </div>
                  </td>

                  <td>{x.referencePattern}</td>

                  <td>{x.rationale}</td>

                  <td>{x.successCondition}</td>

                  <td>{x.failureBoundary}</td>

                  <td>
                    {x.developmentStatus}

                    <div className="small">
                      {x.verification}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="muted">
            当前检索暂未生成满足条件的迁移机会。
          </div>
        )}
      </section>
    </>
  );
}

/* =========================================================
   其他已有页面
   ========================================================= */

function Failures({ data }) {
  return (
    <section className="card">
      <h2>终止 / 暂停项目</h2>

      <div className="note">
        项目终止或暂停不等于机制失败；
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

function Papers({ papers }) {
  return (
    <section className="card">
      <h2>PubMed 文献证据</h2>

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

function Metric({ n, l }) {
  return (
    <div className="metric">
      <div className="n">{n}</div>
      <div className="muted">{l}</div>
    </div>
  );
}
