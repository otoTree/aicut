import { useState, useRef } from 'react';
import { VideoSkeleton } from '@/store/useStore';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { getResolution } from '@/lib/utils/aspect-ratio';

export function useVideoExporter() {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const ffmpegRef = useRef<FFmpeg | null>(null);

  const loadFFmpeg = async () => {
    if (ffmpegRef.current) return ffmpegRef.current;

    const ffmpeg = new FFmpeg();
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
      const resolution = getResolution(skeleton.aspectRatio);
      const [width, height] = resolution.split('x').map(Number);
      // Scale down to 720p equivalent to ensure performance while maintaining aspect ratio
      // Base scale on the smaller dimension to be 720
      const scale = 720 / Math.min(width, height);
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');

      // Setup Audio Context with user interaction check
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      
      // Ensure AudioContext is resumed (browser policy often suspends it until interaction)
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      
      const dest = audioCtx.createMediaStreamDestination();
      let sourceNode: MediaElementAudioSourceNode | null = null;

      // Fill black background initially
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Setup Recorder
      const canvasStream = canvas.captureStream(30); // 30 FPS
      const audioTrack = dest.stream.getAudioTracks()[0];
      const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...(audioTrack ? [audioTrack] : [])
      ]);

      // Try to use MP4 directly if supported (Safari), otherwise fallback to WebM
      const mimeType = MediaRecorder.isTypeSupported('video/mp4')
        ? 'video/mp4'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp9') 
          ? 'video/webm;codecs=vp9' 
          : 'video/webm';
      
      console.log('Using mimeType:', mimeType);
      
      const recorder = new MediaRecorder(combinedStream, { mimeType });
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      recorder.start();

      // Setup hidden video element
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.muted = false; // Must be unmuted to capture audio
      video.volume = 1.0;
      video.playsInline = true;
      
      // Critical: Connect video to audio context BEFORE setting src to ensure capture
      try {
        sourceNode = audioCtx.createMediaElementSource(video);
        sourceNode.connect(dest);
        // Also connect to destination to prevent "garbage collection" of audio processing
        // but gainNode with 0 gain to speakers to avoid double audio if needed, 
        // though here we just want it to go to 'dest' (MediaStream) for recording.
      } catch (e) {
        console.warn('Failed to create media element source', e);
      }

      video.style.position = 'fixed';
      video.style.top = '-9999px';
      video.style.left = '-9999px';
      document.body.appendChild(video);

      // Connect video audio to destination (Removed old block)

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
      sourceNode?.disconnect();
      audioCtx.close();
      recorder.stop();
      
      await new Promise<void>(resolve => {
          recorder.onstop = () => resolve();
      });

      // Download directly if already MP4 or if we should skip FFmpeg
      const isMp4Native = mimeType.includes('mp4');
      const canRunFFmpeg = typeof window !== 'undefined' && window.crossOriginIsolated;
      
      if (isMp4Native || !canRunFFmpeg) {
         if (!isMp4Native) {
           console.warn('Environment not cross-origin isolated or FFmpeg not supported. Skipping transcoding and downloading WebM.');
           // alert('当前环境不支持高性能转码，将直接下载 WebM 格式视频。');
         }

         const blob = new Blob(chunks, { type: mimeType });
         const url = URL.createObjectURL(blob);
         const a = document.createElement('a');
         a.href = url;
         a.download = `${skeleton.theme || 'video'}.${isMp4Native ? 'mp4' : 'webm'}`;
         document.body.appendChild(a);
         a.click();
         document.body.removeChild(a);
         URL.revokeObjectURL(url);
         
         setProgress(100);
         return;
      }

      // Convert to MP4 using FFmpeg (only if environment supports it)
      const webmBlob = new Blob(chunks, { type: 'video/webm' });
      
      try {
        // Load FFmpeg
        const ffmpeg = await loadFFmpeg();
        await ffmpeg.writeFile('input.webm', await fetchFile(webmBlob));

        // Transcode to MP4 with AAC audio
        setProgress(90);
        await ffmpeg.exec(['-i', 'input.webm', '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', 'output.mp4']);
        
        // Read output
        const data = await ffmpeg.readFile('output.mp4');
        const buffer = data as any; // ffmpeg.readFile returns Uint8Array | string, we need buffer
        const mp4Blob = new Blob([buffer], { type: 'video/mp4' });

        // Download
        const url = URL.createObjectURL(mp4Blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${skeleton.theme || 'video'}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (e) {
        console.error('FFmpeg transcoding failed, falling back to WebM', e);
        // Fallback to WebM
        const url = URL.createObjectURL(webmBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${skeleton.theme || 'video'}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      
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
