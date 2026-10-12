(function () {
  'use strict';
  var preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  var clamp = function (v) { return Math.max(0, Math.min(1, v)); };
  var segment = function (p, from, to) {
    var t = clamp((p - from) / (to - from));
    return t * t * (3 - 2 * t);
  };
  var scene = document.querySelector('.scene-shell');
  var stage = document.querySelector('.scene-stage');
  var sources = Array.from(document.querySelectorAll('.scene-source'));
  var workspace = document.querySelector('.scene-workspace');
  var result = document.querySelector('.scene-result');
  var steps = Array.from(document.querySelectorAll('.scene-step'));
  var play = document.querySelector('.scene-play');
  var replay = document.querySelector('.scene-replay');
  var progress = 1, phase = -1, frame = 0, playing = false, inView = false;
  var lastY = window.scrollY, exitTimer = 0, heroArmed = true;

  function renderScene(p) {
    progress = clamp(p);
    var merge = segment(progress, .17, .45);
    sources.forEach(function (card, i) {
      card.style.opacity = String(1 - merge);
      card.style.transform = 'translate3d(' + ((i === 2 ? -38 : 38) * merge) + 'px,' + ((i === 1 ? -22 : 16) * merge) + 'px,0) scale(' + (1 - .12 * merge) + ')';
    });
    var panelIn = segment(progress, .28, .48);
    var panelOut = segment(progress, .67, .85);
    workspace.style.opacity = String(panelIn * (1 - panelOut));
    workspace.style.transform = 'translate3d(0,' + (22 * (1 - panelIn) - 14 * panelOut) + 'px,0) scale(' + (.94 + .06 * panelIn - .06 * panelOut) + ')';
    var output = segment(progress, .72, .98);
    result.style.opacity = String(output);
    result.style.transform = 'translate3d(0,' + (32 * (1 - output)) + 'px,0) scale(' + (.93 + .07 * output) + ')';
    scene.style.setProperty('--scene-progress', String(progress));
    var nextPhase = progress < .36 ? 0 : progress < .76 ? 1 : 2;
    if (nextPhase !== phase) {
      phase = nextPhase;
      steps.forEach(function (button, i) { button.setAttribute('aria-pressed', String(i === phase)); });
      scene.dataset.phase = String(phase);
    }
  }
  function stopScene() {
    cancelAnimationFrame(frame);
    frame = 0;
    playing = false;
    play.textContent = 'Воспроизвести';
    play.setAttribute('aria-label', 'Воспроизвести сцену работы панели');
  }
  function playScene(restart) {
    var from = restart || progress >= 1 ? 0 : progress;
    stopScene();
    if (preference.matches) { renderScene(1); return; }
    heroArmed = false;
    playing = true;
    play.textContent = 'Пауза';
    play.setAttribute('aria-label', 'Остановить анимацию сцены');
    var start = performance.now() - from * 4200;
    renderScene(from);
    function tick(now) {
      if (!playing || !inView || document.hidden) { stopScene(); return; }
      var p = clamp((now - start) / 4200);
      renderScene(p);
      if (p < 1) { frame = requestAnimationFrame(tick); }
      else { stopScene(); heroArmed = false; }
    }
    frame = requestAnimationFrame(tick);
  }
  if (scene && stage && workspace && result && play && replay) {
    play.hidden = false;
    replay.hidden = false;
    renderScene(1);
    play.addEventListener('click', function () { if (playing) stopScene(); else playScene(false); });
    replay.addEventListener('click', function () { playScene(true); });
    steps.forEach(function (button, i) {
      button.disabled = false;
      button.addEventListener('click', function () {
        stopScene();
        renderScene([.08, .55, 1][i]);
      });
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        var entry = entries[0];
        inView = entry.isIntersecting && entry.intersectionRatio >= .25;
        if (entry.isIntersecting) {
          clearTimeout(exitTimer);
          if (inView && heroArmed && !playing && !preference.matches) playScene(true);
        } else if (!entry.isIntersecting) {
          stopScene();
          exitTimer = setTimeout(function () { heroArmed = true; }, 700);
        }
      }, {threshold:[0,.25]}).observe(scene);
    } else {
      inView = true;
      playScene(true);
    }
    window.addEventListener('scroll', function () {
      var nextY = window.scrollY, delta = nextY - lastY;
      lastY = nextY;
      if (!inView || preference.matches || Math.abs(delta) < 1) return;
      stopScene();
      renderScene(progress + delta / Math.max(320, window.innerHeight * .6));
    }, {passive:true});
    if (window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
      scene.addEventListener('pointermove', function (event) {
        if (preference.matches) return;
        var bounds = scene.getBoundingClientRect();
        scene.style.setProperty('--tilt-x', (-(event.clientY - bounds.top - bounds.height / 2) / bounds.height * 5).toFixed(2) + 'deg');
        scene.style.setProperty('--tilt-y', ((event.clientX - bounds.left - bounds.width / 2) / bounds.width * 5).toFixed(2) + 'deg');
      });
      scene.addEventListener('pointerleave', function () {
        scene.style.setProperty('--tilt-x', '0deg');
        scene.style.setProperty('--tilt-y', '0deg');
      });
    }
    document.addEventListener('visibilitychange', function () { if (document.hidden) stopScene(); });
  }

  var chart = document.querySelector('.throughput-chart');
  var panel = document.querySelector('.throughput');
  var barReplay = document.querySelector('.throughput-replay');
  var impact = document.querySelector('.throughput-impact');
  var fills = Array.from(document.querySelectorAll('.throughput-fill'));
  var animations = [], barArmed = true, barTimer = 0, finishTimer = 0;
  function stopBars() {
    clearTimeout(finishTimer);
    animations.forEach(function (animation) { animation.cancel(); });
    animations = [];
    if (panel) panel.classList.remove('is-comparing');
  }
  function playBars() {
    stopBars();
    if (preference.matches || !fills.length || !fills[0].animate) return;
    barArmed = false;
    panel.classList.add('is-comparing');
    fills.forEach(function (fill, i) {
      animations.push(fill.animate([{transform:'scaleX(0)'},{transform:'scaleX(1)'}], {
        duration:i === 0 ? 650 : 1100,
        delay:i === 0 ? 100 : 800,
        easing:'cubic-bezier(.22,1,.36,1)', fill:'both'
      }));
    });
    finishTimer = setTimeout(function () {
      animations.push(impact.animate([
        {transform:'scale(1)',boxShadow:'0 0 0 0 rgba(49,87,244,0)'},
        {transform:'scale(1.035)',boxShadow:'0 0 0 7px rgba(49,87,244,.12)',offset:.4},
        {transform:'scale(1)',boxShadow:'0 0 0 0 rgba(49,87,244,0)'}
      ], {duration:700,easing:'ease-out'}));
      panel.classList.remove('is-comparing');
    }, 1950);
  }
  if (chart && panel && barReplay && fills.length) {
    barReplay.hidden = preference.matches || !fills[0].animate;
    barReplay.addEventListener('click', playBars);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        var entry = entries[0];
        if (entry.isIntersecting) {
          clearTimeout(barTimer);
          if (entry.intersectionRatio >= .3 && barArmed) playBars();
        } else {
          stopBars();
          barTimer = setTimeout(function () { barArmed = true; }, 700);
        }
      }, {threshold:[0,.3]}).observe(chart);
    }
  }
  function applyPreference() {
    if (preference.matches) {
      stopScene(); renderScene(1); stopBars();
      clearTimeout(exitTimer); clearTimeout(barTimer);
      scene.style.setProperty('--tilt-x','0deg'); scene.style.setProperty('--tilt-y','0deg');
    }
    play.hidden = preference.matches;
    replay.hidden = preference.matches;
    barReplay.hidden = preference.matches || !fills.length || !fills[0].animate;
  }
  if (preference.addEventListener) preference.addEventListener('change', applyPreference);
  else if (preference.addListener) preference.addListener(applyPreference);
  applyPreference();
})();
