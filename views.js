/* ═══════════════════════════════════════════════════════════════
   NEXUS STUDY · PREMIUM  —  views.js
   All route views. Depends on window.NX (app.js).
   ═══════════════════════════════════════════════════════════════ */

/* ─── Modal helpers (adapts views API to app.js Modal API) ─── */
function _modalOpen(title, html) {
  window.NX.Modal.open({ title, html });
}
function _modalConfirm(text, onOk) {
  window.NX.Modal.confirm({ title: 'Confirmar?', text: text.replace(/<[^>]+>/g,''), okLabel: 'Confirmar', dangerous: false })
    .then(ok => { if (ok) onOk(); });
}

/* ─── tiny local aliases ─── */
const _$ = (sel, root = document) => root.querySelector(sel);
const _$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const _esc = (s) => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const _fmt = (ts) => new Date(ts).toLocaleDateString('pt-BR', { day:'2-digit', month:'short' });
const _fmtFull = (ts) => new Date(ts).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' });
const _col  = (i) => ['#E8B84B','#8B7FE8','#4FD1C5','#F472B6','#34D399','#FBBF24','#F87171','#60A5FA','#A78BFA','#FB923C'][i % 10];

/* ─── helpers ─── */
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function donut(pct, size = 56, stroke = 6, color = '#E8B84B') {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none">
    <circle cx="${size/2}" cy="${size/2}" r="${r}" stroke="var(--surface-3)" stroke-width="${stroke}"/>
    <circle cx="${size/2}" cy="${size/2}" r="${r}" stroke="${color}" stroke-width="${stroke}"
      stroke-dasharray="${dash} ${circ}" stroke-dashoffset="${circ/4}" stroke-linecap="round"/>
  </svg>`;
}

function heatDots(heat = 3) {
  let dots = '';
  for (let i = 1; i <= 5; i++) {
    dots += `<span class="heat-dot ${i <= heat ? 'on' : ''}" data-lvl="${i}"></span>`;
  }
  return `<span class="heat-dots" title="Prioridade ${heat}/5">${dots}</span>`;
}

function miniBar7(disc) {
  const { Store } = window.NX;
  const now = Date.now();
  const bars = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = now - i * 86400000;
    const dayEnd   = dayStart + 86400000;
    const mins = Store.state.sessoes
      .filter(s => s.disciplinaId === disc.id && s.startedAt >= dayStart && s.startedAt < dayEnd)
      .reduce((a, s) => a + (s.durationMs || 0) / 60000, 0);
    bars.push(Math.min(100, mins / 1.2));
  }
  const max = Math.max(...bars, 1);
  return `<div class="mini-bar7">${bars.map(h =>
    `<div class="mb7-bar" style="height:${(h/max)*100}%"></div>`
  ).join('')}</div>`;
}

function computeStreak() {
  const { Store } = window.NX;
  const days = new Set(Store.state.sessoes.map(s =>
    new Date(s.startedAt).toDateString()
  ));
  let streak = 0;
  let d = new Date();
  while (days.has(d.toDateString())) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function totalHoursAll() {
  const { Store } = window.NX;
  return (Store.state.sessoes.reduce((a, s) => a + (s.durationMs || 0), 0) / 3600000).toFixed(1);
}

/* ═══════════════════════════════════════
   DASHBOARD
   ═══════════════════════════════════════ */
function viewDashboard(root) {
  const { Store, Router } = window.NX;
  const st = Store.state;
  const name = st.profile.name || 'Concurseiro';
  const pct  = Store.topicoCount() ? Math.round(Store.topicoConcluido() / Store.topicoCount() * 100) : 0;
  const streak = computeStreak();
  const hoursWeek = Store.totalHoursWeek().toFixed(1);
  const revHoje = Store.revisoesHoje().length;
  const revAtras = Store.revisoesAtrasadas().length;
  const days = Store.daysToExam();
  const erros = st.erros.length;

  const actFeed = [...st.activity].slice(0, 8).map(a => `
    <div class="feed-item">
      <span class="feed-dot" style="background:${a.type === 'study' ? '#E8B84B' : a.type === 'review' ? '#4FD1C5' : '#8B7FE8'}"></span>
      <span class="feed-msg">${a.text || ''}</span>
      <span class="feed-time">${_fmtRelativeShort(a.ts)}</span>
    </div>`).join('') || '<p class="empty-hint">Nenhuma atividade ainda. Comece a estudar!</p>';

  const discCards = st.disciplinas.slice(0, 6).map((d, i) => {
    const total = d.topics?.length || 0;
    const done  = d.topics?.filter(t => t.done).length || 0;
    const p     = total ? Math.round(done / total * 100) : 0;
    return `<div class="disc-card" style="--disc-color:${d.color}">
      <div class="disc-card-hd">
        <span class="disc-card-dot"></span>
        <span class="disc-card-name">${_esc(d.name)}</span>
        <span class="disc-card-pct">${p}%</span>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${p}%;background:${d.color}"></div></div>
      <div class="disc-card-ft">${done}/${total} tópicos · ${miniBar7(d)}</div>
    </div>`;
  }).join('');

  root.innerHTML = `
    <div class="dash-hero">
      <div class="dash-hero-left">
        <div class="dash-hero-greeting">${greeting()}, <b>${_esc(name)}</b> 👋</div>
        <div class="dash-hero-sub">${st.profile.concurso ? `Preparando para <b>${_esc(st.profile.concurso)}</b>` : 'Configure seu concurso nas configurações'}</div>
        <div class="dash-hero-prog">
          ${donut(pct, 72, 7)}
          <div class="dash-hero-prog-info">
            <div class="dash-hero-pct">${pct}%</div>
            <div class="dash-hero-pct-label">do edital concluído</div>
          </div>
        </div>
      </div>
      <div class="dash-hero-right">
        ${days !== null ? `<div class="days-badge"><span class="days-num">${days}</span><span class="days-label">dias para a prova</span></div>` : ''}
      </div>
    </div>

    <div class="dash-stats">
      <div class="stat-card">
        <div class="stat-val">${streak}</div>
        <div class="stat-label">Dias seguidos</div>
      </div>
      <div class="stat-card">
        <div class="stat-val">${hoursWeek}h</div>
        <div class="stat-label">Esta semana</div>
      </div>
      <div class="stat-card ${revHoje > 0 ? 'stat-card--alert' : ''}">
        <div class="stat-val">${revHoje}</div>
        <div class="stat-label">Revisões hoje${revAtras > 0 ? ` <span class="tag tag-err">${revAtras} atrasadas</span>` : ''}</div>
      </div>
      <div class="stat-card">
        <div class="stat-val">${erros}</div>
        <div class="stat-label">Erros registrados</div>
      </div>
    </div>

    <div class="dash-grid">
      <div class="dash-block">
        <div class="section-hd">
          <span class="section-title">Disciplinas</span>
          <button class="btn btn-ghost btn-sm" data-go="edital">Ver tudo →</button>
        </div>
        ${discCards || '<p class="empty-hint">Adicione disciplinas no Edital.</p>'}
      </div>
      <div class="dash-block">
        <div class="section-hd"><span class="section-title">Atividade recente</span></div>
        <div class="activity-feed">${actFeed}</div>
      </div>
    </div>
  `;

  _$$('[data-go]', root).forEach(btn => {
    btn.addEventListener('click', () => Router.go(btn.dataset.go));
  });
}

function _fmtRelativeShort(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1)  return 'agora';
  if (m < 60) return `${m}m`;
  if (h < 24) return `${h}h`;
  return `${d}d`;
}

/* ═══════════════════════════════════════
   EDITAL
   ═══════════════════════════════════════ */
function viewEdital(root) {
  const { Store, Modal, Toast } = window.NX;
  renderEdital(root);

  function renderEdital(root) {
    const st = Store.state;
    const totalDiscs  = st.disciplinas.length;
    const totalTopics = Store.topicoCount();
    const doneTopics  = Store.topicoConcluido();
    const pct = totalTopics ? Math.round(doneTopics / totalTopics * 100) : 0;

    root.innerHTML = `
      <div class="ed-head">
        <div class="ed-head-stats">
          <div class="ed-stat">
            <div class="ed-stat-val">${totalDiscs}</div>
            <div class="ed-stat-label">Disciplinas</div>
          </div>
          <div class="ed-stat">
            <div class="ed-stat-val">${totalTopics}</div>
            <div class="ed-stat-label">Tópicos</div>
          </div>
          <div class="ed-stat">
            <div class="ed-stat-val">${doneTopics}</div>
            <div class="ed-stat-label">Concluídos</div>
          </div>
          <div class="ed-stat ed-stat--main">
            <div class="ed-stat-donut">${donut(pct, 52, 5)}</div>
            <div>
              <div class="ed-stat-val">${pct}%</div>
              <div class="ed-stat-label">Progresso</div>
            </div>
          </div>
        </div>
        <button class="btn btn-primary" id="btn-add-disc">+ Disciplina</button>
      </div>

      <div class="ed-list" id="ed-list">
        ${st.disciplinas.length ? st.disciplinas.map(d => edDiscHTML(d)).join('') :
          '<div class="empty-state"><div class="empty-icon">▤</div><div class="empty-title">Nenhuma disciplina</div><p class="empty-hint">Clique em "+ Disciplina" para começar.</p></div>'}
      </div>
    `;

    _$('#btn-add-disc', root).addEventListener('click', () => addDiscModal());

    _$$('.ed-disc', root).forEach(el => {
      const id = el.dataset.id;
      _$('.ed-disc-toggle', el).addEventListener('click', () => {
        el.classList.toggle('is-open');
      });
      _$('.ed-disc-del', el)?.addEventListener('click', (e) => {
        e.stopPropagation();
        _modalConfirm(`Remover disciplina <b>${_esc(Store.disciplinaById(id)?.name)}</b>?`, () => {
          Store.removeDisciplina(id); renderEdital(root);
        });
      });
      _$('.btn-add-topic', el)?.addEventListener('click', () => addTopicModal(id, el));

      _$$('.ed-topic', el).forEach(topEl => {
        const topId = topEl.dataset.topId;
        topEl.querySelector('.ed-topic-check')?.addEventListener('click', () => {
          Store.toggleTopico(id, topId); renderEdital(root);
        });
        topEl.querySelector('.ed-topic-del')?.addEventListener('click', () => {
          _modalConfirm('Remover tópico?', () => { Store.removeTopico(id, topId); renderEdital(root); });
        });
        topEl.querySelectorAll('.heat-dot').forEach(dot => {
          dot.addEventListener('click', (e) => {
            e.stopPropagation();
            Store.updateTopico(id, topId, { heat: parseInt(dot.dataset.lvl) });
            renderEdital(root);
          });
        });
        topEl.querySelector('.btn-agendar')?.addEventListener('click', () => {
          const disc = Store.disciplinaById(id);
          const top  = disc?.topics?.find(t => t.id === topId);
          if (!top) return;
          Store.agendarRevisao(id, top.name);
          Toast.ok(`Revisão de "${top.name}" agendada!`);
        });
      });
    });
  }

  function edDiscHTML(d) {
    const total = d.topics?.length || 0;
    const done  = d.topics?.filter(t => t.done).length || 0;
    const pct   = total ? Math.round(done / total * 100) : 0;
    return `
      <div class="ed-disc" data-id="${d.id}">
        <div class="ed-disc-hd">
          <button class="ed-disc-toggle" type="button">
            <span class="ed-disc-arrow">›</span>
            <span class="ed-disc-dot" style="background:${d.color}"></span>
            <span class="ed-disc-name">${_esc(d.name)}</span>
            <span class="ed-disc-count">${done}/${total}</span>
            <div class="ed-disc-bar"><div class="ed-disc-fill" style="width:${pct}%;background:${d.color}"></div></div>
          </button>
          <button class="ed-disc-del icon-btn" title="Remover">✕</button>
        </div>
        <div class="ed-disc-body">
          <div class="ed-topics">
            ${(d.topics || []).map(t => edTopicHTML(t)).join('')}
          </div>
          <button class="btn btn-ghost btn-sm btn-add-topic">+ Tópico</button>
        </div>
      </div>`;
  }

  function edTopicHTML(t) {
    return `
      <div class="ed-topic ${t.done ? 'is-done' : ''}" data-top-id="${t.id}">
        <button class="ed-topic-check" title="Marcar como concluído">
          ${t.done ? '✓' : ''}
        </button>
        <span class="ed-topic-name">${_esc(t.name)}</span>
        ${heatDots(t.heat || 3)}
        <button class="btn-agendar" title="Agendar revisão">↻</button>
        <button class="ed-topic-del icon-btn" title="Remover">✕</button>
      </div>`;
  }

  function addDiscModal() {
    _modalOpen('Nova Disciplina', `
      <div class="form-group">
        <label class="form-label">Nome</label>
        <input class="input" id="disc-name-inp" placeholder="Ex: Direito Constitucional" autofocus>
      </div>
      <div class="form-group">
        <label class="form-label">Peso <span class="form-hint">(1–5)</span></label>
        <input class="input" id="disc-weight-inp" type="number" min="1" max="5" value="2">
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" data-close-modal>Cancelar</button>
        <button class="btn btn-primary" id="disc-save-btn">Salvar</button>
      </div>
    `);
    setTimeout(() => {
      const inp = _$('#disc-name-inp');
      const saveBtn = _$('#disc-save-btn');
      saveBtn?.addEventListener('click', () => {
        const name = inp?.value.trim();
        if (!name) return inp?.classList.add('is-error');
        const weight = parseInt(_$('#disc-weight-inp')?.value) || 2;
        Store.addDisciplina({ name, weight });
        window.NX.Modal.close(); renderEdital(root);
      });
    }, 50);
  }

  function addTopicModal(discId) {
    _modalOpen('Novo Tópico', `
      <div class="form-group">
        <label class="form-label">Nome do tópico</label>
        <input class="input" id="top-name-inp" placeholder="Ex: Princípios fundamentais" autofocus>
      </div>
      <div class="form-group">
        <label class="form-label">Prioridade (1–5)</label>
        <input class="input" id="top-heat-inp" type="number" min="1" max="5" value="3">
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" data-close-modal>Cancelar</button>
        <button class="btn btn-primary" id="top-save-btn">Salvar</button>
      </div>
    `);
    setTimeout(() => {
      _$('#top-save-btn')?.addEventListener('click', () => {
        const name = _$('#top-name-inp')?.value.trim();
        if (!name) return;
        const heat = parseInt(_$('#top-heat-inp')?.value) || 3;
        Store.addTopico(discId, name, heat);
        window.NX.Modal.close(); renderEdital(root);
      });
    }, 50);
  }
}

/* ═══════════════════════════════════════
   CRONOGRAMA
   ═══════════════════════════════════════ */
function viewCronograma(root) {
  const { Store, Toast } = window.NX;
  const DAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const SLOTS = ['06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00'];

  function render() {
    const cron = Store.state.cronograma || {};
    const discs = Store.state.disciplinas;

    root.innerHTML = `
      <div class="section-hd">
        <span class="section-title">Cronograma Semanal</span>
        <button class="btn btn-ghost btn-sm" id="cron-clear">Limpar</button>
      </div>
      <div class="cron-wrap">
        <div class="cron-grid">
          <div class="cron-corner"></div>
          ${DAYS.map(d => `<div class="cron-day-hd">${d}</div>`).join('')}
          ${SLOTS.map(slot => `
            <div class="cron-slot-label">${slot}</div>
            ${DAYS.map((d, di) => {
              const key = `${di}-${slot}`;
              const entry = cron[key];
              const disc = entry ? discs.find(x => x.id === entry.discId) : null;
              return `<div class="cron-cell ${disc ? 'has-entry' : ''}" data-key="${key}"
                style="${disc ? `background:${disc.color}22;border-color:${disc.color}` : ''}">
                ${disc ? `<span class="cron-cell-text">${_esc(disc.name)}</span>` : ''}
              </div>`;
            }).join('')}
          `).join('')}
        </div>
      </div>
      <div class="cron-legend">
        ${discs.map(d => `<span class="cron-leg-item"><span class="cron-leg-dot" style="background:${d.color}"></span>${_esc(d.name)}</span>`).join('')}
      </div>
    `;

    _$$('.cron-cell', root).forEach(cell => {
      cell.addEventListener('click', () => {
        const key = cell.dataset.key;
        const current = cron[key];
        if (current) {
          delete cron[key];
          Store.state.cronograma = cron;
          Store.save();
          render();
          return;
        }
        if (!discs.length) return Toast.info('Adicione disciplinas no Edital primeiro.');
        const opts = discs.map(d => `<option value="${d.id}">${_esc(d.name)}</option>`).join('');
        const sel = document.createElement('select');
        sel.className = 'input';
        sel.innerHTML = opts;
        const [dayIdx, slot] = key.split('-');
        const conf = window.confirm(`Agendar para ${DAYS[dayIdx]} ${slot}?\n\nDisciplina: ${discs[0].name}\n(Primeira da lista — use o modal para escolher)`);
        if (conf) {
          cron[key] = { discId: discs[0].id };
          Store.state.cronograma = cron;
          Store.save();
          render();
        }
      });
    });

    _$('#cron-clear', root)?.addEventListener('click', () => {
      if (confirm('Limpar todo o cronograma?')) {
        Store.state.cronograma = {};
        Store.save();
        render();
      }
    });
  }

  render();
}

/* ═══════════════════════════════════════
   REVISÕES
   ═══════════════════════════════════════ */
function viewRevisoes(root) {
  const { Store, Toast } = window.NX;

  function render() {
    const now = Date.now();
    const sod = new Date(); sod.setHours(0,0,0,0); const sodTs = sod.getTime();
    const eod = sodTs + 86399999;
    const tom = sodTs + 86400000;
    const week = sodTs + 7 * 86400000;

    const all = Store.state.revisoes;
    const overdue  = all.filter(r => r.scheduledAt < sodTs);
    const hoje     = all.filter(r => r.scheduledAt >= sodTs && r.scheduledAt <= eod);
    const amanha   = all.filter(r => r.scheduledAt > eod && r.scheduledAt <= tom + 86399999);
    const proxSem  = all.filter(r => r.scheduledAt > tom + 86399999 && r.scheduledAt <= week);

    const col = (title, items, cls = '') => `
      <div class="rev-col ${cls}">
        <div class="rev-col-hd">
          <span class="rev-col-title">${title}</span>
          <span class="rev-col-count">${items.length}</span>
        </div>
        <div class="rev-col-cards">
          ${items.length ? items.map(r => revCardHTML(r)).join('') :
            `<div class="rev-empty">—</div>`}
        </div>
      </div>`;

    root.innerHTML = `
      <div class="rev-board">
        ${col('Atrasadas', overdue, 'rev-col--overdue')}
        ${col('Hoje', hoje, 'rev-col--hoje')}
        ${col('Amanhã', amanha)}
        ${col('Próxima semana', proxSem)}
      </div>
    `;

    _$$('.rev-card', root).forEach(card => {
      const id = card.dataset.id;
      _$$('.rev-action', card).forEach(btn => {
        btn.addEventListener('click', () => {
          const q = btn.dataset.q;
          if (q === 'del') {
            Store.removerRevisao(id); render(); return;
          }
          Store.marcarRevisao(id, q);
          Toast.ok(`Revisão marcada como "${q}"!`);
          render();
        });
      });
    });
  }

  function revCardHTML(r) {
    const disc = Store.disciplinaById(r.disciplinaId);
    const date = _fmt(r.scheduledAt);
    return `
      <div class="rev-card" data-id="${r.id}" style="--disc-color:${disc?.color || '#E8B84B'}">
        <div class="rev-card-disc">${_esc(disc?.name || '—')}</div>
        <div class="rev-card-topic">${_esc(r.topico)}</div>
        <div class="rev-card-meta">${date} · rep ${r.repetitions}</div>
        <div class="rev-card-actions">
          <button class="rev-action btn btn-sm" data-q="dificil" title="Difícil">😣</button>
          <button class="rev-action btn btn-sm btn-primary" data-q="bom" title="Bom">✓ Bom</button>
          <button class="rev-action btn btn-sm" data-q="facil" title="Fácil">⚡ Fácil</button>
          <button class="rev-action btn btn-ghost btn-sm" data-q="del" title="Remover">✕</button>
        </div>
      </div>`;
  }

  render();
}

/* ═══════════════════════════════════════
   FLASHCARDS
   ═══════════════════════════════════════ */
function viewFlashcards(root) {
  const { Store, Toast, Modal } = window.NX;
  let studyDeck = null;
  let studyIdx  = 0;
  let flipped   = false;

  function render() {
    if (studyDeck) { renderStudy(); return; }
    renderDecks();
  }

  function renderDecks() {
    const fcs = Store.state.flashcards;
    const byDisc = {};
    fcs.forEach(fc => {
      if (!byDisc[fc.discId]) byDisc[fc.discId] = [];
      byDisc[fc.discId].push(fc);
    });
    const discs = Store.state.disciplinas;

    root.innerHTML = `
      <div class="section-hd">
        <span class="section-title">Flashcards</span>
        <button class="btn btn-primary" id="btn-add-fc">+ Flashcard</button>
      </div>
      ${discs.length === 0 ? '<div class="empty-state"><div class="empty-icon">⊞</div><div class="empty-title">Nenhum flashcard</div><p class="empty-hint">Adicione disciplinas no Edital primeiro.</p></div>' :
        `<div class="fc-decks">
          ${discs.map(d => {
            const cards = byDisc[d.id] || [];
            if (!cards.length) return '';
            return `<div class="fc-deck" data-disc-id="${d.id}" style="--disc-color:${d.color}">
              <div class="fc-deck-hd">
                <span class="fc-deck-dot"></span>
                <span class="fc-deck-name">${_esc(d.name)}</span>
                <span class="fc-deck-count">${cards.length} cards</span>
              </div>
              <button class="btn btn-primary btn-sm fc-study-btn" data-disc-id="${d.id}">Estudar →</button>
            </div>`;
          }).join('')}
        </div>`}
    `;

    _$('#btn-add-fc', root)?.addEventListener('click', addFcModal);
    _$$('.fc-study-btn', root).forEach(btn => {
      btn.addEventListener('click', () => {
        const cards = Store.state.flashcards.filter(f => f.discId === btn.dataset.discId);
        studyDeck = cards; studyIdx = 0; flipped = false;
        render();
      });
    });
  }

  function renderStudy() {
    const card = studyDeck[studyIdx];
    if (!card) {
      Toast.ok('Deck concluído!');
      studyDeck = null; studyIdx = 0;
      renderDecks(); return;
    }
    const disc = Store.disciplinaById(card.discId);
    root.innerHTML = `
      <div class="fc-study">
        <div class="fc-study-top">
          <button class="btn btn-ghost" id="fc-exit">← Sair</button>
          <span class="fc-study-prog">${studyIdx + 1} / ${studyDeck.length}</span>
        </div>
        <div class="fc-card ${flipped ? 'is-flipped' : ''}" id="fc-card">
          <div class="fc-card-front">
            <div class="fc-card-label">PERGUNTA</div>
            <div class="fc-card-content">${_esc(card.front)}</div>
          </div>
          <div class="fc-card-back">
            <div class="fc-card-label">RESPOSTA</div>
            <div class="fc-card-content">${_esc(card.back)}</div>
          </div>
        </div>
        ${!flipped ? `<button class="btn btn-primary btn-large" id="fc-flip">Revelar resposta</button>` :
          `<div class="fc-study-actions">
            <button class="btn fc-rate" data-r="dificil">😣 Difícil</button>
            <button class="btn btn-primary fc-rate" data-r="bom">✓ Bom</button>
            <button class="btn fc-rate" data-r="facil">⚡ Fácil</button>
          </div>`}
      </div>
    `;

    _$('#fc-exit', root)?.addEventListener('click', () => { studyDeck = null; renderDecks(); });
    _$('#fc-flip', root)?.addEventListener('click', () => { flipped = true; render(); });
    _$$('.fc-rate', root).forEach(btn => {
      btn.addEventListener('click', () => {
        studyIdx++; flipped = false; render();
      });
    });
  }

  function addFcModal() {
    const discs = Store.state.disciplinas;
    if (!discs.length) return Toast.info('Adicione disciplinas no Edital primeiro.');
    _modalOpen('Novo Flashcard', `
      <div class="form-group">
        <label class="form-label">Disciplina</label>
        <select class="input" id="fc-disc-sel">
          ${discs.map(d => `<option value="${d.id}">${_esc(d.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Frente (pergunta)</label>
        <textarea class="input" id="fc-front" rows="3" placeholder="Qual é..."></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Verso (resposta)</label>
        <textarea class="input" id="fc-back" rows="3" placeholder="A resposta é..."></textarea>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" data-close-modal>Cancelar</button>
        <button class="btn btn-primary" id="fc-save">Salvar</button>
      </div>
    `);
    setTimeout(() => {
      _$('#fc-save')?.addEventListener('click', () => {
        const discId = _$('#fc-disc-sel')?.value;
        const front  = _$('#fc-front')?.value.trim();
        const back   = _$('#fc-back')?.value.trim();
        if (!front || !back) return Toast.err('Preencha frente e verso.');
        const { uid } = window.NX;
        Store.state.flashcards.push({ id: uid(), discId, front, back, createdAt: Date.now() });
        Store.save();
        window.NX.Modal.close(); renderDecks();
      });
    }, 50);
  }

  render();
}

/* ═══════════════════════════════════════
   CADERNO DE ERROS
   ═══════════════════════════════════════ */
function viewErros(root) {
  const { Store, Modal, Toast } = window.NX;
  let activeTab = 'pending';

  function render() {
    const all = Store.state.erros;
    const counts = {
      pending: all.filter(e => (e.status || 'pending') === 'pending').length,
      review:  all.filter(e => e.status === 'review').length,
      master:  all.filter(e => e.status === 'master').length,
    };
    const items = all.filter(e => (e.status || 'pending') === activeTab);

    root.innerHTML = `
      <div class="err-head">
        <div class="err-stats-row">
          <div class="err-stat">
            <span class="err-stat-val">${all.length}</span>
            <span class="err-stat-label">Total</span>
          </div>
          <div class="err-stat err-stat--pending">
            <span class="err-stat-val">${counts.pending}</span>
            <span class="err-stat-label">Pendentes</span>
          </div>
          <div class="err-stat err-stat--review">
            <span class="err-stat-val">${counts.review}</span>
            <span class="err-stat-label">Em revisão</span>
          </div>
          <div class="err-stat err-stat--master">
            <span class="err-stat-val">${counts.master}</span>
            <span class="err-stat-label">Dominados</span>
          </div>
        </div>
        <button class="btn btn-primary" id="btn-add-erro">+ Erro</button>
      </div>

      <div class="err-tabs">
        <button class="err-tab ${activeTab === 'pending' ? 'is-active' : ''}" data-tab="pending">
          Pendentes <span class="err-tab-badge">${counts.pending}</span>
        </button>
        <button class="err-tab ${activeTab === 'review' ? 'is-active' : ''}" data-tab="review">
          Em revisão <span class="err-tab-badge">${counts.review}</span>
        </button>
        <button class="err-tab ${activeTab === 'master' ? 'is-active' : ''}" data-tab="master">
          Dominados <span class="err-tab-badge">${counts.master}</span>
        </button>
      </div>

      <div class="err-grid">
        ${items.length ? items.map(e => erroCardHTML(e)).join('') :
          `<div class="empty-state col-span-all">
            <div class="empty-icon">⊗</div>
            <div class="empty-title">Nenhum erro ${activeTab === 'pending' ? 'pendente' : activeTab === 'review' ? 'em revisão' : 'dominado'}</div>
            ${activeTab === 'pending' ? '<p class="empty-hint">Ótimo! Registre erros de questões para revisitar depois.</p>' : ''}
          </div>`}
      </div>
    `;

    _$$('.err-tab', root).forEach(tab => {
      tab.addEventListener('click', () => { activeTab = tab.dataset.tab; render(); });
    });

    _$('#btn-add-erro', root)?.addEventListener('click', addErroModal);

    _$$('.err-card', root).forEach(card => {
      const id = card.dataset.id;
      card.querySelector('.err-card-del')?.addEventListener('click', () => {
        _modalConfirm('Remover este erro?', () => {
          Store.state.erros = Store.state.erros.filter(e => e.id !== id);
          Store.save(); render();
        });
      });
      card.querySelector('.err-promote')?.addEventListener('click', () => {
        const e = Store.state.erros.find(x => x.id === id);
        if (!e) return;
        const next = e.status === 'pending' ? 'review' : 'master';
        e.status = next; Store.save();
        Toast.ok(next === 'review' ? 'Movido para revisão!' : 'Marcado como dominado!');
        render();
      });
    });
  }

  function erroCardHTML(e) {
    const disc = Store.disciplinaById(e.disciplinaId);
    const statusLabel = { pending: 'Pendente', review: 'Em revisão', master: 'Dominado' }[e.status || 'pending'];
    const canPromote  = (e.status || 'pending') !== 'master';
    return `
      <div class="err-card err-card--${e.status || 'pending'}" data-id="${e.id}"
        style="--disc-color:${disc?.color || '#E8B84B'}">
        <div class="err-card-hd">
          ${disc ? `<span class="err-card-disc" style="color:${disc.color}">${_esc(disc.name)}</span>` : ''}
          <span class="err-card-status">${statusLabel}</span>
        </div>
        <div class="err-card-question">${_esc(e.question || e.enunciado || '—')}</div>
        ${e.why ? `<div class="err-card-why"><b>Por quê errei:</b> ${_esc(e.why)}</div>` : ''}
        ${e.correct ? `<div class="err-card-correct"><b>Correto:</b> ${_esc(e.correct)}</div>` : ''}
        <div class="err-card-ft">
          <span class="err-card-date">${_fmt(e.createdAt)}</span>
          <div class="err-card-actions">
            ${canPromote ? `<button class="btn btn-sm btn-primary err-promote">
              ${(e.status || 'pending') === 'pending' ? 'Iniciar revisão →' : 'Marcar dominado ✓'}
            </button>` : ''}
            <button class="btn btn-ghost btn-sm err-card-del">✕</button>
          </div>
        </div>
      </div>`;
  }

  function addErroModal() {
    const discs = Store.state.disciplinas;
    _modalOpen('Registrar Erro', `
      <div class="form-group">
        <label class="form-label">Disciplina</label>
        <select class="input" id="erro-disc">
          <option value="">Selecione...</option>
          ${discs.map(d => `<option value="${d.id}">${_esc(d.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Enunciado / Questão</label>
        <textarea class="input" id="erro-quest" rows="3" placeholder="Cole o enunciado ou descreva a questão..."></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Por que errei?</label>
        <textarea class="input" id="erro-why" rows="2" placeholder="Confundi com... / Não sabia que..."></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Resposta correta</label>
        <input class="input" id="erro-correct" placeholder="A resposta era...">
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" data-close-modal>Cancelar</button>
        <button class="btn btn-primary" id="erro-save">Salvar</button>
      </div>
    `);
    setTimeout(() => {
      _$('#erro-save')?.addEventListener('click', () => {
        const question = _$('#erro-quest')?.value.trim();
        if (!question) return Toast.err('Descreva a questão.');
        const { uid } = window.NX;
        Store.state.erros.push({
          id: uid(),
          disciplinaId: _$('#erro-disc')?.value || null,
          question,
          why: _$('#erro-why')?.value.trim(),
          correct: _$('#erro-correct')?.value.trim(),
          status: 'pending',
          createdAt: Date.now(),
        });
        Store.save(); window.NX.Modal.close(); render();
        Toast.ok('Erro registrado!');
      });
    }, 50);
  }

  render();
}

/* ═══════════════════════════════════════
   RESUMOS
   ═══════════════════════════════════════ */
function viewResumos(root) {
  const { Store, Modal, Toast } = window.NX;
  let activeCadId = null;
  let activeNoteId = null;

  function render() {
    const cadernos   = Store.state.cadernos;
    const anotacoes  = Store.state.anotacoes;
    const discs      = Store.state.disciplinas;
    const activeCad  = cadernos.find(c => c.id === activeCadId);
    const notes      = activeCadId ? anotacoes.filter(a => a.cadernoId === activeCadId) : [];
    const activeNote = notes.find(n => n.id === activeNoteId);

    root.innerHTML = `
      <div class="resumos-layout">
        <!-- cadernos sidebar -->
        <div class="res-sidebar">
          <div class="res-sb-hd">
            <span class="res-sb-title">Cadernos</span>
            <button class="btn btn-ghost btn-sm" id="btn-add-cad">+</button>
          </div>
          <div class="res-sb-list">
            ${cadernos.length ? cadernos.map(c => `
              <div class="res-cad-item ${c.id === activeCadId ? 'is-active' : ''}" data-cad="${c.id}"
                style="--cad-color:${c.color}">
                <span class="res-cad-dot"></span>
                <span class="res-cad-name">${_esc(c.name)}</span>
                <span class="res-cad-count">${anotacoes.filter(a => a.cadernoId === c.id).length}</span>
              </div>`).join('') :
              '<p class="res-empty-hint">Nenhum caderno ainda</p>'}
          </div>
        </div>

        <!-- notes list -->
        <div class="res-notes-list">
          ${activeCad ? `
            <div class="res-nl-hd">
              <span style="color:${activeCad.color}">${_esc(activeCad.name)}</span>
              <button class="btn btn-primary btn-sm" id="btn-add-note">+ Anotação</button>
            </div>
            ${notes.map(n => `
              <div class="res-note-item ${n.id === activeNoteId ? 'is-active' : ''}" data-note="${n.id}">
                <div class="res-note-title">${_esc(n.title)}</div>
                <div class="res-note-preview">${_esc(n.body.slice(0, 60))}${n.body.length > 60 ? '…' : ''}</div>
              </div>`).join('') ||
              '<p class="res-empty-hint">Nenhuma anotação neste caderno.</p>'}
          ` : '<p class="res-empty-hint">Selecione um caderno.</p>'}
        </div>

        <!-- editor -->
        <div class="res-editor">
          ${activeNote ? `
            <div class="res-ed-hd">
              <input class="res-ed-title" id="note-title" value="${_esc(activeNote.title)}">
              <button class="btn btn-ghost btn-sm" id="note-del">✕ Excluir</button>
            </div>
            <textarea class="res-ed-body" id="note-body" placeholder="Escreva sua anotação aqui...">${_esc(activeNote.body)}</textarea>
            <div class="res-ed-ft">
              <span class="res-ed-date">Atualizado ${_fmt(activeNote.updatedAt)}</span>
              <button class="btn btn-primary btn-sm" id="note-save">Salvar</button>
            </div>
          ` : '<div class="res-ed-empty"><p>Selecione ou crie uma anotação</p></div>'}
        </div>
      </div>
    `;

    _$('#btn-add-cad', root)?.addEventListener('click', () => {
      if (!discs.length) return Toast.info('Adicione disciplinas no Edital primeiro.');
      _modalOpen('Novo Caderno', `
        <div class="form-group">
          <label class="form-label">Disciplina</label>
          <select class="input" id="cad-disc">
            ${discs.map(d => `<option value="${d.id}">${_esc(d.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Nome do caderno</label>
          <input class="input" id="cad-name" placeholder="Ex: Constitucional – Resumos" autofocus>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-close-modal>Cancelar</button>
          <button class="btn btn-primary" id="cad-save">Salvar</button>
        </div>
      `);
      setTimeout(() => {
        _$('#cad-save')?.addEventListener('click', () => {
          const discId = _$('#cad-disc')?.value;
          const name   = _$('#cad-name')?.value.trim();
          if (!name) return;
          const c = Store.addCaderno(discId, name);
          window.NX.Modal.close(); activeCadId = c.id; activeNoteId = null; render();
        });
      }, 50);
    });

    _$$('.res-cad-item', root).forEach(item => {
      item.addEventListener('click', () => { activeCadId = item.dataset.cad; activeNoteId = null; render(); });
    });

    _$('#btn-add-note', root)?.addEventListener('click', () => {
      if (!activeCadId) return;
      const n = Store.addAnotacao(activeCadId, { title: 'Nova anotação', body: '' });
      activeNoteId = n.id; render();
    });

    _$$('.res-note-item', root).forEach(item => {
      item.addEventListener('click', () => { activeNoteId = item.dataset.note; render(); });
    });

    const titleInp = _$('#note-title', root);
    const bodyArea = _$('#note-body', root);

    _$('#note-save', root)?.addEventListener('click', () => {
      if (!activeNoteId) return;
      Store.updateAnotacao(activeNoteId, {
        title: titleInp?.value || 'Sem título',
        body:  bodyArea?.value || '',
      });
      Toast.ok('Salvo!'); render();
    });

    _$('#note-del', root)?.addEventListener('click', () => {
      _modalConfirm('Excluir esta anotação?', () => {
        Store.removeAnotacao(activeNoteId);
        activeNoteId = null; render();
      });
    });

    if (bodyArea) {
      const save = () => {
        if (!activeNoteId) return;
        Store.updateAnotacao(activeNoteId, { title: titleInp?.value || '', body: bodyArea.value });
      };
      bodyArea.addEventListener('input', () => clearTimeout(bodyArea._t) || (bodyArea._t = setTimeout(save, 800)));
    }
  }

  render();
}

/* ═══════════════════════════════════════
   MAPAS MENTAIS
   ═══════════════════════════════════════ */
function viewMapas(root) {
  const { Store, Modal, Toast } = window.NX;
  let activeMapId = null;
  let selectedNodeId = null;

  function render() {
    if (activeMapId) { renderEditor(); return; }
    renderGrid();
  }

  function renderGrid() {
    const mapas = Store.state.mapas;
    const discs = Store.state.disciplinas;

    root.innerHTML = `
      <div class="section-hd">
        <span class="section-title">Mapas Mentais</span>
        <button class="btn btn-primary" id="btn-add-mapa">+ Mapa</button>
      </div>
      <div class="mapas-grid">
        ${mapas.length ? mapas.map(m => {
          const disc = Store.disciplinaById(m.disciplinaId);
          const nodeCount = countNodes(m.root);
          return `<div class="mapa-card" data-id="${m.id}" style="--mapa-color:${m.color}">
            <div class="mapa-card-icon">⌬</div>
            <div class="mapa-card-title">${_esc(m.title)}</div>
            ${disc ? `<div class="mapa-card-disc">${_esc(disc.name)}</div>` : ''}
            <div class="mapa-card-meta">${nodeCount} nós · ${_fmt(m.updatedAt)}</div>
            <div class="mapa-card-actions">
              <button class="btn btn-primary btn-sm mapa-open" data-id="${m.id}">Abrir</button>
              <button class="btn btn-ghost btn-sm mapa-del" data-id="${m.id}">✕</button>
            </div>
          </div>`;
        }).join('') : '<div class="empty-state"><div class="empty-icon">⌬</div><div class="empty-title">Nenhum mapa mental</div><p class="empty-hint">Crie mapas para organizar o conhecimento visualmente.</p></div>'}
      </div>
    `;

    _$('#btn-add-mapa', root)?.addEventListener('click', () => {
      const discs = Store.state.disciplinas;
      _modalOpen('Novo Mapa Mental', `
        <div class="form-group">
          <label class="form-label">Disciplina</label>
          <select class="input" id="mapa-disc">
            <option value="">Nenhuma</option>
            ${discs.map(d => `<option value="${d.id}">${_esc(d.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Título do mapa</label>
          <input class="input" id="mapa-title" placeholder="Ex: CF/88 – Direitos Fundamentais" autofocus>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-close-modal>Cancelar</button>
          <button class="btn btn-primary" id="mapa-save">Criar</button>
        </div>
      `);
      setTimeout(() => {
        _$('#mapa-save')?.addEventListener('click', () => {
          const title = _$('#mapa-title')?.value.trim();
          if (!title) return;
          const discId = _$('#mapa-disc')?.value || null;
          const m = Store.addMapa(discId, title);
          window.NX.Modal.close(); activeMapId = m.id; selectedNodeId = null; render();
        });
      }, 50);
    });

    _$$('.mapa-open', root).forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); activeMapId = btn.dataset.id; render(); });
    });
    _$$('.mapa-del', root).forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        _modalConfirm('Excluir este mapa?', () => { Store.removeMapa(btn.dataset.id); render(); });
      });
    });
  }

  function countNodes(node) {
    if (!node) return 0;
    return 1 + (node.children || []).reduce((a, c) => a + countNodes(c), 0);
  }

  function renderEditor() {
    const mapa = Store.mapaById(activeMapId);
    if (!mapa) { activeMapId = null; renderGrid(); return; }

    root.innerHTML = `
      <div class="mapa-editor">
        <div class="mapa-ed-bar">
          <button class="btn btn-ghost btn-sm" id="mapa-back">← Mapas</button>
          <span class="mapa-ed-title">${_esc(mapa.title)}</span>
          <div class="mapa-ed-actions">
            <button class="btn btn-ghost btn-sm" id="mapa-add-child" ${selectedNodeId ? '' : 'disabled'}>+ Filho</button>
            <button class="btn btn-ghost btn-sm" id="mapa-del-node" ${selectedNodeId && selectedNodeId !== mapa.root.id ? '' : 'disabled'}>Remover nó</button>
          </div>
        </div>
        <div class="mapa-canvas" id="mapa-canvas">
          <div class="mapa-tree">${renderMmNode(mapa.root, 0)}</div>
        </div>
        <div class="mapa-ed-info">
          ${selectedNodeId ? `<div class="mapa-node-edit">
            <input class="input" id="node-text-inp" value="${_esc(Store.findNode(mapa.root, selectedNodeId).node?.text || '')}">
            <button class="btn btn-primary btn-sm" id="node-save-btn">Salvar</button>
          </div>` : '<p class="mapa-hint">Clique em um nó para editar</p>'}
        </div>
      </div>
    `;

    _$('#mapa-back', root)?.addEventListener('click', () => { activeMapId = null; selectedNodeId = null; renderGrid(); });

    _$$('.mm-node', root).forEach(el => {
      el.addEventListener('click', (e) => { e.stopPropagation(); selectedNodeId = el.dataset.nodeId; renderEditor(); });
    });

    _$('#mapa-add-child', root)?.addEventListener('click', () => {
      if (!selectedNodeId) return;
      Store.addMapaNode(activeMapId, selectedNodeId, 'Novo tópico');
      render();
    });

    _$('#mapa-del-node', root)?.addEventListener('click', () => {
      if (!selectedNodeId || selectedNodeId === mapa.root.id) return;
      Store.removeMapaNode(activeMapId, selectedNodeId);
      selectedNodeId = null; render();
    });

    _$('#node-save-btn', root)?.addEventListener('click', () => {
      const text = _$('#node-text-inp', root)?.value.trim();
      if (!text || !selectedNodeId) return;
      Store.updateMapaNode(activeMapId, selectedNodeId, { text });
      render();
    });
  }

  function renderMmNode(node, depth) {
    const isSelected = node.id === selectedNodeId;
    return `
      <div class="mm-node-wrap" style="--depth:${depth}">
        <div class="mm-node ${isSelected ? 'is-selected' : ''}" data-node-id="${node.id}"
          style="--node-color:${node.color || '#E8B84B'}">
          ${_esc(node.text)}
        </div>
        ${node.children?.length ? `<div class="mm-children">
          ${node.children.map(c => renderMmNode(c, depth + 1)).join('')}
        </div>` : ''}
      </div>`;
  }

  render();
}

/* ═══════════════════════════════════════
   ESTATÍSTICAS
   ═══════════════════════════════════════ */
function viewEstatisticas(root) {
  const { Store } = window.NX;
  const st = Store.state;

  const totalHours = (st.sessoes.reduce((a, s) => a + (s.durationMs || 0), 0) / 3600000).toFixed(1);
  const hoursWeek  = Store.totalHoursWeek().toFixed(1);
  const totalRev   = st.revisoes.length;
  const streak     = computeStreak();

  const byDisc = {};
  st.sessoes.forEach(s => {
    byDisc[s.disciplinaId] = (byDisc[s.disciplinaId] || 0) + (s.durationMs || 0);
  });
  const discRanking = st.disciplinas
    .map(d => ({ d, ms: byDisc[d.id] || 0 }))
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 8);

  const last30 = buildHeatData(30);

  root.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-val">${totalHours}h</div>
        <div class="stat-label">Total estudado</div>
      </div>
      <div class="stat-card">
        <div class="stat-val">${hoursWeek}h</div>
        <div class="stat-label">Esta semana</div>
      </div>
      <div class="stat-card">
        <div class="stat-val">${streak}</div>
        <div class="stat-label">Dias seguidos</div>
      </div>
      <div class="stat-card">
        <div class="stat-val">${totalRev}</div>
        <div class="stat-label">Revisões agendadas</div>
      </div>
    </div>

    <div class="stats-blocks">
      <div class="stats-block">
        <div class="section-hd"><span class="section-title">Horas por disciplina</span></div>
        ${discRanking.length ? discRanking.map(({ d, ms }) => {
          const hrs = (ms / 3600000).toFixed(1);
          const max = discRanking[0]?.ms || 1;
          const pct = Math.round(ms / max * 100);
          return `<div class="stat-disc-row">
            <span class="stat-disc-dot" style="background:${d.color}"></span>
            <span class="stat-disc-name">${_esc(d.name)}</span>
            <div class="progress-bar stat-disc-bar">
              <div class="progress-fill" style="width:${pct}%;background:${d.color}"></div>
            </div>
            <span class="stat-disc-hrs">${hrs}h</span>
          </div>`;
        }).join('') : '<p class="empty-hint">Sem sessões registradas.</p>'}
      </div>

      <div class="stats-block">
        <div class="section-hd"><span class="section-title">Atividade (30 dias)</span></div>
        <div class="heat-cal">
          ${last30.map(day => `<div class="heat-cell heat-${day.lvl}" title="${day.label}"></div>`).join('')}
        </div>
        <div class="heat-legend">
          <span>menos</span>
          ${[0,1,2,3,4].map(l => `<div class="heat-cell heat-${l}"></div>`).join('')}
          <span>mais</span>
        </div>
      </div>
    </div>
  `;

  function buildHeatData(days) {
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const ts = Date.now() - i * 86400000;
      const dayStart = ts - ts % 86400000;
      const mins = st.sessoes
        .filter(s => s.startedAt >= dayStart && s.startedAt < dayStart + 86400000)
        .reduce((a, s) => a + (s.durationMs || 0) / 60000, 0);
      const lvl = mins === 0 ? 0 : mins < 30 ? 1 : mins < 60 ? 2 : mins < 120 ? 3 : 4;
      const d = new Date(ts);
      result.push({ lvl, label: `${d.toLocaleDateString('pt-BR')} · ${Math.round(mins)}min` });
    }
    return result;
  }
}

/* ═══════════════════════════════════════
   VIEWS REGISTER
   ═══════════════════════════════════════ */
const Views = {
  register() {
    const { Router } = window.NX;
    Router.register('dashboard',    viewDashboard);
    Router.register('edital',       viewEdital);
    Router.register('cronograma',   viewCronograma);
    Router.register('revisoes',     viewRevisoes);
    Router.register('flashcards',   viewFlashcards);
    Router.register('erros',        viewErros);
    Router.register('resumos',      viewResumos);
    Router.register('mapas',        viewMapas);
    Router.register('estatisticas', viewEstatisticas);
  },
};

window.Views = Views;
