/* ==========================================================================
   ODINOTE — LANDING PAGE INTERACTIVE SCRIPT
   Provides premium micro-interactions: parallax nodes, dynamic coordinate metrics,
   and hover transitions
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const showcase = document.querySelector('.hero-showcase');
  const windowMetric = document.querySelector('.window-metric');
  const mockNodes = document.querySelectorAll('.mock-node');
  
  if (showcase && windowMetric) {
    showcase.addEventListener('mousemove', (e) => {
      const rect = showcase.getBoundingClientRect();
      const x = e.clientX - rect.left; // x position within the element.
      const y = e.clientY - rect.top;  // y position within the element.
      
      // Calculate normalized positions (-1 to 1)
      const normX = (x / rect.width) * 2 - 1;
      const normY = (y / rect.height) * 2 - 1;
      
      // 1. Update the coordinate metric dynamically in real-time (Image 4 Cyber style)
      const coordX = (normX * 100).toFixed(1);
      const coordY = (-normY * 100).toFixed(1);
      windowMetric.textContent = `LOC: [${coordX}, ${coordY}]`;
      
      // 2. Parallax effect: Shift each node slightly depending on mouse position
      mockNodes.forEach((node, index) => {
        const factor = (index + 1) * 8; // deeper elements shift more
        const shiftX = normX * factor;
        const shiftY = normY * factor;
        node.style.transform = `translate(${shiftX}px, ${shiftY}px)`;
        node.style.transition = 'transform 100ms cubic-bezier(0.16, 1, 0.3, 1)';
      });
    });
    
    // Reset positions on mouse leave
    showcase.addEventListener('mouseleave', () => {
      windowMetric.textContent = 'LOC: [0.0, 0.0]';
      mockNodes.forEach(node => {
        node.style.transform = 'translate(0px, 0px)';
        node.style.transition = 'transform 400ms cubic-bezier(0.16, 1, 0.3, 1)';
      });
    });
  }

  // Smooth Scrolling links
  const links = document.querySelectorAll('a[href^="#"]');
  links.forEach(link => {
    link.addEventListener('click', (e) => {
      const targetId = link.getAttribute('href');
      if (targetId === '#') return;
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        e.preventDefault();
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });

  // ==========================================================================
  // TRIANGLE PARTICLE SPRAY ENGINE (Image 2 Concentric Particle Burst style)
  // ==========================================================================
  const triangleCanvas = document.getElementById('triangle-canvas');
  if (triangleCanvas) {
    const ctx = triangleCanvas.getContext('2d');
    const particles = [];
    const colors = ['#90B968', '#E6544F', '#595459', '#FFFFFF']; // Green, Red, Gray, White

    class TriangleParticle {
      constructor() {
        this.reset();
      }

      reset() {
        // Start at the center of the 800x800 canvas
        this.x = 400;
        this.y = 400;

        // Velocity splay: shoot outward in a splaying circular motion (Image 2 style)
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.6 + Math.random() * 2.2;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;

        // Physical properties
        this.size = 3 + Math.random() * 6;
        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.opacity = 1;
        this.rotation = Math.random() * Math.PI * 2;
        this.spin = -0.04 + Math.random() * 0.08;
        this.life = 0;
        this.maxLife = 90 + Math.random() * 120;
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.rotation += this.spin;
        this.life++;

        // Calculate distance from center to fade out
        const dx = this.x - 400;
        const dy = this.y - 400;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Fade out as it goes further from center (limit of 380px radius)
        this.opacity = 1 - (dist / 380);

        if (this.opacity < 0 || this.life > this.maxLife) {
          this.reset();
        }
      }

      draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        const currentOpacity = Math.max(0, Math.min(1, this.opacity));
        ctx.globalAlpha = currentOpacity;
        ctx.fillStyle = this.color;

        // Draw a neat equilateral triangle particle
        ctx.beginPath();
        ctx.moveTo(0, -this.size);
        ctx.lineTo(this.size * 0.86, this.size * 0.5);
        ctx.lineTo(-this.size * 0.86, this.size * 0.5);
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
      }
    }

    // Initialize particle array
    for (let i = 0; i < 140; i++) {
      particles.push(new TriangleParticle());
      // Warm up: disperse particles so they don't all burst from center at first frame
      const p = particles[i];
      p.x = 400 + p.vx * Math.random() * 140;
      p.y = 400 + p.vy * Math.random() * 140;
    }

    // Main animation loop
    function animate() {
      ctx.clearRect(0, 0, 800, 800);

      // Draw all triangles
      particles.forEach(p => {
        p.update();
        p.draw();
      });

      requestAnimationFrame(animate);
    }

    // Start particle burst
    animate();
  }

  // ==========================================================
  // ZOOM PREVENTION (Ctrl + Mousewheel)
  // ==========================================================
  window.addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
      e.preventDefault();
    }
  }, { passive: false });

  // ==========================================================
  // INTERSECTION OBSERVER FOR SCROLL REVEAL ANIMATIONS
  // ==========================================================
  const revealElements = document.querySelectorAll('.reveal');
  if (revealElements.length > 0) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
        }
      });
    }, {
      threshold: 0.05,
      rootMargin: '0px 0px -120px 0px'
    });

    revealElements.forEach(el => observer.observe(el));
  }
});
