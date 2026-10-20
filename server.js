// 仅三天猫运营助手 · 后端
// 作用：提供网页文件，并把 AI 请求转发给大模型接口。API Key 只保存在服务器的环境变量里，不会出现在网页中。
const express = require("express");
const path = require("path");

const app = express();
app.use(express.json({ limit: "300kb" }));
app.use(express.static(path.join(__dirname, "public")));

// 兼容 OpenAI 格式的大模型接口（DeepSeek、通义千问、豆包等都支持）
const BASE_URL = (process.env.AI_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
const API_KEY = process.env.AI_API_KEY || "";
const MODEL = process.env.AI_MODEL || "deepseek-flash";

// 简单限流：每个 IP 每分钟最多 10 次，防止被刷
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  list.push(now);
  hits.set(ip, list);
  return list.length > 10;
}

app.get("/api/health", (req, res) => res.json({ ok: Boolean(API_KEY) }));

async function callModel(prompt) {
  const r = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.3,
      max_tokens: 8000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "你是严谨的电商运营与广告合规助手。只输出符合要求的 JSON，不要输出任何其他文字。表达简洁。" },
        { role: "user", content: prompt },
      ],
    }),
  });
  const data = await r.json();
  if (!r.ok) {
    console.error("AI 接口错误：", r.status, JSON.stringify(data).slice(0, 500));
    const err = new Error(r.status === 402 ? "AI 账户余额不足，请充值后再试。" : "AI 服务返回错误，请稍后重试。");
    err.code = r.status === 402 ? "insufficient_balance" : "upstream_error";
    err.final = true;
    throw err;
  }
  const text = data.choices?.[0]?.message?.content || "";
  const json = text.match(/\{[\s\S]*\}/);
  if (!json) { const e = new Error("AI 返回的格式不完整，请再试一次。"); e.code = "invalid_json"; throw e; }
  try { return JSON.parse(json[0]); }
  catch (_) { console.error("JSON 解析失败，finish_reason=", data.choices?.[0]?.finish_reason); const e = new Error("AI 返回的格式不完整，请再试一次。"); e.code = "invalid_json"; throw e; }
}

app.post("/api/ai", async (req, res) => {
  if (!API_KEY) return res.status(500).json({ code: "not_configured", message: "服务器还没有配置 AI_API_KEY。" });
  if (limited(req.ip)) return res.status(429).json({ code: "rate_limited", message: "请求太频繁，请稍等一分钟再试。" });

  const prompt = String(req.body?.prompt || "");
  if (!prompt || prompt.length > 20000) return res.status(400).json({ code: "invalid_request", message: "请求内容为空或过长。" });

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return res.json({ data: await callModel(prompt) });
    } catch (e) {
      if (e.final || attempt === 2) return res.status(502).json({ code: e.code || "upstream_error", message: e.message || "AI 服务暂时不可用，请稍后重试。" });
      console.error("第 1 次失败，自动重试：", e.message);
    }
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`仅三天猫运营助手已启动：http://localhost:${port}`));
