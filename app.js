/* ═══════════════════════════════════════════════════════════════
   NEXUS STUDY · PREMIUM  —  app.js
   Store + Router + Theme + Timer + Modal + Toast + Drawer + Onboarding
   Sem dependências externas. Persistência localStorage.
   ═══════════════════════════════════════════════════════════════ */

/* ─────────  UTILS  ───────── */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const fmtDate = (ts) => new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
const fmtRelative = (ts) => {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return 'agora';
  if (m < 60) return `${m}m`;
  if (h < 24) return `${h}h`;
  if (d < 30) return `${d}d`;
  return fmtDate(ts);
};
const debounce = (fn, ms = 300) => {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
};
const escapeHTML = (s) => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

const PALETTE = ['#E8B84B','#8B7FE8','#4FD1C5','#F472B6','#34D399','#FBBF24','#F87171','#60A5FA','#A78BFA','#FB923C'];
const colorFor = (i = 0) => PALETTE[i % PALETTE.length];
const startOfDay = (t) => { const d = new Date(t); d.setHours(0,0,0,0); return d.getTime(); };
const endOfDay   = (t) => { const d = new Date(t); d.setHours(23,59,59,999); return d.getTime(); };
const groupBy = (arr, key) => arr.reduce((acc, x) => { (acc[x[key]] = acc[x[key]] || []).push(x); return acc; }, {});

/* ─────────  STORE  ───────── */
const STORAGE_KEY = 'nexus-pro-v2';
const Store = {
  state: null,
  subs: new Set(),

  defaults() {
    return {
      profile: {
        name: 'Concurseiro',
        concurso: '',
        banca: '',
        cargo: '',
        examDate: null,
        startDate: Date.now(),
        targetHours: 30,
        onboarded: false,
      },
      ui: { theme: 'dark' },
      disciplinas: [],
      sessoes: [],
      revisoes: [],
      flashcards: [],
      erros: [],
      cadernos: [],
      anotacoes: [],
      mapas: [],
      cronograma: {},
      activity: [],
    };
  },

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      this.state = raw ? this._merge(this.defaults(), JSON.parse(raw)) : this.defaults();
    } catch (e) {
      console.warn('Store load failed', e);
      this.state = this.defaults();
    }
    return this.state;
  },

  _merge(def, src) {
    const out = { ...def };
    for (const k of Object.keys(src)) {
      if (def[k] && typeof def[k] === 'object' && !Array.isArray(def[k]) && typeof src[k] === 'object' && !Array.isArray(src[k])) {
        out[k] = { ...def[k], ...src[k] };
      } else if (src[k] !== undefined) {
        out[k] = src[k];
      }
    }
    return out;
  },

  save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state)); } catch (e) {}
    this._notify();
  },
  on(fn) { this.subs.add(fn); return () => this.subs.delete(fn); },
  _notify() { this.subs.forEach(fn => { try { fn(this.state); } catch(e){} }); },

  /* selectors */
  disciplinaById(id) { return this.state.disciplinas.find(d => d.id === id); },
  cadernoById(id)    { return this.state.cadernos.find(c => c.id === id); },
  anotacoesByCaderno(id) { return this.state.anotacoes.filter(a => a.cadernoId === id); },
  mapaById(id)       { return this.state.mapas.find(m => m.id === id); },
  topicoCount() { return this.state.disciplinas.reduce((s, d) => s + (d.topics?.length || 0), 0); },
  topicoConcluido() { return this.state.disciplinas.reduce((s, d) => s + (d.topics?.filter(t => t.done).length || 0), 0); },
  totalHoursWeek() {
    const start = Date.now() - 7 * 86400000;
    const ms = this.state.sessoes.filter(s => s.startedAt >= start).reduce((a, s) => a + s.durationMs, 0);
    return ms / 3600000;
  },
  daysToExam() {
    if (!this.state.profile.examDate) return null;
    return Math.ceil((this.state.profile.examDate - Date.now()) / 86400000);
  },
  revisoesHoje() {
    const end = endOfDay(Date.now());
    return this.state.revisoes.filter(r => r.scheduledAt <= end);
  },
  revisoesAtrasadas() {
    return this.state.revisoes.filter(r => r.scheduledAt < startOfDay(Date.now()));
  },
  errosByStatus(status) { return this.state.erros.filter(e => (e.status || 'pending') === status); },

  /* mutations — disciplinas / tópicos */
  addDisciplina(d) {
    const item = { id: uid(), color: colorFor(this.state.disciplinas.length), topics: [], weight: 2, ...d };
    this.state.disciplinas.push(item);
    this.logActivity('disc', `Adicionou disciplina <b>${escapeHTML(item.name)}</b>`);
    this.save();
    return item;
  },
  updateDisciplina(id, patch) {
    const d = this.disciplinaById(id);
    if (d) { Object.assign(d, patch); this.save(); }
  },
  removeDisciplina(id) {
    this.state.disciplinas = this.state.disciplinas.filter(d => d.id !== id);
    this.state.cadernos    = this.state.cadernos.filter(c => c.disciplinaId !== id);
    this.state.mapas       = this.state.mapas.filter(m => m.disciplinaId !== id);
    this.save();
  },
  addTopico(discId, name, heat = 3) {
    const d = this.disciplinaById(discId);
    if (!d) return;
    d.topics = d.topics || [];
    d.topics.push({ id: uid(), name, done: false, heat });
    this.save();
  },
  toggleTopico(discId, topId) {
    const d = this.disciplinaById(discId);
    const t = d?.topics?.find(x => x.id === topId);
    if (!t) return;
    t.done = !t.done;
    if (t.done) this.logActivity('topic', `Concluiu <b>${escapeHTML(t.name)}</b>`);
    this.save();
  },
  updateTopico(discId, topId, patch) {
    const d = this.disciplinaById(discId);
    const t = d?.topics?.find(x => x.id === topId);
    if (!t) return;
    Object.assign(t, patch);
    this.save();
  },
  removeTopico(discId, topId) {
    const d = this.disciplinaById(discId);
    if (!d) return;
    d.topics = d.topics.filter(t => t.id !== topId);
    this.save();
  },

  /* sessões */
  addSessao(s) {
    this.state.sessoes.push({ id: uid(), startedAt: Date.now(), ...s });
    const disc = this.disciplinaById(s.disciplinaId);
    const m = Math.round((s.durationMs || 0) / 60000);
    this.logActivity('study', `Estudou <b>${escapeHTML(disc?.name || '—')}</b> · ${m}min`);
    this.save();
  },

  /* revisões SM-2 simplificado */
  agendarRevisao(disciplinaId, topico) {
    const item = {
      id: uid(),
      disciplinaId,
      topico,
      scheduledAt: Date.now() + 86400000,
      repetitions: 0,
      ease: 2.5,
      lastReview: null,
    };
    this.state.revisoes.push(item);
    this.save();
    return item;
  },
  marcarRevisao(id, qualidade = 'bom') {
    const r = this.state.revisoes.find(x => x.id === id);
    if (!r) return;
    const intervals = [1, 3, 7, 15, 30, 60];
    const idx = qualidade === 'dificil' ? Math.max(0, r.repetitions - 1)
              : qualidade === 'facil'   ? r.repetitions + 2
              : r.repetitions + 1;
    r.repetitions = Math.min(idx, intervals.length - 1);
    r.lastReview = Date.now();
    r.scheduledAt = Date.now() + intervals[r.repetitions] * 86400000;
    const disc = this.disciplinaById(r.disciplinaId);
    this.logActivity('review', `Revisou <b>${escapeHTML(disc?.name || '—')}</b> · ${escapeHTML(r.topico)}`);
    this.save();
  },
  removerRevisao(id) {
    this.state.revisoes = this.state.revisoes.filter(r => r.id !== id);
    this.save();
  },

  /* cadernos / anotações */
  addCaderno(disciplinaId, name) {
    const disc = this.disciplinaById(disciplinaId);
    const item = { id: uid(), disciplinaId, name, color: disc?.color || PALETTE[0], createdAt: Date.now() };
    this.state.cadernos.push(item);
    this.save();
    return item;
  },
  updateCaderno(id, patch) { const c = this.cadernoById(id); if (c) { Object.assign(c, patch); this.save(); } },
  removeCaderno(id) {
    this.state.cadernos  = this.state.cadernos.filter(c => c.id !== id);
    this.state.anotacoes = this.state.anotacoes.filter(a => a.cadernoId !== id);
    this.save();
  },
  addAnotacao(cadernoId, data = {}) {
    const item = {
      id: uid(),
      cadernoId,
      title: data.title || 'Nova anotação',
      body: data.body || '',
      tags: data.tags || [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.state.anotacoes.push(item);
    this.save();
    return item;
  },
  updateAnotacao(id, patch) {
    const a = this.state.anotacoes.find(x => x.id === id);
    if (!a) return;
    Object.assign(a, patch, { updatedAt: Date.now() });
    this.save();
  },
  removeAnotacao(id) {
    this.state.anotacoes = this.state.anotacoes.filter(a => a.id !== id);
    this.save();
  },

  /* mapas mentais */
  addMapa(disciplinaId, title) {
    const disc = this.disciplinaById(disciplinaId);
    const item = {
      id: uid(),
      disciplinaId,
      title,
      color: disc?.color || PALETTE[0],
      root: { id: uid(), text: title, color: disc?.color || PALETTE[0], notes: '', children: [] },
      updatedAt: Date.now(),
      createdAt: Date.now(),
    };
    this.state.mapas.push(item);
    this.save();
    return item;
  },
  updateMapa(id, patch) {
    const m = this.mapaById(id);
    if (!m) return;
    Object.assign(m, patch, { updatedAt: Date.now() });
    this.save();
  },
  removeMapa(id) {
    this.state.mapas = this.state.mapas.filter(m => m.id !== id);
    this.save();
  },
  findNode(root, nodeId) {
    if (root.id === nodeId) return { node: root, parent: null };
    for (const c of root.children || []) {
      if (c.id === nodeId) return { node: c, parent: root };
      const found = this.findNode(c, nodeId);
      if (found.node) return found;
    }
    return { node: null, parent: null };
  },
  addMapaNode(mapId, parentId, text = 'Novo tópico') {
    const m = this.mapaById(mapId);
    if (!m) return;
    const target = parentId ? this.findNode(m.root, parentId).node : m.root;
    if (!target) return;
    target.children = target.children || [];
    const node = { id: uid(), text, color: m.color, notes: '', children: [] };
    target.children.push(node);
    m.updatedAt = Date.now();
    this.save();
    return node;
  },
  updateMapaNode(mapId, nodeId, patch) {
    const m = this.mapaById(mapId);
    if (!m) return;
    const { node } = this.findNode(m.root, nodeId);
    if (!node) return;
    Object.assign(node, patch);
    m.updatedAt = Date.now();
    this.save();
  },
  removeMapaNode(mapId, nodeId) {
    const m = this.mapaById(mapId);
    if (!m || nodeId === m.root.id) return;
    const { parent } = this.findNode(m.root, nodeId);
    if (!parent) return;
    parent.children = parent.children.filter(c => c.id !== nodeId);
    m.updatedAt = Date.now();
    this.save();
  },

  /* flashcards */
  addFlashcard(data) {
    const item = { id: uid(), ease: 2.5, dueAt: Date.now(), createdAt: Date.now(), ...data };
    this.state.flashcards.push(item);
    this.save();
    return item;
  },
  removeFlashcard(id) {
    this.state.flashcards = this.state.flashcards.filter(f => f.id !== id);
    this.save();
  },

  /* erros */
  addErro(data) {
    const item = { id: uid(), createdAt: Date.now(), status: 'pending', ...data };
    this.state.erros.push(item);
    this.logActivity('err', `Registrou erro em <b>${escapeHTML(this.disciplinaById(data.disciplinaId)?.name || '—')}</b>`);
    this.save();
    return item;
  },
  updateErro(id, patch) {
    const e = this.state.erros.find(x => x.id === id);
    if (!e) return;
    Object.assign(e, patch, { updatedAt: Date.now() });
    if (patch.status === 'master') this.logActivity('err', `Dominou um erro de <b>${escapeHTML(this.disciplinaById(e.disciplinaId)?.name || '—')}</b>`);
    this.save();
  },
  removeErro(id) {
    this.state.erros = this.state.erros.filter(e => e.id !== id);
    this.save();
  },

  /* atividade */
  logActivity(type, text) {
    this.state.activity.unshift({ id: uid(), type, text, ts: Date.now() });
    if (this.state.activity.length > 60) this.state.activity.length = 60;
  },

  /* persistência geral */
  reset() { this.state = this.defaults(); this.save(); },
  exportJSON() { return JSON.stringify(this.state, null, 2); },
  importJSON(json) {
    try { this.state = this._merge(this.defaults(), JSON.parse(json)); this.save(); return true; }
    catch (e) { return false; }
  },

  seed() {
    if (this.state.disciplinas.length) return;
    const sample = [
      { name: 'Português',              weight: 4, topics: ['Concordância verbal', 'Crase', 'Pontuação', 'Interpretação de texto'] },
      { name: 'Direito Constitucional', weight: 5, topics: ['Princípios Fundamentais', 'Direitos e Garantias', 'Organização do Estado', 'Poder Executivo'] },
      { name: 'Direito Administrativo', weight: 4, topics: ['Atos Administrativos', 'Licitação', 'Servidores Públicos'] },
      { name: 'Raciocínio Lógico',      weight: 3, topics: ['Proposições', 'Conjuntos', 'Probabilidade'] },
    ];
    this.state.disciplinas = sample.map((s, i) => ({
      id: uid(),
      name: s.name,
      weight: s.weight,
      color: colorFor(i),
      topics: s.topics.map(t => ({ id: uid(), name: t, done: false, heat: 3 })),
    }));
    this.save();
  },
};

/* ─────────  THEME  ───────── */
const Theme = {
  init() {
    const saved = Store.state.ui.theme || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
  },
  toggle() {
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    Store.state.ui.theme = next;
    Store.save();
  },
};

/* ─────────  ROUTER  ───────── */
const Router = {
  routes: {},
  current: 'dashboard',
  params: {},

  register(name, fn) { this.routes[name] = fn; },

  go(name, params = {}) {
    if (!this.routes[name]) return console.warn('rota inexistente', name);
    this.current = name;
    this.params = params;
    history.replaceState({ name, params }, '', `#${name}`);
    this._highlightNav(name);
    this._setHead(name);
    const root = $('#content');
    root.innerHTML = '';
    const view = document.createElement('div');
    view.className = 'view';
    root.appendChild(view);
    try {
      this.routes[name](view, params);
    } catch (e) {
      console.error(e);
      view.innerHTML = `<div class="empty"><div class="empty-icon">⚠</div><div class="empty-title">Algo deu errado</div><div class="empty-desc">${escapeHTML(e.message)}</div></div>`;
    }
  },

  _highlightNav(name) {
    $$('.sb-nav-item').forEach(b => b.classList.toggle('is-active', b.dataset.route === name));
  },
  _setHead(name) {
    const meta = {
      dashboard:    ['Dashboard',          'Visão geral da sua preparação'],
      edital:       ['Edital',             'Disciplinas, tópicos e progresso'],
      cronograma:   ['Cronograma',         'Plano semanal de estudos'],
      revisoes:     ['Revisões',           'Pipeline de repetição espaçada'],
      flashcards:   ['Flashcards',         'Decks com algoritmo de repetição'],
      erros:        ['Caderno de Erros',   'Registro estruturado e revisão'],
      resumos:      ['Resumos',            'Cadernos por disciplina'],
      mapas:        ['Mapas Mentais',      'Conhecimento em árvore visual'],
      estatisticas: ['Estatísticas',       'Desempenho, horas e evolução'],
    }[name] || [name, ''];
    $('#topbar-title').textContent = meta[0];
    $('#topbar-sub').textContent = meta[1];
  },
  initFromHash() {
    const hash = location.hash.slice(1) || 'dashboard';
    this.go(this.routes[hash] ? hash : 'dashboard');
  },
};

/* ─────────  MODAL  ───────── */
const Modal = {
  open({ title, html, actions = [], width = 520 }) {
    const stack = $('#modal-stack');
    stack.innerHTML = `
      <div class="modal-backdrop" data-close-modal></div>
      <div class="modal" style="max-width:${width}px">
        <div class="modal-head">
          <div class="modal-title">${escapeHTML(title)}</div>
          <button class="modal-close" data-close-modal aria-label="Fechar">✕</button>
        </div>
        <div class="modal-body">${html}</div>
        ${actions.length ? `<div class="modal-foot">${actions.map((a, i) =>
          `<button class="btn ${a.variant || 'btn-ghost'}" data-action-idx="${i}">${escapeHTML(a.label)}</button>`
        ).join('')}</div>` : ''}
      </div>`;
    stack.classList.add('is-open');
    stack.querySelectorAll('[data-close-modal]').forEach(el => el.onclick = () => Modal.close());
    actions.forEach((a, i) => {
      const btn = stack.querySelector(`[data-action-idx="${i}"]`);
      if (btn) btn.onclick = () => {
        const r = a.onClick?.(stack.querySelector('.modal-body'), Modal);
        if (r !== false) Modal.close();
      };
    });
    setTimeout(() => stack.querySelector('input,textarea,select')?.focus(), 80);
  },
  close() {
    const stack = $('#modal-stack');
    stack.classList.remove('is-open');
    stack.innerHTML = '';
  },
  confirm({ title = 'Confirmar?', text = '', okLabel = 'Confirmar', dangerous = false } = {}) {
    return new Promise(resolve => {
      this.open({
        title,
        html: `<p style="color:var(--ink-soft);line-height:1.6;margin:0">${escapeHTML(text)}</p>`,
        actions: [
          { label: 'Cancelar', onClick: () => resolve(false) },
          { label: okLabel, variant: dangerous ? 'btn-danger' : 'btn-primary', onClick: () => resolve(true) },
        ],
      });
    });
  },
};

/* ─────────  TOAST  ───────── */
const Toast = {
  show(text, kind = '', ms = 2400) {
    const stack = $('#toast-stack');
    const el = document.createElement('div');
    el.className = `toast ${kind ? 't-' + kind : ''}`;
    const icon = kind === 'ok' ? '✓' : kind === 'err' ? '✕' : 'ℹ';
    el.innerHTML = `<span class="toast-icon">${icon}</span><span>${escapeHTML(text)}</span>`;
    stack.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(8px)'; }, ms - 300);
    setTimeout(() => el.remove(), ms);
  },
  ok(t)  { this.show(t, 'ok'); },
  err(t) { this.show(t, 'err'); },
};

/* ─────────  DRAWER  ───────── */
const Drawer = {
  open(name) {
    $('#drawer-backdrop').classList.add('is-open');
    $(`#drawer-${name}`).classList.add('is-open');
    if (name === 'settings') Settings.render();
  },
  close() {
    $$('.drawer.is-open').forEach(d => d.classList.remove('is-open'));
    $('#drawer-backdrop').classList.remove('is-open');
  },
};

/* ─────────  TIMER  ───────── */
const Timer = {
  mode: 'cronometro',
  running: false,
  startedAt: 0,
  elapsedMs: 0,
  targetMs: 25 * 60 * 1000,
  tickInterval: null,
  selectedDisciplinaId: null,

  init() {
    this._bindGlobal();
    this._bindFs();
    this._tickTopbar();
  },

  open()  { $('#timer-fs').classList.add('is-open'); this.render(); },
  close() { $('#timer-fs').classList.remove('is-open'); },

  setMode(m) {
    if (this.running) return Toast.err('Pause antes de trocar de modo');
    this.mode = m;
    this.elapsedMs = 0;
    if (m === 'pomodoro') this.targetMs = 25 * 60 * 1000;
    if (m === 'timer')    this.targetMs = 30 * 60 * 1000;
    this.render();
  },

  pickDiscipline() {
    const opts = Store.state.disciplinas.map(d =>
      `<button class="btn btn-ghost btn-block" style="justify-content:flex-start;margin-bottom:6px;border-left:4px solid ${d.color}" data-pick="${d.id}">${escapeHTML(d.name)}</button>`
    ).join('') || '<p class="empty-desc" style="margin:0">Cadastre disciplinas no Edital primeiro.</p>';
    Modal.open({
      title: 'Disciplina da sessão',
      html: `<div>${opts}</div>`,
      actions: [{ label: 'Cancelar' }],
    });
    setTimeout(() => {
      $$('[data-pick]', $('.modal')).forEach(b => b.onclick = () => {
        Timer.selectedDisciplinaId = b.dataset.pick;
        Modal.close();
        Timer.render();
      });
    }, 50);
  },

  toggle() {
    if (!this.running) {
      this.running = true;
      this.startedAt = Date.now() - this.elapsedMs;
      this.tickInterval = setInterval(() => this._tickAll(), 1000);
    } else {
      this.running = false;
      this.elapsedMs = Date.now() - this.startedAt;
      clearInterval(this.tickInterval);
    }
    this.render();
    this._tickTopbar();
  },

  finish() {
    if (!this.running && this.elapsedMs === 0) { this.close(); return; }
    if (this.running) this.toggle();
    if (!this.selectedDisciplinaId) {
      Toast.err('Selecione uma disciplina antes de finalizar.');
      return;
    }
    Store.addSessao({
      disciplinaId: this.selectedDisciplinaId,
      durationMs: this.elapsedMs,
      mode: this.mode,
    });
    const min = Math.round(this.elapsedMs / 60000);
    Toast.ok(`Sessão registrada · ${min} min`);
    this.elapsedMs = 0;
    this.startedAt = 0;
    this.render();
    this._tickTopbar();
    this.close();
    if (Router.current === 'dashboard') Router.go('dashboard');
  },

  _tickAll() {
    this.elapsedMs = Date.now() - this.startedAt;
    if ((this.mode === 'pomodoro' || this.mode === 'timer') && this.elapsedMs >= this.targetMs) {
      this.toggle();
      Toast.ok(this.mode === 'pomodoro' ? 'Pomodoro concluído!' : 'Timer concluído!');
    }
    this._renderDisplay();
    this._tickTopbar();
  },

  _renderDisplay() {
    const ms = (this.mode === 'pomodoro' || this.mode === 'timer')
      ? Math.max(0, this.targetMs - this.elapsedMs)
      : this.elapsedMs;
    const s = Math.floor(ms / 1000);
    const hh = String(Math.floor(s / 3600)).padStart(2, '0');
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    const el = $('#timer-display');
    if (el) el.textContent = `${hh}:${mm}:${ss}`;
  },

  _tickTopbar() {
    const btn = $('#topbar-timer');
    const lbl = $('#topbar-timer-label');
    if (!btn) return;
    btn.classList.toggle('is-running', this.running);
    if (this.running) {
      const m = Math.floor(this.elapsedMs / 60000);
      const s = Math.floor((this.elapsedMs % 60000) / 1000).toString().padStart(2, '0');
      lbl.textContent = `${m}:${s}`;
    } else {
      lbl.textContent = this.elapsedMs > 0 ? 'Sessão pausada' : 'Iniciar Estudo';
    }
  },

  render() {
    this._renderDisplay();
    $$('.timer-mode').forEach(b => b.classList.toggle('is-active', b.dataset.mode === this.mode));
    const dn = $('#timer-discipline');
    const disc = Store.disciplinaById(this.selectedDisciplinaId);
    dn.textContent = disc ? `Disciplina: ${disc.name}` : 'Selecione a disciplina ↓';
    $('#timer-toggle').textContent = this.running ? 'Pausar' : 'Iniciar';
  },

  _bindGlobal() {
    document.body.addEventListener('click', e => {
      const a = e.target.closest('[data-action]');
      if (!a) return;
      const act = a.dataset.action;
      if (act === 'timer-open')      Timer.open();
      if (act === 'timer-close')     Timer.close();
      if (act === 'timer-toggle')    Timer.toggle();
      if (act === 'timer-finish')    Timer.finish();
      if (act === 'timer-pick-disc') Timer.pickDiscipline();
      if (act === 'theme')           Theme.toggle();
      if (act === 'config')          Drawer.open('settings');
      if (act === 'toggle-sidebar')  $('#sidebar').classList.toggle('is-open');
    });
  },
  _bindFs() {
    $$('.timer-mode').forEach(b => b.onclick = () => Timer.setMode(b.dataset.mode));
    document.addEventListener('click', e => {
      const c = e.target.closest('[data-close]');
      if (c?.dataset.close === 'settings') Drawer.close();
    });
  },
};

/* ─────────  SETTINGS  ───────── */
const Settings = {
  render() {
    const p = Store.state.profile;
    $('#drawer-settings-body').innerHTML = `
      <div>
        <div class="label">Seu nome</div>
        <input class="input" id="cfg-name" placeholder="Como você quer ser chamado" value="${escapeHTML(p.name)}">
      </div>
      <div>
        <div class="label">Concurso</div>
        <input class="input" id="cfg-concurso" placeholder="Ex.: TRT, PMDF, PCDF..." value="${escapeHTML(p.concurso)}">
      </div>
      <div>
        <div class="label">Banca</div>
        <input class="input" id="cfg-banca" placeholder="CESPE, FCC, FGV..." value="${escapeHTML(p.banca)}">
      </div>
      <div>
        <div class="label">Cargo</div>
        <input class="input" id="cfg-cargo" placeholder="Ex.: Analista, Técnico..." value="${escapeHTML(p.cargo)}">
      </div>
      <div>
        <div class="label">Data da prova</div>
        <input class="input" id="cfg-exam" type="date" value="${p.examDate ? new Date(p.examDate).toISOString().slice(0,10) : ''}">
      </div>
      <div>
        <div class="label">Meta de horas / semana</div>
        <input class="input" id="cfg-target" type="number" min="1" max="120" value="${p.targetHours}">
      </div>
      <button class="btn btn-primary btn-block" id="cfg-save">Salvar</button>

      <div style="border-top:1px solid var(--line);margin-top:10px;padding-top:18px;display:flex;flex-direction:column;gap:10px">
        <div class="label">Dados</div>
        <button class="btn btn-ghost btn-block" id="cfg-export">⬇ Exportar JSON</button>
        <button class="btn btn-ghost btn-block" id="cfg-import">⬆ Importar JSON</button>
        <button class="btn btn-ghost btn-block" id="cfg-onb">↻ Refazer diagnóstico</button>
        <button class="btn btn-danger btn-block" id="cfg-reset">⚠ Resetar tudo</button>
      </div>
    `;
    $('#cfg-save').onclick = () => {
      const p = Store.state.profile;
      p.name = $('#cfg-name').value.trim() || 'Concurseiro';
      p.concurso = $('#cfg-concurso').value.trim();
      p.banca = $('#cfg-banca').value.trim();
      p.cargo = $('#cfg-cargo').value.trim();
      p.targetHours = +$('#cfg-target').value || 30;
      const d = $('#cfg-exam').value;
      p.examDate = d ? new Date(d).getTime() : null;
      Store.save();
      Toast.ok('Configurações salvas');
      App.refreshChrome();
      if (['dashboard','edital'].includes(Router.current)) Router.go(Router.current);
    };
    $('#cfg-export').onclick = () => {
      const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `nexus-study-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
    };
    $('#cfg-import').onclick = () => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = '.json';
      inp.onchange = e => {
        const f = e.target.files[0]; if (!f) return;
        const r = new FileReader();
        r.onload = () => {
          if (Store.importJSON(r.result)) {
            Toast.ok('Dados importados');
            App.refreshChrome();
            Router.go(Router.current);
          } else Toast.err('JSON inválido');
        };
        r.readAsText(f);
      };
      inp.click();
    };
    $('#cfg-onb').onclick = () => { Drawer.close(); Onboarding.start(); };
    $('#cfg-reset').onclick = async () => {
      if (await Modal.confirm({
        title: 'Resetar tudo?',
        text: 'Todos os seus dados (disciplinas, sessões, anotações, mapas, flashcards, erros) serão apagados. Esta ação não pode ser desfeita.',
        okLabel: 'Resetar tudo',
        dangerous: true,
      })) {
        Store.reset();
        Toast.ok('Tudo resetado');
        App.refreshChrome();
        Drawer.close();
        Onboarding.start();
      }
    };
  },
};

/* ─────────  ONBOARDING  ───────── */
const Onboarding = {
  step: 0,
  data: {},

  start() {
    this.step = 0;
    this.data = {
      name: Store.state.profile.name || 'Concurseiro',
      concurso: Store.state.profile.concurso || '',
      banca: Store.state.profile.banca || '',
      examDate: Store.state.profile.examDate || null,
      targetHours: Store.state.profile.targetHours || 20,
      level: 'intermediario',
    };
    $('#onboarding').style.display = 'flex';
    this.render();
  },

  finish() {
    const p = Store.state.profile;
    p.name = this.data.name;
    p.concurso = this.data.concurso;
    p.banca = this.data.banca;
    p.examDate = this.data.examDate;
    p.targetHours = this.data.targetHours;
    p.onboarded = true;
    Store.save();
    if (Store.state.disciplinas.length === 0) Store.seed();
    $('#onboarding').style.display = 'none';
    App.refreshChrome();
    Router.go('dashboard');
    Toast.ok('Tudo pronto! Bom estudo 🎯');
  },

  go(delta) {
    this.step = Math.max(0, Math.min(4, this.step + delta));
    this.render();
  },

  render() {
    const card = $('#ob-card');
    const pct = ((this.step + 1) / 5) * 100;
    const steps = [
      this._stepWelcome(),
      this._stepProfile(),
      this._stepConcurso(),
      this._stepDate(),
      this._stepHours(),
    ];

    card.innerHTML = `
      <div class="ob-progress"><div class="ob-progress-bar" style="width:${pct}%"></div></div>
      <div class="ob-step">Etapa ${this.step + 1} de 5</div>
      ${steps[this.step]}
    `;

    this._bindStep();
  },

  _stepWelcome() {
    return `
      <h2 class="ob-title">Bem-vindo ao NEXUS STUDY</h2>
      <p class="ob-desc">Em 4 perguntas rápidas você terá um plano de estudos personalizado pra sua aprovação. Sem fricção, sem cadastro.</p>
      <div class="ob-actions">
        <button class="btn btn-ghost" data-ob="skip">Pular tudo</button>
        <button class="btn btn-primary" data-ob="next">Começar →</button>
      </div>`;
  },

  _stepProfile() {
    return `
      <h2 class="ob-title">Como te chamamos?</h2>
      <p class="ob-desc">Vamos personalizar a saudação no seu dashboard.</p>
      <div style="margin-bottom:24px">
        <div class="label">Seu nome</div>
        <input class="input" id="ob-name" placeholder="Ex.: Gustavo" value="${escapeHTML(this.data.name)}">
      </div>
      <div class="ob-actions">
        <button class="btn btn-ghost" data-ob="back">← Voltar</button>
        <button class="btn btn-primary" data-ob="next">Continuar →</button>
      </div>`;
  },

  _stepConcurso() {
    return `
      <h2 class="ob-title">Seu alvo?</h2>
      <p class="ob-desc">Pra qual concurso você está se preparando?</p>
      <div style="margin-bottom:14px">
        <div class="label">Concurso</div>
        <input class="input" id="ob-concurso" placeholder="Ex.: TRT, PMDF, Receita Federal" value="${escapeHTML(this.data.concurso)}">
      </div>
      <div style="margin-bottom:24px">
        <div class="label">Banca (opcional)</div>
        <input class="input" id="ob-banca" placeholder="CESPE, FCC, FGV, VUNESP..." value="${escapeHTML(this.data.banca)}">
      </div>
      <div class="ob-actions">
        <button class="btn btn-ghost" data-ob="back">← Voltar</button>
        <button class="btn btn-primary" data-ob="next">Continuar →</button>
      </div>`;
  },

  _stepDate() {
    const v = this.data.examDate ? new Date(this.data.examDate).toISOString().slice(0,10) : '';
    return `
      <h2 class="ob-title">Quando é a prova?</h2>
      <p class="ob-desc">Pra calcular dias restantes e ajustar a intensidade do plano.</p>
      <div style="margin-bottom:24px">
        <div class="label">Data prevista</div>
        <input class="input" id="ob-date" type="date" value="${v}">
        <div style="font-size:11px;color:var(--ink-mute);margin-top:6px">não tem certeza? deixe em branco e ajuste depois.</div>
      </div>
      <div class="ob-actions">
        <button class="btn btn-ghost" data-ob="back">← Voltar</button>
        <button class="btn btn-primary" data-ob="next">Continuar →</button>
      </div>`;
  },

  _stepHours() {
    const opts = [
      { v: 10, t: '1–2h por dia',   d: 'Estudo casual · ~10h/sem' },
      { v: 20, t: '3h por dia',      d: 'Ritmo regular · ~20h/sem' },
      { v: 35, t: '5h por dia',      d: 'Intensivo · ~35h/sem' },
      { v: 50, t: 'Mais de 7h',      d: 'Modo guerra · 50h+/sem' },
    ];
    return `
      <h2 class="ob-title">Quantas horas você consegue?</h2>
      <p class="ob-desc">Escolha sua disponibilidade média de estudo. Você pode ajustar depois.</p>
      <div class="ob-options">
        ${opts.map(o => `
          <button class="ob-option ${this.data.targetHours === o.v ? 'is-selected' : ''}" data-hours="${o.v}">
            <div class="ob-option-title">${o.t}</div>
            <div class="ob-option-desc">${o.d}</div>
          </button>
        `).join('')}
      </div>
      <div class="ob-actions">
        <button class="btn btn-ghost" data-ob="back">← Voltar</button>
        <button class="btn btn-primary" data-ob="finish">✓ Finalizar</button>
      </div>`;
  },

  _bindStep() {
    const card = $('#ob-card');
    card.querySelectorAll('[data-ob]').forEach(b => {
      b.onclick = () => {
        const a = b.dataset.ob;
        if (a === 'skip')  { Store.state.profile.onboarded = true; if (!Store.state.disciplinas.length) Store.seed(); Store.save(); $('#onboarding').style.display = 'none'; App.refreshChrome(); Router.go('dashboard'); return; }
        if (a === 'back')  { this.go(-1); return; }
        if (a === 'next')  { this._collect(); this.go(1); return; }
        if (a === 'finish'){ this._collect(); this.finish(); return; }
      };
    });
    card.querySelectorAll('[data-hours]').forEach(b => b.onclick = () => {
      this.data.targetHours = +b.dataset.hours;
      this.render();
    });
  },

  _collect() {
    if (this.step === 1) {
      const v = $('#ob-name')?.value?.trim();
      if (v) this.data.name = v;
    }
    if (this.step === 2) {
      this.data.concurso = $('#ob-concurso')?.value?.trim() || '';
      this.data.banca    = $('#ob-banca')?.value?.trim() || '';
    }
    if (this.step === 3) {
      const v = $('#ob-date')?.value;
      this.data.examDate = v ? new Date(v).getTime() : null;
    }
  },
};

/* ─────────  APP  ───────── */
const App = {
  init() {
    Store.load();
    Theme.init();
    Timer.init();
    Views.register();
    Router.initFromHash();

    $$('.sb-nav-item').forEach(b => b.onclick = () => {
      Router.go(b.dataset.route);
      $('#sidebar').classList.remove('is-open');
    });

    window.addEventListener('hashchange', () => Router.initFromHash());
    Store.on(() => this.refreshChrome());
    this.refreshChrome();

    if (!Store.state.profile.onboarded) {
      setTimeout(() => Onboarding.start(), 200);
    }
  },

  refreshChrome() {
    const days = Store.daysToExam();
    $('#cd-days').textContent = days != null ? Math.max(0, days) : '—';
    $('#cd-exam').textContent = Store.state.profile.concurso || 'configure no perfil';

    const ed = $('#badge-edital');
    const total = Store.topicoCount();
    const done = Store.topicoConcluido();
    ed.textContent = total ? `${done}/${total}` : '';

    const rev = $('#badge-revisoes');
    const due = Store.revisoesHoje().length;
    const overdue = Store.revisoesAtrasadas().length;
    rev.textContent = (due || overdue) ? (due + overdue) : '';
    rev.classList.toggle('is-warn', overdue > 0);

    const er = $('#badge-erros');
    const pending = Store.errosByStatus('pending').length;
    er.textContent = pending ? pending : '';
  },
};

/* expose */
window.NX = { $, $$, uid, fmtDate, fmtRelative, debounce, escapeHTML, colorFor, PALETTE,
              startOfDay, endOfDay, groupBy,
              Store, Theme, Router, Modal, Toast, Drawer, Timer, Settings, Onboarding, App };

document.addEventListener('DOMContentLoaded', () => App.init());
