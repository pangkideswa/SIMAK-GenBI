import React, { useEffect, useRef } from 'react';

interface InteractiveLoginBackgroundProps {
  className?: string;
  theme?: 'dark' | 'light';
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseAlpha: number;
}

export const InteractiveLoginBackground: React.FC<InteractiveLoginBackgroundProps> = ({
  className = '',
  theme = 'light',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    const isMobile = width < 768;
    const particleCount = isMobile ? 38 : 72;
    const maxDistance = isMobile ? 100 : 145;

    const particles: Particle[] = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: Math.random() * 2 + 1.2,
        baseAlpha: Math.random() * 0.5 + 0.35,
      });
    }

    let mouse = {
      x: -1000,
      y: -1000,
      radius: 140,
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        mouse.x = e.touches[0].clientX;
        mouse.y = e.touches[0].clientY;
      }
    };

    const handleMouseLeave = () => {
      mouse.x = -1000;
      mouse.y = -1000;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      const isDark = theme === 'dark';

      // Lines connecting particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxDistance) {
            const alpha = (1 - dist / maxDistance) * (isDark ? 0.45 : 0.3);
            ctx.beginPath();
            ctx.strokeStyle = isDark
              ? `rgba(59, 130, 246, ${alpha})`
              : `rgba(37, 99, 235, ${alpha * 0.85})`;
            ctx.lineWidth = isDark ? 1.2 : 0.9;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < mouse.radius) {
          const force = (mouse.radius - dist) / mouse.radius;
          const angle = Math.atan2(dy, dx);
          p.x -= Math.cos(angle) * force * 1.5;
          p.y -= Math.sin(angle) * force * 1.5;
        }

        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = isDark
          ? `rgba(96, 165, 250, ${p.baseAlpha})`
          : `rgba(37, 99, 235, ${p.baseAlpha * 0.75})`;
        ctx.shadowBlur = isDark ? 6 : 3;
        ctx.shadowColor = isDark ? 'rgba(59, 130, 246, 0.4)' : 'rgba(37, 99, 235, 0.25)';
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [theme]);

  const isDark = theme === 'dark';

  return (
    <div
      className={`fixed inset-0 pointer-events-none overflow-hidden -z-10 transition-colors duration-500 ${
        isDark ? 'bg-slate-950' : 'bg-slate-50'
      } ${className}`}
    >
      {/* 1. Latar Belakang Gradasi Utama */}
      <div
        className={`absolute inset-0 transition-opacity duration-500 ${
          isDark
            ? 'bg-gradient-to-b from-slate-950 via-[#060e24] to-slate-950'
            : 'bg-gradient-to-b from-sky-50/70 via-blue-50/40 to-slate-100'
        }`}
      />

      {/* 2. Grid Geometris (21st.dev Style) */}
      <div
        className={`absolute inset-0 transition-opacity duration-500 ${
          isDark ? 'opacity-40' : 'opacity-30'
        }`}
        style={{
          backgroundImage: isDark
            ? `
              linear-gradient(to right, rgba(59, 130, 246, 0.45) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(59, 130, 246, 0.45) 1px, transparent 1px)
            `
            : `
              linear-gradient(to right, rgba(37, 99, 235, 0.3) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(37, 99, 235, 0.3) 1px, transparent 1px)
            `,
          backgroundSize: '44px 44px',
          maskImage: 'radial-gradient(ellipse at center, black 65%, transparent 95%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 65%, transparent 95%)',
        }}
      />

      {/* 3. Glowing Aurora Orbs */}
      <div
        className={`absolute -top-32 -left-32 w-[34rem] h-[34rem] rounded-full blur-[100px] animate-float-orb-1 transition-colors duration-500 ${
          isDark ? 'bg-blue-500/35' : 'bg-blue-400/25'
        }`}
      />
      <div
        className={`absolute top-1/4 -right-32 w-[36rem] h-[36rem] rounded-full blur-[110px] animate-float-orb-2 transition-colors duration-500 ${
          isDark ? 'bg-indigo-500/35' : 'bg-indigo-400/20'
        }`}
      />
      <div
        className={`absolute -bottom-32 left-1/4 w-[38rem] h-[38rem] rounded-full blur-[110px] animate-float-orb-3 transition-colors duration-500 ${
          isDark ? 'bg-cyan-400/30' : 'bg-cyan-300/20'
        }`}
      />

      {/* 4. Canvas Interaktif (Constellation Dots) */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-auto"
      />
    </div>
  );
};
