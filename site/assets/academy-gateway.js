(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  let curriculum = null;

  function el(tag, className = '', text = '') {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function renderPrerequisites(chapter, labels) {
    const wrap = el('div', 'prerequisite-list');
    const label = el('span', 'chapter-meta-label', 'Prerequisites');
    wrap.append(label);
    if (!chapter.prerequisites.length) {
      wrap.append(el('span', 'prerequisite-chip', 'Start here'));
      return wrap;
    }
    chapter.prerequisites.forEach(id => wrap.append(el('span', 'prerequisite-chip', labels.get(id) || id)));
    return wrap;
  }

  function chapterCard(chapter, labels) {
    const card = el('article', 'chapter-card');
    card.dataset.status = chapter.status;

    const top = el('div', 'chapter-card-top');
    const status = el('span', `chapter-status ${ProjectXCAcademy.statusClass(chapter.status)}`, ProjectXCAcademy.statusLabel(chapter.status));
    const depth = el('span', 'chapter-depth', chapter.level);
    top.append(status, depth);

    const title = el('h3');
    if (chapter.status === 'live' || chapter.status === 'existing-tool') {
      const link = el('a', '', chapter.title);
      link.href = chapter.route;
      title.append(link);
    } else {
      title.textContent = chapter.title;
    }

    const summary = el('p', 'chapter-summary', chapter.summary);
    const metrics = el('div', 'chapter-metrics');
    metrics.append(
      el('span', '', `${chapter.levels} levels`),
      el('span', '', `${chapter.games} games`)
    );

    card.append(top, title, summary, metrics, renderPrerequisites(chapter, labels));

    if (chapter.status === 'live') {
      const done = ProjectXCAcademy.completedMissions(chapter.id).length;
      const progress = el('div', 'chapter-inline-progress');
      progress.setAttribute('aria-label', `${chapter.title} progress`);
      const bar = el('span', 'chapter-inline-progress-bar');
      const fill = el('span', 'chapter-inline-progress-fill');
      fill.style.width = `${chapter.levels ? Math.min(100, 100 * done / chapter.levels) : 0}%`;
      bar.append(fill);
      progress.append(bar, el('strong', '', `${Math.min(done, chapter.levels)} / ${chapter.levels} missions`));
      card.append(progress);
    }

    if (Array.isArray(chapter.companion_routes)) {
      const tools = el('div', 'chapter-companions');
      chapter.companion_routes.forEach(route => {
        const link = el('a', '', route === 'mo-builder.html' ? 'Open MO Builder' : 'Open companion tool');
        link.href = route;
        tools.append(link);
      });
      card.append(tools);
    }

    if (chapter.status === 'planned' || chapter.status === 'in-development') {
      const note = el('p', 'chapter-planned-note', chapter.status === 'planned' ? 'Route reserved; content is not presented as complete.' : 'The chapter is being built and has not passed release gates.');
      card.append(note);
    }
    return card;
  }

  function renderTracks(data) {
    const host = $('academyTracks');
    host.replaceChildren();
    const chapters = ProjectXCAcademy.flattenChapters(data);
    const labels = new Map(chapters.map(chapter => [chapter.id, chapter.title]));

    data.tracks.forEach((track, index) => {
      const section = el('section', 'academy-track');
      section.id = `track-${track.id}`;
      const header = el('div', 'academy-track-header');
      const identity = el('div');
      identity.append(
        el('p', 'kicker', `Track ${index + 1}`),
        el('h2', '', track.title),
        el('p', 'academy-track-description', track.description)
      );
      const counts = el('div', 'academy-track-counts');
      counts.append(
        el('span', '', `${track.chapters.length} chapters`),
        el('span', '', `${track.chapters.reduce((sum, chapter) => sum + chapter.levels, 0)} levels`)
      );
      header.append(identity, counts);

      const grid = el('div', 'chapter-grid');
      track.chapters.slice().sort((a, b) => a.order - b.order).forEach(chapter => grid.append(chapterCard(chapter, labels)));
      section.append(header, grid);
      host.append(section);
    });
  }

  function renderSummary() {
    if (!curriculum) return;
    const chapters = ProjectXCAcademy.flattenChapters(curriculum);
    const summary = ProjectXCAcademy.summarizeCurriculum(curriculum);
    const live = chapters.filter(chapter => chapter.status === 'live').length;
    const existing = chapters.filter(chapter => chapter.status === 'existing-tool').length;
    const planned = chapters.filter(chapter => chapter.status === 'planned' || chapter.status === 'in-development').length;
    $('academyChapterCount').textContent = String(chapters.length);
    $('academyLiveCount').textContent = String(live + existing);
    $('academyPlannedCount').textContent = String(planned);
    $('academyProgressText').textContent = `${summary.completed} / ${summary.available} live Academy missions`;
    $('academyProgressFill').style.width = `${summary.fraction * 100}%`;
  }

  async function init() {
    const state = $('academyLoadState');
    try {
      curriculum = await ProjectXCAcademy.loadCurriculum();
      renderTracks(curriculum);
      renderSummary();
      state.textContent = `Curriculum v${curriculum.version} loaded: ${curriculum.tracks.length} dependency-connected tracks.`;
      state.classList.add('loaded');
    } catch (error) {
      state.textContent = `The curriculum map could not load: ${error.message}. The start links above remain available.`;
      state.classList.add('failed');
    }

    $('resetAcademyProgress')?.addEventListener('click', () => {
      ProjectXCAcademy.resetAll();
      if (curriculum) {
        renderTracks(curriculum);
        renderSummary();
      }
    });
    window.addEventListener(ProjectXCAcademy.PROGRESS_EVENT, () => {
      if (curriculum) {
        renderTracks(curriculum);
        renderSummary();
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
