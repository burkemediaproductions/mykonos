const header = document.querySelector('[data-header]');
const menuToggle = document.querySelector('[data-menu-toggle]');
const mobileMenu = document.getElementById('mobile-menu');
const dropdownButtons = document.querySelectorAll('[data-dropdown-button]');
const menuCloseButtons = document.querySelectorAll('[data-menu-close]');
const focusableSelectors = 'a[href], button:not([disabled])';
let lastFocusedElement = null;

function normalizePath(pathname) {
  if (!pathname) return '/';
  let path = pathname.replace(/index\.html$/i, '');
  if (!path.endsWith('/')) path += '/';
  return path || '/';
}

function setYear() {
  document.querySelectorAll('#year').forEach((el) => {
    el.textContent = new Date().getFullYear();
  });
}

function setHeaderState() {
  if (!header) return;
  header.classList.toggle('scrolled', window.scrollY > 20);
}

function trapFocus(event) {
  if (!mobileMenu || mobileMenu.hidden || event.key !== 'Tab') return;
  const focusable = [...mobileMenu.querySelectorAll(focusableSelectors)];
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function openMenu() {
  if (!menuToggle || !mobileMenu) return;

  lastFocusedElement = document.activeElement;
  menuToggle.setAttribute('aria-expanded', 'true');
  mobileMenu.hidden = false;
  mobileMenu.setAttribute('aria-hidden', 'false');
  document.body.classList.add('menu-open');

  requestAnimationFrame(() => {
    mobileMenu.classList.add('is-visible');
    mobileMenu.querySelector(focusableSelectors)?.focus();
  });
}

function closeMenu(returnFocus = true) {
  if (!menuToggle || !mobileMenu) return;

  menuToggle.setAttribute('aria-expanded', 'false');
  mobileMenu.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('menu-open');
  mobileMenu.classList.remove('is-visible');

  window.setTimeout(() => {
    mobileMenu.hidden = true;
  }, 420);

  if (returnFocus) {
    window.setTimeout(() => {
      if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
        lastFocusedElement.focus();
      } else {
        menuToggle.focus();
      }
    }, 50);
  }
}

function toggleMenu() {
  if (!menuToggle) return;
  const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
  if (isOpen) closeMenu();
  else openMenu();
}

function closeAllDropdowns() {
  dropdownButtons.forEach((button) => {
    button.setAttribute('aria-expanded', 'false');
    button.classList.remove('is-current-parent');
    button.parentElement.classList.remove('is-open');
  });
}

function setupDropdowns() {
  if (!dropdownButtons.length) return;
  dropdownButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const isOpen = button.getAttribute('aria-expanded') === 'true';
      closeAllDropdowns();
      button.setAttribute('aria-expanded', String(!isOpen));
      button.parentElement.classList.toggle('is-open', !isOpen);
    });
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.has-dropdown')) closeAllDropdowns();
  });
}

function setupMenu() {
  if (!menuToggle || !mobileMenu) return;
  closeMenu(false);
  mobileMenu.classList.remove('is-visible');

  menuToggle.addEventListener('click', toggleMenu);
  menuCloseButtons.forEach((button) => {
    button.addEventListener('click', () => closeMenu());
  });
  mobileMenu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => closeMenu(false));
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (menuToggle.getAttribute('aria-expanded') === 'true') closeMenu();
      closeAllDropdowns();
    }
    trapFocus(event);
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 1024) closeMenu(false);
  });
}
function setActiveNav() {
  const currentPath = normalizePath(window.location.pathname);
  document.querySelectorAll('a[aria-current="page"]').forEach((link) => link.removeAttribute('aria-current'));

  const navLinks = document.querySelectorAll('.desktop-nav a, .mobile-menu a, .site-footer a');
  navLinks.forEach((link) => {
    const href = link.getAttribute('href');
    if (!href || href.startsWith('http') || href.startsWith('tel:') || href.startsWith('mailto:') || href.startsWith('#')) return;
    const linkPath = normalizePath(href);
    if (linkPath === currentPath) {
      link.setAttribute('aria-current', 'page');
      const parentDropdown = link.closest('.has-dropdown');
      const dropdownButton = link.closest('.has-dropdown')?.querySelector('[data-dropdown-button]');
      if (parentDropdown && dropdownButton) dropdownButton.classList.add('is-current-parent');
    }
  });
}

function setupReveal() {
  const items = document.querySelectorAll('.reveal');
  if (!items.length) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  items.forEach((item) => io.observe(item));
}

function setupParallax() {
  const layers = document.querySelectorAll('.parallax-bg');
  if (!layers.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const onScroll = () => {
    layers.forEach((layer) => {
      const rect = layer.parentElement.getBoundingClientRect();
      const offset = rect.top * -0.08;
      layer.style.transform = `translateY(${offset}px) scale(1.15)`;
    });
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

function initInlineVideos() {
  const videos = document.querySelectorAll('video[autoplay][muted][playsinline]');
  videos.forEach((video) => {
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === 'function') playPromise.catch(() => {});
  });
}

setYear();
setHeaderState();
setActiveNav();
setupDropdowns();
setupMenu();
setupReveal();
setupParallax();
initInlineVideos();
setupResponsiveHeroVideo();
window.addEventListener('scroll', setHeaderState, { passive: true });

function setupResponsiveHeroVideo() {
  const heroVideoConfigs = {
    'hero-video': {
      mobileSrc: '/assets/video/MykonosModernGreekRanchoMirage-wbbg-vertical.mp4',
      desktopSrc: '/assets/video/MykonosModernGreekRanchoMirage-wbbg-horizontal.mp4',
      mobilePoster: '/assets/video/MykonosModernGreekRanchoMirage-wbbg-vertical.jpg',
      desktopPoster: '/assets/video/MykonosModernGreekRanchoMirage-wbbg-horizontal.jpg'
    },
    'hero-about': {
      mobileSrc: '/assets/video/AliZoomIn-vertical.mp4',
      desktopSrc: '/assets/video/AliZoomIn-horizontal.mp4',
      mobilePoster: '/assets/video/AliZoomIn-vertical.jpg',
      desktopPoster: '/assets/video/AliZoomIn-horizontal.jpg'
    },
    'hero-experience': {
      mobileSrc: '/assets/video/FullRestaraunt-vertical.mp4',
      desktopSrc: '/assets/video/FullRestaraunt-horizontal.mp4',
      mobilePoster: '/assets/video/FullRestaraunt-vertical.jpg',
      desktopPoster: '/assets/video/FullRestaraunt-horizontal.jpg'
    }
  };

  const videos = Object.entries(heroVideoConfigs)
    .map(([id, config]) => {
      const el = document.getElementById(id);
      return el ? { el, config } : null;
    })
    .filter(Boolean);

  if (!videos.length) return;

  const mediaQuery = window.matchMedia('(max-width: 991px)');

  function isElementInViewport(el) {
    const rect = el.getBoundingClientRect();
    const viewHeight = window.innerHeight || document.documentElement.clientHeight;
    return rect.bottom > 0 && rect.top < viewHeight;
  }

  function setupSingleVideo(video, config) {
    let activeSrc = '';
    let activePoster = '';
    let hasLoaded = false;
    let paintScheduled = false;

    function getVideoConfig() {
      const isMobile = mediaQuery.matches;

      return {
        src: isMobile ? config.mobileSrc : config.desktopSrc,
        poster: isMobile ? config.mobilePoster : config.desktopPoster
      };
    }

    function clearSources() {
      video.pause();
      while (video.firstChild) {
        video.removeChild(video.firstChild);
      }
      video.load();
    }

    function playVideo() {
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {});
      }
    }

    function pauseVideo() {
      video.pause();
    }

    function applySource(forceReload = false) {
      const nextConfig = getVideoConfig();

      const srcChanged = nextConfig.src !== activeSrc;
      const posterChanged = nextConfig.poster !== activePoster;

      if (!forceReload && !srcChanged && !posterChanged) return;

      activeSrc = nextConfig.src;
      activePoster = nextConfig.poster;
      video.setAttribute('poster', activePoster);

      clearSources();

      const source = document.createElement('source');
      source.src = activeSrc;
      source.type = 'video/mp4';
      video.appendChild(source);

      video.load();
      hasLoaded = true;

      if (isElementInViewport(video)) {
        playVideo();
      }
    }

    function loadWhenReady() {
      if (paintScheduled) return;
      paintScheduled = true;

      const startLoad = () => {
        applySource(true);
      };

      if ('requestIdleCallback' in window) {
        requestIdleCallback(startLoad, { timeout: 1200 });
      } else {
        setTimeout(startLoad, 150);
      }
    }

    function setupViewportObserver() {
      if (!('IntersectionObserver' in window)) {
        loadWhenReady();
        window.addEventListener('scroll', () => {
          if (!hasLoaded) return;
          if (isElementInViewport(video)) playVideo();
          else pauseVideo();
        }, { passive: true });
        return;
      }

      const heroObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (!hasLoaded) {
              loadWhenReady();
            } else {
              playVideo();
            }
          } else if (hasLoaded) {
            pauseVideo();
          }
        });
      }, {
        threshold: 0.15
      });

      heroObserver.observe(video);
    }

    function handleMediaChange() {
      if (!hasLoaded) {
        const nextConfig = getVideoConfig();
        activePoster = nextConfig.poster;
        video.setAttribute('poster', activePoster);
        return;
      }

      const nextConfig = getVideoConfig();
      if (nextConfig.src !== activeSrc) {
        const wasPlaying = !video.paused;
        applySource(true);
        if (!wasPlaying) {
          pauseVideo();
        }
      }
    }

    const initialConfig = getVideoConfig();
    activePoster = initialConfig.poster;
    video.setAttribute('poster', activePoster);

    setupViewportObserver();

    return handleMediaChange;
  }

  const mediaChangeHandlers = videos.map(({ el, config }) => setupSingleVideo(el, config));

  function handleAllMediaChanges() {
    mediaChangeHandlers.forEach((handler) => handler());
  }

  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', handleAllMediaChanges);
  } else if (typeof mediaQuery.addListener === 'function') {
    mediaQuery.addListener(handleAllMediaChanges);
  }

  window.addEventListener('orientationchange', () => {
    setTimeout(handleAllMediaChanges, 150);
  });

  window.addEventListener('resize', debounce(handleAllMediaChanges, 180));
}

function debounce(fn, wait = 150) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), wait);
  };
}