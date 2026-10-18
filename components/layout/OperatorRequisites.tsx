import type { ReactNode } from "react";
import { assertPublishedRequisites, type PublishedRequisites } from "@/lib/company";

export function OperatorRequisites({
  requisites,
  contact,
}: {
  requisites: PublishedRequisites;
  contact?: ReactNode;
}) {
  assertPublishedRequisites(true, requisites);
  return (
    <ul className="space-y-1 text-sm text-white/80">
      <li>{requisites.legalName}</li>
      <li>ИНН {requisites.inn}</li>
      <li>ОГРН {requisites.ogrn}</li>
      <li>{requisites.address}</li>
      {contact}
      <li>
        <a className="hover:text-amber-300" href={requisites.phoneHref}>
          {requisites.phone}
        </a>
      </li>
    </ul>
  );
}
