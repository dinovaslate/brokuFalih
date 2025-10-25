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
});
