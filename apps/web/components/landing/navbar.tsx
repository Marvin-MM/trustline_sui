'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Zap, Menu, X, Sun, Moon, Github, Twitter, Linkedin, Youtube } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useShallow } from 'zustand/react/shallow';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { HoverBorderGradient } from '@/components/ui/hover-border-gradient';
import { Button } from '../ui/button';

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { isAuthenticated } = useAuthStore(
    useShallow((state) => ({ isAuthenticated: state.isAuthenticated }))
  );
  const prefersReducedMotion = usePrefersReducedMotion();

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
    <>
      <motion.header
      className={`fixed top-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? 'border-b border-border/80 bg-background/80 py-3 backdrop-blur-xl shadow-lg shadow-background/5'
          : 'border-b border-transparent bg-transparent py-5'
      }`}
      initial={prefersReducedMotion ? false : { y: -100, opacity: 0 }}
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
            className="object-contain dark:hidden" 
            priority
          />
          <Image 
            src="/logos/trustline-logo-dark.png" 
            alt="Trustline Logo" 
            width={160} 
            height={36} 
            className="object-contain hidden dark:block" 
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
              className="relative rounded-full px-4 py-1.5 text-sm font-medium text-muted-foreground transition-all hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Right Section Actions */}
        <div className="hidden md:flex items-center gap-4">

          {/* Theme Switcher */}
          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="Toggle theme"
          >
            {mounted ? (
              resolvedTheme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-500" />
              ) : (
                <Moon className="h-4 w-4 text-violet-600" />
              )
            ) : (
              <div className="h-4 w-4" />
            )}
          </button>

          {/* CTA */}
          <Link
            href={isAuthenticated ? '/dashboard' : '/auth'}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-full"
          >
            <HoverBorderGradient
              containerClassName="rounded-full"
              as="span"
              className="flex items-center gap-1.5 bg-primary text-white font-semibold px-5 py-2 hover:bg-primary/90"
            >
              {isAuthenticated ? 'Dashboard' : 'Launch App'}
              <ArrowRight className="h-4 w-4" />
            </HoverBorderGradient>
          </Link>
        </div>

        {/* Mobile Actions */}
        <div className="flex md:hidden items-center gap-3">
          {/* Theme Switcher for Mobile */}
          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
            onClick={() => setMobileMenuOpen(true)}
            className="flex items-center justify-center rounded-full border border-border/60 bg-transparent px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="Open mobile menu"
          >
            Menu
          </button>
        </div>
      </div>
    </motion.header>

    {/* Mobile Drawer Menu - Full Screen */}
    <AnimatePresence>
      {mobileMenuOpen && (
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.25, ease: 'easeOut' }}
          className="fixed inset-0 z-[100] flex flex-col bg-background md:hidden"
        >
          {/* Top Bar for Close Button inside Overlay */}
          <div className="flex items-center justify-end px-6 py-6">
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center rounded-full border border-border/60 bg-transparent px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Close
            </button>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center gap-10 px-6 pb-32">
              <div className="flex flex-col items-center gap-6">
                {[
                  { label: 'How It Works', id: 'how-it-works' },
                  { label: 'Features', id: 'features' },
                  { label: 'Tech Stack', id: 'tech-stack' },
                ].map((item) => (
                  <a
                    key={item.label}
                    href={`#${item.id}`}
                    onClick={(e) => scrollToSection(e, item.id)}
                    className="text-4xl font-medium tracking-tight text-foreground transition-colors hover:text-primary focus-visible:outline-none"
                  >
                    {item.label}
                  </a>
                ))}
              </div>

              {/* Social Icons */}
              <div className="flex items-center gap-6 mt-2">
                <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                  <Github className="h-7 w-7" />
                </a>
                <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                  <Twitter className="h-7 w-7" />
                </a>
                <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                  <Linkedin className="h-7 w-7" />
                </a>
                <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                  <Youtube className="h-7 w-7" />
                </a>
              </div>

              {/* Mobile CTA */}
              <div className="mt-6 w-full max-w-[280px]">
                <Link
                  href={isAuthenticated ? '/dashboard' : '/auth'}
                  className="flex justify-center focus-visible:outline-none rounded-full"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <HoverBorderGradient
                    containerClassName="rounded-full w-full"
                    as="span"
                    className="flex w-full items-center justify-center gap-2 bg-background text-foreground border border-border/50 font-semibold py-3.5 px-6 hover:bg-muted/50"
                  >
                    {isAuthenticated ? 'Go to Dashboard' : 'Launch App'}
                    <ArrowRight className="h-4 w-4" />
                  </HoverBorderGradient>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
