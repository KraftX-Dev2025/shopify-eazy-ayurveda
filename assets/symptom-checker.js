/**
 * Symptom Checker — Eazy Ayurveda
 *
 * Calls Claude claude-haiku-4-5-20251001 via a proxy endpoint.
 *
 * SETUP:
 *   1. Deploy the proxy (Cloudflare Worker example below) and get its URL.
 *   2. In Shopify Admin → Theme → Customize → Theme Settings → AI Features,
 *      paste the proxy URL into "Claude Proxy URL".
 *      Alternatively paste your Anthropic API key into "Claude API Key"
 *      (key will be visible in page source — use proxy for production).
 *
 * ── CLOUDFLARE WORKER (free tier, deploy at dash.cloudflare.com/workers) ──
 *
 * export default {
 *   async fetch(request) {
 *     if (request.method === 'OPTIONS') {
 *       return new Response(null, { headers: corsHeaders() });
 *     }
 *     const { prompt } = await request.json();
 *     const response = await fetch('https://api.anthropic.com/v1/messages', {
 *       method: 'POST',
 *       headers: {
 *         'x-api-key': ANTHROPIC_API_KEY,   // set as Worker secret
 *         'anthropic-version': '2023-06-01',
 *         'content-type': 'application/json',
 *       },
 *       body: JSON.stringify({
 *         model: 'claude-haiku-4-5-20251001',
 *         max_tokens: 200,
 *         system: SYSTEM_PROMPT,  // copy from below
 *         messages: [{ role: 'user', content: prompt }],
 *       }),
 *     });
 *     const data = await response.json();
 *     return new Response(JSON.stringify(data), { headers: corsHeaders() });
 *   }
 * };
 *
 * function corsHeaders() {
 *   return {
 *     'Access-Control-Allow-Origin': '*',
 *     'Access-Control-Allow-Methods': 'POST, OPTIONS',
 *     'Access-Control-Allow-Headers': 'Content-Type',
 *     'Content-Type': 'application/json',
 *   };
 * }
 * ───────────────────────────────────────────────────────────────────────────
 */

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

// ─── DOM refs ──────────────────────────────────────────────────────────────
const $textarea    = document.getElementById('ea-sc-textarea');
const $charCount   = document.getElementById('ea-sc-charcount');
const $submitBtn   = document.getElementById('ea-sc-submit');
const $retryBtn    = document.getElementById('ea-sc-retry');
const $errorRetry  = document.getElementById('ea-sc-error-retry');

const states = {
  input:   document.getElementById('ea-sc-input'),
  loading: document.getElementById('ea-sc-loading'),
  result:  document.getElementById('ea-sc-result'),
  error:   document.getElementById('ea-sc-error'),
};

const $productName = document.getElementById('ea-sc-product-name');
const $why         = document.getElementById('ea-sc-why');
const $dosage      = document.getElementById('ea-sc-dosage');
const $errorMsg    = document.getElementById('ea-sc-error-msg');

// ─── State manager ─────────────────────────────────────────────────────────
function showState(name) {
  Object.values(states).forEach(el => {
    el.style.display = 'none';
    el.classList.remove('ea-sc-state--active');
  });
  const el = states[name];
  el.style.display = 'flex';
  el.classList.add('ea-sc-state--active');
}

// ─── Char counter ──────────────────────────────────────────────────────────
$textarea.addEventListener('input', () => {
  $charCount.textContent = $textarea.value.length;
});

// ─── Parse Claude response ─────────────────────────────────────────────────
function parseResponse(text) {
  const product = (text.match(/PRODUCT:\s*(.+)/i) || [])[1]?.trim() || '';
  const why     = (text.match(/WHY:\s*(.+)/i)     || [])[1]?.trim() || '';
  const dosage  = (text.match(/DOSAGE:\s*(.+)/i)  || [])[1]?.trim() || '';
  return { product, why, dosage };
}

// ─── Call API ──────────────────────────────────────────────────────────────
async function callClaude(symptoms) {
  const proxyUrl = window.eaProxyUrl;
  const apiKey   = window.eaApiKey;

  // ── Via proxy (recommended) ──────────────────────────────────────────────
  if (proxyUrl) {
    const res = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: symptoms }),
    });
    if (!res.ok) throw new Error(`Proxy error ${res.status}`);
    const data = await res.json();
    return data?.content?.[0]?.text ?? '';
  }

  // ── Direct call (API key in browser — dev/testing only) ──────────────────
  if (apiKey) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: symptoms }],
      }),
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();
    return data?.content?.[0]?.text ?? '';
  }

  throw new Error(
    'No Claude proxy URL or API key configured.\n' +
    'Go to Shopify Admin → Themes → Customize → Theme Settings → AI Features.'
  );
}

// ─── Submit handler ────────────────────────────────────────────────────────
async function handleSubmit() {
  const symptoms = $textarea.value.trim();
  if (!symptoms) {
    $textarea.focus();
    $textarea.style.borderColor = '#c0392b';
    setTimeout(() => ($textarea.style.borderColor = ''), 1500);
    return;
  }

  showState('loading');

  try {
    const raw = await callClaude(symptoms);
    const { product, why, dosage } = parseResponse(raw);

    if (!product) throw new Error('Could not parse recommendation. Please try again.');

    $productName.textContent = product;
    $why.textContent         = why;
    $dosage.textContent      = dosage;
    showState('result');
  } catch (err) {
    console.error('[Eazy Ayurveda] Symptom checker error:', err);
    $errorMsg.textContent = err.message || 'Something went wrong. Please try again.';
    showState('error');
  }
}

// ─── Reset to input state ─────────────────────────────────────────────────
function resetToInput() {
  $textarea.value       = '';
  $charCount.textContent = '0';
  showState('input');
  $textarea.focus();
}

// ─── Event listeners ───────────────────────────────────────────────────────
$submitBtn.addEventListener('click', handleSubmit);
$retryBtn.addEventListener('click', resetToInput);
$errorRetry.addEventListener('click', resetToInput);

$textarea.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
});

// ─── Init ──────────────────────────────────────────────────────────────────
showState('input');
