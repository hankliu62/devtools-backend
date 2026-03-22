import type { VercelRequest, VercelResponse } from '@vercel/node';

const API_BASE = 'https://www.mxnzp.com/api/';
const ZHIPU_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// CORS headers
function setCorsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

const IMAGE_TYPE_PROMPT = `请分析这张图片并识别其类型。根据图片内容，从以下类别中选择最匹配的一个：
- 人像照片 - 屏幕截图 - 摄影作品 - 插画/漫画 - 图表/数据可视化
- 文档/扫描件 - 纯文字图片 - 二维码/条形码 - Logo/品牌标识 - 其他
请按以下 JSON 格式返回结果：
{"type": "图片类型", "recommendation": "推荐的压缩参数建议，包括质量(1-100)、格式建议、是否保留透明度等"}`;

function getEnv() {
  return {
    MXNZP_APP_ID: process.env.MXNZP_APP_ID || '',
    MXNZP_APP_SECRET: process.env.MXNZP_APP_SECRET || '',
  };
}

function buildUrl(path: string, params: Record<string, string> = {}): string {
  const env = getEnv();
  const query = new URLSearchParams({
    app_id: env.MXNZP_APP_ID,
    app_secret: env.MXNZP_APP_SECRET,
    ...params,
  });
  return `${API_BASE}${path}?${query.toString()}`;
}

async function callZhipu(apiKey: string, body: any) {
  const response = await fetch(ZHIPU_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  return response.json();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action } = req.query;

  try {
    // 节假日查询
    if (action === 'calendar') {
      const { date, ignoreHoliday } = req.query;
      if (!date) return res.status(400).json({ error: 'Date is required (format: YYYYMM)' });
      const env = getEnv();
      const query = new URLSearchParams({
        ignoreHoliday: (ignoreHoliday as string) || '0',
        app_id: env.MXNZP_APP_ID,
        app_secret: env.MXNZP_APP_SECRET,
      });
      const url = `https://www.mxnzp.com/api/holiday/list/month/${date}?${query.toString()}`;
      const response = await fetch(url);
      const data = await response.json();
      return res.status(200).json(data);
    }

    // 历史上的今天
    if (action === 'history-today') {
      const { type } = req.query;
      const url = buildUrl('history/today', { type: (type as string) || '1' });
      const response = await fetch(url);
      const data: any = await response.json();
      if (data.code === 1) {
        return res.status(200).json({ code: 1, msg: 'success', data: data.data });
      }
      return res.status(200).json({ code: 0, msg: data.msg || '获取数据失败', data: [] });
    }

    // 翻译
    if (action === 'translate') {
      const { text, targetLang, apiKey } = req.body as any;
      if (!text || !targetLang || !apiKey) {
        return res.status(400).json({ error: 'Missing required fields: text, targetLang, apiKey' });
      }
      const prompts: Record<string, string> = {
        zh: `将以下英文内容翻译成中文，保持原有格式和换行。只返回翻译结果：\n\n${text}`,
        en: `Translate the following Chinese content to English. Keep the original format and line breaks. Only return the translation:\n\n${text}`,
      };
      const data: any = await callZhipu(apiKey, {
        model: 'glm-4-flash',
        messages: [{ role: 'user', content: prompts[targetLang] || prompts.zh }],
        temperature: 0.3,
      });
      return res.status(200).json({ translatedText: data.choices?.[0]?.message?.content || text });
    }

    // 图像分析
    if (action === 'image-analyze') {
      const { apiKey, model, imageBase64 } = req.body as any;
      if (!apiKey || !imageBase64) {
        return res.status(400).json({ error: 'API Key and Image are required' });
      }
      const isZhipuModel = model?.startsWith('glm');

      if (isZhipuModel) {
        const response = await fetch(ZHIPU_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: model || 'glm-4v-flash',
            messages: [{ role: 'user', content: IMAGE_TYPE_PROMPT + '\n\n[图片内容]' }],
          }),
        });
        const data: any = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) return res.status(200).json(JSON.parse(jsonMatch[0]));
        } catch {}
        return res
          .status(200)
          .json({ type: '未知', recommendation: '建议使用质量 80，格式保持原格式' });
      } else {
        const response = await fetch(
          `${GEMINI_API_URL}/${model || 'gemini-2.0-flash'}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: IMAGE_TYPE_PROMPT }] }],
              generationConfig: { temperature: 0.1, topP: 0.95, maxOutputTokens: 512 },
            }),
          }
        );
        const data: any = await response.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) return res.status(200).json(JSON.parse(jsonMatch[0]));
        } catch {}
        return res
          .status(200)
          .json({ type: '未知', recommendation: '建议使用质量 80，格式保持原格式' });
      }
    }

    // Prompt 优化
    if (action === 'ai-prompt-optimizer') {
      const { apiKey, model, prompt, input } = req.body as any;
      if (!apiKey) {
        return res.status(400).json({ error: 'API Key is required' });
      }
      const isZhipuModel = model?.startsWith('glm');

      if (isZhipuModel) {
        const data: any = await callZhipu(apiKey, {
          model,
          messages: [
            { role: 'user', content: prompt },
            { role: 'user', content: `\n\n原始提示词：\n${input}` },
          ],
        });
        const text = data.choices?.[0]?.message?.content || '';
        return res.status(200).json({ candidates: [{ content: { parts: [{ text }] } }] });
      } else {
        const response = await fetch(`${GEMINI_API_URL}/${model}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            generationConfig: {},
            safetySettings: [],
            contents: [
              { role: 'user', parts: [{ text: prompt }, { text: `\n\n原始提示词：\n${input}` }] },
            ],
          }),
        });
        const data = await response.json();
        return res.status(200).json(data);
      }
    }

    // 颜色分析
    if (action === 'color-analyze') {
      const { hex, apiKey, model } = req.body as any;

      if (!hex) {
        return res.status(400).json({ error: 'Hex color is required' });
      }

      // 解析颜色
      const rgbMatch = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      if (!rgbMatch) {
        return res.status(400).json({ error: 'Invalid hex color format' });
      }

      const r = parseInt(rgbMatch[1], 16);
      const g = parseInt(rgbMatch[2], 16);
      const b = parseInt(rgbMatch[3], 16);

      // 计算 HSL
      const rNorm = r / 255;
      const gNorm = g / 255;
      const bNorm = b / 255;
      const max = Math.max(rNorm, gNorm, bNorm);
      const min = Math.min(rNorm, gNorm, bNorm);
      let h = 0;
      let s = 0;
      const l = (max + min) / 2;
      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case rNorm:
            h = ((gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)) / 6;
            break;
          case gNorm:
            h = ((bNorm - rNorm) / d + 2) / 6;
            break;
          case bNorm:
            h = ((rNorm - gNorm) / d + 4) / 6;
            break;
        }
      }
      const hDeg = Math.round(h * 360);
      const sPct = Math.round(s * 100);
      const lPct = Math.round(l * 100);

      // 如果没有 API Key，返回本地分析
      if (!apiKey || apiKey === 'your_api_key_here') {
        return res
          .status(200)
          .json(getLocalColorAnalysis(hex, { r, g, b }, { h: hDeg, s: sPct, l: lPct }));
      }

      const isZhipuModel = model?.startsWith('glm');
      const prompt = `分析颜色 #${hex} (RGB: ${r},${g},${b}, HSL: ${hDeg}°,${sPct}%,${lPct}%):
请返回 JSON 格式的分析结果：
{
  "meaning": "颜色语义的简短描述（50字以内）",
  "emotion": ["情感关键词1", "情感关键词2", "情感关键词3"],
  "useCases": ["使用场景1", "使用场景2", "使用场景3"],
  "palette": ["#推荐色1", "#推荐色2", "#推荐色3", "#推荐色4", "#推荐色5"]
}`;

      if (isZhipuModel) {
        const data: any = await callZhipu(apiKey, {
          model: model || 'glm-4-flash',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 500,
        });
        const text = data.choices?.[0]?.message?.content || '';
        try {
          const analysis = JSON.parse(text);
          return res.status(200).json(analysis);
        } catch {
          return res
            .status(200)
            .json(getLocalColorAnalysis(hex, { r, g, b }, { h: hDeg, s: sPct, l: lPct }));
        }
      } else {
        const response = await fetch(
          `${GEMINI_API_URL}/${model || 'gemini-2.0-flash'}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 500,
                responseMimeType: 'application/json',
              },
            }),
          }
        );
        const data: any = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        try {
          const analysis = JSON.parse(text);
          return res.status(200).json(analysis);
        } catch {
          return res
            .status(200)
            .json(getLocalColorAnalysis(hex, { r, g, b }, { h: hDeg, s: sPct, l: lPct }));
        }
      }
    }

    // 默认返回帮助信息
    return res.status(200).json({
      msg: 'Tools API',
      actions: [
        'calendar - 节假日查询',
        'history-today - 历史上的今天',
        'translate - 翻译',
        'image-analyze - 图像分析',
        'ai-prompt-optimizer - Prompt 优化',
        'color-analyze - 颜色分析',
      ],
    });
  } catch (error) {
    console.error('Tools API error:', error);
    return res
      .status(500)
      .json({ error: error instanceof Error ? error.message : 'Internal error' });
  }
}

function getLocalColorAnalysis(
  hex: string,
  rgb: { r: number; g: number; b: number },
  hsl: { h: number; s: number; l: number }
) {
  const hue = hsl.h;
  const saturation = hsl.s;
  const lightness = hsl.l;

  let meaning = '';
  const emotion: string[] = [];
  const useCases: string[] = [];
  const palette: string[] = [];

  // 基于色相判断
  if (hue >= 0 && hue < 30) {
    meaning = '红色代表热情、活力和勇气';
    emotion.push('热情', '活力', '勇气');
    useCases.push('促销活动', '警示标识', '餐饮品牌');
  } else if (hue >= 30 && hue < 60) {
    meaning = '橙色代表温暖、友好和创造力';
    emotion.push('温暖', '友好', '创造力');
    useCases.push('儿童品牌', '电商促销', '运动品牌');
  } else if (hue >= 60 && hue < 150) {
    meaning = '绿色代表自然、环保和健康';
    emotion.push('自然', '环保', '健康');
    useCases.push('环保品牌', '健康产品', '农业品牌');
  } else if (hue >= 150 && hue < 210) {
    meaning = '蓝色代表信任、专业和冷静';
    emotion.push('信任', '专业', '冷静');
    useCases.push('科技品牌', '金融产品', '企业形象');
  } else if (hue >= 210 && hue < 270) {
    meaning = '紫色代表神秘、高贵和创意';
    emotion.push('神秘', '高贵', '创意');
    useCases.push('美妆品牌', '奢侈品', '艺术相关');
  } else {
    meaning = '粉色代表温柔、浪漫和甜美';
    emotion.push('温柔', '浪漫', '甜美');
    useCases.push('女性产品', '礼品品牌', '婚礼相关');
  }

  // 基于亮度调整
  if (lightness > 80) {
    meaning += '（浅色调更显轻盈）';
    emotion.push('清新');
  } else if (lightness < 30) {
    meaning += '（深色调更显沉稳）';
    emotion.push('沉稳');
  }

  // 生成配色方案
  const baseColor = hex.replace('#', '');
  for (let i = 1; i <= 5; i++) {
    const lightnessAdjusted = Math.max(0, Math.min(100, lightness + (i - 3) * 20));
    palette.push(`#${adjustHexColor(baseColor, lightnessAdjusted)}`);
  }

  return { meaning, emotion, useCases, palette };
}

function adjustHexColor(hex: string, targetLightness: number) {
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  const currentLightness = (Math.max(r, g, b) + Math.min(r, g, b)) / 255 / 2;
  const factor = targetLightness / 100 / currentLightness;

  const newR = Math.min(255, Math.round(r * factor));
  const newG = Math.min(255, Math.round(g * factor));
  const newB = Math.min(255, Math.round(b * factor));

  return `${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}
