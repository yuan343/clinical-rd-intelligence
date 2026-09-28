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
          <small>Live BD & Combination Intelligence</small>
        </div>

        {[
          ["radar", "实时情报雷达"],
          ["combo", "组合机会池"],
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
            <h1>
              {tab === "combo"
                ? "组合机会池"
                : tab === "trials"
                ? "临床项目"
                : tab === "papers"
                ? "文献证据"
                : tab === "sources"
                ? "信息来源"
                : "Signal → Combination"}
            </h1>

            <div className="muted">
              当前检索：{active}
              {data && (
                <>
                  {" · "}系统采用：
                  <b>
                    {data.selectedMode === "condition"
                      ? "适应症精确检索"
                      : "分子/靶点全文检索"}
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
              {tab === "combo" && <Combos data={data} />}
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

function Radar({ data }) {
  return (
    <>
      <div className="metrics">
        <Metric n={data.relevantSignals?.length || 0} l="相关项目" />
        <Metric n={data.highValueSignals?.length || 0} l="高价值 Signal" />
        <Metric n={data.combinations?.length || 0} l="组合候选" />
        <Metric n={data.publications?.length || 0} l="PubMed 线索" />
      </div>

      <div className="grid2 section">
        <section className="card">
          <h2>High-Value Signals</h2>

          <div className="note">
            只有出现明确“情报触发事件”的项目才进入这里。
            这里的“高价值”指 BD / 研发情报价值，不等于医学价值判断。
          </div>

          {data.highValueSignals?.length ? (
            <table>
              <thead>
                <tr>
                  <th>项目</th>
                  <th>Signal 类型</th>
                  <th>为什么值得看</th>
                  <th>下一步核对</th>
                  <th>来源</th>
                </tr>
              </thead>

              <tbody>
                {data.highValueSignals.map((t) => (
                  <tr key={t.nctId}>
                    <td>
                      <b>{t.title}</b>
                      <div className="small">
                        {t.nctId} · {t.phase} · {t.status}
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

                    <td>
                      <ul className="compactList">
                        {t.highValueReasons.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </td>

                    <td>{t.nextCheck}</td>

                    <td>
                      <a href={t.url} target="_blank" rel="noreferrer">
                        ClinicalTrials ↗
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="muted">
              本次检索尚未发现满足高价值规则的 Signal。
            </div>
          )}
        </section>

        <section className="card dark">
          <h2>什么才算 High-Value Signal？</h2>
          <p>• 终止 / 暂停 / 撤回：优先拆失败原因</p>
          <p>• 项目完成：关注结果读出与后续策略</p>
          <p>• 真实多干预开发：关注组合逻辑</p>
          <p>• II / III 期：对竞争格局影响更大</p>
          <p>• 近 30 / 90 天更新：可能出现关键变化</p>
        </section>
      </div>

      <section className="card section">
        <h2>Relevant Signals</h2>

        <div className="note">
          这里仅代表与当前搜索高度相关，不代表一定具有高 BD 价值。
        </div>

        <table>
          <thead>
            <tr>
              <th>项目</th>
              <th>适应症</th>
              <th>状态</th>
              <th>干预</th>
              <th>更新时间</th>
              <th>来源</th>
            </tr>
          </thead>

          <tbody>
            {(data.relevantSignals || []).map((t) => (
              <tr key={t.nctId}>
                <td>
                  <b>{t.title}</b>
                  <div className="small">{t.nctId}</div>
                </td>

                <td>{t.conditions.join("；")}</td>
                <td>{t.status}</td>
                <td>{t.interventions.join(" + ")}</td>
                <td>{t.updated || "-"}</td>

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
    </>
  );
}

function signalClass(type) {
  if (type === "失败/暂停") return "danger";
  if (type === "关键读出") return "warning";
  if (type === "后期临床") return "purple";
  if (type === "联合开发") return "success";
  if (type === "近期重大更新") return "blue";
  return "";
}

function comboHref(data, c) {
  return `/combo?a=${encodeURIComponent(c.a)}&b=${encodeURIComponent(
    c.b
  )}&q=${encodeURIComponent(data.query)}`;
}

function Combos({ data }) {
  return (
    <section className="card">
      <h2>组合机会池</h2>

      <div className="note">
        组合名称可以点击进入详情。
        详情页会重新核对真实联合试验，并区分“同一试验出现”和“同一治疗臂明确联合”。
      </div>

      <table>
        <thead>
          <tr>
            <th>组合</th>
            <th>涉及适应症</th>
            <th>Phase</th>
            <th>临床项目</th>
            <th>活跃</th>
            <th>失败/暂停</th>
            <th>近期更新</th>
            <th>证据</th>
          </tr>
        </thead>

        <tbody>
          {data.combinations.map((c) => (
            <tr key={c.combo}>
              <td>
                <a className="comboLink" href={comboHref(data, c)}>
                  <b>{c.combo}</b> ↗
                </a>
              </td>

              <td>{c.indications.slice(0, 3).join("；") || "-"}</td>
              <td>{c.phases.join("；") || "-"}</td>
              <td>{c.trials}</td>
              <td>{c.active}</td>
              <td>{c.risk}</td>
              <td>{c.recent}</td>
              <td>{c.evidence}</td>
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
            <td>试验、适应症、状态、干预、治疗臂</td>
          </tr>

          <tr>
            <td>PubMed</td>
            <td>实时</td>
            <td>机制与临床文献线索</td>
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

function Metric({ n, l }) {
  return (
    <div className="metric">
      <div className="n">{n}</div>
      <div className="muted">{l}</div>
    </div>
  );
}
