const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
const preferredModel = process.env.OLLAMA_MODEL ?? "gemma3:4b";

interface OllamaModel {
  name: string;
}

interface OllamaTags {
  models?: OllamaModel[];
}

const modelFamilies = ["gemma", "llama", "qwen", "mistral", "phi"];

export async function resolveLocalCoachModel() {
  const response = await fetch(`${baseUrl}/api/tags`, {
    cache: "no-store",
    signal: AbortSignal.timeout(3_500),
  });
  if (!response.ok) throw new Error("Local Ollama is not available.");
  const payload = await response.json() as OllamaTags;
  const installed = payload.models?.map((item) => item.name).filter(Boolean) ?? [];
  if (!installed.length) {
    throw new Error("Ollama is running, but no local chat model is installed.");
  }
  if (installed.includes(preferredModel)) return preferredModel;
  return installed.find((name) =>
    modelFamilies.some((family) => name.toLowerCase().includes(family)),
  ) ?? installed[0];
}

export async function createLocalCoachStream(
  system: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  signal: AbortSignal,
) {
  const model = await resolveLocalCoachModel();
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      stream: true,
      keep_alive: "10m",
      options: { temperature: 0.3, num_predict: 700 },
      messages: [{ role: "system", content: system }, ...messages],
    }),
    signal,
  });
  if (!response.ok || !response.body) {
    const payload = await response.text().catch(() => "");
    throw new Error(payload || `Local model request failed (${response.status}).`);
  }

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = response.body!.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const chunk = JSON.parse(line) as {
              message?: { content?: string };
              error?: string;
            };
            if (chunk.error) throw new Error(chunk.error);
            if (chunk.message?.content) {
              controller.enqueue(encoder.encode(chunk.message.content));
            }
          }
        }
        if (buffer.trim()) {
          const chunk = JSON.parse(buffer) as {
            message?: { content?: string };
            error?: string;
          };
          if (chunk.error) throw new Error(chunk.error);
          if (chunk.message?.content) {
            controller.enqueue(encoder.encode(chunk.message.content));
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
  });

  return { model, stream };
}

