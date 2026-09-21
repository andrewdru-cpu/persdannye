"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/Button";

export function StickyMobileCta() {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink-950/95 p-3 backdrop-blur md:hidden"
      initial={reduce ? false : { y: 80, opacity: 0 }}
      animate={reduce ? undefined : { y: 0, opacity: 1 }}
      transition={
        reduce
          ? undefined
          : {
              type: "spring",
              stiffness: 380,
              damping: 18,
              delay: 0.9,
            }
      }
    >
      <Link href="/check" className="block">
        <Button className="w-full" size="lg" pulse>
          Проверить свой сайт
        </Button>
      </Link>
    </motion.div>
  );
}
