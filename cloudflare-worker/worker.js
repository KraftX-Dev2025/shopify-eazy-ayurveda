/**
 * Eazy Ayurveda — Claude Proxy Worker
 * Deployed on Cloudflare Workers (free tier).
 *
 * Secrets (set via wrangler secret put):
 *   ANTHROPIC_API_KEY — Anthropic API key
 *   EA_SECRET         — shared token sent by the Shopify page
 *
 * Protection layers:
 *   1. Origin lock — only eazy-ayurveda.myshopify.com
 *   2. Shared secret header — X-EA-Secret must match EA_SECRET
 *   3. Rate limiting — 10 requests / 60 s per IP (Cloudflare native)
 *   4. Prompt length cap — max 500 chars server-side
 */

const MAX_PROMPT_LEN = 500;

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

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-EA-Secret',
    'Access-Control-Max-Age': '86400',
  };
}

function reject(status, message, extraHeaders = {}) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(), ...extraHeaders },
  });
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';

    // ── CORS preflight ──────────────────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (request.method !== 'POST') {
      return reject(405, 'Method not allowed');
    }

    // ── 1. Shared secret ────────────────────────────────────────────────────
    const clientSecret = request.headers.get('X-EA-Secret') || '';
    if (!env.EA_SECRET || clientSecret !== env.EA_SECRET) {
      return reject(401, 'Unauthorized');
    }

    // ── 3. Rate limiting (10 req / 60 s per IP) ─────────────────────────────
    if (env.EA_RATE_LIMITER) {
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const { success } = await env.EA_RATE_LIMITER.limit({ key: ip });
      if (!success) {
        return reject(429, 'Too many requests. Please wait a moment.', {
          'Retry-After': '60',
        });
      }
    }

    // ── 4. Parse + validate body ────────────────────────────────────────────
    let prompt;
    try {
      const body = await request.json();
      prompt = (body?.prompt || '').trim().slice(0, MAX_PROMPT_LEN);
      if (!prompt) throw new Error('Empty prompt');
    } catch {
      return reject(400, 'Invalid request body');
    }

    // ── 5. Call Anthropic ───────────────────────────────────────────────────
    if (!env.ANTHROPIC_API_KEY) {
      return reject(500, 'API key not configured');
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
        return reject(502, 'Upstream error');
      }

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      });

    } catch (err) {
      console.error('Worker error:', err);
      return reject(500, 'Internal error');
    }
  },
};
