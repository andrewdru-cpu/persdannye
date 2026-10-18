import { disclaimer } from "@/content/landing";
import { cn } from "@/lib/utils";

export function LegalDisclaimer({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs leading-relaxed text-white/75", className)} role="note">
      {disclaimer}
    </p>
  );
}
