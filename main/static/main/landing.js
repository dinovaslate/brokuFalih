const PAGE_FRAGMENT_SELECTOR = "[data-page-fragment]";

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
  initVenuesPage(document);
});
