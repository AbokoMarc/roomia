if (!requireAuthOrRedirect('/login.html?next=/immobilier.html')) { /* redirection en cours */ }

let kind = null;
let steps = [];
let answers = {};
let stepPointer = 0; // index dans `steps` (les étapes filtrées par condition sont recalculées à la volée)

function visibleSteps() {
  return steps.filter(s => !s.condition || s.condition(answers));
}

function startWizard(selectedKind) {
  kind = selectedKind;
  steps = kind === 'achat' ? STEPS_ACHAT : STEPS_LOCATION;
  answers = {};
  stepPointer = 0;
  qs('immo-intro').classList.add('hidden');
  qs('wizard-wrap').classList.remove('hidden');
  renderStep();
}

qs('choice-achat').addEventListener('click', () => startWizard('achat'));
qs('choice-location').addEventListener('click', () => startWizard('location'));

function currentVisibleIndex() {
  const vis = visibleSteps();
  const currentKey = steps[stepPointer]?.key;
  return vis.findIndex(s => s.key === currentKey);
}

function updateProgress() {
  const vis = visibleSteps();
  const idx = currentVisibleIndex();
  const total = vis.length + 2; // +2 pour l'étape paiement/info et l'étape contact admin
  const pct = Math.min(100, Math.round(((idx + 1) / total) * 100));
  qs('wizard-progress-bar').style.width = `${pct}%`;
}

function renderChoice(step) {
  const current = answers[step.key];
  return `<div class="choice-grid">${step.options.map(opt => `
    <div class="choice-pill ${current === opt ? 'selected' : ''}" data-choice="${escapeHtml(opt)}">${escapeHtml(opt)}</div>
  `).join('')}</div>`;
}

function renderMultichoice(step) {
  const current = Array.isArray(answers[step.key]) ? answers[step.key] : [];
  return `<div class="choice-grid">${step.options.map(opt => `
    <div class="choice-pill ${current.includes(opt) ? 'selected' : ''}" data-multichoice="${escapeHtml(opt)}">${escapeHtml(opt)}</div>
  `).join('')}</div>`;
}

const PRIORITY_LEVELS = ['Indispensable', 'Souhaité', 'Peu important'];
function renderPriority(step) {
  const current = answers[step.key] || {};
  return `<div>${step.options.map(opt => `
    <div class="priority-row">
      <span class="label">${escapeHtml(opt)}</span>
      <div class="priority-choices">
        ${PRIORITY_LEVELS.map(lvl => `<button type="button" class="priority-btn ${current[opt] === lvl ? 'selected' : ''}" data-priority-item="${escapeHtml(opt)}" data-priority-level="${lvl}">${lvl}</button>`).join('')}
      </div>
    </div>
  `).join('')}</div>`;
}

function renderInput(step) {
  const val = answers[step.key] ?? '';
  const type = step.type === 'number' ? 'number' : step.type === 'date' ? 'date' : 'text';
  return `<input type="${type}" id="wizard-input" value="${escapeHtml(val)}" placeholder="${escapeHtml(step.placeholder || '')}"
    style="width:100%;padding:14px 16px;border-radius:var(--radius-sm);border:1.5px solid var(--line-strong);font-size:16px;font-family:inherit">`;
}

function renderStep() {
  const step = steps[stepPointer];
  if (!step) { renderInfoStep(); return; }

  let body = '';
  if (step.type === 'choice') body = renderChoice(step);
  else if (step.type === 'multichoice') body = renderMultichoice(step);
  else if (step.type === 'priority') body = renderPriority(step);
  else body = renderInput(step);

  qs('wizard-card').innerHTML = `
    <div class="wizard-step-label">${escapeHtml(step.label)}</div>
    <div class="wizard-question">${escapeHtml(step.question)}</div>
    ${body}
    <div id="wizard-error" style="color:var(--clay);font-size:13px;margin-top:14px;display:none"></div>
    <div class="wizard-nav">
      <button class="btn btn-ghost" id="wizard-back" ${stepPointer === 0 ? 'disabled' : ''}>← Précédent</button>
      <button class="btn btn-primary" id="wizard-next">${step.optional ? 'Suivant (facultatif)' : 'Suivant →'}</button>
    </div>
  `;
  updateProgress();
  bindStepEvents(step);
}

function bindStepEvents(step) {
  qs('wizard-back').addEventListener('click', goBack);
  qs('wizard-next').addEventListener('click', () => tryAdvance(step));

  document.querySelectorAll('[data-choice]').forEach(el => {
    el.addEventListener('click', () => {
      answers[step.key] = el.dataset.choice;
      document.querySelectorAll('[data-choice]').forEach(x => x.classList.remove('selected'));
      el.classList.add('selected');
    });
  });

  document.querySelectorAll('[data-multichoice]').forEach(el => {
    el.addEventListener('click', () => {
      const val = el.dataset.multichoice;
      const arr = Array.isArray(answers[step.key]) ? answers[step.key] : [];
      if (arr.includes(val)) answers[step.key] = arr.filter(v => v !== val);
      else answers[step.key] = [...arr, val];
      el.classList.toggle('selected');
    });
  });

  document.querySelectorAll('[data-priority-item]').forEach(el => {
    el.addEventListener('click', () => {
      const item = el.dataset.priorityItem;
      const level = el.dataset.priorityLevel;
      if (!answers[step.key]) answers[step.key] = {};
      answers[step.key][item] = level;
      document.querySelectorAll(`[data-priority-item="${CSS.escape(item)}"]`).forEach(x => x.classList.toggle('selected', x.dataset.priorityLevel === level));
    });
  });
}

function tryAdvance(step) {
  const errEl = qs('wizard-error');
  errEl.style.display = 'none';

  if (step.type === 'text' || step.type === 'number' || step.type === 'date') {
    const input = qs('wizard-input');
    const val = input.value.trim();
    if (!val && !step.optional) { errEl.textContent = 'Merci de répondre avant de continuer.'; errEl.style.display = 'block'; return; }
    answers[step.key] = step.type === 'number' ? (val ? Number(val) : '') : val;
  } else if (step.type === 'choice') {
    if (!answers[step.key] && !step.optional) { errEl.textContent = 'Choisis une option pour continuer.'; errEl.style.display = 'block'; return; }
  } else if (step.type === 'multichoice') {
    if ((!answers[step.key] || answers[step.key].length === 0) && !step.optional) { errEl.textContent = 'Choisis au moins une option, ou passe si facultatif.'; errEl.style.display = 'block'; return; }
  }
  // priority : pas de validation stricte, tous les niveaux sont facultatifs

  goNext();
}

function goNext() {
  for (let i = stepPointer + 1; i < steps.length; i++) {
    if (!steps[i].condition || steps[i].condition(answers)) { stepPointer = i; renderStep(); return; }
  }
  stepPointer = steps.length; // dépassé la fin -> étape info
  renderStep();
}

function goBack() {
  for (let i = stepPointer - 1; i >= 0; i--) {
    if (!steps[i].condition || steps[i].condition(answers)) { stepPointer = i; renderStep(); return; }
  }
}

function renderInfoStep() {
  qs('wizard-card').innerHTML = `
    <div class="wizard-step-label">Paiement</div>
    <div class="wizard-question">Moyens de paiement acceptés</div>
    <p style="color:var(--muted-text);font-size:14px;margin-bottom:6px">Une fois votre bien trouvé, voici les moyens de paiement que nous pouvons accepter pour finaliser la transaction avec votre conseiller.</p>
    ${renderPaymentIconsBar()}
    <div class="wizard-nav">
      <button class="btn btn-ghost" id="wizard-back">← Précédent</button>
      <button class="btn btn-primary" id="wizard-next">Suivant →</button>
    </div>
  `;
  qs('wizard-progress-bar').style.width = '92%';
  qs('wizard-back').addEventListener('click', () => { stepPointer = steps.length - 1; renderStep(); });
  qs('wizard-next').addEventListener('click', renderContactStep);
}

function renderContactStep() {
  qs('wizard-card').innerHTML = `
    <div class="wizard-step-label">Dernière étape</div>
    <div class="wizard-question">Souhaitez-vous discuter avec un conseiller avant d'envoyer votre demande ?</div>
    <p style="color:var(--muted-text);font-size:14px;margin-bottom:20px">Tu peux écrire directement à notre conseiller, ou envoyer ta demande maintenant — un conseiller te recontactera de toute façon.</p>
    <div style="display:flex;flex-direction:column;gap:12px">
      <a href="mailto:stonevieux@gmail.com?subject=${encodeURIComponent('Demande ' + (kind === 'achat' ? "d'achat" : 'de location') + ' — Roomia')}" class="btn btn-outline-ink btn-block" id="wizard-contact-admin">✉️ Discuter avec un conseiller (stonevieux@gmail.com)</a>
      <button class="btn btn-primary btn-block" id="wizard-submit">Envoyer ma demande directement</button>
    </div>
    <div id="wizard-error" style="color:var(--clay);font-size:13px;margin-top:14px;display:none"></div>
    <div class="wizard-nav">
      <button class="btn btn-ghost" id="wizard-back">← Précédent</button>
      <div></div>
    </div>
  `;
  qs('wizard-progress-bar').style.width = '100%';
  qs('wizard-back').addEventListener('click', renderInfoStep);

  let wantedAdminContact = false;
  qs('wizard-contact-admin').addEventListener('click', () => { wantedAdminContact = true; });
  qs('wizard-submit').addEventListener('click', () => submitInquiry(wantedAdminContact));
}

async function submitInquiry(wantsAdminContact) {
  const btn = qs('wizard-submit');
  const errEl = qs('wizard-error');
  btn.disabled = true; btn.textContent = 'Envoi en cours…';
  try {
    await api('/inquiries', { method: 'POST', body: { kind, answers, wants_admin_contact: wantsAdminContact } });
    qs('wizard-card').innerHTML = `
      <div style="text-align:center;padding:20px 0">
        <div style="font-size:44px">✅</div>
        <h3 style="margin-top:14px">Demande envoyée !</h3>
        <p style="color:var(--muted-text);margin-top:8px">Un conseiller va étudier ta demande et te recontactera prochainement.</p>
        <a href="/dashboard.html" class="btn btn-dark" style="margin-top:20px">Retour à mon espace</a>
      </div>`;
  } catch (err) {
    errEl.textContent = err.message; errEl.style.display = 'block';
    btn.disabled = false; btn.textContent = 'Envoyer ma demande directement';
  }
}

mountLayout('immobilier');
