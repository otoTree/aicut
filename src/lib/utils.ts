import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 获取媒体资源的代理 URL，以解决 COOP/COEP 环境下的跨域问题
 */
export function getProxyUrl(url?: string): string {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('/')) return url;
  return `/api/proxy-media?url=${encodeURIComponent(url)}`;
}

/**
 * 从混合文本中提取 JSON
 */
export function extractJSON<T>(text: string): T {
  // 1. 尝试匹配 ```json ... ```
  const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch?.[1]) {
    try {
      return JSON.parse(jsonBlockMatch[1]);
    } catch (e) {
      // 如果解析失败，继续尝试其他方法
    }
  }

  // 2. 尝试匹配 ``` ... ```
  const blockMatch = text.match(/```\s*([\s\S]*?)\s*```/);
  if (blockMatch?.[1]) {
    try {
      return JSON.parse(blockMatch[1]);
    } catch (e) {
      // 如果解析失败，继续尝试其他方法
    }
  }

  // 3. 寻找第一个 { 和最后一个 } (针对对象)
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const jsonCandidate = text.substring(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(jsonCandidate);
    } catch (e) {
      // 如果解析失败，继续尝试其他方法
    }
  }

  // 4. 寻找第一个 [ 和最后一个 ] (针对数组)
  const firstBracket = text.indexOf('[');
  const lastBracket = text.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    const jsonCandidate = text.substring(firstBracket, lastBracket + 1);
    try {
      return JSON.parse(jsonCandidate);
    } catch (e) {
      // 如果解析失败，继续尝试其他方法
    }
  }

  // 5. 最后尝试直接解析整个文本
  return JSON.parse(text);
}

/**
 * 尝试解析不完整的 JSON 字符串
 * 用于流式展示时提取已有的字段
 */
export function parsePartialJson<T>(jsonString: string): Partial<T> {
  try {
    // 简单的处理：寻找已经闭合的字段
    // 这种方法不完美，但对于顶层字符串字段比较有效
    const result: any = {};
    
    // 提取字符串字段的正则 (如 "storyOverview": "...")
    const stringFieldRegex = /"(\w+)":\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g;
    let match;
    while ((match = stringFieldRegex.exec(jsonString)) !== null) {
      result[match[1]] = match[2];
    }

    // 提取数组字段的初步处理 (如 "characters": [...])
    // 这里只处理已经完全闭合的数组项，比较复杂，暂时只处理简单的字符串
    
    // 如果能直接解析成功的就直接解析
    try {
      const cleaned = jsonString.trim();
      // 补齐结尾的 } 如果缺少
      let attempt = cleaned;
      if (!attempt.endsWith('}')) {
        attempt += '}';
      }
      return { ...result, ...JSON.parse(attempt) };
    } catch (e) {
      // 忽略解析错误，返回正则提取的结果
    }

    return result;
  } catch (e) {
    return {};
  }
}
