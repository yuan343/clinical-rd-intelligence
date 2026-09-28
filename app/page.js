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
          ["patterns", "组合 Pattern"],
          ["existing", "已有组合证据"],
          ["potential", "潜在新组合"],
          ["failures", "失败项目"],
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
                  {" · "}系统采用：
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
  if (tab === "patterns") return "组合 Pattern";
  if (tab === "existing") return "已有组合证据";
  if (tab === "potential") return "潜在新组合";
  if (tab === "failures") return "失败项目";
  if (tab === "trials") return "临床项目";
  if (tab === "papers") return "文献证据";
  if (tab === "sources") return "信息来源";

  return "Signal → Pattern → Potential Combination";
}

function Radar({ data }) {
  return (
    <>
      <div className="metrics">
        <Metric
          n={data.highValueSignals?.length || 0}
          l="高价值 Signal"
        />

        <Metric
          n={data.combinationPatterns?.length || 0}
          l="组合 Pattern"
        />

        <Metric
          n={data.existingCombinations?.length || 0}
          l="已有组合"
        />

        <Metric
          n={data.potentialCombinations?.length || 0}
          l="潜在新组合"
        />
      </div>

      <div className="grid2 section">
        <section className="card">
          <h2>High-Value Signals</h2>

          <div className="note">
            这里表示“为什么值得关注”，不是潜在组合推荐。
          </div>

          {data.highValueSignals?.length ? (
            <table>
              <thead>
                <tr>
                  <th>项目</th>
                  <th>Signal</th>
                  <th>状态</th>
                  <th>为什么值得看</th>
                  <th>下一步核对</th>
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
                        {t.highValueType}
                      </span>
                    </td>

                    <td>{t.status}</td>

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
            <div className="muted">暂无高价值 Signal。</div>
          )}
        </section>

        <section className="card dark">
          <h2>当前推导主线</h2>

          <p>1. 真实联合项目形成 Existing Evidence</p>
          <p>2. Existing Evidence 提炼 Combination Pattern</p>
          <p>3. Pattern 解释“为什么这样联合”</p>
          <p>4. Pattern 迁移到其他同机制分子</p>
          <p>5. 排除已经存在的 A+B</p>
          <p>6. 剩下的才进入 Potential New Combination</p>
        </section>
      </div>

      <section className="card section">
        <h2>最新潜在新组合</h2>

        {(data.potentialCombinations || []).length ? (
          <table>
            <thead>
              <tr>
                <th>候选组合</th>
                <th>参考 Pattern</th>
                <th>为什么这样推</th>
                <th>当前开发核对</th>
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
            当前检索未生成足够可靠的潜在新组合。
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
      <h2>Combination Pattern Library</h2>

      <div className="note">
        这里不是简单记录“谁和谁联合”，而是提炼已有真实联合背后的可迁移逻辑。
      </div>

      {patterns.length ? (
        <table>
          <thead>
            <tr>
              <th>Pattern</th>
              <th>核心问题</th>
              <th>补偿机制</th>
              <th>迁移规则</th>
              <th>成功条件</th>
              <th>失败边界</th>
              <th>真实证据来源</th>
            </tr>
          </thead>

          <tbody>
            {patterns.map((p) => (
              <tr key={p.id}>
                <td>
                  <b>{p.pattern}</b>

                  <div className="small">
                    {p.evidenceStrength} · {p.trialCount} trials
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
                            · {x.trials} trials
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
          当前检索没有形成可迁移的 Combination Pattern。
        </div>
      )}
    </section>
  );
}

function ExistingCombos({ data }) {
  return (
    <section className="card">
      <h2>已有组合证据库</h2>

      <div className="note">
        这里全部是已经存在临床开发的真实组合。
        它们的作用是给 Pattern 和潜在组合推导提供证据，而不是作为“新组合”推荐。
      </div>

      {(data.existingCombinations || []).length ? (
        <table>
          <thead>
            <tr>
              <th>组合</th>
              <th>适应症</th>
              <th>Phase</th>
              <th>项目数</th>
              <th>活跃</th>
              <th>失败/暂停</th>
              <th>作用</th>
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

                <td>作为 Pattern / Evidence 输入</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="muted">暂无已有组合数据。</div>
      )}
    </section>
  );
}

function PotentialCombos({ data }) {
  const combinations = data.potentialCombinations || [];

  return (
    <section className="card">
      <h2>Potential New Combinations</h2>

      <div className="note">
        这里的候选组合必须有“已有 Combination Pattern”作为推导来源，
        并且已经经过 ClinicalTrials.gov 的现有组合排查。
      </div>

      {combinations.length ? (
        <table>
          <thead>
            <tr>
              <th>潜在组合</th>
              <th>A的问题</th>
              <th>B补什么</th>
              <th>来自哪个 Pattern</th>
              <th>参考真实组合</th>
              <th>迁移逻辑</th>
              <th>成功条件</th>
              <th>失败边界</th>
              <th>开发状态</th>
              <th>证据缺口</th>
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
          当前检索未生成满足 Pattern 迁移和现有组合排除条件的候选。
        </div>
      )}
    </section>
  );
}

function Failures({ data }) {
  return (
    <section className="card">
      <h2>失败 / 暂停项目</h2>

      <div className="note">
        失败项目是识别未解决问题的重要输入，但不能仅凭“失败”就直接生成新组合。
      </div>

      {(data.failures || []).length ? (
        <table>
          <thead>
            <tr>
              <th>项目</th>
              <th>状态</th>
              <th>适应症</th>
              <th>干预</th>
              <th>需要回答的问题</th>
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

                <td>{t.status}</td>

                <td>{t.conditions.join("；")}</td>

                <td>{t.interventions.join(" + ")}</td>

                <td>
                  这是机制失败、分子失败、剂量问题、人群问题、
                  安全性问题还是战略终止？
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
        <div className="muted">暂无失败/暂停项目。</div>
      )}
    </section>
  );
}

function Trials({ trials }) {
  return (
    <section className="card">
      <h2>ClinicalTrials.gov</h2>

      <table>
        <thead>
          <tr>
            <th>NCT</th>
            <th>项目</th>
            <th>适应症</th>
            <th>Phase</th>
            <th>Status</th>
            <th>干预</th>
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

              <td>{t.status}</td>

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
      <h2>PubMed</h2>

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
        <div className="muted">暂无PubMed结果。</div>
      )}
    </section>
  );
}

function Sources({ data }) {
  return (
    <section className="card">
      <h2>信息来源</h2>

      <table>
        <tbody>
          <tr>
            <td>ClinicalTrials.gov</td>
            <td>实时</td>
            <td>
              项目、状态、阶段、干预、已有组合、潜在组合排查
            </td>
          </tr>

          <tr>
            <td>PubMed</td>
            <td>实时</td>
            <td>
              当前用于文献线索；下一步继续接入 Pattern 机制验证
            </td>
          </tr>

          <tr>
            <td>Pattern Engine</td>
            <td>当前规则版</td>
            <td>
              从真实已有联合中提取可迁移机制模式
            </td>
          </tr>

          <tr>
            <td>下一步</td>
            <td>待增强</td>
            <td>
              PubMed机制证据、公司公告、会议数据、监管、BD交易
            </td>
          </tr>

          <tr>
            <td>更新时间</td>
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
