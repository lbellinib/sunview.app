const birthInput = document.getElementById('birth-date');
const spanInput = document.getElementById('life-span');
const spanOutput = document.getElementById('life-span-output');
const percentEl = document.getElementById('life-percent');
const daysLivedEl = document.getElementById('days-lived');
const daysRemainingEl = document.getElementById('days-remaining');
const horizonEl = document.getElementById('projected-horizon');
const noteEl = document.getElementById('clock-note');
const ringProgress = document.querySelector('.ring--progress');
const copyrightYear = document.getElementById('copyright-year');

const CIRCUMFERENCE = 2 * Math.PI * 90;

const formatNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const formatDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'long' });

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function updateSpanOutput() {
  spanOutput.textContent = `${spanInput.value} years`;
}

function updateClock() {
  updateSpanOutput();

  if (!birthInput.value) {
    percentEl.textContent = '0%';
    daysLivedEl.textContent = '—';
    daysRemainingEl.textContent = '—';
    horizonEl.textContent = '—';
    ringProgress.style.strokeDashoffset = CIRCUMFERENCE;
    ringProgress.style.stroke = 'var(--accent)';
    noteEl.textContent = 'Set your details to begin the reflection.';
    return;
  }

  const birthDate = new Date(birthInput.value);
  if (Number.isNaN(birthDate.getTime())) {
    noteEl.textContent = 'Please enter a valid birth date to continue.';
    percentEl.textContent = '0%';
    daysLivedEl.textContent = '—';
    daysRemainingEl.textContent = '—';
    horizonEl.textContent = '—';
    ringProgress.style.strokeDashoffset = CIRCUMFERENCE;
    ringProgress.style.stroke = 'var(--accent)';
    return;
  }

  const expectancyYears = Number.parseInt(spanInput.value, 10);
  const now = new Date();
  const nowMs = now.getTime();
  const birthMs = birthDate.getTime();
  const lifespanMs = expectancyYears * 365.25 * 24 * 60 * 60 * 1000;
  const endMs = birthMs + lifespanMs;

  let livedMs = nowMs - birthMs;
  if (livedMs < 0) {
    livedMs = 0;
  }
  const remainingMs = Math.max(endMs - nowMs, 0);

  let percent = livedMs / lifespanMs;
  percent = Number.isFinite(percent) ? percent : 0;
  const boundedPercent = clamp(percent, 0, 1);

  const dashoffset = CIRCUMFERENCE * (1 - boundedPercent);
  ringProgress.style.strokeDashoffset = dashoffset;

  const hue = 38 - boundedPercent * 130;
  ringProgress.style.stroke = `hsl(${hue}, 82%, 68%)`;

  percentEl.textContent = `${Math.round(percent * 1000) / 10}%`;
  daysLivedEl.textContent = formatNumber.format(Math.max(0, Math.round(livedMs / (24 * 60 * 60 * 1000))));
  daysRemainingEl.textContent = formatNumber.format(Math.round(remainingMs / (24 * 60 * 60 * 1000)));
  horizonEl.textContent = formatDate.format(new Date(endMs));

  if (percent >= 1) {
    noteEl.textContent = 'You have already lived beyond this chosen horizon. How might you redefine the span ahead?';
  } else if (percent > 0.66) {
    noteEl.textContent = 'The arc is luminous and finite. What promises deserve the light of your remaining days?';
  } else if (percent > 0.33) {
    noteEl.textContent = 'You are in the wide middle. Notice the textures of today before they slip into memory.';
  } else {
    noteEl.textContent = 'The canvas stretches ahead. Lay down the colors you wish to remember.';
  }
}

function tick() {
  if (!birthInput.value) return;
  updateClock();
}

spanInput.addEventListener('input', updateClock);
birthInput.addEventListener('input', updateClock);

updateClock();
setInterval(tick, 60 * 1000);

if (copyrightYear) {
  copyrightYear.textContent = new Date().getFullYear();
}
