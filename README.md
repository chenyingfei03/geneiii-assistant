# 仅三天猫运营助手 · 部署说明

## 文件结构
- `public/index.html`：网页本体（合规预审 + 店铺数据看板）
- `server.js`：后端，负责提供网页并转发 AI 请求
- `package.json`：依赖说明

## 第一步：申请大模型 API Key
以 DeepSeek 为例：在 DeepSeek 开放平台注册、充值少量金额，创建 API Key。
接口地址和模型名称以平台文档为准。其他兼容 OpenAI 格式的国内模型（如通义千问、豆包）也可以，只需改下面的环境变量。

## 第二步：上传到 GitHub
新建一个仓库，把整个文件夹上传。**不要把 API Key 写进任何文件。**

## 第三步：在 Railway 部署
1. New Project → Deploy from GitHub repo → 选择这个仓库
2. 在 Variables 里添加环境变量：
   - `AI_API_KEY`：你的 API Key（必填）
   - `AI_BASE_URL`：默认 `https://api.deepseek.com`，用其他模型时修改
   - `AI_MODEL`：默认 `deepseek-flash`，以平台文档的模型名为准
3. Settings → Networking → Generate Domain，得到网址

## 第四步：检查
- 打开网址，左上角显示"AI 已连接"即配置成功
- 打开 `网址/api/health`，返回 `{"ok":true}` 说明 Key 已配置
- **用国内网络（手机流量）打开测试一次**，确认面试官能正常访问

## 本地运行（可选）
```
npm install
AI_API_KEY=你的Key npm start
```
然后打开 http://localhost:3000
