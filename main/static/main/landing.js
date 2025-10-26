const PAGE_FRAGMENT_SELECTOR = "[data-page-fragment]";
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const formatCurrency = (value) => {
  if (!Number.isFinite(Number(value))) {
    return "Rp 0";
  }
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value));
};

const parseISODate = (value) => {
  if (!value || typeof value !== "string") {
    return null;
  }
  const parts = value.split("-").map((segment) => Number(segment));
  if (parts.length < 3) {
    return null;
  }
  const [year, month, day] = parts;
  if (!year || !month || !day) {
    return null;
  }
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
};

const formatDateRange = (start, end) => {
  if (!(start instanceof Date) || Number.isNaN(start.getTime())) {
    return "";
  }
  if (!(end instanceof Date) || Number.isNaN(end.getTime())) {
    return formatDate(start);
  }
  if (start.getTime() === end.getTime()) {
    return formatDate(start);
  }
  return `${formatDate(start)} – ${formatDate(end)}`;
};

const clampRatingValue = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.min(Math.max(numeric, 0), 5);
};

const formatRatingValue = (value) => {
  const numeric = clampRatingValue(value);
  if (!numeric) {
    return "0";
  }
  return Number.isInteger(numeric) ? `${numeric}` : numeric.toFixed(1);
};

const updateStarRatingGroup = (group) => {
  if (!group) {
    return;
  }
  const inputs = Array.from(group.querySelectorAll("input[type='radio']"));
  if (!inputs.length) {
    return;
  }
  let checked = inputs.find((input) => input.checked);
  if (!checked) {
    const sorted = [...inputs].sort((a, b) => Number(b.value) - Number(a.value));
    checked = sorted.find((input) => !Number.isNaN(Number(input.value)));
    if (checked) {
      checked.checked = true;
    } else {
      inputs[0].checked = true;
      checked = inputs[0];
    }
  }
  const numeric = clampRatingValue(checked?.value);
  group.style.setProperty("--rating", numeric);
  const root = group.closest("[data-star-rating-root]") || group;
  const output = root.querySelector("[data-star-rating-output]");
  if (output) {
    output.textContent = numeric
      ? `${formatRatingValue(numeric)} / 5`
      : "0 / 5";
  }
};

const initStarRatingGroups = (root = document) => {
  const groups = root.querySelectorAll?.("[data-star-rating]") || [];
  groups.forEach((group) => {
    if (group.dataset.initialized === "true") {
      updateStarRatingGroup(group);
      return;
    }
    group.dataset.initialized = "true";
    group.addEventListener("change", (event) => {
      if (event.target && event.target.matches("input[type='radio']")) {
        updateStarRatingGroup(group);
      }
    });
    group.addEventListener("focusin", () => {
      group.classList.add("has-focus");
    });
    group.addEventListener("focusout", () => {
      group.classList.remove("has-focus");
    });
    updateStarRatingGroup(group);
  });
};

const setStarRatingValue = (root, value) => {
  if (!root) {
    return;
  }
  const group = root.querySelector?.("[data-star-rating]");
  if (!group) {
    return;
  }
  const inputs = Array.from(group.querySelectorAll("input[type='radio']"));
  if (!inputs.length) {
    return;
  }
  const values = inputs
    .map((input) => Number(input.value))
    .filter((numeric) => Number.isFinite(numeric));
  const defaultValue = values.length ? Math.max(...values) : null;
  const numericValue = value == null ? null : clampRatingValue(value);
  const targetValue =
    numericValue === null || Number.isNaN(numericValue)
      ? defaultValue
      : Math.round(numericValue);
  let matched = false;
  inputs.forEach((input) => {
    const numeric = Number(input.value);
    const shouldCheck =
      Number.isFinite(numeric) && targetValue !== null && numeric === targetValue;
    input.checked = shouldCheck;
    if (shouldCheck) {
      matched = true;
    }
  });
  if (!matched && inputs.length) {
    inputs[0].checked = true;
  }
  updateStarRatingGroup(group);
};

const syncStarRatingOutputs = (root) => {
  if (!root) {
    return;
  }
  const groups = root.querySelectorAll?.("[data-star-rating]") || [];
  groups.forEach((group) => updateStarRatingGroup(group));
};

const applyReadOnlyStars = (element, value) => {
  if (!element) {
    return;
  }
  const numeric = clampRatingValue(value);
  element.style.setProperty("--rating", numeric);
  if (numeric <= 0) {
    element.classList.add("is-empty");
  } else {
    element.classList.remove("is-empty");
  }
};

const submitForm = async (url, formData) => {
  const response = await fetch(url, {
    method: "POST",
    body: formData,
    credentials: "same-origin",
    headers: {
      "X-Requested-With": "XMLHttpRequest",
    },
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch (error) {
    payload = {};
  }

  const success = payload && payload.success !== false && response.ok;
  if (!success) {
    const errors = Array.isArray(payload?.errors)
      ? payload.errors
      : payload?.errors
      ? [payload.errors]
      : ["We couldn't complete that request. Please try again."];
    const error = new Error(errors[0] || "Request failed");
    error.errors = errors;
    error.payload = payload;
    throw error;
  }

  return payload;
};

const createIntersectionObserver = () =>
  new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.25 }
  );

document.addEventListener("DOMContentLoaded", () => {
  const mainContainer = document.querySelector(".landing-main");
  const body = document.body;
  const parser = new DOMParser();
  const observer = createIntersectionObserver();
  let parallaxItems = Array.from(document.querySelectorAll("[data-parallax]"));
  let isNavigating = false;
  let lastRequestedUrl = window.location.pathname + window.location.search;

  const registerAnimatedElements = (root = document) => {
    root.querySelectorAll("[data-animate]").forEach((element) => {
      if (!element.classList.contains("is-visible")) {
        observer.observe(element);
      }
    });
  };

  const animateCounters = (root = document) => {
    const counters = root.querySelectorAll("[data-counter]");
    if (typeof anime === "function") {
      counters.forEach((counter, index) => {
        if (counter.dataset.animated === "true") {
          return;
        }
        const finalValue = Number(counter.dataset.counter || counter.textContent || 0);
        counter.dataset.animated = "true";
        anime({
          targets: counter,
          innerHTML: [0, finalValue],
          easing: "easeOutExpo",
          round: 1,
          duration: 1800,
          delay: index * 140,
          update: (anim) => {
            counter.setAttribute(
              "aria-label",
              `${Math.round(anim.animations[0].currentValue)} metric value`
            );
          },
        });
      });
    } else {
      counters.forEach((counter) => {
        if (counter.dataset.animated === "true") {
          return;
        }
        counter.dataset.animated = "true";
        counter.textContent = counter.dataset.counter || counter.textContent;
      });
    }
  };

  const refreshParallaxItems = (root = document) => {
    const newItems = Array.from(root.querySelectorAll("[data-parallax]"));
    parallaxItems = Array.from(new Set([...parallaxItems, ...newItems]));
  };

  const applyParallax = (event) => {
    const { innerWidth, innerHeight } = window;
    const x = (event.clientX / innerWidth - 0.5) * 2;
    const y = (event.clientY / innerHeight - 0.5) * 2;
    parallaxItems.forEach((item) => {
      const intensity = parseFloat(item.dataset.parallax || "8");
      item.style.transform = `translate3d(${x * intensity}px, ${y * intensity}px, 0)`;
    });
  };

  window.addEventListener("mousemove", applyParallax);

  const floatingNav = document.querySelector(".floating-nav");
  let closeFloatingMenu = () => {};

  if (floatingNav) {
    const navMenuButton = floatingNav.querySelector(".floating-nav__menu");
    let lastScrollY = window.scrollY;
    let scheduled = false;

    closeFloatingMenu = () => {
      floatingNav.classList.remove("is-open");
      if (navMenuButton) {
        navMenuButton.setAttribute("aria-expanded", "false");
      }
    };

    const updateNavVisibility = () => {
      const currentY = window.scrollY;
      const isScrollingDown = currentY > lastScrollY;

      if (currentY <= 12) {
        floatingNav.classList.remove("is-visible");
        closeFloatingMenu();
      } else if (isScrollingDown) {
        floatingNav.classList.add("is-visible");
      } else {
        floatingNav.classList.remove("is-visible");
        closeFloatingMenu();
      }

      lastScrollY = currentY;
      scheduled = false;
    };

    const requestUpdate = () => {
      if (!scheduled) {
        scheduled = true;
        window.requestAnimationFrame(updateNavVisibility);
      }
    };

    window.addEventListener("scroll", requestUpdate, { passive: true });

    if (navMenuButton) {
      navMenuButton.setAttribute("aria-expanded", "false");
      navMenuButton.addEventListener("click", () => {
        const isOpen = floatingNav.classList.toggle("is-open");
        navMenuButton.setAttribute("aria-expanded", String(isOpen));
      });
    }
  }

  const applyPageMetadata = (fragment) => {
    const title = fragment.dataset.pageTitle;
    const pageKey = fragment.dataset.page;
    if (title) {
      document.title = `${title} · Ragaspace Experience`;
    }
    if (pageKey) {
      body.setAttribute("data-active-page", pageKey);
    }
  };

  const finalizeFragment = (fragment) => {
    registerAnimatedElements(fragment);
    animateCounters(fragment);
    refreshParallaxItems(fragment);
    attachAjaxLinks(fragment);
    attachScrollLinks(fragment);
    initVenuesPage(fragment);
    initVenueDetailPage(fragment);
    applyPageMetadata(fragment);
  };

  const swapFragment = (fragment, url, { pushState = true, transition = "slide", onComplete } = {}) => {
    if (!mainContainer) {
      window.location.href = url;
      return;
    }

    fragment.classList.add("page-fragment", `page-fragment--${transition}`);
    fragment.classList.add("is-transitioning");

    const current = mainContainer.querySelector(PAGE_FRAGMENT_SELECTOR);
    if (current) {
      current.classList.add("is-exiting");
      current.addEventListener(
        "transitionend",
        () => {
          current.remove();
        },
        { once: true }
      );
    }

    mainContainer.appendChild(fragment);

    requestAnimationFrame(() => {
      fragment.classList.add("is-active");
      fragment.classList.remove("is-transitioning");
      fragment.addEventListener(
        "transitionend",
        () => {
          fragment.classList.remove(`page-fragment--${transition}`);
          if (typeof onComplete === "function") {
            onComplete();
          }
        },
        { once: true }
      );
    });

    if (pushState) {
      history.pushState({ url }, "", url);
    }

    finalizeFragment(fragment);
  };

  const parseFragmentFromHTML = (html) => {
    const doc = parser.parseFromString(html, "text/html");
    const fragment = doc.querySelector(PAGE_FRAGMENT_SELECTOR);
    return fragment ? fragment : null;
  };

  const fetchFragment = async (url) => {
    const response = await fetch(url, {
      headers: {
        "X-Requested-With": "XMLHttpRequest",
      },
      credentials: "same-origin",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}`);
    }

    const html = await response.text();
    const fragment = parseFragmentFromHTML(html);

    if (!fragment) {
      throw new Error("Fragment missing");
    }

    return fragment;
  };

  const navigate = async (url, { transition = "slide", pushState = true, onComplete } = {}) => {
    if (isNavigating) {
      return;
    }

    isNavigating = true;
    lastRequestedUrl = url;
    body.classList.add("is-transitioning");

    try {
      const fragment = await fetchFragment(url);
      swapFragment(fragment, url, { transition, pushState, onComplete });
    } catch (error) {
      window.location.href = url;
    } finally {
      window.setTimeout(() => body.classList.remove("is-transitioning"), 320);
      isNavigating = false;
    }
  };

  const attachAjaxLinks = (root = document) => {
    root.querySelectorAll("[data-ajax-nav]").forEach((link) => {
      if (link.dataset.ajaxBound === "true") {
        return;
      }
      link.dataset.ajaxBound = "true";
      link.addEventListener("click", (event) => {
        const url = link.getAttribute("href");
        if (!url) {
          return;
        }
        event.preventDefault();
        closeFloatingMenu();
        const transition = link.dataset.transition || "slide";
        navigate(url, { transition });
      });
    });
  };

  const attachScrollLinks = (root = document) => {
    root.querySelectorAll("[data-scroll-home]").forEach((link) => {
      if (link.dataset.scrollBound === "true") {
        return;
      }
      link.dataset.scrollBound = "true";
      link.addEventListener("click", (event) => {
        const url = link.getAttribute("href") || "";
        const isHome = body.getAttribute("data-active-page") === "home";
        if (isHome) {
          const hero = document.querySelector("#home");
          if (hero) {
            event.preventDefault();
            hero.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        } else if (url) {
          event.preventDefault();
          navigate(url, {
            transition: "slide",
            onComplete: () => {
              const hero = document.querySelector("#home");
              if (hero) {
                hero.scrollIntoView({ behavior: "smooth", block: "start" });
              }
            },
          });
        }
      });
    });
  };

  const initVenuesPage = (root = document) => {
    const page = root.matches?.(".venues-page") ? root : root.querySelector?.(".venues-page");
    if (!page || page.dataset.initialised === "true") {
      return;
    }

    const form = page.querySelector("[data-venues-search]");
    const input = page.querySelector("[data-venues-input]");
    const cards = Array.from(page.querySelectorAll(".venue-card"));
    const countEl = page.querySelector("[data-venues-count]");
    const emptyState = page.querySelector("[data-venues-empty]");
    const grid = page.querySelector("[data-venues-grid]");
    const meta = page.querySelector("[data-venues-meta]");
    const tokensList = page.querySelector("[data-venues-tokens]");
    const filterLabel = page.querySelector("[data-venues-filter-label]");
    const matchedEl = page.querySelector("[data-venues-matched]");
    const totalEl = page.querySelector("[data-venues-total]");
    const queryEl = page.querySelector("[data-venues-query]");
    const totalAvailable = Number(meta?.dataset.total || totalEl?.textContent || cards.length);
    let lastQuery = "";

    if (totalEl) {
      totalEl.textContent = String(totalAvailable);
    }

    const playGridAnimation = (className, { removeAfter = false } = {}) => {
      if (!grid) {
        return;
      }

      grid.classList.remove(className);
      // Force reflow so the animation retriggers when the class is re-added.
      void grid.offsetWidth;
      grid.classList.add(className);

      if (removeAfter) {
        window.setTimeout(() => {
          grid.classList.remove(className);
        }, 620);
      }
    };

    const renderTokens = (keywords) => {
      if (!tokensList) {
        return;
      }

      if (!keywords.length) {
        tokensList.innerHTML = "";
        tokensList.classList.remove("is-active");
        tokensList.setAttribute("aria-hidden", "true");
        return;
      }

      const fragment = document.createDocumentFragment();
      keywords.forEach((keyword, index) => {
        const token = document.createElement("li");
        token.textContent = keyword;
        token.style.setProperty("--token-index", String(index));
        fragment.appendChild(token);
      });

      tokensList.innerHTML = "";
      tokensList.appendChild(fragment);
      tokensList.classList.add("is-active");
      tokensList.setAttribute("aria-hidden", "false");
    };

    const updateMetaState = (rawKeywords, matches) => {
      if (countEl) {
        countEl.textContent = String(matches);
      }
      if (matchedEl) {
        matchedEl.textContent = String(matches);
      }
      if (totalEl) {
        totalEl.textContent = String(totalAvailable);
      }
      if (queryEl) {
        if (rawKeywords.length) {
          queryEl.textContent = rawKeywords
            .map((keyword) => `#${keyword}`)
            .join("  ·  ");
        } else {
          queryEl.textContent = "";
        }
      }
      if (filterLabel) {
        filterLabel.setAttribute("aria-hidden", rawKeywords.length > 0 ? "false" : "true");
      }
      if (meta) {
        meta.classList.toggle("is-filtering", rawKeywords.length > 0);
        meta.dataset.matches = String(matches);
        meta.dataset.keywords = rawKeywords.join(" ");
      }
    };

    const filterCards = () => {
      const rawValue = input?.value || "";
      const rawQuery = rawValue.trim();
      const rawKeywords = rawQuery ? rawQuery.split(/\s+/).filter(Boolean) : [];
      const keywords = rawKeywords.map((keyword) => keyword.toLowerCase());
      let matches = 0;
      const hasQueryChanged = rawQuery !== lastQuery;
      lastQuery = rawQuery;

      cards.forEach((card) => {
        const haystack = card.dataset.searchText || "";
        const isMatch = keywords.every((keyword) => haystack.includes(keyword));
        card.classList.toggle("is-hidden", !isMatch);
        if (isMatch) {
          card.style.setProperty("--stagger-index", String(matches));
          card.classList.add("is-revealed");
          matches += 1;
        } else {
          card.classList.remove("is-revealed");
          card.style.removeProperty("--stagger-index");
        }
      });

      renderTokens(rawKeywords);
      updateMetaState(rawKeywords, matches);

      if (emptyState) {
        const shouldShowEmptyState = rawKeywords.length > 0 && matches === 0;
        emptyState.hidden = !shouldShowEmptyState;
      }
      if (grid) {
        grid.classList.toggle("is-filtering", rawKeywords.length > 0);
        grid.dataset.matches = String(matches);
        if (hasQueryChanged && rawKeywords.length > 0) {
          playGridAnimation("is-searching", { removeAfter: true });
        } else if (hasQueryChanged && rawKeywords.length === 0) {
          playGridAnimation("is-entering", { removeAfter: true });
        }
      }
    };

    if (form) {
      form.addEventListener("submit", (event) => event.preventDefault());
    }

    if (input) {
      input.addEventListener("input", () => {
        window.requestAnimationFrame(filterCards);
      });
    }

    filterCards();
    const triggerInitialEntrance = () => {
      playGridAnimation("is-entering", { removeAfter: true });
    };

    if (page.classList.contains("is-active")) {
      window.requestAnimationFrame(triggerInitialEntrance);
    } else {
      const handleTransitionEnd = (event) => {
        if (event.target === page && event.propertyName === "transform") {
          page.removeEventListener("transitionend", handleTransitionEnd);
          triggerInitialEntrance();
        }
      };
      page.addEventListener("transitionend", handleTransitionEnd);
    }

    page.dataset.initialised = "true";
  };

  const initVenueDetailPage = (root = document) => {
    const page = root.matches?.(".venue-detail")
      ? root
      : root.querySelector?.(".venue-detail");
    if (!page || page.dataset.initialised === "true") {
      return;
    }

    const price = Number(page.dataset.price || 0) || 0;
    const commentUpdateTemplate = page.dataset.commentUpdateTemplate || "";
    const commentDeleteTemplate = page.dataset.commentDeleteTemplate || "";
    const bookingForm = page.querySelector("[data-booking-form]");
    const bookingError = page.querySelector("[data-booking-error]");
    const bookingModal = page.querySelector("[data-booking-modal]");
    const bookingModalError = bookingModal?.querySelector("[data-booking-modal-error]");
    const bookingConfirmButton = bookingModal?.querySelector("[data-booking-confirm]");
    const bookingSummary = bookingModal
      ? {
          dates: bookingModal.querySelector('[data-booking-summary="dates"]'),
          nights: bookingModal.querySelector('[data-booking-summary="nights"]'),
          subtotal: bookingModal.querySelector('[data-booking-summary="subtotal"]'),
        }
      : { dates: null, nights: null, subtotal: null };
    const commentForm = page.querySelector("[data-comment-form]");
    const commentError = page.querySelector("[data-comment-error]");
    const commentList = page.querySelector("[data-comment-list]");
    const commentEmptyState = page.querySelector("[data-comment-empty]");
    const commentCountBadge = page.querySelector("[data-comment-count]");
    const commentEditModal = page.querySelector("[data-comment-modal]");
    const commentEditForm = commentEditModal?.querySelector("[data-comment-edit-form]");
    const commentModalError = commentEditModal?.querySelector("[data-comment-modal-error]");
    const commentSaveButton = commentEditModal?.querySelector("[data-comment-save]");
    const ratingDisplay = page.querySelector("[data-rating-display]");
    const ratingValueEl = page.querySelector("[data-rating-value]");
    const ratingStarsEl = page.querySelector("[data-rating-stars]");
    const ratingCountEl = page.querySelector("[data-rating-count]");

    initStarRatingGroups(page);

    let datasetParsedSuccessfully = false;

    const parseComments = () => {
      datasetParsedSuccessfully = false;
      const raw = page.dataset.comments || "[]";
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          datasetParsedSuccessfully = true;
          return parsed.map((item) => {
            const numericId = Number(item?.id);
            const id = Number.isNaN(numericId) ? item?.id : numericId;
            const ratingValue = Number(item?.rating);
            return {
              id,
              rating: Number.isNaN(ratingValue) ? 0 : ratingValue,
              comment: item?.comment || "",
              date: item?.date || "",
              user: item?.user || null,
              canEdit: Boolean(item?.can_edit ?? item?.canEdit),
              canDelete: Boolean(item?.can_delete ?? item?.canDelete),
            };
          });
        }
      } catch (error) {
        datasetParsedSuccessfully = false;
      }
      return [];
    };

    let commentsState = parseComments();
    if (!commentsState.length && commentList) {
      const fallback = Array.from(commentList.querySelectorAll(".comment-card")).map(
        (card) => {
          const numericId = Number(card.dataset.commentId);
          const ratingValue = Number(card.dataset.commentRating || card.dataset.rating);
          const commentText =
            card.dataset.commentText ||
            card.querySelector(".comment-card__body")?.textContent ||
            "";
          const dateValue =
            card.dataset.commentDate ||
            card.querySelector(".comment-card__date")?.dateTime ||
            card.querySelector(".comment-card__date")?.textContent ||
            "";
          const authorName =
            card.dataset.commentUser ||
            card.querySelector(".comment-card__author")?.textContent ||
            "";
          return {
            id: Number.isNaN(numericId) ? card.dataset.commentId || "" : numericId,
            rating: Number.isNaN(ratingValue) ? 0 : ratingValue,
            comment: commentText,
            date: dateValue,
            user: authorName ? { display_name: authorName } : null,
            canEdit: card.dataset.commentCanEdit === "true",
            canDelete: card.dataset.commentCanDelete === "true",
          };
        }
      );
      if (fallback.length) {
        commentsState = fallback;
        datasetParsedSuccessfully = true;
      }
    }
    const openModals = new Set();
    let pendingBookingData = null;

    const getCSRFTokenValue = () =>
      page.querySelector("input[name='csrfmiddlewaretoken']")?.value || "";

    const showMessage = (element, message) => {
      if (!element) {
        return;
      }
      if (!message) {
        element.hidden = true;
        element.textContent = "";
      } else {
        element.hidden = false;
        element.textContent = message;
      }
    };

    const replaceCommentId = (template, id) => {
      if (!template) {
        return "";
      }
      return template.replace(/\/0\//, `/${id}/`);
    };

    const getErrorMessage = (error) => {
      if (!error) {
        return "Something went wrong.";
      }
      if (Array.isArray(error.errors) && error.errors.length) {
        return error.errors.join(" ");
      }
      if (typeof error.message === "string" && error.message) {
        return error.message;
      }
      return "Something went wrong.";
    };

    const openModal = (modal) => {
      if (!modal || openModals.has(modal)) {
        return;
      }
      modal.hidden = false;
      requestAnimationFrame(() => {
        modal.classList.add("is-visible");
      });
      openModals.add(modal);
      document.body.classList.add("modal-open");
    };

    const closeModal = (modal) => {
      if (!modal || !openModals.has(modal)) {
        return;
      }
      openModals.delete(modal);
      modal.classList.remove("is-visible");
      const finalize = () => {
        modal.hidden = true;
        if (!openModals.size) {
          document.body.classList.remove("modal-open");
        }
      };
      modal.addEventListener(
        "transitionend",
        (event) => {
          if (event.target === modal) {
            finalize();
          }
        },
        { once: true }
      );
      window.setTimeout(() => {
        if (!modal.hidden) {
          finalize();
        }
      }, 320);
    };

    const updateRatingMeta = (meta) => {
      const averageRaw = meta?.average_rating ?? meta?.averageRating ?? null;
      const countRaw = meta?.count ?? meta?.rating_count ?? meta?.ratingCount;
      const average = Number.isFinite(Number(averageRaw)) ? Number(averageRaw) : null;
      const count = Number.isFinite(Number(countRaw))
        ? Number(countRaw)
        : commentsState.length;

      if (ratingValueEl) {
        if (average !== null && average > 0) {
          ratingValueEl.textContent = formatRatingValue(average);
          ratingValueEl.dataset.empty = "false";
        } else {
          ratingValueEl.textContent = "Not yet rated";
          ratingValueEl.dataset.empty = "true";
        }
      } else if (ratingDisplay) {
        ratingDisplay.textContent =
          average !== null && average > 0
            ? `${formatRatingValue(average)} / 5`
            : "Not yet rated";
      }

      if (ratingStarsEl) {
        applyReadOnlyStars(ratingStarsEl, average ?? 0);
      } else if (ratingDisplay) {
        applyReadOnlyStars(ratingDisplay, average ?? 0);
      }

      if (ratingCountEl) {
        ratingCountEl.textContent = String(Math.max(count, 0));
      }

      page.dataset.averageRating = average !== null ? String(average) : "";
      page.dataset.ratingCount = String(Math.max(count, 0));

      if (commentCountBadge) {
        const displayCount = Math.max(count, commentsState.length);
        commentCountBadge.textContent = displayCount
          ? `${displayCount} ${displayCount === 1 ? "comment" : "comments"}`
          : "No comments yet";
      }
    };

    const createCommentElement = (item) => {
      const listItem = document.createElement("li");
      listItem.className = "comment-card";
      listItem.dataset.commentId = String(item.id);
      listItem.dataset.commentRating = String(item.rating ?? "");
      listItem.dataset.commentText = item.comment ?? "";
      listItem.dataset.commentDate = item.date ?? "";

      const header = document.createElement("div");
      header.className = "comment-card__header";

      const meta = document.createElement("div");
      meta.className = "comment-card__meta";

      const name = document.createElement("span");
      name.className = "comment-card__author";
      const user = item.user || {};
      const userName =
        user.display_name || user.full_name || user.username || "PitchPilot player";
      name.textContent = userName;
      listItem.dataset.commentUser = userName;

      const dateEl = document.createElement("time");
      dateEl.className = "comment-card__date";
      const parsedDate = parseISODate(item.date);
      if (parsedDate) {
        dateEl.dateTime = item.date;
        dateEl.textContent = formatDate(parsedDate);
      } else {
        dateEl.textContent = item.date || "";
      }

      meta.appendChild(name);
      meta.appendChild(dateEl);

      const rating = document.createElement("div");
      rating.className = "comment-card__rating";

      const ratingStars = document.createElement("div");
      ratingStars.className = "rating-stars rating-stars--sm";
      ratingStars.setAttribute("aria-hidden", "true");
      applyReadOnlyStars(ratingStars, item.rating);

      const ratingValue = document.createElement("span");
      ratingValue.className = "comment-card__rating-value";
      ratingValue.textContent = `${formatRatingValue(item.rating)} / 5`;

      header.appendChild(meta);
      rating.appendChild(ratingStars);
      rating.appendChild(ratingValue);
      header.appendChild(rating);

      const body = document.createElement("p");
      body.className = "comment-card__body";
      body.textContent = item.comment;

      listItem.appendChild(header);
      listItem.appendChild(body);

      listItem.dataset.commentCanEdit = item.canEdit ? "true" : "false";
      listItem.dataset.commentCanDelete = item.canDelete ? "true" : "false";

      if (item.canEdit || item.canDelete) {
        const actions = document.createElement("div");
        actions.className = "comment-card__actions";

        if (item.canEdit && commentEditModal && commentEditForm && commentSaveButton) {
          const editButton = document.createElement("button");
          editButton.type = "button";
          editButton.textContent = "Edit";
          editButton.addEventListener("click", () => {
            commentModalError && showMessage(commentModalError, "");
            commentEditForm.reset();
            const commentField = commentEditForm.querySelector("textarea[name='comment']");
            if (commentField) {
              commentField.value = item.comment;
            }
            setStarRatingValue(commentEditForm, item.rating);
            syncStarRatingOutputs(commentEditForm);
            commentEditForm.dataset.commentId = String(item.id);
            openModal(commentEditModal);
          });
          actions.appendChild(editButton);
        }

        if (item.canDelete) {
          const deleteButton = document.createElement("button");
          deleteButton.type = "button";
          deleteButton.textContent = "Delete";
          deleteButton.addEventListener("click", async () => {
            if (!window.confirm("Are you sure you want to delete this comment?")) {
              return;
            }
            const url = replaceCommentId(commentDeleteTemplate, item.id);
            if (!url) {
              return;
            }
            const csrfToken = getCSRFTokenValue();
            if (!csrfToken) {
              window.alert("Missing security token. Please refresh the page and try again.");
              return;
            }
            const formData = new FormData();
            formData.append("csrfmiddlewaretoken", csrfToken);
            try {
              const response = await submitForm(url, formData);
              commentsState = commentsState.filter(
                (comment) => String(comment.id) !== String(item.id)
              );
              datasetParsedSuccessfully = true;
              updateRatingMeta(response.meta || {});
              refreshComments();
            } catch (error) {
              window.alert(getErrorMessage(error));
            }
          });
          actions.appendChild(deleteButton);
        }

        listItem.appendChild(actions);
      }

      return listItem;
    };

    const refreshComments = () => {
      const shouldPreserveInitial =
        !datasetParsedSuccessfully &&
        commentsState.length === 0 &&
        commentList &&
        commentList.children.length > 0;

      if (shouldPreserveInitial) {
        if (commentEmptyState) {
          commentEmptyState.hidden = true;
        }
        return;
      }

      if (commentList) {
        commentList.innerHTML = "";
        commentsState.forEach((item) => {
          commentList.appendChild(createCommentElement(item));
        });
      }
      if (commentEmptyState) {
        commentEmptyState.hidden = commentsState.length > 0;
      }
      if (commentCountBadge) {
        const count = Math.max(
          commentsState.length,
          Number(page.dataset.ratingCount || 0)
        );
        commentCountBadge.textContent = count
          ? `${count} ${count === 1 ? "comment" : "comments"}`
          : "No comments yet";
      }
    };

    if (commentForm) {
      commentForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        showMessage(commentError, "");
        const formData = new FormData(commentForm);
        try {
          const response = await submitForm(commentForm.action, formData);
          if (response.data) {
            const numericId = Number(response.data.id);
            const newComment = {
              id: Number.isNaN(numericId) ? response.data.id : numericId,
              rating: Number(response.data.rating) || 0,
              comment: response.data.comment || "",
              date: response.data.date || "",
              user: response.data.user || null,
              canEdit: Boolean(response.data.can_edit ?? response.data.canEdit),
              canDelete: Boolean(response.data.can_delete ?? response.data.canDelete),
            };
            commentsState = [newComment, ...commentsState];
            datasetParsedSuccessfully = true;
            commentForm.reset();
            setStarRatingValue(commentForm, null);
            syncStarRatingOutputs(commentForm);
          }
          updateRatingMeta(response.meta || {});
          refreshComments();
        } catch (error) {
          showMessage(commentError, getErrorMessage(error));
        }
      });
    }

    if (commentSaveButton && commentEditForm && commentEditModal) {
      commentSaveButton.addEventListener("click", async () => {
        showMessage(commentModalError, "");
        const targetId = commentEditForm.dataset.commentId;
        if (!targetId) {
          return;
        }
        const url = replaceCommentId(commentUpdateTemplate, targetId);
        if (!url) {
          return;
        }
        const formData = new FormData(commentEditForm);
        commentSaveButton.disabled = true;
        try {
          const response = await submitForm(url, formData);
          if (response.data) {
            const numericId = Number(response.data.id);
            const updatedId = Number.isNaN(numericId) ? response.data.id : numericId;
            const updatedComment = {
              id: updatedId,
              rating: Number(response.data.rating) || 0,
              comment: response.data.comment || "",
              date: response.data.date || "",
              user: response.data.user || null,
              canEdit: Boolean(response.data.can_edit ?? response.data.canEdit),
              canDelete: Boolean(response.data.can_delete ?? response.data.canDelete),
            };
            const index = commentsState.findIndex(
              (comment) => String(comment.id) === String(updatedId)
            );
            if (index >= 0) {
              commentsState.splice(index, 1, updatedComment);
            } else {
              commentsState = [updatedComment, ...commentsState];
            }
          }
          datasetParsedSuccessfully = true;
          updateRatingMeta(response.meta || {});
          refreshComments();
          commentEditForm.reset();
          setStarRatingValue(commentEditForm, null);
          syncStarRatingOutputs(commentEditForm);
          closeModal(commentEditModal);
        } catch (error) {
          showMessage(commentModalError, getErrorMessage(error));
        } finally {
          commentSaveButton.disabled = false;
        }
      });
    }

    if (commentEditModal) {
      commentEditModal.addEventListener("click", (event) => {
        if (event.target === commentEditModal) {
          commentEditForm?.reset();
          if (commentEditForm?.dataset) {
            delete commentEditForm.dataset.commentId;
          }
          if (commentEditForm) {
            setStarRatingValue(commentEditForm, null);
            syncStarRatingOutputs(commentEditForm);
          }
          showMessage(commentModalError, "");
          closeModal(commentEditModal);
        }
      });
    }

    if (bookingModal) {
      bookingModal.addEventListener("click", (event) => {
        if (event.target === bookingModal) {
          pendingBookingData = null;
          showMessage(bookingModalError, "");
          closeModal(bookingModal);
        }
      });
    }

    page.querySelectorAll("[data-modal-close]").forEach((trigger) => {
      trigger.addEventListener("click", () => {
        const modal = trigger.closest(".modal");
        if (modal === commentEditModal) {
          commentEditForm?.reset();
          if (commentEditForm?.dataset) {
            delete commentEditForm.dataset.commentId;
          }
          if (commentEditForm) {
            setStarRatingValue(commentEditForm, null);
            syncStarRatingOutputs(commentEditForm);
          }
          showMessage(commentModalError, "");
        }
        if (modal === bookingModal) {
          showMessage(bookingModalError, "");
          pendingBookingData = null;
        }
        closeModal(modal);
      });
    });

    const randomPhoneNumbers = [
      "+62 811-2300-455",
      "+62 812-8899-774",
      "+62 853-2201-334",
      "+62 857-9033-118",
      "+62 821-6654-902",
    ];

    if (bookingForm && bookingModal && bookingConfirmButton) {
      bookingForm.addEventListener("submit", (event) => {
        event.preventDefault();
        showMessage(bookingError, "");
        showMessage(bookingModalError, "");

        const formData = new FormData(bookingForm);
        const startValue = formData.get("start_date");
        const endValue = formData.get("end_date");
        const startDate = parseISODate(typeof startValue === "string" ? startValue : "");
        const endDate = parseISODate(typeof endValue === "string" ? endValue : "");

        if (!startDate || !endDate) {
          showMessage(bookingError, "Choose both a start date and an end date.");
          return;
        }

        const duration = Math.floor((endDate - startDate) / DAY_IN_MS) + 1;
        if (!Number.isFinite(duration) || duration <= 0) {
          showMessage(bookingError, "End date cannot be before the start date.");
          return;
        }

        pendingBookingData = {
          formData,
          nights: duration,
          subtotal: duration * Math.max(price, 0),
          startDate,
          endDate,
        };

        if (bookingSummary.dates) {
          bookingSummary.dates.textContent = formatDateRange(startDate, endDate);
        }
        if (bookingSummary.nights) {
          bookingSummary.nights.textContent = `${duration} ${
            duration === 1 ? "night" : "nights"
          }`;
        }
        if (bookingSummary.subtotal) {
          bookingSummary.subtotal.textContent = formatCurrency(
            pendingBookingData.subtotal
          );
        }

        openModal(bookingModal);
      });

      bookingConfirmButton.addEventListener("click", async () => {
        if (!pendingBookingData) {
          showMessage(bookingModalError, "Please review your booking details first.");
          return;
        }
        showMessage(bookingModalError, "");
        bookingConfirmButton.disabled = true;
        try {
          await submitForm(bookingForm.action, pendingBookingData.formData);
          bookingForm.reset();
          closeModal(bookingModal);
          const phone =
            randomPhoneNumbers[
              Math.floor(Math.random() * randomPhoneNumbers.length)
            ];
          window.setTimeout(() => {
            window.alert(`Please pay to ${phone} to complete your booking.`);
          }, 50);
          pendingBookingData = null;
        } catch (error) {
          showMessage(bookingModalError, getErrorMessage(error));
        } finally {
          bookingConfirmButton.disabled = false;
        }
      });
    }

    const initialAverage = Number(page.dataset.averageRating || "");
    const initialCount = Number(page.dataset.ratingCount || commentsState.length);
    updateRatingMeta({
      average_rating: Number.isFinite(initialAverage) ? initialAverage : null,
      count: Number.isFinite(initialCount) ? initialCount : commentsState.length,
    });
    refreshComments();

    page.dataset.initialised = "true";
  };

  const hydrateInitialFragment = () => {
    const initialFragment = mainContainer?.querySelector(PAGE_FRAGMENT_SELECTOR);
    if (initialFragment) {
      initialFragment.classList.add("is-active");
      finalizeFragment(initialFragment);
      history.replaceState({ url: window.location.pathname + window.location.search }, "");
    }
  };

  window.addEventListener("popstate", () => {
    const targetUrl = window.location.pathname + window.location.search;
    if (targetUrl === lastRequestedUrl) {
      return;
    }
    navigate(targetUrl, { transition: "fade", pushState: false });
  });

  hydrateInitialFragment();
  registerAnimatedElements(document);
  animateCounters(document);
  refreshParallaxItems(document);
  attachAjaxLinks(document);
  attachScrollLinks(document);
  initStarRatingGroups(document);
  initVenuesPage(document);
  initVenueDetailPage(document);
});
