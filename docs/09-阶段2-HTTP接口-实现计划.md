# 09 · 阶段 2 HTTP 接口 · 实现计划

> 本文件是**阶段 2（HTTP 接口）的施工蓝图**，对应 `docs/07` 路线图阶段 2。
> 目标：起一个本地 Node 服务，把阶段 1 的内核模块（scanner/parser/exporter/manifest）**包一层 HTTP**，
> 按 `docs/02 §4` 实现路由。**不重写任何解析/分轮/导出逻辑。**
> 创建于 2026-06-01。动代码前定稿，施工中如有偏差**回头同步本文件**（见 §11 As-built）。

---

## 1. 目标与范围

- ✅ 范围内：`node:http` 服务 + 6 个路由 + 配置读写（`config.ts`）+ range 筛选（scanner 层）+ 行为级测试。
- ❌ 范围外：前端/封面（阶段 3-4）、AI 真实接入（阶段 5，本期 `/api/config` 仅占位脱敏）、静态托管前端构建产物与一键启动（阶段 6）。
- 验收标准：6 路由按 `docs/02 §4` 工作；`node --test` 全绿（阶段 1 的 21 个 + 新增）；真实数据手测通过；只读源数据不变。

---

## 2. 技术选型：`node:http`（零依赖）

延续阶段 1「运行时零依赖」铁律（`server/` 当前无 `node_modules`）。路由面仅 6 个 handler，手写分发约 30 行；
body/query 用 Node 24 内置 `URL`，测试用内置 `node:test` + 全局 `fetch`。**不引入 express**（为 6 个本地路由引框架属过度，且破坏零依赖基调）。

| 项 | 选择 | 理由 |
|----|------|------|
| 服务 | `node:http` | 零依赖；与 `cli.ts`、TDD 一脉相承 |
| 监听 | `127.0.0.1`，端口默认 `8787`（`AIDA_PORT` 覆盖） | 仅本机，不绑 `0.0.0.0`（安全） |
| body/query | `new URL()` + 手写 `readJsonBody` | 无需中间件 |
| 测试 | `node:test` + 端口 0 + 全局 `fetch` | 真集成测试，复用现有 fixtures |

---

## 3. 目录结构（新增；现有模块一律不动）

```
server/
├─ src/
│  ├─ http/
│  │  ├─ server.ts        # createApiServer(deps?) → http.Server；直接运行时 listen(127.0.0.1)
│  │  ├─ router.ts        # 极简 method+path 匹配，支持 /api/sessions/:id 取参
│  │  ├─ http-util.ts     # readJsonBody / sendJson / sendError / 查询解析
│  │  └─ routes/
│  │     ├─ sources.ts    # GET /api/sources
│  │     ├─ sessions.ts   # GET /api/sessions · GET /api/sessions/:id
│  │     ├─ export.ts     # POST /api/export
│  │     └─ config.ts     # GET/PUT /api/config
│  ├─ config.ts           # 读写 data/config.json + 脱敏（新增，仿 manifest.ts 容错风格）
│  ├─ scanner.ts          # ← 仅追加 filterByRange()（range 筛选在 scanner 层）
│  └─ paths.ts            # ← 仅追加 configPath() 与 serverPort()
└─ test/
   └─ http.test.ts        # 路由行为级集成测试（端口 0 + fetch，复用 fixtures）
```

`createApiServer(deps)` 的 `deps` 可注入 `claudeRoot/codexRoot/manifestPath/configPath/exportDir`，
默认取 `paths.ts`。测试据此指向 `test/fixtures/scan/` 与临时目录，**不碰真实数据、不污染 Obsidian 库**
（与 `scanClaude(root)` 的现有可测试缝一致）。

---

## 4. 路由 → 现有模块映射

| 路由 | 复用模块 / 行为 |
|------|----------------|
| `GET /api/sources` | `scanClaude(claudeRoot,m).length` / `scanCodex(codexRoot,m).length` → `{claude:{count},codex:{count}}`（与列表口径一致，已排除 subagents/空会话） |
| `GET /api/sessions?source=&range=` | `loadManifest` → `scanClaude/scanCodex/scanAll` → **`filterByRange`** → 按 `startedAt` 降序 |
| `GET /api/sessions/:id?thinking=` | `sourceOf(id)` → `resolveSessionPath` → `parseSessionFile(file,source,{includeThinking})` → 用 `deriveBlockStatus(m,id)` 把每块 `exported` 注入 rounds → `{meta,rounds}` |
| `POST /api/export` `{id,blockIds,filename,aiTidy}` | `resolveSessionPath`→`parseSessionFile`→`buildMarkdown`→`writeExport(dir)`→`recordExport`+`saveManifest` → `{ok,path}` |
| `GET /api/config` | `loadConfig()` → `redact(ai.apiKey)` 返回 |
| `PUT /api/config` | 合并入 `config.json`（apiKey 收到脱敏占位则保留旧值）→ `{ok}`；`saveConfig` |

要点：
- **`filterByRange(sessions, range, now?)`**：scanner 导出的纯函数（按 `day`/`startedAt` 算 7d/30d；`all` 直通），
  满足「在 scanner 层」且可脱离 HTTP 单测。
- `/api/sessions/:id` 注入块级 `exported`：rounds 出厂是 `exported:false`，route 按 manifest 覆盖（`docs/05 §4.3`）。
- `sourceOf(id)`：`id.startsWith('codex:') ? 'codex' : 'claude'`（与 `cli.ts` 同）。

---

## 5. 配置（`config.ts`）与导出目录

`data/config.json`（仿 `manifest.ts`：缺失/损坏 → 回退默认，绝不抛）：

```jsonc
{
  "exportDir": "E:\\Work2\\Obsidians_database\\00_资源库\\02_AI对话记录",  // 默认 = paths.DEFAULT_EXPORT_DIR
  "ai": {
    "enabled": false,
    "provider": "openai-compatible",        // openai-compatible | anthropic | ollama
    "baseUrl": "https://api.openai.com/v1",
    "apiKey": "",
    "model": "gpt-4o-mini",
    "skill": "default",
    "temperature": 0.3,
    "timeoutMs": 60000
  }
}
```

- `ai` 即 `docs/06 §2` 的 schema；**顶层新增 `exportDir`**（`docs/06` 原仅定义 `ai`）——
  导出目录来源：`docs/02 §4` 的 export 入参不含 `dir`，`docs/05 §1` 说存「后端配置」，故 `POST /api/export` 用 `config.exportDir`。
  **此为对 `docs/06` 的扩展，已在 `docs/06 §2` 同步补注。**
- `GET /api/config` 返回整体，`ai.apiKey` 脱敏：空→`""`，有值→`"********"`。
- `PUT /api/config`：收到 `apiKey:"********"`（脱敏占位）视为「不改 key」，保留旧值；其余字段合并覆盖。

模块导出：`defaultConfig()` · `loadConfig(path)` · `saveConfig(path,cfg)` · `redactConfig(cfg)` · `mergeConfig(old,incoming)`。

---

## 6. 服务细节

- 直接运行 `node src/http/server.ts` 才 `listen`；被 import（测试）时不自动监听——
  用 `fileURLToPath(import.meta.url) === process.argv[1]` 守卫。
- `createApiServer(deps?)` 返回 `http.Server`（未 listen），便于测试 `server.listen(0)` 取临时端口。
- `package.json` 加 `"serve": "node src/http/server.ts"`。
- **CORS / dev 代理**：开发期 `web/`（阶段 3）Vite 配 `server.proxy['/api'] = 'http://127.0.0.1:8787'`，
  同源，**无需 CORS**。server 内留最小 CORS 开关（默认关），必要时放行 `localhost:5173`。静态托管 = 阶段 6。

Vite 代理设想（阶段 3 落地，此处先记）：

```ts
// web/vite.config.ts
export default defineConfig({
  server: { proxy: { '/api': 'http://127.0.0.1:8787' } },
});
```

---

## 7. 容错与错误约定

- 每个 handler `try/catch` 兜底 → `500 {ok:false,error}`，进程绝不崩。
- 未知路由 `404`；方法不符 `405`；body 非法 JSON `400`；export 缺 `id`/`blockIds` `400`；`resolveSessionPath` 未命中 `404`。
- 解析层本就容错（坏行跳过、未知 type 跳过），HTTP 层不重复造。
- **只读源**不变：HTTP 层只写 `导出目录 + manifest.json + config.json`，绝不碰 `.claude`/`.codex`。

---

## 8. 测试计划（TDD，`node:test`，端口 0 + 全局 `fetch`，复用 `test/fixtures`）

1. `GET /api/sources` → count 与 fixtures 一致（排除 subagents）。
2. `GET /api/sessions?source=claude` → 数组、排除 subagents、降序。
3. `filterByRange` 纯单测：7d/30d/all 边界。
4. `GET /api/sessions/:id` → `{meta,rounds}` 结构正确。
5. `?thinking=true` → 首轮回复比默认长（开关生效）。
6. 导出后再取 `:id` → 对应块 `exported:true`（manifest 注入）。
7. 未知 id → `404`。
8. `POST /api/export` → 写入临时目录、`{ok:true,path}`、文件含 front matter、manifest 追加一条。
9. `POST /api/export` 缺字段 → `400`。
10. `GET /api/config` → `apiKey` 脱敏。
11. `PUT /api/config` → 持久化；占位 key 时保留旧值；GET 往返一致。
12. 未知路由 → `404` 且不崩。

---

## 9. 硬约束（贯穿全程）

- **只读源数据**：绝不写 `.claude`/`.codex`。
- **只写 `server/`**：导出目录（默认 `DEFAULT_EXPORT_DIR`）+ `data/manifest.json` + `data/config.json`。
- **复用现有模块**：不重新实现解析/分轮/导出/manifest 逻辑。
- **容错**：未知路由/方法/坏 body 返回明确状态码，进程不崩。
- **编码** UTF-8；**端口** 仅 `127.0.0.1`。

---

## 10. 施工顺序

1. `paths.configPath/serverPort` + `config.ts`
2. `scanner.filterByRange`
3. `http/http-util` + `http/router`
4. `http/routes/*`
5. `http/server.ts`
6. `test/http.test.ts` 跑绿（阶段 1 的 21 + 新增）
7. 真实数据手测（`Invoke-RestMethod` / curl），回填 §11 As-built

---

## 11. As-built（2026-06-01 完成回填）

阶段 2 已按计划用 TDD 完成，**`node --test` 31 个全绿**（阶段 1 的 21 + 新增 10），
并用本机真实会话手测通过。与 §1-§10 计划基本一致，记录如下：

**实际文件（新增/改动）**
- 新增 `src/http/{server,router,http-util}.ts` + `src/http/routes/{sources,sessions,export,config}.ts`
- 新增 `src/config.ts`（`defaultConfig/loadConfig/saveConfig/redactConfig/mergeConfig`，仿 manifest 容错）
- 改 `src/paths.ts`：加 `configPath()`、`serverPort()`（默认 8787，`AIDA_PORT` 覆盖）
- 改 `src/scanner.ts`：加纯函数 `filterByRange(sessions, range, now?)`
- 改 `src/types.ts`：加 `AiProvider/AiConfig/AppConfig/Range`
- 改 `package.json`：加 `"serve": "node src/http/server.ts"`
- 新增 `test/http.test.ts`（端口 0 + 全局 `fetch`，复用 `test/fixtures`）

**与计划的偏差/澄清**
- **`Deps` 注入**：`createApiServer(overrides?)` 以 `paths.ts` 为默认，`overrides` 可覆盖
  `claudeRoot/codexRoot/manifestPath/configPath/exportDir`。测试据此指向 fixtures/临时目录，零污染。
- **`resolveSessionPath` 的可测试性坑**：它按「文件名包含 sessionId」粗筛候选；现有 scan fixtures 的文件名
  不含其内部 sessionId，故 id 类路由（getSession/export/thinking）测试改为**临时写一个文件名含 id 的
  Claude 会话**驱动；sources/list 类仍复用现有 scan fixtures。
- **`filterByRange` 按 `startedAt`**：用 `Date.parse(startedAt)` 比对 now-N 天；解析失败的会话保守保留（不误杀）。
- **`mergeConfig` 字段级容错**：PUT 只覆盖出现且类型正确的字段；`apiKey:"********"`（脱敏占位）视为「不改 key」。
- **CORS**：按计划留空（开发走 Vite 代理，同源）；本期 server 未加任何 CORS 头，阶段 3 如直连再放行。

**真实数据手测（端口 8799，config/manifest 指向临时文件）**
- `GET /api/sources` → `{claude:{count:47}, codex:{count:93}}`（合计 140，与 `cli.ts scan` 一致）。
- `GET /api/sessions?source=codex&range=7d` → 56 条，按 `startedAt` 降序，首条为当日会话。
- `GET /api/sessions/:id`（真实 codex id）→ `{meta,rounds}` 正确；`POST /api/export`（导出目录指向临时目录）
  写出 md（2351 字节、含 front matter）、`{ok,path}`，再取 `:id` 时对应块 `exported:true`。
- `POST /api/export` 缺 `blockIds` → 400；未知 id/路由 → 404；`GET /api/config` 的 `apiKey` 脱敏。

> 注：手测时若把导出目录误填成 Git-Bash 风格 unix 路径（`/c/Users/...`），Node 会按盘符相对路径落到
> `E:\c\Users\...`——这是手测脚本路径写法问题，非服务缺陷；生产默认 `DEFAULT_EXPORT_DIR` 为合法 Windows 路径。
