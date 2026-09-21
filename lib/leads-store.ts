import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { Lead } from "./types";

const DATA_PATH = path.join(process.cwd(), "data", "leads.json");

async function ensureFile(): Promise<void> {
  try {
    await fs.access(DATA_PATH);
  } catch {
    await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
    await fs.writeFile(DATA_PATH, "[]\n", "utf8");
  }
}

export async function listLeads(): Promise<Lead[]> {
  await ensureFile();
  const raw = await fs.readFile(DATA_PATH, "utf8");
  try {
    const parsed = JSON.parse(raw) as Lead[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function addLead(
  input: Omit<Lead, "id" | "createdAt">
): Promise<Lead> {
  const leads = await listLeads();
  const lead: Lead = {
    ...input,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  leads.unshift(lead);
  await fs.writeFile(DATA_PATH, JSON.stringify(leads, null, 2) + "\n", "utf8");
  return lead;
}
