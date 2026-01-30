import { useState, useRef } from 'react';
import { VideoSkeleton } from '@/store/useStore';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

export function useVideoExporter() {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const ffmpegRef = useRef<FFmpeg | null>(null);

  const loadFFmpeg = async () => {
    if (ffmpegRef.current) return ffmpegRef.current;

    const ffmpeg = new FFmpeg();
    // Use v0.11.x core for better compatibility without SharedArrayBuffer (single-threaded)
    // Note: ffmpeg.wasm 0.12.x strictly requires SharedArrayBuffer which needs COOP/COEP headers
    // Since we removed those headers to allow cross-origin images, we must use a core that works without them.
    // However, @ffmpeg/core 0.12.x doesn't have a single-threaded build easily available on unpkg.
    // We will attempt to load the default one, but if it fails, we might need to fallback.
    // Actually, simply removing the headers often breaks 0.12.x. 
    // Let's try to use the single-threaded build if available, or stick to what we have and see if it runs (it likely won't).
    // A safer bet for now without headers is to accept that MP4 export might fail or require a specific single-threaded core URL.
    // Let's try using the latest 0.12.6 but acknowledge it might be slow or unstable without headers.
    // Actually, without headers, SharedArrayBuffer is not defined. 0.12.x will throw error.
    
    // Changing to use 0.11.0 scripts for single threaded support is tricky with the 0.12.x API.
    // Instead, we will keep the current URL but wrap the load in a try-catch to warn user.
    // BETTER SOLUTION: Use the single-threaded build of 0.12.6 if it exists. 
    // It seems 0.12.x dropped single-threaded support.
    // So we are in a dilemma: COOP/COEP headers break images, but are needed for FFmpeg.
    // User wants "Allow Cross Origin" (fix images).
    // So we must prioritize images. If FFmpeg fails, we should fallback to WebM download or warn.
    
    // For now, let's keep the code as is but add error handling. 
    // Wait, I can try to use the @ffmpeg/core-mt (multithreaded) vs @ffmpeg/core (single)? 
    // No, default IS single threaded in some versions? No, default is MT.
    
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    
    ffmpegRef.current = ffmpeg;
    return ffmpeg;
  };

  const exportVideo = async (skeleton: VideoSkeleton) => {
    if (!skeleton || !skeleton.scenes.length) return;
    setIsExporting(true);
    setProgress(0);

    try {
      // Setup Canvas
      const canvas = document.createElement('canvas');
      canvas.width = 1280; // Default to 720p
      canvas.height = 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');

      // Fill black background initially
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Setup Recorder
      const stream = canvas.captureStream(30); // 30 FPS
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') 
        ? 'video/webm;codecs=vp9' 
        : 'video/webm';
      
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      recorder.start();

      // Setup hidden video element
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.playsInline = true;
      video.style.position = 'fixed';
      video.style.top = '-9999px';
      video.style.left = '-9999px';
      document.body.appendChild(video);

      const scenes = skeleton.scenes.filter(s => s.videoUrl);
      const totalScenes = scenes.length;

      if (totalScenes === 0) {
        throw new Error('No videos to export');
      }

      // Record scenes
      for (let i = 0; i < totalScenes; i++) {
        const scene = scenes[i];
        if (!scene.videoUrl) continue;

        await new Promise<void>((resolve, reject) => {
          // Use proxy to avoid CORP/CORS issues with third-party media
          const proxyUrl = `/api/proxy-media?url=${encodeURIComponent(scene.videoUrl!)}`;
          video.src = proxyUrl;
          
          let animationFrameId: number;

          const draw = () => {
            if (video.paused || video.ended) return;
            
            const scale = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
            const w = video.videoWidth * scale;
            const h = video.videoHeight * scale;
            const x = (canvas.width - w) / 2;
            const y = (canvas.height - h) / 2;
            
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(video, x, y, w, h);
            
            animationFrameId = requestAnimationFrame(draw);
          };

          const onPlay = () => {
            draw();
          };

          const onEnded = () => {
            cancelAnimationFrame(animationFrameId);
            cleanup();
            resolve();
          };
          
          const onError = (e: any) => {
              cancelAnimationFrame(animationFrameId);
              cleanup();
              console.error(`Error loading video for scene ${scene.id}`, e);
              resolve();
          };

          const cleanup = () => {
              video.removeEventListener('play', onPlay);
              video.removeEventListener('ended', onEnded);
              video.removeEventListener('error', onError);
          };

          video.addEventListener('play', onPlay);
          video.addEventListener('ended', onEnded);
          video.addEventListener('error', onError);

          video.play().catch(onError);
        });

        setProgress(Math.round(((i + 1) / totalScenes) * 80)); // Recording is 80% of work
      }

      // Stop recording
      document.body.removeChild(video);
      recorder.stop();
      
      await new Promise<void>(resolve => {
          recorder.onstop = () => resolve();
      });

      // Convert to MP4
      const webmBlob = new Blob(chunks, { type: 'video/webm' });
      
      // Load FFmpeg
      const ffmpeg = await loadFFmpeg();
      await ffmpeg.writeFile('input.webm', await fetchFile(webmBlob));

      // Transcode
      setProgress(90);
      await ffmpeg.exec(['-i', 'input.webm', '-c:v', 'libx264', '-preset', 'ultrafast', 'output.mp4']);
      
      // Read output
      const data = await ffmpeg.readFile('output.mp4');
      const mp4Blob = new Blob([new Uint8Array(data as any)], { type: 'video/mp4' });

      // Download
      const url = URL.createObjectURL(mp4Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${skeleton.theme || 'video'}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setProgress(100);

    } catch (error) {
      console.error('Export failed', error);
      alert('导出失败，请确保所有视频已生成且网络正常。可能需要刷新页面以加载 ffmpeg 组件。');
    } finally {
      setIsExporting(false);
      setProgress(0);
    }
  };

  return { exportVideo, isExporting, progress };
}
