export async function embedText(ollamaUrl: string, model: string, input: string): Promise<number[]> {
  const response = await fetch(ollamaUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model, input })
  });

  if (!response.ok) {
    throw new Error(`Embedding request failed: ${response.status}`);
  }

  const payload = (await response.json()) as { embedding?: number[] };
  if (!payload.embedding || payload.embedding.length !== 768) {
    throw new Error("Embedding response did not include a 768-dimension vector");
  }

  return payload.embedding;
}
