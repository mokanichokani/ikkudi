'use client';

import React from 'react';
import { useTheme } from './ThemeProvider';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="rainbow-border"
      style={{
        position: 'fixed',
        top: '12px',
        right: '12px',
        zIndex: 9999,
        fontFamily: 'var(--font-pixel, monospace)',
        fontSize: '18px',
        padding: '8px 12px',
        border: '4px solid #000000',
        boxShadow: '4px 4px 0 #000000',
        backgroundColor: theme === 'dark' ? '#12121f' : '#ffca28',
        color: theme === 'dark' ? '#ededed' : '#000000',
        cursor: 'pointer',
        lineHeight: 1,
        transition: 'background-color 0.2s',
      }}
    >
      {theme === 'dark' ? '☀' : '☾'}
    </button>
  );
}
