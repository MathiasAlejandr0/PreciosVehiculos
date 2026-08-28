import { startCrawl } from "./crawl.js";

const mode = process.argv[2] || "quick";
console.log(`Barrido ${mode}…`);
const state = await startCrawl(mode);
console.log(state.message);
process.exit(state.lastError ? 1 : 0);
