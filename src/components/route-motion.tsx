"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

gsap.registerPlugin(ScrollTrigger);

export function RouteMotion({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const scope = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = scope.current;
    if (!root) return;
    const frame = window.requestAnimationFrame(() => {
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const candidates = gsap.utils.toArray<HTMLElement>(
        ":scope > *, .panel",
        root,
      );
      const elements = candidates.filter(
        (element, index) =>
          candidates.indexOf(element) === index &&
          !candidates.some(
            (parent) => parent !== element && parent.contains(element),
          ),
      );

      if (reducedMotion) {
        gsap.set(elements, { clearProps: "all" });
        return;
      }

      gsap.context(() => {
        gsap.fromTo(
          elements.slice(0, 2),
          { autoAlpha: 0, y: 22 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.72,
            stagger: 0.09,
            ease: "power3.out",
            clearProps: "transform,opacity,visibility",
          },
        );

        elements.slice(2).forEach((element, index) => {
          gsap.fromTo(
            element,
            {
              autoAlpha: 0,
              y: 34,
              scale: 0.992,
            },
            {
              autoAlpha: 1,
              y: 0,
              scale: 1,
              duration: 0.78,
              delay: (index % 3) * 0.035,
              ease: "power3.out",
              clearProps: "transform,opacity,visibility",
              scrollTrigger: {
                trigger: element,
                start: "top 91%",
                once: true,
              },
            },
          );
        });
      }, root);
      window.setTimeout(() => ScrollTrigger.refresh(), 250);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
      gsap.killTweensOf(root.querySelectorAll("*"));
    };
  }, [pathname]);

  return (
    <div ref={scope} className="route-motion min-w-0 overflow-x-clip">
      {children}
    </div>
  );
}
