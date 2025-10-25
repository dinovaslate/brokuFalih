document.addEventListener("DOMContentLoaded", () => {
  const motionPreference =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : null;
  const prefersReducedMotion = motionPreference?.matches ?? false;

  const animated = document.querySelectorAll("[data-animate]");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          if (!prefersReducedMotion && typeof gsap === "function") {
            gsap.fromTo(
              entry.target,
              { y: 60, opacity: 0 },
              {
                y: 0,
                opacity: 1,
                duration: 0.9,
                ease: "expo.out",
                overwrite: "auto",
              }
            );
          }
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

  if (!prefersReducedMotion) {
    window.addEventListener("mousemove", parallax);
  }

  if (!prefersReducedMotion && typeof gsap === "function") {
    const leaks = document.querySelectorAll("[data-leak]");
    leaks.forEach((leak, index) => {
      gsap.set(leak, {
        xPercent: gsap.utils.random(-20, 20),
        yPercent: gsap.utils.random(-25, 25),
        rotate: gsap.utils.random(-18, 18),
        scale: gsap.utils.random(0.85, 1.1),
      });

      const wander = () => {
        gsap.to(leak, {
          duration: gsap.utils.random(12, 20),
          xPercent: gsap.utils.random(-65, 65),
          yPercent: gsap.utils.random(-55, 55),
          scale: gsap.utils.random(0.8, 1.25),
          rotate: gsap.utils.random(-28, 28),
          ease: "sine.inOut",
          onComplete: wander,
        });
      };

      gsap.delayedCall(index * 0.6, wander);
    });

    gsap.utils.toArray(".hero .orb").forEach((orb, index) => {
      gsap.to(orb, {
        duration: 6 + index * 1.2,
        y: "+=22",
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    });

    const sparkle = gsap.timeline({ repeat: -1, yoyo: true, defaults: { ease: "sine.inOut" } });
    sparkle
      .to(".dashboard-preview", { duration: 4, rotateY: -6, rotateX: 5 })
      .to(".dashboard-preview .sparkline", { duration: 3, opacity: 0.5 }, 0)
      .to(".dashboard-preview .sparkline", { duration: 3, opacity: 1 }, ">-1.5");
  }

  // Fallback: ensure counters display their target values if anime.js is unavailable
  if (typeof anime !== "function") {
    counters.forEach((counter) => {
      counter.textContent = counter.dataset.counter || counter.textContent;
    });
  }

  const scrollNav = document.querySelector("[data-scroll-nav]");
  if (scrollNav) {
    let lastScrollY = window.scrollY || 0;
    const threshold = 120;
    const delta = 6;

    const updateNav = () => {
      const currentY = window.scrollY || 0;
      const goingDown = currentY - lastScrollY > delta;
      const goingUp = lastScrollY - currentY > delta;
      const nearTop = currentY <= 0;

      if (goingDown && currentY > threshold) {
        scrollNav.classList.add("is-visible");
      } else if (goingUp || nearTop) {
        scrollNav.classList.remove("is-visible");
      }

      lastScrollY = currentY;
    };

    window.addEventListener("scroll", updateNav, { passive: true });
    updateNav();
  }
});
