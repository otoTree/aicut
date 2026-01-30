
import { v4 as uuidv4 } from 'uuid';

const VOLC_TTS_URL = 'https://openspeech.bytedance.com/api/v1/tts';

export interface TTSRequest {
  text: string;
  voice_type?: string;
  speed_ratio?: number; // 0.2 - 3.0, default 1.0
  pitch_ratio?: number; // 0.1 - 3.0, default 1.0
  volume_ratio?: number; // 0.1 - 3.0, default 1.0
}

export async function generateSpeech(params: TTSRequest): Promise<ArrayBuffer> {
  const appId = process.env.VOLC_TTS_APP_ID;
  const token = process.env.VOLC_TTS_TOKEN;
  const cluster = process.env.VOLC_TTS_CLUSTER || 'volcano_tts';

  if (!appId || !token) {
    throw new Error('Volcengine TTS credentials not configured (VOLC_TTS_APP_ID, VOLC_TTS_TOKEN)');
  }

  const reqId = uuidv4();

  const body = {
    app: {
      appid: appId,
      token: token,
      cluster: cluster,
    },
    user: {
      uid: 'user_1', // Can be dynamic if needed
    },
    audio: {
      voice_type: params.voice_type || 'BV001_streaming', // Default voice
      encoding: 'mp3',
      speed_ratio: params.speed_ratio || 1.0,
      volume_ratio: params.volume_ratio || 1.0,
      pitch_ratio: params.pitch_ratio || 1.0,
    },
    request: {
      reqid: reqId,
      text: params.text,
      text_type: 'plain',
      operation: 'query',
    },
  };

  try {
    const response = await fetch(VOLC_TTS_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer; ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('TTS API Response Error:', response.status, errorText, 'Body:', JSON.stringify(body));
      throw new Error(`TTS API Error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();

    if (data.code !== 3000) {
      if (!data.data) {
        throw new Error(`TTS API Error: ${JSON.stringify(data)}`);
      }
    }

    if (data.data) {
        // Convert base64 to ArrayBuffer
        const binaryString = atob(data.data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    } else {
         throw new Error('No audio data received');
    }

  } catch (error) {
    console.error('Volcengine TTS Error:', error);
    throw error;
  }
}
