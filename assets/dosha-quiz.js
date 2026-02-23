/**
 * Dosha Quiz — Eazy Ayurveda
 * Fully client-side. No API call required.
 * Scores V / P / K per question, determines dominant dosha.
 */

// ─── Quiz data ─────────────────────────────────────────────────────────────
const QUESTIONS = [
  {
    question: 'What best describes your natural body frame?',
    options: [
      { text: 'Lean and light — hard to gain weight',           dosha: 'V' },
      { text: 'Medium build, well-proportioned, athletic',      dosha: 'P' },
      { text: 'Broad or solid — gains weight easily',           dosha: 'K' },
    ],
  },
  {
    question: 'How is your digestion usually?',
    options: [
      { text: 'Irregular — sometimes fine, sometimes off',               dosha: 'V' },
      { text: 'Strong — I get irritable if meals are delayed',           dosha: 'P' },
      { text: 'Slow but steady — I rarely feel very hungry',             dosha: 'K' },
    ],
  },
  {
    question: 'How do you typically sleep?',
    options: [
      { text: 'Light sleeper — restless, wake up early or often',        dosha: 'V' },
      { text: 'Moderate — clear dreams, feel alert on waking',           dosha: 'P' },
      { text: 'Deep and heavy — could sleep long hours easily',          dosha: 'K' },
    ],
  },
  {
    question: 'How do you respond to stress?',
    options: [
      { text: 'Anxious and scattered — my mind races',                   dosha: 'V' },
      { text: 'Intense and irritable — I push through it',               dosha: 'P' },
      { text: 'Calm at first, then I withdraw or go quiet',              dosha: 'K' },
    ],
  },
  {
    question: 'What best describes your skin?',
    options: [
      { text: 'Dry, thin, rough — prone to flaking or cracking',        dosha: 'V' },
      { text: 'Warm, sensitive — prone to redness or breakouts',        dosha: 'P' },
      { text: 'Smooth, oily, thick — rarely dries out',                 dosha: 'K' },
    ],
  },
];

const DOSHA_DATA = {
  V: {
    name:     'Vata 🌬️',
    desc:     'You are governed by Air & Space — creative, quick, and full of ideas. You thrive with warmth, grounding routines, and nourishing foods.',
    color:    'vata',
    products: [
      { icon: '💪', name: 'Chyawanprash' },
      { icon: '🌬️', name: 'AmrutDhara' },
    ],
  },
  P: {
    name:     'Pitta 🔥',
    desc:     'You are governed by Fire & Water — passionate, focused, and driven. You thrive when you cool down, slow down, and find balance.',
    color:    'pitta',
    products: [
      { icon: '🌿', name: 'Acidity Churan' },
      { icon: '🍋', name: 'Amla Candy' },
    ],
  },
  K: {
    name:     'Kapha 🌊',
    desc:     'You are governed by Earth & Water — steady, nurturing, and strong. You thrive with movement, stimulation, and light, warming foods.',
    color:    'kapha',
    products: [
      { icon: '🩸', name: 'Madhuhari Churan' },
      { icon: '🌱', name: 'Sitopaladi Churan' },
    ],
  },
};

// ─── State ─────────────────────────────────────────────────────────────────
let currentQ       = 0;
let scores         = { V: 0, P: 0, K: 0 };
let selectedOption = null;

// ─── DOM refs ──────────────────────────────────────────────────────────────
const $hero         = document.getElementById('ea-dq-hero');
const $quiz         = document.getElementById('ea-dq-quiz');
const $result       = document.getElementById('ea-dq-result');
const $startBtn     = document.getElementById('ea-dq-start');
const $slide        = document.getElementById('ea-dq-slide');
const $question     = document.getElementById('ea-dq-question');
const $options      = document.getElementById('ea-dq-options');
const $nextBtn      = document.getElementById('ea-dq-next');
const $progressFill = document.getElementById('ea-dq-progress-fill');
const $progressLbl  = document.getElementById('ea-dq-progress-label');
const $doshaName    = document.getElementById('ea-dq-dosha-name');
const $doshaDesc    = document.getElementById('ea-dq-dosha-desc');
const $prodGrid     = document.getElementById('ea-dq-products-grid');
const $waBtn        = document.getElementById('ea-dq-whatsapp');
const $retakeBtn    = document.getElementById('ea-dq-retake');

// ─── Render question ───────────────────────────────────────────────────────
function renderQuestion(index) {
  const q = QUESTIONS[index];
  selectedOption = null;
  $nextBtn.disabled = true;

  // Progress
  const pct = Math.round(((index) / QUESTIONS.length) * 100);
  $progressFill.style.width = `${pct}%`;
  $progressLbl.textContent  = `Step ${index + 1} of ${QUESTIONS.length}`;

  // Re-trigger slide animation
  $slide.style.animation = 'none';
  requestAnimationFrame(() => {
    $slide.style.animation = '';
  });

  $question.textContent = q.question;
  $options.innerHTML    = '';

  q.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.type      = 'button';
    btn.className = 'ea-dq-option';
    btn.textContent = opt.text;
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', 'false');
    btn.dataset.dosha = opt.dosha;
    btn.dataset.idx   = i;

    btn.addEventListener('click', () => {
      // Deselect all
      $options.querySelectorAll('.ea-dq-option').forEach(b => {
        b.classList.remove('ea-dq-option--selected');
        b.setAttribute('aria-checked', 'false');
      });
      // Select clicked
      btn.classList.add('ea-dq-option--selected');
      btn.setAttribute('aria-checked', 'true');
      selectedOption = opt.dosha;
      $nextBtn.disabled = false;
    });

    $options.appendChild(btn);
  });
}

// ─── Advance ───────────────────────────────────────────────────────────────
function advance() {
  if (!selectedOption) return;
  scores[selectedOption]++;
  currentQ++;

  if (currentQ < QUESTIONS.length) {
    renderQuestion(currentQ);
  } else {
    showResult();
  }
}

// ─── Show result ───────────────────────────────────────────────────────────
function showResult() {
  // Determine winner
  const dominant = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
  const data     = DOSHA_DATA[dominant];

  // Update result section
  $result.className = `ea-dq-result ea-dq-result--${data.color}`;
  $doshaName.textContent = data.name;
  $doshaDesc.textContent = data.desc;

  // Product cards
  $prodGrid.innerHTML = data.products.map(p => `
    <div class="ea-dq-prod-card">
      <span class="ea-dq-prod-card__icon" aria-hidden="true">${p.icon}</span>
      <p class="ea-dq-prod-card__name">${p.name}</p>
    </div>
  `).join('');

  // WhatsApp share
  const shareText = encodeURIComponent(
    `I just took the Eazy Ayurveda Dosha Quiz and discovered I'm ${data.name}!\n` +
    `My recommended products: ${data.products.map(p => p.name).join(' & ')}.\n` +
    `Find yours at eazy-ayurveda.myshopify.com/pages/dosha-quiz`
  );
  $waBtn.href = `https://wa.me/?text=${shareText}`;

  // Hide quiz, show result
  $quiz.setAttribute('aria-hidden', 'true');
  $result.setAttribute('aria-hidden', 'false');
  $result.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── Start quiz ────────────────────────────────────────────────────────────
function startQuiz() {
  currentQ       = 0;
  scores         = { V: 0, P: 0, K: 0 };
  selectedOption = null;

  renderQuestion(0);
  $hero.style.display = 'none';
  $quiz.setAttribute('aria-hidden', 'false');
  $result.setAttribute('aria-hidden', 'true');
  $quiz.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── Retake ────────────────────────────────────────────────────────────────
function retakeQuiz() {
  $result.setAttribute('aria-hidden', 'true');
  $hero.style.display = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Event listeners ───────────────────────────────────────────────────────
$startBtn.addEventListener('click',  startQuiz);
$nextBtn.addEventListener('click',   advance);
$retakeBtn.addEventListener('click', retakeQuiz);
