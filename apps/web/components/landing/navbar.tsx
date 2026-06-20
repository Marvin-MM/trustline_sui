'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Zap, Menu, X, Sun, Moon, Github } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useShallow } from 'zustand/react/shallow';

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { isAuthenticated } = useAuthStore(
    useShallow((state) => ({ isAuthenticated: state.isAuthenticated }))
  );

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      const offset = 80; // height of sticky navbar
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    }
  };

  return (
    <motion.header
      className={`fixed top-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? 'border-b border-border/80 bg-background/80 py-3 backdrop-blur-xl shadow-lg shadow-background/5'
          : 'border-b border-transparent bg-transparent py-5'
      }`}
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6">
        {/* Logo */}
        <Link href="/" className="group flex items-center">
          <Image 
            src="/logos/trustline-logo.png" 
            alt="Trustline Logo" 
            width={160} 
            height={36} 
            className="object-contain" 
            priority
          />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1 rounded-full border border-border/40 bg-muted/20 p-1.5 backdrop-blur-md">
          {[
            { label: 'How It Works', id: 'how-it-works' },
            { label: 'Features', id: 'features' },
            { label: 'Tech Stack', id: 'tech-stack' },
          ].map((item) => (
            <a
              key={item.label}
              href={`#${item.id}`}
              onClick={(e) => scrollToSection(e, item.id)}
              className="relative rounded-full px-4 py-1.5 text-sm font-medium text-muted-foreground transition-all hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Right Section Actions */}
        <div className="hidden md:flex items-center gap-4">
          {/* GitHub Icon Link */}
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="GitHub"
          >
            <Github className="h-5 w-5" />
          </a>

          {/* Theme Switcher */}
          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Toggle theme"
          >
            {mounted ? (
              resolvedTheme === 'dark' ? (
                <Sun className="h-4.5 w-4.5 text-amber-500" />
              ) : (
                <Moon className="h-4.5 w-4.5 text-violet-600" />
              )
            ) : (
              <div className="h-4.5 w-4.5" />
            )}
          </button>

          {/* CTA */}
          <Link
            href={isAuthenticated ? '/dashboard' : '/auth'}
            className="group relative flex items-center gap-1.5 overflow-hidden rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-primary/35 hover:-translate-y-0.5 active:translate-y-0"
          >
            {isAuthenticated ? 'Dashboard' : 'Launch App'}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        {/* Mobile Actions */}
        <div className="flex md:hidden items-center gap-3">
          {/* Theme Switcher for Mobile */}
          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Toggle theme"
          >
            {mounted ? (
              resolvedTheme === 'dark' ? (
                <Sun className="h-4.5 w-4.5 text-amber-500" />
              ) : (
                <Moon className="h-4.5 w-4.5 text-violet-600" />
              )
            ) : (
              <div className="h-4.5 w-4.5" />
            )}
          </button>

          {/* Menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Toggle mobile menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden border-b border-border bg-background/95 backdrop-blur-xl"
          >
            <div className="flex flex-col gap-4 px-6 py-6">
              {[
                { label: 'How It Works', id: 'how-it-works' },
                { label: 'Features', id: 'features' },
                { label: 'Tech Stack', id: 'tech-stack' },
              ].map((item) => (
                <a
                  key={item.label}
                  href={`#${item.id}`}
                  onClick={(e) => scrollToSection(e, item.id)}
                  className="text-lg font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.label}
                </a>
              ))}
              <hr className="border-border/60" />
              <div className="flex flex-col gap-3">
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-base font-medium text-muted-foreground hover:text-foreground"
                >
                  <Github className="h-5 w-5" />
                  GitHub Repository
                </a>
                <Link
                  href={isAuthenticated ? '/dashboard' : '/auth'}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-base font-semibold text-white shadow-lg shadow-primary/20 hover:bg-primary/90"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {isAuthenticated ? 'Go to Dashboard' : 'Launch App'}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
