(() => {
  'use strict';
  const root = document.documentElement;
  const viewport = document.querySelector('.gallery-viewport');
  const gallery = document.querySelector('.gallery');
  const pieces = [...document.querySelectorAll('.piece')];
  const projectDialog = document.querySelector('.project-dialog');
  const aboutDialog = document.querySelector('.about-dialog');
  const modeToggle = document.querySelector('.mode-toggle');
  const modeMenu = document.querySelector('.mode-menu');
  const motionToggle = document.querySelector('.motion-toggle');
  const countLabel = document.querySelector('.collection-count');
  const hint = document.querySelector('.interaction-hint');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const modes = ['sphere', 'heart', 'smiley', 'star', 'grid'];
  const state = {
    mode: 'sphere', filter: 'all', angle: .42, tilt: -.12, zoom: 1,
    paused: reducedMotion.matches, velocity: 0, drag: null, hover: false,
    focused: false, selected: 0, width: 0, height: 0, lastTime: 0,
    cardWidth: 180, radiusX: 250, radiusY: 200, suppressClickUntil: 0,
  };
  let visible = pieces.slice();
  const positions = new Map();
  let frame = 0;
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const modalOpen = () => projectDialog.open || aboutDialog.open;

  function measure() {
    state.width = viewport.clientWidth;
    state.height = viewport.clientHeight;
    const mobile = state.width < 601;
    state.cardWidth = mobile ? clamp(state.width * .29, 84, 150) : clamp(state.width * .145, 130, 225);
    state.cardWidth = Math.min(state.cardWidth, Math.max(82, state.height * .44));
    state.radiusX = Math.max(40, Math.min(state.width * .34, (state.width - state.cardWidth * 1.22 - 50) / 2));
    state.radiusY = Math.max(35, (state.height - state.cardWidth / 1.32 * 1.12 - 48) / 2);
    gallery.style.setProperty('--card-width', `${state.cardWidth}px`);
    requestFrame();
  }

  function shapePoint(index, total) {
    // With few entries, a shallow arc keeps each result individually reachable.
    if (total < 4) return {x: (index - (total - 1) / 2) * .95, y: 0, z: 0};
    const a = index / total * Math.PI * 2;
    if (state.mode === 'heart') {
      return {x: Math.pow(Math.sin(a), 3), y: -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 17, z: 0};
    }
    if (state.mode === 'star') {
      const step = index / total * 10;
      const vertex = Math.floor(step);
      const t = step - vertex;
      const point = n => {
        const angle = n * Math.PI / 5 - Math.PI / 2;
        const radius = n % 2 ? .44 : 1;
        return {x: Math.cos(angle) * radius, y: Math.sin(angle) * radius};
      };
      const start = point(vertex), end = point(vertex + 1);
      return {x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t, z: 0};
    }
    if (state.mode === 'smiley') {
      const ringCount = total - 4;
      if (index < ringCount) {
        const ringAngle = index / ringCount * Math.PI * 2;
        return {x: Math.cos(ringAngle), y: Math.sin(ringAngle), z: 0};
      }
      return [{x: -.34, y: -.26, z: 0}, {x: .34, y: -.26, z: 0}, {x: -.27, y: .35, z: 0}, {x: .27, y: .35, z: 0}][index - ringCount];
    }
    const y = 1 - 2 * (index + .5) / total;
    const r = Math.sqrt(1 - y * y);
    const theta = index * Math.PI * (3 - Math.sqrt(5));
    return {x: Math.cos(theta) * r, y, z: Math.sin(theta) * r};
  }

  function requestFrame() {
    if (!frame && !document.hidden) frame = requestAnimationFrame(render);
  }

  function render(now) {
    frame = 0;
    const dt = Math.min((now - (state.lastTime || now)) / 16.667, 3);
    state.lastTime = now;
    if (state.mode === 'grid') return;
    const canMove = !state.paused && !state.drag && !state.hover && !state.focused && !modalOpen();
    if (canMove) {
      state.angle += (.0014 + state.velocity) * dt;
      state.velocity *= Math.pow(.94, dt);
    }
    let settling = false;
    visible.forEach((piece, index) => {
      const point = shapePoint(index, visible.length);
      let x = point.x, y = point.y, z = point.z;
      if (state.mode === 'sphere' && visible.length >= 4) {
        x = point.x * Math.cos(state.angle) + point.z * Math.sin(state.angle);
        z = -point.x * Math.sin(state.angle) + point.z * Math.cos(state.angle);
        y = point.y * Math.cos(state.tilt) - z * Math.sin(state.tilt);
        z = point.y * Math.sin(state.tilt) + z * Math.cos(state.tilt);
      } else if (visible.length >= 4) {
        x *= .91 + Math.cos(state.angle) * .09;
        z = Math.sin(state.angle) * point.x * .28;
      }
      const scale = (.86 + z * .18) * state.zoom;
      const target = {x: x * state.radiusX * state.zoom, y: y * state.radiusY * state.zoom, scale};
      const old = positions.get(piece) || target;
      const ease = reducedMotion.matches || state.drag ? 1 : .16;
      const current = {
        x: old.x + (target.x - old.x) * ease,
        y: old.y + (target.y - old.y) * ease,
        scale: old.scale + (target.scale - old.scale) * ease,
      };
      if (Math.abs(current.x - target.x) + Math.abs(current.y - target.y) > .3) settling = true;
      positions.set(piece, current);
      piece.style.transform = `translate(-50%, -50%) translate(${current.x.toFixed(2)}px, ${current.y.toFixed(2)}px) scale(${current.scale.toFixed(3)})`;
      piece.style.zIndex = String(Math.round((z + 1) * 100));
      piece.style.opacity = String(clamp(.84 + z * .16, .7, 1));
    });
    if ((canMove && visible.length >= 4) || settling) requestFrame();
  }

  function closeModeMenu() {
    const returnFocus = modeMenu.contains(document.activeElement);
    modeMenu.hidden = true;
    modeToggle.setAttribute('aria-expanded', 'false');
    if (returnFocus) modeToggle.focus();
  }

  function setMode(mode) {
    if (!modes.includes(mode)) return;
    state.mode = mode;
    state.zoom = 1;
    state.velocity = 0;
    root.classList.toggle('is-grid', mode === 'grid');
    modeToggle.firstChild.textContent = `${mode} `;
    document.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === mode)));
    hint.textContent = mode === 'sphere' ? 'drag to rotate · select to explore' : 'drag to turn · select to explore';
    closeModeMenu();
    measure();
  }

  function setFilter(filter, updateHash = true) {
    if (!['all', 'projects', 'writing'].includes(filter)) return;
    state.filter = filter;
    visible = pieces.filter(piece => filter === 'all' || piece.dataset.category === filter);
    pieces.forEach(piece => { piece.hidden = !visible.includes(piece); });
    document.querySelectorAll('[data-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === filter)));
    countLabel.textContent = `${filter} · ${visible.length}`;
    document.querySelector('.frame-label').textContent = `${filter} / ${String(visible.length).padStart(3, '0')} items`;
    if (updateHash) history.replaceState(null, '', filter === 'all' ? '#home' : `#${filter}`);
    viewport.scrollTop = 0;
    positions.clear();
    measure();
  }

  function updateMotion() {
    motionToggle.textContent = state.paused ? 'play' : 'pause';
    motionToggle.setAttribute('aria-pressed', String(state.paused));
    motionToggle.setAttribute('aria-label', state.paused ? 'Play gallery motion' : 'Pause gallery motion');
    requestFrame();
  }

  function showProject(index) {
    state.selected = (index + visible.length) % visible.length;
    const piece = visible[state.selected];
    document.querySelector('#project-title').textContent = piece.querySelector('.piece-title').textContent;
    document.querySelector('.project-meta').textContent = piece.dataset.tag;
    document.querySelector('.project-preview').replaceChildren(piece.querySelector('.piece-visual').cloneNode(true));
    document.querySelector('.project-body').replaceChildren(piece.querySelector('template').content.cloneNode(true));
    document.querySelector('.project-position').textContent = `${state.selected + 1} / ${visible.length}`;
    if (!projectDialog.open) projectDialog.showModal();
    projectDialog.scrollTop = 0;
  }

  pieces.forEach(piece => {
    piece.querySelector('.piece-open').addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (performance.now() < state.suppressClickUntil) return;
      showProject(visible.indexOf(piece));
    });
    piece.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') state.hover = true; });
    piece.addEventListener('pointerleave', () => { state.hover = false; requestFrame(); });
    piece.addEventListener('focusin', () => { state.focused = true; });
    piece.addEventListener('focusout', () => { state.focused = false; requestFrame(); });
  });

  gallery.addEventListener('dragstart', event => event.preventDefault());
  viewport.addEventListener('pointerdown', event => {
    if (state.mode === 'grid' || event.button !== 0 || !event.isPrimary || modalOpen()) return;
    state.drag = {id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false};
    state.velocity = 0;
  });
  viewport.addEventListener('pointermove', event => {
    const drag = state.drag;
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 5) {
      drag.moved = true;
      if (!viewport.hasPointerCapture(event.pointerId)) viewport.setPointerCapture(event.pointerId);
      viewport.classList.add('is-dragging');
    }
    if (drag.moved) {
      state.angle += dx * .008;
      state.tilt = clamp(state.tilt + dy * .003, -.55, .55);
      state.velocity = clamp(dx * .0015, -.045, .045);
      requestFrame();
    }
    drag.x = event.clientX;
    drag.y = event.clientY;
  });
  function finishDrag(event) {
    if (!state.drag || state.drag.id !== event.pointerId) return;
    if (state.drag.moved) state.suppressClickUntil = performance.now() + 250;
    state.drag = null;
    state.hover = false;
    viewport.classList.remove('is-dragging');
    if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    requestFrame();
  }
  window.addEventListener('pointerup', finishDrag);
  window.addEventListener('pointercancel', finishDrag);
  viewport.addEventListener('lostpointercapture', finishDrag);
  viewport.addEventListener('wheel', event => {
    if (state.mode === 'grid' || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    state.zoom = clamp(state.zoom - event.deltaY * .0005, .7, 1.07);
    requestFrame();
  }, {passive: false});
  modeToggle.addEventListener('click', () => {
    modeMenu.hidden = !modeMenu.hidden;
    modeToggle.setAttribute('aria-expanded', String(!modeMenu.hidden));
  });
  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => { setMode(button.dataset.mode); modeToggle.focus(); }));
  document.querySelector('.previous-mode').addEventListener('click', () => setMode(modes[(modes.indexOf(state.mode) + modes.length - 1) % modes.length]));
  document.querySelector('.next-mode').addEventListener('click', () => setMode(modes[(modes.indexOf(state.mode) + 1) % modes.length]));
  document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => setFilter(button.dataset.filter)));
  motionToggle.addEventListener('click', () => { state.paused = !state.paused; updateMotion(); });
  document.querySelector('.previous-project').addEventListener('click', () => showProject(state.selected - 1));
  document.querySelector('.next-project').addEventListener('click', () => showProject(state.selected + 1));
  document.querySelector('.close-project').addEventListener('click', () => projectDialog.close());
  document.querySelector('.close-about').addEventListener('click', () => aboutDialog.close());
  document.querySelector('.about-toggle').addEventListener('click', () => { closeModeMenu(); aboutDialog.showModal(); });
  [projectDialog, aboutDialog].forEach(dialog => {
    dialog.addEventListener('click', event => {
      const rect = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
    });
    dialog.addEventListener('close', requestFrame);
  });
  document.addEventListener('click', event => { if (!event.target.closest('.mode-selector')) closeModeMenu(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { closeModeMenu(); return; }
    if (projectDialog.open && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault();
      showProject(state.selected + (event.key === 'ArrowRight' ? 1 : -1));
    }
  });
  function applyHash() {
    const hash = location.hash.slice(1);
    if (['projects', 'writing'].includes(hash)) setFilter(hash, false);
    else if (!hash || hash === 'home') setFilter('all', false);
  }
  document.querySelector('.identity').addEventListener('click', event => { event.preventDefault(); setFilter('all'); });
  window.addEventListener('hashchange', applyHash);
  window.addEventListener('resize', measure);
  document.addEventListener('visibilitychange', () => { state.lastTime = 0; requestFrame(); });
  reducedMotion.addEventListener('change', event => { state.paused = event.matches; updateMotion(); });
  // Only hide the fallback layout after the interactive controls are wired.
  root.classList.add('enhanced');
  applyHash();
  updateMotion();
  measure();
})();
