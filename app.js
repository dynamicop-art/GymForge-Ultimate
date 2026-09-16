const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const todayKey = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const fmtDate = (date) => new Date(date + 'T00:00:00').toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
const STORE = 'gymforge_v2';
const AI_ENDPOINT = String(window.GYMFORGE_AI_ENDPOINT || 'https://gymforge-ai.arpanalaps64.workers.dev').replace(/\/$/, '');

const workoutPlan = [
  { name: 'Push A', focus: 'Chest + Shoulder + Triceps', ex: [['Bench Press', 4, '6–8'], ['Incline DB Press', 3, '8–10'], ['Shoulder Press', 3, '8–10'], ['Lateral Raise', 3, '12–15'], ['Triceps Pushdown', 3, '10–12']] },
  { name: 'Pull A', focus: 'Back + Biceps', ex: [['Lat Pulldown / Pull-up', 4, '8–10'], ['Barbell Row', 3, '8–10'], ['Seated Cable Row', 3, '10–12'], ['Face Pull', 3, '12–15'], ['Barbell Curl', 3, '10–12'], ['Hammer Curl', 2, '10–12']] },
  { name: 'Legs A', focus: 'Quads dominant', ex: [['Squat', 4, '6–8'], ['Leg Press', 3, '10–12'], ['Leg Extension', 3, '12–15'], ['Leg Curl', 3, '10–12'], ['Calf Raise', 4, '12–15'], ['Abs', 3, '12–15']] },
  { name: 'Push B', focus: 'Chest + Shoulder + Triceps', ex: [['Incline Bench', 4, '6–10'], ['Machine / DB Chest Press', 3, '8–12'], ['Cable Fly', 3, '12–15'], ['DB Shoulder Press', 3, '8–10'], ['Lateral Raise', 3, '15–20'], ['Overhead Triceps Extension', 3, '10–12']] },
  { name: 'Pull B', focus: 'Back + Biceps', ex: [['Pull-up / Lat Pulldown', 3, '8–12'], ['Chest-supported Row', 4, '8–12'], ['One-arm DB Row', 3, '10–12'], ['Rear Delt Fly', 3, '12–15'], ['Preacher Curl', 3, '10–12'], ['Hammer Curl', 3, '10–12']] },
  { name: 'Legs B', focus: 'Hamstrings + Glutes', ex: [['Romanian Deadlift', 4, '6–10'], ['Bulgarian Split Squat', 3, '8–10'], ['Leg Curl', 3, '10–15'], ['Leg Press', 3, '10–12'], ['Calf Raise', 4, '12–20'], ['Plank', 3, '45–60s']] },
];

const dietPlan = [
  ['Breakfast', '3 eggs (2 whole + 1 white), 3–4 roti or oats, 250 ml milk'],
  ['Mid-morning', '1 fruit + 30–40 g roasted chana/peanuts'],
  ['Lunch', '2–2.5 cups rice + dal + vegetables + 120–150 g chicken/fish + salad'],
  ['Pre-workout', '1 banana + 2 bread or boiled potato; tea/coffee optional'],
  ['Post-workout', '250–300 ml milk + 2 eggs, or curd + banana'],
  ['Dinner', 'Rice/3–4 roti + 120–150 g fish/chicken + dal + vegetables'],
  ['Before bed', '1 glass milk or 100–150 g curd'],
];

// Approximate values only. These are used to suggest easy Bengali/Indian meal options.
const coachFoods = [
  { name: '150 g chicken + 1 cup cooked rice', cal: 455, protein: 50, carbs: 45, fat: 6, note: 'High-protein full meal' },
  { name: '50 g soy chunks + 2 roti', cal: 395, protein: 33, carbs: 59, fat: 5, note: 'Budget vegetarian protein' },
  { name: '2 eggs + 250 ml milk + 1 banana', cal: 395, protein: 21, carbs: 40, fat: 18, note: 'Easy shake-side combo' },
  { name: '1 bowl dal + 1 cup rice + 100 g curd', cal: 446, protein: 18, carbs: 80, fat: 7, note: 'Simple Bengali home meal' },
  { name: '150 g fish curry + 2 roti', cal: 430, protein: 36, carbs: 42, fat: 13, note: 'Balanced dinner option' },
  { name: '30 g peanuts + 250 ml milk + banana', cal: 425, protein: 16, carbs: 45, fat: 22, note: 'Calorie top-up' },
  { name: '3 eggs + 2 roti', cal: 430, protein: 25, carbs: 43, fat: 19, note: 'Fast protein meal' },
  { name: '100 g paneer + 2 roti', cal: 485, protein: 25, carbs: 44, fat: 24, note: 'Vegetarian calorie + protein option' },
];

const defaults = {
  profile: { name: 'Vishwayan', weight: 57, height: 174, target: 60, calories: 2450, protein: 105, carbs: 330, fat: 65, startWeight: 57 },
  recovery: { sleep: 8, water: 2.2, waterTarget: 3 },
  weights: [{ id: uid(), date: todayKey(), value: 57 }],
  measurements: [],
  prs: [],
  notes: [],
  clients: [],
  plans: [],
  workouts: [],
  meals: {},
  setLogs: {},
  settings: { coachSuggestionOffset: 0, lastCoachNotification: '' },
};

let state = load();
let selectedWorkout = new Date().getDay() === 0 ? 0 : (new Date().getDay() - 1) % 6;
let modalHandler = null;
let deferredPrompt = null;
let sessionSeconds = 0;
let sessionInt = null;
let restSeconds = 90;
let restDefault = 90;
let restInt = null;
let currentAiImageData = '';
let aiHealthy = null;
let fb = null;
let cloudTimer = null;

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function esc(value = '') {
  return String(value).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
}

function load() {
  try {
    const oldV2 = JSON.parse(localStorage.getItem(STORE) || 'null');
    const oldV1 = JSON.parse(localStorage.getItem('gymforge_v1') || 'null');
    const saved = oldV2 || oldV1 || {};
    const merged = { ...clone(defaults), ...saved };
    merged.profile = { ...clone(defaults.profile), ...(saved.profile || {}) };
    merged.recovery = { ...clone(defaults.recovery), ...(saved.recovery || {}) };
    merged.settings = { ...clone(defaults.settings), ...(saved.settings || {}) };
    return merged;
  } catch {
    return clone(defaults);
  }
}

function save({ silent = false } = {}) {
  localStorage.setItem(STORE, JSON.stringify(state));
  renderAll();
  cloudSaveDebounced();
  maybeAutoNutritionNotification();
  if (!silent) updateNotificationStatus();
}

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2200);
}

function dayMeals() {
  return state.meals[todayKey()] || [];
}

function macroTotals() {
  return dayMeals().reduce(
    (acc, meal) => ({
      cal: acc.cal + (+meal.cal || 0),
      protein: acc.protein + (+meal.protein || 0),
      carbs: acc.carbs + (+meal.carbs || 0),
      fat: acc.fat + (+meal.fat || 0),
      fiber: acc.fiber + (+meal.fiber || 0),
    }),
    { cal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
  );
}

function remainingMacros() {
  const t = macroTotals();
  const p = state.profile;
  return {
    cal: Math.max(0, p.calories - t.cal),
    protein: Math.max(0, p.protein - t.protein),
    carbs: Math.max(0, p.carbs - t.carbs),
    fat: Math.max(0, p.fat - t.fat),
    rawCal: p.calories - t.cal,
    rawProtein: p.protein - t.protein,
  };
}

function weekWorkouts() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  start.setHours(0, 0, 0, 0);
  return state.workouts.filter((w) => new Date(w.date + 'T00:00:00') >= start).length;
}

function streak() {
  const days = [...new Set(state.workouts.map((w) => w.date))].sort().reverse();
  let s = 0;
  const d = new Date();
  for (let i = 0; i < 30; i++) {
    const k = d.toISOString().slice(0, 10);
    if (days.includes(k)) s++;
    else if (i > 0) break;
    d.setDate(d.getDate() - 1);
  }
  return s;
}

function latestWeight() {
  return state.weights.length ? +state.weights[state.weights.length - 1].value : +state.profile.weight;
}

function progressPct() {
  const start = +state.profile.startWeight || 57;
  const target = +state.profile.target;
  const cur = latestWeight();
  if (target === start) return 100;
  return clamp(((cur - start) / (target - start)) * 100, 0, 100);
}

function setBar(id, value, max) {
  const el = $(id);
  if (el) el.style.width = clamp((value / Math.max(1, max)) * 100, 0, 100) + '%';
}

function navTo(view) {
  $$('.view').forEach((x) => x.classList.remove('active'));
  $('#view-' + view)?.classList.add('active');
  $$('.nav-item').forEach((x) => x.classList.toggle('active', x.dataset.view === view));
  $('#pageTitle').textContent = ({ dashboard: 'Dashboard', workout: 'Workout', nutrition: 'Nutrition', progress: 'Progress', notes: 'Notes', trainer: 'Trainer Mode', settings: 'Settings' })[view] || 'GymForge';
  $('#sidebar').classList.remove('open');
  if (view === 'progress') setTimeout(renderCharts, 30);
  if (view === 'nutrition') setTimeout(renderSmartCoach, 30);
}

function renderAll() {
  renderHeader();
  renderDashboard();
  renderWorkout();
  renderNutrition();
  renderProgress();
  renderNotes();
  renderTrainer();
  renderSettings();
  renderSmartCoach();
}

function renderHeader() {
  const p = state.profile;
  const weight = latestWeight();
  const pct = progressPct();
  $('#todayLabel').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  $('#sidebarWeight').textContent = weight.toFixed(1) + ' kg';
  $('#sidebarTarget').textContent = p.target + ' kg';
  $('#sidebarGoalProgress').style.width = pct + '%';
  $('#heroWeight').textContent = weight.toFixed(1);
  $('#heroPercent').textContent = Math.round(pct) + '%';
  $('#heroRing').style.background = `conic-gradient(var(--accent) ${pct * 3.6}deg,#222 0deg)`;
  $('#profileQuickBtn').textContent = p.name.split(/\s+/).map((x) => x[0]).slice(0, 2).join('').toUpperCase();
}

function renderDashboard() {
  const t = macroTotals();
  const p = state.profile;
  const ww = weekWorkouts();
  $('#dashCalories').textContent = Math.round(t.cal);
  $('#dashCalTarget').textContent = p.calories;
  $('#dashProtein').textContent = Math.round(t.protein) + 'g';
  $('#dashProteinTarget').textContent = p.protein + 'g';
  $('#dashWorkouts').textContent = ww;
  $('#dashWeightChange').textContent = (latestWeight() - (state.weights[0]?.value || p.startWeight)).toFixed(1) + ' kg';
  setBar('#calBar', t.cal, p.calories);
  setBar('#proteinBar', t.protein, p.protein);
  setBar('#workoutBar', ww, 6);
  $('#sleepDisplay').textContent = state.recovery.sleep + 'h';
  $('#waterDisplay').textContent = state.recovery.water + ' / ' + state.recovery.waterTarget + 'L';
  $('#streakDisplay').textContent = streak() + ' days';
  const score = Math.round(clamp((state.recovery.sleep / 8) * 45 + (state.recovery.water / state.recovery.waterTarget) * 35 + (ww / 6) * 20, 0, 100));
  $('#readinessScore').textContent = score;
  const wd = workoutPlan[selectedWorkout];
  $('#todayWorkoutTitle').textContent = wd.name + ' · ' + wd.focus;
  $('#todayWorkoutPreview').innerHTML = wd.ex.slice(0, 5).map((x) => `<div class="preview-row"><b>${x[0]}</b><span>${x[1]} × ${x[2]}</span></div>`).join('');
  drawChart($('#weightMiniChart'), state.weights.slice(-8));
}

function workoutKey(dayIndex, exerciseIndex) {
  return todayKey() + '_' + dayIndex + '_' + exerciseIndex;
}

function renderWorkout() {
  $('#workoutDayPicker').innerHTML = workoutPlan.map((w, i) => `<button class="${i === selectedWorkout ? 'active' : ''}" data-wd="${i}">${w.name}</button>`).join('');
  const day = workoutPlan[selectedWorkout];
  $('#workoutDayHeading').textContent = day.name + ' — ' + day.focus;
  $('#exerciseList').innerHTML = day.ex.map((exercise, ei) => {
    const key = workoutKey(selectedWorkout, ei);
    const logs = state.setLogs[key] || Array.from({ length: exercise[1] }, () => ({ kg: '', reps: '', done: false }));
    return `<div class="exercise"><div class="exercise-head"><div><h4>${exercise[0]}</h4><div class="meta">${exercise[1]} sets · ${exercise[2]} reps</div></div></div>${logs.map((set, si) => `<div class="set-grid"><b>${si + 1}</b><input data-set-field="kg" data-ei="${ei}" data-si="${si}" type="number" step="0.5" placeholder="kg" value="${set.kg || ''}"><input data-set-field="reps" data-ei="${ei}" data-si="${si}" type="number" placeholder="reps" value="${set.reps || ''}"><button class="done-set ${set.done ? 'done' : ''}" data-set-done="1" data-ei="${ei}" data-si="${si}">✓</button></div>`).join('')}</div>`;
  }).join('');
}

function renderNutrition() {
  const t = macroTotals();
  const p = state.profile;
  [['#nutCal', t.cal], ['#nutProtein', t.protein], ['#nutCarbs', t.carbs], ['#nutFat', t.fat]].forEach(([id, value]) => $(id).textContent = Math.round(value));
  $('#nutCal').nextElementSibling.textContent = ` / ${p.calories} kcal`;
  $('#nutProtein').nextElementSibling.textContent = ` / ${p.protein} g`;
  $('#nutCarbs').nextElementSibling.textContent = ` / ${p.carbs} g`;
  $('#nutFat').nextElementSibling.textContent = ` / ${p.fat} g`;
  setBar('#nutCalBar', t.cal, p.calories);
  setBar('#nutProteinBar', t.protein, p.protein);
  setBar('#nutCarbsBar', t.carbs, p.carbs);
  setBar('#nutFatBar', t.fat, p.fat);

  const meals = dayMeals();
  $('#mealLog').innerHTML = meals.length
    ? meals.map((m) => `<div class="meal-row"><div><b>${esc(m.name)}</b><div class="macro">${round1(m.protein)}g P · ${round1(m.carbs)}g C · ${round1(m.fat)}g F${m.fiber ? ` · ${round1(m.fiber)}g fiber` : ''}${m.source === 'AI' ? ' · ✨ AI estimate' : ''}</div></div><b>${Math.round(m.cal)} kcal</b><button class="delete-btn" data-del-meal="${m.id}">✕</button></div>`).join('')
    : '<p class="muted">No food logged yet.</p>';
  $('#dietPlan').innerHTML = dietPlan.map((x) => `<div class="meal-plan-item"><b>${x[0]}</b><p>${x[1]}</p></div>`).join('');
}

function coachAdvice() {
  const t = macroTotals();
  const r = remainingMacros();
  const p = state.profile;
  const caloriePct = clamp(t.cal / p.calories, 0, 1);
  const proteinPct = clamp(t.protein / p.protein, 0, 1);
  const score = Math.round(((caloriePct + proteinPct) / 2) * 100);

  let message = '';
  if (r.rawCal <= 0 && r.rawProtein <= 0) message = 'Today’s calorie and protein targets are covered. Don’t force extra food just to chase numbers.';
  else if (r.protein > 30 && r.cal < 450) message = `Protein is the priority now. You still need about ${Math.round(r.protein)} g protein but only ${Math.round(r.cal)} kcal.`;
  else if (r.protein > 25 && r.cal > 500) message = `You still have room for a proper meal: about ${Math.round(r.cal)} kcal and ${Math.round(r.protein)} g protein remain.`;
  else if (r.protein <= 10 && r.cal > 300) message = 'Protein is almost covered. Use simple carbs/fats to finish calories without forcing another huge protein meal.';
  else if (r.cal < 250 && r.protein < 15) message = 'You are very close. A small snack can finish the day comfortably.';
  else message = `You have roughly ${Math.round(r.cal)} kcal and ${Math.round(r.protein)} g protein left today.`;

  const targetCal = Math.min(Math.max(r.cal, 180), 550);
  const targetProtein = Math.min(Math.max(r.protein, 8), 50);
  const ranked = coachFoods
    .map((food) => {
      const overCalPenalty = food.cal > r.cal + 180 && r.cal > 0 ? 35 : 0;
      const score = Math.abs(food.cal - targetCal) / 12 + Math.abs(food.protein - targetProtein) * 1.8 + overCalPenalty;
      return { ...food, score };
    })
    .sort((a, b) => a.score - b.score);

  const offset = state.settings.coachSuggestionOffset || 0;
  const suggestions = Array.from({ length: Math.min(3, ranked.length) }, (_, i) => ranked[(i + offset) % ranked.length]);
  return { score, message, remaining: r, suggestions };
}

function renderSmartCoach() {
  if (!$('#coachRemaining')) return;
  const coach = coachAdvice();
  const r = coach.remaining;
  $('#coachScore').textContent = coach.score + '%';
  $('#coachRemaining').innerHTML = `
    <div><span>Calories left</span><b>${Math.round(r.cal)} kcal</b></div>
    <div><span>Protein left</span><b>${Math.round(r.protein)} g</b></div>
    <div><span>Carbs left</span><b>${Math.round(r.carbs)} g</b></div>
    <div><span>Fat left</span><b>${Math.round(r.fat)} g</b></div>`;
  $('#coachMessage').textContent = coach.message;
  $('#coachSuggestions').innerHTML = coach.suggestions.map((food, i) => `
    <div class="coach-suggestion">
      <div><b>${esc(food.name)}</b><span>${food.note}</span></div>
      <div class="coach-macros">≈ ${food.cal} kcal · ${food.protein}g P</div>
      <button class="text-btn" data-use-suggestion="${i}">Use</button>
    </div>`).join('');
}

function renderProgress() {
  const m = state.measurements[state.measurements.length - 1] || {};
  const fields = [['Chest', m.chest], ['Waist', m.waist], ['Arms', m.arms], ['Thigh', m.thigh]];
  $('#measurementGrid').innerHTML = fields.map((x) => `<div class="measure-item"><span>${x[0]}</span><strong>${x[1] || '—'}${x[1] ? ' cm' : ''}</strong></div>`).join('');
  $('#prList').innerHTML = state.prs.length
    ? [...state.prs].reverse().map((p) => `<div class="list-row"><div><b>${esc(p.exercise)}</b><div class="sub">${fmtDate(p.date)} · ${p.reps || 1} rep${p.reps == 1 ? '' : 's'}</div></div><b>${p.weight} kg</b></div>`).join('')
    : '<p class="muted">No PRs logged yet.</p>';
  $('#weightHistory').innerHTML = state.weights.length
    ? [...state.weights].reverse().map((w) => `<div class="list-row"><div><b>${(+w.value).toFixed(1)} kg</b><div class="sub">${fmtDate(w.date)}</div></div><button class="delete-btn" data-del-weight="${w.id}">✕</button></div>`).join('')
    : '<p class="muted">No weigh-ins.</p>';
  renderCharts();
}

function renderCharts() {
  drawChart($('#weightChart'), state.weights);
}

function drawChart(canvas, points) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = devicePixelRatio || 1;
  const w = canvas.clientWidth || 500;
  const h = parseInt(canvas.getAttribute('height')) || 200;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = '#273242';
  ctx.lineWidth = 1;
  for (let i = 1; i < 5; i++) {
    const y = i * h / 5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  if (!points.length) return;
  const vals = points.map((x) => +x.value);
  const min = Math.min(...vals) - 0.5;
  const max = Math.max(...vals) + 0.5;
  const pad = 14;
  const coords = points.map((p, i) => ({
    x: pad + (w - pad * 2) * (points.length === 1 ? 0.5 : i / (points.length - 1)),
    y: pad + (h - pad * 2) * (1 - ((+p.value - min) / (max - min || 1))),
  }));
  ctx.strokeStyle = '#b7ff3c';
  ctx.lineWidth = 3;
  ctx.beginPath();
  coords.forEach((c, i) => i ? ctx.lineTo(c.x, c.y) : ctx.moveTo(c.x, c.y));
  ctx.stroke();
  ctx.fillStyle = '#b7ff3c';
  coords.forEach((c) => {
    ctx.beginPath();
    ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
    ctx.fill();
  });
}

function renderNotes() {
  $('#notesGrid').innerHTML = state.notes.length
    ? [...state.notes].reverse().map((n) => `<div class="note"><span class="mini-label">${esc(n.tag || 'NOTE')}</span><h4>${esc(n.title)}</h4><p>${esc(n.body)}</p><div class="note-footer"><span>${fmtDate(n.date)}</span><button class="delete-btn" data-del-note="${n.id}">Delete</button></div></div>`).join('')
    : '<div class="card"><p class="muted">No notes yet. Save form cues, pain flags, motivation, or coach observations.</p></div>';
}

function renderTrainer() {
  const clients = state.clients;
  $('#clientCount').textContent = clients.length;
  $('#checkinsDue').textContent = clients.filter((x) => x.checkin === 'Due').length;
  $('#plansActive').textContent = state.plans.length;
  $('#clientList').innerHTML = clients.length
    ? clients.map((x) => `<div class="client-row"><div class="client-avatar">${x.name.split(/\s+/).map((y) => y[0]).slice(0, 2).join('').toUpperCase()}</div><div><b>${esc(x.name)}</b><div class="sub">${esc(x.goal)} · ${x.weight} kg</div></div><span class="pill">${x.checkin || 'Active'}</span></div>`).join('')
    : '<p class="muted">No clients yet. Trainer Mode also works as your future coaching dashboard.</p>';
  $('#planClient').innerHTML = clients.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join('') || '<option value="">Add a client first</option>';
}

function renderSettings() {
  const p = state.profile;
  $('#profileName').value = p.name;
  $('#profileWeight').value = latestWeight();
  $('#profileHeight').value = p.height;
  $('#profileTarget').value = p.target;
  $('#profileCalories').value = p.calories;
  $('#profileProtein').value = p.protein;
  $('#profileCarbs').value = p.carbs;
  $('#profileFat').value = p.fat;
  if ($('#aiBackendStatus')) {
    $('#aiBackendStatus').textContent = aiHealthy === true ? 'Connected ✓' : aiHealthy === false ? 'Connection failed' : 'Not tested yet';
    $('#aiBackendStatus').className = aiHealthy === true ? 'status-good' : aiHealthy === false ? 'status-bad' : '';
  }
  updateNotificationStatus();
}

function openModal(title, html, handler) {
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = `<div class="modal-fields">${html}</div>`;
  modalHandler = handler;
  $('#modal').showModal();
}

function weightModal() {
  openModal('Log body weight', `<label>Weight (kg)<input id="mWeight" type="number" step="0.1" value="${latestWeight()}" required></label><label>Date<input id="mDate" type="date" value="${todayKey()}" required></label>`, () => {
    const value = +$('#mWeight').value;
    if (!value) return;
    state.weights.push({ id: uid(), date: $('#mDate').value, value });
    state.weights.sort((a, b) => a.date.localeCompare(b.date));
    state.profile.weight = value;
    save();
    toast('Weight logged');
  });
}

function noteModal() {
  openModal('New gym note', `<label>Title<input id="mTitle" placeholder="e.g. Squat cues" required></label><label>Tag<input id="mTag" placeholder="FORM / RECOVERY / IDEA"></label><label>Note<textarea id="mBody" rows="7" required></textarea></label>`, () => {
    state.notes.push({ id: uid(), title: $('#mTitle').value, tag: $('#mTag').value || 'NOTE', body: $('#mBody').value, date: todayKey() });
    save();
    toast('Note saved');
  });
}

function prModal() {
  openModal('Add personal record', `<label>Exercise<input id="mExercise" required placeholder="Bench Press"></label><label>Weight (kg)<input id="mPrWeight" type="number" step="0.5" required></label><label>Reps<input id="mPrReps" type="number" value="1" required></label><label>Date<input id="mPrDate" type="date" value="${todayKey()}" required></label>`, () => {
    state.prs.push({ id: uid(), exercise: $('#mExercise').value, weight: +$('#mPrWeight').value, reps: +$('#mPrReps').value, date: $('#mPrDate').value });
    save();
    toast('PR added');
  });
}

function mealModal(prefill = {}) {
  openModal('Log food', `
    <label>Food / meal<input id="mFood" required placeholder="Rice + chicken + dal" value="${esc(prefill.name || '')}"></label>
    <label>Calories<input id="mCal" type="number" required value="${prefill.cal ?? ''}"></label>
    <label>Protein (g)<input id="mProtein" type="number" step="0.1" value="${prefill.protein ?? 0}"></label>
    <label>Carbs (g)<input id="mCarbs" type="number" step="0.1" value="${prefill.carbs ?? 0}"></label>
    <label>Fat (g)<input id="mFat" type="number" step="0.1" value="${prefill.fat ?? 0}"></label>
    <label>Fiber (g)<input id="mFiber" type="number" step="0.1" value="${prefill.fiber ?? 0}"></label>`, () => {
      const key = todayKey();
      state.meals[key] = state.meals[key] || [];
      state.meals[key].push({ id: uid(), name: $('#mFood').value, cal: +$('#mCal').value, protein: +$('#mProtein').value, carbs: +$('#mCarbs').value, fat: +$('#mFat').value, fiber: +$('#mFiber').value || 0, source: prefill.source || 'Manual' });
      save();
      toast('Meal logged');
    });
}

function measureModal() {
  openModal('Body measurements', `<label>Chest (cm)<input id="mChest" type="number" step="0.1"></label><label>Waist (cm)<input id="mWaist" type="number" step="0.1"></label><label>Arms (cm)<input id="mArms" type="number" step="0.1"></label><label>Thigh (cm)<input id="mThigh" type="number" step="0.1"></label>`, () => {
    state.measurements.push({ id: uid(), date: todayKey(), chest: +$('#mChest').value || null, waist: +$('#mWaist').value || null, arms: +$('#mArms').value || null, thigh: +$('#mThigh').value || null });
    save();
    toast('Measurements saved');
  });
}

function clientModal() {
  openModal('Add client', `<label>Name<input id="mClientName" required></label><label>Goal<input id="mClientGoal" placeholder="Lean bulk / Fat loss" required></label><label>Weight (kg)<input id="mClientWeight" type="number" step="0.1" required></label><label>Check-in<select id="mClientCheck"><option>Active</option><option>Due</option></select></label>`, () => {
    state.clients.push({ id: uid(), name: $('#mClientName').value, goal: $('#mClientGoal').value, weight: +$('#mClientWeight').value, checkin: $('#mClientCheck').value });
    save();
    toast('Client added');
  });
}

function recoveryModal() {
  openModal('Update recovery', `<label>Sleep (hours)<input id="mSleep" type="number" step="0.5" value="${state.recovery.sleep}"></label><label>Water today (L)<input id="mWater" type="number" step="0.1" value="${state.recovery.water}"></label>`, () => {
    state.recovery.sleep = +$('#mSleep').value;
    state.recovery.water = +$('#mWater').value;
    save();
    toast('Recovery updated');
  });
}

function round1(value) {
  return Math.round((+value || 0) * 10) / 10;
}

// ---------------- AI FOOD SCANNER ----------------
function openAiScanner() {
  resetAiScanner(false);
  $('#aiDialog').showModal();
}

function resetAiScanner(clearImage = true) {
  $('#aiResult').hidden = true;
  $('#aiLoading').hidden = true;
  $('#aiAnalyzeBtn').disabled = false;
  $('#aiAnalyzeBtn').textContent = '✨ Analyze nutrition';
  if (clearImage) {
    currentAiImageData = '';
    $('#aiImageInput').value = '';
    $('#aiImagePreview').removeAttribute('src');
    $('#aiImagePreview').classList.remove('show');
    $('#aiWeightInput').value = '';
  }
}

async function compressImage(file) {
  if (!file) throw new Error('Choose a food photo first.');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Use JPG, PNG or WEBP image.');
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read image.'));
    reader.readAsDataURL(file);
  });
  const img = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not decode image.'));
    image.src = dataUrl;
  });
  const maxSide = 1280;
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.82);
}

async function handleAiImage(file) {
  try {
    toast('Preparing photo…');
    currentAiImageData = await compressImage(file);
    $('#aiImagePreview').src = currentAiImageData;
    $('#aiImagePreview').classList.add('show');
  } catch (err) {
    currentAiImageData = '';
    toast(err.message || 'Image could not be loaded');
  }
}

async function analyzeFood() {
  const weight = +$('#aiWeightInput').value;
  if (!currentAiImageData) return toast('Take or choose a food photo first');
  if (!weight || weight < 1 || weight > 5000) return toast('Enter a valid food weight in grams');

  $('#aiLoading').hidden = false;
  $('#aiAnalyzeBtn').disabled = true;
  $('#aiAnalyzeBtn').textContent = 'Analyzing…';
  $('#aiResult').hidden = true;

  try {
    const response = await fetch(AI_ENDPOINT + '/analyze-food', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: currentAiImageData, weightGrams: weight }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `AI request failed (${response.status})`);
    if (!data?.nutrition?.totals) throw new Error('AI returned an incomplete result. Try another photo.');
    aiHealthy = true;
    renderAiResult(data.nutrition);
    renderSettings();
  } catch (err) {
    console.error(err);
    aiHealthy = false;
    renderSettings();
    toast(err.message || 'Food analysis failed');
  } finally {
    $('#aiLoading').hidden = true;
    $('#aiAnalyzeBtn').disabled = false;
    $('#aiAnalyzeBtn').textContent = '✨ Analyze nutrition';
  }
}

function renderAiResult(nutrition) {
  const totals = nutrition.totals || {};
  $('#aiDetectedName').textContent = nutrition.food_name || 'Detected meal';
  $('#aiConfidence').textContent = (nutrition.confidence || 'estimate').toUpperCase();
  $('#aiEditName').value = nutrition.food_name || 'AI food scan';
  $('#aiEditCal').value = Math.round(+totals.calories_kcal || 0);
  $('#aiEditProtein').value = round1(totals.protein_g);
  $('#aiEditCarbs').value = round1(totals.carbs_g);
  $('#aiEditFat').value = round1(totals.fat_g);
  $('#aiEditFiber').value = round1(totals.fiber_g);
  $('#aiItems').innerHTML = (nutrition.items || []).map((item) => `
    <div class="ai-item-row">
      <div><b>${esc(item.name)}</b><span>≈ ${Math.round(+item.estimated_weight_g || 0)} g</span></div>
      <div>${Math.round(+item.calories_kcal || 0)} kcal · ${round1(item.protein_g)}g P</div>
    </div>`).join('') || '<p class="muted tiny">No item breakdown returned.</p>';
  $('#aiAssumptions').innerHTML = (nutrition.assumptions || []).map((a) => `<li>${esc(a)}</li>`).join('') || '<li>Portions and cooking oil are estimated from the photo.</li>';
  $('#aiResult').hidden = false;
  $('#aiResult').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function addAiMeal() {
  const name = $('#aiEditName').value.trim() || 'AI food scan';
  const cal = +$('#aiEditCal').value || 0;
  const protein = +$('#aiEditProtein').value || 0;
  const carbs = +$('#aiEditCarbs').value || 0;
  const fat = +$('#aiEditFat').value || 0;
  const fiber = +$('#aiEditFiber').value || 0;
  if (!cal && !protein && !carbs && !fat) return toast('Review the AI result before adding');
  const key = todayKey();
  state.meals[key] = state.meals[key] || [];
  state.meals[key].push({ id: uid(), name, cal, protein, carbs, fat, fiber, source: 'AI' });
  save();
  $('#aiDialog').close();
  toast('AI meal added ✓');
}

async function testAiConnection(showToast = true) {
  const status = $('#aiBackendStatus');
  if (status) status.textContent = 'Checking…';
  try {
    const response = await fetch(AI_ENDPOINT, { method: 'GET', cache: 'no-store' });
    const data = await response.json();
    aiHealthy = Boolean(response.ok && data?.ok && data?.status === 'ready');
  } catch {
    aiHealthy = false;
  }
  renderSettings();
  if (showToast) toast(aiHealthy ? 'AI backend connected ✓' : 'AI backend connection failed');
  return aiHealthy;
}

// ---------------- NUTRITION ALERTS ----------------
function notificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

function updateNotificationStatus() {
  const status = notificationPermission();
  const label = status === 'granted' ? 'Enabled ✓' : status === 'denied' ? 'Blocked in browser' : status === 'unsupported' ? 'Not supported' : 'Not enabled';
  if ($('#notificationStatus')) $('#notificationStatus').textContent = label;
  if ($('#enableNotifyBtn')) $('#enableNotifyBtn').textContent = status === 'granted' ? '🔔 Alerts enabled' : '🔔 Enable alerts';
  if ($('#settingsNotifyBtn')) $('#settingsNotifyBtn').textContent = status === 'granted' ? 'Notifications enabled' : 'Enable notifications';
}

async function enableNotifications() {
  if (!('Notification' in window)) return toast('Notifications are not supported in this browser');
  const permission = await Notification.requestPermission();
  updateNotificationStatus();
  if (permission === 'granted') {
    toast('Nutrition alerts enabled');
    sendCoachNotification(true);
  } else toast('Notification permission was not enabled');
}

function coachNotificationText() {
  const coach = coachAdvice();
  const r = coach.remaining;
  const suggestion = coach.suggestions[0];
  if (r.rawCal <= 0 && r.rawProtein <= 0) return 'Calories and protein are covered for today.';
  return `About ${Math.round(r.cal)} kcal & ${Math.round(r.protein)} g protein left. Easy option: ${suggestion?.name || 'check Smart Coach'}.`;
}

function sendCoachNotification(force = false) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const coach = coachAdvice();
  if (!force && coach.remaining.cal < 250 && coach.remaining.protein < 12) return;
  try {
    new Notification('GymForge Nutrition Coach', { body: coachNotificationText(), tag: 'gymforge-nutrition' });
  } catch {
    // Some embedded browsers block the Notification constructor.
  }
}

function maybeAutoNutritionNotification() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const hour = new Date().getHours();
  if (hour < 19) return;
  if (state.settings.lastCoachNotification === todayKey()) return;
  const r = remainingMacros();
  if (r.cal > 350 || r.protein > 20) {
    state.settings.lastCoachNotification = todayKey();
    localStorage.setItem(STORE, JSON.stringify(state));
    sendCoachNotification();
  }
}

// ---------------- EVENTS ----------------
$$('.nav-item').forEach((button) => button.onclick = () => navTo(button.dataset.view));
$$('[data-jump]').forEach((button) => button.onclick = () => navTo(button.dataset.jump));
$('#menuBtn').onclick = () => $('#sidebar').classList.toggle('open');
$('#profileQuickBtn').onclick = () => navTo('settings');

$('#modalForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if (modalHandler) modalHandler();
  $('#modal').close();
});
$$('#modal [value="cancel"]').forEach((button) => button.addEventListener('click', (e) => {
  e.preventDefault();
  $('#modal').close();
}));

$('#quickWeightBtn').onclick = $('#addWeightBtn').onclick = weightModal;
$('#quickPrBtn').onclick = $('#addPrBtn').onclick = prModal;
$('#quickNoteBtn').onclick = $('#addNoteBtn').onclick = noteModal;
$('#addMealBtn').onclick = () => mealModal();
$('#addMeasureBtn').onclick = measureModal;
$('#addClientBtn').onclick = clientModal;
$('#recoveryEditBtn').onclick = recoveryModal;

$('#aiFoodBtn').onclick = openAiScanner;
$('#aiFoodBtn2').onclick = openAiScanner;
$('#aiCloseBtn').onclick = () => $('#aiDialog').close();
$('#aiImageInput').addEventListener('change', (e) => handleAiImage(e.target.files?.[0]));
$('#aiAnalyzeBtn').onclick = analyzeFood;
$('#aiAddMealBtn').onclick = addAiMeal;
$('#aiScanAgainBtn').onclick = () => resetAiScanner(true);
$('#testAiBtn').onclick = () => testAiConnection(true);
$('#enableNotifyBtn').onclick = enableNotifications;
$('#settingsNotifyBtn').onclick = enableNotifications;
$('#coachRefreshBtn').onclick = () => {
  state.settings.coachSuggestionOffset = ((state.settings.coachSuggestionOffset || 0) + 1) % coachFoods.length;
  save({ silent: true });
  toast('New suggestions ready');
};

document.addEventListener('click', (e) => {
  const target = e.target;
  if (target.dataset.wd !== undefined) {
    selectedWorkout = +target.dataset.wd;
    renderWorkout();
    renderDashboard();
  }
  if (target.dataset.setDone) {
    const ei = +target.dataset.ei;
    const si = +target.dataset.si;
    const key = workoutKey(selectedWorkout, ei);
    const ex = workoutPlan[selectedWorkout].ex[ei];
    state.setLogs[key] = state.setLogs[key] || Array.from({ length: ex[1] }, () => ({ kg: '', reps: '', done: false }));
    state.setLogs[key][si].done = !state.setLogs[key][si].done;
    save();
  }
  if (target.dataset.delMeal) {
    state.meals[todayKey()] = (state.meals[todayKey()] || []).filter((x) => x.id !== target.dataset.delMeal);
    save();
  }
  if (target.dataset.delWeight) {
    state.weights = state.weights.filter((x) => x.id !== target.dataset.delWeight);
    save();
  }
  if (target.dataset.delNote) {
    state.notes = state.notes.filter((x) => x.id !== target.dataset.delNote);
    save();
  }
  if (target.dataset.rest) {
    restDefault = restSeconds = +target.dataset.rest;
    $$('[data-rest]').forEach((x) => x.classList.toggle('active', x === target));
    renderRest();
  }
  if (target.dataset.useSuggestion !== undefined) {
    const coach = coachAdvice();
    const food = coach.suggestions[+target.dataset.useSuggestion];
    if (food) mealModal({ ...food, source: 'Coach suggestion' });
  }
});

document.addEventListener('change', (e) => {
  const target = e.target;
  if (target.dataset.setField) {
    const ei = +target.dataset.ei;
    const si = +target.dataset.si;
    const key = workoutKey(selectedWorkout, ei);
    const ex = workoutPlan[selectedWorkout].ex[ei];
    state.setLogs[key] = state.setLogs[key] || Array.from({ length: ex[1] }, () => ({ kg: '', reps: '', done: false }));
    state.setLogs[key][si][target.dataset.setField] = target.value;
    localStorage.setItem(STORE, JSON.stringify(state));
  }
});

$('#finishWorkoutBtn').onclick = () => {
  if (!state.workouts.some((w) => w.date === todayKey() && w.day === selectedWorkout)) {
    state.workouts.push({ id: uid(), date: todayKey(), day: selectedWorkout, name: workoutPlan[selectedWorkout].name });
  }
  save();
  toast('Workout completed 🔥');
};

$('#clearMealsBtn').onclick = () => {
  if (confirm('Clear today’s food log?')) {
    state.meals[todayKey()] = [];
    save();
  }
};

$('#profileForm').onsubmit = (e) => {
  e.preventDefault();
  Object.assign(state.profile, {
    name: $('#profileName').value,
    height: +$('#profileHeight').value,
    target: +$('#profileTarget').value,
    calories: +$('#profileCalories').value,
    protein: +$('#profileProtein').value,
    carbs: +$('#profileCarbs').value,
    fat: +$('#profileFat').value,
  });
  const weight = +$('#profileWeight').value;
  if (weight !== latestWeight()) state.weights.push({ id: uid(), date: todayKey(), value: weight });
  state.profile.weight = weight;
  save();
  toast('Profile saved');
};

$('#planBuilderForm').onsubmit = (e) => {
  e.preventDefault();
  if (!$('#planClient').value) return toast('Add a client first');
  state.plans.push({ id: uid(), clientId: $('#planClient').value, name: $('#planName').value, text: $('#planText').value, date: todayKey() });
  save();
  e.target.reset();
  toast('Plan assigned');
};

$('#exportBtn').onclick = () => {
  const a = document.createElement('a');
  const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
  a.href = url;
  a.download = 'gymforge-backup-' + todayKey() + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
};

$('#importInput').onchange = async (e) => {
  try {
    const imported = JSON.parse(await e.target.files[0].text());
    state = { ...clone(defaults), ...imported, profile: { ...clone(defaults.profile), ...(imported.profile || {}) }, settings: { ...clone(defaults.settings), ...(imported.settings || {}) } };
    save();
    toast('Backup imported');
  } catch {
    toast('Invalid backup file');
  }
};

$('#resetBtn').onclick = () => {
  if (confirm('Reset all local GymForge data?')) {
    state = clone(defaults);
    save();
    toast('Data reset');
  }
};

// Session timer
function renderSession() {
  const m = Math.floor(sessionSeconds / 60);
  const s = sessionSeconds % 60;
  $('#sessionTimer').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

$('#sessionStartBtn').onclick = () => {
  if (sessionInt) {
    clearInterval(sessionInt);
    sessionInt = null;
    $('#sessionStartBtn').textContent = 'Start';
  } else {
    sessionInt = setInterval(() => { sessionSeconds++; renderSession(); }, 1000);
    $('#sessionStartBtn').textContent = 'Pause';
  }
};
$('#sessionResetBtn').onclick = () => {
  clearInterval(sessionInt);
  sessionInt = null;
  sessionSeconds = 0;
  renderSession();
  $('#sessionStartBtn').textContent = 'Start';
};

// Rest timer
function renderRest() {
  const m = Math.floor(restSeconds / 60);
  const s = restSeconds % 60;
  $('#restDisplay').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
$('#restTimerBtn').onclick = () => $('#restDialog').showModal();
$('#restCloseBtn').onclick = () => $('#restDialog').close();
$('#restStartBtn').onclick = () => {
  clearInterval(restInt);
  restInt = setInterval(() => {
    restSeconds--;
    renderRest();
    if (restSeconds <= 0) {
      clearInterval(restInt);
      restInt = null;
      restSeconds = restDefault;
      toast('Rest over — next set!');
      setTimeout(renderRest, 1200);
    }
  }, 1000);
};
$('#restResetBtn').onclick = () => {
  clearInterval(restInt);
  restInt = null;
  restSeconds = restDefault;
  renderRest();
};

// Install PWA
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  $('#installBtn').style.display = 'inline-block';
});
$('#installBtn').onclick = async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
  } else toast('Use browser menu → Add to Home screen');
};
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});

// Firebase adapter
async function initFirebase() {
  const cfg = window.GYMFORGE_FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey || String(cfg.apiKey).includes('PASTE_')) return;
  try {
    const appmod = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js');
    const authmod = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js');
    const fsmod = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js');
    const app = appmod.initializeApp(cfg);
    const auth = authmod.getAuth(app);
    const db = fsmod.getFirestore(app);
    fb = { auth, db, authmod, fsmod };
    authmod.onAuthStateChanged(auth, async (user) => {
      if (user) {
        $('#syncDot').classList.add('online');
        $('#syncText').textContent = 'Cloud sync';
        await cloudLoad();
      } else {
        $('#syncDot').classList.remove('online');
        $('#syncText').textContent = 'Local mode';
      }
    });
  } catch (err) {
    console.warn('Firebase init failed', err);
  }
}

async function cloudLoad() {
  if (!fb?.auth.currentUser) return;
  try {
    const ref = fb.fsmod.doc(fb.db, 'users', fb.auth.currentUser.uid);
    const snap = await fb.fsmod.getDoc(ref);
    if (snap.exists()) {
      const cloudState = snap.data().state || {};
      state = { ...clone(defaults), ...cloudState, profile: { ...clone(defaults.profile), ...(cloudState.profile || {}) }, settings: { ...clone(defaults.settings), ...(cloudState.settings || {}) } };
      localStorage.setItem(STORE, JSON.stringify(state));
      renderAll();
    } else await cloudSave();
  } catch (e) {
    console.warn(e);
  }
}

async function cloudSave() {
  if (!fb?.auth.currentUser) return;
  try {
    await fb.fsmod.setDoc(fb.fsmod.doc(fb.db, 'users', fb.auth.currentUser.uid), { state, updatedAt: Date.now() }, { merge: true });
  } catch (e) {
    console.warn(e);
  }
}

function cloudSaveDebounced() {
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(cloudSave, 700);
}

$('#signupBtn').onclick = async () => {
  if (!fb) return toast('Add Firebase config first');
  try {
    await fb.authmod.createUserWithEmailAndPassword(fb.auth, $('#authEmail').value, $('#authPassword').value);
    toast('Account created');
  } catch (e) {
    toast(e.message.replace('Firebase: ', '').slice(0, 80));
  }
};
$('#loginBtn').onclick = async () => {
  if (!fb) return toast('Add Firebase config first');
  try {
    await fb.authmod.signInWithEmailAndPassword(fb.auth, $('#authEmail').value, $('#authPassword').value);
    toast('Logged in');
  } catch (e) {
    toast(e.message.replace('Firebase: ', '').slice(0, 80));
  }
};
$('#logoutBtn').onclick = async () => {
  if (fb) await fb.authmod.signOut(fb.auth);
  toast('Logged out');
};

window.addEventListener('resize', () => {
  renderCharts();
  drawChart($('#weightMiniChart'), state.weights.slice(-8));
});

renderAll();
renderSession();
renderRest();
initFirebase();
testAiConnection(false);
maybeAutoNutritionNotification();
