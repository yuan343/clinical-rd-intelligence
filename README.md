# 临床研发情报工作台（真实数据版）

这是从原型 V3.1 升级而来的可部署 Web 应用。

## 已真实接入的数据源

- ClinicalTrials.gov API v2
- PubMed E-Utilities
- Crossref REST API

搜索任意靶点、分子或组合后，网页会实时获取公开数据，并生成：
- 最新/高价值 Signal
- 终止/暂停/撤回项目提醒
- 真实临床联合共现候选
- Signal → Problem → Combination → Evidence → Priority
- PubMed / Crossref 文献线索
- 一手试验记录链接

## 运行

```bash
npm install
npm run dev
```

浏览器打开 http://localhost:3000

## 部署

推荐 Vercel。将整个项目上传到 GitHub 后导入 Vercel，或使用 Vercel CLI / ChatGPT Vercel 连接器部署。

## 当前边界

当前 Combination 排序是“情报优先级”，主要基于：
- 联合试验数量
- 活跃 vs 终止/暂停状态
- 最近更新时间

它不是医学结论。下一阶段应加入：
1. 公司官网 / pipeline / press release 监测
2. ASCO / ESMO / AACR / WCLC 会议监测
3. FDA / EMA / NMPA / CDE
4. BD 交易与新闻
5. 机制知识图谱与 AI 证据推理
6. Watchlist、定时刷新、变化检测与历史版本
