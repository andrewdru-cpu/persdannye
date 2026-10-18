import { createElement } from "react";

export default function Link({ href, children, className, onClick }) {
  return createElement(
    "a",
    {
      href: typeof href === "string" ? href : "#",
      className,
      onClick,
    },
    children,
  );
}
