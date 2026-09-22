/**
 * Global AI Settings & Gemini Client Service
 * Centralized API key and model management for SuperApp AI capabilities.
 */

const STORAGE_KEY_GEMINI_API_KEY = "mvd_gemini_api_key";
const STORAGE_KEY_GEMINI_MODEL = "mvd_gemini_model";

// Default key is empty — user must configure via Settings UI or localStorage
export const DEFAULT_GEMINI_API_KEY = "";
export const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite";

export const AVAILABLE_GEMINI_MODELS = [
  { id: "gemini-3.1-flash-lite", name: "Gemini 3.1 Flash Lite (Nhanh & Ổn định nhất - Khuyên dùng)" },
  { id: "gemini-3.6-flash", name: "Gemini 3.6 Flash (Thông minh, có suy luận)" },
  { id: "gemini-3-flash-preview", name: "Gemini 3.0 Flash Preview" },
  { id: "gemini-3.5-flash-lite", name: "Gemini 3.5 Flash Lite" },
];

export interface GeminiResponse {
  text: string;
  model: string;
  usage?: {
    promptTokens: number;
    candidatesTokens: number;
    totalTokens: number;
  };
}

class AiSettingsService {
  getApiKey(): string {
    const saved = localStorage.getItem(STORAGE_KEY_GEMINI_API_KEY);
    return saved && saved.trim().length > 0 ? saved.trim() : DEFAULT_GEMINI_API_KEY;
  }

  setApiKey(key: string): void {
    if (!key || !key.trim()) {
      localStorage.removeItem(STORAGE_KEY_GEMINI_API_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY_GEMINI_API_KEY, key.trim());
    }
  }

  getModel(): string {
    const saved = localStorage.getItem(STORAGE_KEY_GEMINI_MODEL);
    return saved && saved.trim().length > 0 ? saved.trim() : DEFAULT_GEMINI_MODEL;
  }

  setModel(model: string): void {
    localStorage.setItem(STORAGE_KEY_GEMINI_MODEL, model.trim());
  }

  resetToDefaults(): void {
    localStorage.removeItem(STORAGE_KEY_GEMINI_API_KEY);
    localStorage.removeItem(STORAGE_KEY_GEMINI_MODEL);
  }

  /**
   * Generates content using Google Gemini REST API
   */
  async generateContent(
    prompt: string,
    systemInstruction?: string,
    preferredModel?: string
  ): Promise<GeminiResponse> {
    const apiKey = this.getApiKey();
    const primaryModel = preferredModel || this.getModel();

    if (!apiKey) {
      throw new Error("Chưa cấu hình API Key của Google Gemini.");
    }

    // Models to try in order if the primary model is busy (503/429)
    const modelsToTry = [
      primaryModel,
      ...(primaryModel !== "gemini-3.1-flash-lite" ? ["gemini-3.1-flash-lite"] : []),
      "gemini-3-flash-preview",
      "gemini-3.6-flash",
      "gemini-3.5-flash-lite",
    ].filter((m, idx, arr) => arr.indexOf(m) === idx);

    let lastError: any = null;

    for (const model of modelsToTry) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const bodyPayload: any = {
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            topP: 0.95,
            maxOutputTokens: 8192, // Generous token limit to prevent cutoffs
            thinkingConfig: {
              thinkingBudget: 1024, // Controls reasoning budget so text response has ample room
            },
          },
        };

        if (systemInstruction) {
          bodyPayload.systemInstruction = {
            parts: [{ text: systemInstruction }],
          };
        }

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(bodyPayload),
        });

        if (!response.ok) {
          const errJson = await response.json().catch(() => ({}));
          const errMsg =
            errJson?.error?.message ||
            `Lỗi kết nối Gemini API (${response.status} ${response.statusText})`;
          // If 503 high demand or 429 rate limit, continue to next model fallback
          if (response.status === 503 || response.status === 429) {
            console.warn(`Mô hình ${model} đang bận (${response.status}), thử mô hình dự phòng...`);
            lastError = new Error(errMsg);
            continue;
          }
          throw new Error(errMsg);
        }

        const data = await response.json();
        const candidate = data?.candidates?.[0];
        
        // Extract all text parts, omitting thought blocks
        const parts = candidate?.content?.parts || [];
        const textParts = parts
          .filter((p: any) => typeof p.text === "string" && !p.thought)
          .map((p: any) => p.text);

        const rawText =
          textParts.length > 0
            ? textParts.join("\n")
            : parts[0]?.text || "";

        if (!rawText || !rawText.trim()) {
          throw new Error("Mô hình AI không trả về nội dung câu trả lời hợp lệ.");
        }

        return {
          text: rawText.trim(),
          model,
          usage: data?.usageMetadata
            ? {
                promptTokens: data.usageMetadata.promptTokenCount || 0,
                candidatesTokens: data.usageMetadata.candidatesTokenCount || 0,
                totalTokens: data.usageMetadata.totalTokenCount || 0,
              }
            : undefined,
        };
      } catch (err: any) {
        lastError = err;
        // If not a 503/429 error and we already parsed it, throw immediately
        if (!err.message?.includes("503") && !err.message?.includes("high demand") && !err.message?.includes("429")) {
          throw err;
        }
      }
    }

    throw lastError || new Error("Không thể kết nối tới mô hình AI Google Gemini.");
  }
}

export const aiSettingsService = new AiSettingsService();
