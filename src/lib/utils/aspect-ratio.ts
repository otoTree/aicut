import { AspectRatio } from '@/store/useStore';

export const getResolution = (ratio: AspectRatio | undefined, defaultResolution: string = '2560x1440'): string => {
  if (!ratio) return defaultResolution;
  
  switch (ratio) {
    case '16:9': return '2560x1440';
    case '9:16': return '1440x2560';
    case '1:1': return '2048x2048';
    case '4:3': return '2304x1728';
    case '3:4': return '1728x2304';
    default: return defaultResolution;
  }
};
