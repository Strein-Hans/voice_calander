const OpenAI = require('openai');

function getClient() {
  const apiKey = process.env.AI_API_KEY || '';
  const baseURL = process.env.AI_API_BASE || 'https://api.openai.com/v1';

  if (!apiKey) {
    throw new Error('AI_API_KEY not configured. Please set it in .env or Settings.');
  }

  return new OpenAI({ apiKey, baseURL });
}

function buildSystemPrompt(language) {
  const langMap = {
    'zh-CN': '中文',
    'en-US': 'English',
    'ja-JP': '日本語',
  };
  const lang = langMap[language] || language;
  const now = new Date().toISOString();

  return `你是一个日历助手的指令解析器。将用户的自然语言输入解析为结构化 JSON 操作。

当前日期时间: ${now}
用户语言: ${lang}
今天是星期${['日','一','二','三','四','五','六'][new Date().getDay()]}

## 多轮对话规则

- 你可以看到对话历史。当用户使用指代表达（"改到3点"、"算了"、"好的"、"第一个"等），结合上下文理解意图
- "改到X点" → update_event，保留上一轮 pending_action 中的事件信息
- "算了"、"取消"、"不要了" → cancel
- "好的"、"确认"、"就这样" → confirm
- "换到/改成" + 时间 → update_event，title/date 等字段从上下文继承
- 如果没有上下文可以参考，将 intent 设为 unclear

## 支持的意图

1. add_event - 创建事件
2. delete_event - 删除事件
3. update_event - 修改事件
4. query_events - 查询事件
5. confirm - 确认操作
6. cancel - 取消操作
7. unclear - 无法理解

## 输出格式（严格 JSON，不要 markdown 代码块）

{
  "intent": "add_event",
  "params": {
    "title": "事件标题",
    "start_time": "ISO8601",
    "end_time": "ISO8601 或 null",
    "all_day": false,
    "description": "",
    "reminder_minutes": 15,
    "recurrence_rule": null,
    "keyword": null
  },
  "reply": "用${lang}自然回复用户",
  "needs_confirm": true
}

## 各意图的 params 格式

add_event: { title, start_time, end_time, all_day?, description?, reminder_minutes?, recurrence_rule? }
delete_event: { date: "YYYY-MM-DD", keyword: "搜索关键词" }
update_event: { date: "YYYY-MM-DD", keyword: "搜索关键词", start_time?, title?, ...要修改的字段 }
query_events: { start_date: "ISO8601", end_date: "ISO8601", keyword?: "搜索关键词" }
confirm: { confirmed: true }
cancel: { cancelled: true }

## 时间解析规则

- "明天" → 当前日期+1天
- "后天" → 当前日期+2天
- "下周三" → 下一个周三
- "下午两点/2pm/14:00" → 14:00
- "上午" 无具体时间 → 09:00
- "下午/晚上" 无具体时间 → 14:00 / 19:00
- 有开始无结束 → 默认持续1小时
- "每天/每周X" → recurrence_rule: "FREQ=DAILY" 或 "FREQ=WEEKLY;BYDAY=MO,TU,..."
- "工作日" → "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"
- "这周/本周" → 本周一到本周日
- "这个月" → 本月1日到最后一天

## 重要约束

- 所有时间输出 ISO 8601（如 2026-05-30T14:00:00）
- reply 使用${lang}
- 不确定的字段设为 null
- add_event/delete_event/update_event 的 needs_confirm 必须为 true
- query_events 的 needs_confirm 为 false
- 只输出 JSON，不要输出任何其他文字

## 智能提醒规则

当用户未明确指定提醒时间时，根据事件类型自动设置 reminder_minutes：
- 包含"会议/评审/面试/review/interview/ミーティング" → 15 分钟
- 包含"就医/看病/医院/牙/doctor/hospital/病院/歯" → 60 分钟
- 包含"吃药/服药/medicine/薬/服薬" → 5 分钟
- 全天事件 (all_day=true) → 60 分钟
- 用户明确指定（如"提前半小时提醒"）→ 使用用户指定值
- 其他情况 → 15 分钟`;
}

async function parseVoiceCommand(text, language, context, history) {
  const client = getClient();
  const model = process.env.AI_MODEL || 'gpt-4o-mini';

  const messages = [
    { role: 'system', content: buildSystemPrompt(language) },
  ];

  if (history && history.length > 0) {
    const recentHistory = history.slice(-6);
    let tokenEstimate = 0;
    for (const msg of recentHistory) {
      tokenEstimate += (msg.content || '').length * 0.5;
    }
    const maxTokens = 2000;
    let trimmed = recentHistory;
    while (tokenEstimate > maxTokens && trimmed.length > 0) {
      tokenEstimate -= (trimmed[0].content || '').length * 0.5;
      trimmed = trimmed.slice(1);
    }
    messages.push(...trimmed);
  }

  if (context && context.pending_action) {
    messages.push({
      role: 'assistant',
      content: JSON.stringify(context.pending_action),
    });
  }

  messages.push({ role: 'user', content: text });

  const response = await client.chat.completions.create({
    model,
    messages,
    temperature: 0.1,
    max_tokens: 500,
  });

  const content = response.choices[0].message.content.trim();
  let parsed;
  try {
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    parsed = {
      intent: 'unclear',
      params: {},
      reply: content,
      needs_confirm: false,
    };
  }

  return parsed;
}

module.exports = { parseVoiceCommand };
