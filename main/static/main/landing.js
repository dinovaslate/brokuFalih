document.addEventListener("DOMContentLoaded", () => {
  const animated = document.querySelectorAll("[data-animate]");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.25 }
  );

  animated.forEach((element) => observer.observe(element));

  const counters = document.querySelectorAll("[data-counter]");
  if (typeof anime === "function") {
    counters.forEach((counter, index) => {
      const finalValue = Number(counter.dataset.counter || counter.textContent || 0);
      anime({
        targets: counter,
        innerHTML: [0, finalValue],
        easing: "easeOutExpo",
        round: 1,
        duration: 1800,
        delay: index * 140,
        update: (anim) => {
          counter.setAttribute("aria-label", `${Math.round(anim.animations[0].currentValue)} metric value`);
        },
      });
    });
  }

  const parallaxItems = document.querySelectorAll("[data-parallax]");
  const parallax = (event) => {
    const { innerWidth, innerHeight } = window;
    const x = (event.clientX / innerWidth - 0.5) * 2;
    const y = (event.clientY / innerHeight - 0.5) * 2;
    parallaxItems.forEach((item) => {
      const intensity = parseFloat(item.dataset.parallax || "8");
      item.style.transform = `translate3d(${x * intensity}px, ${y * intensity}px, 0)`;
    });
  };

  window.addEventListener("mousemove", parallax);

  // Fallback: ensure counters display their target values if anime.js is unavailable
  if (typeof anime !== "function") {
    counters.forEach((counter) => {
      counter.textContent = counter.dataset.counter || counter.textContent;
    });
  }

  const floatingNav = document.querySelector(".floating-nav");
  if (floatingNav) {
    const navMenuButton = floatingNav.querySelector(".floating-nav__menu");
    const navLinks = floatingNav.querySelectorAll(".floating-nav__link");
    let lastScrollY = window.scrollY;
    let scheduled = false;

    const closeMenu = () => {
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
        closeMenu();
      } else if (isScrollingDown) {
        floatingNav.classList.add("is-visible");
      } else {
        floatingNav.classList.remove("is-visible");
        closeMenu();
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

    navLinks.forEach((link) => {
      link.addEventListener("click", () => {
        closeMenu();
      });
    });
  }
});
