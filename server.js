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

app.post("/api/ai", async (req, res) => {
  if (!API_KEY) return res.status(500).json({ code: "not_configured", message: "服务器还没有配置 AI_API_KEY。" });
  if (limited(req.ip)) return res.status(429).json({ code: "rate_limited", message: "请求太频繁，请稍等一分钟再试。" });

  const prompt = String(req.body?.prompt || "");
  if (!prompt || prompt.length > 20000) return res.status(400).json({ code: "invalid_request", message: "请求内容为空或过长。" });

  try {
    const r = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.3,
        max_tokens: 4000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "你是严谨的电商运营与广告合规助手。只输出符合要求的 JSON，不要输出任何其他文字。" },
          { role: "user", content: prompt },
        ],
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      console.error("AI 接口错误：", r.status, JSON.stringify(data).slice(0, 500));
      return res.status(502).json({ code: "upstream_error", message: "AI 服务返回错误，请稍后重试。" });
    }
    const text = data.choices?.[0]?.message?.content || "";
    if (!text.trim()) return res.status(502).json({ code: "invalid_json", message: "AI 这次没有返回内容，请再试一次。" });
    const json = text.match(/\{[\s\S]*\}/);
    if (!json) return res.status(502).json({ code: "invalid_json", message: "AI 返回的格式不完整，请再试一次。" });
    res.json({ data: JSON.parse(json[0]) });
  } catch (e) {
    console.error(e);
    res.status(502).json({ code: "invalid_json", message: "AI 返回的格式不完整，请再试一次。" });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`仅三天猫运营助手已启动：http://localhost:${port}`));
