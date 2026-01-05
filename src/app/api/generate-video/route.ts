import { NextResponse } from 'next/server';

const ARK_API_KEY = process.env.ARK_API_KEY;
const ARK_BASE_URL = process.env.ARK_BASE_GENVIDEO_URL || "https://ark.cn-beijing.volces.com/api/v3";
const ARK_VIDEO_MODEL = process.env.ARK_VIDEO_MODEL || "doubao-seedance-1-5-pro-250106";

/**
 * 创建视频生成任务 (POST)
 * 支持首帧图生视频
 */
export async function POST(req: Request) {
  try {
    if (!ARK_API_KEY) {
      return NextResponse.json({ error: 'ARK_API_KEY is not configured' }, { status: 500 });
    }

    const body = await req.json();
    const { prompt, imageUrl, model = ARK_VIDEO_MODEL, ...params } = body;

    if (!imageUrl) {
      return NextResponse.json({ error: 'imageUrl is required for first-frame video generation' }, { status: 400 });
    }

    const content = [];
    
    // 添加图片信息 (首帧)
    content.push({
      type: 'image_url',
      image_url: {
        url: imageUrl,
      },
      role: 'first_frame',
    });

    // 添加文本信息 (提示词)
    if (prompt) {
      content.push({
        type: 'text',
        text: prompt,
      });
    }

    const payload = {
      model,
      content,
      ...params,
    };

    console.log('[Video Gen] Creating task with payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(`${ARK_BASE_URL}/contents/generations/tasks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ARK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Video Gen] Error creating task:', data);
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Video Gen] Exception in POST:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * 查询视频生成任务状态 (GET)
 * URL 格式: /api/generate-video?id=task_id
 */
export async function GET(req: Request) {
  try {
    if (!ARK_API_KEY) {
      return NextResponse.json({ error: 'ARK_API_KEY is not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    console.log(`[Video Gen] Querying task status: ${id}`);

    const response = await fetch(`${ARK_BASE_URL}/contents/generations/tasks/${id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ARK_API_KEY}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Video Gen] Error querying task:', data);
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Video Gen] Exception in GET:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
