# 依然AI (YR AI) — 系统架构地图

> **最后更新：** 2026-08-04（✅ 裂变分镜 500 修复已确认生效：超时对齐 + 思考模式关闭）  
> **维护规则：** 每次新增功能、修改数据库结构、改变核心数据流时，必须同步更新本文档。  
> **读者：** Owner（非技术背景，但需 100% 掌控项目脉络）

---

## 一、项目总览

| 项目 | 说明 |
|------|------|
| **产品名** | 依然AI (YR AI) |
| **定位** | 多模态 AI 工作台，**核心重点是「视觉交响空间 / 视频画布」** |
| **部署** | 云服务器 `49.232.57.73`，前端 `:3000`，后端 `:8000` |
| **本地开发** | 前端 `npm run dev`，后端 `uvicorn main:app --port 8000` |

### 根目录结构

```
my-ai - 服务器/
├── SYSTEM_MAP.md          ← 本文档（架构地图，Owner 的掌控闸门）
├── .env                   ← 根目录环境变量（与后端部分重复）
├── 备用变量.txt            ← 环境变量备份模板（含中文注释）
├── my-ai-frontend/        ← Next.js 14 前端
└── my-ai-backend/         ← FastAPI 后端（单文件 main.py）
```

---

## 二、【系统当前结构】文件树与职责

### 2.1 前端 `my-ai-frontend/`

```
my-ai-frontend/
├── app/
│   ├── layout.tsx                  根布局、页面 metadata（全局样式 + body）
│   ├── globals.css                 全局样式 + Tailwind
│   │
│   ├── page.tsx                    ★★★ 新落地页：深空主题滚动展示（从 Git 历史 c88bceb/bd79edd 恢复）
│   │                                  - 全屏纵向大圆月球液态玻璃动态背景
│   │                                  - 顶部导航栏：LOGO + 登录按钮 + 控制台入口
│   │                                  - Hero 区 + 功能亮点卡片 + CTA
│   │                                  - CSS scroll-snap 强吸附 + 右侧圆点导航
│   │                                  - 暗色调延续现有设计语言
│   │
│   ├── login/
│   │   └── page.tsx                ★ 登录/注册页（独立路由，从 Git 历史 b73e4ca 恢复）
│   │                                  - 登录表单 + 注册表单（邀请码制）
│   │                                  - 星系液态玻璃风格（完整保留原设计）
│   │                                  - 已登录自动跳转 /workspace
│   │                                  - ★ 含「← 返回首页」链接
│   │
│   ├── workspace/
│   │   ├── page.tsx                ★ 工作台薄包装（动态 import WorkspaceApp，ssr:false）
│   │   └── WorkspaceApp.tsx        ★ 工作台 SPA（原 page.tsx 已认证全部内容 + 阶段13-21功能）
│   │                                  - 6 个功能视图 + Sidebar + 同步引擎 + 心跳
│   │                                  - 未登录自动跳转 /login
│   │                                  - 注销后跳回首页 /
│   │
│   └── api/chat/completions/
│       └── route.ts                备用 Next.js 代理（主流程走 /v1 直连后端）
│
├── components/
│   ├── video-canvas/               ★★★ 画布核心模块（项目重点）
│   │   ├── CanvasVault.tsx         画布项目列表（「视觉交响空间」入口页）
│   │   ├── VideoCanvas.tsx         React Flow 画布主工作区
│   │   ├── CustomNodes.tsx         9 种节点类型定义 + 节点内 AI 调用逻辑
│   │   ├── AssetDock.tsx           侧边素材坞（点击触发，拖入历史生图/生视频）
│   │   ├── EpisodeSelectModal.tsx  ★ 集数检测 + 选择弹窗（第十九阶段新增：剧本分段、分块提取）
│   │   ├── CopilotPanel.tsx        ★ 创作助手全局面板（可拖动、多对话、黑色液态玻璃，仅执行 LLM 的 !command 指令）
│   │   ├── CopilotMessage.tsx      ★ 创作助手消息气泡
│   │   ├── CopilotActionCard.tsx   ★ 行动计划预览卡片（已弃用，改为弹窗确认）
│   │   ├── FieldAITrigger.tsx      ★ 字段级 AI 触发（已弃用，改为 SelectionAssist）
│   │   └── SelectionAssist.tsx     ★ 全局文字选中 AI 助手（单选「AI助手」→一次性对话框，画布设置中「全局助手」开关可控）
│   ├── chat/                       AI 对话模块
│   ├── image-gen/                  图片生成模块
│   ├── video-gen/                  视频生成模块
│   ├── workflow/                   工作流/智能体中心
│   ├── sidebar/                    左侧导航栏
│   ├── modals/                     弹窗（设置、搜索、管理员等）
│   │   ├── DialogManager.tsx       ★ 统一弹窗系统（Confirm/Prompt/Message，液态玻璃设计）
│   │   ├── SettingsModal.tsx       ★ 设置/管理员面板
│   │   ├── SearchModal.tsx         全局搜索
│   │   ├── DeleteConfirmModal.tsx  删除确认
│   │   ├── AdminRecordsModal.tsx   管理员记录查看
│   │   └── FilePreviewModal.tsx    文件内容预览
│   └── ui/                         shadcn/ui 基础组件
│
├── hooks/
│   ├── useCanvasEngine.ts          ★ 画布 AI 任务队列（生图/生视频，最大并发 2）
│   ├── useCanvasCopilot.ts         ★ 创作助手引擎（本地意图解析 + LLM 对话 + 行动执行）
│   ├── useChat.ts                  对话逻辑
│   ├── useImageGen.ts              生图逻辑
│   ├── useVideoGen.ts              生视频 + 轮询逻辑
│   └── useWorkflow.ts              工作流执行逻辑
│
├── store/
│   ├── useAppStore.ts              ★ 全局状态（含 canvasProjects、activeView）
│   └── useAuthStore.ts             登录态（isAuthenticated、userRole）
│
├── services/
│   └── api.ts                      统一 API 封装（401/402/403 全局拦截）
│
├── lib/
│   ├── constants.tsx               模型列表、工作流注册表
│   ├── types.ts                    TypeScript 类型定义
│   ├── utils.ts                    工具函数
│   ├── director-rules.ts          ★★★ 参数化导演路由引擎（4个规则仓库+路由类）
│   ├── canvas-manual.ts           ★★ 画布说明书（注入创作助手 System Prompt，描述全部节点/字段/操作）
│   └── dialogStore.ts             ★ 统一弹窗状态机（Zustand，替代浏览器 alert/confirm/prompt）
│
├── next.config.js                  ★ API 代理配置（/v1 → 后端）
├── package.json
├── .env.local                      NEXT_PUBLIC_API_BASE_URL=""
└── Dockerfile
```

### 2.2 后端 `my-ai-backend/`

```
my-ai-backend/
├── main.py                         ★ 全部后端逻辑（约 1850 行，单体架构）
├── requirements.txt                fastapi, uvicorn, httpx, PyJWT, aiofiles, python-dotenv
├── .env                            生产环境配置（API Key、用户账号等）
└── Dockerfile
```

**`main.py` 内部模块划分（逻辑区块，非物理文件）：**

| 行号区间（约） | 职责 |
|---------------|------|
| 1–46 | 计费引擎（生图/生视频 Token 扣费计算） |
| 97–198 | SQLite 数据库初始化 + 用户种子 |
| 213–286 | JWT 认证 + 余额/权限校验 |
| 288–327 | 上游 API 配置（New-API、DMXAPI） |
| 349–520 | 登录/登出/心跳/管理员接口 |
| 540–636 | ★ 数据同步 + Base64 净化（画布存储核心） |
| 686–712 | 云端数据拉取 |
| 717–825 | 聊天代理（SSE 流式） |
| 828–858 | 媒体永久化存储 |
| 860–1327 | 生图代理 |
| 1335–1493 | 生视频代理（异步提交 + 轮询） |
| 1498–1829 | 工作流引擎（内嵌 Prompt） |
| 1834+ | 静态媒体文件服务 |

---

## 三、【数据流向】

### 3.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│  浏览器 (Next.js :3000)                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐ │
│  │ page.tsx    │  │ useAppStore  │  │ VideoCanvas / CustomNodes│ │
│  │ (同步调度)   │←→│ (Zustand)    │←→│ (画布操作)               │ │
│  └──────┬──────┘  └──────────────┘  └─────────────────────────┘ │
│         │ fetch /v1/...                                            │
│         ▼                                                          │
│  next.config.js rewrites                                          │
│  开发: 127.0.0.1:8000  |  生产: 49.232.57.73:8000                │
└─────────┼─────────────────────────────────────────────────────────┘
          ▼
┌─────────────────────────────────────────────────────────────────┐
│  FastAPI 后端 (:8000)                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────────┐  │
│  │ sync_sessions│→ │ purify_base64│→ │ SQLite + /app/media     │  │
│  │ get_sessions │  │ save_media   │  │ canvas_projects 表      │  │
│  └──────────────┘  └──────────────┘  └─────────────────────────┘  │
│         │                                                          │
│         ▼ 代理转发                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │ New-API      │  │ DMXAPI       │  │ Tavily       │             │
│  │ 聊天/生图     │  │ 生视频        │  │ 联网搜索      │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 画布数据流（★ 核心重点）

```
【Owner 在画布上的操作】
    │
    ▼
① VideoCanvas.tsx
   - 用户拖拽节点、连线、编辑 prompt
   - nodes / edges 存在 React Flow 本地 state
   - 每次变更 → updateCanvasProject(id, { nodes, edges, ... })
    │
    ▼
② useAppStore (Zustand)
   - canvasProjects[] 数组更新
   - localStorage 只缓存项目 id/title/updatedAt（防撑爆）
   - 完整 nodes/edges 只在内存 + 云端
    │
    ▼
③ page.tsx 同步调度器
   - canvasProjects 变化 → 1秒防抖写入 latestPayloadRef
    - 再 5秒防抖 → POST /v1/user/sync_sessions
   - 关页时 → navigator.sendBeacon 强制同步
    │
    ▼
④ 后端 sync_sessions (main.py)
   - purify_base64_images(): 递归扫描 JSON，Base64 图片 → 物理文件
   - 替换为永久 URL: http://49.232.57.73:8000/v1/static/media/{uuid}.png
   - INSERT OR REPLACE INTO canvas_projects (id, username, updated_at, data)
   - 后台线程执行，不阻塞前端
    │
    ▼
⑤ 下次登录 GET /v1/user/sessions
   - 从 canvas_projects 表拉回完整 JSON
   - useAppStore.setState({ canvasProjects: data.canvasProjects })
   - VideoCanvas 挂载时注入 nodes/edges
```

### 3.3 画布内 AI 生成流

```
【Owner 在节点上点击「生成」】
    │
    ▼
① CustomNodes.tsx（如 RenderNode / ShotNode）
   - 收集节点 data（prompt、ratio、model 等）
   - 调用 useCanvasEngine().enqueueTask()
    │
    ▼
② useCanvasEngine.ts 任务队列
   - 最大并发 2（防 API 封号）
   - buildImagePayload() / buildVideoPayload() 翻译参数
   - POST /v1/images/generations 或 /v1/videos/generations
   - 视频：轮询 POST /v1/videos/status（3.5秒间隔）
    │
    ▼
③ 后端代理 → 上游 AI API
   - 生图：save_media_permanently() → 返回云服务器 URL
   - 生视频：异步 task_id → 轮询完成后返回 mp4 URL
    │
    ▼
④ 结果写回节点 data.url
   - updateNodeData(nodeId, { url, status: 'done' })
   - 触发 canvasProjects 更新 → 自动同步云端
```

### 3.4 媒体存储规则（★ 本地测试必读）

| 规则 | 说明 |
|------|------|
| **存储位置** | 云服务器 `/app/media/`（Docker 挂载卷） |
| **访问方式** | `GET /v1/static/media/{filename}` |
| **URL 格式** | `http://49.232.57.73:8000/v1/static/media/{uuid}.{ext}` |
| **Base64 处理** | 同步时自动转文件，不再存 Base64 进数据库 |
| **本地测试** | URL 指向云 IP，本地可能**看不到图片**——这是预期行为 |
| **临时调试** | 可临时改 `main.py` 中 URL 为 `127.0.0.1:8000`，测完还原 |

### 3.5 真实比例穿透显示（★ 第一阶段新增）

```
【全局统一比例样式表 RATIO_STYLE_MAP】（CustomNodes.tsx 顶部常量）
  - 6 种比例：21:9 / 16:9 / 4:3 / 1:1 / 3:4 / 9:16
  - 每种比例 = { width: 卡片基准宽度, aspectRatio: 锁定真实物理比例 }
  - 横屏给宽卡片、竖屏给窄卡片，自动缩放不裁切

【复用此表的节点】ShotNode / VideoClipNode / MediaNode / RenderNode
  - 容器始终保留 aspectRatio（无论有图无图，绝不丢比例）
  - 图片/视频一律 object-contain（绝不裁切）
  - 节点外壳宽度跟随比例（抛弃 px 固定宽度）
```

### 3.6 去脏重绘 i2i 数据流（★ 第一阶段新增）

```
【Owner 在 ShotNode/MediaNode 上点击「Wand2 去脏重绘」】
    │
    ▼
① CustomNodes.tsx handleInpaint()
   - 提取当前 resultUrl/frameUrl 作为底图
   - 在原节点右侧创建新 MediaNode（紫色连线，初始 generating 态）
   - 组合重绘 Prompt = 原提示词 + I2I_REPAIR_SUFFIX（面部修复/去多余肢体）
   - 调用 enqueueTask(源id, 'i2i', ..., { baseImage, targetNodeId, prompt })
    │
    ▼
② useCanvasEngine.ts executeI2iTask()
   - 复用 buildImagePayload，用重绘 prompt 覆盖首帧描述，底图作参考图
   - POST /v1/images/generations（后端 i2i 链路已具备，模型用户自选）
   - 结果写入 targetNodeId（右侧新 MediaNode），绝不覆盖源节点
    │
    ▼
③ 后端 image_generations (main.py)
   - gpt-image-2 + 参考图 → handle_gpt_image_edit (/v1/images/edits)
   - banana2 + 参考图 → handle_banana2_edit (Gemini generateContent)
   - 其他模型 → 通用 images 字段
   - save_media_permanently → 返回云服务器 URL
```

### 3.7 全局中控 data 穿透流（★ 第二阶段新增）

```
【Owner 在 MasterScriptNode 上点击「覆盖下游比例」或「追加全局后缀」】
    │
    ▼
① CustomNodes.tsx handleApplyGlobalRatio() / handleApplyGlobalSuffix()
   - 覆盖比例：读取 data.globalRatio，遍历下游所有的 shot 节点，批量将其 data.ratio 更新为全局设定比例，让卡片大小适应其物理形态。
   - 追加后缀：读取 data.globalPromptSuffix，安全清洗 shotNode 上一次被追加的全局后缀 (data.lastAppliedSuffix)，再换行追加最新后缀，保证原有动作描述不被破坏、词句不重复。
    │
    ▼
② 剧本裂变 FissionShots 联动
   - 当点击“裂变分镜”生成一整套二级 shot 卡片时，所有新生成的卡片默认直接继承 Master 节点的 globalRatio 比例以及 globalPromptSuffix 后缀，做到“出厂即对齐”。
    │
    ▼
③ Zustand store & FastAPI sync
    - 前端 useAppStore 拦截变化并更新，5秒防抖打包同步至 SQLite 数据库的 canvas_projects 表中，永久云端保存。
```

### 3.8 双极安全容灾与时空回收站数据流（★ 第二阶段新增）

```
【Owner 误删主中控台/资产表，或普通卡片节点】
    │
    ▼
① VideoCanvas.tsx customOnNodesChange() 捕获删除事件
   ├─► 确认锁拦截 (第一道防线)：
   │   检测到 removeChanges 包含 masterScript / assetTable。
   │   强弹出系统拦截框：“⚠️ 主中控/资产表为分镜核心，您确定要删除吗?”。
   │   若用户点击“取消” -> 直接丢弃 remove 事件，100%死锁卡片，拒绝物理删除！
   │
   └─► 碎裂物捕获 (第二道防线)：
       对于确认删除的卡片或普通卡片（ShotNode/MediaNode/RenderNode/CombineNode），
       在被 React Flow 剔除的前一瞬间，将其节点状态、原坐标及全部相连的 physical edge 物理连线，
       打包灌入局部状态 deletedNodes 栈顶。
    │
    ▼
② 时空裂隙 (Space Recycler) 黑色液态玻璃悬浮舱显示
   - 画布右下角渲染一个高奢圆形微光气泡。数字气泡根据 deletedNodes.length 呈现弹跳呼吸标记。
   - 点击展开，完美显示所有被物理剔除卡片的“类型标签”与“删除时间”。
    │
    ▼
③ handleRestoreNode() 瞬间原位复活
   - 点击“还原”，将 record.node 放回 nodes，并安全筛选 record.edges 中符合重连条件的连线灌回 edges。
   - 节点在原坐标、带原连线、原生成数据、原提示词状态瞬间复原！
    - 此变化在 5 秒后自动防抖同步至 FastAPI SQLite 数据库云端。
```

### 3.13 分模块渐进式加载与数据库写入减压（★ 第八阶段新增）

```
【Owner 刷新页面或登录】
     │
     ├──► fetchCanvasProjects(token)
     │    GET /v1/user/sessions?modules=canvas
     │    只拉 canvas_projects + settings（体积小，速度快）
     │    setHasCanvasLoaded(true)  ← ★ 画布立即渲染，不等聊天/生图历史
     │
     └──► fetchHistoryData(token)  （后台异步，不阻塞画布）
          GET /v1/user/sessions?modules=chat,image,video,workflow
          拉取对话历史/生图历史/生视频历史/工作流会话
          finally: setHasLoadedFromServer(true) ← 允许同步写入
```

**双锁设计（防数据丢失）：**

| 锁 | 用途 | 设置时机 | 门控什么 |
|------|------|----------|----------|
| `hasCanvasLoaded` | 画布渲染锁 | 画布数据加载完成（~100ms-1s） | CanvasVault / VideoCanvas 渲染 |
| `hasLoadedFromServer` | 同步写入锁 | 全部 5 类历史数据加载完成 | forceSyncToServer / beforeunload / logout sync / heartbeat |

**为什么不能只用 hasCanvasLoaded 控制同步：**
- 如果 canvas 加载完就允许 sync，此时 chat/image/video 历史数据还未从云端拉回
- ref 中这些数据是空的 → sync 会发送空数组 → 后端 DELETE 僵尸行逻辑会把云端历史全部删掉！
- 因此 sync、heartbeat、beforeunload、logout 四条写入路径**必须**继续使用 `hasLoadedFromServer`

**数据库写入减压措施：**

| 措施 | 改动 | 效果 |
|------|------|------|
| 心跳不写库 | `POST /v1/user/heartbeat` 去掉 `UPDATE users SET last_active_at` | 每 30 秒减少 1 次 users 表写入 |
| 延长同步间隔 | sync 定时器 2000ms → 5000ms | 写入频率降低 60% |
| 按需读取 | GET /v1/user/sessions 支持 `?modules=canvas` 参数 | 刷新时只拉需要的表，响应体积缩小 70-90% |
| 分模块请求 | 前端拆为 fetchCanvasProjects + fetchHistoryData | 画布 0.1-1s 可交互，历史数据后台慢加载 |

**后端 modules 参数说明：**

```
GET /v1/user/sessions?modules=canvas
  → { settings, canvasProjects }

GET /v1/user/sessions?modules=chat,image
  → { settings, sessions, imageHistory }

GET /v1/user/sessions（无参 / modules=all）
  → { settings, sessions, imageHistory, videoHistory, wfSessions, canvasProjects }
  （完全向后兼容）
```

```### 3.9 参数化导演路由引擎数据流（★ 第三阶段新增）

```
【Owner 在画布中控台选择题材 + 节奏】
    │
    ▼
① VideoCanvas.tsx 中控台面板
   - Owner 从 18 个题材中选择（悬疑/甜宠/动作/古装/科幻...）
   - Owner 可选覆写节奏（极快/偏快/正常/舒缓，留空则跟随题材默认）
   - 存入 useAppStore.canvasSettings.directorGenre / directorTempo
    │
    ▼
② CustomNodes.tsx handleFissionShots() 裂变时
   - DirectorRouter.resolve(genre, tempo) 解析导演上下文
   - 从 4 个规则仓库中取出：
     → 仓库① 布光字典：主光/辅光/环境光/特殊风格的 Prompt 片段
     → 仓库② 节奏档案：时长区间/剪辑策略/运镜速率/画面密度参数
     → 仓库③ 题材预设：光影建议/运镜建议/色彩建议/标志性技法
     → 仓库④ 安全突变：10% 概率投骰子触发非常规镜头
   - llmContextBlock 追加到裂变 System Prompt 末尾（纯追加以外，不删减原有提示词）
   - _directorContext 存到每个新 ShotNode.data 上
    │
    ▼
③ useCanvasEngine.ts buildImagePayload / buildVideoPayload
   - 优先读取 data._directorContext 的结构化片段
   - 如果不存在，回退到老路：data.sceneLighting / data.globalCamera
   - 公式不变，变的是变量的来源
    │
    ▼
④ 后端 API 不变
   - 导演引擎在前端完成全部解析
   - 后端收到的仍是标准 prompt 文本和生图/生视频参数
```

### 3.10 导演引擎规则仓库结构

```
lib/director-rules.ts (约 1800 行)
├── 仓库① 影视级布光字典 — 38 种
│   ├── KEY_LIGHT (10 种主光)
│   ├── FILL_MODIFIER (8 种辅光与修饰)
│   ├── MOTIVATED_LIGHT (12 种环境/动机光)
│   └── SPECIAL_STYLE (8 种特殊光影风格)
├── 仓库② 多维度节奏轴与运镜字典 — 50+ 项
│   ├── TEMPO_PROFILES (4 级节奏，每级 4 维度)
│   ├── CAMERA_MOVEMENTS (20 种运镜)
│   ├── TRANSITION_TYPES (6 种剪辑过渡)
│   └── SHOT_SIZES (6 种景别)
├── 仓库③ 题材情绪权重包 — 18 个题材
│   └── GENRE_PRESETS (每题材 10 个维度，全建议不锁死)
├── 仓库④ 安全突变因子 — 10 种 + 3 条铁律
│   ├── MUTATION_TYPES (10 种非常规镜头)
│   └── MUTATION_SAFETY_RULES (10%触发 + 轴线死锁 + 过渡身份)
└── DirectorRouter 类
    ├── resolve(genre, tempo) → DirectorContext
    ├── rollMutation() → 10% 概率触发
    └── buildLLMContext() → 注入 LLM 的结构化文本块
```

### 3.11 用户注册与 API Key 自助配置（★ 第五阶段新增）

```
【新用户注册】
    │
    ▼
① 管理员 → 设置 → Admin → 生成邀请码
   - POST /v1/admin/invite-codes/generate
   - secrets.token_hex(4) 生成 8 位随机码
   - 有效期 24 小时，存 invite_codes 表
    │
    ▼
② 前端登录页 → CREATE ACCOUNT → 填写用户名/密码/确认密码/邀请码
   - POST /v1/register
    │
    ▼
③ 后端校验：邀请码存在 + 未过期 + 未使用 → 注册后立即标记已使用
    │
    ▼
④ 登录后 → 设置 → API 配置
   - Key 掩码显示（●），眼睛按钮切换，禁止复制
   - Key 为空 → resolve_api_config 回退全局 Key
   - 用户填了自有 Key → 用用户的 Key + URL
```

### 3.12 大师级分镜管线：「三权分立」双阶段架构（★ 第四阶段核心升级）

```
                          ┌──────────────────────────────────────────┐
                          │   导演引擎（美术与剪辑指导）                  │
                          │   director-rules.ts                       │
                          │   - 题材预设 → 提供极品英文光影/运镜咒语      │
                          │   - 节奏档案 → 剪辑策略建议（不锁死）         │
                          │   - 完全解耦题材与节奏，自由混搭              │
                          └──────────────┬───────────────────────────┘
                                         │ injectDirectorContext()
                                         ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                           裂变 handleFissionShots()                         │
│                                                                            │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────────┐  │
│  │  阶段 1：大师分镜师（大脑）        │  │  阶段 2：首帧画师（手）           │  │
│  │  payloadStage1                  │  │  payloadStage2                  │  │
│  │                                 │  │                                 │  │
│  │  职责：统管调度 + 唯一一次光影推演  │  │  职责：翻译静态生图咒语            │  │
│  │  - 接收导演审美引导（建议非强制）   │  │  - 被彻底"蒙上双眼"，不看导演规则   │  │
│  │  - 切分镜头 + 算力分配           │  │  - 100% 照抄阶段1的 shotLighting  │  │
│  │  - 光影推断（三级降级法则★）      │  │  - 严守 8 大静态物理铁律           │  │
│  │  - 时长数学红线（对白÷3.5=最短秒） │  │  - 禁止视频运镜词（防废图）        │  │
│  │                                 │  │                                 │  │
│  │  输出：shots[] JSON              │  │  输出：imagePrompts[]            │  │
│  │  (含 shotLighting/timeSegments)  │  │  (纯静态中文生图咒语)             │  │
│  └──────────────┬──────────────────┘  └──────────────┬──────────────────┘  │
│                 │                                    │                     │
│                 └────────── 缝合合并 ─────────────────┘                     │
│                                    │                                       │
│                                    ▼                                       │
│                      每个 ShotNode 携带：                                   │
│                      - firstFrameAnchor (首帧图咒语)                        │
│                      - videoPrompt (视频动作时序)                           │
│                      - sceneLighting = shotLighting                        │
│                      - _directorContext (导演上下文，供 buildImagePayload)   │
└────────────────────────────────────────────────────────────────────────────┘
```

**数据血缘链（Data Lineage）：**

```
【全局参数】→ 【资产表(AI注入导演基因)】→ 【分镜 JSON(shotLighting)】→ 【首帧咒语(imagePrompt)】→ 【终端渲染】
     │                │                        │                       │
     ▼                ▼                        ▼                       ▼
 DirectorRouter    directorCtx注入          三级降级法则            8大静态铁律
 题材+节奏         AssetTableNode           光影物理推演            防运镜污染
```

---

#### 升级①：资产表格节点注入导演基因（`handleExtractAssetTable`）

```
Owner 点击「提取场景/角色/道具表」
    │
    ▼
① 读取 canvasSettings.directorGenre / directorTempo
② DirectorRouter.resolve() 解析导演上下文
③ directorInjection = directorCtx.llmContextBlock 强行拼入 System Prompt 尾部
④ AI 在提取资产时即带上原汁原味的导演题材基因
   （如悬疑片的场景自动带上低调用光设定）
```

#### 升级②：阶段1 分镜裂变 Prompt 重构（`payloadStage1`）

**新增的工业级铁律：**

| 铁律 | 内容 | 解决的问题 |
|------|------|-----------|
| **时长数学红线** | 对白总中文字数 ÷ 3.5 = 最低物理安全秒数 | 导演要求"极快节奏"时大模型不会崩溃 |
| **节奏补偿法则** | 被台词拉长的镜头 → 切碎 timeSegments 制造快节奏感 | 在长镜头中保持高密度视觉快感 |
| **三级降级光影法则** | ① 优先查资产表继承底色 → ② 没表则看导演规则 → ③ 根据景别裁切画外光源 | 光影推断逻辑闭环，不再混乱 |

#### 升级③：阶段2 首帧提取 Prompt 重构（`payloadStage2`）

```
这次升级的核心：把阶段2变成纯粹的"乐高拼装工"

【做了什么】：
  ✗ 删除了导演上下文注入（彻底物理隔离）
  ✗ 删除了"自行设计光线方向"的越权指令
  ✗ 禁止了所有视频运镜词（残影/晃动/镜头推近/虚化/开始/然后...）
  ✓ 只照抄阶段1的 shotLighting + globalCamera
  ✓ 严守 8 大静态物理铁律（空间站位/轴线死锁/微表情写实化/动态肤质后缀）

【结果】：阶段2不再有"自己的想法"，100%照抄阶段1的光影推演结果
```

#### 升级④：人工介入保护 — 强制缝合（`ShotNode` / `VideoClipNode`）

```
【Bug 现象】用户在单行输入框手动改了 sceneLighting，但后端实际上收到的是裂变时的旧值

【根因】裂变生成的 ShotNode 自带 _directorContext，
       buildImagePayload 检测到 _directorContext 后优先读它的 lightingPrompt，
       完全无视用户手动编辑的 sceneLighting

【修复方案】在 useCanvasEngine.ts buildImagePayload 中：
  - _directorContext?.lightingPrompt 存在时作为基础
  - 但用户手动改了 sceneLighting 且与裂变默认值不同时，追加到 Prompt 尾部
  - 确保 Human-in-the-loop 拥有最高绝对控制权

  涉及代码：
  - CustomNodes.tsx handleGenerateFrame (line 1203)
   - useCanvasEngine.ts buildImagePayload (line 184-195)
```

### 3.13 统一弹窗系统（★ 第六阶段新增：替代浏览器原生弹窗）

```
【Owner 触发弹窗（任意位置）】
     │
     ▼
① showConfirm(title, message, variant?) / showPrompt(title, default?) / showMessage(title, content)
   - 来自 lib/dialogStore.ts 的便捷导出函数
   - 可在任意文件直接 import 调用（无需 React 上下文）
   - 返回 Promise<boolean> / Promise<string|null> / Promise<void>
     │
     ▼
② Zustand Store (useDialogStore)
   - 设置 type + 标题/内容 + resolver
   - 触发 open: true → DialogManager 渲染
     │
     ▼
③ DialogManager 组件（挂载在 page.tsx 根节点）
   - 根据 type 渲染对应弹窗：
     ├─ ConfirmDialog：标题 + 描述 + 取消/确定按钮（danger 变体红色高亮）
     ├─ PromptDialog：标题 + 输入框 + 取消/确认按钮
     └─ MessageDialog：标题 + 内容 + 「我知道了」按钮
   - 统一深色液态玻璃设计（bg-[#1a1a1a] + backdrop-blur + border-white/[0.08]）
   - Esc 全局关闭 / Enter 提交 Prompt
     │
     ▼
④ resolver 决议 → 弹窗关闭 → 调用方收到返回值
```

**替换映射表：**

| 原始调用 | 替换为 | 位置 |
|---------|--------|------|
| `alert("成功/失败/错误")` — 即时反馈 | `setToastMsg()` | SettingsModal 13处 |
| `alert("邀请码已生成：xxx")` — 需用户阅读 | `await showMessage()` | SettingsModal 1处 |
| `alert("已复制邀请码")` — 即时反馈 | `setToastMsg()` | SettingsModal 1处 |
| `window.confirm("确定要...")` | `await showConfirm()` | page.tsx / CanvasVault / SettingsModal / VideoCanvas |
| `window.prompt("输入标题")` | `await showPrompt()` | useChat.ts |

```

### 3.24 创作助手 + 字段级 AI 选择（★ 第十五阶段新增）

#### ① 创作助手全局面板（CopilotPanel + useCanvasCopilot）

```
【Owner 在画布顶栏点击「创作助手」】
      │
      ▼
① CopilotPanel 弹出可拖动窗口（左侧，黑色液态玻璃风格）
   ├─ 左侧对话列表：支持新建/切换/删除多轮对话，避免上下文过长
   ├─ 右侧聊天区：消息列表 + 输入框
   └─ 顶栏把手：可拖动画布窗口到任意位置
      │
      ▼
② 用户输入指令（如"把所有分镜比例改成 16:9"）
      │
      ├──★ 极速路径：本地意图解析（parseUserIntent）
      │   正则匹配常见模式：
      │   · "把所有分镜的字段改成值" → batchUpdateByType
      │   · "在字段末尾加上内容" → batchAppendSuffix
      │   · "把不是值的改成值" → batchUpdateByFilter
      │   解析成功 → 直接弹出确认窗「是否执行此修改？」→ 确定 → 执行
      │
      └──★ LLM 路径：复杂度超出正则范围
          ① 构建画布快照（所有 nodes 的 id/type/可编辑字段值）
          ② 构建 System Prompt（快照 + 可用工具 + 约束规则）
          ③ SSE 流式请求 /v1/chat/completions
          ④ LLM 流式回复（打字机效果）
          ⑤ 检测回复中是否含【确认修改】标记
          ⑥ 含标记 → 弹出确认窗 → 确定 → 执行本地意图
      │
      ▼
③ 执行引擎（executeLocalIntent）
   - updateField / batchUpdateByType / batchUpdateByFilter / batchAppendSuffix
   - 执行前自动拍快照 → push undoHistory（支持 Ctrl+Z 回退）
   - 执行后触发 onAfterAction → auto-save → 5s 后 POST /v1/user/sync_sessions
```

**关键设计原则：**
- LLM 不需要输出 JSON，只需自然语言回复 + 末尾【确认修改】标记
- 前端做本地意图解析（正则匹配），保证常见操作近乎瞬间响应
- 复杂意图走 LLM 流式回复，但执行仍由前端本地引擎完成
- 所有操作接入现有撤销系统，可 Ctrl+Z 回退

#### ② 文字选中 AI 助手（SelectionAssist — 双模式）

```
【Owner 在任意 textarea/input 中选中文字】
      │
      ▼
① 全局 mouseup 监听 → 检测 activeElement 是否为 textarea/input
   → 读取 data-node-id / data-field / data-field-label 属性
   → 提取选中文字 + 字段完整内容 + 节点上下文
   → 计算选中区域坐标 → 在选中文字上方弹出浮动工具条
      │
      ├──★ 模式A：「改写选中」（一键）
      │   ① LLM 一次性改写选中文字
      │   ② 展示改写结果 + [替换] 按钮
      │   ③ 替换 → 触发 React onChange → 节点状态更新
      │
      └──★ 模式B：「AI 对话」（多轮）
          ① 打开迷你对话窗口（340-500px 宽）
          ② 预填上下文：节点ID + 字段名 + 选中文字预览
          ③ 用户可多轮对话调整修改方案
          ④ LLM 在回复末尾标记【建议修改】+ 输出最终文字
          ⑤ 展示建议修改预览 + [应用修改] 按钮
      │
      ▼
② 集成方式
   - MentionTextarea 组件新增 dataAttrs prop → 透传到 <textarea>
   - 所有画布节点 textarea/input 添加 data-node-id / data-field / data-field-label
   - SelectionAssist 在 VideoCanvas 中全局渲染（无需逐节点引入）
```

**覆盖的字段（通过 data 属性自动识别，无需逐一手写）：**
- MasterScriptNode: script textarea (data-field="text")
- ShotNode: firstFrameAnchor, videoPrompt, sceneLighting
- MediaNode: prompt
- RenderNode: prompt
- VideoClipNode: prompt
- AssetTableNode: row prompts（需添加 data 属性）
- 任意新增 textarea：只需加 data-node-id + data-field 即可自动支持

#### ③ 其他修复

| 修复项 | 问题 | 解决方案 |
|--------|------|----------|
| **AssetDock 点击触发** | 悬停触发罩（60px）遮挡回收站按钮 | 改为点击 VAULT 标签切换展开/收起，标签始终可见不被遮挡 |
| **API stream 显式声明** | MasterScriptNode 的 fetchApi 调用未传 stream:false | 4 处 payload（handleExtractCamera / handleExtractAssetTable / handleFissionShots stage1/stage2）全部加 stream:false |

**涉及文件：**
| 文件 | 改动 |
|------|------|
| useCanvasCopilot.ts (新) | 创作助手引擎：本地意图解析 + LLM 对话 + 行动执行 + 多对话管理 |
| CopilotPanel.tsx (新) | 可拖动面板：多对话列表 + 聊天区 + 黑色液态玻璃 |
| SelectionAssist.tsx (新) | 全局文字选中 AI：改写模式 + 对话模式双模式 |
| CopilotMessage.tsx (新) | 消息气泡组件（内联到 CopilotPanel） |
| CopilotActionCard.tsx (新) | 已弃用，改为 showConfirm 弹窗 |
| FieldAITrigger.tsx (新) | 已弃用，功能被 SelectionAssist 替代 |
| useAppStore.ts | 新增 copilotIsOpen 字段 + 持久化 |
| VideoCanvas.tsx | 顶栏 +「创作助手」Pill 按钮 + 渲染 CopilotPanel + SelectionAssist |
| CustomNodes.tsx | MentionTextarea 加 dataAttrs 支持 / 全部 textarea 加 data 属性 / API 调用加 stream:false |
| AssetDock.tsx | 点击触发改造 + 按钮防遮挡修复 |


```
【用户操作画布节点】
    │
    ▼
① VideoCanvas.tsx 即时存储引擎（不再防抖）
   - 节点拖移、文本编辑、连线变更 → 立即调用 updateCanvasProject() → Zustand
   - 旧逻辑：1500ms 防抖后才写 Zustand（最后 1.5 秒的工作可能丢失）
   - 新逻辑：每次操作立即写入，零延迟
    │
    ▼
② useAppStore.updateCanvasProject() 双重写入
   ├──► 内存层：Zustand canvasProjects[] 数组更新（实时编辑）
   ├──► 浏览器本地底稿层：localStorage['yr-canvas-full-backup']
   │     ★ 完整存储 nodes / edges / localAssets（不精简！）
   │     ★ 页面崩溃/断网后，刷新时从本地读回，不再依赖云端
   └──► 轻量 UI 缓存层：sessionStorage['yr-canvas-storage']
         仅存 id/title/updatedAt + activeView + activeCanvasProjectId
         （关标签页自动销毁，防止跨账号污染）
    │
    ▼
③ page.tsx 固定间隔同步触发器（不再因连续编辑推迟）
   - 旧逻辑：每次 canvasProjects 变更 → 重置 5s 倒计时 → 持续编辑 = 永不触发
   - 新逻辑：isDirtyRef 脏标记 + 每 3s 固定间隔检查 → 有变更就立即 POST
   - forceSyncToServer()：失败自动重试 3 次（1s/2s/4s 退避），3 次全失败 → Toast 提示用户
    │
    ▼
④ 后端 main.py sync_user_sessions 真实反馈
   - 旧逻辑：await asyncio.to_thread() 后立即返回 {"message": "...同步成功"}（射后不理）
   - 新逻辑：等待线程完成 → 返回 {"status": "ok"} 或 {"status": "error"}(500)
   - 前端据此判断同步是否真正成功，失败则重试
    │
    ▼
⑤ 刷新/断网恢复流程
   ┌─ 正常路径：GET /v1/user/sessions?modules=canvas → SQLite → Zustand
   └─ 兜底路径：网络故障 → 读 localStorage['yr-canvas-full-backup'] → Zustand
      ★ 用户至少能看到上次成功保存的完整画布，不会面对空白画布
```

**三层存储对比：**

| 层 | 存储位置 | 存储内容 | 生命周期 | 作用 |
|----|---------|---------|---------|------|
| 内存层 | Zustand | 完整 nodes/edges/assets | 页面生命周期 | 实时编辑，毫秒级响应 |
| 本地底稿层 | localStorage `yr-canvas-full-backup` | ★ 完整 nodes/edges/localAssets | 永久（跨会话） | 断网/崩溃后抢救，刷新秒开 |
| 轻量缓存层 | sessionStorage `yr-canvas-storage` | 仅 id/title/updatedAt + UI 状态 | 标签页生命周期 | 快速恢复 UI 状态，跨账号隔离 |

**退出登录保护：**

| 场景 | 旧行为 | 新行为 |
|------|--------|--------|
| 退出前同步失败 | 只 console.error，继续退出清空数据 | 弹出确认框「同步失败，是否强制退出？画布已保存本地」→ 用户可取消 |
| sessionStorage | 清除 | 清除（不变） |
| localStorage 底稿 | 未清除（残留） | ★ 显式清除，防止跨账号数据泄漏 |

```

### 3.25 创作助手 !command 统一指令架构（★ 第十八阶段核心升级）

```
【Owner 在创作助手中输入任何操作指令】
     │
     ▼
① CopilotPanel.tsx handleSend()
   - 不再做本地自然语言意图解析（移除了 parseBatchUpdateType 等易误匹配的正则解析器）
   - 用户输入直接发送给 LLM，附带完整的画布快照（节点类型/字段值/坐标/连线ID）
     │
     ▼
② LLM 回复（含 canvas-manual.ts 画布说明书作为 System Prompt 一部分）
   - LLM 了解全部 9 种节点类型、所有可编辑字段、所有可用操作
   - 如果用户的操作涉及修改画布，LLM 必须在回复末尾写：【确认修改】
   - 【确认修改】之后一行一行写 !command 指令：
     · !set <类型> <字段> <值>      — 批量设置字段值（每条一行覆盖一种类型）
     · !delete <节点ID>             — 删除节点
     · !delete_all <类型>           — 删除全部某类型节点
     · !add <类型> <x> <y>          — 新建节点
     · !connect <源> <目标>         — 创建连线
     · !move <节点ID> <x> <y>       — 移动节点
     · !delete_edge <连线ID>        — 删除连线
     │
     ▼
③ parseCommandDirective() → parseAllCommandDirectives()
   - 收集所有 !command 行：1 条 → 直接返回；多条 → 包进 commands[] 数组
   - 不做自然语言解析（parseBatchUpdateType 等仅保留代码，不参与执行路径）
     │
     ▼
④ showConfirm 弹窗
   - 显示操作描述（多条时显示"N 项操作：XX；XX；XX"）
   - 用户确认 → executeLocalIntent()
     │
     ▼
⑤ executeLocalIntent() 递归执行
   - 有 commands[] → 递归逐条执行子命令，汇总操作数量
   - 无 commands[] → 直接执行单条操作
   - 支持：batchUpdateByType / deleteNode / addNode / addEdge / deleteEdge / moveNode / batchDeleteByType
```

**关键设计原则：**
- LLM 是唯一操作决策者（有完整画布上下文），前端只做 !command 指令解析
- 删除了所有自然语言正则解析器的执行路径（消除误匹配）
- 支持批量操作：用户说"删除分镜1-5"→LLM扫描快照→输出5行!delete→一次确认全删
- 操作前触发 onBeforeAction（拍快照进 undoHistory），操作后触发 onAfterAction（自动同步云端）

**涉及的 !command 指令对照表：**

| 指令 | 用途 | 示例 |
|------|------|------|
| `!set <type> <field> <value>` | 批量设置字段值 | `!set shot globalCamera 测试效果` |
| `!delete <nodeId>` | 删除单个节点 | `!delete shot_abc123` |
| `!delete_all <type>` | 删除全部某类型节点 | `!delete_all shot` |
| `!add <type> <x> <y>` | 新建节点 | `!add text 500 300` |
| `!connect <src> <tgt>` | 创建连线 | `!connect shot_1 shot_2` |
| `!move <nodeId> <x> <y>` | 移动节点 | `!move text_5 600 400` |
| `!delete_edge <edgeId>` | 删除连线 | `!delete_edge reactflow__edge-s1-s2` |

```

```
【访客访问 / 首页】
     │
     ▼
  四层背景（fixed，z-index 分层）：
  ├─ 层1 z-0 — 深空底色 #010108（固定）
  ├─ 层1.5 z-[1] — ★ 左侧淡色散射光晕（填补左侧空白，blur 180px）
  ├─ 层2 z-[1] — 大月球（90vw，55s 旋转 + 冷灰蓝色调匹配深空主色 + 15 层高对比度纹理 + 6 点环形山高亮 + 3D 球体光照遮罩 + 软外晕消除边缘 + 内层 65s 反向视差）
  └─ 层3 z-[2] — 35 颗浮动光点粒子（随机漂移动画）
     │
     ▼
  固定顶栏（h-16，z-50 液态玻璃 blur 毛玻璃）：
  ├─ 左：YR AI LOGO + [控制台]（token 存在时显示）+ [登录]
  └─ 右：空（极简）
     │
     ▼
  7 大滚动 Section（每块 min-h-screen，左右交替图文排版）：
  ├─ Hero — 大标题 YR AI + 副标题「★ 一站式影视AGI」+ 光晕横线
  ├─ S1 半自动化分镜引擎 — 3 张错位分镜卡片插图 + 右边文字（★ 文案大白话重写）
  ├─ S2 三权分立·大师级分镜管线 — 左边文字 + 双阶段流程盒插图（★ 插图文字改为「① 调度层 / ② 执行层」，去除阶段/大师分镜师/首帧画师/8大铁律）
  ├─ S3 导演路由引擎 — 4 规则仓库节点连线插图 + 右边文字（★ 节点数量改为 100+/60+/20+/15+ 避免写死）
  ├─ S4 视觉交响空间 — 左边文字 + 9 节点画布连线插图
  ├─ S5 多模态 AI 引擎 — 3 张生成结果卡片插图 + 右边文字
  ├─ S6 AI 对话&工作流 — 左边文字 + 对话气泡+工作流注册表插图（★ 弱化对话，突出工作流与智能体）
  └─ Footer — © 2026 YR AI

   ★ 交互特性（v4）：
  ├─ CSS scroll-snap-type: y mandatory — 全屏强制吸附
  ├─ 右侧圆点导航 — IntersectionObserver 实时高亮当前板块，点击平滑跳转
  ├─ 滚轮劫持 — 一次轻拨 = 自动跳屏（800ms 冷却防连跳）
  ├─ IntersectionObserver 入场动画 — ★ 修复：离开视口时移除 section-visible 类，每次进入都重播动画
  ├─ 月球右边缘半圆 — 外层居中 + 内层旋转（45s + 55s reverse），高对比度月海暗斑纹理
  ├─ 左侧光晕 — 填补左侧空白区域
  └─ SSR 水合防护 — suppressHydrationWarning + isClient 保护
```

### 3.16 落地页文案对照表（★ 第十二阶段新增）

| 板块 | 整改前 | 整改后 |
|------|--------|--------|
| Hero 标签 | AI 驱动的影视创作平台 | ★ 一站式影视AGI |
| S1 描述 | 输入剧本，一键裂变生成完整分镜序列。AI 自动切分镜头、分配时长、推断光影、翻译首帧生图咒语。从文字到可视化分镜，不再需要逐帧手绘。 | 输入剧本，一键生成完整分镜。AI 自动拆解镜头、计算时长、推断光影，每个分镜直接输出可用的生图提示词。从文字到画面，告别逐帧手绘。 |
| S2 段落 | 独创双阶段架构：阶段1「大师分镜师」统管调度与光影推演，阶段2「首帧画师」被彻底物理隔离，100% 照抄光影结果，严守 8 大静态物理铁律，杜绝 AI 幻觉。 | 独创双阶段架构：调度层统一规划光影、节奏、镜头语言；执行层严格按调度结果生成画面，两层互不干扰，彻底杜绝 AI 随意发挥。 |
| S2-01 | 时长数学红线：对白字数 ÷ 3.5 = 最短秒数 | 智能时长：根据对白密度自动计算每个镜头的合理秒数 |
| S2-02 | 三级降级光影法则：资产表继承 → 导演规则 → 景别裁切 | 光影兜底：角色设定 → 导演意图 → 镜头景别，三层逐级校对 |
| S2-03 | 8 大静态物理铁律：空间站位 / 轴线死锁 / 防运镜污染 ... | 物理级严谨：空间关系、人物站位、运动方向始终一致，像实拍一样 |
| S3 描述 | 18 个题材 × 4 级节奏，自由混搭。内置 4 大规则仓库，自动注入英文极品光影咒语、运镜策略、色彩调色板。10% 概率触发安全突变，为分镜注入不可预测的电影感。 | 覆盖主流影视题材与多档节奏，自由混搭。内置光影字典、运镜策略、色彩调色板，自动为每个分镜注入专业级的英文光影咒语。画面风格不死板、不重复，每个镜头都有独特的电影质感。 |
| S6 描述 | SSE 流式对话，支持联网搜索、文件附件上传。内置 10+ 预置工作流：剧本分镜、拆帧分析、文案生成等。多模型切换，所有会话云端同步。 | 内置丰富预置工作流与智能体：剧本分镜、拆帧分析、文案生成……多模型一键切换，所有会话自动云端同步。 |

### 3.17 Banana Pro (Gemini) 原生数据流（★ 第十阶段重写）

```
【Owner 在节点上选择 banana-pro 模型，点击「生成」】
     │
     ▼
① useCanvasEngine.ts buildImagePayload()（★ 已简化）
   - ratio（如 16:9）→ extraParams.aspectRatio
   - quality（如 2K）→ extraParams.imageSize
   - 不再做像素网格映射（googleGrid 已删除）
   - payload = { model: banana-pro, prompt, aspectRatio: 16:9, imageSize: 2K, image: [...refs] }
     │
     ▼
② POST /v1/images/generations → main.py image_generations()
   - 检测 requested_model == banana-pro → 走专属 Gemini 路由，不进入默认 OpenAI 路径
     │
     ▼
③ main.py banana-pro 专属处理（★ 重写）
   - 提取 aspectRatio + imageSize
   - 构建 Gemini 原生 payload：
     {
       contents: [{ parts: [{ text: prompt }] }],
       generationConfig: { responseModalities: [IMAGE], imageConfig: { aspectRatio, imageSize } }
     }
   - 图生图：参考图 URL → httpx 下载 → base64 编码 → 追加为 inlineData part
   - 调用端点：POST {api_base}/v1beta/models/gemini-3-pro-image-preview:generateContent
     │
     ▼
④ Gemini 上游响应解析
   - 读取：response.candidates[0].content.parts[].inlineData.data（纯 base64）
   - 补 data:image/png;base64, 前缀 → save_media_permanently() → 云服务器永久 URL
   - 返回前端：{ data: [{ url: 云服务器永久URL }] }
```

**关键差异（vs 旧方案）：**

| 维度 | 旧方案（已弃用） | 新方案（Gemini 原生） |
|------|-----------------|---------------------|
| 端点 | /v1/images/generations（OpenAI 格式） | /v1beta/models/gemini-3-pro-image-preview:generateContent |
| 比例控制 | size + aspect_ratio 字段（不生效） | imageConfig.aspectRatio（原生锁定） |
| 分辨率 | 像素网格表手算 WxH | imageConfig.imageSize（原生档位） |
| 参考图 | images URL 数组平铺在顶层 | contents.parts[].inlineData（base64 嵌入） |
| 响应解析 | data[0].url（OpenAI 格式） | candidates[0].content.parts[].inlineData.data（Gemini 格式） |

### 3.18 画布存储三层加固与容灾数据流（★ 第十三阶段核心升级）

```
【Owner 在画布上操作（拖移节点、编辑文本、裂变分镜等）】
     │
     ▼
① VideoCanvas.tsx 即时存储 → updateCanvasProject() → Zustand 内存
     │
     ├──► 层 1（内存）：Zustand canvasProjects[] — 完整 nodes/edges/localAssets（实时编辑）
     │
     ├──► 层 2（localStorage 全量备份）：yr-canvas-full-backup
     │    ★ 每次 updateCanvasProject 调用后，异步写入完整项目 JSON（nodes+edges+localAssets+title+updatedAt）
     │    ★ 页面崩溃/断网/换浏览器后，从本地读回，不再仅依赖云端
     │
     ├──► 层 3（sessionStorage 轻量缓存）：yr-canvas-storage
     │    仅存 id/title/updatedAt + activeView + activeCanvasProjectId
     │    （关标签页自动销毁，防止跨账号污染）
     │
     └──► 层 4（云端 SQLite）：canvas_projects 表
          forceSyncToServer() — 3 次指数退避重试（1s/2s/4s），成功后更新 localStorage 备份
          失败 → Toast 提示"数据已暂存本地，网络恢复后将自动重试"
```

**刷新/断网恢复流程：**
```
刷新页面
  ├─ 正常路径：GET /v1/user/sessions?modules=canvas → SQLite → Zustand
  └─ 兜底路径：网络故障 → 读取 localStorage['yr-canvas-full-backup'] → Zustand
     ★ 用户至少能看到上次成功保存的完整画布，不会面对空白画布
```

### 3.19 裂变分镜按批次分列布局（★ 第十三阶段新增）

```
【Owner 多次裂变分镜】
     │
     ▼
① 扫描画布上所有已有 ShotNode，按 X 坐标归列（X差 < 200px 算同一列）
② 统计已有列数 → 新批次排到下一列（每列间距 650px）
③ 列内 Y 坐标：取该列最底部节点的 position.y + 真实DOM高度
④ 优先用 React Flow measured.height → 回退 DOM offsetHeight → 最后预估 560px
```

### 3.20 资产表参数与节点对齐 + 统一生图管道（★ 第十三阶段新增）

```
【资产表全局参数控制舱】
  ├─ 模型：GPT-Image-2 / Banana Pro / Seedream 5.0（去除不存在的 banana2）
  ├─ 比例：跟随全局比例 + 支持全局穿透覆盖
  ├─ 画质：getImageQualityOptions(model) 动态选项（与 ShotNode 完全一致）
  │        切换模型时自动重置画质到兼容值（防 400 报错）
  └─ 生图：handleGenerateRow 复用 buildImagePayload() 统一拼装
           失败自动重试 3 次（1s/2s/4s 指数退避）
           批量生成队列控制（最大并发 2，显示进度 X/N）
           每行独立「终止」按钮（解决转圈卡死无法重试）
```

### 3.21 资产表图片复制真实比例自适应（★ 第十三阶段新增）

```
【Owner 在资产表点击图片上的「复制」按钮】
     │
     ▼
① extractToCanvas() → new Image() 读取 naturalWidth/naturalHeight
② 计算真实像素比 rawRatio → 写入 data.customAspectRatio + data.customWidth
③ MediaNode 检测 customAspectRatio → 容器 aspectRatio = 图片真实比例（无黑边/无裁切）
④ 未检测到 → 回退预设 ratioStyleMap（16:9/9:16/1:1...）
```

### 3.22 资产表 UX 修复（★ 第十三阶段新增）

```
【滚轮体验】
  - 外层容器 onWheelCapture + nowheel 类 → 鼠标在非 textarea 区域滚轮滚动整表
  - textarea 内部 → 原生 textarea 滚动行为（选中字段内滚动文字）

【图片全屏预览】
  - 改为 createPortal 渲染到 document.body → 脱离 React Flow DOM 树
  - 节点添加 min-height → 防止重测量时收缩消失
```
     │
     ▼
① useCanvasEngine.ts buildImagePayload()（* 已简化）
   - ratio（如 16:9）→ extraParams.aspectRatio
   - quality（如 2K）→ extraParams.imageSize
   - 不再做像素网格映射（googleGrid 已删除）
   - payload = { model: banana-pro, prompt, aspectRatio: 16:9, imageSize: 2K, image: [...refs] }
     │
     ▼
② POST /v1/images/generations → main.py image_generations()
   - 检测 requested_model == banana-pro → 走专属 Gemini 路由，不进入默认 OpenAI 路径
     │
     ▼
③ main.py banana-pro 专属处理（* 重写）
   - 提取 aspectRatio + imageSize
   - 构建 Gemini 原生 payload：
     {
       contents: [{ parts: [{ text: prompt }] }],
       generationConfig: { responseModalities: [IMAGE], imageConfig: { aspectRatio, imageSize } }
     }
   - 图生图：参考图 URL → httpx 下载 → base64 编码 → 追加为 inlineData part
   - 调用端点：POST {api_base}/v1beta/models/gemini-3-pro-image-preview:generateContent
     │
     ▼
④ Gemini 上游响应解析
   - 读取：response.candidates[0].content.parts[].inlineData.data（纯 base64）
   - 补 data:image/png;base64, 前缀 → save_media_permanently() → 云服务器永久 URL
   - 返回前端：{ data: [{ url: 云服务器永久URL }] }
```r

**关键差异（vs 旧方案）：**

| 维度 | 旧方案（已弃用） | 新方案（Gemini 原生） |
|------|-----------------|---------------------|
| 端点 | /v1/images/generations（OpenAI 格式） | /v1beta/models/gemini-3-pro-image-preview:generateContent |
| 比例控制 | size + aspect_ratio 字段（不生效） | imageConfig.aspectRatio（原生锁定） |
| 分辨率 | 像素网格表手算 WxH | imageConfig.imageSize（原生档位） |
| 参考图 | images URL 数组平铺在顶层 | contents.parts[].inlineData（base64 嵌入） |
| 响应解析 | data[0].url（OpenAI 格式） | candidates[0].content.parts[].inlineData.data（Gemini 格式） |


| 修复项 | 问题 | 解决方案 |
|--------|------|----------|
| **英文咒语漏水** | LLM 只读到中文标签（"伦勃朗光"），你写的极品英文 Prompt 根本没传过去 | `resolve()` 中新增 `findLight(prompt)` / `findCamera(prompt)` 抓取字典的 `prompt` 字段 → `lightingPrompt` / `cameraPrompt` 变量；`buildLLMContext()` 新增 **强力建议的英文光影咒语底座** 和 **动态与速率英文咒语** |
| **色彩越界篡改** | 导演色彩建议（如"深红色为主调"）诱导 AI 去改角色服装发色 | 在色彩调色板建议下方加入绝对红线："此色彩建议仅应用于环境与光影...绝不允许篡改人物服装与发色设定！" |
| **解耦架构兼容性** | 验证了当用户自由混搭（如"言情剧 + 极快节奏"）时，题材（美术指导）和节奏（剪辑指导）完全解耦，系统能完美产生风格化蒙太奇 | ✅ 通过 |


### 3.23 场景/角色提示词优化 + 资产表前缀全局穿透（★ 第十四阶段新增）

#### ① 场景提取 Prompt 优化（CustomNodes.tsx handleExtractAssetTable scene）

```
六个新增约束：
1. 全部场景提取为「正面全景」
2. 未标明剧本背景时默认东方风格
3. 禁止场景元素冲突（如科技感办公室出现粗糙木桌）
4. 禁止夸张色调，以柔光为主
5. 三点布光原则
6. 场景要符合剧本元素特征
```

#### ② 角色提取 Prompt 面容种族自动识别（CustomNodes.tsx handleExtractAssetTable character）

```
LLM 根据剧本世界观自动判断人物种族：
- 中国本土/东方/未标明 → 默认中国华人面容（亚洲五官、肤色、毛发）
- 西方/异世界/奇幻/科幻 → 按剧本暗示生成对应种族面孔
- 在 prompt 字段最前面明确描述人种与五官特征
```

#### ③ 资产表全局前缀穿透覆盖（VideoCanvas.tsx 影视中控台）

```
【Owner 在中控台输入全局前缀 + 点击「穿透覆盖至所有资产表」】
     │
     ▼
① 读取 canvasSettings.globalAssetPromptPrefix
② 遍历所有 AssetTableNode → 对每行 row.prompt：
   ├─ 清洗上一次应用的旧前缀（row._lastAppliedPrefix，防套娃堆叠）
   ├─ 若新前缀非空 → `${prefix}, ${cleanPrompt}` 拼到最顶部
   └─ 若新前缀为空 → 仅清除旧前缀，不追加新内容
③ 结果即时显示在资产表 UI 中，用户可见可编辑
④ 后续用户点击每行「生成」时，前缀已写入 row.prompt，无需隐性注入

【设计原则】与第3.7节「全局中控 data 穿透流」后的「后缀智能追加」对称——
后缀追加到 Prompt 尾部，前缀追加到 Prompt 顶部。
都是用户显性点击按钮穿透覆盖，而非在 buildImagePayload 中隐性拼接。
```

**涉及文件：**
| 文件 | 改动 |
|------|------|
| CustomNodes.tsx handleExtractAssetTable | 场景 Prompt 5项约束升级 + 角色 Prompt 新增面容种族识别块 |
| useAppStore.ts canvasSettings | 新增 globalAssetPromptPrefix 字段 |
| VideoCanvas.tsx 中控台抽屉 | 新增全局资产表前缀 textarea + 「穿透覆盖至所有资产表」按钮 |
| app/page.tsx | 注销重置时补充 globalAssetPromptPrefix: '' |


### 3.26 剧本截断修复与集数分块提取（★ 第十九阶段新增）

#### ① 问题根因

| 功能 | 原截断 | 后果 |
|------|--------|------|
| 摄影机提取 | `substring(0, 8000)` ≈ 3000中文字 | 只看剧本开头，全片调性不准 |
| 资产表提取 | `substring(0, 15000)` ≈ 5000中文字 | 多集剧本只提取前1-2集 |
| 分镜裂变 | 只发 `selectedText`，不发全文 | LLM 不知前后剧情，分镜逻辑脱节 |
| 分镜裂变 | 不注入已有分镜摘要 | 二次裂变时 LLM 不知前一批分镜状态 |

#### ② 资产表提取：二阶段分块流程

```
用户点击「提取场景/角色/道具」
      │
      ▼
① 阶段①：集数检测（1次 LLM 轻量调用，EpisodeSelectModal 组件）
   - 发送完整剧本 → LLM 按剧情识别集数/段落
   - 返回 [{id:1, label:"第一集：初入长安", preview:"前40字..."}, ...]
   - 检测失败 → 降级为「整段提取」
      │
      ▼
② 阶段②：集数选择弹窗（黑色液态玻璃风格 UI）
   - 展示所有检测到的段落（默认全选）
   - 全选/取消全选快捷按钮
   - 用户勾选要提取的段落 → 点击「确认提取」
      │
      ▼
③ 阶段③：资产提取（LLM 调用）
   - 发送完整 data.text（不截断）
   - 增加集数过滤指令："请只提取以下段落：第一集、第三集..."
   - 不设 max_tokens（让 LLM 自由输出完整 JSON）← Owner 决策：不设上限
   - System Prompt 尾部增加「必须提取全部XXX，不得遗漏」
```

#### ③ 摄影机提取修复

```
【改前】data.text.substring(0, 8000)
【改后】data.text（完整剧本） + max_tokens: 4096（输出只有一行）
```

#### ④ 分镜裂变上下文注入

```
【改前 user message】
  dictText + globalCamera + selectedText

【改后 user message 五段结构】
  ① 完整剧本上下文（供理解故事脉络）
  ② 已拆解分镜摘要（前后各10个分镜的空间/时序/机位）
  ③ 全局资产字典（dictText，不变）
  ④ 英文全局摄影参数（不变）
  ⑤ ★ 本次需拆解的选段（selectedText）
```

**已有分镜摘要生成（buildExistingShotsSummary）：**
- 扫描画布所有 ShotNode，按 shotNumber 排序
- ≤20个 → 全部注入；>20个 → 取前10个 + 后10个
- 每行格式：`💍 镜号 (场景): @角色1, @角色2 | 时长Xs | 机位规则`

#### ⑤ 分镜「按集选择」入口（新增，不覆盖手动选区）

```
【原有功能】用户手动划选文字 → 点击「裂变分镜」
【新增功能】点击「📋 按集选择」→ 集数选择弹窗 → 自动填充 selectedText
  两者互不覆盖，各走各的入口
```

#### ⑥ 新增文件与函数

| 新增项 | 类型 | 职责 |
|--------|------|------|
| `EpisodeSelectModal.tsx` | 组件 | 集数检测 LLM 调用 + 集数选择 UI（检测中/选择中/错误三状态） |
| `buildExistingShotsSummary()` | 函数 | 构建已有分镜上下文摘要，注入裂变 LLM |
| `handleEpisodeConfirm()` | 回调 | 集数选择弹窗确认入口（分流：资产提取 or 分镜选区） |
| `executeAssetExtraction()` | 函数 | 资产表实际提取逻辑（由 handleEpisodeConfirm 调用） |

**涉及文件：**
| 文件 | 改动 |
|------|------|
| EpisodeSelectModal.tsx (新) | 集数检测 + 选择 UI |
| CustomNodes.tsx | ① handleExtractCamera 移除截断 + max_tokens:4096 ② handleExtractAssetTable → 分拆为 handleExtractAssetTable(打开弹窗) + executeAssetExtraction(实际提取) + handleEpisodeConfirm(统一回调) ③ handleFissionShots 注入全文上下文 + 已有分镜摘要 ④ UI 新增「按集选择」按钮 + EpisodeSelectModal 渲染 ⑤ 新增 buildExistingShotsSummary 辅助函数 |

#### ⑦ 集数检测缓存机制（防重复 LLM 调用）

```
【问题】每次打开「提取场景/角色/道具」或「按集选择」，弹窗都会重新调 LLM 做集数检测，浪费 Token。
【解决】内存级缓存 + 剧本哈希自动失效

┌──────────────────────────────────────┐
│  episodeCacheRef (useRef)            │
│  { episodes: [...], scriptHash: "" } │
└──────────────────────────────────────┘
           │
           ▼
  getOrOpenEpisodeSelect(mode, type)
    ├─ 计算剧本哈希：getScriptHash(data.text)
    │   公式 = "长度_首100字_尾100字"
    │   → 剧本任何修改都会导致哈希变化
    │
    ├─ 哈希命中 → setCachedEpisodesForModal(episodes)
    │             弹窗 preloadedEpisodes prop → 跳过 useEffect 检测 → 秒开
    │
    └─ 哈希未命中 → setCachedEpisodesForModal(null)
                    弹窗正常走 LLM 检测流程
                    onEpisodesDetected → 写入 episodeCacheRef
```

**缓存生命周期：**
| 场景 | 行为 |
|------|------|
| 打开弹窗（剧本未变） | 秒开，无 LLM 调用 |
| 打开弹窗（剧本已修改） | 哈希失效 → 重新检测 |
| 切换到不同提取类型（场景/角色/道具） | 共享同一缓存，秒开 |
| 刷新页面 | ref 清空 → 重新检测（预期行为，不持久化到 localStorage） |

**新增函数与变量：**
| 新增项 | 类型 | 职责 |
|--------|------|------|
| `episodeCacheRef` | useRef | 缓存 `{ episodes, scriptHash }` |
| `getScriptHash(text)` | 函数 | 剧本内容指纹（长度+首尾取样），变更自动失效 |
| `getOrOpenEpisodeSelect()` | 函数 | 统一弹窗开门入口（先查缓存再打开） |
| `handleEpisodesDetected()` | 回调 | 检测完成后写入缓存 |
| `cachedEpisodesForModal` | useState | 缓存命中时传给弹窗 preloadedEpisodes |
| EpisodeSelectModal `preloadedEpisodes` prop | 新增 prop | 传入 → 跳过 useEffect 检测 |
| EpisodeSelectModal `onEpisodesDetected` prop | 新增 callback | 检测成功 → 父级缓存 |

### 3.20 分镜摘要智能批次溯源（★ 第二十阶段重构）

```
【Owner 裂变分镜时，buildExistingShotsSummary 的新逻辑】

旧逻辑（第十九阶段）：
  - 扫描画布全部 ShotNode，按镜号排序，取前后各10个
  - 注入 LLM 时标注「供延续空间站位与时序逻辑」
  - 问题①：非连续分镜时，LLM 被误导延续不相关分镜的轴线和机位
  - 问题②：多 MasterScriptNode 时，项目A裂变会读到项目B的分镜摘要（污染）

新逻辑（第二十阶段）：
       │
       ▼
  ① 边过滤（核心第一层防御）
     - 从画布全部边中筛选 source === currentNodeId 的边
     - 只保留通过边连接到当前 MasterScriptNode 的子分镜
     - 效果：多主控节点互不污染；孤立节点自动排除
       │
       ▼
  ② 书签批次分组（核心第二层升级）
     - 利用 extractedScenes 裂变书签，回溯每批分镜的原始剧本选段
     - 输出格式：
       📋 批次1（剧本选段：「黄昏，工坊里老匠人坐在桌前...」）→ 1, 2A, 2B
       📋 批次2（剧本选段：「十年后，长安城外，战争遗迹...」）→ 3, 4, 5
     - 效果：LLM 看到当前选段是第10集，摘要显示批次1/2来自第1/5集，自行判断不相关
       │
       ▼
  ③ 孤立分镜兜底
     - 有分镜但不属于任何书签批次（旧数据/表格裂变遗留）→ 归入「未标记批次」
       │
       ▼
  ④ 降级兜底（无书签时）
     - 旧项目无 extractedScenes → 退回逐条列表（按 shotNumber 排序，保留原格式）
       │
       ▼
  ⑤ LLM 提示词语气调整
     - 改前：「已拆解分镜摘要（供延续空间站位与时序逻辑）」
     - 改后：「已有分镜批次摘要（仅供了解本剧本画布上的分镜状态，
            请根据当前选段独立判断空间与时序，不强制延续已有设定）」
```

**改造对比表：**

| 维度 | 旧逻辑 | 新逻辑 |
|------|--------|--------|
| 取分镜范围 | 画布全部 ShotNode（跨主控污染） | 仅与当前 MasterScriptNode 有边连接的 ShotNode |
| 排序依据 | 纯按镜号数字（语义无关） | 按裂变批次分组，每批展示原始剧本选段 |
| 上下文语义 | LLM 被迫「延续」不相关分镜 | LLM 看到剧本选段后自行判断相关性 |
| 多主控节点 | 互相读到对方分镜 | 边过滤完全隔离 |
| 无书签降级 | 无此概念 | 退回到原逐条列表，不报错 |

**涉及文件：**
| 文件 | 改动 |
|------|------|
| CustomNodes.tsx | ① buildExistingShotsSummary 函数重写（新增 edges / currentNodeId / extractedScenes 参数，边过滤 + 书签批次分组 + 降级兜底）② 调用处传入 getEdges() + id + data.extractedScenes ③ payloadStage1 user message 提示词从「延续」改为「参考」语气 |

### 3.21 Canvas LLM 调用统一架构（★ 第二十一阶段核心升级）

```
【Owner 在画布中控台选择 LLM 模型】
      │
      ▼
① VideoCanvas.tsx 中控台 — LLM 模型选择器
   - 位置：导演引擎上方，新增下拉框
   - 选项：来自 MODELS 常量（deepseek-v4-pro / gpt-5.4 / gemini-3.1-pro-preview / gemini-3.5-flash）
   - 存入 useAppStore.canvasSettings.defaultLLMModel
      │
      ▼
② CustomNodes.tsx resolveLLMModel() 统一模型解析（白名单校验）
   - ① 节点 data.model 是否为有效 LLM 模型（LLM_MODEL_IDS 白名单内）→ 优先使用
   - ② 否则 → canvasSettings.defaultLLMModel（中控台全局默认）
   - ③ 否则 → 'deepseek-v4-pro'（硬兜底）
   - ★ 核心创新：白名单过滤掉生图/生视频模型，防止 MasterScriptNode 的 data.model
     缓存了 doubao-seedance-2-0-260128 等非 LLM 模型时，|| 回退链被 truthy 值阻断
      │
      ▼
③ fetchStreamingChat() → 统一走 fetchApi()
   - 旧：raw fetch() + 手动读 localStorage token + 硬编码 /v1/chat/completions
   - 新：fetchApi('/v1/chat/completions', { method: 'POST', body: ... })
   - 收益：享受 API_BASE 前缀 + 401/402/403 全局拦截 + 统一 Auth
   - payload 附加 _source: 'canvas' 标记，供后端诊断日志区分来源
      │
      ▼
④ 其他 Canvas AI 组件同步统一
   - EpisodeSelectModal.tsx → fetchApi + defaultLLMModel
   - SelectionAssist.tsx → fetchApi + defaultLLMModel
   - useCanvasCopilot.ts → fetchApi + defaultLLMModel
   - 全部取消硬编码模型名（原 'gpt-5.4' / 'deepseek-v4-pro'）
      │
      ▼
⑤ MasterScriptNode 模型下拉框移除
   - 原因：主控节点进入下一步骤后下拉框消失，用户无法切换模型
   - 替代：模型选择统一迁移到左侧中控台，任何步骤下都可切换
```

**模型优先级链（新逻辑）：**
```
data.model（白名单校验有效）
  → canvasSettings.defaultLLMModel（中控台）
  → 'deepseek-v4-pro'（硬兜底）
```

### 3.22 API Key 强制自配架构（★ 第二十一阶段核心升级）

```
【后端 resolve_api_config() 改造】
      │
      ▼
① 去除了服务端 Key 兜底
   - 旧：custom_key == "global" → 用 NEW_API_KEY（.env 服务端 Key）
   - 新：custom_key 为空或 "global" → api_key = ""，api_base = ""
   - 所有 AI 端点（chat / image / video / workflow）已添加空 Key 拦截
   - 空 Key 时返回 400："您尚未配置 AI API Key，请在设置 → API 配置中填入您的中转站 Key"
      │
      ▼
② DMX 视频 Key 同理
   - 旧：custom_key == "global" → 用 DMX_API_KEY
   - 新：dmx_custom_key 非空且 ≠ "global" → 才用用户 Key，否则为空
```

### 3.23 UI 体验改进（★ 第二十一阶段）

```
① SettingsModal.tsx Toast 文案修正
   - 旧："API 配置已更新！重新登录后生效。"
   - 新："API 配置已更新，立即生效！"
   - 实际行为：每次请求从 SQLite 读最新 key，无缓存，确实立即生效

② 全局 Toast z-index 提升
   - 旧：z-[99999]（低于 SettingsModal 的 z-[100000]，被遮挡）
   - 新：z-[100001]（高于一切弹窗，始终可见）
    - 涉及：app/page.tsx 两处 Toast 渲染
```

### 3.24 分镜裂变可视化进度条（★ 第二十二阶段新增）

```
【Owner 点击「裂变分镜」/「锚定摄影机」/「提取资产」/「生成表格」】—— 四大操作统一使用同一套进度条
      │
      ▼
① 统一进度条状态管理（useAppStore.fissionProgress）
   - status: 'idle' | 'stage1' | 'stage2' | 'camera' | 'asset' | 'table'
   - phase: 当前阶段文字（带点号循环动画）
   - 阶段 1：分镜拆解中 → shimmer 光条动画 + 点号循环
   - 阶段 2：首帧提取中 → 同上
   - camera：摄影机参数生成中 → 同上
   - asset：场景/角色/道具提取中 → 同上
   - table：表格生成中 → 同上
   - 完成/失败/中止：自动重置为 idle

② 进度条 UI（VideoCanvas.tsx 顶部居中）
   - 黑色液态玻璃胶囊（bg-black/70 + backdrop-blur-3xl）
   - 左侧：阶段标签（自适应：🧩 阶段 1/2 / 🎨 阶段 2/2 / 📷 摄影机参数 / 📋 资产提取 / 📊 表格生成）
   - 中间：当前阶段文字
   - 右侧：32px 宽光条（白色半透明从左到右无限滑动）
   - 右侧：红色 X 中止按钮（abortFission 调用 AbortController.abort()）
   - 仅 fissionProgress.status !== 'idle' 时渲染

③ AbortController 兜底机制
   - fetchStreamingChat 接受外部 AbortSignal + 内部 8 分钟超时兜底
   - combineAbortSignals 合并外部 signal 和超时 signal
   - 8 分钟超时：防止 SSE 流永久挂起导致按钮永久转圈
   - 手动中止：红色 X 按钮 → abortFission() → AbortController.abort()

④ 防止重叠
   - 每次操作启动前检查 fissionProgress.status !== 'idle'
   - 冲突时提示"请等待当前操作完成或点击中止"
```

**涉及文件：**
| 文件 | 改动 |
|------|------|
| useAppStore.ts | 新增 fissionProgress（含 camera/asset/table）+ abortFission + setAbortFission |
| VideoCanvas.tsx | 顶部统一进度条 JSX（自适应标签 + shimmer 动画 + 中止按钮） |
| CustomNodes.tsx | handleFissionShots / handleExtractCamera / executeAssetExtraction / handleFissionTable 全部改造为统一进度条 + AbortController |
| EpisodeSelectModal.tsx | 8 处 indigo → 白色/锌色统一 |

### 3.25 在线状态修复（★ 第二十二阶段）

```
【根因】
后端 heartbeat 接口不更新 last_active_at，
admin/users 的动态在线判定依赖 last_active_at < 60s。
→ 所有用户登录后 60s 在管理面板显示 OFFLINE

【修复】
后端 POST /v1/user/heartbeat 恢复写入：
UPDATE users SET last_active_at = ? WHERE username = ?
（30 秒一次，单字段写入，压力可忽略）
```

### 3.26 长剧本智能上下文压缩（★ 第二十二阶段新增）

```
【Owner 裂变分镜时，剧本超过 10000 字】
      │
      ▼
① preSummarizeScript() 预摘要生成
   - 检测 data.text.length > 10000 且无缓存摘要
   - 做一次轻量 LLM 调用，提取结构化摘要（人物关系/空间场景/时间线/视觉要素）
   - 摘要缓存到 data.scriptSummary
   - 失败兜底：截断取首尾各 4000 字

② payloadStage1 user message 智能替换
   - 优先用 data.scriptSummary（LLM 摘要）
   - 无摘要 → 截断首尾各 4000 字
   - 短剧本（≤10000 字）→ 直接用全文
   - ★ 始终保留提示词全文 + 本次选段

③ 缓存复用
   - 摘要缓存到节点 data 中，后续裂变直接复用
```

### 3.27 表格生成 LLM 化（★ 第二十二阶段新增）

```
【旧】handleFissionTable 用 setTimeout + 硬编码占位行创建空壳节点
【新】改为调用 LLM，根据剧本选段生成结构化场记表 JSON

每个表格行含：shotNumber / duration / camera / movement / shotType / 
videoDesc / characters / audio / imgScene / imgShotType / imgDesc / 
imgCharacters / imgEmotion / imgPrompt（LLM 生成真实内容而非占位符）
```

### 3.28 UI 风格统一（★ 第二十二阶段）

```
移除画布全部鲜艳颜色（indigo/emerald/amber），统一黑色液态玻璃风格：

EpisodeSelectModal.tsx（8处）：
  - 加载圈：bg-indigo-500/20 → bg-white/[0.06]
  - 确认按钮：bg-indigo-500 → bg-white/10
  - 全选激活态：bg-indigo-500/20 → bg-white/[0.1]
  - 勾选图标：text-indigo-400 → text-white
  - 数字高亮：text-indigo-400 → text-white / text-zinc-200

VideoCanvas.tsx（5处）：
  - 穿透覆盖按钮：bg-emerald-500 → bg-white/10
  - 智能追加按钮：bg-indigo-500 → bg-white/10
  - 影视总控激活态：bg-indigo-500/20 → bg-white/[0.08]
  - 进度条光条：via-indigo-400 → via-white/30
  - 画风预设选中：bg-indigo-500/20 → bg-white/[0.06]
  - 所有 focus:border-indigo/emerald → focus:border-white/20

CustomNodes.tsx（2处）：
  - 资产建档按钮：bg-indigo-500/10 → bg-white/[0.03]
  - 分辨率选择器：bg-indigo-500/20 → bg-white/[0.08]

CopilotMessage.tsx（3处）：
  - 用户头像：bg-indigo-500/20 → bg-white/[0.08]
  - AI 头像：bg-emerald-500/20 → bg-white/[0.04]
  - 流式光标：bg-emerald-400 → bg-zinc-400
```

### 3.29 三页面路由架构恢复（★ 第二十二阶段核心修复）

```
从 Git 历史 c88bceb / bd79edd / b73e4ca 恢复三层路由：

/           → 落地页（app/page.tsx）：深空主题 + 月球 + scroll-snap
/login      → 登录页（app/login/page.tsx）：星系液态玻璃 + 含「← 返回首页」
/workspace  → 工作台 SPA（app/workspace/page.tsx → WorkspaceApp.tsx）
```

```
```

---

## 四、【关键变量与状态】

## 四、【关键变量与状态】

### 4.1 前端全局状态

#### useAuthStore（`store/useAuthStore.ts`）

| 变量 | 类型 | 含义 |
|------|------|------|
| `isAuthenticated` | boolean | 是否已登录 |
| `userRole` | string | 角色：`admin` / `user` / `tester` |
| `isAuthChecking` | boolean | 登录校验中 |

**localStorage 键：** `yr-ai-token`（JWT）、`yr-ai-role`

#### useAppStore（`store/useAppStore.ts`）

| 变量 | 类型 | 含义 |
|------|------|------|
| `activeView` | string | 当前视图：`chat` / `image-gen` / `video-gen` / `workflow-gallery` / `workflow-execution` / `video-canvas` |
| `activeCanvasProjectId` | string \| null | 当前打开的画布项目 ID（null = 显示 CanvasVault 列表） |
| `canvasProjects` | array | 全部画布项目（含 nodes、edges、title、localAssets） |
| `canvasSettings` | object | 画布全局设置（defaultLLMModel、defaultImageModel、defaultVideoModel、globalPromptSuffix、globalAssetPromptPrefix、globalRatio、directorGenre、directorTempo） |
| `updateCanvasProject` | function | 更新/新建画布项目的唯一入口 |
| `settings` | object | 用户偏好（昵称、头像、系统提示词等） |

**localStorage 键：** `yr-canvas-storage`（仅缓存项目 id/title/updatedAt + activeView + activeCanvasProjectId）

#### page.tsx 局部状态（同步相关）

| 变量 | 含义 |
|------|------|
| `hasLoadedFromServer` | ★ 必须从云端拉完数据后才允许渲染画布（防覆盖死锁） |
| `latestPayloadRef` | 防抖后的同步 JSON 字符串 |
| `sessions` / `imageHistory` / `videoHistory` / `wfSessions` | 其他模块数据，一并同步 |

### 4.2 画布节点类型（CustomNodes.tsx）

| 节点 type | 组件名 | 用途 |
|-----------|--------|------|
| `media` | MediaNode | 导入图片/视频素材（★ 已支持「去脏重绘 i2i」按钮） |
| `text` | TextNode | 纯文本备注 |
| `render` | RenderNode | AI 生图节点 |
| `combine` | CombineNode | 多图合成 |
| `masterScript` | MasterScriptNode | 主剧本 |
| `shot` | ShotNode | 分镜镜头（含生图/生视频，★ 已支持「去脏重绘 i2i」按钮） |
| `videoClip` | VideoClipNode | 视频片段 |
| `scriptTable` | ScriptTableNode | 剧本表格 |
| `assetTable` | AssetTableNode | 资产表格 |

### 4.3 后端数据库表（SQLite）

**数据库文件：** `DB_PATH` 环境变量，默认 `/app/data/yr_ai.db`

| 表名 | 主键 | 存储内容 |
|------|------|----------|
| `users` | username | 账号、密码、角色、余额、权限开关、API Key、API Base URL |
| `user_settings` | username | 用户偏好 JSON |
| `chat_sessions` | id | 对话会话 JSON |
| `image_history` | id | 生图历史 JSON |
| `video_history` | id | 生视频历史 JSON |
| `wf_sessions` | id | 工作流会话 JSON |
| `canvas_projects` | id | ★ 画布项目完整 JSON（nodes/edges/assets） |

**canvas_projects 表结构：**
```sql
id TEXT PRIMARY KEY,
username TEXT,
updated_at INTEGER,
data TEXT  -- 完整项目 JSON 字符串
```

**users 表新增字段（2026-07-10）：**
```sql
api_base_url TEXT DEFAULT ''    -- 用户自定义 New-API Base URL
dmx_base_url TEXT DEFAULT ''    -- 用户自定义 DMX API Base URL
dmx_api_key TEXT DEFAULT ''     -- 用户自定义 DMX API Key
```

**invite_codes 表（2026-07-10 新增）：**
```sql
code TEXT PRIMARY KEY,          -- 8位十六进制邀请码
created_by TEXT,                -- 生成者
created_at INTEGER,             -- 生成时间戳
expires_at INTEGER,             -- 过期时间戳（+24h）
used_by TEXT DEFAULT NULL,      -- 使用者
used_at INTEGER DEFAULT NULL    -- 使用时间戳
```

### 4.4 后端 API 接口清单

| 方法 | 路径 | 认证 | 用途 |
|------|------|------|------|
| GET | `/health` | 无 | 健康检查 |
| POST | `/v1/login` | 无 | 登录 → JWT |
| POST | `/v1/register` | 无 | ★ 用户自助注册（需邀请码） |
| POST | `/v1/logout` | JWT | 登出 |
| GET | `/v1/user/sessions` | JWT | ★ 拉取全部云端数据 |
| POST | `/v1/user/sync_sessions` | JWT | ★ 推送全部数据到云端 |
| POST | `/v1/user/heartbeat` | JWT | 连接监测（仅返回状态，不写数据库） |
| POST | `/v1/user/change-password` | JWT | 用户自行修改密码 |
| POST | `/v1/user/update-api-config` | JWT | ★ 更新自己的 API Key + Base URL |
| POST | `/v1/chat/completions` | JWT | 对话（SSE） |
| POST | `/v1/images/generations` | JWT | 生图 |
| POST | `/v1/videos/generations` | JWT | 生视频提交 |
| POST | `/v1/videos/status` | JWT | 生视频轮询 |
| POST | `/v1/workflows/run` | JWT | 工作流执行 |
| GET | `/v1/static/media/{filename}` | 无 | ★ 媒体文件访问 |
| GET | `/v1/admin/users` | Admin | 管理员用户列表 |
| POST | `/v1/admin/users/{user}/recharge` | Admin | 管理员充值 |
| POST | `/v1/admin/users/{username}/action` | Admin | ★ 管理员操作（kick/reset_tokens/update_permission） |
| POST | `/v1/admin/users/create` | Admin | ★ 管理员手动新增用户 |
| POST | `/v1/admin/users/{username}/reset-password` | Admin | ★ 管理员重置用户密码 |
| POST | `/v1/admin/invite-codes/generate` | Admin | ★ 生成一次性邀请码（24h有效） |
| GET | `/v1/admin/invite-codes` | Admin | ★ 查看所有邀请码状态 |

### 4.5 计费规则

| 规则 | 值 |
|------|-----|
| 汇率 | 1 元人民币 = 100,000 Token |
| 普通生图 | 0.1 元/张 |
| 高级生图（banana-pro、seedream5.0） | 0.15 元/张 |
| 生视频 | 按模型+分辨率+时长查表（见 main.py 第 14–46 行） |
| 余额不足 | 返回 402，前端弹出提示 |

---

## 五、环境变量速查

### 前端 `.env.local`
```
NEXT_PUBLIC_API_BASE_URL=""    # 空 = 走 next.config.js 代理
```

### 后端 `.env`（关键项）
```
NEW_API_BASE_URL=...           # 聊天/生图上游
NEW_API_KEY=...                # 全局 API Key
DMX_API_BASE_URL=...           # 视频上游
DMX_API_KEY=...
JWT_SECRET_KEY=...
ALLOWED_USERS=user:pass:role:allow_video:api_key,...
DB_PATH=/app/data/yr_ai.db
TAVILY_API_KEY=...             # 联网搜索
```
> **注意：** `REGISTER_INVITE_CODE` 已废弃。邀请码改为管理员通过 API 动态生成，24 小时有效，一次性使用。
```

### 用户账号格式（ALLOWED_USERS）
```
用户名:密码:角色:视频权限(1/0):API_Key类型
示例: admindyr:dyr31918:admin:1:global
角色: admin | user | tester
```

---

## 六、已知问题与技术债

| # | 问题 | 影响 | 状态 |
|---|------|------|------|
| 1 | 媒体 URL 硬编码云 IP `82.157.193.46:8000` → 已改为 `49.232.57.73:8000` | 本地测试画布看不到图片 | 已知，可临时改 |
| 2 | ~~刷新黑屏问题~~ | ~~hasLoadedFromServer 阻塞画布渲染 + 全量数据单次拉取~~ | **2026-07-10 第八阶段已优化** |
| 3 | ~~数据库写入压力大~~ | ~~每 2.3s 全量写 6 张表~~ | **2026-07-10 第八阶段已优化** |
| 4 | ~~心跳每 30 秒写库~~ | ~~UPDATE users SET last_active_at 无意义写入~~ | **2026-07-10 第八阶段已移除** |
| 5 | `activity_logs` 表有写入逻辑但未建表 | 活动日志丢失 | 待修复 |
| 6 | 工作流注册表 10 个，仅 2 个后端实现 | 其余工作流返回 501 | 预期（占位） |
| 7 | Dify 环境变量存在但未接入 | 工作流走内嵌 Prompt | 预期（当前方案） |
| 8 | ~~画布数据丢失风险（5条路径）~~ | ~~sessionStorage 不存完整画布、同步射后不理、beforeunload 体积瓶颈、5s 同步间隔、logout 不拦截~~ | **2026-07-11 第九阶段已修复** |
| 9 | ~~banana-pro 比例不生效（选择 16:9 却出 1:1 图）~~ | ~~后端错误地将 Gemini 模型请求发送到 OpenAI 格式端点~~ | **2026-07-11 第十阶段已修复** |
| 10 | ~~画布图片/视频下载点击后打开新标签页而非下载~~ | ~~跨域 URL 被浏览器拦截为导航行为~~ | **2026-07-11 第十阶段已修复** |
| 11 | ~~画布存储无 localStorage 全量备份~~ | ~~sessionStorage 仅存轻量元数据，刷新/换浏览器依赖云端~~ | **2026-07-15 第十三阶段已修复** |
| 12 | ~~裂变分镜多批次重叠摆放~~ | ~~所有批次同一 X 坐标，measured.height 未就绪导致 Y 计算不准~~ | **2026-07-15 第十三阶段已修复** |
| 13 | ~~资产表模型/画质参数与 ShotNode 不一致~~ | ~~多余 banana2 选项、旧画质标签、生图硬编码 quality: '1K'~~ | **2026-07-15 第十三阶段已修复** |
| 14 | ~~资产表生图无队列/无重试/参数手写~~ | ~~批量瞬间 N 并发、失败不重试、payload 与引擎不一致~~ | **2026-07-15 第十三阶段已修复** |
| 15 | ~~资产表复制到画布比例变形~~ | ~~直接传表格全局比例而非图片真实比例~~ | **2026-07-15 第十三阶段已修复** |
| 16 | ~~资产表滚轮需选缝位置才能滚~~ | ~~textarea onWheelCapture 截断事件~~ | **2026-07-15 第十三阶段已修复** |
| 17 | ~~资产表点击图片表格消失~~ | ~~全屏覆盖层触发 React Flow 重测量~~ | **2026-07-15 第十三阶段已修复** |
| 18 | ~~场景/角色提示词不全面 + 资产表前缀体系缺失~~ | ~~场景提取缺约束/角色缺面容/缺资产表前缀穿透机制~~ | **2026-07-15 第十四阶段已修复** |
| 19 | 更多提示词优化（面孔持久化/三视图后缀） | 影响生成质量 | 待后续阶段实施 |
| 20 | ~~MasterScriptNode API 调用未显式传 stream:false~~ | ~~裂变/摄影机锚定无 LLM 请求~~ | **2026-07-15 第十五阶段已修复** |
| 21 | ~~SelectionAssist 全局文字选中完全不生效~~ | ~~① `window.getSelection().isCollapsed` 在 React Flow 中永远为 true ② `fieldLabel` 变量未定义导致 setSelection 报错 ③ 工具栏坐标 (0,-10) 渲染到屏幕外~~ | **2026-07-15 第十六阶段已修复** |
| 22 | ~~Canvas LLM 调用全缓冲等待（体感慢）~~ | ~~MasterScriptNode 4 个 API 调用 + SelectionAssist 2 个调用均 `stream: false`~~ | **2026-07-15 第十六阶段已修复** |
| 23 | ~~Copilot 无法执行"覆盖提示词"等指令~~ | ~~① 动词列表缺少"覆盖" ② "所有"必选 ③ LLM 确认后重新解析原始输入形成死胡同~~ | **2026-07-15 第十六阶段已修复** |
| 24 | ~~SelectionAssist 弹窗 UI 丑陋 + 按钮点击无反应~~ | ~~① 双按钮设计多余 ② 点击 toolbar 按钮时 mouseup → activeElement 变为按钮 → setSelection(null) → 门户卸载 → onClick 未触发~~ | **2026-07-16 第十八阶段已修复** |
| 25 | ~~在线状态：用户登录后在管理面板显示 OFFLINE~~ | ~~心跳接口不更新 last_active_at，admin/users 的 60s 窗口判定永远失败~~ | **2026-08-03 第二十二阶段已修复** |
| 26 | ~~网站主页消失 + 登录页无返回按钮~~ | ~~Git reset origin/main 丢弃了 c88bceb/bd79edd/b73e4ca 三个提交，三页面架构回退到单体 SPA~~ | **2026-08-03 第二十二阶段已恢复** |
| 27 | ~~长剧本（几十万字）裂变时上下文过长~~ | 新增 preSummarizeScript() LLM 预摘要 + 兜底截断，payloadStage1 用摘要替代全文 | **2026-08-04 第二十二阶段已缓解** |
| 28 | ~~裂变按钮永久转圈~~ | fetchStreamingChat 无超时/AbortController，SSE 流挂起时 reader.read() 永不 resolve | **2026-08-04 第二十二阶段已修复（8分钟超时 + AbortController + 中止按钮）** |
| 29 | ~~画布多处 UI 使用 indigo/emerald 鲜艳颜色~~ | 全部统一下黑白液态玻璃风格（18 处替换） | **2026-08-04 第二十二阶段已统一** |
| 30 | ~~摄影机/资产提取进度 Toast 蹦代码~~ | handleExtractCamera / executeAssetExtraction 未统一用进度条 | **2026-08-04 第二十二阶段已改造** |
| 31 | ~~表格生成是空壳节点~~ | handleFissionTable 用 setTimeout + 硬编码占位数据，无 LLM 调用 | **2026-08-04 第二十二阶段已改为 LLM 生成** |

### 6.1 第一阶段 bug 修复记录（2026-07-08）

| bug | 现象 | 根因 | 修复 | 涉及文件 |
|-----|------|------|------|----------|
| 1 | 分镜节点图片框超出节点 UI | 内层容器套了 `style={currentStyle}`（含 `width:400px`），比带 padding 的父卡片宽 → 溢出 | 内层容器只取 `aspectRatio`（空状态）或 `{}`（有图），`width` 只放最外层节点壳 | CustomNodes.tsx |
| 2 | 图片节点没有「去脏重绘」按钮 | 首次 replaceAll 时，MediaNode 的「标注」按钮是单行格式，与 ShotNode 多行格式不匹配，漏替换 | 单独给 MediaNode 补 Wand2 按钮 + handleInpaint | CustomNodes.tsx |
| 3 | 外部拉入图片有多余空白 | 图片用 `h-full object-contain`，容器强制 aspectRatio 与图片自然比例不一致 → letterbox 留白 | 图片改 `w-full h-auto`，由图片自然比例撑高，容器不锁死 | CustomNodes.tsx |
| 4 | 重绘点击后直接生图，无模型选择 | handleInpaint 直接 enqueue，没有选择模型的环节 | 新增 `InpaintDialog` 弹窗（模型选择 + 提示词预览/编辑），确认后才发请求 | CustomNodes.tsx |
| 5 | 图片节点空状态粒子只显示上面一点点 | 父级改 `h-auto` 后，粒子容器 `h-full` 解析为 0，只剩绝对定位的 `::before/::after` 溢出顶部 | 空状态粒子容器加 `style={{ aspectRatio }}` 撑出高度 | CustomNodes.tsx |

> **经验教训（写给自己）：** 在三元表达式 `: ( ... )` 分支内只能用 `//` 行注释，**不能**用 `{/* */}` JSX 注释——后者会变成空表达式容器，与紧随的 JSX 元素构成"两个表达式"导致语法错误。

---

## 七、启动与部署

### 本地开发
```bash
# 终端 1：后端
cd my-ai-backend
python -m uvicorn main:app --reload --port 8000

# 终端 2：前端
cd my-ai-frontend
npm run dev
# 访问 http://localhost:3000
```

### 生产部署（Docker）
```bash
# 后端需挂载两个卷
-v /path/to/data:/app/data    # SQLite 数据库
-v /path/to/media:/app/media  # 媒体文件
```

---

## 八、变更记录

| 日期 | 变更内容 | 涉及文件 |
|------|----------|----------|
| 2026-07-08 | 初版架构地图创建 | SYSTEM_MAP.md |
| 2026-07-08 | **第一阶段整改：真实比例穿透 + 去脏重绘 i2i** | CustomNodes.tsx / useCanvasEngine.ts |
| 2026-07-08 | **第一阶段 bug 修复（5 项）：容器溢出/图片节点漏按钮/图片留白/无模型选择/粒子塌缩** | CustomNodes.tsx / SYSTEM_MAP.md |
| 2026-07-09 | **第二阶段整改：剧片中控台建设（左侧悬浮极简黑色液态玻璃抽屉风格） + 顶栏一键开关 + 全局分镜比例下发覆盖 + 智能提示词安全追加（防重防污染） + 裂变默认继承联动** | CustomNodes.tsx / SYSTEM_MAP.md |
| 2026-07-09 | **第二阶段容灾整改：主中控/资产表防误删警告拦截 + 其他节点「时空回收站」极简黑色液态玻璃悬浮舱 + 节点与原物理连线一键原位复活还原** | VideoCanvas.tsx / SYSTEM_MAP.md |
| 2026-07-09 | **第三阶段多模型差异化与分辨率深度适配：完全废弃并干净清洗 banana2 模型残余、将 banana-pro 重新物理路由对齐谷歌官方 gemini-3-pro-image-preview 标准名、适配 1K/2K/3K/4K 专业像素对齐控制并在 UI 添加 Seedream 5.0 防呆 1K/4K 黄金比例自动修正拦截、后端支持火山 Seedream 5.0 精确 URL 数组去脏重绘专享模式、去除 banana-pro 的 ar 拼装保持 Prompt 所见即所得纯净度** | CustomNodes.tsx / useCanvasEngine.ts / main.py / constants.tsx / SYSTEM_MAP.md |
| 2026-07-09 | **多路生图参数与UI完全对齐优化：编写多模型分辨率动态选项生成器、清除 banana2 遗留、全面接入 useCanvasEngine 调度管道实现 MediaNode 统一队列生图，添加防呆分辨率自动重置机制以彻底屏蔽 400 报错，同步显示控制舱设定小胶囊 (Pill)** | CustomNodes.tsx / useCanvasEngine.ts / SYSTEM_MAP.md |
| 2026-07-09 | **影视总控舱一键穿透与安全追加重建：顶栏一键开关影视总控、左侧黑色液态玻璃悬浮舱配置、全局比例隐性覆盖（单分镜最高优先级）、提示词无痕智能安全追加（清洗历史、防套娃污染）、裂变时默认零成本继承联动** | VideoCanvas.tsx / CustomNodes.tsx / useCanvasEngine.ts / useAppStore.ts / SYSTEM_MAP.md |
| 2026-07-09 | **第三阶段-参数化导演路由引擎重构：4个规则仓库（布光字典38种+节奏运镜50项+题材预设18个+安全突变10种）+ DirectorRouter路由引擎 + 中控台题材/节奏选择器 + 裂变时System Prompt注入导演上下文 + buildImagePayload读导演变量** | director-rules.ts / CustomNodes.tsx / useCanvasEngine.ts / useAppStore.ts / VideoCanvas.tsx / SYSTEM_MAP.md |
| 2026-07-10 | **第四阶段-「三权分立」双阶段分镜管线架构升级：导演引擎解耦题材与节奏 + 阶段1大师分镜师统管调度（时长数学红线/三级降级光影法则/节奏补偿法则）+ 阶段2首帧画师彻底物理隔离（不看导演规则/100%照抄shotLighting/8大静态铁律/防运镜词污染）+ 资产表注入导演基因 + 英文咒语漏水修复 + 色彩越界防御 + 人工介入强制缝合保护** | CustomNodes.tsx / director-rules.ts / useCanvasEngine.ts / SYSTEM_MAP.md |
| 2026-07-10 | **第五阶段-用户体系重构：①自助注册（邀请码制 + 一次性动态码 24h失效）+ ②API Key 分离（用户自行填入 Key+URL，全局 fallback）+ ③resolve_api_config() 统一解析 + 全部AI代理接口切换 per-user API + ④修改密码 + ⑤补全Admin操作接口 + ⑥Admin邀请码管理UI + ⑦API Key掩码显示（折叠卡片+禁止复制+眼睛切换）+ ⑧ALLOWED_USERS仅首次建库导入 + ⑨fetchApi 401拦截排除登录接口** | main.py / page.tsx / SettingsModal.tsx / services/api.ts / SYSTEM_MAP.md |
| 2026-07-10 | **第六阶段-统一弹窗系统：创建 ConfirmDialog / PromptDialog / MessageDialog 三种自定义弹窗，全面替换 21 处浏览器原生 alert/confirm/prompt。统一深色液态玻璃设计语言。命令式 API（showConfirm/showPrompt/showMessage），任意文件可直接 import 调用。即时反馈类改用已有 Toast 系统。** | dialogStore.ts / DialogManager.tsx / page.tsx / SettingsModal.tsx / CanvasVault.tsx / VideoCanvas.tsx / useChat.ts / SYSTEM_MAP.md |
| 2026-07-10 | **第七阶段-画布三大核心 Bug 修复：①后端 sync_array 增加 DELETE 语句真正删除项目（INSERT OR REPLACE 留下僵尸行→刷新复活）② handleLogout + beforeunload 退出前强制同步最新数据（绕过防抖、直接从 ref 构建 payload）③ Ctrl+Z 撤销扩展为双重检查（deleteHistory 优先覆盖节点删除，undoHistory 节流采集覆盖文本编辑/节点拖移等非删除变更），最大快照 50 条** | main.py / page.tsx / VideoCanvas.tsx / SYSTEM_MAP.md |
| 2026-07-10 | **第八阶段-数据库写入减压与画布加载优化：①分模块渐进式加载：拆 hasLoadedFromServer 为 hasCanvasLoaded（画布渲染锁）+ hasLoadedFromServer（同步写入锁），画布数据用 ?modules=canvas 轻量请求快速渲染，聊天/生图历史后台异步补全（消除刷新黑屏）② GET /v1/user/sessions 支持 ?modules 参数按需返回指定表 ③ 同步间隔 2000ms→5000ms（减少 60% 写入频率）④ 心跳去数据库写（仅监测不写库）⑤ 双锁设计确保 sync/beforeunload/logout 在全部历史数据加载完成前绝不触发，防止误删云端数据** | main.py / page.tsx / SYSTEM_MAP.md |
| 2026-07-11 | **第十阶段-生图比例 Bug 紧急修复：① banana-pro 后端端点/格式重写——从错误的 OpenAI `/v1/images/generations` 格式迁移到 Gemini 原生 `POST /v1beta/models/gemini-3-pro-image-preview:generateContent`（aspectRatio + imageSize + contents.parts 结构），i2i 参考图从 URL 数组改为 base64 inlineData 嵌入 ② 前端 buildImagePayload 中 banana-pro 删除像素网格映射表，改为直接透传 aspectRatio + imageSize 给后端拼装 Gemini 请求体 ③ 画布全部 5 处下载按钮从 `document.createElement('a').click()`（跨域图片会跳新标签页而非下载）改为 `forceDownload()`（fetch blob → createObjectURL → 强制浏览器下载）** | main.py / useCanvasEngine.ts / CustomNodes.tsx / SYSTEM_MAP.md |
| 2026-07-11 | **第十阶段-补2：Seedream 5.0 图片破碎修复 ① 后端新增 Seedream 专用响应解析——绕开通用 find_image() 递归搜索，直读 data[0].url ② 15s 快存 + 后台静默转存策略——先尝试 15s 下载 BytePlus TOS 临时 URL 到本地，超时则先返 TOS 链接给前端渲染 + 后台异步下载（120s 超时），防前端图片破碎 ③ save_media_permanently 增强——添加 Accept 头 + User-Agent + 空内容检测 + 120s 超时 ④ 前端 useImageGen seedream 1:1 分辨率 1920x1920→2K 预设档位** | main.py / useImageGen.ts / SYSTEM_MAP.md |
| 2026-07-11 | **第十阶段-补：画布 UI 统一黑色液态玻璃风（纯 CSS/文案，零业务逻辑变更）** | CustomNodes.tsx / VideoCanvas.tsx / SYSTEM_MAP.md |
| 2026-07-11 | **第十一阶段-v2 落地页重构** | page.tsx / SYSTEM_MAP.md |
| 2026-07-11 | **第十一阶段-v3 交互+稳定性升级：①scroll-snap: y mandatory 全屏吸附 ②右侧圆点导航（IntersectionObserver高亮+点击跳转）③滚轮劫持单次轻拨自动跳屏 ④IntersectionObserver 入场动画（3级延迟渐现）⑤月球居中bug修复 ⑥Math.random() SSR水合防护 ⑦isClient登录态水合防护 ⑧删除S7 ⑨workspace页 pollVideoTask修复+next/dynamic ssr:false防崩溃** | page.tsx / login/page.tsx / workspace/page.tsx / workspace/WorkspaceApp.tsx / SYSTEM_MAP.md |
| 2026-07-12 | **第十二阶段-落地页视觉+文案整改：①修复入场动画——离开视口时移除 section-visible，确保每次滚动都播放动画 ②月球重设计——3D 球体光照遮罩（球面高光+暗部）+ 外围软光晕消边缘生硬 + 内层 60s 反向视差 ③左侧空白填补——新增淡色光晕背景层 ④Hero 标签「一站式影视AGI」⑤S1 文案大白话重写⑥S2 文案大白话重写（段落+三条铁律）+ 插图文字改为「①调度层 ②执行层」⑦S3 最后一句话修改 + 节点数量改为 100+/60+/20+/15+ ⑧S6 弱化对话，突出工作流与智能体** | page.tsx / SYSTEM_MAP.md |
| 2026-07-15 | **第十三阶段-画布技术全面整改：①存储三层加固（localStorage全量备份+刷新兜底+同步3次重试）②裂变分镜按批次分列自动排列 ③全局比例穿透覆盖全部节点类型 ④资产表参数与ShotNode对齐（去除banana2+动态画质+切换模型自动重置）⑤资产表生图复用buildImagePayload+并发2队列+3次重试+终止按钮 ⑥资产表图片复制真实比例自适应 ⑦资产表滚轮智能冒泡 ⑧图片全屏createPortal+节点min-height ⑨MediaNode用object-contain ⑩删除主控批量渲染/生图UI** | useAppStore.ts / page.tsx / VideoCanvas.tsx / CustomNodes.tsx / useCanvasEngine.ts / SYSTEM_MAP.md |
| 2026-07-15 | **第十四阶段-提示词优化 + 资产表前缀穿透：①场景提取 Prompt 5项约束升级（正面全景/东方默认/无违和/柔光/三点布光）②角色提取 Prompt 新增面容种族自动识别（剧本背景推断+华人默认）③资产表全局前缀穿透覆盖（中控台输入+按钮显性写入+UI可见+防套娃清洗，与后缀智能追加对称设计）④store 新增 globalAssetPromptPrefix 字段** | CustomNodes.tsx / useAppStore.ts / VideoCanvas.tsx / app/page.tsx / SYSTEM_MAP.md |
| 2026-07-15 | **第十五阶段-创作助手 + 字段级 AI 选择：①创作助手全局面板（可拖动、多对话管理、本地意图极速解析+LLM确认双路径）②全局文字选中AI助手（改写+对话双模式，覆盖全部可编辑字段）③AssetDock改为点击触发（修复回收站按钮被遮挡Bug）④MasterScriptNode API调用显式加 stream:false（修复摄影机锚定/裂变无LLM请求Bug）⑤全部UI统一黑色液态玻璃风格 ⑥MentionTextarea新增 dataAttrs 支持** | useCanvasCopilot.ts / CopilotPanel.tsx / SelectionAssist.tsx / CopilotMessage.tsx / CopilotActionCard.tsx / FieldAITrigger.tsx / useAppStore.ts / VideoCanvas.tsx / CustomNodes.tsx / AssetDock.tsx / SYSTEM_MAP.md |
| 2026-07-15 | **第十六阶段-SelectionAssist全画布覆盖+LLM流式加速+Copilot执行修复：① SelectionAssist 根因修复——弃用 window.getSelection()（React Flow 中永远 isCollapsed:true），改用 textarea.selectionStart/selectionEnd；坐标回退到 textarea 自身位置 ② 全画布 data 属性覆盖——ZenEditor 增加 dataAttrs prop 透传、TextNode/ScriptTableNode/AssetTableNode/MasterScriptNode/VideoClipNode 全部 textarea 补齐 data-node-id/data-field ③ Canvas LLM 流式加速——新增 fetchStreamingChat 公共函数，MasterScriptNode 4 个 API 调用 + SelectionAssist 2 个调用全部从 stream:false 改为 SSE 流式逐 chunk 读取 ④ Copilot 意图解析扩展——parseBatchUpdateType/parseBatchAppend/parseBatchUpdateFilter 正则增加动词"覆盖""修改""更改为""设为""换成""统一为"，"所有"改为可选；LLM 确认后优先解析 LLM 回复文本；System Prompt 增加操作描述格式引导** | CustomNodes.tsx / SelectionAssist.tsx / useCanvasCopilot.ts / CopilotPanel.tsx / SYSTEM_MAP.md |
| 2026-07-15 | **第十七阶段-云服务器前端更新部署流程标准化：① fixed next.config.js 删除 `output: 'standalone'`（与 `npx next start` 不兼容）② 建立 Dockerfile.front 标准模板（rm -rf node_modules .next → npm install → npm run build，解决 Windows 拖文件到 Linux 权限丢失问题）③ 固定服务器部署路径与容器名（源码 `/home/ubuntu/frontend/my-ai-frontend/`，容器 `my-frontend-app` :80→3000）④ 新增 SYSTEM_MAP.md 第九节「云服务器部署命令」** | next.config.js / Dockerfile.front / SYSTEM_MAP.md |
| 2026-07-16 | **第十八阶段-创作助手全权限升级+全局助手修复+!command统一指令架构：① SelectionAssist 修复——System Prompt 通用化（不再强制修改）、工具栏 CSS 横向修复（whitespace-nowrap）、按钮点击Bug修复（portal 类名护栏）② 新增画布设置「全局助手」开关（selectionAssistEnabled 持久化）③ 创作助手全部重写——移除所有自然语言正则解析器（消除误匹配垃圾操作）④ 新增 !command 统一指令格式（!set/!delete/!delete_all/!add/!connect/!move/!delete_edge）⑤ 支持批量操作（LLM 输出多行 !command → commands[] 子命令数组一次执行）⑥ 新增画布说明书 canvas-manual.ts（注入 System Prompt）⑦ ParsedAction 扩展 commands 子命令、batchDeleteByType 批量删除⑧ CopilotPanel 移除本地意图拦截分支（统一走 LLM→【确认修改】→!command 路径）** | SelectionAssist.tsx / useCanvasCopilot.ts / CopilotPanel.tsx / VideoCanvas.tsx / useAppStore.ts / canvas-manual.ts / SYSTEM_MAP.md |
| 2026-07-20 | **第十九阶段-剧本截断修复与集数分块提取：① 摄影机提取移除 8000 字截断 → 发送完整剧本 + max_tokens:4096 ② 资产表提取改为二阶段流程（EpisodeSelectModal 集数检测→用户选择→提取），移除 15000 字截断，不设 max_tokens 上限（Owner 决策），System Prompt 增加完整性要求 ③ 分镜裂变注入全文上下文 + 已有分镜摘要（前后各10个），解决 LLM 不知前后剧情的脱节问题 ④ 新增「📋 按集选择」按钮（不覆盖原有手动划选），新增 buildExistingShotsSummary 辅助函数 ⑤ 新增 EpisodeSelectModal.tsx 组件（集数检测+选择UI，黑色液态玻璃风格）⑥ 集数检测缓存机制（episodeCacheRef + 剧本哈希 getScriptHash）——同一剧本多次打开弹窗秒开，零 LLM 重复调用；剧本变更时哈希自动失效重新检测** | EpisodeSelectModal.tsx / CustomNodes.tsx / SYSTEM_MAP.md |
| 2026-07-21 | **第二十阶段-分镜摘要智能批次溯源重构：① buildExistingShotsSummary 重写——新增边过滤（仅取与当前 MasterScriptNode 有连接的分镜，排除跨主控污染）+ 书签批次分组（利用 extractedScenes 回溯每批分镜的原始剧本选段，LLM 自行判断相关性）+ 孤立分镜兜底 + 无书签降级 ② 调用处传入 getEdges() + id + data.extractedScenes ③ payloadStage1 user message 提示词从「供延续空间站位与时序逻辑」改为「仅供了解本剧本画布上的分镜状态，请根据当前选段独立判断，不强制延续已有设定」** | CustomNodes.tsx / SYSTEM_MAP.md |
| 2026-08-03 | **第二十一阶段-Canvas LLM 调用统一架构 + API Key 强制自配 + UI 体验改进：① 新增 canvasSettings.defaultLLMModel（中控台 LLM 模型选择器），18 项硬编码模型名全部改为统一解析 ② resolveLLMModel() 白名单校验——防止 data.model 缓存生视频模型阻断回退链（修复合影机锚定报 500 的核心 Bug）③ fetchStreamingChat + EpisodeSelectModal + SelectionAssist + useCanvasCopilot 全部从 raw fetch() 迁移到 fetchApi()，享受 401/402/403 拦截 ④ resolve_api_config() 去除 "global" → 服务端 Key 兜底，所有 AI 端点加空 Key 拦截（必须用户自配 Key）⑤ MasterScriptNode 模型下拉框迁移到中控台（防节点展开后消失）⑥ SettingsModal Toast 修正 + 全局 Toast z-index 提升到 100001 ⑦ .env Key 同步修复** | useAppStore.ts / CustomNodes.tsx / VideoCanvas.tsx / SettingsModal.tsx / app/page.tsx / EpisodeSelectModal.tsx / SelectionAssist.tsx / useCanvasCopilot.ts / main.py / .env / SYSTEM_MAP.md |
| 2026-08-04 | **第二十二阶段-架构整改与体验优化（完整版）：① P0 三页面路由架构恢复——从 Git 历史 cherry-pick c88bceb/bd79edd/b73e4ca 三个丢失提交 ② P1 在线状态修复——心跳接口恢复 UPDATE users SET last_active_at ③ P2 分镜裂变进度条——fissionProgress 统一状态驱动 + 中止按钮 + AbortController 8分钟超时兜底 ④ P3 长剧本智能压缩——preSummarizeScript() LLM 预摘要 ⑤ P4 摄影机提取改造——Toast 蹦代码改为统一进度条 + AbortController ⑥ P5 资产提取改造——同上 ⑦ P6 表格生成 LLM 化——handleFissionTable 从硬编码占位改为 LLM 真实生成 ⑧ P7 UI 风格统一——EpisodeSelectModal(8处) + VideoCanvas(5处) + CustomNodes(2处) + CopilotMessage(3处) 共 18 处鲜艳颜色替换为黑色液态玻璃风格 ⑨ 提示词零删减** | app/page.tsx / app/login/page.tsx / app/workspace/page.tsx / app/workspace/WorkspaceApp.tsx / main.py / useAppStore.ts / VideoCanvas.tsx / CustomNodes.tsx / EpisodeSelectModal.tsx / CopilotMessage.tsx / SYSTEM_MAP.md |
| 2026-08-04 | **裂变分镜 500 超时修复：① 后端 main.py httpx 全局超时拆细——connect=30s / read=900s(15分钟) / write=60s / pool=30s，旧配置 httpx.Timeout(300) 所有操作一视同仁，长流式响应超 5 分钟即 ReadError→前端 500 ② 后端两个 stream_generator（聊天 + 工作流）新增 ReadError 捕获——已发数据不丢，注入 SSE error 事件告知前端流中断，不再炸 ASGI 级异常 ③ 前端 next.config.js proxyTimeout 300000→900000（5分钟→15分钟），对齐后端超时，消除代理层瓶颈** | main.py / next.config.js / SYSTEM_MAP.md |
| 2026-08-04 | **DeepSeek 思考模式关闭（三处）：DeepSeek 默认 thinking effort=high，模型在输出最终答案前先输出巨量 reasoning_content（思维链文字），阶段 2 实测 864KB 中 ~859KB 是丢弃的思考 token，占满 SSE 流带宽导致连接断开（httpx.ReadError）。官方文档确认：①关闭思考不影响模型内部推理 ②多轮对话中 reasoning_content 无工具调用时传回也会被忽略。三处 payload 加入 `thinking: { type: "disabled" }`——① payloadStage1（阶段 1 拆镜）② payloadStage2（阶段 2 首帧提取）③ useChat.ts 主页对话** | CustomNodes.tsx / useChat.ts / SYSTEM_MAP.md |

---

## 九、云服务器部署命令

> **服务器：** 49.232.57.73 / 轻量云 Ubuntu  
> **SSH：** `ssh ubuntu@49.232.57.73`

### 9.1 服务器路径速查

| 项目 | 路径 |
|------|------|
| 前端源码 | `/home/ubuntu/frontend/my-ai-frontend/` |
| 后端源码 | `/home/ubuntu/backend/my-ai-backend/` |
| Dockerfile 前端 | `/home/ubuntu/Dockerfile.front` |
| SQLite 数据卷 | `/app/data`（Docker 挂载） |
| 媒体文件卷 | `/app/media`（Docker 挂载） |
| 数据库文件 | `/app/data/yr_ai.db` |

### 9.2 容器清单

| 容器名 | 镜像 | 端口映射 |
|--------|------|----------|
| `my-frontend-app` | `my-ai-frontend` | `80:3000` |
| `my-backend-app` | `my-ai-backend` | `8000:8000` |

### 9.3 前端更新流程（手动拖文件方式）

```bash
# =============================================
# 步骤 1：停旧容器
# =============================================
sudo docker stop my-frontend-app
sudo docker rm my-frontend-app

# =============================================
# 步骤 2：重新创建 Dockerfile.front
# （每次构建前必须重建，因为 /home/ubuntu 目录无持久化）
# =============================================
sudo bash -c "cat > /home/ubuntu/Dockerfile.front << 'EOF'
FROM node:22-alpine
WORKDIR /app
COPY my-ai-frontend/ ./
RUN rm -rf node_modules .next && npm install && npm run build
EXPOSE 3000
CMD [\"npx\", \"next\", \"start\", \"-p\", \"3000\"]
EOF
"

# =============================================
# 步骤 3：构建镜像 + 启动容器
# =============================================
sudo docker build -f /home/ubuntu/Dockerfile.front -t my-ai-frontend /home/ubuntu/frontend/
sudo docker run -d --name my-frontend-app --restart unless-stopped -p 80:3000 my-ai-frontend

# =============================================
# 步骤 4：验证
# =============================================
sudo docker ps
sudo docker logs my-frontend-app
# 看到 "Ready in" 即启动成功
```

### 9.4 后端更新流程

```bash
# 停 + 删旧容器
sudo docker stop my-backend-app
sudo docker rm my-backend-app

# 构建 + 启动
cd /home/ubuntu/backend/my-ai-backend
sudo docker build -t my-ai-backend .
sudo docker run -d --name my-backend-app --restart unless-stopped \
  -p 8000:8000 \
  -v /app/data:/app/data \
  -v /app/media:/app/media \
  -e NEW_API_BASE_URL="https://bvctfwcsoqeb.sealoshzh.site" \
  -e NEW_API_KEY="sk-4slm60o7iIUIFJOSzm7GNEMyiJi1OQYnrxSyXXOl7TvnCg4W" \
  -e DEFAULT_MODEL="gpt-5.4" \
  -e DMX_API_BASE_URL="https://www.dmxapi.cn" \
  -e DMX_API_KEY="sk-2xEM2Qpu2w62BWep4NsOY9gjXkmO7YIet7mpssxs9SWjCaZZ" \
  -e TAVILY_API_KEY="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" \
  -e JWT_SECRET_KEY="YRAI_2026_x89sd#kLp!2m_NEW" \
  -e ALLOWED_USERS="admindyr:dyr31918:admin:1:global,userxzh:xzh123456:user:0:sk-3aZMQ1bWtkxjbc9sAmFOWcsg19SVpdNQ0qHqGx4yrgiq1xsh,userjxr:jxr123456:user:0:sk-ZSE0jqlYenRTcfpLZGSnCmhsVqjn8tZpDqMu57nPEJjXaPFL,userqgc:qgc123456:user:0:sk-5nqT6mzboSMZemVMOi7ORzChWvWHH4Msee06sSjgco7K5Cs9,userlyh:lyh123456:user:0:sk-5nqT6mzboSMZemVMOi7ORzChWvWHH4Msee06sSjgco7K5Cs9,usersx:sx123456:0:0:sk-3aZMQ1bWtkxjbc9sAmFOWcsg19SVpdNQ0qHqGx4yrgiq1xsh,userdyb:dyb123456:tester:0:sk-3aZMQ1bWtkxjbc9sAmFOWcsg19SVpdNQ0qHqGx4yrgiq1xsh,test03:test123456:tester:0:global,test04:test123456:tester:0:global,test05:test123456:tester:0:global,test06:test123456:tester:0:global,test07:test123456:tester:0:global,test08:test123456:tester:0:global,test09:test123456:tester:0:global,test10:test123456:tester:0:global,test11:test123456:tester:0:global,test12:test123456:tester:0:global,test13:test123456:tester:0:global,test14:test123456:tester:0:global,test15:test123456:tester:0:global,test16:test123456:tester:0:global,test17:test123456:tester:0:global,test18:test123456:tester:0:global,test19:test123456:tester:0:global,test20:test123456:tester:0:global" \
  -e DB_PATH="/app/data/yr_ai.db" \
  my-ai-backend

# 验证
sudo docker ps
sudo docker logs my-backend-app
```

### 9.5 常用排查命令

```bash
sudo docker ps                              # 查看运行中的容器
sudo docker ps -a                           # 查看所有容器（含已停止）
sudo docker logs my-frontend-app            # 前端日志（最后几行）
sudo docker logs -f my-frontend-app         # 前端日志（实时滚动，Ctrl+C 退出）
sudo docker logs --tail 50 my-frontend-app  # 前端日志（最近 50 行）
sudo docker logs my-backend-app             # 后端日志
sudo docker rm -f my-frontend-app           # 强制删除前端容器
sudo docker rm -f my-backend-app            # 强制删除后端容器
```

### 9.6 关键踩坑记录

| # | 问题 | 根因 | 解决 |
|---|------|------|------|
| 1 | `sh: next: Permission denied` | Windows 手动拖文件到 Linux，`node_modules/.bin/next` 丢失执行权限 `x` | Dockerfile 里 `rm -rf node_modules .next && npm install && npm run build`，在容器内重装 |
| 2 | `Could not find a production build in the '.next' directory` | 手动拖文件不含 `.next` 构建产物 | 同上，Dockerfile 里加 `npm run build` |
| 3 | `output: 'standalone'` 警告 | next.config.js 的 `output: 'standalone'` 与 `npx next start` 不兼容 | 从 next.config.js 删除 `output: 'standalone'` 行 |
| 4 | `port is already allocated` | 旧容器未删干净或僵尸容器占端口 | `sudo docker rm -f $(sudo docker ps -aq --filter "name=my-")` |
| 5 | 容器名不一致 | 历史遗留 `my-ai-frontend` vs 当前 `my-frontend-app` | 统一使用 `my-frontend-app` |

---

> **Owner 提示：** 如需修改画布逻辑，优先关注 `VideoCanvas.tsx`、`CustomNodes.tsx`、`useCanvasEngine.ts`、`useAppStore.ts`、`useCanvasCopilot.ts`。如需修改路由/登录/工作台，关注 `app/page.tsx`（落地页）、`app/login/page.tsx`（登录页）、`app/workspace/page.tsx`（工作台SPA）。同步/存储关注 `main.py`（sync_sessions + 媒体存储 + 用户体系）、`director-rules.ts`（导演引擎）、`dialogStore.ts`（统一弹窗）、`DialogManager.tsx`（弹窗UI）、`SettingsModal.tsx`（API配置/Admin面板）、`services/api.ts`（全局拦截器）共 15 个文件。
