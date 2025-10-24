(function () {
  const app = document.getElementById('adminApp');
  if (!app) {
    return;
  }

  const state = {
    currentView: 'venues',
    venues: [],
    bookings: [],
    loading: false,
  };

  const endpoints = {
    venues: app.dataset.venuesUrl,
    venueDetailBase: app.dataset.venueDetailBase,
    bookings: app.dataset.bookingsUrl,
    bookingDetailBase: app.dataset.bookingDetailBase,
  };

  const navButtons = app.querySelectorAll('[data-view]');
  const sectionTitle = app.querySelector('[data-section-title]');
  const sectionDescription = app.querySelector('[data-section-description]');
  const modalTriggerCopy = app.querySelector('[data-modal-trigger-copy]');
  const tableHead = app.querySelector('[data-table-head]');
  const tableBody = app.querySelector('[data-table-body]');
  const tableStatus = app.querySelector('[data-table-status]');
  const emptyState = app.querySelector('[data-empty-state]');
  const refreshButton = app.querySelector('[data-refresh]');
  const modal = document.querySelector('[data-modal]');
  const overlay = document.querySelector('[data-overlay]');
  const modalTitle = modal.querySelector('[data-modal-title]');
  const modalForm = modal.querySelector('[data-modal-form]');
  const modalFields = modal.querySelector('[data-modal-fields]');
  const modalErrors = modal.querySelector('[data-modal-errors]');
  const modalSubmit = modal.querySelector('[data-modal-submit]');
  const methodField = modal.querySelector('[data-method-field]');

  let currentModalContext = null;

  const descriptions = {
    venues: 'Manage every venue in your portfolio, update pricing, and keep facilities accurate.',
    bookings: 'Track bookings, confirm payments, and adjust schedules with instant updates.',
  };

  function getCsrfToken() {
    const cookies = document.cookie ? document.cookie.split(';') : [];
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'csrftoken') {
        return decodeURIComponent(value);
      }
    }
    return '';
  }

  function escapeHtml(value) {
    if (value == null) {
      return '';
    }
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function resolveDetailUrl(type, id) {
    const base = type === 'venues' ? endpoints.venueDetailBase : endpoints.bookingDetailBase;
    return `${base}${id}/`;
  }

  function showStatus(message) {
    if (tableStatus) {
      tableStatus.textContent = message;
    }
  }

  function setLoading(isLoading) {
    state.loading = isLoading;
    if (isLoading) {
      showStatus('Loading…');
    } else {
      const collection = state.currentView === 'venues' ? state.venues : state.bookings;
      showStatus(`Showing ${collection.length} ${state.currentView}`);
    }
  }

  function renderEmptyState(collection) {
    if (!emptyState) {
      return;
    }
    if (state.loading) {
      emptyState.hidden = true;
      return;
    }
    if (!collection.length) {
      emptyState.hidden = false;
      if (tableBody) {
        tableBody.innerHTML = '';
      }
    } else {
      emptyState.hidden = true;
    }
  }

  function renderVenues() {
    if (!tableHead || !tableBody) {
      return;
    }
    tableHead.innerHTML = `
      <tr>
        <th>Venue</th>
        <th>Location</th>
        <th>Facilities</th>
        <th>Price</th>
        <th>Actions</th>
      </tr>
    `;

    const rows = state.venues
      .map((venue) => {
        const facilities = (venue.facilities || []).map((item) => `<span class="badge">${escapeHtml(item)}</span>`).join(' ');
        const price = new Intl.NumberFormat(undefined, {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
        }).format(venue.price || 0);
        const imagePreview = venue.image_url
          ? `<div class="venue-thumb" style="background-image: url('${escapeHtml(venue.image_url)}');"></div>`
          : '';
        return `
          <tr data-id="${venue.id}">
            <td>
              <div class="venue-cell">
                ${imagePreview}
                <div>
                  <div class="cell-title">${escapeHtml(venue.title)}</div>
                  <div class="cell-subtitle">${escapeHtml(venue.description)}</div>
                </div>
              </div>
            </td>
            <td>${escapeHtml(venue.location)}</td>
            <td>${facilities || '<span class="cell-muted">No facilities listed</span>'}</td>
            <td>${price}</td>
            <td>
              <div class="table-actions">
                <button class="ghost-btn" type="button" data-edit data-type="venues" data-id="${venue.id}">Edit</button>
                <button class="ghost-btn" type="button" data-delete data-type="venues" data-id="${venue.id}">Delete</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');

    tableBody.innerHTML = rows;
    renderEmptyState(state.venues);
  }

  function renderBookings() {
    if (!tableHead || !tableBody) {
      return;
    }
    tableHead.innerHTML = `
      <tr>
        <th>Guest</th>
        <th>Venue</th>
        <th>Schedule</th>
        <th>Status</th>
        <th>Notes</th>
        <th>Actions</th>
      </tr>
    `;

    const rows = state.bookings
      .map((booking) => {
        const paidBadge = booking.has_been_paid
          ? '<span class="badge is-success">Paid</span>'
          : '<span class="badge is-danger">Pending</span>';
        const schedule = booking.date
          ? `${escapeHtml(booking.date.start)} → ${escapeHtml(booking.date.end)}`
          : '—';
        const notes = booking.notes ? escapeHtml(booking.notes) : '<span class="cell-muted">No notes</span>';
        return `
          <tr data-id="${booking.id}">
            <td>${escapeHtml(booking.username)}</td>
            <td>${escapeHtml(booking.venue_title)}</td>
            <td>${schedule}</td>
            <td>${paidBadge}</td>
            <td>${notes}</td>
            <td>
              <div class="table-actions">
                <button class="ghost-btn" type="button" data-edit data-type="bookings" data-id="${booking.id}">Edit</button>
                <button class="ghost-btn" type="button" data-delete data-type="bookings" data-id="${booking.id}">Delete</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');

    tableBody.innerHTML = rows;
    renderEmptyState(state.bookings);
  }

  function render() {
    if (state.currentView === 'venues') {
      renderVenues();
    } else {
      renderBookings();
    }
  }

  function updateHeader() {
    const view = state.currentView;
    if (sectionTitle) {
      sectionTitle.textContent = view === 'venues' ? 'Venues' : 'Bookings';
    }
    if (sectionDescription) {
      sectionDescription.textContent = descriptions[view];
    }
    if (modalTriggerCopy) {
      modalTriggerCopy.textContent = view === 'venues' ? 'Add venue' : 'Add booking';
    }
  }

  function setView(view) {
    state.currentView = view;
    navButtons.forEach((button) => {
      if (button.dataset.view === view) {
        button.classList.add('is-active');
      } else {
        button.classList.remove('is-active');
      }
    });
    updateHeader();
    if (!state[view] || !state[view].length) {
      setLoading(true);
      render();
      fetchCollection(view);
    } else {
      setLoading(false);
      render();
    }
  }

  async function fetchCollection(type) {
    const url = type === 'venues' ? endpoints.venues : endpoints.bookings;
    try {
      setLoading(true);
      const response = await fetch(url, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error((payload && payload.errors && payload.errors[0]) || 'Failed to load data');
      }
      state[type] = payload.data || [];
      render();
      setLoading(false);
    } catch (error) {
      console.error(error);
      state.loading = false;
      showStatus('Unable to load data. Please try refreshing.');
      renderEmptyState([]);
    }
  }

  function openModal(context) {
    currentModalContext = context;
    modal.classList.remove('hidden');
    overlay.classList.remove('hidden');
    modalErrors.hidden = true;
    modalErrors.innerHTML = '';
    modalForm.reset();
    methodField.value = '';

    if (context.type === 'venues') {
      const venue = context.item || {};
      modalTitle.textContent = context.mode === 'create' ? 'Add venue' : 'Edit venue';
      modalSubmit.textContent = context.mode === 'create' ? 'Create venue' : 'Save changes';
      const facilitiesValue = Array.isArray(venue.facilities) ? venue.facilities.join(', ') : '';
      const imagePreview = venue.image_url
        ? `<div class="field">
              <label>Current image</label>
              <div class="image-preview" style="background-image: url('${escapeHtml(venue.image_url)}');"></div>
            </div>`
        : '';
      modalFields.innerHTML = `
        <div class="field">
          <label for="venue-title">Title</label>
          <input id="venue-title" name="title" required value="${escapeHtml(venue.title || '')}" />
        </div>
        <div class="field">
          <label for="venue-description">Description</label>
          <textarea id="venue-description" name="description" required>${escapeHtml(venue.description || '')}</textarea>
        </div>
        <div class="field">
          <label for="venue-facilities">Facilities</label>
          <input id="venue-facilities" name="facilities" placeholder="Wi-Fi, Parking, Catering" value="${escapeHtml(facilitiesValue)}" />
        </div>
        <div class="field">
          <label for="venue-price">Price</label>
          <input id="venue-price" name="price" type="number" min="0" step="1" required value="${escapeHtml(venue.price != null ? venue.price : '')}" />
        </div>
        <div class="field">
          <label for="venue-location">Location</label>
          <input id="venue-location" name="location" required value="${escapeHtml(venue.location || '')}" />
        </div>
        ${imagePreview}
        <div class="field">
          <label for="venue-image">Upload image</label>
          <input id="venue-image" name="image" type="file" ${context.mode === 'create' ? 'required' : ''} accept="image/*" />
        </div>
      `;
      modalSubmit.disabled = false;
    } else {
      const booking = context.item || {};
      modalTitle.textContent = context.mode === 'create' ? 'Add booking' : 'Edit booking';
      modalSubmit.textContent = context.mode === 'create' ? 'Create booking' : 'Save changes';
      if (!state.venues.length) {
        modalFields.innerHTML = `
          <p class="empty-modal-hint">
            Add at least one venue before creating bookings.
          </p>
        `;
        modalSubmit.disabled = true;
        return;
      }
      const venueOptions = state.venues
        .map((venue) => {
          const selected = booking.venue_id === venue.id ? 'selected' : '';
          return `<option value="${venue.id}" ${selected}>${escapeHtml(venue.title)}</option>`;
        })
        .join('');
      modalFields.innerHTML = `
        <div class="field">
          <label for="booking-username">Guest name</label>
          <input id="booking-username" name="username" required value="${escapeHtml(booking.username || '')}" />
        </div>
        <div class="field">
          <label for="booking-venue">Venue</label>
          <select id="booking-venue" name="venue" required>
            <option value="" disabled ${booking.venue_id ? '' : 'selected'}>Select a venue</option>
            ${venueOptions}
          </select>
        </div>
        <div class="checkbox-field">
          <input id="booking-paid" name="has_been_paid" type="checkbox" ${booking.has_been_paid ? 'checked' : ''} />
          <label for="booking-paid">Has been paid</label>
        </div>
        <div class="field">
          <label for="booking-start">Start date</label>
          <input id="booking-start" name="start_date" type="date" required value="${escapeHtml(booking.date && booking.date.start ? booking.date.start : '')}" />
        </div>
        <div class="field">
          <label for="booking-end">End date</label>
          <input id="booking-end" name="end_date" type="date" required value="${escapeHtml(booking.date && booking.date.end ? booking.date.end : '')}" />
        </div>
        <div class="field">
          <label for="booking-notes">Notes</label>
          <textarea id="booking-notes" name="notes">${escapeHtml(booking.notes || '')}</textarea>
        </div>
      `;
      modalSubmit.disabled = false;
    }

    if (context.mode === 'edit') {
      methodField.value = 'PUT';
    }
  }

  function closeModal() {
    modal.classList.add('hidden');
    overlay.classList.add('hidden');
    modalErrors.hidden = true;
    modalErrors.innerHTML = '';
    modalSubmit.disabled = false;
    currentModalContext = null;
  }

  function renderErrors(messages) {
    if (!modalErrors) {
      return;
    }
    if (!messages || !messages.length) {
      modalErrors.hidden = true;
      modalErrors.innerHTML = '';
      return;
    }
    const items = messages.map((message) => `<li>${escapeHtml(message)}</li>`).join('');
    modalErrors.innerHTML = `<ul>${items}</ul>`;
    modalErrors.hidden = false;
  }

  async function submitModal(event) {
    event.preventDefault();
    if (!currentModalContext) {
      return;
    }

    const { type, mode, item } = currentModalContext;
    const isEdit = mode === 'edit';
    const url = isEdit ? resolveDetailUrl(type, item.id) : endpoints[type];

    const formData = new FormData(modalForm);
    if (!methodField.value) {
      formData.delete('_method');
    }

    try {
      modalSubmit.disabled = true;
      modalSubmit.textContent = 'Saving…';
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
        renderErrors((payload && payload.errors) || ['Unable to save changes.']);
        modalSubmit.disabled = false;
        modalSubmit.textContent = isEdit ? 'Save changes' : `Create ${type === 'venues' ? 'venue' : 'booking'}`;
        return;
      }

      renderErrors([]);
      if (isEdit) {
        const collection = state[type];
        const index = collection.findIndex((entry) => entry.id === payload.data.id);
        if (index >= 0) {
          collection[index] = payload.data;
        }
      } else {
        state[type].push(payload.data);
      }
      closeModal();
      render();
      setLoading(false);
    } catch (error) {
      console.error(error);
      renderErrors(['Network error. Please try again.']);
    } finally {
      modalSubmit.disabled = false;
      modalSubmit.textContent = isEdit ? 'Save changes' : `Create ${type === 'venues' ? 'venue' : 'booking'}`;
    }
  }

  async function handleDelete(type, id) {
    const confirmation = window.confirm('Are you sure you want to delete this record?');
    if (!confirmation) {
      return;
    }
    const url = resolveDetailUrl(type, id);
    const formData = new FormData();
    formData.append('_method', 'DELETE');

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
        throw new Error((payload && payload.errors && payload.errors[0]) || 'Unable to delete record.');
      }
      state[type] = state[type].filter((entry) => entry.id !== id);
      render();
      setLoading(false);
    } catch (error) {
      alert(error.message);
    }
  }

  app.addEventListener('click', (event) => {
    const target = event.target.closest('[data-view], [data-open-modal], [data-close-modal], [data-edit], [data-delete]');
    if (!target) {
      return;
    }

    if (target.hasAttribute('data-view')) {
      const view = target.dataset.view;
      if (view && view !== state.currentView) {
        setView(view);
      }
      return;
    }

    if (target.hasAttribute('data-open-modal')) {
      const view = state.currentView;
      openModal({ type: view, mode: 'create' });
      return;
    }

    if (target.hasAttribute('data-close-modal')) {
      closeModal();
      return;
    }

    if (target.hasAttribute('data-edit')) {
      const type = target.dataset.type;
      const id = Number(target.dataset.id);
      const collection = state[type] || [];
      const item = collection.find((entry) => entry.id === id);
      if (item) {
        openModal({ type, mode: 'edit', item });
      }
      return;
    }

    if (target.hasAttribute('data-delete')) {
      const type = target.dataset.type;
      const id = Number(target.dataset.id);
      handleDelete(type, id);
    }
  });

  overlay.addEventListener('click', closeModal);
  modalForm.addEventListener('submit', submitModal);
  if (refreshButton) {
    refreshButton.addEventListener('click', () => {
      fetchCollection(state.currentView);
    });
  }

  setView('venues');
})();
