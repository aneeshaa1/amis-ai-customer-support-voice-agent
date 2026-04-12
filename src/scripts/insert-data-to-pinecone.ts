import FirecrawlApp from "@mendable/firecrawl-js";
import dotenv from "dotenv";
import { Logger } from "@/utils/logger";

const logger = new Logger("InsertDataToPinecone");

dotenv.config();

async function main() {
    const app = new FirecrawlApp({
        apiKey: process.env.FIRECRAWL_API_KEY,
    });

    const scrapeResult = await app.scrape("https://www.aditimontessori.com/home", {
        formats: ["markdown"],
        onlyMainContent: true,
    });

    logger.info("Scrape result", { scrapeResult });
}

main();