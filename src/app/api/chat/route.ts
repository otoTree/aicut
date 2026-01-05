
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, response_format } = body;

    const apiKey = process.env.LLM_API_KEY;
    const baseURL = process.env.LLM_BASE_URL || 'https://api.openai.com/v1';
    const model = process.env.LLM_MODEL || 'gpt-4o';

    console.log(`[LLM Request] Model: ${model}, BaseURL: ${baseURL}`);

    if (!apiKey) {
      console.error('[LLM Error] API Key is missing');
      return NextResponse.json({ error: 'LLM_API_KEY is not configured' }, { status: 500 });
    }

    const openai = new OpenAI({
      apiKey,
      baseURL,
    });

    const response = await openai.chat.completions.create({
      model,
      messages,
      response_format: response_format || undefined,
      stream: true,
    });

    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of response) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            controller.enqueue(new TextEncoder().encode(content));
          }
        }
        controller.close();
      },
    });

    return new Response(stream);
  } catch (error: any) {
    console.error('[LLM Error] Exception:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
