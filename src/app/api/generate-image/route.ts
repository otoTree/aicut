import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompt, size = "2K", images } = body;

    const apiKey = process.env.ARK_API_KEY;
    const baseURL = process.env.ARK_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3";
    const model = process.env.ARK_IMAGE_MODEL || "doubao-seedream-4-5-251128";

    //console.log(`[Image Gen Request] ARK API KEY: ${apiKey}, Model: ${model}, Prompt: ${prompt}, Size: ${size}, Images: ${images ? (Array.isArray(images) ? images.length : 1) : 0}`);

    if (!apiKey) {
      console.error('[Image Gen Error] ARK_API_KEY is missing');
      return NextResponse.json({ error: 'ARK_API_KEY is not configured' }, { status: 500 });
    }

    console.log(`[Image Gen Request] Model: ${model}, Prompt: ${prompt}`);

    const openai = new OpenAI({
      apiKey,
      baseURL,
    });

    // @ts-ignore
    const response = await openai.images.generate({
      model,
      prompt,
      size: size as any,
      response_format: 'url',
      ...(images && { image: images }),
    }, {
      extra_body: {
        watermark: true,
      },
    } as any);

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[Image Gen Error] Exception:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
