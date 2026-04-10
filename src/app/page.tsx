import Image from "next/image";
import VapiWidget from "./components/VapiWidget";

export default async function Home() {

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <VapiWidget apiKey="YOUR_API_KEY" assistantId="YOUR_ASSISTANT_ID" />
      </div>
    </div>
  );
}
