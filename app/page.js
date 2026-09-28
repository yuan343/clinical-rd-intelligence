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
        setData(await r.json());
      } finally {
        setLoading(false);
      }
    })();
  }, [active, mode]);

  function submit(e) {
    e.preventDefault();
    if (q.trim()) setActive(q.trim());
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
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
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
        ) : (
          data && (
            <>
              {tab === "radar" && <Radar data={data} />}
              {tab === "existing" && <ExistingCombos data={data} />}
              {tab === "potential" && <PotentialCombos data={data} />}
              {tab === "failures" && <Failures data={data} />}
              {tab === "trials" && <Trials trials={data.trials} />}
              {tab === "papers" && <Papers papers={data.publications} />}
              {tab === "sources" && <Sources data={data} />}
            </>
          )
        )}
      </main>
    </div>
  );
}

function pageTitle(tab) {
  if (tab === "existing") return "已有组合证据";
  if (tab === "potential") return "潜在新组合";
  if (tab === "failures") return "失败项目";
  if (tab === "trials") return "临床项目";
  if (tab === "papers") return "文献证据";
  if (tab === "sources") return "信息来源";
  return "Signal → Problem → New Combination";
}

function Radar({ data }) {
  return (
    <>
      <div className="metrics">
        <Metric n={data.highValueSignals?.length || 0} l="高价值 Signal" />
        <Metric n={data.failures?.length || 0} l="失败/暂停项目" />
        <Metric n={data.existingCombinations?.length || 0} l="已有组合" />
        <Metric n={data.potentialCombinations?.length || 0} l="潜在新组合" />
      </div>

      <div className="grid2 section">
        <section className="card">
          <h2>High-Value Signals</h2>

          <div className="note">
            这里只放真正可能改变研发或BD判断的信息。
          </div>

          {data.highValueSignals?.length ? (
            <table>
              <thead>
                <tr>
                  <th>项目</th>
                  <th>重点关注原因</th>
                  <th>当前状态</th>
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
          <h2>新的主逻辑</h2>
          <p>1. 已有项目告诉我们发生了什么</p>
          <p>2. 失败或限制暴露真正问题</p>
          <p>3. 把问题翻译成需要补偿的机制</p>
          <p>4. 找候选 B</p>
          <p>5. 排查 A+B 是否已经有人在做</p>
          <p>6. 只有未充分开发的才进入潜在新组合</p>
        </section>
      </div>

      <section className="card section">
        <h2>从已有证据到潜在新组合</h2>

        <div className="logicFlow">
          <div className="logicStep">
            <b>已有证据</b>
            <p>单药、已有联合、失败项目、疗效与安全性</p>
          </div>

          <div className="logicArrow">→</div>

          <div className="logicStep">
            <b>未解决问题</b>
            <p>疗效不足、耐药、毒性、患者选择、biomarker</p>
          </div>

          <div className="logicArrow">→</div>

          <div className="logicStep">
            <b>机制缺口</b>
            <p>到底需要补什么机制</p>
          </div>

          <div className="logicArrow">→</div>

          <div className="logicStep">
            <b>候选 B</b>
            <p>寻找可补偿机制的靶点/分子</p>
          </div>

          <div className="logicArrow">→</div>

          <div className="logicStep">
            <b>已有组合排查</b>
            <p>如果 A+B 已经广泛临床开发，则只作为 Evidence</p>
          </div>

          <div className="logicArrow">→</div>

          <div className="logicStep highlight">
            <b>Potential New Combination</b>
            <p>真正还未被充分开发的组合机会</p>
          </div>
        </div>
      </section>

      <div className="grid2 section">
        <section className="card">
          <h2>新出现的问题</h2>

          {(data.unmetProblems || []).length ? (
            data.unmetProblems.map((x, i) => (
              <div className="insight" key={i}>
                <b>{x.source}</b>
                <p>{x.problem}</p>
                <div className="small">
                  需要补偿：{x.mechanismNeed}
                </div>
              </div>
            ))
          ) : (
            <div className="muted">暂无可结构化的问题信号。</div>
          )}
        </section>

        <section className="card">
          <h2>最新潜在新组合</h2>

          {(data.potentialCombinations || []).length ? (
            data.potentialCombinations.slice(0, 6).map((x, i) => (
              <div className="insight" key={i}>
                <b>{x.a} + {x.b}</b>
                <p>{x.rationale}</p>
                <div className="small">
                  当前状态：{x.developmentStatus}
                </div>
              </div>
            ))
          ) : (
            <div className="muted">
              当前检索还没有生成新的潜在组合。
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function ExistingCombos({ data }) {
  return (
    <section className="card">
      <h2>已有组合证据库</h2>

      <div className="note">
        这里全部是已经存在临床开发的真实组合。
        它们用于学习机制、成功/失败经验和竞争格局，不再作为“新组合机会”。
      </div>

      <table>
        <thead>
          <tr>
            <th>组合</th>
            <th>适应症</th>
            <th>Phase</th>
            <th>临床项目数</th>
            <th>活跃</th>
            <th>失败/暂停</th>
            <th>用途</th>
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
              <td>{c.indications?.slice(0, 3).join("；") || "-"}</td>
              <td>{c.phases?.join("；") || "-"}</td>
              <td>{c.trials}</td>
              <td>{c.active}</td>
              <td>{c.risk}</td>
              <td>作为 Evidence，不作为新组合候选</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function PotentialCombos({ data }) {
  return (
    <section className="card">
      <h2>Potential New Combinations</h2>

      <div className="note">
        这里才是核心：只有当前没有明确临床开发，
        或仅有极少早期探索的组合，才进入潜在新组合池。
      </div>

      {(data.potentialCombinations || []).length ? (
        <table>
          <thead>
            <tr>
              <th>A</th>
              <th>A 的问题</th>
              <th>候选 B</th>
              <th>B 补什么</th>
              <th>组合逻辑</th>
              <th>该 A+B 当前开发状态</th>
              <th>证据缺口</th>
            </tr>
          </thead>

          <tbody>
            {data.potentialCombinations.map((x, i) => (
              <tr key={i}>
                <td><b>{x.a}</b></td>
                <td>{x.problem}</td>
                <td><b>{x.b}</b></td>
                <td>{x.compensation}</td>
                <td>{x.rationale}</td>
                <td>{x.developmentStatus}</td>
                <td>{x.evidenceGap}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="muted">
          当前版本尚未从现有证据中推导出可靠的新组合。
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
        失败项目不是终点，而是潜在新组合最重要的输入之一。
      </div>

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
                这是机制失败、分子失败、人群/剂量问题，
                还是公司战略终止？
              </td>
              <td>
                <a href={t.url} target="_blank" rel="noreferrer">
                  查看 ↗
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
                <a href={t.url} target="_blank" rel="noreferrer">
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

      {papers.map((p) => (
        <div className="paper" key={p.pmid}>
          <a href={p.url} target="_blank" rel="noreferrer">
            <b>{p.title}</b>
          </a>

          <div className="small">
            {p.journal} · {p.pubdate} · PMID {p.pmid}
          </div>
        </div>
      ))}
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
            <td>试验、状态、阶段、干预、已有组合</td>
          </tr>

          <tr>
            <td>PubMed</td>
            <td>实时</td>
            <td>机制、临床与组合证据线索</td>
          </tr>

          <tr>
            <td>下一步</td>
            <td>待接入</td>
            <td>公司公告、会议、监管、BD交易</td>
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
  return `/combo?a=${encodeURIComponent(c.a)}&b=${encodeURIComponent(
    c.b
  )}&q=${encodeURIComponent(data.query)}`;
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
