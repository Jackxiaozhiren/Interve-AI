import { NextResponse } from "next/server";
// @ts-expect-error - Types out of sync with pdf-parse v2
import { PDFParse } from "pdf-parse";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const isPdf = file.type === "application/pdf";
    const isImage = file.type.startsWith("image/");

    if (!isPdf && !isImage) {
      return NextResponse.json({ error: "Only PDF and image files are supported" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let text = "";
    let isOcrFallback = false;

    if (isPdf) {
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      await parser.destroy();
      text = result.text || "";
    }

    // Robust Validation
    if (isImage || text.trim().length < 50 || (text.match(/[a-zA-Z0-9]/g) || []).length / text.length < 0.3) {
       if (isPdf) {
         console.log("[parse-resume] pdf-parse failed or returned bad text. Falling back to Zhipu GLM-4V OCR.");
       } else {
         console.log("[parse-resume] Image file detected. Using Zhipu GLM-4V OCR.");
       }
       isOcrFallback = true;
       try {
         const { generateText } = await import('ai');
         const { createOpenAI } = await import('@ai-sdk/openai');
         
         const zhipu = createOpenAI({
  // @ts-expect-error - compatibility flag needed for Zhipu AI provider
  compatibility: 'compatible',
           baseURL: process.env.OPENAI_BASE_URL || "https://open.bigmodel.cn/api/paas/v4/",
           apiKey: process.env.ZHIPU_API_KEY,
         });
         
         // Using Zhipu's multimodal model glm-4v-flash (which is free/cheap on their platform)
         const { text: ocrText } = await generateText({
           model: zhipu.chat('glm-4v-flash'),
           messages: [
             {
               role: 'user',
               content: [
                 { type: 'text', text: 'Extract all the text from this document accurately. Do not summarize, just extract the raw text.' },
                 { type: 'image', image: buffer },
               ],
             },
           ],
         });
         text = ocrText;
       } catch (fallbackError) {
         console.error("[parse-resume] Zhipu GLM OCR fallback failed:", fallbackError);
         return NextResponse.json(
          { error: "Failed to extract text even with OCR fallback. This might be a corrupted file.", errorType: "insufficient_text" },
          { status: 422 }
        );
       }
    }

    return NextResponse.json({ text: text, isOcrFallback });
  } catch (error) {
    console.error("Resume parsing error:", error);
    return NextResponse.json({ error: "Failed to parse resume" }, { status: 500 });
  }
}
