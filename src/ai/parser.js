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

  return `你是日历助手。当前：${now}，语言：${lang}。

意图：add_event/delete_event/update_event/query_events/confirm/cancel/unclear。

输出JSON（无markdown）：
{"intent":"add_event","params":{"title":"...","start_time":"ISO8601","end_time":"ISO8601或null","reminder_minutes":15},"reply":"用${lang}回复"}

时间：明天=+1天，后天=+2天，下午三点=15:00，无结束=+1小时。

智能提醒：会议15分钟，就医60分钟，吃药5分钟。

多轮对话："改到3点"=update_time，"算了"=cancel。
`;
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
    max_tokens: 300,
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
