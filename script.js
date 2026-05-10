const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
const Lenis = window.Lenis;
const motionLibsAvailable = Boolean(gsap && ScrollTrigger && Lenis);

if (motionLibsAvailable) {
  gsap.registerPlugin(ScrollTrigger);
}

const pageLoader = document.getElementById("pageLoader");
const audioBadge = document.getElementById("audioBadge");
const soundtrack = document.getElementById("soundtrack");
const galleryCaption = document.getElementById("galleryCaption");
const galleryStage = document.querySelector(".gallery-stage");
const transitionLayer = document.getElementById("sceneTransition");
const ticketBackdrop = document.querySelector(".finale-stage__backdrop");
const introLights = document.querySelectorAll(".intro-stage__light");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isMobile = window.matchMedia("(max-width: 680px)").matches;

let lenis;
let audioUnlocked = false;
let currentGalleryIndex = 0;
const offscreenCanvas = document.createElement("canvas");
const offscreenContext = offscreenCanvas.getContext("2d", { willReadFrequently: true });

function initLenis() {
  lenis = new Lenis({
    lerp: prefersReducedMotion ? 0.22 : 0.08,
    smoothWheel: !prefersReducedMotion,
    syncTouch: true,
    touchMultiplier: 1.05,
    wheelMultiplier: 0.9,
  });

  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);
}

function waitForMedia(element) {
  return new Promise((resolve) => {
    if (element.tagName === "IMG") {
      if (element.complete) {
        resolve();
        return;
      }
      element.addEventListener("load", resolve, { once: true });
      element.addEventListener("error", resolve, { once: true });
      return;
    }

    if (element.readyState >= 2) {
      resolve();
      return;
    }

    const finish = () => resolve();
    element.addEventListener("loadedmetadata", finish, { once: true });
    element.addEventListener("loadeddata", finish, { once: true });
    element.addEventListener("canplay", finish, { once: true });
    element.addEventListener("error", finish, { once: true });
  });
}

function splitHeroTitle() {
  document.querySelectorAll("[data-split]").forEach((line) => {
    const text = line.textContent.trim();
    const fragment = document.createDocumentFragment();
    [...text].forEach((character) => {
      const span = document.createElement("span");
      span.className = "hero-title__char";
      span.textContent = character === " " ? "\u00A0" : character;
      fragment.appendChild(span);
    });
    line.textContent = "";
    line.appendChild(fragment);
  });
}

function revealLoader() {
  if (window.__loaderFailSafe) {
    window.clearTimeout(window.__loaderFailSafe);
  }
  pageLoader.classList.add("is-hidden");
  document.body.classList.remove("is-static-mode");
  document.body.classList.add("is-ready");
}

function enableStaticFallback() {
  if (window.__loaderFailSafe) {
    window.clearTimeout(window.__loaderFailSafe);
  }
  document.body.classList.add("is-static-mode", "is-ready");
  pageLoader.classList.add("is-hidden");
}

function animateIntro() {
  const titleChars = gsap.utils.toArray(".hero-title__char");
  const introTimeline = gsap.timeline({ defaults: { ease: "power3.out" } });

  introTimeline
    .fromTo(
      introLights,
      { scale: 0.8, opacity: 0.2, xPercent: -6, yPercent: 4 },
      {
        scale: 1.1,
        opacity: 1,
        duration: 2.2,
        xPercent: 0,
        yPercent: 0,
        stagger: 0.08,
      },
    )
    .fromTo(
      titleChars,
      { opacity: 0, yPercent: 100, filter: "blur(18px)" },
      {
        opacity: 1,
        yPercent: 0,
        filter: "blur(0px)",
        duration: 1.35,
        stagger: 0.018,
      },
      0.18,
    )
    .to(
      "[data-appear]",
      {
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
        duration: 1.1,
        stagger: 0.15,
      },
      0.55,
    );

  gsap.to(".scroll-whisper", {
    y: 14,
    duration: 2.2,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut",
  });

  gsap.to(".ambient-lights__beam--left", {
    xPercent: 6,
    duration: 11,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut",
  });

  gsap.to(".ambient-lights__beam--right", {
    xPercent: -8,
    duration: 13,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut",
  });

  introLights.forEach((light, index) => {
    gsap.to(light, {
      x: index === 1 ? -18 : 18,
      y: index === 0 ? 24 : -18,
      scale: index === 2 ? 1.06 : 1.14,
      duration: 8 + index * 2,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
    });
  });
}

function enableAudio() {
  if (audioUnlocked) {
    return;
  }

  audioUnlocked = true;
  soundtrack.volume = 0;

  soundtrack
    .play()
    .then(() => {
      gsap.to(soundtrack, {
        volume: 0.58,
        duration: 3.4,
        ease: "power2.out",
      });

      audioBadge.classList.add("is-awake");
      audioBadge.querySelector(".audio-badge__text").textContent = "Музыка уже рядом";
      gsap.to(audioBadge, {
        opacity: 0.45,
        duration: 2.8,
        delay: 2.2,
        ease: "power2.out",
      });
    })
    .catch(() => {
      audioUnlocked = false;
    });
}

function setupAudioUnlock() {
  ["pointerdown", "touchstart", "keydown"].forEach((eventName) => {
    window.addEventListener(eventName, enableAudio, { once: true, passive: true });
  });
}

function initVideoScenes() {
  const scenes = gsap.utils.toArray("[data-video-scene]").map((section) => {
    const video = section.querySelector("video");
    const lines = [...section.querySelectorAll(".story-line")];
    const state = {
      targetTime: 0,
      currentTime: 0,
      velocityBoost: 0.08,
      duration: 1,
    };

    video.pause();
    video.currentTime = 0;

    const setDuration = () => {
      state.duration = Math.max(video.duration || 1, 1);
    };

    if (video.readyState >= 1) {
      setDuration();
    } else {
      video.addEventListener("loadedmetadata", setDuration, { once: true });
    }

    gsap.set(lines, {
      opacity: 0,
      y: 34,
      scale: 0.978,
      filter: "blur(12px)",
    });

    const textTimeline = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: isMobile ? "top 92%" : "top 88%",
        end: isMobile ? "bottom 14%" : "bottom 12%",
        scrub: 0.42,
      },
    });

    lines.forEach((line) => {
      const start = Number(line.dataset.start) * 100;
      const end = Number(line.dataset.end) * 100;
      const span = end - start;
      const fadeUnits = Math.min(10, span * 0.24);
      const holdUnits = Math.max(6, span - fadeUnits * 2);

      textTimeline
        .to(
          line,
          {
            opacity: 1,
            y: 0,
            scale: 1,
            filter: "blur(0px)",
            ease: "none",
            duration: fadeUnits,
          },
          start,
        )
        .to(
          line,
          {
            opacity: 1,
            y: 0,
            scale: 1,
            filter: "blur(0px)",
            ease: "none",
            duration: holdUnits,
          },
          start + fadeUnits,
        )
        .to(
          line,
          {
            opacity: 0,
            y: -14,
            scale: 0.988,
            filter: "blur(10px)",
            ease: "none",
            duration: fadeUnits,
          },
          end - fadeUnits,
        );
    });

    ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => {
        const velocity = Math.min(Math.abs(self.getVelocity()) / 2600, 1);
        state.targetTime = self.progress * state.duration;
        state.velocityBoost = gsap.utils.interpolate(state.velocityBoost, 0.075 + velocity * 0.14, 0.22);
      },
    });

    return { video, state };
  });

  gsap.ticker.add(() => {
    scenes.forEach(({ video, state }) => {
      state.currentTime += (state.targetTime - state.currentTime) * state.velocityBoost;
      state.velocityBoost += (0.075 - state.velocityBoost) * 0.08;

      if (Math.abs(video.currentTime - state.currentTime) > 0.025) {
        video.currentTime = state.currentTime;
      }
    });
  });

  gsap.to("#cinemaOne", {
    scale: 1.03,
    ease: "none",
    scrollTrigger: {
      trigger: "#videoSceneOne",
      start: "top top",
      end: "bottom bottom",
      scrub: true,
    },
  });

  gsap.to("#cinemaTwo", {
    scale: 1.06,
    ease: "none",
    scrollTrigger: {
      trigger: "#videoSceneTwo",
      start: "top top",
      end: "bottom bottom",
      scrub: true,
    },
  });
}

function initSceneTransition() {
  const mediaOne = document.querySelector("#videoSceneOne .video-stage__media");
  const mediaTwo = document.querySelector("#videoSceneTwo .video-stage__media");

  gsap.set(mediaTwo, {
    opacity: 0.38,
    filter: "blur(10px)",
  });

  gsap.set(transitionLayer, { opacity: 0 });
  gsap.set(".scene-transition__core", { opacity: 0, scale: 0.82 });

  gsap.fromTo(
    mediaOne,
    {
      opacity: 1,
      filter: "blur(0px)",
    },
    {
      opacity: 0.28,
      filter: "blur(10px)",
      ease: "none",
      scrollTrigger: {
        trigger: "#videoSceneOne",
        start: "bottom 82%",
        end: "bottom 34%",
        scrub: true,
      },
    },
  );

  gsap.fromTo(
    transitionLayer,
    { opacity: 0 },
    {
      opacity: 0.48,
      ease: "none",
      scrollTrigger: {
        trigger: "#videoSceneOne",
        start: "bottom 82%",
        end: "bottom 34%",
        scrub: true,
      },
    },
  );

  gsap.fromTo(
    ".scene-transition__core",
    { opacity: 0, scale: 0.82 },
    {
      opacity: 0.24,
      scale: 1.02,
      ease: "none",
      scrollTrigger: {
        trigger: "#videoSceneOne",
        start: "bottom 82%",
        end: "bottom 34%",
        scrub: true,
      },
    },
  );

  gsap.fromTo(
    mediaTwo,
    {
      opacity: 0.38,
      filter: "blur(10px)",
    },
    {
      opacity: 1,
      filter: "blur(0px)",
      ease: "none",
      scrollTrigger: {
        trigger: "#videoSceneTwo",
        start: "top 92%",
        end: "top 48%",
        scrub: true,
      },
    },
  );

  gsap.fromTo(
    transitionLayer,
    { opacity: 0.48 },
    {
      opacity: 0,
      ease: "none",
      scrollTrigger: {
        trigger: "#videoSceneTwo",
        start: "top 92%",
        end: "top 48%",
        scrub: true,
      },
    },
  );

  gsap.fromTo(
    ".scene-transition__core",
    { opacity: 0.24, scale: 1.02 },
    {
      opacity: 0,
      scale: 0.88,
      ease: "none",
      scrollTrigger: {
        trigger: "#videoSceneTwo",
        start: "top 92%",
        end: "top 48%",
        scrub: true,
      },
    },
  );
}

function rgbToHsl(red, green, blue) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  let hue = 0;
  let saturation = 0;

  if (max !== min) {
    const delta = max - min;
    saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);

    switch (max) {
      case r:
        hue = (g - b) / delta + (g < b ? 6 : 0);
        break;
      case g:
        hue = (b - r) / delta + 2;
        break;
      default:
        hue = (r - g) / delta + 4;
        break;
    }
    hue /= 6;
  }

  return { h: hue * 360, s: saturation, l: lightness };
}

function hslToCss(hue, saturation, lightness, alpha = 1) {
  return `hsla(${Math.round(hue)}, ${Math.round(saturation * 100)}%, ${Math.round(lightness * 100)}%, ${alpha})`;
}

function extractDominantColor(image) {
  if (!image.complete || !image.naturalWidth || !image.naturalHeight) {
    return {
      accent: "hsla(340, 82%, 64%, 0.92)",
      soft: "hsla(340, 82%, 64%, 0.26)",
      shadow: "hsla(336, 40%, 10%, 0.82)",
    };
  }

  offscreenCanvas.width = 28;
  offscreenCanvas.height = 28;
  offscreenContext.clearRect(0, 0, 28, 28);
  offscreenContext.drawImage(image, 0, 0, 28, 28);
  const { data } = offscreenContext.getImageData(0, 0, 28, 28);
  let red = 0;
  let green = 0;
  let blue = 0;
  let weightTotal = 0;

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3] / 255;
    if (alpha < 0.1) {
      continue;
    }

    const brightness = (data[index] + data[index + 1] + data[index + 2]) / 3;
    const weight = 0.5 + brightness / 255;

    red += data[index] * weight;
    green += data[index + 1] * weight;
    blue += data[index + 2] * weight;
    weightTotal += weight;
  }

  if (!weightTotal) {
    return {
      accent: "hsla(340, 82%, 64%, 0.92)",
      soft: "hsla(340, 82%, 64%, 0.26)",
      shadow: "hsla(336, 40%, 10%, 0.82)",
    };
  }

  const hsl = rgbToHsl(red / weightTotal, green / weightTotal, blue / weightTotal);
  const refinedHue = hsl.h < 18 || hsl.h > 330 ? hsl.h : 338;
  const accent = hslToCss(refinedHue, Math.max(0.56, hsl.s), Math.min(0.72, hsl.l + 0.08), 0.95);
  const soft = hslToCss(refinedHue, Math.max(0.5, hsl.s), Math.min(0.66, hsl.l + 0.02), 0.26);
  const shadow = hslToCss(refinedHue - 8, Math.min(0.5, hsl.s + 0.08), 0.1, 0.84);

  return { accent, soft, shadow };
}

function setGalleryTheme(theme) {
  gsap.to(galleryStage, {
    "--memory-accent": theme.accent,
    "--memory-accent-soft": theme.soft,
    "--memory-shadow": theme.shadow,
    duration: 1,
    ease: "power3.out",
  });
}

function initGallery() {
  const carousel = document.getElementById("memoryCarousel");
  const cards = [...carousel.querySelectorAll(".memory-card")];
  const dots = [...document.querySelectorAll(".memory-dot")];
  const themes = cards.map((card) => extractDominantColor(card.querySelector("img")));
  const cardCount = cards.length;
  let activeIndex = 0;
  let autoplay;
  let pointerStartX = 0;
  let pointerDeltaX = 0;
  let isDragging = false;
  let resumeAutoplay;

  gsap.set(cards, { xPercent: -50, yPercent: -50 });

  const getSlideStep = () => {
    const baseWidth = carousel.clientWidth || window.innerWidth;
    return isMobile ? Math.min(baseWidth * 0.96, 340) : Math.min(baseWidth * 0.84, 520);
  };

  const normalizeOffset = (value) => {
    let offset = value;
    const half = Math.floor(cardCount / 2);

    if (offset > half) {
      offset -= cardCount;
    }

    if (offset < -half) {
      offset += cardCount;
    }

    return offset;
  };

  const updateCaption = (index) => {
    currentGalleryIndex = index;
    const card = cards[index];
    cards.forEach((item) => item.classList.toggle("is-active", item === card));
    dots.forEach((dot, dotIndex) => {
      const isActive = dotIndex === index;
      dot.classList.toggle("is-active", isActive);
      dot.setAttribute("aria-pressed", String(isActive));
    });
    galleryCaption.textContent = card.dataset.caption;
    gsap.fromTo(
      galleryCaption,
      { opacity: 0, y: 24, filter: "blur(14px)" },
      { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.75, ease: "power3.out" },
    );
    setGalleryTheme(themes[index]);
  };

  const layoutCards = (instant = false) => {
    const step = getSlideStep();

    cards.forEach((card, index) => {
      const offset = normalizeOffset(index - activeIndex);
      const distance = Math.abs(offset);
      const dragOffset = isDragging ? pointerDeltaX : 0;
      const x = offset * step + dragOffset;
      const y = distance === 0 ? -8 : 0;
      const scale = distance === 0 ? 1 : distance === 1 ? 0.94 : 0.88;
      const opacity = distance === 0 ? 1 : distance === 1 ? 0.16 : 0;
      const blur = distance === 0 ? 0 : distance === 1 ? 1.8 : 5.5;
      const rotateY = distance === 0 ? 0 : offset * -4;
      const rotateZ = 0;
      const zIndex = distance === 0 ? 30 : distance === 1 ? 20 : 10;
      const tweenConfig = {
        x,
        y,
        scale,
        rotationY: rotateY,
        rotationZ: rotateZ,
        opacity,
        duration: instant ? 0 : 0.95,
        ease: "power3.inOut",
        overwrite: true,
      };

      card.style.zIndex = String(zIndex);
      if (instant) {
        gsap.set(card, tweenConfig);
        gsap.set(card, { filter: `blur(${blur}px)` });
      } else {
        gsap.to(card, tweenConfig);
        gsap.to(card, {
          filter: `blur(${blur}px)`,
          duration: 0.95,
          ease: "power3.inOut",
          overwrite: true,
        });
      }
    });

    if (!isDragging && (activeIndex !== currentGalleryIndex || !galleryCaption.textContent.trim())) {
      updateCaption(activeIndex);
    }
  };

  const scheduleNext = () => {
    autoplay?.kill();
    resumeAutoplay?.kill();
    autoplay = gsap.delayedCall(isMobile ? 2.9 : 3.3, () => {
      activeIndex = (activeIndex + 1) % cardCount;
      layoutCards();
      scheduleNext();
    });
  };

  const resumeLater = () => {
    resumeAutoplay?.kill();
    resumeAutoplay = gsap.delayedCall(2.6, scheduleNext);
  };

  const goNext = () => {
    activeIndex = (activeIndex + 1) % cardCount;
    layoutCards();
  };

  const goPrev = () => {
    activeIndex = (activeIndex - 1 + cardCount) % cardCount;
    layoutCards();
  };

  const onPointerDown = (event) => {
    isDragging = true;
    pointerStartX = event.clientX;
    pointerDeltaX = 0;
    autoplay?.kill();
    resumeAutoplay?.kill();
    carousel.style.cursor = "grabbing";
    if (carousel.setPointerCapture) {
      try {
        carousel.setPointerCapture(event.pointerId);
      } catch (error) {
        // Ignore browsers that reject pointer capture for synthetic transitions.
      }
    }
  };

  const onPointerMove = (event) => {
    if (!isDragging) {
      return;
    }

    pointerDeltaX = event.clientX - pointerStartX;
    layoutCards(true);
  };

  const onPointerUp = (event) => {
    if (!isDragging) {
      return;
    }

    const threshold = Math.min(84, window.innerWidth * 0.16);
    isDragging = false;
    carousel.style.cursor = "grab";
    if (carousel.releasePointerCapture && event?.pointerId !== undefined) {
      try {
        carousel.releasePointerCapture(event.pointerId);
      } catch (error) {
        // Ignore browsers that already released the pointer.
      }
    }

    if (pointerDeltaX <= -threshold) {
      goNext();
    } else if (pointerDeltaX >= threshold) {
      goPrev();
    } else {
      layoutCards();
    }

    pointerDeltaX = 0;
    resumeLater();
  };

  currentGalleryIndex = -1;
  layoutCards(true);

  ScrollTrigger.create({
    trigger: "#memoryGallery",
    start: "top bottom",
    end: "bottom top",
    onEnter: scheduleNext,
    onEnterBack: scheduleNext,
    onLeave: () => autoplay?.pause(),
    onLeaveBack: () => autoplay?.pause(),
    onUpdate: (self) => {
      gsap.to(carousel, {
        y: gsap.utils.mapRange(0, 1, 18, -18, self.progress),
        rotationZ: gsap.utils.mapRange(0, 1, -1.2, 1.2, self.progress),
        duration: 0.6,
        ease: "power2.out",
        overwrite: true,
      });
    },
  });

  window.addEventListener("resize", () => {
    layoutCards(true);
  });

  dots.forEach((dot) => {
    dot.addEventListener("click", () => {
      activeIndex = Number(dot.dataset.index) || 0;
      autoplay?.kill();
      resumeAutoplay?.kill();
      layoutCards();
      resumeLater();
    });
  });

  carousel.addEventListener("pointerdown", onPointerDown);
  carousel.addEventListener("dragstart", (event) => event.preventDefault());
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
}

function initFinale() {
  const timeline = gsap.timeline({
    scrollTrigger: {
      trigger: "#ticketReveal",
      start: "top top",
      end: "bottom bottom",
      scrub: true,
    },
  });

  timeline
    .fromTo(
      ticketBackdrop,
      { scale: 1.14, yPercent: -2 },
      { scale: 1.02, yPercent: 2, ease: "none" },
      0,
    )
    .fromTo(
      ".finale-copy",
      { opacity: 0, y: 60, filter: "blur(18px)" },
      { opacity: 1, y: 0, filter: "blur(0px)", ease: "power2.out" },
      0.14,
    )
    .fromTo(
      ".ticket--left",
      {
        "--ticket-x": "-72vw",
        "--ticket-y": "14vh",
        "--ticket-r": "-18deg",
        "--ticket-ry": "18deg",
        "--ticket-scale": 0.8,
        "--ticket-opacity": 0,
      },
      {
        "--ticket-x": isMobile ? "-18vw" : "-14vw",
        "--ticket-y": isMobile ? "10vh" : "6vh",
        "--ticket-r": "-13deg",
        "--ticket-ry": "12deg",
        "--ticket-scale": 1,
        "--ticket-opacity": 1,
        ease: "power3.out",
      },
      0.18,
    )
    .fromTo(
      ".ticket--right",
      {
        "--ticket-x": "72vw",
        "--ticket-y": "-18vh",
        "--ticket-r": "18deg",
        "--ticket-ry": "-18deg",
        "--ticket-scale": 0.8,
        "--ticket-opacity": 0,
      },
      {
        "--ticket-x": isMobile ? "18vw" : "14vw",
        "--ticket-y": isMobile ? "-2vh" : "-4vh",
        "--ticket-r": "13deg",
        "--ticket-ry": "-12deg",
        "--ticket-scale": 1,
        "--ticket-opacity": 1,
        ease: "power3.out",
      },
      0.18,
    )
    .to(
      ".ticket--left",
      {
        "--ticket-x": isMobile ? "-14vw" : "-11vw",
        "--ticket-y": isMobile ? "11vh" : "7vh",
        "--ticket-r": "-15deg",
        ease: "elastic.out(1, 0.56)",
      },
      0.54,
    )
    .to(
      ".ticket--right",
      {
        "--ticket-x": isMobile ? "14vw" : "11vw",
        "--ticket-y": isMobile ? "0vh" : "-3vh",
        "--ticket-r": "15deg",
        ease: "elastic.out(1, 0.56)",
      },
      0.54,
    )
    .fromTo(
      ".ticket-intersection",
      { opacity: 0, scale: 0.3 },
      { opacity: 0.95, scale: 1.2, ease: "power2.out" },
      0.5,
    )
    .fromTo(
      ".ticket-glow",
      { opacity: 0, scale: 0.4 },
      { opacity: 1, scale: 1.2, ease: "power2.out" },
      0.5,
    )
    .fromTo(
      ".ticket-sweep",
      { xPercent: -120, opacity: 0 },
      { xPercent: 240, opacity: 0.9, ease: "power2.inOut" },
      0.62,
    )
    .fromTo(
      ".finale-stage__spotlight",
      { opacity: 0.28, scaleY: 0.8 },
      { opacity: 0.78, scaleY: 1.12, ease: "power2.out" },
      0.44,
    );
}

function initAmbientParallax() {
  gsap.to(".ambient-lights__orb--top", {
    xPercent: 10,
    yPercent: -8,
    duration: 18,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut",
  });

  gsap.to(".ambient-lights__orb--bottom", {
    xPercent: -12,
    yPercent: 8,
    duration: 22,
    repeat: -1,
    yoyo: true,
    ease: "sine.inOut",
  });
}

function initDustCanvas() {
  const canvas = document.getElementById("dustCanvas");
  const context = canvas.getContext("2d");
  const particles = [];
  const particleCount = isMobile ? 30 : 54;
  let width = window.innerWidth;
  let height = window.innerHeight;

  const resize = () => {
    width = window.innerWidth;
    height = window.innerHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  };

  const makeParticle = () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    radius: Math.random() * 2.8 + 0.6,
    speedX: (Math.random() - 0.5) * 0.12,
    speedY: Math.random() * 0.16 + 0.04,
    alpha: Math.random() * 0.4 + 0.08,
    drift: Math.random() * Math.PI * 2,
  });

  resize();

  for (let count = 0; count < particleCount; count += 1) {
    particles.push(makeParticle());
  }

  const render = (time) => {
    context.clearRect(0, 0, width, height);

    particles.forEach((particle, index) => {
      particle.y -= particle.speedY;
      particle.x += particle.speedX + Math.sin(time * 0.0004 + particle.drift) * 0.08;

      if (particle.y < -16 || particle.x < -24 || particle.x > width + 24) {
        particles[index] = { ...makeParticle(), y: height + 16 };
        return;
      }

      const glow = context.createRadialGradient(
        particle.x,
        particle.y,
        0,
        particle.x,
        particle.y,
        particle.radius * 5,
      );
      glow.addColorStop(0, `rgba(255, 236, 210, ${particle.alpha})`);
      glow.addColorStop(1, "rgba(255, 236, 210, 0)");
      context.fillStyle = glow;
      context.beginPath();
      context.arc(particle.x, particle.y, particle.radius * 5, 0, Math.PI * 2);
      context.fill();
    });

    requestAnimationFrame(render);
  };

  window.addEventListener("resize", resize);
  requestAnimationFrame(render);
}

function initScrollDrivenStates() {
  gsap.to(".intro-copy", {
    yPercent: -12,
    opacity: 0.36,
    ease: "none",
    scrollTrigger: {
      trigger: "#intro",
      start: "top top",
      end: "bottom top",
      scrub: true,
    },
  });

  gsap.to(".intro-stage__light--a", {
    xPercent: -8,
    yPercent: 16,
    ease: "none",
    scrollTrigger: {
      trigger: "#intro",
      start: "top top",
      end: "bottom top",
      scrub: true,
    },
  });

  gsap.to(".intro-stage__light--b", {
    xPercent: 10,
    yPercent: -12,
    ease: "none",
    scrollTrigger: {
      trigger: "#intro",
      start: "top top",
      end: "bottom top",
      scrub: true,
    },
  });
}

async function init() {
  splitHeroTitle();
  initLenis();
  initDustCanvas();
  initAmbientParallax();
  setupAudioUnlock();
  animateIntro();
  initScrollDrivenStates();
  initVideoScenes();
  initSceneTransition();
  initGallery();
  initFinale();
  revealLoader();
  ScrollTrigger.refresh();
}

const mediaToAwait = [...document.querySelectorAll("video"), ...document.querySelectorAll(".memory-card img")];

if (!motionLibsAvailable) {
  enableStaticFallback();
} else {
  Promise.race([
    Promise.all(mediaToAwait.map(waitForMedia)),
    new Promise((resolve) => window.setTimeout(resolve, 2600)),
  ])
    .then(init)
    .catch(enableStaticFallback);
}
