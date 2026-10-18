import type { NextConfig } from "next";
import { flags } from "./content/flags";
import { company } from "./lib/company";
import { assertPublishedRequisites, assertRequisiteFlags, assertTermsAndCookieFlags } from "./lib/requisites-guard";

assertRequisiteFlags(flags, {
  legalName: company.legalName,
  inn: company.inn,
  ogrn: company.ogrn,
  address: company.address,
});

if (
  (flags.show_requisites || flags.show_terms) &&
  !assertPublishedRequisites({
    legalName: company.legalName,
    inn: company.inn,
    ogrn: company.ogrn,
    kpp: company.kpp,
    address: company.address,
    phone: company.phone,
    phoneHref: company.phoneHref,
    legalForm: company.legalForm,
  })
) {
  throw new Error("Нельзя публиковать реквизиты, пока страж их не подтвердил.");
}

assertTermsAndCookieFlags(flags, {
  legalName: company.legalName,
  privacy_contact_email: company.privacy_contact_email,
});

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
