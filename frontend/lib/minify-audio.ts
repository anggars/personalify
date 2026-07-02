export async function compressAudio(file: File): Promise<File> {
  // If it's already very small (under 2MB), just return it
  if (file.size < 2 * 1024 * 1024) return file;
  
  const MAX_DURATION = 60; // 60 seconds is enough for analysis

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
    
    // Convert to 16-bit PCM WAV
    const channelData = renderedBuffer.getChannelData(0);
    const wavBuffer = new ArrayBuffer(44 + channelData.length * 2);
    const view = new DataView(wavBuffer);
    
    const writeString = (view: DataView, offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };
    
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + channelData.length * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // 1 channel
    view.setUint32(24, renderedBuffer.sampleRate, true);
    view.setUint32(28, renderedBuffer.sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, channelData.length * 2, true);
    
    let offset = 44;
    for (let i = 0; i < channelData.length; i++, offset += 2) {
        let s = Math.max(-1, Math.min(1, channelData[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    
    const blob = new Blob([wavBuffer], { type: 'audio/wav' });
    const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + "_compressed.wav", {
        type: 'audio/wav'
    });
    
    return compressedFile;
  } catch (err) {
      console.error("Compression failed", err);
      throw new Error(`Audio Compression Failed: ${err}`);
  }
}
