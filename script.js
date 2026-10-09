/**
 * Зоогостиница «Сёма» — Main Script
 * Tab switching + Slider logic
 */

// Centralized API URL: 24/7 autonomous cloud backend on Render
const API_BASE_URL = 'https://sema-hotel.onrender.com';


/* =========================================================
   TAB SWITCHERS
   Generic: finds .tab-switcher > .tab-btn and switches
   .rooms-content[id="tab-{value}"] panels
   ========================================================= */
function initTabSwitchers() {
  document.querySelectorAll('.tab-switcher').forEach(switcher => {
    const buttons = switcher.querySelectorAll('.tab-btn');

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;
        const section = switcher.closest('section');

        // Update active button state
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Show matching content panel, hide others
        section.querySelectorAll('.rooms-content, .photo-content, .faq-content').forEach(panel => {
          panel.classList.remove('active');
        });

        const target = section.querySelector(`#tab-${targetTab}`);
        if (target) target.classList.add('active');
      });
    });
  });

  // Hero cards navigation: switch tab and scroll smoothly to #rooms
  document.querySelectorAll('.hero-card[data-room-tab]').forEach(card => {
    card.addEventListener('click', (e) => {
      const tabName = card.dataset.roomTab;
      const roomsSection = document.getElementById('rooms');
      if (!roomsSection) return;

      const tabBtn = roomsSection.querySelector(`.tab-btn[data-tab="${tabName}"]`);
      if (tabBtn) {
        tabBtn.click();
      }

      roomsSection.scrollIntoView({ behavior: 'smooth' });
    });
  });
}

/* =========================================================
   SLIDERS & CAROUSELS
   ========================================================= */
function initSliders() {
  // 1. Standalone sliders with dots / single slide visibility
  const sliderMap = {
    dogSlider: 'dogDots',
    catSlider: 'catDots',
    photoSlider1: 'photoDots1',
    photoSlider2: 'photoDots2',
    photoSlider3: 'photoDots3',
    guestsSlider: 'guestsDots',
  };

  document.querySelectorAll('.slider-track').forEach(track => {
    // If it is reviewsCarousel, skip here — handled separately below
    if (track.id === 'reviewsTrack') return;

    const slides = track.querySelectorAll('.slide');
    if (slides.length === 0) return;

    const dotsId = sliderMap[track.id];
    const dotsContainer = dotsId ? document.getElementById(dotsId) : null;
    const dots = dotsContainer ? dotsContainer.querySelectorAll('.dot, .p-dot') : [];

    let current = 0;

    function goTo(index) {
      slides[current].classList.remove('active');
      if (dots[current]) dots[current].classList.remove('active');

      current = (index + slides.length) % slides.length;

      slides[current].classList.add('active');
      if (dots[current]) dots[current].classList.add('active');
    }

    const wrapper = track.parentElement;
    wrapper.querySelectorAll('.slider-arrow').forEach(btn => {
      btn.addEventListener('click', () => {
        goTo(btn.classList.contains('prev') ? current - 1 : current + 1);
      });
    });

    dots.forEach((dot, i) => {
      dot.addEventListener('click', () => goTo(i));
    });

    // Touch swipe support
    let touchStartX = 0;
    track.addEventListener('touchstart', e => {
      touchStartX = e.changedTouches[0].clientX;
    }, { passive: true });
    track.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 40) goTo(dx < 0 ? current + 1 : current - 1);
    }, { passive: true });
  });

  // 2. Reviews Infinite/Multi-card Carousel
  initReviewsCarousel();
}

function initReviewsCarousel() {
  const container = document.querySelector('.reviews-carousel-wrap');
  if (!container) return;

  const track = container.querySelector('#reviewsTrack');
  const prevBtn = container.querySelector('.slider-arrow.prev');
  const nextBtn = container.querySelector('.slider-arrow.next');
  if (!track || !prevBtn || !nextBtn) return;

  const cards = track.querySelectorAll('.review-card');
  const totalCards = cards.length;
  let currentIndex = 0;

  function getVisibleCount() {
    if (window.innerWidth <= 768) return 1;
    if (window.innerWidth <= 1024) return 2;
    return 3;
  }

  function updateCarousel() {
    const visibleCount = getVisibleCount();
    const maxIndex = Math.max(0, totalCards - visibleCount);
    if (currentIndex > maxIndex) currentIndex = maxIndex;
    if (currentIndex < 0) currentIndex = 0;

    const gap = 24;
    const cardWidth = cards[0].offsetWidth;
    const offset = currentIndex * (cardWidth + gap);
    track.style.transform = `translateX(-${offset}px)`;
  }

  prevBtn.addEventListener('click', () => {
    const visibleCount = getVisibleCount();
    const maxIndex = Math.max(0, totalCards - visibleCount);
    currentIndex = (currentIndex <= 0) ? maxIndex : currentIndex - 1;
    updateCarousel();
  });

  nextBtn.addEventListener('click', () => {
    const visibleCount = getVisibleCount();
    const maxIndex = Math.max(0, totalCards - visibleCount);
    currentIndex = (currentIndex >= maxIndex) ? 0 : currentIndex + 1;
    updateCarousel();
  });

  window.addEventListener('resize', updateCarousel);
}

/* =========================================================
   MOBILE MENU (Drawer & Backdrop)
   ========================================================= */
function initMobileMenu() {
  const btn = document.getElementById('mobileMenuBtn');
  const nav = document.getElementById('headerNav');
  const backdrop = document.getElementById('menuBackdrop');
  const closeBtn = document.getElementById('mobileNavCloseBtn');
  if (!btn || !nav) return;

  function openMenu() {
    nav.classList.add('is-open');
    btn.classList.add('is-active');
    btn.setAttribute('aria-expanded', 'true');
    if (backdrop) backdrop.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    nav.classList.remove('is-open');
    btn.classList.remove('is-active');
    btn.setAttribute('aria-expanded', 'false');
    if (backdrop) backdrop.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  function toggleMenu(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (nav.classList.contains('is-open')) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  btn.addEventListener('click', toggleMenu);

  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeMenu();
    });
  }

  if (backdrop) {
    backdrop.addEventListener('click', closeMenu);
    backdrop.addEventListener('touchstart', (e) => {
      e.preventDefault();
      closeMenu();
    }, { passive: false });
  }

  // Close on nav link click
  nav.querySelectorAll('.nav-link, .mobile-contact-link').forEach(link => {
    link.addEventListener('click', closeMenu);
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) {
      closeMenu();
    }
  });
}

/* =========================================================
   FAQ & MOBILE ACCORDIONS
   ========================================================= */
function initFaqAccordion() {
  document.querySelectorAll('.faq-accordion-item').forEach(item => {
    const btn = item.querySelector('.faq-question-btn');
    const collapse = item.querySelector('.faq-answer-collapse');
    if (!btn || !collapse) return;

    btn.addEventListener('click', () => {
      const isOpen = item.classList.contains('is-open');
      const parentList = item.closest('.faq-accordion-list');

      // Close other items in the same tab for neat accordion view
      if (parentList) {
        parentList.querySelectorAll('.faq-accordion-item').forEach(other => {
          if (other !== item) {
            other.classList.remove('is-open');
            const otherBtn = other.querySelector('.faq-question-btn');
            const otherCollapse = other.querySelector('.faq-answer-collapse');
            if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
            if (otherCollapse) otherCollapse.style.maxHeight = null;
          }
        });
      }

      if (isOpen) {
        item.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
        collapse.style.maxHeight = null;
      } else {
        item.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
        collapse.style.maxHeight = (collapse.scrollHeight + 30) + 'px';
      }
    });
  });
}

function initMobileAccordionsAndSpoilers() {
  // 1. Дрессировка (аккордеон 6 карточек на смартфонах)
  const trainingCards = document.querySelectorAll('.training-card');
  trainingCards.forEach(card => {
    const header = card.querySelector('.training-card-header') || card;
    header.addEventListener('click', (e) => {
      if (window.innerWidth > 768) return;
      if (e.target.closest('a')) return;

      const isOpen = card.classList.contains('is-open');
      trainingCards.forEach(other => other.classList.remove('is-open'));
      if (!isOpen) {
        card.classList.add('is-open');
      }
    });
  });

  // 2. Кураторы (аккордеон визиток Людмилы и Виктории)
  const curatorCards = document.querySelectorAll('.person-card');
  curatorCards.forEach(card => {
    const header = card.querySelector('.person-card-header') || card;
    header.addEventListener('click', (e) => {
      if (window.innerWidth > 768) return;
      // Не перехватываем клик по прямой ссылке звонка tel:
      if (e.target.closest('a[href^="tel:"]') || e.target.closest('.btn-call-circle')) return;

      const isOpen = card.classList.contains('is-open');
      curatorCards.forEach(other => other.classList.remove('is-open'));
      if (!isOpen) {
        card.classList.add('is-open');
      }
    });
  });

  // 3. Спойлеры для условий номеров и деталей фотосессий
  document.querySelectorAll('.btn-spoiler-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const content = document.getElementById(targetId);
      if (!content) return;

      const isExpanded = content.classList.toggle('is-open');
      const defaultText = btn.dataset.textDefault || 'Показать все условия ▾';
      const activeText = btn.dataset.textActive || 'Скрыть условия ▴';
      btn.textContent = isExpanded ? activeText : defaultText;
    });
  });

  // 4. Аккордеон для фото номеров в мобильной версии
  document.querySelectorAll('.rooms-gallery-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const content = document.getElementById(targetId);
      if (!content) return;

      const isExpanded = content.classList.toggle('is-open');
      btn.classList.toggle('is-open', isExpanded);
      btn.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
      
      const textSpan = btn.querySelector('.r-toggle-text');
      if (textSpan) {
        textSpan.textContent = isExpanded ? 'Скрыть фотографии номеров' : 'Посмотреть фотографии номеров';
      }
    });
  });
}

/* =========================================================
   STAR RATING (reviews form)
   ========================================================= */
function initStarRating() {
  const starsContainer = document.querySelector('.star-rating');
  if (!starsContainer) return;

  const stars = starsContainer.querySelectorAll('.star');
  let selected = 0;

  stars.forEach((star, i) => {
    star.addEventListener('mouseenter', () => {
      stars.forEach((s, j) => s.classList.toggle('hovered', j <= i));
    });
    star.addEventListener('mouseleave', () => {
      stars.forEach(s => s.classList.remove('hovered'));
    });
    star.addEventListener('click', () => {
      selected = i + 1;
      stars.forEach((s, j) => s.classList.toggle('selected', j < selected));
      starsContainer.dataset.rating = selected;
    });
  });
}

/* =========================================================
   FORM TOAST NOTIFICATION
   ========================================================= */
function showToast(message) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.style.cssText = `
      position: fixed; bottom: 32px; left: 50%; transform: translateX(-50%);
      background: var(--color-forest); color: #fff;
      padding: 14px 28px; border-radius: var(--radius-pill);
      font-family: 'Manrope', sans-serif; font-size: 15px; font-weight: 500;
      box-shadow: 0 8px 24px rgba(36,66,50,0.2); z-index: 9999;
      opacity: 0; transition: opacity 0.3s ease;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.opacity = '1';
  setTimeout(() => { toast.style.opacity = '0'; }, 3000);
}

function initForms() {
  // 1. Форма бронирования
  const bookingForm = document.getElementById('bookingForm');
  if (bookingForm) {
    bookingForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = bookingForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Отправка...';

      const payload = {
        name: document.getElementById('bookName')?.value || '',
        phone: document.getElementById('bookPhone')?.value || '',
        pet: document.getElementById('bookPet')?.value || '',
        dates: document.getElementById('bookDates')?.value || '',
        comment: document.getElementById('bookComment')?.value || ''
      };

      try {
        const res = await fetch(`${API_BASE_URL}/api/booking`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          showToast('Заявка успешно отправлена! Мы свяжемся с вами в течение 15 минут.');
          bookingForm.reset();
        } else {
          showToast('Заявка отправлена!');
          bookingForm.reset();
        }
      } catch (err) {
        // Fallback если сервер офлайн
        showToast('Заявка принята! Мы скоро свяжемся с вами.');
        bookingForm.reset();
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });
  }

  // 2. Форма отзыва
  const reviewForm = document.getElementById('reviewForm');
  if (reviewForm) {
    reviewForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = reviewForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Отправка...';

      const starsContainer = reviewForm.querySelector('.star-rating');
      const rating = starsContainer ? (starsContainer.dataset.rating || '5') : '5';

      const payload = {
        name: document.getElementById('reviewName')?.value || '',
        pet: document.getElementById('reviewPet')?.value || '',
        service: document.getElementById('reviewService')?.value || 'Зоогостиница',
        rating: rating,
        text: document.getElementById('reviewMsg')?.value || ''
      };

      try {
        const res = await fetch(`${API_BASE_URL}/api/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          showToast('Спасибо за ваш отзыв! Он отправлен на модерацию в Telegram.');
          reviewForm.reset();
        } else {
          showToast('Спасибо за ваш отзыв!');
          reviewForm.reset();
        }
      } catch (err) {
        showToast('Спасибо за отзыв!');
        reviewForm.reset();
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        if (starsContainer) {
          starsContainer.querySelectorAll('.star').forEach(s => s.classList.add('selected'));
          starsContainer.dataset.rating = '5';
        }
      }
    });
  }

  // Загрузка опубликованных отзывов при загрузке
  loadDynamicReviews();
}

async function loadDynamicReviews() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/reviews?t=${Date.now()}`);
    if (!res.ok) return;
    const reviews = await res.json();
    if (!Array.isArray(reviews) || reviews.length === 0) return;

    const track = document.getElementById('reviewsTrack');
    if (!track) return;

    // Вставляем одобренные отзывы в начало карусели
    reviews.forEach(rev => {
      const card = document.createElement('div');
      card.className = 'review-card';
      const stars = '★'.repeat(rev.rating || 5);
      card.innerHTML = `
        <div class="review-header">
          <span class="review-author-badge">${rev.name} и ${rev.pet}</span>
          <span class="review-service-tag">${rev.service}</span>
        </div>
        <div class="review-stars">${stars}</div>
        <p class="review-text">${rev.text}</p>
        <div class="review-footer">
          <span class="review-source-badge">${rev.source || 'Сайт'}</span>
        </div>
      `;
      track.insertBefore(card, track.firstChild);
    });
  } catch (e) {
    // Тихо игнорируем, если сервер ещё не запущен
  }
}

/* =========================================================
   CALL DROPDOWN (Позвонить)
   ========================================================= */
function initCallDropdown() {
  const dropdown = document.getElementById('headerCallDropdown');
  const btn = document.getElementById('callBadgeBtn');
  if (!dropdown || !btn) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = dropdown.classList.toggle('active');
    btn.setAttribute('aria-expanded', isOpen);
  });

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target)) {
      dropdown.classList.remove('active');
      btn.setAttribute('aria-expanded', 'false');
    }
  });

  // Close when pressing Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      dropdown.classList.remove('active');
      btn.setAttribute('aria-expanded', 'false');
    }
  });
}

/* =========================================================
   BACK TO TOP FLOATING BUTTON
   ========================================================= */
function initBackToTop() {
  const btn = document.getElementById('backToTopBtn');
  if (!btn) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 400) {
      btn.classList.add('visible');
    } else {
      btn.classList.remove('visible');
    }
  }, { passive: true });

  btn.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
}

/* =========================================================
   VISITOR TELEMETRY & TRAFFIC TRACKER
   ========================================================= */
function initVisitorTracking() {
  // Prevent duplicate counts on refresh in same session (1 hour cooldown)
  const lastTrackTime = sessionStorage.getItem('sema_visited');
  const now = Date.now();
  if (lastTrackTime && (now - parseInt(lastTrackTime, 10)) < 1800000) {
    return;
  }
  sessionStorage.setItem('sema_visited', now.toString());

  // Determine traffic source
  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get('utm_source');
  const utmMedium = params.get('utm_medium');
  const ref = document.referrer;
  
  let source = 'Прямой заход';
  if (utmSource) {
    source = `UTM: ${utmSource}${utmMedium ? ' / ' + utmMedium : ''}`;
  } else if (ref) {
    if (ref.includes('t.me') || ref.includes('telegram')) source = 'Telegram (пост / канал)';
    else if (ref.includes('yandex') || ref.includes('ya.ru')) source = 'Яндекс (Поиск / Карты)';
    else if (ref.includes('google')) source = 'Google (Поиск)';
    else if (ref.includes('avito')) source = 'Авито (Объявление)';
    else if (ref.includes('vk.com')) source = 'ВКонтакте (ВК)';
    else if (ref.includes('whatsapp')) source = 'WhatsApp';
    else {
      try {
        source = new URL(ref).hostname;
      } catch (e) {
        source = ref;
      }
    }
  }

  const payload = {
    source: source,
    referrer: ref,
    userAgent: navigator.userAgent || '',
    screen: `${window.screen.width}x${window.screen.height}`,
    path: window.location.pathname + window.location.hash
  };

  fetch(`${API_BASE_URL}/api/visit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(() => {
    // Fail silently
  });
}

/* =========================================================
   INIT
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
  initTabSwitchers();
  initSliders();
  initMobileMenu();
  initFaqAccordion();
  initMobileAccordionsAndSpoilers();
  initStarRating();
  initForms();
  initCallDropdown();
  initBackToTop();
  initVisitorTracking();
});

// Automatic cache invalidation for mobile back/forward cache (bfcache)
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    window.location.reload();
  }
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 768) {
    document.querySelectorAll('.is-open').forEach(el => {
      // Don't close FAQ answers if opened by user on desktop
      if (!el.classList.contains('faq-accordion-item')) {
        el.classList.remove('is-open');
      }
    });
    document.body.style.overflow = '';
  }
});

