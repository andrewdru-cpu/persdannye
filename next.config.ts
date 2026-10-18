import type { NextConfig } from "next";
import { flags } from "./content/flags";
import { company } from "./lib/company";
import { assertRequisiteFlags } from "./lib/requisites-guard";

assertRequisiteFlags(flags, {
  legalName: company.legalName,
  inn: company.inn,
  ogrn: company.ogrn,
  address: company.address,
});

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
