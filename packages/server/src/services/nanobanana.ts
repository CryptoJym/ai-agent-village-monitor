export class NanoBananaService {
    /**
     * Simulates generating an asset from a text prompt.
     * If NANOBANANA_API_KEY is present, it calls the OpenAI API (DALL-E 3).
     * Otherwise, it returns high-quality pre-generated assets for the demo.
     */
    async generateAsset(prompt: string): Promise<string> {
        console.log(`[NanoBanana] Generating asset for prompt: "${prompt}"`);

        // 1. Real API Mode
        if (process.env.NANOBANANA_API_KEY) {
            try {
                console.log('[NanoBanana] Using Real API (OpenAI DALL-E 3)...');
                const response = await fetch('https://api.openai.com/v1/images/generations', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${process.env.NANOBANANA_API_KEY}`,
                    },
                    body: JSON.stringify({
                        model: "dall-e-3",
                        prompt: prompt + ", top-down 2D RPG map, grid based, pixel art style, FF6 style",
                        n: 1,
                        size: "1024x1024",
                    }),
                });

                const data = await response.json();
                if (data.data && data.data[0]?.url) {
                    return data.data[0].url;
                } else {
                    console.error('[NanoBanana] API Error:', data);
                }
            } catch (e) {
                console.error('[NanoBanana] Request Failed:', e);
            }
        }

        // 2. Demo Mode (Local Assets)
        console.log('[NanoBanana] Using Local Demo Assets (Manifolds)...');
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate latency

        if (prompt.includes('dungeon') || prompt.includes('dangerous')) {
            return '/assets/generated/dungeon.png';
        } else if (prompt.includes('industrial') || prompt.includes('machine room')) {
            return '/assets/generated/industrial.png';
        } else if (prompt.includes('village')) {
            return '/assets/generated/village.png';
        } else {
            // Fallback to village for generic houses for now, or rotate
            return '/assets/generated/village.png';
        }
    }
}

export const nanoBanana = new NanoBananaService();
