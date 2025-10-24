(function () {
  const forms = document.querySelectorAll('form[data-ajax-form]');
  if (!forms.length) {
    return;
  }

  function getCsrfToken(form) {
    const csrfField = form.querySelector('input[name="csrfmiddlewaretoken"]');
    return csrfField ? csrfField.value : '';
  }

  function renderErrors(container, messages) {
    if (!container) {
      return;
    }
    if (!messages || !messages.length) {
      container.classList.remove('is-visible');
      container.innerHTML = '';
      return;
    }

    const items = messages.map((message) => `<li>${message}</li>`).join('');
    container.innerHTML = `<ul>${items}</ul>`;
    container.classList.add('is-visible');
  }

  forms.forEach((form) => {
    const submitButton = form.querySelector('button[type="submit"], input[type="submit"]');
    const defaultLabel = submitButton ? submitButton.innerHTML : '';
    const errorContainer = form.querySelector('[data-errors]');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!submitButton) {
        return;
      }

      renderErrors(errorContainer, []);
      submitButton.disabled = true;
      submitButton.dataset.originalLabel = defaultLabel;
      submitButton.innerHTML = 'Please wait…';

      const formData = new FormData(form);
      try {
        const response = await fetch(form.action, {
          method: 'POST',
          headers: {
            'X-CSRFToken': getCsrfToken(form),
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: formData,
        });

        const payload = await response.json();
        if (!response.ok || !payload.success) {
          const errors = payload && payload.errors ? payload.errors : ['Something went wrong. Try again.'];
          renderErrors(errorContainer, errors);
        } else {
          if (payload.redirect_url && form.hasAttribute('data-success-redirect')) {
            window.location.assign(payload.redirect_url);
            return;
          }
          renderErrors(errorContainer, []);
          submitButton.innerHTML = 'Success!';
        }
      } catch (error) {
        renderErrors(errorContainer, ['Network error. Please check your connection and try again.']);
      } finally {
        submitButton.disabled = false;
        if (submitButton.dataset.originalLabel) {
          submitButton.innerHTML = submitButton.dataset.originalLabel;
        }
      }
    });
  });
})();
