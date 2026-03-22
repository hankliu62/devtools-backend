# devtools-backend

通用工具 API 服务 - 部署到 Vercel

## API 端点

| 端点 | 功能 | 参数 |
|------|------|------|
| `/api/story?action=list` | 故事列表 | type_id, keyword, page |
| `/api/story?action=details` | 故事详情 | story_id |
| `/api/story` (默认) | 故事分类 | - |
| `/api/ai?action=story-summary` | 故事摘要 | POST: apiKey, title, content |
| `/api/ai?action=story-continue` | 故事续写 | POST: apiKey, title, content |
| `/api/ai?action=history-interpretation` | 历史解读 | POST: apiKey, title, year, month, day, details |
| `/api/ai?action=image-process` | 图像处理 | POST: apiKey, imageBase64, prompt, feature |
| `/api/ai?action=remove-background` | 移除背景 | POST: apiKey, image_file |
| `/api/tools?action=calendar` | 节假日查询 | date (YYYYMM) |
| `/api/tools?action=history-today` | 历史上的今天 | type |
| `/api/tools?action=translate` | 翻译 | POST: apiKey, text, targetLang |
| `/api/tools?action=image-analyze` | 图像分析 | POST: apiKey, model, imageBase64 |
| `/api/tools?action=ai-prompt-optimizer` | Prompt 优化 | POST: apiKey, model, prompt, input |
| `/api/tools?action=color-analyze` | 颜色分析 | POST: hex, apiKey, model |

## 项目结构

```
devtools-backend/
├── api/
│   ├── story.ts          # 故事相关 API (types, list, details)
│   ├── ai.ts             # AI 相关 API (story-summary, story-continue, etc.)
│   └── tools.ts          # 工具 API (calendar, translate, color-analyze, etc.)
├── package.json
├── tsconfig.json
├── vercel.json
└── .env.example
```

## 环境变量

复制 `.env.example` 为 `.env.local` 并配置：

```bash
# 墨尼哲 API（故事、日历、历史上的今天）
MXNZP_APP_ID=your_app_id_here
MXNZP_APP_SECRET=your_app_secret_here
```

## 本地开发

```bash
npm install
npx vercel dev --yes
```

访问 http://localhost:3000/api/story 测试 API。

## 部署到 Vercel

### 方式一：手动部署

```bash
npx vercel --prod
```

### 方式二：GitHub Actions 自动部署（推荐）

当代码推送到 `master` 分支时，会自动部署到 Vercel 生产环境。

#### 1. 获取 Vercel 凭证

**Step 1.1: 获取 Vercel Token**

1. 访问 [vercel.com/account/tokens](https://vercel.com/account/tokens)
2. 点击 **Create** 创建新 Token
3. 输入 Token 名称（如 `github-actions`）
4. 点击 **Generate**
5. 复制生成的 Token

**Step 1.2: 获取 ORG_ID 和 PROJECT_ID**

在终端运行以下命令（需先登录 Vercel）：

```bash
vercel login          # 如果未登录
vercel projects ls    # 查看项目列表
```

输出示例：
```
> Fetched 1 project(s). Ready!
>
> abc12345    hankliu/devtools-backend [org_xxxxxx]
```

- `abc12345` → `VERCEL_PROJECT_ID`
- `org_xxxxxx` → `VERCEL_ORG_ID`

#### 2. 配置 GitHub Secrets

在 GitHub 仓库 **Settings → Secrets and variables → Actions** 中点击 **New repository secret**，添加以下 3 个 Secret：

| Secret 名称 | 获取方式 | 示例值 |
|------------|---------|--------|
| `VERCEL_TOKEN` | [vercel.com/account/tokens](https://vercel.com/account/tokens) | `xxxxxxxxxxxxx` |
| `VERCEL_ORG_ID` | `vercel projects ls` 查看 | `org_xxxxxxxx` |
| `VERCEL_PROJECT_ID` | 同上 | `prj_xxxxxxxx` |

#### 3. 配置 Vercel 环境变量

在 Vercel 项目 **Settings → Environment Variables** 中添加：

| 变量名 | 说明 |
|-------|------|
| `MXNZP_APP_ID` | 墨尼哲 API App ID（[申请地址](https://www.mxnzp.com/)） |
| `MXNZP_APP_SECRET` | 墨尼哲 API App Secret |

#### 4. 部署流程

| 触发条件 | 部署目标 |
|---------|---------|
| Push 到 `master` | **生产环境** |
| 创建 PR | **预览环境** + PR 评论预览链接 |

#### 5. 部署区域配置

如需更改部署区域，修改 `vercel.json` 中的 `regions`：

```json
{
  "regions": ["iad1"]   // 美东（默认）
  // "regions": ["hnd1"]  // 东京
  // "regions": ["sin1"]  // 新加坡
}
```

## 前端接入

部署完成后，在前端项目中修改 API 调用地址：

```javascript
// 原来
const response = await fetch('/api/story');

// 修改为
const response = await fetch('https://your-vercel-app.vercel.app/api/story');
```
