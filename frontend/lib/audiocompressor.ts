// @ts-ignore
import lamejs from 'lamejs';

export async function compressAudio(file: File): Promise<File> {
  // If it's already very small (under 2MB), just return it
  if (file.size < 2 * 1024 * 1024) return file;
  
  const MAX_DURATION = 60; // 60 seconds is enough for analysis
  const TARGET_SAMPLE_RATE = 22050; // ML models work fine with 22kHz

  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Decode the audio
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Calculate how many samples to take (max 60 seconds)
    const duration = Math.min(audioBuffer.duration, MAX_DURATION);
    const lengthInSamples = Math.floor(duration * audioBuffer.sampleRate);
    
    // We only need 1 channel (mono) for the model
    const offlineContext = new OfflineAudioContext(1, lengthInSamples, audioBuffer.sampleRate);
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start(0);
    
    const renderedBuffer = await offlineContext.startRendering();
    
    // Resample if necessary to save more space, but lamejs can handle raw PCM.
    // Lamejs expects Int16 PCM data
    const channelData = renderedBuffer.getChannelData(0); // Float32Array from -1.0 to 1.0
    const int16Data = new Int16Array(channelData.length);
    for (let i = 0; i < channelData.length; i++) {
        // convert Float32 to Int16
        let s = Math.max(-1, Math.min(1, channelData[i]));
        int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    
    // Encode to MP3 at 96kbps
    const mp3Encoder = new lamejs.Mp3Encoder(1, renderedBuffer.sampleRate, 96);
    const mp3Data: any[] = [];
    
    const sampleBlockSize = 1152; // multiple of 576
    for (let i = 0; i < int16Data.length; i += sampleBlockSize) {
        const sampleChunk = int16Data.subarray(i, i + sampleBlockSize);
        const mp3buf = mp3Encoder.encodeBuffer(sampleChunk);
        if (mp3buf.length > 0) {
            mp3Data.push(mp3buf);
        }
    }
    
    const mp3buf = mp3Encoder.flush(); // finish encoding
    if (mp3buf.length > 0) {
        mp3Data.push(mp3buf);
    }
    
    const blob = new Blob(mp3Data, { type: 'audio/mp3' });
    const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + "_compressed.mp3", {
        type: 'audio/mp3'
    });
    
    return compressedFile;
  } catch (err) {
      console.error("Compression failed, returning original file", err);
      return file;
  }
}
