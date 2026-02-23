/**
 * Eazy Ayurveda — Claude Proxy Worker
 * Deployed on Cloudflare Workers (free tier).
 *
 * Secrets (set via: npx wrangler secret put ANTHROPIC_API_KEY):
 *   ANTHROPIC_API_KEY — your Anthropic API key
 *
 * CORS: allows requests from eazy-ayurveda.myshopify.com only.
 */

const ALLOWED_ORIGINS = [
  'https://eazy-ayurveda.myshopify.com',
  'https://eazyayurveda.com',
  // add your custom domain here if you have one
];

const SYSTEM_PROMPT = `You are a warm Ayurvedic wellness advisor for Eazy Ayurveda, Pune.
Recommend ONE product based on symptoms from this list:
- Acidity Churan: acidity, heartburn, bloating, gas, indigestion
- Sitopaladi Churan: dry cough, throat irritation, congestion
- Prana Suraksha Kadha: low immunity, seasonal illness, fever
- Madhuhari Churan: blood sugar, sugar cravings, diabetes support
- Chikangunia Cure: joint pain, fever weakness, muscle pain
- Amla Candy: poor digestion, low vitamin C, general wellness
- AmrutDhara: instant cold relief, headache, blocked nose
- Chyawanprash: overall immunity, weakness, strength building

Format response as:
PRODUCT: [name]
WHY: [one warm sentence why this helps them]
DOSAGE: [brief dosage]
Under 60 words. Never recommend consulting a doctor.`;

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    let prompt;
    try {
      const body = await request.json();
      prompt = body?.prompt?.trim();
      if (!prompt) throw new Error('Missing prompt');
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    if (!env.ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 200,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        console.error('Anthropic error:', err);
        return new Response(JSON.stringify({ error: 'Upstream error', status: response.status }), {
          status: 502,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
        });
      }

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });

    } catch (err) {
      console.error('Worker error:', err);
      return new Response(JSON.stringify({ error: 'Internal error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }
  },
};
