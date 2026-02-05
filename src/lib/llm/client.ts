
export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  imageUrl?: string;
}

export interface ImageGenerationResponse {
  url: string;
}

export interface ChatCompletionResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class LLMClient {
  async chat(messages: Message[], jsonMode = false): Promise<ChatCompletionResponse> {
    let fullContent = '';
    await this.chatStream(messages, (chunk) => {
      fullContent += chunk;
    }, jsonMode);
    return { content: fullContent };
  }

  async chatStream(
    messages: Message[], 
    onChunk: (chunk: string) => void,
    jsonMode = false
  ): Promise<void> {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messages.map(({ role, content }) => ({ role, content })),
          response_format: jsonMode ? { type: 'json_object' } : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch from LLM API');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        onChunk(chunk);
      }
    } catch (error) {
      console.error('LLM API Error:', error);
      throw error;
    }
  }

  async generateImage(prompt: string, size: string = '2K', images?: string | string[]): Promise<ImageGenerationResponse> {
    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          size,
          images,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate image');
      }

      const data = await response.json();
      return {
        url: data.data[0].url,
      };
    } catch (error) {
      console.error('Image Generation Error:', error);
      throw error;
    }
  }

  async generateVideo(prompt: string, imageUrl: string, duration?: number, ratio?: string, lastImageUrl?: string): Promise<{ id: string }> {
    try {
      const response = await fetch('/api/generate-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          imageUrl,
          duration,
          ratio,
          lastImageUrl,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start video generation');
      }

      return await response.json();
    } catch (error) {
      console.error('Video Generation Error:', error);
      throw error;
    }
  }

  async queryVideoStatus(taskId: string): Promise<{ status: string; video_url?: string }> {
    try {
      const response = await fetch(`/api/generate-video?id=${taskId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to query video status');
      }
      const data = await response.json();
      return {
        status: data.status,
        video_url: data.content?.video_url || data.video_url,
      };
    } catch (error) {
      console.error('Query Video Status Error:', error);
      throw error;
    }
  }
}

export const llmClient = new LLMClient();
