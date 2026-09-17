// GymForge AI Food Scanner backend for Cloudflare Workers.
// IMPORTANT: Store the Gemini key as a Worker Secret named GEMINI_API_KEY.
// Never hard-code the API key in this file or in GitHub.

const ALLOWED_ORIGINS = new Set([
  'https://dynamicop-art.github.io',
  'http://localhost:5500',
  'http://127.0.0.1:5500'
]);

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://dynamicop-art.github.io',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      if (origin && !ALLOWED_ORIGINS.has(origin)) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method === 'GET') {
      return json({ ok: true, app: 'GymForge AI', status: 'ready', endpoint: '/analyze-food' }, 200, origin);
    }

    if (request.method !== 'POST' || url.pathname !== '/analyze-food') {
      return json({ error: 'Route not found' }, 404, origin);
    }

    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return json({ error: 'Origin not allowed' }, 403, origin);
    }

    if (!env.GEMINI_API_KEY) {
      return json({ error: 'Gemini API key is not configured' }, 500, origin);
    }

    try {
      const body = await request.json();
      let imageBase64 = body.imageBase64;
      let mimeType = body.mimeType || 'image/jpeg';
      const weightGrams = Number(body.weightGrams);

      if (!imageBase64) return json({ error: 'Food image is required' }, 400, origin);
      if (!weightGrams || weightGrams <= 0 || weightGrams > 5000) {
        return json({ error: 'Enter a valid food weight between 1 g and 5000 g' }, 400, origin);
      }

      if (imageBase64.startsWith('data:')) {
        const match = imageBase64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
        if (!match) return json({ error: 'Invalid image format' }, 400, origin);
        mimeType = match[1];
        imageBase64 = match[2];
      }

      if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
        return json({ error: 'Only JPG, PNG and WEBP images are supported' }, 400, origin);
      }

      const estimatedBytes = (imageBase64.length * 3) / 4;
      if (estimatedBytes > 6 * 1024 * 1024) {
        return json({ error: 'Image is too large. Please use an image below 6 MB.' }, 413, origin);
      }

      const prompt = `
You are GymForge AI Nutrition Coach.
Analyze the food shown in the image.
The user reports that the TOTAL edible food weight is approximately ${weightGrams} grams.

The user is an Indian user and meals may commonly include Bengali or Indian foods such as rice, roti, dal, fish curry, chicken curry, egg, potato, vegetables, paneer, soy chunks, curd, milk, banana, peanuts, chana and mixed Bengali meals.

Your job:
1. Identify every visible food item.
2. Estimate how the total ${weightGrams} g is distributed between visible foods.
3. Estimate nutrition for the ACTUAL reported portion.
4. Return calories, protein, carbohydrates, fat and fibre.
5. For curry or mixed food, consider reasonable oil/gravy usage.
6. Do not pretend the result is laboratory-accurate.
7. If oil, ingredients or preparation method cannot be known from the photo, mention this in assumptions.
8. Estimated item weights should approximately add up to the reported total weight.
9. Nutrition totals should approximately equal the sum of all detected items.
10. Use cooked-food values where appropriate.
Do not give medical advice.
Return only the requested structured nutrition information.`;

      const geminiResponse = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType, data: imageBase64 } }] }],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'OBJECT',
                properties: {
                  food_name: { type: 'STRING' },
                  confidence: { type: 'STRING', enum: ['low', 'medium', 'high'] },
                  total_weight_g: { type: 'NUMBER' },
                  items: {
                    type: 'ARRAY',
                    items: {
                      type: 'OBJECT',
                      properties: {
                        name: { type: 'STRING' },
                        estimated_weight_g: { type: 'NUMBER' },
                        calories_kcal: { type: 'NUMBER' },
                        protein_g: { type: 'NUMBER' },
                        carbs_g: { type: 'NUMBER' },
                        fat_g: { type: 'NUMBER' },
                        fiber_g: { type: 'NUMBER' }
                      },
                      required: ['name', 'estimated_weight_g', 'calories_kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g']
                    }
                  },
                  totals: {
                    type: 'OBJECT',
                    properties: {
                      calories_kcal: { type: 'NUMBER' },
                      protein_g: { type: 'NUMBER' },
                      carbs_g: { type: 'NUMBER' },
                      fat_g: { type: 'NUMBER' },
                      fiber_g: { type: 'NUMBER' }
                    },
                    required: ['calories_kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g']
                  },
                  assumptions: { type: 'ARRAY', items: { type: 'STRING' } }
                },
                required: ['food_name', 'confidence', 'total_weight_g', 'items', 'totals', 'assumptions']
              }
            }
          })
        }
      );

      const rawResponse = await geminiResponse.text();
      if (!geminiResponse.ok) {
        console.error('Gemini error:', rawResponse);
        return json({ error: 'Gemini could not analyse the food.', status: geminiResponse.status }, 502, origin);
      }

      const geminiData = JSON.parse(rawResponse);
      const modelText = geminiData?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';
      if (!modelText) return json({ error: 'AI returned an empty response.' }, 502, origin);

      return json({ ok: true, nutrition: JSON.parse(modelText) }, 200, origin);
    } catch (error) {
      console.error(error);
      return json({ error: 'Food analysis failed.', details: error.message }, 500, origin);
    }
  }
};
