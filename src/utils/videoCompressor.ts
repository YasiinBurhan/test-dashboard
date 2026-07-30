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
  // If video is under 35MB, don't compress (Telegram API supports up to 50MB directly)
  if (file.size <= 35 * 1024 * 1024) {
    return file;
  }

  try {
    const compressionPromise = new Promise<File>(async (resolve, reject) => {
      try {
        const ffmpegInstance = await loadFFmpeg();
        
        ffmpegInstance.on('progress', ({ progress }) => {
          if (onProgress) onProgress(Math.min(0.99, progress));
        });

        const ext = file.name.split('.').pop() || 'mp4';
        const inputName = `input.${ext}`;
        const outputName = 'output.mp4';
        
        await ffmpegInstance.writeFile(inputName, await fetchFile(file));

        await ffmpegInstance.exec([
          '-i', inputName,
          '-vcodec', 'libx264',
          '-crf', '28',
          '-preset', 'ultrafast',
          '-vf', 'scale=-2:480',
          '-acodec', 'aac',
          '-b:a', '96k',
          outputName
        ]);

        const data = await ffmpegInstance.readFile(outputName);
        const blob = new Blob([data], { type: 'video/mp4' });
        
        resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".mp4", {
          type: 'video/mp4',
        }));
      } catch (err) {
        reject(err);
      }
    });

    // Timeout compression after 4 seconds to prevent long user waiting
    const timeoutPromise = new Promise<File>((resolve) => {
      setTimeout(() => {
        console.warn('Video compression timed out after 4 seconds, falling back to original file.');
        resolve(file);
      }, 4000);
    });

    return await Promise.race([compressionPromise, timeoutPromise]);
  } catch (error) {
    console.warn('Error or timeout during video compression, using original file:', error);
    return file;
  }
};
