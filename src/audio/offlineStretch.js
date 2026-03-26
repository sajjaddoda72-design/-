import { SoundTouch, WebAudioBufferSource, SimpleFilter } from 'soundtouchjs';

export const stretchOffline = async (audioCtx, buffer, tempo, pitchSemitones, onProgress) => {
  return new Promise((resolve, reject) => {
    try {
      const soundtouch = new SoundTouch();
      soundtouch.tempo = tempo;
      soundtouch.pitchSemitones = pitchSemitones;

      const source = new WebAudioBufferSource(buffer);
      const filter = new SimpleFilter(source, soundtouch);

      let estimatedLength = Math.ceil(buffer.length / tempo) + 8192;
      let leftChannel = new Float32Array(estimatedLength);
      let rightChannel = new Float32Array(estimatedLength);
      
      let writeOffset = 0;
      const BUFFER_SIZE = 8192;
      const outSamples = new Float32Array(BUFFER_SIZE * 2);

      const processChunk = () => {
        const startTime = performance.now();
        let isDone = false;
        
        while (performance.now() - startTime < 16) {
          const framesExtracted = filter.extract(outSamples, BUFFER_SIZE);
          if (framesExtracted === 0) {
            isDone = true;
            break;
          }

          if (writeOffset + framesExtracted > leftChannel.length) {
            const newLength = Math.max(leftChannel.length * 1.5, writeOffset + framesExtracted + BUFFER_SIZE);
            const newL = new Float32Array(newLength);
            const newR = new Float32Array(newLength);
            newL.set(leftChannel);
            newR.set(rightChannel);
            leftChannel = newL;
            rightChannel = newR;
          }

          // Interleaved to non-interleaved
          for (let i = 0; i < framesExtracted; i++) {
            leftChannel[writeOffset + i] = outSamples[i * 2];
            rightChannel[writeOffset + i] = outSamples[i * 2 + 1];
          }
          writeOffset += framesExtracted;
        }

        if (onProgress) {
          onProgress(Math.min(100, (writeOffset / (buffer.length / tempo)) * 100));
        }

        if (isDone) {
          const outBuffer = audioCtx.createBuffer(2, writeOffset, buffer.sampleRate);
          outBuffer.getChannelData(0).set(leftChannel.subarray(0, writeOffset));
          outBuffer.getChannelData(1).set(rightChannel.subarray(0, writeOffset));
          resolve(outBuffer);
        } else {
          setTimeout(processChunk, 0);
        }
      };

      processChunk();
    } catch (e) {
      reject(e);
    }
  });
};