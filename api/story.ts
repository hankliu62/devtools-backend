import type { VercelRequest, VercelResponse } from '@vercel/node';

const API_BASE = 'https://www.mxnzp.com/api/';

// CORS headers
function setCorsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action } = req.query;

  try {
    // 故事详情
    if (action === 'details') {
      const { story_id } = req.query;
      if (!story_id) return res.status(400).json({ code: 0, msg: '缺少story_id参数', data: null });
      const response = await fetch(buildUrl('story/details', { story_id: story_id as string }));
      const data: any = await response.json();
      return res
        .status(200)
        .json(
          data.code === 1
            ? { code: 1, msg: 'success', data: data.data }
            : { code: 0, msg: data.msg || '获取数据失败', data: null }
        );
    }

    // 故事列表
    if (action === 'list') {
      const { type_id, keyword, page } = req.query;
      let url = '';
      if (type_id && keyword) {
        url = buildUrl('story/list', {
          type_id: type_id as string,
          keyword: keyword as string,
          page: (page as string) || '1',
        });
      } else if (type_id) {
        url = buildUrl('story/list', { type_id: type_id as string, page: (page as string) || '1' });
      } else if (keyword) {
        url = buildUrl('story/search', {
          keyword: keyword as string,
          page: (page as string) || '1',
        });
      } else {
        url = buildUrl('story/list', { type_id: '1', page: (page as string) || '1' });
      }
      const response = await fetch(url);
      const data: any = await response.json();
      return res
        .status(200)
        .json(
          data.code === 1
            ? { code: 1, msg: 'success', data: data.data }
            : { code: 0, msg: data.msg || '获取数据失败', data: [] }
        );
    }

    // 默认 - 故事分类
    const response = await fetch(buildUrl('story/types'));
    const data: any = await response.json();
    return res
      .status(200)
      .json(
        data.code === 1
          ? { code: 1, msg: 'success', data: data.data }
          : { code: 0, msg: data.msg || '获取数据失败', data: [] }
      );
  } catch (error) {
    console.error('Story API error:', error);
    return res.status(500).json({ code: 0, msg: '网络请求失败', data: [] });
  }
}
