"use server";

const HF_ENDPOINT = "https://anggars-neural-mathrock.hf.space/api/predict";
const REQUEST_TIMEOUT_MS = 120_000; // 2 minutes — model inference can be slow

export interface AnalyzerResult {
  mbti: Record<string, number>;
  emotions: Record<string, number>;
}

export interface AnalyzerResponse {
  success: boolean;
  data?: AnalyzerResult;
  error?: string;
}

/**
 * Convert a File/Blob to a base64 data URL string.
 * Gradio expects: "data:<mime>;base64,<payload>"
 */
async function fileToBase64DataUrl(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  const mime = file.type || "audio/wav";
  return `data:${mime};base64,${base64}`;
}

/**
 * Server action: analyze a track using the HF Spaces Gradio model.
 * Accepts FormData with optional "audio" (File) and "lyrics" (string).
 * At least one must be provided.
 */
export async function analyzeTrack(
  formData: FormData
): Promise<AnalyzerResponse> {
  try {
    const audioFile = formData.get("audio") as File | null;
    const lyrics = (formData.get("lyrics") as string) ?? "";

    // Validate: at least one input required
    const hasAudio = audioFile && audioFile.size > 0;
    const hasLyrics = lyrics.trim().length > 0;

    if (!hasAudio && !hasLyrics) {
      return {
        success: false,
        error: "Please provide at least an audio file or lyrics to analyze.",
      };
    }

    // Validate audio type if provided
    if (hasAudio) {
      const validTypes = [
        "audio/wav",
        "audio/x-wav",
        "audio/mpeg",
        "audio/mp3",
      ];
      if (!validTypes.includes(audioFile.type) && !audioFile.name.match(/\.(wav|mp3)$/i)) {
        return {
          success: false,
          error: "Invalid audio format. Please upload a .wav or .mp3 file.",
        };
      }

      // 50MB limit
      if (audioFile.size > 50 * 1024 * 1024) {
        return {
          success: false,
          error: "Audio file is too large. Maximum size is 50MB.",
        };
      }
    }

    // Build Gradio payload
    let audioPayload: string | null = null;
    if (hasAudio) {
      audioPayload = await fileToBase64DataUrl(audioFile);
    }

    const gradioPayload = {
      data: [audioPayload, hasLyrics ? lyrics : null],
    };

    // Call HF Spaces Gradio endpoint with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(HF_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(gradioPayload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error(`[Analyzer] HF API error ${response.status}:`, errorText);
      return {
        success: false,
        error: `Analysis service returned an error (${response.status}). Please try again later.`,
      };
    }

    const json = await response.json();

    // Gradio response format: { "data": [mbtiDict, emotionsDict], ... }
    if (!json.data || !Array.isArray(json.data) || json.data.length < 2) {
      console.error("[Analyzer] Unexpected response structure:", json);
      return {
        success: false,
        error: "Received an unexpected response from the analysis model.",
      };
    }

    const [mbtiRaw, emotionsRaw] = json.data;

    // Parse dictionaries — handle both object and stringified JSON
    const parseDictionary = (raw: unknown): Record<string, number> => {
      if (typeof raw === "string") {
        try {
          return JSON.parse(raw);
        } catch {
          return {};
        }
      }
      if (typeof raw === "object" && raw !== null) {
        return raw as Record<string, number>;
      }
      return {};
    };

    const mbti = parseDictionary(mbtiRaw);
    const emotions = parseDictionary(emotionsRaw);

    return {
      success: true,
      data: { mbti, emotions },
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      return {
        success: false,
        error:
          "Request timed out. The model might be loading — please try again in a moment.",
      };
    }
    console.error("[Analyzer] Unexpected error:", err);
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    };
  }
}
