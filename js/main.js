// ===== Global State =====
var config = {};
var servicesData = [];

// ===== Init =====
async function init() {
  await loadConfig();
  await loadServices();
  initNav();
  initBookingDate();
  initContactForm();
  initBookingForm();
}

// ===== Load Config =====
async function loadConfig() {
  try {
    var response = await fetch('data/config.json');
    config = await response.json();
    applyConfig();
  } catch (e) {
    console.warn('config.json 로드 실패, 기본값 사용:', e);
  }
}

function applyConfig() {
  var biz = config.business || {};

  // 네비게이션 로고
  var logo = document.getElementById('navLogo');
  if (logo) logo.textContent = biz.shortName || biz.name || '';

  // Hero
  setText('heroTitle', biz.shortName || biz.name || '');
  setText('heroSubtitle', biz.name ? biz.name.replace(biz.shortName || '', '').trim() : '');
  setText('heroDescription', biz.description || '');

  // 오시는 길
  setText('locationAddress', biz.address || '');
  setText('locationAddressDetail', biz.addressDetail || '');
  setText('locationPhone', biz.phone || '');
  var phoneLink = document.getElementById('locationPhoneLink');
  if (phoneLink) phoneLink.href = 'tel:' + (biz.phone || '');

  var hours = biz.hours || {};
  setText('hoursWeekday', hours.weekday || '');
  setText('hoursSaturday', hours.saturday || '');
  setText('hoursSunday', hours.sunday || '');

  // 지도
  var mapIframe = document.getElementById('mapIframe');
  if (mapIframe && biz.googleMapsEmbed) mapIframe.src = biz.googleMapsEmbed;
  var mapsLink = document.getElementById('mapsLink');
  if (mapsLink && biz.googleMapsUrl) mapsLink.href = biz.googleMapsUrl;

  // reCAPTCHA
  if (config.recaptcha && config.recaptcha.siteKey) {
    document.querySelectorAll('.g-recaptcha').forEach(function(el) {
      el.setAttribute('data-sitekey', config.recaptcha.siteKey);
    });
  }

  // Footer
  setText('footerName', biz.name || '');
  setText('footerYear', biz.year || new Date().getFullYear());
  setText('footerShortName', biz.shortName || biz.name || '');
}

function setText(id, text) {
  var el = document.getElementById(id);
  if (el) el.textContent = text;
}

// ===== Load Services =====
async function loadServices() {
  try {
    var response = await fetch('data/services.json');
    var data = await response.json();
    servicesData = data.services;
    renderServiceCards(servicesData);
    renderServiceSelectCards(servicesData);
  } catch (e) {
    var grid = document.getElementById('servicesGrid');
    if (grid) grid.innerHTML = '<p style="text-align:center;color:#767676;">서비스 정보를 불러올 수 없습니다.</p>';
  }
}

function renderServiceCards(services) {
  var grid = document.getElementById('servicesGrid');
  if (!grid) return;
  grid.innerHTML = services.map(function(s) {
    return '<div class="service-card">'
      + '<div class="service-icon">' + s.icon + '</div>'
      + '<h3>' + escapeHtml(s.name) + '</h3>'
      + '<p class="service-price">' + escapeHtml(s.price) + '</p>'
      + '<p class="service-desc">' + escapeHtml(s.description) + '</p>'
      + '</div>';
  }).join('');
}

function renderServiceSelectCards(services) {
  var grid = document.getElementById('serviceSelectGrid');
  if (!grid) return;
  grid.innerHTML = services.map(function(s) {
    return '<div class="service-select-card" data-service-id="' + s.id + '" data-duration="' + s.duration + '">'
      + '<div class="service-icon">' + s.icon + '</div>'
      + '<h4>' + escapeHtml(s.name) + '</h4>'
      + '<p class="service-price">' + escapeHtml(s.price) + '</p>'
      + '<p class="service-duration">약 ' + s.duration + '분</p>'
      + '</div>';
  }).join('');

  grid.querySelectorAll('.service-select-card').forEach(function(card) {
    card.addEventListener('click', function() {
      grid.querySelectorAll('.service-select-card').forEach(function(c) { c.classList.remove('selected'); });
      card.classList.add('selected');
      document.getElementById('bookingService').value = card.dataset.serviceId;

      var durationEl = document.getElementById('bookingDuration');
      var durationText = document.getElementById('durationText');
      durationEl.hidden = false;
      durationText.textContent = card.dataset.duration + '분';

      fetchAvailableSlots();
      updateBookingSummary();
    });
  });
}

// ===== Navigation =====
function initNav() {
  var navToggle = document.getElementById('navToggle');
  var navMenu = document.getElementById('navMenu');

  navToggle.addEventListener('click', function() {
    navToggle.classList.toggle('active');
    navMenu.classList.toggle('open');
  });

  navMenu.querySelectorAll('.nav-link').forEach(function(link) {
    link.addEventListener('click', function() {
      navToggle.classList.remove('active');
      navMenu.classList.remove('open');
    });
  });

  // Active nav on scroll
  var sections = document.querySelectorAll('section[id]');
  var navLinks = document.querySelectorAll('.nav-link');

  function updateActiveNav() {
    var scrollY = window.scrollY + 100;
    sections.forEach(function(section) {
      var top = section.offsetTop;
      var height = section.offsetHeight;
      var id = section.getAttribute('id');
      if (scrollY >= top && scrollY < top + height) {
        navLinks.forEach(function(link) {
          link.classList.remove('active');
          if (link.getAttribute('href') === '#' + id) link.classList.add('active');
        });
      }
    });
  }

  window.addEventListener('scroll', updateActiveNav);
  updateActiveNav();
}

// ===== Booking Date =====
function initBookingDate() {
  var dateInput = document.getElementById('bookingDate');
  if (!dateInput) return;
  var today = new Date();
  var yyyy = today.getFullYear();
  var mm = String(today.getMonth() + 1).padStart(2, '0');
  var dd = String(today.getDate()).padStart(2, '0');
  dateInput.min = yyyy + '-' + mm + '-' + dd;
  dateInput.addEventListener('change', function() {
    document.getElementById('bookingTime').value = '';
    document.getElementById('bookingSeat').value = '';
    fetchAvailableSlots();
    updateBookingSummary();
  });
}

// ===== Fetch Available Slots =====
var currentSlotRequest = 0;

async function fetchAvailableSlots() {
  var date = document.getElementById('bookingDate').value;
  var serviceId = document.getElementById('bookingService').value;
  var slotsGrid = document.getElementById('timeSlotsGrid');
  var slotsLoading = document.getElementById('slotsLoading');
  var slotsMessage = document.getElementById('slotsMessage');

  if (!date || !serviceId) {
    slotsGrid.hidden = true;
    slotsLoading.hidden = true;
    slotsMessage.hidden = false;
    slotsMessage.textContent = '날짜와 서비스를 모두 선택해 주세요.';
    return;
  }

  slotsGrid.hidden = true;
  slotsMessage.hidden = true;
  slotsLoading.hidden = false;

  var requestId = ++currentSlotRequest;

  try {
    var apiUrl = getApiUrl();
    var url = apiUrl + '?action=getSlots&date=' + date + '&service=' + serviceId;
    var response = await fetch(url);
    var result = await response.json();

    if (requestId !== currentSlotRequest) return;
    slotsLoading.hidden = true;

    if (result.status !== 'ok') {
      slotsMessage.textContent = result.message || '시간대를 불러올 수 없습니다.';
      slotsMessage.hidden = false;
      return;
    }

    if (!result.slots || result.slots.length === 0) {
      slotsMessage.textContent = result.message || '해당 날짜에 예약 가능한 시간이 없습니다.';
      slotsMessage.hidden = false;
      return;
    }

    renderTimeSlots(result.slots, result.totalSeats);
  } catch (e) {
    if (requestId !== currentSlotRequest) return;
    slotsLoading.hidden = true;
    slotsMessage.textContent = '시간대 조회에 실패했습니다. 잠시 후 다시 시도해 주세요.';
    slotsMessage.hidden = false;
  }
}

function renderTimeSlots(slots, totalSeats) {
  var grid = document.getElementById('timeSlotsGrid');
  var seatLabel = (config.booking && config.booking.seatLabel) || '석';

  grid.innerHTML = slots.map(function(slot) {
    var isAvailable = slot.available > 0;
    var isLow = isAvailable && slot.available === 1;
    var cls = isAvailable ? '' : ' unavailable';
    return '<div class="time-slot' + cls + '" data-time="' + slot.time + '" data-seats="' + slot.seats.join(',') + '"' + (!isAvailable ? ' aria-disabled="true"' : '') + '>'
      + '<div class="slot-time">' + slot.time + '</div>'
      + '<div class="slot-seats' + (isLow ? ' low' : '') + '">' + (isAvailable ? slot.available + '/' + totalSeats + seatLabel : '마감') + '</div>'
      + '</div>';
  }).join('');

  grid.hidden = false;

  grid.querySelectorAll('.time-slot:not(.unavailable)').forEach(function(slot) {
    slot.addEventListener('click', function() {
      grid.querySelectorAll('.time-slot').forEach(function(s) { s.classList.remove('selected'); });
      slot.classList.add('selected');
      document.getElementById('bookingTime').value = slot.dataset.time;
      var seats = slot.dataset.seats.split(',');
      document.getElementById('bookingSeat').value = seats[0];
      updateBookingSummary();
    });
  });
}

// ===== Booking Summary =====
function updateBookingSummary() {
  var serviceId = document.getElementById('bookingService').value;
  var date = document.getElementById('bookingDate').value;
  var time = document.getElementById('bookingTime').value;

  var summaryEl = document.getElementById('bookingSummary');
  var contentEl = document.getElementById('summaryContent');

  if (!serviceId) { summaryEl.hidden = true; return; }

  var service = servicesData.find(function(s) { return s.id === serviceId; });
  if (!service) return;

  var html = '<div class="summary-row"><span>서비스</span><strong>' + escapeHtml(service.name) + ' (' + escapeHtml(service.price) + ')</strong></div>';
  html += '<div class="summary-row"><span>소요시간</span><strong>약 ' + service.duration + '분</strong></div>';

  if (date) {
    var dateObj = new Date(date);
    var dateStr = dateObj.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
    html += '<div class="summary-row"><span>날짜</span><strong>' + dateStr + '</strong></div>';
  }

  if (time) {
    html += '<div class="summary-row"><span>시간</span><strong>' + time + '</strong></div>';
  }

  contentEl.innerHTML = html;
  summaryEl.hidden = false;
}

// ===== API URL =====
function getApiUrl() {
  if (config.api) {
    return config.api.googleAppsScriptUrl || config.api.powerAutomateUrl || '';
  }
  return '';
}

// ===== Contact Form =====
function initContactForm() {
  var form = document.getElementById('contactForm');
  var resultEl = document.getElementById('formResult');

  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    var formData = {
      name: document.getElementById('name').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      email: document.getElementById('email').value.trim(),
      message: document.getElementById('message').value.trim(),
      submittedAt: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      type: 'contact'
    };

    if (!formData.name || !formData.message) {
      showResult(resultEl, '이름과 문의 내용을 입력해 주세요.', 'error');
      return;
    }

    if (!document.getElementById('privacyConsent').checked) {
      showResult(resultEl, '개인정보 수집·이용에 동의해 주세요.', 'error');
      return;
    }

    var recaptchaResponse = getRecaptchaResponse(1);
    if (!recaptchaResponse) {
      showResult(resultEl, '스팸 방지 확인(reCAPTCHA)을 완료해 주세요.', 'error');
      return;
    }

    formData.recaptchaToken = recaptchaResponse;
    formData.privacyConsent = true;

    var submitUrl = getApiUrl();
    if (!submitUrl) {
      showResult(resultEl, '문의 폼 연동이 아직 설정되지 않았습니다. 설정 가이드를 참고해 주세요.', 'error');
      return;
    }

    await submitForm(submitUrl, formData, form, resultEl, '문의가 성공적으로 전송되었습니다. 감사합니다!', 1);
  });
}

// ===== Booking Form =====
function initBookingForm() {
  var form = document.getElementById('bookingForm');
  var resultEl = document.getElementById('bookingResult');

  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    var serviceId = document.getElementById('bookingService').value;
    if (!serviceId) {
      showResult(resultEl, '서비스를 선택해 주세요.', 'error');
      return;
    }

    var formData = {
      service: serviceId,
      date: document.getElementById('bookingDate').value,
      time: document.getElementById('bookingTime').value,
      seat: document.getElementById('bookingSeat').value,
      name: document.getElementById('bookingName').value.trim(),
      phone: document.getElementById('bookingPhone').value.trim(),
      email: document.getElementById('bookingEmail').value.trim(),
      memo: document.getElementById('bookingMemo').value.trim(),
      submittedAt: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      type: 'booking'
    };

    if (!formData.date || !formData.time) {
      showResult(resultEl, '날짜와 시간을 선택해 주세요.', 'error');
      return;
    }

    if (!formData.name || !formData.phone) {
      showResult(resultEl, '이름과 연락처를 입력해 주세요.', 'error');
      return;
    }

    if (new Date(formData.date).getDay() === 0) {
      showResult(resultEl, '일요일은 휴무입니다. 다른 날짜를 선택해 주세요.', 'error');
      return;
    }

    if (!document.getElementById('bookingPrivacyConsent').checked) {
      showResult(resultEl, '개인정보 수집·이용에 동의해 주세요.', 'error');
      return;
    }

    var recaptchaResponse = getRecaptchaResponse(0);
    if (!recaptchaResponse) {
      showResult(resultEl, '스팸 방지 확인(reCAPTCHA)을 완료해 주세요.', 'error');
      return;
    }

    formData.recaptchaToken = recaptchaResponse;
    formData.privacyConsent = true;

    var apiUrl = getApiUrl();
    if (!apiUrl) {
      showResult(resultEl, '예약 시스템이 아직 설정되지 않았습니다. 설정 가이드를 참고해 주세요.', 'error');
      return;
    }

    await submitForm(apiUrl, formData, form, resultEl, '예약이 성공적으로 접수되었습니다! 확인 후 연락드리겠습니다.', 0);
  });
}

// ===== Shared Form Submission =====
async function submitForm(url, data, form, resultEl, successMsg, recaptchaIndex) {
  var submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  var originalText = submitBtn.textContent;
  submitBtn.textContent = '보내는 중...';

  try {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(data)
    });

    showResult(resultEl, successMsg, 'success');
    form.reset();
    var selectedCard = document.querySelector('.service-select-card.selected');
    if (selectedCard) selectedCard.classList.remove('selected');
    var summaryEl = document.getElementById('bookingSummary');
    if (summaryEl) summaryEl.hidden = true;
    var durationEl = document.getElementById('bookingDuration');
    if (durationEl) durationEl.hidden = true;
    resetRecaptcha(recaptchaIndex);
  } catch (err) {
    console.error('Submit error:', err);
    showResult(resultEl, '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

// ===== reCAPTCHA =====
function getRecaptchaResponse(widgetIndex) {
  if (typeof grecaptcha === 'undefined') return '';
  try { return grecaptcha.getResponse(widgetIndex); }
  catch (e) { return grecaptcha.getResponse(); }
}

function resetRecaptcha(widgetIndex) {
  if (typeof grecaptcha === 'undefined') return;
  try { grecaptcha.reset(widgetIndex); }
  catch (e) { grecaptcha.reset(); }
}

// ===== Utility =====
function showResult(el, message, type) {
  el.textContent = message;
  el.className = 'form-result ' + type;
  el.hidden = false;
  setTimeout(function() { el.hidden = true; }, 6000);
}

function escapeHtml(text) {
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ===== Start =====
init();
