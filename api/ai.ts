import type { VercelRequest, VercelResponse } from '@vercel/node';

const ZHIPU_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// CORS headers
function setCorsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function callZhipu(apiKey: string, body: any) {
  const response = await fetch(ZHIPU_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  return response.json();
}

const AI_SYSTEM_PROMPT = `你是一个有趣的历史讲解员。根据以下历史事件信息，请生成：
1. 一句话总结要点（summary）
2. 扩展相关知识（expansion，2-3条）
3. 趣味解说（fun_fact，1-2条，要求通俗易懂、有趣）
请用 JSON 格式返回：{"summary": "...", "expansion": ["...", "..."], "fun_fact": ["...", "..."]}`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action } = req.query;

  try {
    // 故事摘要
    if (action === 'story-summary') {
      const { apiKey, title, content } = req.body as any;
      if (!apiKey)
        return res.status(400).json({ code: 0, msg: '请先配置智谱AI API Key', data: null });
      if (!content) return res.status(400).json({ code: 0, msg: '缺少故事内容', data: null });
      const prompt = `请用简洁的语言总结这个故事的寓意（适合家长理解后讲给孩子听，50-100字）：
故事标题：${title}
故事内容：${content}`;
      const data: any = await callZhipu(apiKey, {
        model: 'glm-4-flash',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 500,
      });
      if (data.choices?.[0]) {
        return res
          .status(200)
          .json({ code: 1, msg: 'success', data: { summary: data.choices[0].message.content } });
      }
      return res.status(500).json({ code: 0, msg: 'AI返回数据格式错误', data: null });
    }

    // 故事续写
    if (action === 'story-continue') {
      const { apiKey, title, content } = req.body as any;
      if (!apiKey)
        return res.status(400).json({ code: 0, msg: '请先配置智谱AI API Key', data: null });
      if (!content) return res.status(400).json({ code: 0, msg: '缺少故事内容', data: null });
      const prompt = `请根据以下睡前故事，续写一个适合儿童的结尾（100-200字）：
故事标题：${title}
故事内容：${content}`;
      const data: any = await callZhipu(apiKey, {
        model: 'glm-4-flash',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: 1000,
      });
      if (data.choices?.[0]) {
        return res
          .status(200)
          .json({ code: 1, msg: 'success', data: { content: data.choices[0].message.content } });
      }
      return res.status(500).json({ code: 0, msg: 'AI返回数据格式错误', data: null });
    }

    // 历史解读
    if (action === 'history-interpretation') {
      const { apiKey, title, year, month, day, details } = req.body as any;
      if (!apiKey)
        return res.status(400).json({ code: 0, msg: '请先配置智谱AI API Key', data: null });
      if (!title || !details)
        return res.status(400).json({ code: 0, msg: '缺少必要参数', data: null });
      const prompt = `事件信息：标题：${title}，年份：${year}年${month}月${day}日，详情：${details}`;
      const data: any = await callZhipu(apiKey, {
        model: 'glm-4-flash',
        messages: [
          { role: 'system', content: AI_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
          return res.status(200).json({ code: 1, msg: 'success', data: parsed });
        } catch {
          return res.status(500).json({ code: 0, msg: 'AI返回格式解析失败', data: null });
        }
      }
      return res.status(500).json({ code: 0, msg: 'AI返回数据格式错误', data: null });
    }

    // 图像处理
    if (action === 'image-process') {
      const { apiKey, imageBase64, prompt, feature } = req.body as any;
      if (!apiKey) return res.status(400).json({ code: 0, msg: 'API Key is required', data: null });
      if (!imageBase64)
        return res.status(400).json({ code: 0, msg: 'Image is required', data: null });
      const prompts: Record<string, string> = {
        crop: '请分析这张图片，识别出主体内容区域，返回 JSON 格式：{"x": 0, "y": 0, "width": 100, "height": 100}',
        'remove-bg': '请将这张图片的背景去除，只保留主体内容。',
        enhance: '请提升这张图片的清晰度和质量，使其更适合作为图标使用。',
      };
      const actualPrompt = prompts[feature || ''] || prompt || '';
      const data: any = await callZhipu(apiKey, {
        model: 'glm-4v-flash',
        messages: [{ role: 'user', content: actualPrompt + '\n\n[图片内容]' }],
      });
      const content = data.choices?.[0]?.message?.content;
      if (feature === 'crop' && content) {
        try {
          const coords = JSON.parse(content);
          return res
            .status(200)
            .json({ code: 1, msg: 'success', data: { feature: 'crop', ...coords } });
        } catch {
          return res
            .status(200)
            .json({ code: 1, msg: 'success', data: { feature: 'crop', raw: content } });
        }
      }
      return res.status(200).json({ code: 1, msg: 'success', data: { feature, result: content } });
    }

    // 移除背景
    if (action === 'remove-background') {
      const formData = req.body as any;
      const imageFile = formData.get ? formData.get('image_file') : formData.image_file;
      const apiKey = formData.get ? formData.get('api_key') : formData.api_key;
      if (!imageFile) return res.status(400).json({ error: '请上传图片文件' });
      if (!apiKey) return res.status(400).json({ error: '请提供 API Key' });
      const buffer = Buffer.isBuffer(imageFile) ? imageFile : Buffer.from(imageFile);
      const response = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: { 'X-Api-Key': apiKey },
        body: (() => {
          const form = new FormData();
          form.append('image_file', new Blob([buffer]), 'image.png');
          form.append('size', 'auto');
          form.append('format', 'png');
          return form;
        })(),
      });
      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 402) return res.status(402).json({ error: 'API 额度已用完' });
        if (response.status === 401) return res.status(401).json({ error: 'API Key 无效' });
        return res.status(response.status).json({ error: `处理失败: ${errorText}` });
      }
      const imageBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(imageBuffer).toString('base64');
      const mimeType = response.headers.get('content-type') || 'image/png';
      return res.status(200).json({ success: true, image: `data:${mimeType};base64,${base64}` });
    }

    return res.status(400).json({ error: '缺少 action 参数' });
  } catch (error) {
    console.error('AI API error:', error);
    return res
      .status(500)
      .json({ error: error instanceof Error ? error.message : 'Internal error' });
  }
}
