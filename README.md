# Voice Calendar — AI 语音日历

> **"说了就算"** — 用一句话创建、管理你的全部日程。
> 语音是它的主要交互方式，AI 是它的理解引擎。

---

## 为什么做这个产品

人们每天口头约定大量日程，但传统日历 App 的输入路径是：

> 解锁 → 打开应用 → 点「+」→ 填标题 → 选日期 → 选时间 → 填地点 → 保存

至少 8 步操作。开车、做饭、走路时根本不可用。

Voice Calendar 用一句话替代八步操作：只需说"明天下午三点和小张聊项目"，系统自动提取时间、事件并创建日程。

### 市场空白

| 事实 | 说明 |
|------|------|
| 主流竞品不支持中文 | Fantastical、Motion、Morgen 的自然语言解析仅支持英语 |
| 平台助手能力有限 | Siri/小爱只能处理简单指令，无法理解"工作日每天早上九点站会" |
| 语音优先产品稀缺 | 目前仅有 0sec (iOS) 是纯 voice-first 日历，且仅支持英语 |
| 国内无对标产品 | 搜索"语音日历"无专注该品类的独立产品 |

---

## 目标用户

### 核心用户

**高效能职场人** — 日均 5-8 个会议，日程变动频繁。开车/走路时突然想到要加日程，打字操作繁琐。核心诉求：一句话完成日程录入。

**银发族** — 需要记药时间、社区活动、子女拜访。不会打字或打字很慢，日历 App 界面复杂。核心诉求：像说话一样自然地管理日程。

**学生 / 自由职业者** — 日程来源碎片化（口头约定、临时通知），手动整理耗时。核心诉求：语音快速捕获，智能理解"大后天""下周三四"等模糊表达。

### 次要用户

- **车载 / 运动场景用户** — 免提操作是安全刚需
- **家庭管理者** — 统筹全家日程（孩子课外班、老人就医）

---

## 产品定位与演进

Voice Calendar 定位为**语音优先的日历管理工具**，当前处于 L2 阶段。

```
L1: 语音输入 → AI 转日历事件（完成 ✅）
L2: 语音输入 + 多轮对话 + 冲突检测 + 日历视图（完成 ✅）
L3: 个人效率 Agent + 主动建议 + 双向同步（探索中 🔄）
```

---

## 核心功能

### 语音交互
- 🎤 一句话创建/查询/删除/修改日程
- 💬 多轮对话，支持上下文记忆（6 条历史）
- 🔊 语音播报操作结果（TTS）
- 🔄 实时语音识别中转文字预览

### AI 驱动
- 🧠 智能自然语言解析（支持模糊表达）
- ⚡ 冲突检测 + 替代时间段建议
- 📋 删除歧义处理（候选列表）
- 📱 移动端原生录音（Capacitor Android App）

### 日历管理
- 📅 月/周/日三种视图
- 🎨 自定义事件颜色
- 🔔 轮询提醒 + 浏览器通知 + 语音播报
- 📤 ICS 导出（单事件 + 批量）
- 🌙 深色模式 + 多语言（中文/English/日本語）

---

## 技术架构

```
┌─────────────────────────────────────────────────┐
│                  Frontend                        │
│  Vanilla JS + Capacitor WebView                  │
│  voice.js → Native Plugin → Android Recorder    │
├─────────────────────────────────────────────────┤
│                  Backend (Node.js)               │
│  Express + SQLite + WebSocket                    │
│  AI: OpenAI-compatible API (DeepSeek/GLM/etc)   │
│  STT: Alibaba Cloud NLS / OpenAI Whisper        │
├─────────────────────────────────────────────────┤
│              Android Native (Capacitor)          │
│  MediaRecorder → base64 audio → Server STT      │
│  Permissions: RECORD_AUDIO, INTERNET            │
└─────────────────────────────────────────────────┘
```

---

## 快速开始

### 前置要求

- Node.js 18+
- npm 9+

### 本地运行

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入 AI_API_KEY 和 AI_API_BASE

# 3. 启动服务
node server.js
```

终端输出：

```
Voice Calendar running at http://localhost:3000
Mobile access:  http://192.168.x.x:3000
```

电脑浏览器打开 `http://localhost:3000`。

### Docker 部署

```bash
# 构建镜像
docker build -t voice-calendar .

# 启动容器
docker run -d --name voice-calendar -p 3000:3000 --restart unless-stopped voice-calendar
```

### Android 原生 App

项目通过 Capacitor 8 打包为 Android 原生应用，集成原生录音功能：

```bash
# 1. 安装 Capacitor 依赖
npm install

# 2. 同步 Web 资源
npx cap sync android

# 3. 配置远程后端（编辑 capacitor.config.json）
# "server": { "url": "http://YOUR_SERVER_IP:3000", "cleartext": true }

# 4. 构建 APK
cd android && ./gradlew assembleDebug

# 5. APK 位于 android/app/build/outputs/apk/debug/app-debug.apk
```

> **注意：** 构建前确保 `android/app/src/main/assets/capacitor.plugins.json` 包含自定义插件注册：
> ```json
> [{ "classpath": "com.voicecalendar.app.speechrecognition.NativeSpeechRecognitionPlugin" }]
> ```

### 使用语音

**桌面端（Web Speech API）：**
1. 点击麦克风按钮
2. 说出指令
3. 查看解析卡片，可修改字段后确认

**Android 端（原生录音）：**
1. 按住麦克风按钮说话
2. 松开后自动发送到后端做语音识别
3. 查看解析卡片，确认后添加到日历

### 导出到手机日历

1. 点击任意事件 → 弹窗底部点「导出到日历」→ 下载 `.ics` 文件
2. 手机打开 `.ics` 文件 → 自动导入系统日历
3. 导入后手机会在设定时间原生提醒

---

## 支持的语音指令

### 创建事件
- "明天下午两点开会"
- "后天上午十点产品评审会议"
- "每周一到周五早上九点站会"
- "明天去看牙"（自动设置 60 分钟提前提醒）
- "Schedule a meeting tomorrow at 3pm"

### 多轮对话
- "加个周五的评审会" → "改到下午四点" → "好的"
- "明天加个会" → "算了"（取消）

### 查询/删除/修改
- "今天有什么安排" / "这周有什么事"
- "删除下午的会" / "把评审会改到三点"

---

## API 接口

### 事件 CRUD

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/events?start=&end=` | 获取日期范围内事件 |
| `GET` | `/api/events/:id` | 获取单个事件 |
| `POST` | `/api/events` | 创建事件 |
| `PUT` | `/api/events/:id` | 更新事件 |
| `DELETE` | `/api/events/:id` | 删除事件 |

### 语音指令

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/voice/speech-to-text` | 语音转文字（阿里云 ASR） |
| `POST` | `/api/voice/parse` | NLP 解析语音文字 |
| `POST` | `/api/voice/execute` | 执行已确认的操作 |

### ICS 导出

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/events/:id/ics` | 导出单个 .ics 文件 |
| `GET` | `/api/events/export/ics?start=&end=` | 批量导出 .ics 文件 |

---

## 配置项

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | 服务端口 |
| `AI_API_KEY` | - | LLM API 密钥（必填） |
| `AI_API_BASE` | `https://api.openai.com/v1` | API 基础地址 |
| `AI_MODEL` | `gpt-4o-mini` | 模型名称 |
| `DB_PATH` | `./data/calendar.db` | 数据库路径 |
| `REMINDER_INTERVAL` | `30` | 提醒间隔（秒） |

> 配置也可通过前端设置页面动态修改（运行时生效，重启后恢复 .env 值）。

---

## 浏览器兼容性

| 平台 | 语音识别 | 语音播报 | 推荐度 |
|------|---------|---------|--------|
| Chrome 80+ | ✅ | ✅ | 推荐 |
| Edge 80+ | ✅ | ✅ | 推荐 |
| Safari 14+ | ⚠️ 部分 | ✅ | 可用 |
| Android App | ✅ 原生录音 | ✅ | 推荐 |
| Firefox | ❌ | ✅ | 不推荐 |

---

## 项目结构

```
voice-calendar/
├── server.js                  # 后端入口
├── package.json
├── Dockerfile                 # Docker 部署配置
├── capacitor.config.json      # Capacitor 配置
├── src/
│   ├── public/                # 前端静态资源
│   │   ├── index.html
│   │   ├── css/
│   │   ├── js/
│   │   │   ├── app.js         # 主应用逻辑
│   │   │   ├── voice.js       # 语音交互（支持原生录音）
│   │   │   ├── api.js         # API 请求模块
│   │   │   ├── calendar-ui.js # 日历视图渲染
│   │   │   ├── event-panel.js # 事件面板
│   │   │   ├── tts.js         # 语音播报
│   │   │   └── i18n.js        # 国际化
│   │   └── capacitor.js       # Capacitor JS bridge
│   ├── routes/
│   │   ├── events.js          # 事件 CRUD
│   │   ├── voice.js           # 语音 NLP + STT
│   │   ├── settings.js        # 运行时设置
│   │   └── ics.js             # ICS 导出
│   ├── ai/
│   │   ├── parser.js          # LLM NLP 解析器
│   │   └── asr.js             # 阿里云语音识别
│   ├── db/                    # SQLite 数据库层
│   └── services/              # 提醒/对话服务
├── plugins/                   # Capacitor 自定义插件
│   └── native-speech-recognition/
│       └── android/           # Android 原生录音插件
└── android/                   # Android 项目（Capacitor 生成）
```

---

## 已知问题

| 问题 | 状态 | 说明 |
|------|------|------|
| 重复事件仅存储不展开 | 已知 | 不会生成每日实例 |
| 会话不持久 | 已知 | 服务重启后对话上下文丢失 |
| 不支持农历 | 已知 | LLM 对农历日期不可靠 |
| Honor 手机无语音引擎 | 已知 | 需要另外配置 ASR 服务 |

---

## Roadmap

### v1.0 — 语音日历助手 ✅
- [x] 语音识别 + AI 自然语言解析
- [x] 事件 CRUD 全流程语音操控
- [x] 月/周/日日历视图
- [x] 轮询提醒 + 浏览器通知 + 语音播报
- [x] 深色模式 + 多语言

### v2.0 — 时间管理 Agent ✅
- [x] 多轮对话 + 上下文记忆
- [x] 日程冲突检测 + 替代建议
- [x] 数据库防抖 + 兼容多平台
- [x] ICS 导出 + 移动端访问

### v2.5 — 移动端原生 App ✅
- [x] Capacitor 8 Android 打包
- [x] 自定义原生录音插件
- [x] 阿里云 ASR 语音识别集成
- [x] Docker 一键部署

### v3.0 — 个人效率 Agent 🔜
- [ ] 主动日程建议 + 用户偏好学习
- [ ] 第三方日历双向同步（Google/Apple）
- [ ] 重复事件展开 + 推送通知
- [ ] iOS 原生录音支持

---

## 竞品参考

| 产品 | 链接 | 说明 |
|------|------|------|
| 0sec | App Store | 纯语音优先日历（仅 iOS，仅英文） |
| Fantastical | flexibits.com | 行业标杆自然语言日历（仅英文） |
| Motion | usemotion.com | AI 自动排程 |
| Morgen | morgen.so | AI 每日规划 |
| Any.do | any.do | 任务 + 日历 + 语音集成 |

---

## License

MIT
