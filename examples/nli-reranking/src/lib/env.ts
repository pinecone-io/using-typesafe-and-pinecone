import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Examples share one .env at the repo root rather than each keeping its own copy of the keys. */
export const REPO_ROOT = path.resolve(here, "../../../..");

dotenv.config({ path: path.join(REPO_ROOT, ".env"), quiet: true });

export const EXAMPLE_ROOT = path.resolve(here, "../..");
