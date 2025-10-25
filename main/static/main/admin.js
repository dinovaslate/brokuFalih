(function () {
  const reduceMotionQuery =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
  const reduceMotion = reduceMotionQuery && reduceMotionQuery.matches;
  if (reduceMotion || typeof anime === 'undefined') {
    return;
  }

  const sidebar = document.querySelector('.sidebar');
  const navButtons = document.querySelectorAll('.sidebar-nav .nav-link');
  const contentHeader = document.querySelector('.content-header');
  const surfaceCards = document.querySelectorAll('.surface-card');

  if (!sidebar && !navButtons.length && !contentHeader && !surfaceCards.length) {
    return;
  }

  if (sidebar) {
    anime.set(sidebar, { opacity: 0, translateX: -32 });
  }
  if (navButtons.length) {
    anime.set(navButtons, { opacity: 0, translateX: -12 });
  }
  if (contentHeader) {
    anime.set(contentHeader, { opacity: 0, translateY: -16 });
  }
  if (surfaceCards.length) {
    anime.set(surfaceCards, { opacity: 0, translateY: 24 });
  }

  const timeline = anime.timeline({ easing: 'easeOutQuad', duration: 620, autoplay: false });

  if (sidebar) {
    timeline.add({ targets: sidebar, opacity: 1, translateX: 0 });
  }

  if (navButtons.length) {
    timeline.add(
      {
        targets: navButtons,
        opacity: 1,
        translateX: 0,
        delay: anime.stagger(80),
      },
      sidebar ? '-=320' : 0,
    );
  }

  if (contentHeader) {
    timeline.add(
      {
        targets: contentHeader,
        opacity: 1,
        translateY: 0,
      },
      sidebar || navButtons.length ? '-=360' : 0,
    );
  }

  if (surfaceCards.length) {
    timeline.add(
      {
        targets: surfaceCards,
        opacity: 1,
        translateY: 0,
        delay: anime.stagger(140),
      },
      '-=260',
    );
  }

  if (timeline.children && timeline.children.length) {
    timeline.play();
  }
})();

(function () {
  const app = document.getElementById('admin-app');
  if (!app) {
    return;
  }

  const endpoints = {
    venues: {
      list: '/api/venues/',
      create: '/api/venues/create/',
      update: (id) => `/api/venues/${id}/update/`,
      delete: (id) => `/api/venues/${id}/delete/`,
    },
    bookings: {
      list: '/api/bookings/',
      create: '/api/bookings/create/',
      update: (id) => `/api/bookings/${id}/update/`,
      delete: (id) => `/api/bookings/${id}/delete/`,
    },
    users: {
      search: '/api/users/search/',
    },
  };

  const DEFAULT_PAGE_SIZE = 6;

  const sectionConfig = {
    venues: {
      title: 'Venues',
      description: 'Manage your venues, pricing, facilities, and imagery in real time.',
      buttonLabel: 'Add venue',
      emptyMessage: 'No venues available yet.',
    },
    bookings: {
      title: 'Bookings',
      description: 'Review reservations, payment status, and stay details instantly.',
      buttonLabel: 'Add booking',
      emptyMessage: 'No bookings recorded yet.',
    },
  };

  const state = {
    venues: [],
    bookings: [],
    currentSection: 'venues',
    modalMode: 'create',
    editingId: null,
    hasUsers: app.dataset.hasUsers === 'true',
    pagination: {
      venues: {
        page: 1,
        pageSize: DEFAULT_PAGE_SIZE,
        totalPages: 1,
        totalItems: 0,
        hasPrevious: false,
        hasNext: false,
        query: '',
      },
      bookings: {
        page: 1,
        pageSize: DEFAULT_PAGE_SIZE,
        totalPages: 1,
        totalItems: 0,
        hasPrevious: false,
        hasNext: false,
        query: '',
      },
    },
    search: {
      venues: '',
      bookings: '',
    },
  };

  function parseInitialData(id) {
    const script = document.getElementById(id);
    if (!script) {
      return null;
    }
    try {
      return JSON.parse(script.textContent);
    } catch (error) {
      console.error(`Failed to parse initial data for ${id}`, error);
      return null;
    }
  }

  function parseInitialPayload(id) {
    const raw = parseInitialData(id);
    if (Array.isArray(raw)) {
      return { data: raw, meta: {} };
    }
    if (raw && typeof raw === 'object') {
      const data = Array.isArray(raw.data) ? raw.data : [];
      const meta = raw.meta && typeof raw.meta === 'object' ? raw.meta : {};
      return { data, meta };
    }
    return { data: [], meta: {} };
  }

  function normalizeSeries(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const rawLabels = Array.isArray(source.labels) ? source.labels : [];
    const rawData = Array.isArray(source.data) ? source.data : [];
    const length = Math.min(rawLabels.length, rawData.length);
    const labels = [];
    const data = [];
    for (let index = 0; index < length; index += 1) {
      labels.push(String(rawLabels[index]));
      const numeric = Number(rawData[index]);
      data.push(Number.isFinite(numeric) ? numeric : 0);
    }
    return { labels, data };
  }

  const initialVenues = parseInitialPayload('initial-venues');
  const initialBookings = parseInitialPayload('initial-bookings');
  const initialSalesData = parseInitialData('sales-chart-data');
  const initialPopularityData = parseInitialData('popularity-chart-data');
  const analyticsData = {
    sales: normalizeSeries(initialSalesData),
    popularity: normalizeSeries(initialPopularityData),
  };

  state.venues = initialVenues.data;
  state.bookings = initialBookings.data;
  state.pagination.venues = normalizePaginationMeta(
    initialVenues.meta,
    state.pagination.venues,
  );
  state.pagination.bookings = normalizePaginationMeta(
    initialBookings.meta,
    state.pagination.bookings,
  );
  state.search.venues = state.pagination.venues.query;
  state.search.bookings = state.pagination.bookings.query;

  if (initialBookings.meta && typeof initialBookings.meta.has_users === 'boolean') {
    state.hasUsers = initialBookings.meta.has_users;
  }

  const navButtons = app.querySelectorAll('.nav-link');
  const contentSections = app.querySelectorAll('.data-section');
  const sectionTitle = app.querySelector('[data-section-title]');
  const sectionDescription = app.querySelector('[data-section-description]');
  const actionButton = app.querySelector('[data-action="open-modal"]');
  const venuesTableBody = document.getElementById('venues-table-body');
  const bookingsTableBody = document.getElementById('bookings-table-body');
  const emptyStates = {
    venues: document.querySelector('[data-empty="venues"]'),
    bookings: document.querySelector('[data-empty="bookings"]'),
  };
  const tableWrappers = {
    venues: document.querySelector('[data-table-wrapper="venues"]'),
    bookings: document.querySelector('[data-table-wrapper="bookings"]'),
  };
  const searchInputs = {
    venues: document.querySelector('[data-search-input="venues"]'),
    bookings: document.querySelector('[data-search-input="bookings"]'),
  };
  const paginationContainers = {
    venues: document.querySelector('[data-pagination="venues"]'),
    bookings: document.querySelector('[data-pagination="bookings"]'),
  };
  const tableSummaries = {
    venues: document.querySelector('[data-summary="venues"]'),
    bookings: document.querySelector('[data-summary="bookings"]'),
  };
  const tableFooters = {
    venues: document.querySelector('[data-table-footer="venues"]'),
    bookings: document.querySelector('[data-table-footer="bookings"]'),
  };
  const chartElements = {
    sales: {
      canvas: document.getElementById('venue-sales-chart'),
      empty: document.querySelector('[data-chart-empty="sales"]'),
    },
    popularity: {
      canvas: document.getElementById('venue-popularity-chart'),
      empty: document.querySelector('[data-chart-empty="popularity"]'),
    },
  };
  const chartInstances = {
    sales: null,
    popularity: null,
  };
  const modalBackdrop = document.querySelector('[data-modal]');
  const modalElement = modalBackdrop ? modalBackdrop.querySelector('.modal') : null;
  const modalTitle = document.getElementById('modal-title');
  const entityForm = document.getElementById('entity-form');
  const modalErrors = document.querySelector('[data-modal-errors]');
  const submitLabel = entityForm.querySelector('[data-submit-label]');
  const toast = document.getElementById('toast');
  const formSections = {
    venues: entityForm.querySelector('[data-form="venues"]'),
    bookings: entityForm.querySelector('[data-form="bookings"]'),
  };
  const autocompleteControllers = {};
  let userSearchController = null;
  const fetchControllers = {
    venues: null,
    bookings: null,
  };
  const searchTimeouts = {
    venues: null,
    bookings: null,
  };

  const reduceMotionQuery =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
  const prefersReducedMotion = reduceMotionQuery ? reduceMotionQuery.matches : false;
  const canAnimate = typeof anime !== 'undefined' && !prefersReducedMotion;
  let modalAnimation = null;

  function toggleFormSection(section, isActive) {
    if (!section) {
      return;
    }
    const fields = section.querySelectorAll('input, select, textarea');
    fields.forEach((field) => {
      field.disabled = !isActive;
    });
  }

  function setActiveFormSection(section) {
    Object.entries(formSections).forEach(([key, element]) => {
      const isActive = key === section;
      if (element) {
        element.classList.toggle('is-hidden', !isActive);
        toggleFormSection(element, isActive);
      }
    });
  }

  setActiveFormSection('venues');

  function resetModalStyles() {
    if (modalBackdrop) {
      modalBackdrop.style.removeProperty('opacity');
    }
    if (modalElement) {
      modalElement.style.removeProperty('opacity');
      modalElement.style.removeProperty('transform');
    }
  }

  function showModalBackdrop() {
    if (!modalBackdrop) {
      return;
    }
    modalBackdrop.hidden = false;
    modalBackdrop.setAttribute('aria-hidden', 'false');
  }

  function hideModalBackdrop() {
    if (!modalBackdrop) {
      return;
    }
    modalBackdrop.hidden = true;
    modalBackdrop.setAttribute('aria-hidden', 'true');
  }

  function animateActiveNavButton(button) {
    if (!canAnimate || !button) {
      return;
    }
    anime.remove(button);
    anime.set(button, { scale: 0.94 });
    anime({
      targets: button,
      scale: 1,
      duration: 220,
      easing: 'easeOutQuad',
      complete: () => {
        button.style.removeProperty('transform');
      },
    });
  }

  function animateSectionEntry(sectionElement) {
    if (!canAnimate || !sectionElement) {
      return;
    }
    anime.remove(sectionElement);
    anime.set(sectionElement, { opacity: 0, translateY: 18 });
    requestAnimationFrame(() => {
      anime({
        targets: sectionElement,
        opacity: 1,
        translateY: 0,
        duration: 360,
        easing: 'easeOutQuad',
        complete: () => {
          sectionElement.style.removeProperty('opacity');
          sectionElement.style.removeProperty('transform');
        },
      });
    });
  }

  function animateTableRows(container) {
    if (!canAnimate || !container) {
      return;
    }
    const rows = Array.from(container.querySelectorAll('tr'));
    if (!rows.length) {
      return;
    }
    anime.remove(rows);
    anime.set(rows, { opacity: 0, translateY: 12 });
    requestAnimationFrame(() => {
      anime({
        targets: rows,
        opacity: 1,
        translateY: 0,
        duration: 320,
        easing: 'easeOutQuad',
        delay: anime.stagger(40),
        complete: () => {
          rows.forEach((row) => {
            row.style.removeProperty('opacity');
            row.style.removeProperty('transform');
          });
        },
      });
    });
  }

  function animateRowRemoval(section, recordId) {
    if (!canAnimate) {
      return Promise.resolve();
    }
    const container = section === 'venues' ? venuesTableBody : bookingsTableBody;
    if (!container) {
      return Promise.resolve();
    }
    const row = container.querySelector(`tr[data-record-id="${recordId}"]`);
    if (!row) {
      return Promise.resolve();
    }
    anime.remove(row);
    return new Promise((resolve) => {
      anime({
        targets: row,
        opacity: 0,
        translateX: 28,
        duration: 220,
        easing: 'easeInQuad',
        complete: () => {
          row.remove();
          resolve();
        },
      });
    });
  }

  function normalizePaginationMeta(meta = {}, fallback = {}) {
    const resolved = meta && typeof meta === 'object' ? meta : {};
    const fallbackMeta = fallback && typeof fallback === 'object' ? fallback : {};
    const parseNumber = (value, defaultValue) => {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return defaultValue;
      }
      return parsed;
    };

    let page = parseNumber(resolved.page ?? fallbackMeta.page, fallbackMeta.page ?? 1);
    let pageSize = parseNumber(
      resolved.page_size ?? resolved.pageSize ?? fallbackMeta.pageSize,
      fallbackMeta.pageSize ?? DEFAULT_PAGE_SIZE,
    );
    let totalPages = parseNumber(
      resolved.total_pages ?? resolved.totalPages ?? fallbackMeta.totalPages,
      fallbackMeta.totalPages ?? 1,
    );
    let totalItems = parseNumber(
      resolved.total_items ?? resolved.totalItems ?? fallbackMeta.totalItems,
      fallbackMeta.totalItems ?? 0,
    );

    if (!Number.isFinite(page) || page < 1) {
      page = 1;
    }
    if (!Number.isFinite(pageSize) || pageSize < 1) {
      pageSize = DEFAULT_PAGE_SIZE;
    }
    if (!Number.isFinite(totalPages) || totalPages < 1) {
      totalPages = 1;
    }
    if (!Number.isFinite(totalItems) || totalItems < 0) {
      totalItems = 0;
    }
    if (page > totalPages) {
      page = totalPages;
    }

    const rawHasPrevious =
      resolved.has_previous ?? resolved.hasPrevious ?? fallbackMeta.hasPrevious ?? fallbackMeta.has_previous;
    const rawHasNext =
      resolved.has_next ?? resolved.hasNext ?? fallbackMeta.hasNext ?? fallbackMeta.has_next;

    const normalized = {
      page,
      pageSize,
      totalPages,
      totalItems,
      hasPrevious:
        typeof rawHasPrevious === 'boolean' ? rawHasPrevious : page > 1 && totalPages > 1,
      hasNext: typeof rawHasNext === 'boolean' ? rawHasNext : page < totalPages,
      query:
        typeof resolved.query === 'string'
          ? resolved.query.trim()
          : typeof fallbackMeta.query === 'string'
            ? fallbackMeta.query.trim()
            : '',
    };

    const ignoredKeys = new Set([
      'page',
      'page_size',
      'pageSize',
      'total_pages',
      'totalPages',
      'total_items',
      'totalItems',
      'has_previous',
      'hasPrevious',
      'has_next',
      'hasNext',
      'query',
    ]);

    [fallbackMeta, resolved].forEach((source) => {
      if (!source || typeof source !== 'object') {
        return;
      }
      Object.entries(source).forEach(([key, value]) => {
        if (!ignoredKeys.has(key) && !(key in normalized)) {
          normalized[key] = value;
        }
      });
    });

    return normalized;
  }

  function getCsrfToken() {
    const cookie = document.cookie
      .split(';')
      .map((item) => item.trim())
      .find((item) => item.startsWith('csrftoken='));
    return cookie ? decodeURIComponent(cookie.split('=')[1]) : '';
  }

  function formatCurrency(value, { compact = false } = {}) {
    const options = {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    };

    if (compact) {
      options.notation = 'compact';
      options.compactDisplay = 'short';
    }

    return new Intl.NumberFormat(undefined, options).format(value);
  }

  function createStarRatingElement(averageRating, ratingCount) {
    const container = document.createElement('div');
    container.className = 'star-rating';
    container.setAttribute('role', 'img');

    const hasRating = typeof averageRating === 'number' && Number.isFinite(averageRating);
    const countValue = Number.isFinite(Number(ratingCount)) ? Number(ratingCount) : 0;

    if (!hasRating || countValue <= 0) {
      const label = document.createElement('span');
      label.className = 'star-rating__no-rating';
      label.textContent = 'No rating';
      container.appendChild(label);
      container.setAttribute('aria-label', 'No rating yet');
      return container;
    }

    const normalized = Math.min(Math.max(averageRating, 0), 5);
    const rounded = Math.round(normalized * 10) / 10;

    const starsWrapper = document.createElement('span');
    starsWrapper.className = 'star-rating__stars';

    const baseStars = document.createElement('span');
    baseStars.className = 'star-rating__base';
    baseStars.textContent = '★★★★★';

    const fillStars = document.createElement('span');
    fillStars.className = 'star-rating__fill';
    fillStars.textContent = '★★★★★';
    fillStars.style.width = `${(normalized / 5) * 100}%`;

    starsWrapper.append(baseStars, fillStars);
    container.appendChild(starsWrapper);

    const label = document.createElement('span');
    label.className = 'star-rating__label';
    const ratingCountLabel = countValue === 1 ? '1 rating' : `${countValue} ratings`;
    label.textContent = `${rounded.toFixed(1)} · ${ratingCountLabel}`;
    container.appendChild(label);

    container.setAttribute(
      'aria-label',
      `Rated ${rounded.toFixed(1)} out of 5 based on ${ratingCountLabel}`,
    );

    return container;
  }

  function formatDate(dateString) {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
      return dateString;
    }
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function getPopularityColors(count) {
    const palette = [
      '#2563eb',
      '#4f46e5',
      '#0ea5e9',
      '#14b8a6',
      '#22c55e',
      '#f97316',
      '#ec4899',
      '#facc15',
    ];
    const colors = [];
    for (let index = 0; index < count; index += 1) {
      colors.push(palette[index % palette.length]);
    }
    return colors;
  }

  function computeNiceScale(values) {
    const dataPoints = Array.isArray(values)
      ? values
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value) && value >= 0)
      : [];

    if (dataPoints.length === 0) {
      return { suggestedMax: undefined, stepSize: undefined };
    }

    const maxValue = Math.max(...dataPoints);
    if (!(maxValue > 0)) {
      return { suggestedMax: undefined, stepSize: undefined };
    }

    const exponent = Math.floor(Math.log10(maxValue));
    const magnitude = 10 ** exponent;
    const normalized = maxValue / magnitude;
    let niceNormalized;

    if (normalized <= 1) {
      niceNormalized = 1;
    } else if (normalized <= 2) {
      niceNormalized = 2;
    } else if (normalized <= 5) {
      niceNormalized = 5;
    } else {
      niceNormalized = 10;
    }

    const suggestedMax = niceNormalized * magnitude;
    const stepSize = suggestedMax / 5;

    return { suggestedMax, stepSize };
  }

  function createChartConfig(key, dataset) {
    if (key === 'sales') {
      const { suggestedMax, stepSize } = computeNiceScale(dataset.data);
      const yAxis = {
        beginAtZero: true,
        grace: '8%',
        grid: {
          color: 'rgba(15, 23, 42, 0.08)',
          drawBorder: false,
          borderDash: [4, 4],
        },
        ticks: {
          maxTicksLimit: 6,
          callback(value) {
            return formatCurrency(value, { compact: true });
          },
        },
      };

      if (Number.isFinite(suggestedMax)) {
        yAxis.suggestedMax = suggestedMax;
      }
      if (Number.isFinite(stepSize) && stepSize > 0) {
        yAxis.ticks.stepSize = stepSize;
      }

      return {
        type: 'line',
        data: {
          labels: dataset.labels,
          datasets: [
            {
              label: 'Daily sales',
              data: dataset.data,
              borderColor: '#2563eb',
              backgroundColor: 'rgba(37, 99, 235, 0.18)',
              tension: 0.35,
              fill: true,
              pointRadius: 4,
              pointHoverRadius: 6,
              pointBorderWidth: 2,
              pointBackgroundColor: '#ffffff',
              pointBorderColor: '#2563eb',
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { intersect: false, mode: 'index' },
          layout: {
            padding: {
              top: 12,
              right: 16,
              bottom: 8,
              left: 8,
            },
          },
          scales: {
            x: {
              grid: {
                display: true,
                color: 'rgba(15, 23, 42, 0.04)',
                drawBorder: false,
              },
              ticks: {
                maxRotation: 0,
                autoSkip: true,
                maxTicksLimit: 6,
                callback(value, index) {
                  const label = dataset.labels[index];
                  return formatDate(label);
                },
              },
            },
            y: yAxis,
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title(context) {
                  if (!context.length) {
                    return '';
                  }
                  return formatDate(context[0].label);
                },
                label(context) {
                  const amount = context.parsed.y ?? context.parsed ?? 0;
                  return formatCurrency(amount);
                },
              },
            },
          },
        },
      };
    }

    return {
      type: 'doughnut',
      data: {
        labels: dataset.labels,
        datasets: [
          {
            data: dataset.data,
            backgroundColor: getPopularityColors(dataset.labels.length),
            borderWidth: 0,
            hoverOffset: 12,
            borderRadius: 10,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '58%',
        layout: {
          padding: {
            top: 12,
            bottom: 12,
            left: 12,
            right: 12,
          },
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 14,
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 16,
            },
          },
          tooltip: {
            callbacks: {
              label(context) {
                const value = Number.isFinite(context.parsed) ? context.parsed : 0;
                const suffix = value === 1 ? 'booking' : 'bookings';
                const label = context.label || '';
                const datasetValues =
                  context &&
                  context.chart &&
                  context.chart.data &&
                  Array.isArray(context.chart.data.datasets)
                    ? context.chart.data.datasets[context.datasetIndex]?.data || []
                    : [];
                const total = Array.isArray(datasetValues)
                  ? datasetValues.reduce(
                      (sum, item) => sum + (Number(item) || 0),
                      0,
                    )
                  : 0;
                const percentage = total > 0 ? (value / total) * 100 : 0;
                let percentageLabel = '';
                if (Number.isFinite(percentage) && total > 0) {
                  const precision = percentage >= 10 ? 0 : 1;
                  percentageLabel = ` (${percentage.toFixed(precision)}%)`;
                }
                return `${label}: ${value} ${suffix}${percentageLabel}`;
              },
            },
          },
        },
      },
    };
  }

  function renderChart(key) {
    const element = chartElements[key];
    if (!element || !element.canvas) {
      return;
    }
    const dataset = analyticsData[key] || { labels: [], data: [] };
    const hasData =
      Array.isArray(dataset.labels)
      && dataset.labels.length > 0
      && Array.isArray(dataset.data)
      && dataset.data.some((value) => Number(value) > 0);

    if (!hasData) {
      if (chartInstances[key]) {
        chartInstances[key].destroy();
        chartInstances[key] = null;
      }
      if (element.canvas) {
        element.canvas.classList.add('is-hidden');
      }
      if (element.empty) {
        element.empty.classList.remove('is-hidden');
      }
      return;
    }

    if (element.canvas) {
      element.canvas.classList.remove('is-hidden');
    }
    if (element.empty) {
      element.empty.classList.add('is-hidden');
    }

    if (typeof Chart === 'undefined') {
      return;
    }

    if (!chartInstances[key]) {
      chartInstances[key] = new Chart(element.canvas, createChartConfig(key, dataset));
      return;
    }

    const chart = chartInstances[key];
    chart.data.labels = dataset.labels.slice();
    chart.data.datasets[0].data = dataset.data.slice();
    if (key === 'popularity') {
      chart.data.datasets[0].backgroundColor = getPopularityColors(dataset.labels.length);
    }
    chart.update();
  }

  function setChartData(key, raw) {
    analyticsData[key] = normalizeSeries(raw);
    renderChart(key);
  }

  function updateAnalytics(meta) {
    if (!meta || typeof meta !== 'object') {
      return;
    }
    if (Object.prototype.hasOwnProperty.call(meta, 'sales')) {
      setChartData('sales', meta.sales);
    }
    if (Object.prototype.hasOwnProperty.call(meta, 'popularity')) {
      setChartData('popularity', meta.popularity);
    }
  }

  function initializeCharts() {
    renderChart('sales');
    renderChart('popularity');
  }

  function showToast(message) {
    if (!toast) {
      return;
    }
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(showToast.timeoutId);
    showToast.timeoutId = window.setTimeout(() => {
      toast.classList.remove('is-visible');
    }, 2600);
  }

  function toggleEmptyState(section) {
    const emptyState = emptyStates[section];
    if (!emptyState) {
      return;
    }
    const items = state[section] || [];
    const meta = state.pagination[section] || {};
    const hasItems = Array.isArray(items) && items.length > 0;
    const query = (typeof meta.query === 'string' ? meta.query : state.search[section]) || '';
    const defaultMessage = emptyState.dataset.emptyDefault || emptyState.textContent;
    const filteredMessage = emptyState.dataset.emptyFiltered || defaultMessage;
    emptyState.textContent = query ? filteredMessage : defaultMessage;
    emptyState.classList.toggle('is-visible', !hasItems);
  }

  function setLoading(section, isLoading) {
    const wrapper = tableWrappers[section];
    if (!wrapper) {
      return;
    }
    const active = Boolean(isLoading);
    wrapper.classList.toggle('is-loading', active);
    wrapper.setAttribute('aria-busy', active ? 'true' : 'false');
  }

  function computePageList(current, total, maxLength = 5) {
    const safeTotal = Math.max(1, total || 1);
    const safeCurrent = Math.min(Math.max(1, current || 1), safeTotal);
    const visible = Math.max(1, maxLength || 1);
    let start = Math.max(1, safeCurrent - Math.floor(visible / 2));
    let end = start + visible - 1;
    if (end > safeTotal) {
      end = safeTotal;
      start = Math.max(1, end - visible + 1);
    }
    const pages = [];
    for (let page = start; page <= end; page += 1) {
      pages.push(page);
    }
    return pages;
  }

  function handlePageChange(section, page) {
    const meta = state.pagination[section] || {};
    const parsed = Number(page);
    const pageNumber = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    const pageSize = meta.pageSize || DEFAULT_PAGE_SIZE;
    const query = state.search[section] || '';
    loadSection(section, { page: pageNumber, pageSize, query });
  }

  function createPaginationButton(label, pageNumber, section, options = {}) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    if (options.ariaLabel) {
      button.setAttribute('aria-label', options.ariaLabel);
    }
    if (options.disabled) {
      button.disabled = true;
      return button;
    }
    button.dataset.page = String(pageNumber);
    button.addEventListener('click', () => {
      handlePageChange(section, pageNumber);
    });
    return button;
  }

  function renderPagination(section) {
    const container = paginationContainers[section];
    if (!container) {
      return;
    }
    const meta = state.pagination[section];
    container.innerHTML = '';
    if (!meta || meta.totalPages <= 1) {
      container.classList.add('is-hidden');
      return;
    }
    container.classList.remove('is-hidden');
    const fragment = document.createDocumentFragment();
    fragment.appendChild(
      createPaginationButton('Prev', meta.page - 1, section, {
        disabled: !meta.hasPrevious,
        ariaLabel: 'Previous page',
      }),
    );
    const pages = computePageList(meta.page, meta.totalPages);
    pages.forEach((pageNumber) => {
      const button = createPaginationButton(String(pageNumber), pageNumber, section);
      if (pageNumber === meta.page) {
        button.classList.add('is-active');
        button.disabled = true;
        button.setAttribute('aria-current', 'page');
      }
      fragment.appendChild(button);
    });
    fragment.appendChild(
      createPaginationButton('Next', meta.page + 1, section, {
        disabled: !meta.hasNext,
        ariaLabel: 'Next page',
      }),
    );
    container.appendChild(fragment);
  }

  function updateSummary(section) {
    const summary = tableSummaries[section];
    if (!summary) {
      return;
    }
    const meta = state.pagination[section];
    const items = state[section];
    if (!meta || !items || !items.length || !meta.totalItems) {
      summary.textContent = '';
      return;
    }
    const startIndex = (meta.page - 1) * meta.pageSize + 1;
    const endIndex = Math.min(meta.totalItems, startIndex + items.length - 1);
    const queryText = meta.query ? ` matching “${meta.query}”` : '';
    summary.textContent = `Showing ${startIndex}–${endIndex} of ${meta.totalItems}${queryText} results.`;
  }

  function updateTableFooter(section) {
    const footer = tableFooters[section];
    if (!footer) {
      return;
    }
    const meta = state.pagination[section];
    const hasItems = meta && meta.totalItems > 0;
    footer.classList.toggle('is-hidden', !hasItems);
  }

  function handleSearchChange(section, rawValue) {
    if (!(section in searchTimeouts)) {
      return;
    }
    const query = typeof rawValue === 'string' ? rawValue.trim() : '';
    state.search[section] = query;
    const meta = state.pagination[section] || {};
    const pageSize = meta.pageSize || DEFAULT_PAGE_SIZE;
    window.clearTimeout(searchTimeouts[section]);
    searchTimeouts[section] = window.setTimeout(() => {
      loadSection(section, { page: 1, pageSize, query });
    }, 220);
  }

  function createAutocompleteController(fieldElement, options = {}) {
    if (!fieldElement) {
      return null;
    }

    const textInput = fieldElement.querySelector('input[type="text"]');
    const hiddenInput = fieldElement.querySelector('input[type="hidden"]');
    const panel = fieldElement.querySelector('[data-autocomplete-panel]');

    if (!textInput || !panel) {
      return null;
    }

    const settings = {
      minChars: 1,
      debounce: 200,
      ...options,
    };

    let items = [];
    let highlightedIndex = -1;
    let debounceId = null;
    let lastRequestId = 0;

    function setHighlightedIndex(index) {
      highlightedIndex = index;
      const optionsNodes = panel.querySelectorAll('.autocomplete-option');
      optionsNodes.forEach((option, optionIndex) => {
        option.classList.toggle('is-active', optionIndex === highlightedIndex);
        if (optionIndex === highlightedIndex) {
          option.scrollIntoView({ block: 'nearest' });
        }
      });
    }

    function close() {
      panel.hidden = true;
      panel.innerHTML = '';
      items = [];
      highlightedIndex = -1;
      lastRequestId += 1;
      if (typeof settings.onClose === 'function') {
        settings.onClose();
      }
    }

    function setSelection(displayValue = '', hiddenValue = '') {
      textInput.value = displayValue;
      if (hiddenInput) {
        hiddenInput.value = hiddenValue;
      }
    }

    function renderOptions(list) {
      panel.innerHTML = '';

      if (!list.length) {
        const empty = document.createElement('div');
        empty.className = 'autocomplete-empty';
        empty.textContent = typeof settings.emptyMessage === 'function'
          ? settings.emptyMessage()
          : settings.emptyMessage || 'No results found.';
        panel.appendChild(empty);
        panel.hidden = false;
        return;
      }

      const fragment = document.createDocumentFragment();
      list.forEach((item, index) => {
        const option = document.createElement('div');
        option.className = 'autocomplete-option';
        option.dataset.index = index.toString();

        const primary = document.createElement('strong');
        const primaryText = settings.getPrimaryText ? settings.getPrimaryText(item) : '';
        primary.textContent = primaryText || '';
        option.appendChild(primary);

        const secondaryText = settings.getSecondaryText ? settings.getSecondaryText(item) : '';
        if (secondaryText) {
          const secondary = document.createElement('span');
          secondary.textContent = secondaryText;
          option.appendChild(secondary);
        }

        option.addEventListener('mousedown', (event) => {
          event.preventDefault();
          select(index);
        });

        fragment.appendChild(option);
      });

      panel.appendChild(fragment);
      panel.hidden = false;
      setHighlightedIndex(-1);
    }

    function select(index) {
      const item = items[index];
      if (!item) {
        return;
      }
      const display = settings.getInputValue ? settings.getInputValue(item) : '';
      const value = settings.getHiddenValue ? settings.getHiddenValue(item) : '';
      setSelection(display, value);
      if (typeof settings.onSelect === 'function') {
        settings.onSelect(item);
      }
      close();
    }

    async function requestItems(query) {
      if (typeof settings.fetchItems !== 'function') {
        return;
      }

      const requestId = ++lastRequestId;

      try {
        const result = await settings.fetchItems(query);
        if (requestId !== lastRequestId) {
          return;
        }
        items = Array.isArray(result) ? result : [];
        renderOptions(items);
      } catch (error) {
        if (error && error.name === 'AbortError') {
          return;
        }
        console.error(error);
        close();
      }
    }

    function handleInput(event) {
      if (hiddenInput) {
        hiddenInput.value = '';
      }
      const query = event.target.value.trim();
      window.clearTimeout(debounceId);
      if (!query || query.length < settings.minChars) {
        close();
        return;
      }
      debounceId = window.setTimeout(() => {
        requestItems(query);
      }, settings.debounce);
    }

    function handleKeydown(event) {
      if (!items.length) {
        if (event.key === 'Escape') {
          close();
        }
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        const nextIndex = highlightedIndex + 1 >= items.length ? 0 : highlightedIndex + 1;
        setHighlightedIndex(nextIndex);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        const nextIndex = highlightedIndex <= 0 ? items.length - 1 : highlightedIndex - 1;
        setHighlightedIndex(nextIndex);
      } else if (event.key === 'Enter') {
        if (highlightedIndex >= 0) {
          event.preventDefault();
          select(highlightedIndex);
        }
      } else if (event.key === 'Escape') {
        close();
      }
    }

    textInput.addEventListener('input', handleInput);
    textInput.addEventListener('keydown', handleKeydown);
    textInput.addEventListener('focus', () => {
      const query = textInput.value.trim();
      if (query.length >= settings.minChars) {
        requestItems(query);
      }
    });
    textInput.addEventListener('blur', () => {
      window.setTimeout(() => {
        close();
      }, 120);
    });

    return {
      input: textInput,
      hiddenInput,
      close,
      clear() {
        setSelection('', '');
        close();
      },
      setSelection,
      refresh() {
        const query = textInput.value.trim();
        if (query.length >= settings.minChars) {
          requestItems(query);
        }
      },
    };
  }

  function closeAllAutocompletes() {
    Object.values(autocompleteControllers).forEach((controller) => {
      if (controller) {
        controller.close();
      }
    });
  }

  function clearAutocompletes() {
    Object.values(autocompleteControllers).forEach((controller) => {
      if (controller) {
        controller.clear();
      }
    });
  }

  function syncVenueAutocompleteSelection() {
    const venueController = autocompleteControllers.venue;
    if (!venueController || !venueController.hiddenInput) {
      return;
    }
    const currentValue = venueController.hiddenInput.value;
    if (!currentValue) {
      return;
    }
    const matchingVenue = state.venues.find((venue) => Number(venue.id) === Number(currentValue));
    if (matchingVenue) {
      venueController.setSelection(matchingVenue.title || '', matchingVenue.id);
      return;
    }
    const venuesMeta = state.pagination.venues || {};
    const totalVenues =
      typeof venuesMeta.total_available === 'number'
        ? venuesMeta.total_available
        : typeof venuesMeta.totalItems === 'number'
          ? venuesMeta.totalItems
          : state.venues.length;
    if (totalVenues === 0) {
      venueController.setSelection('', '');
    }
  }

  const userAutocompleteField = entityForm.querySelector('[data-autocomplete="user"]');
  if (userAutocompleteField) {
    autocompleteControllers.user = createAutocompleteController(userAutocompleteField, {
      minChars: 2,
      debounce: 220,
      fetchItems: async (query) => {
        if (!endpoints.users || !endpoints.users.search) {
          return [];
        }
        if (userSearchController) {
          userSearchController.abort();
        }
        userSearchController = new AbortController();
        try {
          const response = await fetch(
            `${endpoints.users.search}?q=${encodeURIComponent(query)}`,
            {
              headers: { 'X-Requested-With': 'XMLHttpRequest' },
              signal: userSearchController.signal,
            },
          );
          if (!response.ok) {
            throw new Error('Search failed');
          }
          const payload = await response.json();
          if (payload.meta && typeof payload.meta.has_users === 'boolean') {
            state.hasUsers = payload.meta.has_users;
            updateActionButton();
          }
          if (!payload.success) {
            return [];
          }
          return Array.isArray(payload.data) ? payload.data : [];
        } finally {
          userSearchController = null;
        }
      },
      getPrimaryText: (item) => (item.full_name ? item.full_name : item.username),
      getSecondaryText: (item) => {
        if (item.full_name) {
          return item.username;
        }
        return item.email || '';
      },
      getInputValue: (item) => item.username || '',
      getHiddenValue: (item) => (item.id !== undefined ? item.id : ''),
      emptyMessage: () => (state.hasUsers ? 'No users found.' : 'No users available yet.'),
      onSelect: () => {
        state.hasUsers = true;
        updateActionButton();
      },
      onClose: () => {
        if (userSearchController) {
          userSearchController.abort();
          userSearchController = null;
        }
      },
    });
  }

  const venueAutocompleteField = entityForm.querySelector('[data-autocomplete="venue"]');
  if (venueAutocompleteField) {
    autocompleteControllers.venue = createAutocompleteController(venueAutocompleteField, {
      minChars: 1,
      debounce: 160,
      fetchItems: async (query) => {
        const normalized = query.trim().toLowerCase();
        if (!normalized) {
          return [];
        }
        const matches = state.venues.filter((venue) => {
          const title = venue.title ? venue.title.toLowerCase() : '';
          const location = venue.location ? venue.location.toLowerCase() : '';
          return title.includes(normalized) || location.includes(normalized);
        });
        return matches.slice(0, 8);
      },
      getPrimaryText: (item) => item.title || '',
      getSecondaryText: (item) => item.location || '',
      getInputValue: (item) => item.title || '',
      getHiddenValue: (item) => (item.id !== undefined ? item.id : ''),
      emptyMessage: () => (state.venues.length ? 'No venues found.' : 'Create a venue first.'),
    });
  }

  function renderVenues() {
    venuesTableBody.innerHTML = '';
    const fragment = document.createDocumentFragment();
    state.venues.forEach((venue) => {
      const row = document.createElement('tr');
      row.dataset.recordId = venue.id;

      const imageCell = document.createElement('td');
      if (venue.image_url) {
        const img = document.createElement('img');
        img.src = venue.image_url;
        img.alt = `${venue.title} preview`;
        imageCell.appendChild(img);
      } else {
        const placeholder = document.createElement('span');
        placeholder.className = 'image-placeholder';
        placeholder.textContent = 'No image';
        imageCell.appendChild(placeholder);
      }
      row.appendChild(imageCell);

      const titleCell = document.createElement('td');
      titleCell.textContent = venue.title;
      row.appendChild(titleCell);

      const typeCell = document.createElement('td');
      typeCell.textContent = venue.type || '—';
      row.appendChild(typeCell);

      const ratingCell = document.createElement('td');
      const ratingElement = createStarRatingElement(
        venue.average_rating,
        venue.rating_count,
      );
      ratingCell.appendChild(ratingElement);
      row.appendChild(ratingCell);

      const locationCell = document.createElement('td');
      locationCell.textContent = venue.location;
      row.appendChild(locationCell);

      const facilitiesCell = document.createElement('td');
      facilitiesCell.textContent = venue.facilities && venue.facilities.length
        ? venue.facilities.join(', ')
        : '—';
      row.appendChild(facilitiesCell);

      const priceCell = document.createElement('td');
      priceCell.textContent = formatCurrency(venue.price);
      row.appendChild(priceCell);

      const actionsCell = document.createElement('td');
      actionsCell.className = 'actions-col';
      const actionGroup = document.createElement('div');
      actionGroup.className = 'table-actions';

      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.dataset.action = 'edit';
      editButton.dataset.id = venue.id;
      editButton.textContent = 'Edit';

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.dataset.action = 'delete';
      deleteButton.dataset.id = venue.id;
      deleteButton.textContent = 'Delete';

      actionGroup.append(editButton, deleteButton);
      actionsCell.appendChild(actionGroup);
      row.appendChild(actionsCell);

      fragment.appendChild(row);
    });

    venuesTableBody.appendChild(fragment);
    toggleEmptyState('venues');
    updateSummary('venues');
    renderPagination('venues');
    updateTableFooter('venues');
    animateTableRows(venuesTableBody);
  }

  function renderBookings() {
    bookingsTableBody.innerHTML = '';
    const fragment = document.createDocumentFragment();

    state.bookings.forEach((booking) => {
      const row = document.createElement('tr');
      row.dataset.recordId = booking.id;

      const guestCell = document.createElement('td');
      const guestLabel = booking.user
        ? booking.user.full_name
          ? `${booking.user.full_name} (${booking.user.username})`
          : booking.user.username
        : booking.username || '—';
      guestCell.textContent = guestLabel;
      row.appendChild(guestCell);

      const venueCell = document.createElement('td');
      venueCell.textContent = booking.venue ? booking.venue.title : '—';
      row.appendChild(venueCell);

      const datesCell = document.createElement('td');
      datesCell.textContent = `${formatDate(booking.start_date)} – ${formatDate(booking.end_date)}`;
      row.appendChild(datesCell);

      const paidCell = document.createElement('td');
      paidCell.textContent = booking.has_been_paid ? 'Paid' : 'Pending';
      row.appendChild(paidCell);

      const notesCell = document.createElement('td');
      notesCell.textContent = booking.notes || '—';
      row.appendChild(notesCell);

      const actionsCell = document.createElement('td');
      actionsCell.className = 'actions-col';
      const actionGroup = document.createElement('div');
      actionGroup.className = 'table-actions';

      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.dataset.action = 'edit';
      editButton.dataset.id = booking.id;
      editButton.textContent = 'Edit';

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.dataset.action = 'delete';
      deleteButton.dataset.id = booking.id;
      deleteButton.textContent = 'Delete';

      actionGroup.append(editButton, deleteButton);
      actionsCell.appendChild(actionGroup);
      row.appendChild(actionsCell);

      fragment.appendChild(row);
    });

    bookingsTableBody.appendChild(fragment);
    toggleEmptyState('bookings');
    updateSummary('bookings');
    renderPagination('bookings');
    updateTableFooter('bookings');
    animateTableRows(bookingsTableBody);
  }

  function updateHeader(section) {
    const config = sectionConfig[section];
    if (!config) {
      return;
    }
    sectionTitle.textContent = config.title;
    sectionDescription.textContent = config.description;
    actionButton.querySelector('.btn-label').textContent = config.buttonLabel;
  }

  function updateActionButton() {
    if (state.currentSection === 'bookings') {
      const venuesMeta = state.pagination.venues || {};
      const totalVenues =
        typeof venuesMeta.total_available === 'number'
          ? venuesMeta.total_available
          : typeof venuesMeta.totalItems === 'number'
            ? venuesMeta.totalItems
            : state.venues.length;
      const hasVenues = totalVenues > 0;
      const hasUsers = state.hasUsers;
      const canCreate = hasVenues && hasUsers;
      actionButton.disabled = !canCreate;
      if (!canCreate) {
        const missing = [];
        if (!hasVenues) {
          missing.push('a venue');
        }
        if (!hasUsers) {
          missing.push('a user');
        }
        actionButton.title = `Create ${missing.join(' and ')} before adding bookings.`;
      } else {
        actionButton.title = '';
      }
    } else {
      actionButton.disabled = false;
      actionButton.title = '';
    }
  }

  function setActiveSection(section) {
    if (!sectionConfig[section]) {
      return;
    }
    state.currentSection = section;

    let activeButton = null;
    navButtons.forEach((button) => {
      const isActive = button.dataset.target === section;
      button.classList.toggle('is-active', isActive);
      if (isActive) {
        activeButton = button;
      }
    });

    let activeSectionElement = null;
    contentSections.forEach((contentSection) => {
      const isActive = contentSection.dataset.section === section;
      contentSection.classList.toggle('is-hidden', !isActive);
      if (isActive) {
        activeSectionElement = contentSection;
      }
    });

    animateActiveNavButton(activeButton);
    animateSectionEntry(activeSectionElement);

    if (searchInputs[section]) {
      searchInputs[section].value = state.search[section] || '';
    }

    updateHeader(section);
    updateActionButton();
    refreshFromServer(section);
  }

  function clearForm() {
    entityForm.reset();
    clearAutocompletes();
    if (entityForm.dataset.section === 'bookings') {
      const paidField = entityForm.querySelector('input[name="has_been_paid"]');
      if (paidField) {
        paidField.checked = false;
      }
    }
  }

  function clearErrors() {
    if (modalErrors) {
      modalErrors.hidden = true;
      modalErrors.innerHTML = '';
    }
  }

  function showErrors(messages) {
    if (!modalErrors) {
      return;
    }
    if (!messages || !messages.length) {
      clearErrors();
      return;
    }
    modalErrors.innerHTML = `<ul>${messages.map((msg) => `<li>${msg}</li>`).join('')}</ul>`;
    modalErrors.hidden = false;
  }

  function openModal(mode, section, recordId) {
    if (section === 'bookings' && mode === 'create') {
      if (!state.hasUsers) {
        showToast('Create a user before adding bookings.');
        return;
      }
      if (!state.venues.length) {
        showToast('Create a venue before adding bookings.');
        return;
      }
    }

    state.modalMode = mode;
    state.editingId = recordId || null;
    entityForm.dataset.mode = mode;
    entityForm.dataset.section = section;
    entityForm.dataset.recordId = recordId || '';

    setActiveFormSection(section);

    clearForm();
    clearErrors();
    closeAllAutocompletes();

    if (mode === 'edit' && recordId) {
      if (section === 'venues') {
        const venue = state.venues.find((item) => Number(item.id) === Number(recordId));
        if (venue) {
          entityForm.querySelector('input[name="title"]').value = venue.title;
          const typeField = entityForm.querySelector('select[name="type"]');
          if (typeField) {
            const fallback = typeField.options.length ? typeField.options[0].value : '';
            typeField.value = venue.type || fallback;
          }
          entityForm.querySelector('textarea[name="description"]').value = venue.description || '';
          entityForm.querySelector('input[name="facilities"]').value = (venue.facilities || []).join(', ');
          entityForm.querySelector('input[name="price"]').value = venue.price;
          entityForm.querySelector('input[name="location"]').value = venue.location || '';
          const imageField = entityForm.querySelector('input[name="image"]');
          if (imageField) {
            imageField.value = '';
          }
        }
      } else if (section === 'bookings') {
        const booking = state.bookings.find((item) => Number(item.id) === Number(recordId));
        if (booking) {
          if (autocompleteControllers.user) {
            const usernameValue = booking.user
              ? booking.user.username
              : booking.username || '';
            const userIdValue = booking.user ? booking.user.id : '';
            autocompleteControllers.user.setSelection(usernameValue, userIdValue);
          }
          if (autocompleteControllers.venue) {
            const venueTitle = booking.venue ? booking.venue.title : '';
            const venueId = booking.venue ? booking.venue.id : '';
            autocompleteControllers.venue.setSelection(venueTitle, venueId);
          }
          entityForm.querySelector('input[name="start_date"]').value = booking.start_date;
          entityForm.querySelector('input[name="end_date"]').value = booking.end_date;
          entityForm.querySelector('input[name="has_been_paid"]').checked = Boolean(booking.has_been_paid);
          entityForm.querySelector('textarea[name="notes"]').value = booking.notes || '';
        }
      }
    } else if (section === 'bookings') {
      if (autocompleteControllers.user) {
        autocompleteControllers.user.setSelection('', '');
      }
      if (autocompleteControllers.venue) {
        autocompleteControllers.venue.setSelection('', '');
      }
    }

    modalTitle.textContent = mode === 'edit'
      ? `Edit ${sectionConfig[section].title.slice(0, -1)}`
      : `Add ${sectionConfig[section].title.slice(0, -1)}`;
    if (submitLabel) {
      submitLabel.textContent = mode === 'edit' ? 'Update' : 'Create';
    }

    showModalBackdrop();

    if (canAnimate && modalElement) {
      if (modalAnimation) {
        modalAnimation.pause();
        modalAnimation = null;
      }
      anime.remove([modalBackdrop, modalElement]);
      anime.set(modalBackdrop, { opacity: 0 });
      anime.set(modalElement, { opacity: 0, translateY: 22, scale: 0.96 });
      modalAnimation = anime.timeline({
        duration: 280,
        easing: 'easeOutQuad',
        complete: () => {
          resetModalStyles();
          modalAnimation = null;
        },
      })
        .add({
          targets: modalBackdrop,
          opacity: 1,
          duration: 180,
        })
        .add(
          {
            targets: modalElement,
            opacity: 1,
            translateY: 0,
            scale: 1,
            duration: 280,
          },
          '-=120',
        );
    } else {
      resetModalStyles();
    }
  }

  function closeModal() {
    state.editingId = null;
    closeAllAutocompletes();
    if (!modalBackdrop) {
      return;
    }
    if (modalBackdrop.hidden) {
      hideModalBackdrop();
      resetModalStyles();
      return;
    }
    if (!canAnimate || !modalElement) {
      hideModalBackdrop();
      resetModalStyles();
      return;
    }

    if (modalAnimation) {
      modalAnimation.pause();
      modalAnimation = null;
    }
    anime.remove([modalBackdrop, modalElement]);
    modalAnimation = anime.timeline({
      duration: 220,
      easing: 'easeInOutQuad',
      complete: () => {
        hideModalBackdrop();
        resetModalStyles();
        modalAnimation = null;
      },
    })
      .add({
        targets: modalElement,
        opacity: 0,
        translateY: 16,
        scale: 0.96,
        duration: 200,
      })
      .add(
        {
          targets: modalBackdrop,
          opacity: 0,
          duration: 160,
        },
        '-=120',
      );
  }

  async function loadSection(section, options = {}) {
    const endpoint = endpoints[section];
    if (!endpoint || !endpoint.list) {
      return null;
    }

    const currentMeta = state.pagination[section] || {};
    const query =
      options.query !== undefined ? options.query : state.search[section] || '';
    const requestedPageSize =
      options.pageSize !== undefined ? Number(options.pageSize) : currentMeta.pageSize;
    const pageSize = Number.isFinite(requestedPageSize) && requestedPageSize > 0
      ? requestedPageSize
      : DEFAULT_PAGE_SIZE;
    const requestedPage =
      options.page !== undefined ? Number(options.page) : currentMeta.page;
    const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('page_size', String(pageSize));
    if (query) {
      params.set('q', query);
    }

    if (fetchControllers[section]) {
      fetchControllers[section].abort();
    }
    const controller = new AbortController();
    fetchControllers[section] = controller;

    try {
      setLoading(section, true);
      const response = await fetch(`${endpoint.list}?${params.toString()}`, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error('Failed to load data');
      }
      const payload = await response.json();
      if (!payload.success) {
        return null;
      }
      const data = Array.isArray(payload.data) ? payload.data : [];
      const meta = normalizePaginationMeta(payload.meta, {
        page,
        pageSize,
        query,
        totalItems: currentMeta.totalItems,
        totalPages: currentMeta.totalPages,
        hasPrevious: currentMeta.hasPrevious,
        hasNext: currentMeta.hasNext,
      });

      state[section] = data;
      state.pagination[section] = meta;
      state.search[section] = meta.query || '';

      if (searchInputs[section] && searchInputs[section].value !== state.search[section]) {
        searchInputs[section].value = state.search[section];
      }

      if (section === 'bookings' && typeof meta.has_users === 'boolean') {
        state.hasUsers = meta.has_users;
      }

      if (section === 'venues') {
        renderVenues();
        syncVenueAutocompleteSelection();
        if (autocompleteControllers.venue) {
          if (!state.venues.length && !meta.totalItems) {
            autocompleteControllers.venue.clear();
          } else {
            autocompleteControllers.venue.refresh();
          }
        }
        if (state.currentSection === 'bookings') {
          renderBookings();
        }
      } else if (section === 'bookings') {
        renderBookings();
        updateAnalytics(meta.analytics || (payload.meta ? payload.meta.analytics : undefined));
      }

      updateActionButton();
      return payload;
    } catch (error) {
      if (error.name === 'AbortError') {
        return null;
      }
      console.error(error);
      showToast('Unable to load data right now.');
      return null;
    } finally {
      setLoading(section, false);
      if (fetchControllers[section] === controller) {
        fetchControllers[section] = null;
      }
    }
  }

  async function refreshFromServer(section, options = {}) {
    return loadSection(section, options);
  }

  async function handleFormSubmit(event) {
    event.preventDefault();
    const section = entityForm.dataset.section;
    const mode = entityForm.dataset.mode;
    const recordId = entityForm.dataset.recordId;

    const endpoint = endpoints[section];
    if (!endpoint) {
      return;
    }

    const url = mode === 'edit' ? endpoint.update(recordId) : endpoint.create;
    const formData = new FormData(entityForm);

    if (section === 'venues') {
      const imageField = entityForm.querySelector('input[name="image"]');
      if (imageField && imageField.files && imageField.files.length === 0) {
        formData.delete('image');
      }
    }

    if (section === 'bookings' && !entityForm.querySelector('input[name="has_been_paid"]').checked) {
      formData.delete('has_been_paid');
    }

    const submitButton = entityForm.querySelector('button[type="submit"]');
    clearErrors();

    if (section === 'bookings') {
      const venueId = formData.get('venue');
      if (!venueId) {
        showErrors(['Please choose a venue from the list.']);
        if (autocompleteControllers.venue && autocompleteControllers.venue.input) {
          autocompleteControllers.venue.input.focus();
        }
        return;
      }
    }

    submitButton.disabled = true;
    submitButton.classList.add('is-loading');

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'X-CSRFToken': getCsrfToken(),
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: formData,
      });

      const payload = await response.json();
      if (!response.ok || !payload.success) {
        const errors = payload && payload.errors ? payload.errors : ['Unable to save changes.'];
        showErrors(errors);
        return;
      }

      if (section === 'venues') {
        if (
          mode === 'edit'
          && autocompleteControllers.venue
          && autocompleteControllers.venue.hiddenInput
          && Number(autocompleteControllers.venue.hiddenInput.value)
            === Number(payload.data.id)
        ) {
          autocompleteControllers.venue.setSelection(payload.data.title || '', payload.data.id);
        }

        const targetPage = mode === 'edit'
          ? state.pagination.venues.page || 1
          : 1;
        await refreshFromServer('venues', {
          page: targetPage,
          query: state.search.venues || '',
        });

        if (mode === 'edit') {
          await refreshFromServer('bookings', {
            page: state.pagination.bookings.page || 1,
            query: state.search.bookings || '',
          });
        }
      } else if (section === 'bookings') {
        state.hasUsers = true;
        const targetPage = mode === 'edit'
          ? state.pagination.bookings.page || 1
          : 1;
        await refreshFromServer('bookings', {
          page: targetPage,
          query: state.search.bookings || '',
        });
      }

      closeModal();
      showToast(mode === 'edit' ? 'Updated successfully!' : 'Created successfully!');
    } catch (error) {
      console.error(error);
      showErrors(['Network error. Please try again.']);
    } finally {
      submitButton.disabled = false;
      submitButton.classList.remove('is-loading');
    }
  }

  async function handleDelete(section, recordId) {
    const endpoint = endpoints[section];
    if (!endpoint) {
      return;
    }
    const confirmed = window.confirm('Are you sure you want to delete this item?');
    if (!confirmed) {
      return;
    }
    try {
      const response = await fetch(endpoint.delete(recordId), {
        method: 'POST',
        headers: {
          'X-CSRFToken': getCsrfToken(),
          'X-Requested-With': 'XMLHttpRequest',
        },
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error('Delete failed');
      }
      await animateRowRemoval(section, recordId);
      if (section === 'venues') {
        if (
          autocompleteControllers.venue
          && autocompleteControllers.venue.hiddenInput
          && Number(autocompleteControllers.venue.hiddenInput.value) === Number(recordId)
        ) {
          autocompleteControllers.venue.clear();
        }
        await refreshFromServer('venues', {
          page: state.pagination.venues.page || 1,
          query: state.search.venues || '',
        });
        await refreshFromServer('bookings', {
          page: state.pagination.bookings.page || 1,
          query: state.search.bookings || '',
        });
      } else if (section === 'bookings') {
        await refreshFromServer('bookings', {
          page: state.pagination.bookings.page || 1,
          query: state.search.bookings || '',
        });
      }
      showToast('Deleted successfully.');
    } catch (error) {
      console.error(error);
      showToast('Unable to delete this item right now.');
    }
  }

  navButtons.forEach((button) => {
    button.addEventListener('click', () => {
      setActiveSection(button.dataset.target);
    });
  });

  actionButton.addEventListener('click', () => {
    openModal('create', state.currentSection);
  });

  entityForm.addEventListener('submit', handleFormSubmit);

  document.querySelectorAll('[data-action="close-modal"]').forEach((button) => {
    button.addEventListener('click', () => {
      closeModal();
    });
  });

  modalBackdrop.addEventListener('click', (event) => {
    if (event.target === modalBackdrop) {
      closeModal();
    }
  });

  venuesTableBody.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) {
      return;
    }
    if (button.dataset.action === 'edit') {
      openModal('edit', 'venues', button.dataset.id);
    } else if (button.dataset.action === 'delete') {
      handleDelete('venues', button.dataset.id);
    }
  });

  bookingsTableBody.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) {
      return;
    }
    if (button.dataset.action === 'edit') {
      openModal('edit', 'bookings', button.dataset.id);
    } else if (button.dataset.action === 'delete') {
      handleDelete('bookings', button.dataset.id);
    }
  });

  Object.entries(searchInputs).forEach(([section, input]) => {
    if (!input) {
      return;
    }
    input.value = state.search[section] || '';
    input.addEventListener('keyup', (event) => {
      handleSearchChange(section, event.target.value);
    });
    input.addEventListener('search', (event) => {
      handleSearchChange(section, event.target.value);
    });
  });

  initializeCharts();
  renderVenues();
  renderBookings();
  updateHeader(state.currentSection);
  updateActionButton();
  refreshFromServer('venues');
})();
