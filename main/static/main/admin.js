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
  };

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
  };

  function parseInitialData(id) {
    const script = document.getElementById(id);
    if (!script) {
      return [];
    }
    try {
      return JSON.parse(script.textContent);
    } catch (error) {
      console.error(`Failed to parse initial data for ${id}`, error);
      return [];
    }
  }

  state.venues = parseInitialData('initial-venues');
  state.bookings = parseInitialData('initial-bookings');

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
  const modalBackdrop = document.querySelector('[data-modal]');
  const modalTitle = document.getElementById('modal-title');
  const entityForm = document.getElementById('entity-form');
  const modalErrors = document.querySelector('[data-modal-errors]');
  const submitLabel = entityForm.querySelector('[data-submit-label]');
  const toast = document.getElementById('toast');
  const formSections = {
    venues: entityForm.querySelector('[data-form="venues"]'),
    bookings: entityForm.querySelector('[data-form="bookings"]'),
  };
  const venueSelect = entityForm.querySelector('select[name="venue"]');

  const originalRequirements = new WeakMap();

  Object.values(formSections).forEach((section) => {
    if (!section) {
      return;
    }
    section.querySelectorAll('input, select, textarea').forEach((field) => {
      originalRequirements.set(field, field.required);
    });
  });

  entityForm.setAttribute('novalidate', 'novalidate');

  function toggleFormSection(section, isActive) {
    if (!section) {
      return;
    }
    const fields = section.querySelectorAll('input, select, textarea');
    fields.forEach((field) => {
      const wasRequired = originalRequirements.get(field) || false;
      field.required = isActive && wasRequired;
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

  function getCsrfToken() {
    const cookie = document.cookie
      .split(';')
      .map((item) => item.trim())
      .find((item) => item.startsWith('csrftoken='));
    return cookie ? decodeURIComponent(cookie.split('=')[1]) : '';
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
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
    const hasItems = state[section] && state[section].length;
    const emptyState = emptyStates[section];
    if (!emptyState) {
      return;
    }
    emptyState.classList.toggle('is-visible', !hasItems);
  }

  function renderVenues() {
    venuesTableBody.innerHTML = '';
    const fragment = document.createDocumentFragment();
    state.venues.forEach((venue) => {
      const row = document.createElement('tr');

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
  }

  function renderBookings() {
    bookingsTableBody.innerHTML = '';
    const fragment = document.createDocumentFragment();

    state.bookings.forEach((booking) => {
      const row = document.createElement('tr');

      const guestCell = document.createElement('td');
      guestCell.textContent = booking.username;
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
  }

  function refreshTables() {
    renderVenues();
    renderBookings();
    updateVenueSelect();
    updateActionButton();
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
      const hasVenues = state.venues.length > 0;
      actionButton.disabled = !hasVenues;
      actionButton.title = hasVenues
        ? ''
        : 'Create a venue before adding bookings.';
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

    navButtons.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.target === section);
    });

    contentSections.forEach((contentSection) => {
      const isActive = contentSection.dataset.section === section;
      contentSection.classList.toggle('is-hidden', !isActive);
    });

    updateHeader(section);
    updateActionButton();
    refreshFromServer(section);
  }

  function clearForm() {
    entityForm.reset();
    if (entityForm.dataset.section === 'bookings') {
      entityForm.querySelector('input[name="has_been_paid"]').checked = false;
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

  function updateVenueSelect(selectedId) {
    if (!venueSelect) {
      return;
    }
    venueSelect.innerHTML = '';
    if (!state.venues.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Create a venue first';
      venueSelect.appendChild(option);
      venueSelect.disabled = true;
      return;
    }
    venueSelect.disabled = false;
    state.venues.forEach((venue) => {
      const option = document.createElement('option');
      option.value = venue.id;
      option.textContent = venue.title;
      if (selectedId && Number(selectedId) === Number(venue.id)) {
        option.selected = true;
      }
      venueSelect.appendChild(option);
    });
    if (selectedId === undefined && state.venues.length) {
      venueSelect.value = state.venues[0].id;
    }
  }

  function openModal(mode, section, recordId) {
    state.modalMode = mode;
    state.editingId = recordId || null;
    entityForm.dataset.mode = mode;
    entityForm.dataset.section = section;
    entityForm.dataset.recordId = recordId || '';

    setActiveFormSection(section);

    clearForm();
    clearErrors();

    if (section === 'bookings') {
      updateVenueSelect();
    }

    if (mode === 'edit' && recordId) {
      if (section === 'venues') {
        const venue = state.venues.find((item) => Number(item.id) === Number(recordId));
        if (venue) {
          entityForm.querySelector('input[name="title"]').value = venue.title;
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
          entityForm.querySelector('input[name="username"]').value = booking.username || '';
          updateVenueSelect(booking.venue ? booking.venue.id : undefined);
          entityForm.querySelector('input[name="start_date"]').value = booking.start_date;
          entityForm.querySelector('input[name="end_date"]').value = booking.end_date;
          entityForm.querySelector('input[name="has_been_paid"]').checked = Boolean(booking.has_been_paid);
          entityForm.querySelector('textarea[name="notes"]').value = booking.notes || '';
        }
      }
    } else if (section === 'bookings') {
      updateVenueSelect();
    }

    modalTitle.textContent = mode === 'edit'
      ? `Edit ${sectionConfig[section].title.slice(0, -1)}`
      : `Add ${sectionConfig[section].title.slice(0, -1)}`;
    submitLabel.textContent = mode === 'edit' ? 'Update' : 'Create';

    modalBackdrop.hidden = false;
    modalBackdrop.setAttribute('aria-hidden', 'false');
  }

  function closeModal() {
    modalBackdrop.hidden = true;
    modalBackdrop.setAttribute('aria-hidden', 'true');
    state.editingId = null;
  }

  async function refreshFromServer(section) {
    const endpoint = endpoints[section];
    if (!endpoint) {
      return;
    }
    try {
      const response = await fetch(endpoint.list, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });
      if (!response.ok) {
        throw new Error('Failed to refresh');
      }
      const payload = await response.json();
      if (!payload.success) {
        return;
      }
      state[section] = payload.data;
      if (section === 'venues') {
        renderVenues();
        updateVenueSelect();
        if (state.currentSection === 'bookings') {
          // bookings might depend on venues for their display
          renderBookings();
        }
      } else if (section === 'bookings') {
        renderBookings();
      }
      updateActionButton();
    } catch (error) {
      console.error(error);
      showToast('Unable to refresh data right now.');
    }
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
    submitButton.disabled = true;
    submitButton.classList.add('is-loading');
    clearErrors();

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
        if (mode === 'edit') {
          state.venues = state.venues.map((item) => (Number(item.id) === Number(payload.data.id) ? payload.data : item));
        } else {
          state.venues.unshift(payload.data);
        }
        renderVenues();
        updateVenueSelect();
        updateActionButton();
        state.bookings = state.bookings.map((booking) => {
          if (booking.venue && Number(booking.venue.id) === Number(payload.data.id)) {
            return {
              ...booking,
              venue: {
                ...booking.venue,
                title: payload.data.title,
              },
            };
          }
          return booking;
        });
        renderBookings();
      } else if (section === 'bookings') {
        if (mode === 'edit') {
          state.bookings = state.bookings.map((item) => (Number(item.id) === Number(payload.data.id) ? payload.data : item));
        } else {
          state.bookings.unshift(payload.data);
        }
        renderBookings();
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
      if (section === 'venues') {
        state.venues = state.venues.filter((item) => Number(item.id) !== Number(recordId));
        state.bookings = state.bookings.filter((item) => item.venue && Number(item.venue.id) !== Number(recordId));
        renderVenues();
        renderBookings();
        updateVenueSelect();
      } else if (section === 'bookings') {
        state.bookings = state.bookings.filter((item) => Number(item.id) !== Number(recordId));
        renderBookings();
      }
      toggleEmptyState(section);
      updateActionButton();
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
    button.addEventListener('click', closeModal);
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

  renderVenues();
  renderBookings();
  updateHeader(state.currentSection);
  updateActionButton();
  refreshFromServer('venues');
  refreshFromServer('bookings');
})();
