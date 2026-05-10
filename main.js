// --- Core Motion Engine ---
const initApp = () => {
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  const Lenis = window.Lenis;

  if (!gsap || !ScrollTrigger || !Lenis) return;

  gsap.registerPlugin(ScrollTrigger);

  const lenis = new Lenis({
    lerp: 0.1,
    wheelMultiplier: 1,
    smoothWheel: true,
  });

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  // 2. Dust Particle System
  const initDust = () => {
    const canvas = document.getElementById('dustCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let particles = [];
    let width, height;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * (window.devicePixelRatio || 1);
      canvas.height = height * (window.devicePixelRatio || 1);
      ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    };

    class Particle {
      constructor() { this.reset(); }
      reset() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.size = Math.random() * 1.2 + 0.2;
        this.speedY = -(Math.random() * 0.3 + 0.1);
        this.opacity = Math.random() * 0.4 + 0.1;
      }
      update() {
        this.y += this.speedY;
        if (this.y < -10) this.reset();
      }
      draw() {
        ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    resize();
    window.addEventListener('resize', resize);
    for (let i = 0; i < 60; i++) particles.push(new Particle());

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      particles.forEach(p => { p.update(); p.draw(); });
      requestAnimationFrame(animate);
    };
    animate();
  };

  // 3. Story Logic (Synced Timing - Refined)
  const initStory = () => {
    gsap.utils.toArray('[data-video-scene]').forEach(section => {
      const video = section.querySelector('video');
      const lines = section.querySelectorAll('.story-line');
      
      ScrollTrigger.create({
        trigger: section,
        start: 'top 80%',
        end: 'bottom 20%',
        onEnter: () => video?.play(),
        onLeave: () => video?.pause(),
        onEnterBack: () => video?.play()
      });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 1,
        }
      });

      lines.forEach(line => {
        const start = parseFloat(line.dataset.start) || 0;
        const end = parseFloat(line.dataset.end) || 1;
        const total = end - start;
        const fade = total * 0.2; // 20% fade for more 'exact' feeling

        tl.fromTo(line, 
          { opacity: 0, y: 25, filter: 'blur(8px)' },
          { opacity: 1, y: 0, filter: 'blur(0px)', duration: fade, ease: 'power1.out' }, 
          start
        ).to(line, 
          { opacity: 0, y: -25, filter: 'blur(8px)', duration: fade, ease: 'power1.in' }, 
          end - fade
        );
      });
    });
  };

  // 4. Gallery Logic
  const initGallery = () => {
    const carousel = document.getElementById('memoryCarousel');
    if (!carousel) return;
    const cards = [...carousel.querySelectorAll('.memory-card')];
    const dots = [...document.querySelectorAll('.memory-dot')];
    const caption = document.getElementById('galleryCaption');
    let current = 0;

    const update = (index) => {
      current = (index + cards.length) % cards.length;
      cards.forEach((card, i) => {
        const active = i === current;
        gsap.to(card, {
          opacity: active ? 1 : 0.15,
          scale: active ? 1 : 0.8,
          xPercent: (i - current) * 110 - 50,
          yPercent: -50,
          duration: 0.8,
          ease: 'power3.inOut'
        });
      });
      dots.forEach((dot, i) => dot.classList.toggle('is-active', i === current));
      if (cards[current].dataset.caption) {
        caption.textContent = cards[current].dataset.caption;
        gsap.fromTo(caption, { opacity: 0, y: 5 }, { opacity: 1, y: 0, duration: 0.4 });
      }
    };

    dots.forEach((dot, i) => dot.addEventListener('click', () => update(i)));
    update(0);
  };

  // 5. Ticket Animation
  const initFinale = () => {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: '#ticketReveal',
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1.5,
      }
    });

    tl.fromTo('.finale-stage__backdrop', { scale: 1.1 }, { scale: 1, ease: 'none' })
      .fromTo('.ticket--left', { xPercent: -140, rotate: -35, opacity: 0 }, { xPercent: -15, rotate: -8, opacity: 1 }, 0.1)
      .fromTo('.ticket--right', { xPercent: 140, rotate: 35, opacity: 0 }, { xPercent: 15, rotate: 8, opacity: 1 }, 0.1)
      .fromTo('.finale-copy', { y: 40, opacity: 0 }, { y: 0, opacity: 1 }, 0.4);
  };

  initDust();
  initStory();
  initGallery();
  initFinale();

  const loader = document.getElementById('pageLoader');
  gsap.to(loader, { 
    opacity: 0, 
    duration: 1.2, 
    onComplete: () => {
      loader.style.display = 'none';
      document.body.classList.add('is-ready');
      gsap.from('.hero-title__line', { y: 60, opacity: 0, stagger: 0.15, duration: 1.4, ease: 'power4.out' });
      gsap.from('[data-appear]', { y: 20, opacity: 0, stagger: 0.1, duration: 1, delay: 0.6 });
    }
  });
};

window.addEventListener('load', initApp);
setTimeout(() => {
  if (!document.body.classList.contains('is-ready')) {
    const loader = document.getElementById('pageLoader');
    if (loader) loader.style.display = 'none';
    document.body.classList.add('is-ready');
  }
}, 4500);
