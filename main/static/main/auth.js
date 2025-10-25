(function () {
  const reduceMotionQuery =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
  const reduceMotion = reduceMotionQuery && reduceMotionQuery.matches;
  if (reduceMotion || typeof anime === 'undefined') {
    return;
  }

  const cards = document.querySelectorAll('.card');
  const formChildren = document.querySelectorAll('.auth-form > *');
  const clouds = document.querySelectorAll('.cloud');

  if (!cards.length && !formChildren.length && !clouds.length) {
    return;
  }

  if (cards.length) {
    anime.set(cards, { opacity: 0, translateY: 24 });
  }
  if (formChildren.length) {
    anime.set(formChildren, { opacity: 0, translateY: 16 });
  }
  if (clouds.length) {
    anime.set(clouds, { opacity: 0 });
  }

  requestAnimationFrame(() => {
    if (cards.length) {
      anime({
        targets: cards,
        opacity: 1,
        translateY: 0,
        easing: 'easeOutQuad',
        duration: 700,
        delay: anime.stagger(120),
      });
    }

    if (formChildren.length) {
      anime({
        targets: formChildren,
        opacity: 1,
        translateY: 0,
        easing: 'easeOutQuad',
        duration: 520,
        delay: anime.stagger(70, { start: 360 }),
      });
    }

    if (clouds.length) {
      anime({
        targets: clouds,
        opacity: 1,
        translateY: (element, index) => (index % 2 === 0 ? [-40, 0] : [40, 0]),
        easing: 'easeOutQuad',
        duration: 1200,
        delay: anime.stagger(140),
      });

      anime({
        targets: clouds,
        translateX: (element, index) => (index % 2 === 0 ? [-28, 28] : [28, -28]),
        translateY: (element, index) => (index % 2 === 0 ? [-12, 12] : [12, -12]),
        direction: 'alternate',
        easing: 'easeInOutSine',
        duration: 9000,
        loop: true,
        delay: 1600,
      });
    }
  });
})();

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
