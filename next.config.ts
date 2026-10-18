import type { NextConfig } from "next";
import { flags } from "./content/flags";
import { company } from "./lib/company";
import { assertRequisiteFlags, assertTermsAndCookieFlags } from "./lib/requisites-guard";

assertRequisiteFlags(flags, {
  legalName: company.legalName,
  inn: company.inn,
  ogrn: company.ogrn,
  address: company.address,
});

assertTermsAndCookieFlags(flags, {
  legalName: company.legalName,
  privacy_contact_email: company.privacy_contact_email,
});

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
