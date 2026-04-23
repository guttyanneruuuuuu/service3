// ============================================================
// Background particles (canvas 2D, light-weight)
// ============================================================
(function () {
  const canvas = document.getElementById('bg-particles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2);
  let particles = [];
  let stars = [];
  const PARTICLE_COUNT = window.innerWidth < 768 ? 24 : 50;

  function resize() {
    W = canvas.clientWidth = window.innerWidth;
    H = canvas.clientHeight = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function init() {
    resize();
    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: 1 + Math.random() * 2,
        hue: 260 + Math.random() * 80,
        alpha: 0.3 + Math.random() * 0.5,
      });
    }
    stars = [];
    for (let i = 0; i < 80; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        size: 0.3 + Math.random() * 0.8,
        tw: Math.random() * Math.PI * 2,
      });
    }
  }

  function tick(t) {
    ctx.clearRect(0, 0, W, H);

    // 星
    ctx.save();
    for (const s of stars) {
      const alpha = 0.4 + Math.sin(t * 0.002 + s.tw) * 0.4;
      ctx.fillStyle = `rgba(255, 240, 255, ${alpha * 0.5})`;
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    ctx.restore();

    // パーティクル線
    ctx.lineWidth = 0.6;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;

      for (let j = i + 1; j < particles.length; j++) {
        const q = particles[j];
        const dx = p.x - q.x, dy = p.y - q.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 140 * 140) {
          const a = (1 - Math.sqrt(d2) / 140) * 0.15;
          ctx.strokeStyle = `hsla(${p.hue}, 80%, 70%, ${a})`;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
        }
      }
    }

    // パーティクル点
    for (const p of particles) {
      ctx.fillStyle = `hsla(${p.hue}, 80%, 70%, ${p.alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    requestAnimationFrame(tick);
  }

  window.addEventListener('resize', () => resize());
  init();
  requestAnimationFrame(tick);
})();
