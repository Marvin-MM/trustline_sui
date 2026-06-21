'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Github, Twitter, ArrowRight, Linkedin, Youtube } from 'lucide-react';
import anime from 'animejs';

export function Footer() {
  const textRef = useRef<HTMLHeadingElement>(null);
  
  useEffect(() => {
    const textElement = textRef.current;
    if (!textElement) return;

    // Split text into letters for individual animation
    const text = "trustline";
    textElement.innerHTML = text.split('').map(letter => `<span class="letter inline-block">${letter}</span>`).join('');

    const letters = textElement.querySelectorAll('.letter');

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            anime.remove(letters);
            anime({
              targets: letters,
              translateY: [100, 0],
              translateZ: 0,
              opacity: [0, 1],
              easing: "easeOutExpo",
              duration: 1400,
              delay: (el, i) => 300 + 50 * i
            });
          } else {
            anime.remove(letters);
            anime({
              targets: letters,
              translateY: [0, 100],
              opacity: [1, 0],
              easing: "easeInExpo",
              duration: 1200,
              delay: (el, i) => 50 * i
            });
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(textElement);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <footer className="w-full bg-background pt-24 pb-0 overflow-hidden relative border-t border-border/40  rounded-t-[60px]">
      {/* Top subtle border */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent opacity-100" />

      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-16">
          {/* Column 1: Brand */}
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center mb-4 w-fit rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
              <Image 
                src="/logos/trustline-logo.png" 
                alt="Trustline Logo" 
                width={140} 
                height={32} 
                className="object-contain dark:hidden" 
              />
              <Image 
                src="/logos/trustline-logo-dark.png" 
                alt="Trustline Logo" 
                width={140} 
                height={32} 
                className="object-contain hidden dark:block" 
              />
            </Link>
            <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
              A programmable payment relationship protocol on Sui. AI-verified milestones, encrypted memory, and verifiable reputation for modern collaborations.
            </p>
          </div>

          {/* Column 2: Platform Links */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-4">Platform</h4>
            <ul className="space-y-2.5">
              <li>
                <Link href="/auth" className="text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm">
                  Launch App
                </Link>
              </li>
              <li>
                <a href="#how-it-works" className="text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm">
                  How it Works
                </a>
              </li>
              <li>
                <a href="#features" className="text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm">
                  Features
                </a>
              </li>
              <li>
                <a href="#tech-stack" className="text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm">
                  Tech Stack
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Community & Docs (Aligned to the right) */}
          <div className="flex flex-col items-start md:items-end justify-start">
            <Link 
              href="/guide" 
              className="group mb-8 inline-flex items-center gap-2 rounded-full border border-border/60 bg-transparent px-5 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-muted/50 hover:border-muted-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Read the Guide
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            
            <div className="flex items-center gap-5">
              <a href="https://discord.com" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm">
                <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></svg>
              </a>
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm">
                <Github className="h-5 w-5" />
              </a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm">
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/></svg>
              </a>
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm">
                <Linkedin className="h-5 w-5" />
              </a>
              <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm">
                <Youtube className="h-6 w-6" />
              </a>
            </div>
          </div>
        </div>

        <div className="pt-6 pb-6 flex flex-col sm:flex-row items-center justify-between gap-4 z-10 relative">
          <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              Sui Testnet Active
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
              Walrus Storage Live
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Gemini Agent Online
            </span>
          </div>

          <p className="text-[11px] text-muted-foreground">
            © {new Date().getFullYear()} TrustLine Protocol. All rights reserved.
          </p>
        </div>
      </div>
      
      {/* Animated Big Text */}
      <div className="w-full flex justify-center overflow-hidden leading-none relative z-0 pb-2 pointer-events-none">
        <h1 
          ref={textRef}
          className="text-[15vw] md:text-[18vw] font-black tracking-tighter text-foreground whitespace-nowrap leading-[0.75] mix-blend-normal opacity-90"
          style={{ letterSpacing: '-0.03em' }}
        >
          {/* Text is dynamically injected here */}
        </h1>
      </div>
    </footer>
  );
}
