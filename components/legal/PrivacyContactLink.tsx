import { privacyContactLabel, PRIVACY_CONTACT_TODO } from "@/lib/company";

/** Mailto when configured. Preview shows the TODO. Production with an empty value renders nothing. */
export function PrivacyContactLink({ className }: { className?: string }) {
  const label = privacyContactLabel();
  if (!label) return null;
  if (label === PRIVACY_CONTACT_TODO) {
    return <span className={className}>{PRIVACY_CONTACT_TODO}</span>;
  }
  return (
    <a className={className} href={`mailto:${label}`}>
      {label}
    </a>
  );
}
