import FirecrawlApp from "@mendable/firecrawl-js";
import dotenv from "dotenv";
import { Logger } from "@/utils/logger";
import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });

const logger = new Logger("InsertDataToPinecone");

async function main() {

    const app = new FirecrawlApp({
        apiKey: process.env.FIRECRAWL_API_KEY,
    });

    /* list of urls to scrape */
    const urls = [
        "https://www.aditimontessori.com/home",
        "https://www.aditimontessori.com/about",
        "https://www.aditimontessori.com/staff",
        "https://www.aditimontessori.com/careers",
        "https://www.aditimontessori.com/language-activities",
        "https://www.aditimontessori.com/practical-activities",
        "https://www.aditimontessori.com/sensorial-activities",
        "https://www.aditimontessori.com/math",
        "https://www.aditimontessori.com/pre-primary",
        "https://www.aditimontessori.com/primary",
        "https://www.aditimontessori.com/day-care",
        "https://www.aditimontessori.com/school-fee",

    ];

    for (const scrapeURL of urls) {

        const scrapeResult = await app.scrape(scrapeURL, {
            formats: ["markdown"],
            onlyMainContent: true,
        });

        logger.info("Scrape result", { scrapeResult });

        if (!scrapeResult.markdown) {
            throw new Error("Failed to scrape the website");
        }

        // get embeddings for scraped info

        const model = ai.getGenerativeModel({ model: "gemini-embedding-001" });

        const result = await model.embedContent(scrapeResult.markdown);

        const embedding = result.embedding;

        logger.info("Embedding", { embedding });

        // insert embeddings into pinecone

        const namespace = pc.index("company-data", "https://company-data-a2d7f8a.svc.aped-4627-b74a.pinecone.io").namespace("aditi-montessori");

        const pineconeResponse = await namespace.upsert({
            records: [
                {
                    id: `${scrapeURL}-${Date.now()}`,
                    values: embedding.values!,
                    metadata: {
                        chunk_text: scrapeResult.markdown,
                        category: "website",
                        url: scrapeURL,
                    },
                },
            ],
        });

        logger.info("Pinecone response", { pineconeResponse });
        
    }

}

main();