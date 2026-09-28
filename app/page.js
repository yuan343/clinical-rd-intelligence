"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [q, setQ] = useState("PD-L1 VEGF");
  const [active, setActive] = useState("PD-L1 VEGF");
  const [mode, setMode] = useState("auto");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("radar");

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
          ["radar", "情报雷达"],
          ["patterns", "联合规律 Pattern"],
          ["existing", "已有联合证据"],
          ["potential", "潜在联合机会"],
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
            {tab === "radar" && <Radar data={data} />}
            {tab === "patterns" && <Patterns data={data} />}
            {tab === "existing" && <ExistingCombos data={data} />}
            {tab === "potential" && <PotentialCombos data={data} />}
            {tab === "failures" && <Failures data={data} />}
            {tab === "trials" && <Trials trials={data.trials || []} />}
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
  if (tab === "patterns") return "联合规律 Pattern";
  if (tab === "existing") return "已有联合证据";
  if (tab === "potential") return "潜在联合机会";
  if (tab === "failures") return "终止 / 暂停项目";
  if (tab === "trials") return "临床项目";
  if (tab === "papers") return "文献证据";
  if (tab === "sources") return "信息来源";

  return "研发信号 → 联合规律 → 潜在联合机会";
}

function Radar({ data }) {
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
          推导逻辑：已有联合证据 → 联合规律 Pattern → 潜在联合机会
        </div>

        <div
          className="muted"
          style={{
            marginTop: 5,
            lineHeight: 1.6,
          }}
        >
          基于真实临床联合项目提炼可迁移规律，并核对现有开发情况，
          筛选尚未发现明确临床开发的潜在联合方向。
        </div>
      </section>

      <div className="metrics">
        <Metric
          n={data.highValueSignals?.length || 0}
          l="重点 Signal"
        />

        <Metric
          n={data.combinationPatterns?.length || 0}
          l="联合规律 Pattern"
        />

        <Metric
          n={data.existingCombinations?.length || 0}
          l="已有联合项目"
        />

        <Metric
          n={data.potentialCombinations?.length || 0}
          l="潜在联合机会"
        />
      </div>

      <section className="card section">
        <h2>重点 Signal</h2>

        <div className="note">
          用于提示当前值得进一步核对的研发变化，不代表系统已经形成联合建议。
        </div>

        {data.highValueSignals?.length ? (
          <table>
            <thead>
              <tr>
                <th>项目</th>
                <th>关注原因</th>
                <th>当前状态</th>
                <th>为什么值得关注</th>
                <th>建议进一步核对</th>
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
                        "signalBadge " + signalClass(t.highValueType)
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
          <div className="muted">暂无重点 Signal。</div>
        )}
      </section>

      <section className="card section">
        <h2>近期潜在联合机会</h2>

        <div className="note">
          候选方向来自已有联合规律的迁移，并经过现有临床开发情况核对。
        </div>

        {(data.potentialCombinations || []).length ? (
          <table>
            <thead>
              <tr>
                <th>候选联合</th>
                <th>参考联合规律</th>
                <th>推导依据</th>
                <th>现有开发核对</th>
              </tr>
            </thead>

            <tbody>
              {data.potentialCombinations.slice(0, 5).map((x, i) => (
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

                  <td>{x.developmentStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="muted">
            当前检索暂未生成满足条件的潜在联合方向。
          </div>
        )}
      </section>
    </>
  );
}

function Patterns({ data }) {
  const patterns = data.combinationPatterns || [];

  return (
    <section className="card">
      <h2>联合规律 Pattern 库</h2>

      <div className="note">
        从真实临床联合项目中提炼机制互补逻辑、可能成立的条件和主要限制因素，
        用于后续潜在联合机会推导。
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
              <th>参考临床联合证据</th>
            </tr>
          </thead>

          <tbody>
            {patterns.map((p) => (
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

                <td>
                  {(p.sourceCombinations || []).length ? (
                    <ul className="compactList">
                      {p.sourceCombinations.slice(0, 4).map((x, i) => (
                        <li key={i}>
                          {x.combo}
                          <span className="small">
                            {" "}
                            · {x.trials} 项试验
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="muted">
          当前检索尚未形成可迁移的联合规律。
        </div>
      )}
    </section>
  );
}

function ExistingCombos({ data }) {
  return (
    <section className="card">
      <h2>已有联合证据</h2>

      <div className="note">
        这里展示已经进入临床开发的真实联合项目。
        它们主要用于提炼联合规律、理解成功与失败边界，不作为新的联合机会推荐。
      </div>

      {(data.existingCombinations || []).length ? (
        <table>
          <thead>
            <tr>
              <th>联合方案</th>
              <th>适应症</th>
              <th>Phase</th>
              <th>相关试验数</th>
              <th>活跃项目</th>
              <th>终止 / 暂停</th>
              <th>主要用途</th>
            </tr>
          </thead>

          <tbody>
            {(data.existingCombinations || []).map((c) => (
              <tr key={c.combo}>
                <td>
                  <a href={comboHref(data, c)}>
                    <b>{c.combo}</b> ↗
                  </a>
                </td>

                <td>
                  {c.indications?.slice(0, 3).join("；") || "-"}
                </td>

                <td>{c.phases?.join("；") || "-"}</td>

                <td>{c.trials}</td>

                <td>{c.active}</td>

                <td>{c.risk}</td>

                <td>作为联合规律和潜在机会推导的证据输入</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="muted">暂无已有联合项目。</div>
      )}
    </section>
  );
}

function PotentialCombos({ data }) {
  const combinations = data.potentialCombinations || [];

  return (
    <section className="card">
      <h2>潜在联合机会</h2>

      <div className="note">
        候选方向需有已有联合规律作为推导依据，并经过现有临床开发情况核对。
        当前结果用于机会筛选，不代表联合疗效已经得到验证。
      </div>

      {combinations.length ? (
        <table>
          <thead>
            <tr>
              <th>潜在联合方向</th>
              <th>当前未解决问题</th>
              <th>潜在互补机制</th>
              <th>参考联合 Pattern</th>
              <th>参考临床联合证据</th>
              <th>可迁移依据</th>
              <th>可能成立的条件</th>
              <th>主要限制因素</th>
              <th>现有开发核对</th>
              <th>尚缺证据</th>
            </tr>
          </thead>

          <tbody>
            {combinations.map((x, i) => (
              <tr key={i}>
                <td>
                  <b>
                    {x.a} + {x.b}
                  </b>

                  <div className="small">
                    {x.mechanismA} + {x.mechanismB}
                  </div>
                </td>

                <td>{x.problem}</td>

                <td>{x.compensation}</td>

                <td>
                  <b>{x.referencePattern}</b>

                  <div className="small">
                    {x.evidenceStrength}
                  </div>
                </td>

                <td>
                  {(x.patternSource || []).length ? (
                    <ul className="compactList">
                      {x.patternSource.map((s, j) => (
                        <li key={j}>{s}</li>
                      ))}
                    </ul>
                  ) : (
                    "-"
                  )}
                </td>

                <td>{x.transferRule}</td>

                <td>{x.successCondition}</td>

                <td>{x.failureBoundary}</td>

                <td>
                  {x.developmentStatus}

                  <div className="small">
                    {x.verification}
                  </div>
                </td>

                <td>{x.evidenceGap}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="muted">
          当前检索暂未生成满足联合规律迁移和现有开发排除条件的候选方向。
        </div>
      )}
    </section>
  );
}

function Failures({ data }) {
  return (
    <section className="card">
      <h2>终止 / 暂停项目</h2>

      <div className="note">
        项目终止或暂停并不等同于机制失败。
        需要进一步区分疗效、安全性、剂量、患者选择、研究设计和公司战略等原因。
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
                  需判断是否属于机制问题、分子问题、疗效不足、
                  安全性、剂量、人群选择、研究设计或公司战略因素。
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
        <div className="muted">暂无终止 / 暂停项目。</div>
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

      <div className="note">
        当前用于补充机制和临床证据线索，后续继续接入联合规律验证。
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
        <div className="muted">暂无 PubMed 结果。</div>
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
            <th>更新方式</th>
            <th>主要用途</th>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td>ClinicalTrials.gov</td>
            <td>实时</td>
            <td>
              项目状态、Phase、适应症、干预方案、已有联合项目及现有开发核对
            </td>
          </tr>

          <tr>
            <td>PubMed</td>
            <td>实时</td>
            <td>
              机制证据、临床结果及联合开发相关文献线索
            </td>
          </tr>

          <tr>
            <td>Pattern Engine</td>
            <td>规则推导</td>
            <td>
              从真实已有联合项目中提炼可迁移的联合规律
            </td>
          </tr>

          <tr>
            <td>下一步拟接入</td>
            <td>待增强</td>
            <td>
              公司公告、学术会议、监管信息、BD交易及更完整的机制证据
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
