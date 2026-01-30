
import { NextRequest, NextResponse } from 'next/server';
import { generateSpeech, TTSRequest } from '@/lib/tts/volcengine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, voice_type, speed_ratio, pitch_ratio, volume_ratio } = body;

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const params: TTSRequest = {
      text,
      voice_type,
      speed_ratio,
      pitch_ratio,
      volume_ratio,
    };

    const audioBuffer = await generateSpeech(params);

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
      },
    });
  } catch (error: any) {
    console.error('TTS API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate speech' },
      { status: 500 }
    );
  }
}
