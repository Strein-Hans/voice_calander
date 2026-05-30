# Voice Calendar 升级实施规划

> 基于 README_v2 (PRD) 修订版，对齐 v1.0 补完 → v1.1 体验 → v2.0 Agent 三阶段路线。

---

## Phase 1: v1.0 补完 — 修复已知 Bug + 补齐未完成功能

> 对应 PRD Roadmap "v1.0" 中标记为 `[ ]` 的 3 项。目标：让当前版本所有声称的功能都能正常工作。

### 1.1 日历视图 CSS class 重置

- **文件**: `src/public/js/calendar-ui.js` — `renderMonth()` 方法
- **问题**: `renderWeek()` 和 `renderDay()` 设置了 `grid.className = 'calendar-grid week-view/day-view'`，但 `renderMonth()` 不重置 className。从周/日视图切回月视图时布局错乱
- **方案**: `renderMonth()` 开头加一行 `grid.className = 'calendar-grid'`。`renderWeek()` 和 `renderDay()` 内已正确设置，无需改
- **验证**: 月→周→月→日→月 反复切换，布局均正常

### 1.2 事件加载范围按视图动态调整

- **文件**: `src/public/js/calendar-ui.js` — `loadEvents()` 方法
- **问题**: `loadEvents()` 始终按当前月 ±1 月范围查询。周视图跨月时（如月末那周跨到下月初）会遗漏事件
- **方案**: 根据 `viewMode` 计算不同范围
  - `month`: 当月 1 日 → 下月最后一天（现有逻辑）
  - `week`: `currentDate` 所在周的周一前 7 天 → 周日后 7 天（留余量）
  - `day`: 当天 ±1 天
- **验证**: 导航到月末那周，确认跨月事件全部显示

### 1.3 解析卡片可编辑

- **文件**: `src/public/js/event-panel.js` — `showParseResult()` 方法, `src/public/css/style.css`
- **问题**: 解析结果字段为只读 `<span>`，用户无法在确认前修正 AI 解析错误，只能取消重说
- **方案**: 
  - `title` → `<input type="text">`
  - `start_time` → `<input type="datetime-local">`
  - `end_time` → `<input type="datetime-local">`
  - 新增 `getEditedParams()` 方法，确认时从 input 读取最新值（而非用原始 parsed params）
  - `parseConfirm` 点击时调用 `getEditedParams()` 而非原始 `pendingAction.params`
- **验证**: 解析一个事件后修改标题和时间，确认后检查数据库记录与修改一致

### 1.4 设置页面联动后端

- **文件**: 新建 `src/routes/settings.js`, 修改 `server.js`, 修改 `src/public/js/api.js`, 修改 `src/public/js/app.js`
- **问题**: 前端设置页仅保存到 localStorage，后端读取 `process.env`，两边完全断开。用户在前端改了 API Key 无任何效果
- **方案**: 
  - 后端新增 `GET /api/settings` 和 `POST /api/settings` 端点
  - POST 端点将 API 配置写入运行时变量（`process.env.AI_API_KEY = ...`），不修改 .env 文件
  - GET 端点返回当前配置（Key 脱敏显示，仅保留前 8 位 + `***`）
  - 前端 `api.js` 新增 `getSettings()` 和 `saveSettings()` 方法
  - `app.js` 的 `setupSettings()` 改为从后端读取/保存，而非 localStorage
- **验证**: 在前端设置页修改 API Model → 点保存 → 重新打开设置页，确认值已持久 → 发起语音解析，确认使用了新模型

---

## Phase 2: v1.1 — 体验完善

> 对应 PRD Roadmap "v1.1" 全部 7 项。目标：消除交互中的粗糙感。

### 2.1 语音按钮交互统一

- **文件**: `src/public/js/app.js` — voice 按钮事件绑定（当前 mousedown/mouseup + click 冲突）
- **问题**: 同时绑定了 press-hold（mousedown/mouseup）和 click-toggle。mouseup 触发 stopListening 后 click 又触发 toggleListening 重新启动
- **方案**: 统一用 `pointerdown`/`pointerup` + 按压时长判断
  - 按下记录 `startTime = Date.now()`
  - 松开时计算时长：`< 300ms` 视为短按 toggle，`≥ 300ms` 视为长按释放
  - 移除独立的 click 监听，触摸设备也走同一套 pointer 逻辑
- **验证**: 短按（< 300ms）toggle 开关；长按松开停止识别；触摸设备同样正常

### 2.2 语音错误反馈

- **文件**: `src/public/js/voice.js` — `onerror` 回调, `src/public/js/app.js` — `onStateChange`, 三个 `i18n/*.js`
- **问题**: 识别失败（权限拒绝 / 网络错误 / 未检测到语音）只 `console.error`，用户看不到
- **方案**:
  - i18n 新增键：`micDenied`（麦克风权限被拒绝）、`networkError`（网络错误）、`noSpeech`（未检测到语音）
  - `voice.js` 的 `onerror` 映射 `event.error` → 错误类型字符串
  - `app.js` 的 `onStateChange` 收到 `error` 状态时，在 `voiceHint` 显示对应 i18n 文案，加红色样式 `.voice-hint.error`
- **验证**: 拒绝麦克风权限 → 显示提示文案；断网后尝试 → 显示网络错误提示

### 2.3 日历周起始日本地化

- **文件**: `src/public/js/i18n/zh-CN.js`, `en-US.js`, `ja-JP.js` + `src/public/js/calendar-ui.js` — `renderMonth()`
- **问题**: 日历硬编码周日为第一天，中文/日文习惯周一起始
- **方案**:
  - i18n 新增 `weekStartDay` 键：`zh-CN` = `1`（周一），`en-US` = `0`（周日），`ja-JP` = `1`（周一）
  - `renderMonth()` 读取 `I18n.t('weekStartDay')`，据此偏移 `dayNames` 数组和日期起始偏移量
  - `renderWeek()` 同步调整起始日
- **验证**: 中文模式周一为第一列；英文模式周日为第一列

### 2.4 日历点击联动侧边栏

- **文件**: `src/public/js/event-panel.js`, `src/public/js/calendar-ui.js` — `bindCellEvents()`
- **问题**: 侧边栏固定显示"今日安排"，点击日历日期不更新
- **方案**:
  - `EventPanel` 新增 `loadDateEvents(dateStr)` 方法，查询指定日期事件并更新列表
  - 标题动态显示选中日期（如"5 月 30 日 周六"）
  - 日历格子单击 → 调用 `loadDateEvents(dateStr)`
  - 双击或点空白区域 → 打开新建事件 Modal
- **验证**: 点击日历不同日期 → 侧边栏标题和事件列表跟随切换

### 2.5 API 错误处理 + 超时

- **文件**: `src/public/js/api.js`
- **问题**: 所有 fetch 调用无 `res.ok` 检查、无超时、无重试，失败直接抛异常
- **方案**:
  - 封装 `request(url, options)` 函数
  - `AbortController` 实现 15 秒超时
  - 检查 `res.ok`，非 200 时解析 error message 并抛出
  - 所有方法（`getEvents`, `createEvent`, `parseVoice` 等）改用此封装
  - 调用失败时在状态栏显示错误提示
- **验证**: 断开后端 → 发起请求 → 15 秒后状态栏显示超时提示，页面不崩溃

### 2.6 输入校验 + 频率限制

- **文件**: `src/routes/voice.js`, `src/routes/events.js`
- **方案**:
  - 安装 `express-rate-limit`
  - `/api/voice/parse` 限 20 次/分钟/IP
  - `/api/events` POST/PUT/DELETE 限 60 次/分钟/IP
  - 校验：`text` 长度 1-500 字符，`language` 白名单 `['zh-CN','en-US','ja-JP']`，`title` 非空，`start_time` 合法 ISO 格式
- **验证**: 快速连续发送 25 次请求 → 第 21 次返回 429；发送空 text → 返回 400

### 2.7 提醒音效

- **文件**: `src/public/js/app.js` — `setupReminders()`
- **方案**:
  - 在 `src/public/assets/` 放一个简短提示音 mp3（可从免费音效库获取）
  - 提醒触发时先 `new Audio('/assets/ding.mp3').play()`，再弹出通知和 TTS
  - 状态栏显示"即将到来：1 个提醒"计数
- **验证**: 创建一个 1 分钟后提醒的事件 → 到期后听到提示音 + 收到通知 + 听到语音播报

---

## Phase 3: v2.0 核心 — 多轮对话 + 冲突检测

> 对应 PRD Roadmap "v2.0" 前 3 项。目标：从单轮工具升级为具备上下文理解的 Agent。

### 3.1 创建对话状态存储

- **新建文件**: `src/services/conversation.js`
- **方案**:
  - 内存 `Map<sessionId, { history: Message[], pendingAction, lastActivity }>` 
  - `sessionId` 由前端生成 UUID，每次请求携带
  - history 上限 20 条（超出截断最早的消息）
  - 30 分钟无活动自动清理
  - 5 分钟定时扫描清理过期会话
- **限制**: 内存存储，服务重启丢失进行中的对话。当前单用户场景可接受
- **验证**: 重启服务 → 之前的对话上下文丢失，但不影响已有事件数据

### 3.2 后端上下文注入

- **文件**: `src/routes/voice.js` — `/parse` handler, `src/ai/parser.js`
- **方案**:
  - `/parse` 接收 `sessionId`，从 conversation 存储获取状态
  - 将最近 6 条 history 作为 messages 注入 LLM 调用（在 system prompt 和 user message 之间）
  - LLM 返回后更新 history（push 用户消息 + 助手回复）
  - system prompt 增加上下文指令：处理"改到 3 点""算了""好的"等指代表达时参考 history 中的 pending_action
- **Token 控制**: history 注入前估算 token 数（按 1 字符 ≈ 0.5 token 粗算），超过 2000 token 时截断最早的消息
- **验证**: 说"明天加个会" → 解析 → 说"改到下午三点" → 系统理解是修改刚才的事件时间

### 3.3 前端会话管理

- **文件**: `src/public/js/api.js`, `src/public/js/event-panel.js`, `src/public/js/app.js`
- **方案**:
  - `api.js` 生成并持久化 `sessionId`（UUID v4，存 localStorage）
  - 每次 `/api/voice/parse` 请求携带 `sessionId`
  - 处理 LLM 返回的 `confirm` intent → 自动执行 pending action
  - 处理 `cancel` intent → 清除 pending action
  - 处理 follow-up 修改（如"改到 4 点"）→ 合并到已有 pending action 的 params（只更新 changed 字段）
- **验证**: "加个会" → "改到4点" → "好的" 完整三步流程走通

### 3.4 事件重叠检测

- **文件**: `src/db/event-dao.js`
- **方案**:
  - 新增 `findOverlapping(startTime, endTime, excludeId)` 方法
  - SQL: `SELECT * FROM events WHERE start_time < ? AND end_time > ? AND id != ?`
  - 处理边界：`end_time` 为 null 时（无结束时间）视为 1 小时 duration
  - 处理全天事件：`all_day = 1` 时按日期比较
- **验证**: 创建 14:00-15:00 事件 → 再创建 14:30-15:30 事件 → 检测到重叠

### 3.5 冲突检测集成到语音流程

- **文件**: `src/routes/voice.js` — `/parse` handler, `src/public/js/event-panel.js`
- **方案**:
  - `add_event` 解析成功后调用 `findOverlapping` 检测
  - 有冲突时在 response 中附加 `conflicts` 数组 + 警告文本
  - 前端解析卡片显示冲突事件列表（黄色警告样式）
  - 提供"仍然确认"和"取消"两个按钮
- **验证**: 已有 14:00-15:00 会议 → 语音创建 14:30-15:30 会议 → 卡片显示冲突警告 → 点"仍然确认"可强制创建

### 3.6 智能时间段建议

- **文件**: `src/db/event-dao.js`, `src/routes/voice.js`
- **方案**:
  - 新增 `findFreeSlots(date, workStart, workEnd, durationMinutes)` 方法
  - 查询指定日期所有事件，计算空闲时段
  - 返回最多 3 个可容纳目标 duration 的空闲时段
  - 冲突时在 response 中附加 `suggestions` 数组
  - 前端显示为可点击选项，点击后自动填入新时间
- **验证**: 9-10 有会议 → 创建 9:30-10:30 事件触发冲突 → 建议显示"10:00-11:00 可用"

### 3.7 智能提醒默认值

- **文件**: `src/ai/parser.js` — system prompt
- **方案**:
  - prompt 增加规则：根据事件类型自动建议 reminder_minutes
  - 规则：包含"会议/评审/面试"→ 15 分钟；包含"就医/看病"→ 60 分钟；全天事件 → 当天 9:00；包含"吃药/吃药"→ 5 分钟；默认 → 15 分钟
  - 用户在指令中明确指定时间时（"提前半小时提醒"）覆盖默认值
- **验证**: "明天下午两点去看牙" → reminder_minutes 自动设为 60

---

## Phase 4: v2.0 打磨 — 数据可靠性 + 提醒完善

### 4.1 数据库防抖保存

- **文件**: `src/db/init.js`, `src/db/event-dao.js`
- **问题**: 每次写操作都同步 `writeFileSync`，创建带提醒的事件触发 2 次全量序列化
- **方案**:
  - `save()` 改为 `scheduleSave()`：500ms 防抖，合并短时间内多次写入
  - 增加 10 秒定时 `flushSave` 兜底
  - `closeDatabase()` 时强制 flush
  - `event-dao.js` 的 `run()` 改调 `scheduleSave()`
- **验证**: 连续快速创建 5 个事件 → 数据库文件只写入 1-2 次，所有数据完整

### 4.2 update_event 候选匹配

- **文件**: `src/routes/voice.js`, `src/public/js/event-panel.js`
- **问题**: delete_event 有候选匹配逻辑，update_event 没有
- **方案**:
  - 为 update_event 添加同样的日期+关键词查找逻辑
  - 多匹配时返回 `confirm_update` intent + candidates 数组
  - `event-panel.js` 增加 `confirm_update` 处理（和 `confirm_delete` 同理）
- **验证**: "把明天的会改到4点" 但明天有 3 个会 → 列出候选 → 选择后更新

### 4.3 confirm/cancel 服务端支持

- **文件**: `src/routes/voice.js` — execute handler switch
- **问题**: confirm/cancel intent 走到 default 返回 400
- **方案**:
  - switch 中增加 `confirm` case → 返回 `{ success: true, action: 'confirmed' }`
  - switch 中增加 `cancel` case → 返回 `{ success: true, action: 'cancelled' }`
- **验证**: 多轮对话中 LLM 返回 confirm intent → execute 不报错

### 4.4 提醒管理完善

- **文件**: `src/services/reminder.js`, `src/public/js/app.js`
- **方案**:
  - 修复离线丢失问题：提醒触发时若无 WebSocket 客户端，暂不标记 `notified`，下次检查时重试
  - 状态栏显示即将到来提醒数量
  - 浏览器通知增加"稍后提醒"按钮（点击后 5 分钟重新创建一条 reminder 记录）
- **验证**: 创建提醒 → 关闭浏览器 → 提醒到期 → 重新打开浏览器 → 收到通知

---

## 实施顺序

```
Phase 1（v1.0 补完，可并行，约 1-2 天）:
  1.1 CSS class 修复 ──┐
  1.2 事件加载范围     ├── 均改 calendar-ui.js，按顺序执行
  1.3 解析卡片可编辑       改 event-panel.js，独立
  1.4 设置页面联动         改 routes + api.js，独立

Phase 2（v1.1 体验，大部分可并行，约 2-3 天）:
  2.1 语音按钮修复         改 app.js
  2.2 语音错误反馈         改 voice.js + app.js + i18n
  2.3 周起始日             改 i18n + calendar-ui.js
  2.4 日期联动             改 event-panel.js + calendar-ui.js（依赖 2.3）
  2.5 API 错误处理         改 api.js（独立）
  2.6 输入校验限流         改 routes（独立）
  2.7 提醒音效             改 app.js + 新增静态资源（独立）

Phase 3（v2.0 核心，顺序依赖，约 3-4 天）:
  3.1 对话存储 → 3.2 后端上下文 → 3.3 前端会话
                  3.4 重叠检测 → 3.5 冲突集成 → 3.6 时间建议
                  3.7 智能提醒默认值（独立，仅改 prompt）

Phase 4（v2.0 打磨，大部分并行，约 1-2 天）:
  4.1 防抖保存
  4.2 update 候选匹配（依赖 3.2）
  4.3 confirm/cancel 支持（依赖 3.2）
  4.4 提醒管理完善
```

## 关键文件清单

| 文件 | 涉及任务 |
|------|---------|
| `src/public/js/calendar-ui.js` | 1.1, 1.2, 2.3, 2.4 |
| `src/public/js/event-panel.js` | 1.3, 2.4, 3.3, 3.5 |
| `src/public/js/app.js` | 1.4, 2.1, 2.2, 2.4, 2.7, 3.3, 4.4 |
| `src/routes/voice.js` | 1.4, 2.6, 3.2, 3.5, 3.6, 4.2, 4.3 |
| `src/public/js/api.js` | 1.4, 2.5, 3.3 |
| `src/public/js/voice.js` | 2.1, 2.2 |
| `src/ai/parser.js` | 3.2, 3.7 |
| `src/db/event-dao.js` | 3.4, 3.6, 4.1 |
| `src/db/init.js` | 4.1 |
| `src/services/reminder.js` | 4.4 |
| `src/services/conversation.js`（新建） | 3.1 |
| `src/routes/settings.js`（新建） | 1.4 |
| `src/public/js/i18n/*.js` | 2.2, 2.3 |

## 验证方案

### 手动测试清单（每阶段必过）

**Phase 1 验收：**
- [ ] 月→周→日→月反复切换，布局无错乱
- [ ] 导航到月末周，跨月事件全部显示
- [ ] 解析事件后修改标题和时间，确认后数据正确
- [ ] 前端设置页改 Model → 保存 → 重新打开值正确 → 语音解析使用新模型

**Phase 2 验收：**
- [ ] 短按（< 300ms）toggle，长按松开停止，触摸设备正常
- [ ] 拒绝麦克风权限 → 看到提示文案
- [ ] 中文模式周一起始，英文模式周日起始
- [ ] 点击日历日期 → 侧边栏标题和事件列表更新
- [ ] 断开后端 → 15 秒后状态栏显示超时
- [ ] 连续发送 25 次请求 → 被限流
- [ ] 提醒触发时听到提示音

**Phase 3 验收：**
- [ ] "加个会" → "改到下午 4 点" → "好的" 三步流程
- [ ] "算了" 可取消 pending 操作
- [ ] 创建时间重叠事件 → 看到冲突警告 → 可强制创建
- [ ] 冲突时显示替代时间段建议，点击可选用
- [ ] "明天去看牙" → reminder_minutes 自动为 60

**Phase 4 验收：**
- [ ] 快速创建 5 个事件 → 数据库只写入 1-2 次，数据完整
- [ ] "把明天的会改到4点" + 多候选 → 列表选择后更新成功
- [ ] 关闭浏览器期间触发的提醒，重新打开后可收到

### 端到端场景

1. 完整创建链路：按住麦克风 → "明天下午三点产品评审" → 看到解析卡片 → 修改时间为 3:30 → 确认 → 日历显示事件 → 到期前收到提醒（通知+音效+语音）
2. 完整查询链路："今天有什么安排" → 语音播报事件列表 → "把第一个改到4点" → 确认 → 日历更新
3. 冲突处理链路：已有 14:00-15:00 会议 → "明天下午两点半开个会" → 冲突警告 → 点击建议的 15:00-16:00 → 确认创建
