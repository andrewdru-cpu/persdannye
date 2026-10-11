import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { Lead } from "./types";
import { dataFilePath } from "./data-dir";

const DATA_PATH = dataFilePath("leads.json");

async function ensureFile(): Promise<void> {
  try {
    await fs.access(DATA_PATH);
  } catch {
    await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
    await fs.writeFile(DATA_PATH, "[]\n", "utf8");
  }
}

async function listLeads(): Promise<Lead[]> {
  let raw: string;
  try {
    await ensureFile();
    raw = await fs.readFile(DATA_PATH, "utf8");
  } catch (err) {
    console.error("[leads] read failed", err);
    return [];
  }
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
  try {
    await fs.writeFile(DATA_PATH, JSON.stringify(leads, null, 2) + "\n", "utf8");
  } catch (err) {
    // Serverless FS is read-only/ephemeral: never lose the request over storage.
    console.error("[leads] save failed, continuing", err);
  }
  return lead;
}
