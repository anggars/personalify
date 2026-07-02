export async function compressAudio(file: File): Promise<File> {
  // If it's already very small (under 2MB), just return it
  if (file.size < 2 * 1024 * 1024) return file;
  
  const MAX_DURATION = 30; // 30 seconds is more than enough for ML analysis
  const TARGET_SAMPLE_RATE = 16000; // 16kHz mono is standard for ML audio models

  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Decode the audio at its original sample rate
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Calculate how many samples to take (max 30 seconds) at original rate
    const duration = Math.min(audioBuffer.duration, MAX_DURATION);
    const originalSamples = Math.floor(duration * audioBuffer.sampleRate);
    
    // Downmix to mono at original sample rate first
    const offlineContext = new OfflineAudioContext(1, originalSamples, audioBuffer.sampleRate);
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start(0);
    
    const monoBuffer = await offlineContext.startRendering();
    
    // Now resample to target sample rate (16kHz)
    const monoData = monoBuffer.getChannelData(0);
    const ratio = audioBuffer.sampleRate / TARGET_SAMPLE_RATE;
    const newLength = Math.floor(monoData.length / ratio);
    const resampledData = new Float32Array(newLength);
    
    for (let i = 0; i < newLength; i++) {
      const srcIndex = i * ratio;
      const srcFloor = Math.floor(srcIndex);
      const srcCeil = Math.min(srcFloor + 1, monoData.length - 1);
      const frac = srcIndex - srcFloor;
      // Linear interpolation
      resampledData[i] = monoData[srcFloor] * (1 - frac) + monoData[srcCeil] * frac;
    }
    
    // Convert to 16-bit PCM WAV
    // At 16kHz mono 16-bit, 30 seconds = 16000 * 2 * 30 = 960,000 bytes (~937 KB)
    const wavBuffer = new ArrayBuffer(44 + resampledData.length * 2);
    const view = new DataView(wavBuffer);
    
    const writeString = (v: DataView, offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        v.setUint8(offset + i, str.charCodeAt(i));
      }
    };
    
    const dataSize = resampledData.length * 2;
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);          // chunk size
    view.setUint16(20, 1, true);           // PCM format
    view.setUint16(22, 1, true);           // 1 channel (mono)
    view.setUint32(24, TARGET_SAMPLE_RATE, true); // sample rate 16000
    view.setUint32(28, TARGET_SAMPLE_RATE * 2, true); // byte rate
    view.setUint16(32, 2, true);           // block align
    view.setUint16(34, 16, true);          // bits per sample
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);
    
    let offset = 44;
    for (let i = 0; i < resampledData.length; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, resampledData[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    
    const blob = new Blob([wavBuffer], { type: 'audio/wav' });
    const compressedFile = new File(
      [blob],
      file.name.replace(/\.[^/.]+$/, "") + "_compressed.wav",
      { type: 'audio/wav' }
    );

    console.log(`Compressed: ${(file.size / 1024 / 1024).toFixed(2)} MB -> ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`);
    
    return compressedFile;
  } catch (err) {
    console.error("Compression failed", err);
    throw new Error(`Audio Compression Failed: ${err}`);
  }
}
