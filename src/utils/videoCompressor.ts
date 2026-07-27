import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;
let isFfmpegLoading = false;

export const loadFFmpeg = async (): Promise<FFmpeg> => {
  if (ffmpeg) return ffmpeg;
  if (isFfmpegLoading) {
    // Wait until it's loaded if already loading
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (ffmpeg) {
          clearInterval(check);
          resolve(ffmpeg);
        }
      }, 100);
    });
  }

  isFfmpegLoading = true;
  const ffmpegInstance = new FFmpeg();
  
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  
  await ffmpegInstance.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  ffmpeg = ffmpegInstance;
  isFfmpegLoading = false;
  return ffmpegInstance;
};

export const compressVideo = async (
  file: File, 
  onProgress?: (progress: number) => void
): Promise<File> => {
  // If video is small (< 10MB), don't compress
  if (file.size < 10 * 1024 * 1024) {
    return file;
  }

  try {
    const ffmpegInstance = await loadFFmpeg();
    
    ffmpegInstance.on('progress', ({ progress }) => {
      if (onProgress) onProgress(progress);
    });

    const inputName = 'input.mp4';
    const outputName = 'output.mp4';
    
    await ffmpegInstance.writeFile(inputName, await fetchFile(file));

    // Target 720p, H264, AAC, 1Mbps bitrate, keep quality reasonable
    await ffmpegInstance.exec([
      '-i', inputName,
      '-vcodec', 'libx264',
      '-b:v', '1M',
      '-maxrate', '1M',
      '-bufsize', '2M',
      '-vf', 'scale=-2:720',
      '-acodec', 'aac',
      '-b:a', '128k',
      '-preset', 'fast',
      outputName
    ]);

    const data = await ffmpegInstance.readFile(outputName);
    const blob = new Blob([data], { type: 'video/mp4' });
    
    return new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".mp4", {
      type: 'video/mp4',
    });
  } catch (error) {
    console.error('Error compressing video:', error);
    // Fallback to original file on error
    return file;
  }
};
