import { claudeBackend } from "./claude";
import { serverBackend } from "./server";

export type { Backend, ConversationSummary, Health } from "./types";

/** `npm run build:claude` construit la version pour claude.ai ; sinon, serveur local. */
export const backend = import.meta.env.MODE === "artifact" ? claudeBackend : serverBackend;
