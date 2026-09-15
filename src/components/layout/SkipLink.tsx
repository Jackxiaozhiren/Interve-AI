"use client";

import React from "react";

// Phase 9: skip link that moves FOCUS (not just scroll), so keyboard and
// screen-reader users land in the main content (WCAG 2.4.1 / 2.4.3).
export function SkipLink() {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById("main-content");
    if (target) {
      e.preventDefault();
      target.focus({ preventScroll: true });
      target.scrollIntoView();
    }
  };

  return (
    <a href="#main-content" onClick={handleClick} className="skip-nav">
      跳转到主要内容
    </a>
  );
}
