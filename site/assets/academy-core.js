(() => {
  'use strict';

  const STORAGE_KEY = 'project-xc-academy-progress-v1';
  const STORAGE_VERSION = 1;
  const PROGRESS_EVENT = 'project-xc-academy-progress';

  function emptyState() {
    return { version: STORAGE_VERSION, chapters: {} };
  }

  function normalizeState(value) {
    if (!value || typeof value !== 'object' || value.version !== STORAGE_VERSION || !value.chapters || typeof value.chapters !== 'object') {
      return emptyState();
    }
    const clean = emptyState();
    Object.entries(value.chapters).forEach(([chapterId, chapter]) => {
      if (!/^[a-z0-9][a-z0-9-]*$/.test(chapterId) || !chapter || typeof chapter !== 'object') return;
      const missions = Array.isArray(chapter.missions)
        ? [...new Set(chapter.missions.filter(item => typeof item === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(item)))]
        : [];
      clean.chapters[chapterId] = {
        missions,
        updatedAt: typeof chapter.updatedAt === 'string' ? chapter.updatedAt : null
      };
    });
    return clean;
  }

  function loadProgress() {
    try {
      return normalizeState(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null'));
    } catch (_error) {
      return emptyState();
    }
  }

  function saveProgress(state) {
    const clean = normalizeState(state);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    } catch (_error) {
      // The page remains usable when storage is blocked or full.
    }
    window.dispatchEvent(new CustomEvent(PROGRESS_EVENT, { detail: clean }));
    return clean;
  }

  function completedMissions(chapterId) {
    return loadProgress().chapters[chapterId]?.missions || [];
  }

  function setMission(chapterId, missionId, complete = true) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(chapterId) || !/^[a-z0-9][a-z0-9-]*$/.test(missionId)) {
      throw new Error('Invalid Academy chapter or mission id');
    }
    const state = loadProgress();
    const chapter = state.chapters[chapterId] || { missions: [], updatedAt: null };
    const missions = new Set(chapter.missions);
    if (complete) missions.add(missionId); else missions.delete(missionId);
    state.chapters[chapterId] = {
      missions: [...missions],
      updatedAt: new Date().toISOString()
    };
    return saveProgress(state);
  }

  function resetChapter(chapterId) {
    const state = loadProgress();
    delete state.chapters[chapterId];
    return saveProgress(state);
  }

  function resetAll() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (_error) {
      // Keep the reset control harmless when storage is unavailable.
    }
    const state = emptyState();
    window.dispatchEvent(new CustomEvent(PROGRESS_EVENT, { detail: state }));
    return state;
  }

  function flattenChapters(curriculum) {
    if (!curriculum || !Array.isArray(curriculum.tracks)) return [];
    return curriculum.tracks.flatMap(track => Array.isArray(track.chapters) ? track.chapters : []);
  }

  function summarizeCurriculum(curriculum) {
    const progress = loadProgress();
    const chapters = flattenChapters(curriculum);
    let completed = 0;
    let available = 0;
    chapters.forEach(chapter => {
      if (chapter.status !== 'live') return;
      const total = Number(chapter.levels) || 0;
      available += total;
      completed += Math.min(total, progress.chapters[chapter.id]?.missions?.length || 0);
    });
    return { completed, available, fraction: available ? completed / available : 0 };
  }

  async function loadCurriculum(url = 'data/academy-curriculum.json') {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Curriculum request failed (${response.status})`);
    const data = await response.json();
    if (!data || data.version !== 1 || !Array.isArray(data.tracks)) {
      throw new Error('Curriculum data has an unsupported structure');
    }
    return data;
  }

  function statusLabel(status) {
    return ({
      live: 'Live chapter',
      'existing-tool': 'Existing Project XC tool',
      'in-development': 'In development',
      planned: 'Planned'
    })[status] || 'Unknown status';
  }

  function statusClass(status) {
    return ({
      live: 'live',
      'existing-tool': 'existing',
      'in-development': 'building',
      planned: 'planned'
    })[status] || 'planned';
  }

  function bindChapter({ chapterId, totalMissions = null } = {}) {
    if (!chapterId) throw new Error('bindChapter requires chapterId');
    const missionButtons = [...document.querySelectorAll('.academy-complete[data-mission]')];
    const navigation = [...document.querySelectorAll('.academy-lesson-nav [data-step]')];
    const total = Number(totalMissions) || missionButtons.length;

    missionButtons.forEach(button => {
      button.dataset.originalText ||= button.textContent.trim();
      button.addEventListener('click', () => {
        const missionId = button.dataset.mission;
        const done = completedMissions(chapterId).includes(missionId);
        setMission(chapterId, missionId, !done);
        render();
      });
    });

    navigation.forEach(button => {
      button.addEventListener('click', () => {
        const target = document.querySelector(`.academy-lesson[data-step="${CSS.escape(button.dataset.step)}"]`);
        navigation.forEach(item => item.classList.toggle('active', item === button));
        target?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      });
    });

    document.getElementById('resetChapterProgress')?.addEventListener('click', () => {
      resetChapter(chapterId);
      render();
    });

    function render() {
      const completed = new Set(completedMissions(chapterId));
      missionButtons.forEach(button => {
        const done = completed.has(button.dataset.mission);
        button.classList.toggle('done', done);
        button.setAttribute('aria-pressed', String(done));
        button.textContent = done ? `Completed: ${button.dataset.badge || button.dataset.originalText}` : button.dataset.originalText;
      });
      const count = Math.min(completed.size, total);
      const text = document.getElementById('chapterProgressText');
      if (text) text.textContent = `${count} / ${total} missions`;
      const fill = document.getElementById('chapterProgressFill');
      if (fill) fill.style.width = `${total ? 100 * count / total : 0}%`;
      const shelf = document.getElementById('chapterBadgeShelf');
      if (shelf) {
        shelf.replaceChildren();
        if (!completed.size) {
          const item = document.createElement('span');
          item.className = 'quest-badge muted';
          item.textContent = 'No chapter missions completed yet.';
          shelf.append(item);
        } else {
          missionButtons.filter(button => completed.has(button.dataset.mission)).forEach(button => {
            const item = document.createElement('span');
            item.className = 'quest-badge';
            item.textContent = `✓ ${button.dataset.badge || button.dataset.mission}`;
            shelf.append(item);
          });
        }
      }
    }

    render();
    navigation[0]?.classList.add('active');
    return { render };
  }

  window.ProjectXCAcademy = Object.freeze({
    STORAGE_KEY,
    PROGRESS_EVENT,
    loadProgress,
    saveProgress,
    completedMissions,
    setMission,
    resetChapter,
    resetAll,
    flattenChapters,
    summarizeCurriculum,
    loadCurriculum,
    statusLabel,
    statusClass,
    bindChapter
  });
})();
