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

  function normalizeMissionIds(values) {
    return Array.isArray(values)
      ? [...new Set(values.filter(item => typeof item === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(item)))]
      : [];
  }

  function normalizeLegacyBadges(values, badgeIds, aliases = {}) {
    const allowed = new Set(normalizeMissionIds(badgeIds));
    const legacyAliases = aliases && typeof aliases === 'object' && !Array.isArray(aliases) ? aliases : {};
    if (!Array.isArray(values) || !allowed.size) return [];
    return [...new Set(values
      .filter(item => typeof item === 'string')
      .map(item => item.trim())
      .filter(Boolean)
      .map(item => allowed.has(item) ? item : legacyAliases[item])
      .filter(item => allowed.has(item)))];
  }

  function completedMissions(chapterId, validMissionIds = null) {
    const missions = loadProgress().chapters[chapterId]?.missions || [];
    if (!Array.isArray(validMissionIds)) return missions;
    const allowed = new Set(normalizeMissionIds(validMissionIds));
    return missions.filter(missionId => allowed.has(missionId));
  }

  function setMission(chapterId, missionId, complete = true, validMissionIds = null) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(chapterId) || !/^[a-z0-9][a-z0-9-]*$/.test(missionId)) {
      throw new Error('Invalid Academy chapter or mission id');
    }
    if (Array.isArray(validMissionIds) && !normalizeMissionIds(validMissionIds).includes(missionId)) {
      throw new Error(`Mission ${missionId} is not part of chapter ${chapterId}`);
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

  function reconcileChapterMissions(chapterId, validMissionIds) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(chapterId) || !Array.isArray(validMissionIds)) {
      throw new Error('Mission reconciliation requires a valid chapter id and mission-id list');
    }
    const allowed = new Set(normalizeMissionIds(validMissionIds));
    const state = loadProgress();
    const chapter = state.chapters[chapterId];
    if (!chapter) return state;
    const missions = chapter.missions.filter(missionId => allowed.has(missionId));
    if (missions.length === chapter.missions.length) return state;
    if (missions.length) state.chapters[chapterId] = { ...chapter, missions };
    else delete state.chapters[chapterId];
    return saveProgress(state);
  }

  function reconcileCurriculumMissions(curriculum) {
    const state = loadProgress();
    let changed = false;
    flattenChapters(curriculum).forEach(chapter => {
      const contract = chapter?.progress;
      if (contract?.kind !== 'academy-missions' || !Array.isArray(contract.mission_ids)) return;
      const stored = state.chapters[chapter.id];
      if (!stored) return;
      const allowed = new Set(normalizeMissionIds(contract.mission_ids));
      const missions = stored.missions.filter(missionId => allowed.has(missionId));
      if (missions.length === stored.missions.length) return;
      changed = true;
      if (missions.length) state.chapters[chapter.id] = { ...stored, missions };
      else delete state.chapters[chapter.id];
    });
    return changed ? saveProgress(state) : state;
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

  function chapterProgress(chapter) {
    if (!chapter || typeof chapter !== 'object') return null;
    const contract = chapter.progress && typeof chapter.progress === 'object' ? chapter.progress : null;
    const kind = contract?.kind || (chapter.status === 'live' ? 'academy-missions' : null);
    const totalValue = Number(contract?.total ?? chapter.levels);
    const total = Number.isInteger(totalValue) && totalValue > 0 ? totalValue : 0;
    if (!kind || !total) return null;

    if (kind === 'academy-missions') {
      const missionIds = Array.isArray(contract?.mission_ids) ? contract.mission_ids : null;
      const completed = Math.min(total, completedMissions(chapter.id, missionIds).length);
      return {
        completed,
        total,
        fraction: completed / total,
        kind,
        label: contract?.label || 'Academy missions',
        readOnly: false
      };
    }

    if (kind === 'legacy-badges' && typeof contract?.storage_key === 'string' && contract.storage_key) {
      let badges = [];
      try {
        const parsed = JSON.parse(window.localStorage.getItem(contract.storage_key) || '[]');
        badges = normalizeLegacyBadges(parsed, contract.badge_ids, contract.legacy_badge_aliases);
      } catch (_error) {
        badges = [];
      }
      const completed = Math.min(total, badges.length);
      return {
        completed,
        total,
        fraction: completed / total,
        kind,
        label: contract.label || 'Existing tool missions',
        readOnly: true
      };
    }

    return null;
  }

  function summarizeCurriculum(curriculum) {
    const chapters = flattenChapters(curriculum);
    let completed = 0;
    let available = 0;
    chapters.forEach(chapter => {
      const progress = chapterProgress(chapter);
      if (!progress) return;
      available += progress.total;
      completed += progress.completed;
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
    const missionIds = normalizeMissionIds(missionButtons.map(button => button.dataset.mission));
    const navigation = [...document.querySelectorAll('.academy-lesson-nav [data-step]')];
    const total = Number(totalMissions) || missionButtons.length;
    reconcileChapterMissions(chapterId, missionIds);

    missionButtons.forEach(button => {
      button.dataset.originalText ||= button.textContent.trim();
      button.addEventListener('click', () => {
        const missionId = button.dataset.mission;
        const done = completedMissions(chapterId, missionIds).includes(missionId);
        setMission(chapterId, missionId, !done, missionIds);
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
      const completed = new Set(completedMissions(chapterId, missionIds));
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
    normalizeLegacyBadges,
    reconcileChapterMissions,
    reconcileCurriculumMissions,
    resetChapter,
    resetAll,
    flattenChapters,
    chapterProgress,
    summarizeCurriculum,
    loadCurriculum,
    statusLabel,
    statusClass,
    bindChapter
  });
})();
