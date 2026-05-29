# Voice Calendar 语音日历 - 产品开发规格文档

> 基于《产品分析报告》制定，所有细节直接对接开发实现。

---

## 一、功能规格清单（按优先级排序）

### P0 - 核心路径（MVP 必须完成）

| 编号 | 功能 | 描述 | 验收标准 |
|------|------|------|---------|
| F-01 | 语音识别输入 | 用户按住麦克风说话，松开后识别为文字 | 中/英识别准确率 >90%，中间结果实时显示 |
| F-02 | AI 指令解析 | 将语音文字发送 LLM，返回结构化操作意图 | 支持 add/delete/update/query 4种意图 |
| F-03 | 创建事件 | 解析 "明天下午两点开会" → 自动填入标题、时间 | 标题+开始时间自动提取，结束时间默认+1h |
| F-04 | 删除事件 | "删掉明天的会议" → 确认后删除 | 歧义时列出候选事件让用户确认 |
| F-05 | 查看事件 | "今天有什么安排" → 返回当日事件列表 | 无事件时回复"今天没有安排" |
| F-06 | 月视图日历 | 可视化月历，事件以色块显示在日期格内 | 可点击切换月份，点击日期查看当日事件 |
| F-07 | 事件 CRUD API | 后端 RESTful 接口 | GET/POST/PUT/DELETE 全部可用 |

### P1 - 增强体验

| 编号 | 功能 | 描述 | 验收标准 |
|------|------|------|---------|
| F-08 | 修改事件 | "把下午的会改到4点" → 更新事件时间 | 仅更新被修改字段，其他保留 |
| F-09 | 浏览器提醒通知 | 事件到期前 N 分钟弹出浏览器通知 | 需用户授权 Notification 权限 |
| F-10 | 语音播报反馈 | 操作完成后用语音说出结果 | "已为您添加明天下午两点的产品评审" |
| F-11 | 周/日视图 | 切换到周视图、日视图查看 | 三种视图无缝切换 |
| F-12 | 手动创建事件 | 点击日历空白区域弹出表单手动添加 | 表单字段：标题、开始/结束时间、描述、提醒 |

### P2 - 扩展能力

| 编号 | 功能 | 描述 | 验收标准 |
|------|------|------|---------|
| F-13 | 日语支持 | 界面和语音识别增加日语 | 界面文案+语音识别语言 |
| F-14 | 设置页面 | API 配置、语言切换、提醒默认时间 | 设置持久化到 localStorage |
| F-15 | 事件搜索 | "找一下上周的评审会议" → 模糊搜索 | 支持按标题/日期范围搜索 |

---

## 二、交互流程设计

### 2.1 语音操作主流程

```
用户按下麦克风
    │
    ▼
[语音识别中...] 实时显示中间文字
    │
    ▼
识别完成 → 显示识别文本 "明天下午两点到三点半产品评审会议"
    │
    ▼
发送到后端 /api/voice/parse
    │
    ▼
后端调用 LLM 解析 → 返回结构化结果
    {
      intent: "add_event",
      params: {
        title: "产品评审会议",
        start_time: "2026-05-30T14:00:00",
        end_time: "2026-05-30T15:30:00"
      },
      reply: "已为您安排明天下午2点到3点半的产品评审会议，是否确认？"
    }
    │
    ▼
前端显示解析结果卡片 + 语音播报 reply
    │
    ├── [用户确认] → 执行操作 → 日历刷新 → "已添加"
    ├── [用户修改] → "改为后天同一时间" → 重新解析并更新
    └── [用户取消] → 放弃操作
```

### 2.2 歧义处理流程

```
用户: "删掉明天的会"
    │
    ▼
LLM 解析: intent=delete_event, date=明天, 但明天有3个事件
    │
    ▼
后端返回: intent=confirm_delete, candidates=[...3个事件...]
    │
    ▼
前端展示候选列表:
  1. 09:00 站会
  2. 14:00 产品评审
  3. 16:30 1on1
    │
    ▼
用户说 "第二个" 或点击选择 → 执行删除
```

### 2.3 查询流程

```
用户: "今天有什么安排"
    │
    ▼
LLM 解析: intent=query_events, date=今天
    │
    ▼
后端查询 → 返回事件列表
    │
    ▼
前端:
  - 侧边栏显示事件列表
  - 语音播报: "今天有3个安排：9点站会，下午2点产品评审，4点半一对一"
```

---

## 三、UI 布局设计

### 3.1 主页面布局

```
┌─────────────────────────────────────────────────────┐
│  🎤 Voice Calendar          [月▼] [中/EN/日本語] [⚙] │  ← 顶栏
├───────────────────────────────────┬─────────────────┤
│                                   │                 │
│                                   │   🎤 按住说话    │  ← 语音按钮区
│         月 历 视 图                │   ───────────   │
│                                   │                 │
│   ◀ 2026年5月 ▶                  │   识别结果:      │
│   日 一 二 三 四 五 六            │   "明天下午两点    │  ← 结果展示区
│   1  2  3  4  5  6  7            │    产品评审"     │
│   8  9  10 11 12 13 14           │                 │
│   15 16 17 18 19 [20] 21         │   意图: 添加事件  │  ← 解析卡片
│   22 23 24 25 26 27 28           │   标题: 产品评审  │
│   29 30 31                       │   时间: 明天14:00 │
│                                   │   [✓确认] [✗取消] │
│   ██ = 有事件的日期               │                 │
│                                   │   ───────────   │
│                                   │                 │
│                                   │   📋 今日安排     │  ← 事件列表
│                                   │   • 09:00 站会   │
│                                   │   • 14:00 评审   │
│                                   │   • 16:30 1on1   │
│                                   │                 │
├───────────────────────────────────┴─────────────────┤
│  状态: 已连接 | 提醒: 1个即将到来                      │  ← 底栏
└─────────────────────────────────────────────────────┘
```

### 3.2 关键 UI 规格

| 元素 | 规格 |
|------|------|
| 整体宽度 | 左侧日历 70%，右侧面板 30%（min-width 320px） |
| 语音按钮 | 直径 80px 圆形，按下时脉冲动画，渐变色 |
| 日历格子 | 最小高度 80px，事件显示为小色块（可显示2-3个，超出显示+N） |
| 事件颜色 | 默认蓝 #4A90D9，可选：绿/橙/红/紫 |
| 字体 | 中文: "PingFang SC", "Microsoft YaHei"; 英文: "Inter" |
| 响应式 | <768px 右侧面板折叠到底部，语音按钮固定底部居中 |
| 深色模式 | 支持 light/dark 两套主题 |

---

## 四、数据库设计

### 4.1 events 表

```sql
CREATE TABLE events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  title           TEXT    NOT NULL,
  description     TEXT    DEFAULT '',
  start_time      TEXT    NOT NULL,           -- ISO 8601: "2026-05-30T14:00:00"
  end_time        TEXT,                       -- ISO 8601, 可空=无结束时间
  all_day         INTEGER DEFAULT 0,          -- 0=精确时间, 1=全天事件
  reminder_minutes INTEGER DEFAULT 0,         -- 提前多少分钟提醒，0=不提醒
  color           TEXT    DEFAULT '#4A90D9',  -- 事件颜色
  recurrence_rule TEXT    DEFAULT NULL,        -- iCalendar RRULE 格式，如 "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"
  source          TEXT    DEFAULT 'voice',    -- voice | manual
  created_at      TEXT    DEFAULT (datetime('now', 'localtime')),
  updated_at      TEXT    DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX idx_events_start ON events(start_time);
CREATE INDEX idx_events_end ON events(end_time);
```

### 4.2 reminders 表（提醒队列）

```sql
CREATE TABLE reminders (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id  INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  remind_at TEXT    NOT NULL,                  -- ISO 8601: 实际提醒时间
  notified  INTEGER DEFAULT 0,                 -- 0=未通知, 1=已通知
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX idx_reminders_at ON reminders(remind_at);
CREATE INDEX idx_reminders_notified ON reminders(notified);
```

---

## 五、API 设计

### 5.1 事件 CRUD

| 方法 | 路径 | 请求体 | 响应 |
|------|------|--------|------|
| GET | `/api/events?start=2026-05-01&end=2026-05-31` | - | `{ events: [...] }` |
| GET | `/api/events/:id` | - | `{ event: {...} }` |
| POST | `/api/events` | `{ title, start_time, end_time?, description?, reminder_minutes?, color? }` | `{ event: {...} }` |
| PUT | `/api/events/:id` | `{ title?, start_time?, end_time?, ... }` | `{ event: {...} }` |
| DELETE | `/api/events/:id` | - | `{ success: true }` |

### 5.2 语音指令解析

**POST `/api/voice/parse`**

请求：
```json
{
  "text": "明天下午两点到三点半产品评审会议",
  "language": "zh-CN",
  "context": {
    "today": "2026-05-29",
    "pending_action": null
  }
}
```

响应：
```json
{
  "intent": "add_event",
  "params": {
    "title": "产品评审会议",
    "start_time": "2026-05-30T14:00:00",
    "end_time": "2026-05-30T15:30:00",
    "reminder_minutes": 15
  },
  "reply": "已为您安排明天下午2点到3点半的产品评审会议，是否确认？",
  "needs_confirm": true
}
```

**歧义响应示例：**
```json
{
  "intent": "confirm_delete",
  "params": {
    "candidates": [
      { "id": 12, "title": "站会", "start_time": "2026-05-30T09:00:00" },
      { "id": 15, "title": "产品评审", "start_time": "2026-05-30T14:00:00" },
      { "id": 18, "title": "1on1", "start_time": "2026-05-30T16:30:00" }
    ]
  },
  "reply": "明天有3个安排，请问您要删除哪一个？",
  "needs_confirm": true
}
```

### 5.3 响应状态码

| 状态码 | 含义 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 404 | 事件不存在 |
| 500 | 服务端错误 |

---

## 六、AI Prompt 工程

### 6.1 System Prompt

```
你是一个日历助手的指令解析器。你的任务是将用户的自然语言输入解析为结构化的 JSON 操作。

当前日期时间: {current_datetime}
用户语言: {language}

## 支持的意图类型

1. add_event - 创建事件
2. delete_event - 删除事件（需提供事件标识）
3. update_event - 修改事件（需提供事件标识和修改内容）
4. query_events - 查询事件
5. confirm - 用户确认上一步操作（传入 "yes"/"好的"/"确认" 等）
6. cancel - 用户取消操作
7. unclear - 无法理解

## 输出格式（严格 JSON）

{
  "intent": "add_event",
  "params": {
    "title": "事件标题",
    "start_time": "ISO8601 格式",
    "end_time": "ISO8601 或 null",
    "all_day": false,
    "description": "描述或空字符串",
    "reminder_minutes": 15,
    "recurrence_rule": "RRULE字符串或null"
  },
  "reply": "用自然语言回复用户，确认你的理解",
  "needs_confirm": true
}

## 时间解析规则

- "明天" → 当前日期+1天
- "下周三" → 下一个周三
- "下午两点"/"2pm" → 14:00
- "上午" → 默认 09:00
- "下午"/"晚上" 无具体时间 → 默认 14:00 / 19:00
- 有开始无结束 → 默认持续1小时
- "每天/每周/工作日" → 生成 recurrence_rule

## 查询类

query_events 的 params:
{
  "start_date": "ISO8601",
  "end_date": "ISO8601",
  "keyword": "搜索关键词或null"
}

## 歧义处理

如果用户说 "删掉明天的会议" 但你没有事件列表信息，设置:
- intent: "delete_event"
- params: { "date": "2026-05-30", "keyword": "会议" }
- reply: 说明需要进一步确认
- needs_confirm: true

## 重要约束

- 所有时间输出为 ISO 8601 格式
- reply 使用与用户相同的语言
- 不确定的字段设为 null
- 始终设置 needs_confirm 为 true（除 query 外）
```

### 6.2 上下文管理

前端维护一个 `pendingAction` 状态：

```javascript
// 状态机
const voiceState = {
  idle: 'idle',           // 空闲，等待语音输入
  listening: 'listening', // 正在录音
  parsing: 'parsing',     // 正在解析
  confirming: 'confirming', // 等待用户确认
  executing: 'executing',  // 正在执行
};

// 确认状态下，下次语音输入会带上 pendingAction
// 如: 用户说 "好的" → intent=confirm → 自动执行 pendingAction
```

---

## 七、多语言架构

### 7.1 翻译文件结构

```javascript
// src/public/js/i18n/zh-CN.js
module.exports = {
  // 界面文案
  ui: {
    appTitle: '语音日历',
    monthNames: ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'],
    dayNames: ['日','一','二','三','四','五','六'],
    today: '今天',
    holdToSpeak: '按住说话',
    listening: '正在聆听...',
    confirm: '确认',
    cancel: '取消',
    noEvents: '暂无安排',
    settings: '设置',
  },
  // 语音识别语言代码
  speechLang: 'zh-CN',
  // 系统提示词的语言版本标识
  langCode: 'zh-CN',
};
```

### 7.2 切换机制

- 前端：URL 参数 `?lang=en-US` + localStorage 持久化
- 语音识别：切换 `recognition.lang` 属性
- AI 解析：在 system prompt 中传入 `language` 参数
- 语音播报：切换 `speechSynthesis.voice` 的语言

---

## 八、项目目录结构

```
E:/voice-calendar/
├── package.json
├── .env.example                    # 环境变量模板
├── server.js                       # Express 入口，启动服务
├── src/
│   ├── ai/
│   │   └── parser.js               # LLM 调用 + prompt 管理
│   ├── db/
│   │   ├── init.js                 # 建表、初始数据
│   │   ├── event-dao.js            # 事件增删改查
│   │   └── reminder-dao.js         # 提醒记录管理
│   ├── routes/
│   │   ├── events.js               # /api/events/*
│   │   └── voice.js                # /api/voice/parse
│   ├── services/
│   │   └── reminder.js             # 定时检查 + WebSocket 推送
│   └── public/
│       ├── index.html              # 单页应用主页面
│       ├── css/
│       │   ├── style.css           # 主样式
│       │   ├── calendar.css        # 日历组件样式
│       │   ├── voice.css           # 语音按钮动画样式
│       │   └── theme.css           # 深色/浅色主题
│       └── js/
│           ├── app.js              # 应用入口 + 路由
│           ├── voice.js            # 语音识别 + 状态机
│           ├── calendar-ui.js      # 月/周/日视图渲染
│           ├── event-panel.js      # 右侧面板（结果+列表）
│           ├── api.js              # 后端 API 调用封装
│           ├── tts.js              # 语音播报（SpeechSynthesis）
│           ├── i18n.js             # 国际化引擎
│           └── i18n/
│               ├── zh-CN.js        # 中文翻译
│               ├── en-US.js        # 英文翻译
│               └── ja-JP.js        # 日文翻译
```

---

## 九、开发阶段分解

### Phase 1: 基础骨架（预计 2-3 天）

| 任务 | 产出 |
|------|------|
| 初始化项目、安装依赖 | package.json + 目录结构 |
| 数据库建表 + DAO 层 | init.js, event-dao.js |
| 事件 CRUD API | routes/events.js |
| 静态页面搭建 | index.html + CSS 骨架 |
| 日历月视图渲染 | calendar-ui.js |

### Phase 2: 语音核心（预计 2-3 天）

| 任务 | 产出 |
|------|------|
| AI 解析服务 | ai/parser.js + prompt |
| 语音指令 API | routes/voice.js |
| 前端语音识别模块 | voice.js + 状态机 |
| 语音播报模块 | tts.js |
| 解析结果卡片 UI | event-panel.js |

### Phase 3: 完整体验（预计 1-2 天）

| 任务 | 产出 |
|------|------|
| 提醒服务 + WebSocket | services/reminder.js |
| 浏览器通知集成 | Notification API |
| 周/日视图 | calendar-ui.js 扩展 |
| 多语言支持 | i18n.js + 翻译文件 |
| 深色模式 | theme.css |
| .env 配置 + 设置页面 | 设置面板 |

### Phase 4: 打磨（预计 1 天）

| 任务 | 产出 |
|------|------|
| 响应式适配 | 移动端布局 |
| 错误处理与边界 case | 歧义处理、网络异常 |
| 整体测试 | 端到端验证 |

---

## 十、测试验收用例

### 核心路径测试

| 编号 | 测试场景 | 输入语音 | 预期结果 |
|------|---------|---------|---------|
| T-01 | 中文创建简单事件 | "明天下午三点开会" | 创建事件，标题=开会，时间=明天15:00 |
| T-02 | 中文创建复杂事件 | "下周一到周五每天早上9点站会" | 创建重复事件，RRULE=FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR |
| T-03 | 英文创建事件 | "Schedule a meeting tomorrow at 2pm" | 创建事件，语言切换无影响 |
| T-04 | 删除事件（无歧义） | "删掉今天下午的站会" | 找到唯一匹配，确认后删除 |
| T-05 | 删除事件（有歧义） | "删掉明天的会"（明天有3个） | 列出候选，等待用户选择 |
| T-06 | 查询事件 | "今天有什么安排" | 语音播报+文字展示事件列表 |
| T-07 | 修改事件 | "把明天的会改到后天" | 更新事件日期 |
| T-08 | 提醒触发 | 创建一个1分钟后的事件 | 1分钟内收到浏览器通知 |
| T-09 | 无效输入 | "今天天气怎么样" | 回复"这不是日历相关操作" |
| T-10 | 取消操作 | 确认阶段说"算了" | 取消操作，回到空闲状态 |

---

## 十一、环境配置

### .env.example

```env
# 服务端口
PORT=3000

# OpenAI 兼容 API 配置
AI_API_KEY=your-api-key-here
AI_API_BASE=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini

# 数据库路径
DB_PATH=./data/calendar.db

# 提醒检查间隔（秒）
REMINDER_INTERVAL=30
```
