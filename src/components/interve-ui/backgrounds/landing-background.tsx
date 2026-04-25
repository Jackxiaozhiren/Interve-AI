"use client";

import React, { useEffect, useRef } from "react";

/**
 * LandingBackground
 * 
 * Luminous Light Design System: Dynamic flowing mesh gradient + subtle particles.
 * Colors: #E6F0FF, #F5F7FF, #FAFAFC
 * Performance: Uses Canvas API and requestAnimationFrame. Automatically
 * respects prefers-reduced-motion and auto-degrades when fps < 45 for 3s.
 */
export function LandingBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    let width = window.innerWidth;
    let height = window.innerHeight;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    // Particle Configuration — reduced from 40 → 30
    const PARTICLE_COUNT = 30;
    const particles: { x: number; y: number; size: number; speedX: number; speedY: number; opacity: number }[] = [];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2 + 2, // 2-4px (unchanged)
        speedX: (Math.random() - 0.5) * 0.15, // Reduced: ±0.15 (~0.5-1px/s)
        speedY: (Math.random() - 0.5) * 0.15,
        opacity: Math.random() * 0.4 + 0.1,
      });
    }

    // Gradient Orbs (speed unchanged at ~0.5px/s)
    const orbs = [
      { x: 0.2, y: 0.2, r: 0.6, color: "rgba(230, 240, 255, 0.4)", vx: 0.0005, vy: 0.0003 },
      { x: 0.8, y: 0.3, r: 0.7, color: "rgba(245, 247, 255, 0.6)", vx: -0.0004, vy: 0.0006 },
      { x: 0.5, y: 0.8, r: 0.8, color: "rgba(250, 250, 252, 0.5)", vx: 0.0003, vy: -0.0005 },
      { x: 0.1, y: 0.9, r: 0.5, color: "rgba(230, 240, 255, 0.3)", vx: 0.0006, vy: -0.0004 },
    ];

    let animationFrameId: number;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ─── FPS auto-degrade logic ───
    let isDegraded = false;
    let lastFrameTime = performance.now();
    let lowFpsStart = 0; // Timestamp when fps first dropped below 45
    const FPS_THRESHOLD = 45;
    const DEGRADE_DURATION_MS = 3000; // 3 seconds

    const renderFrame = (animate: boolean) => {
      ctx.clearRect(0, 0, width, height);

      // Base background
      ctx.fillStyle = "#FAFAFC";
      ctx.fillRect(0, 0, width, height);

      // Draw flowing gradient orbs
      orbs.forEach(orb => {
        if (animate) {
          orb.x += orb.vx;
          orb.y += orb.vy;
          if (orb.x < -0.2 || orb.x > 1.2) orb.vx *= -1;
          if (orb.y < -0.2 || orb.y > 1.2) orb.vy *= -1;
        }

        const x = orb.x * width;
        const y = orb.y * height;
        const r = orb.r * Math.max(width, height);

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
        gradient.addColorStop(0, orb.color);
        gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw subtle particles
      particles.forEach(p => {
        if (animate) {
          p.x += p.speedX;
          p.y += p.speedY;
          if (p.x < 0 || p.x > width) p.speedX *= -1;
          if (p.y < 0 || p.y > height) p.speedY *= -1;
        }

        ctx.fillStyle = `rgba(22, 93, 255, ${p.opacity * 0.15})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Stripe-style grid overlay
      ctx.strokeStyle = "rgba(22, 93, 255, 0.03)";
      ctx.lineWidth = 1;
      const gridSize = 40;
      
      ctx.beginPath();
      for (let x = 0; x <= width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = 0; y <= height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();
    };

    const render = () => {
      const now = performance.now();
      const delta = now - lastFrameTime;
      lastFrameTime = now;

      // Calculate instantaneous FPS
      const fps = delta > 0 ? 1000 / delta : 60;

      // FPS degrade detection
      if (fps < FPS_THRESHOLD) {
        if (lowFpsStart === 0) {
          lowFpsStart = now;
        } else if (now - lowFpsStart >= DEGRADE_DURATION_MS) {
          // 3 seconds of low fps → degrade to static
          isDegraded = true;
          renderFrame(false); // Render one static frame
          return; // Stop animation loop
        }
      } else {
        lowFpsStart = 0; // Reset on good frame
      }

      renderFrame(true);
      animationFrameId = requestAnimationFrame(render);
    };

    if (prefersReducedMotion) {
      renderFrame(false); // Single static render
    } else {
      render();
    }

    return () => {
      window.removeEventListener("resize", resize);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none -z-10"
      style={{ opacity: 0.8 }}
      aria-hidden="true"
    />
  );
}
