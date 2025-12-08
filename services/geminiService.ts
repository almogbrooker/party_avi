
import { GoogleGenAI, Type } from "@google/genai";
import { QAPair } from "../types";

const SYSTEM_INSTRUCTION = `
You are an AI assistant for a bachelor party game. 
Your task is to analyze a video of a bride-to-be answering questions.
Extract EVERY distinct question asked to her and her answer.
Return a JSON array.
The output language must be Hebrew.
For timestamps, provide the approximate start time in seconds (integer).
`;

// Helper to wait for file processing
async function waitForFileActive(ai: GoogleGenAI, fileName: string, onStatusUpdate?: (status: string) => void) {
  console.log("Waiting for file processing...", fileName);
  const startTime = Date.now();
  const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes timeout
  let attempts = 0;

  let file = await ai.files.get({ name: fileName });
  
  while (file.state === 'PROCESSING') {
    attempts++;
    if (Date.now() - startTime > TIMEOUT_MS) {
        throw new Error("Video processing timed out (10 minutes limit). Please try a shorter video or check your internet connection.");
    }
    
    // Update status with attempt count so user sees it's alive
    if (onStatusUpdate) {
        onStatusUpdate(`מעבד בשרתים של גוגל... (ניסיון ${attempts})`);
    }

    await new Promise((resolve) => setTimeout(resolve, 5000)); // Poll every 5s
    file = await ai.files.get({ name: fileName });
    console.log(`Still processing... state: ${file.state}`);
  }
  
  if (file.state === 'FAILED') {
    throw new Error('Video processing failed by Google AI. The video format might not be supported.');
  }

  console.log("File is active/ready.");
  return file;
}

export const analyzeVideoForQA = async (videoFile: File, videoId: string, onStatusUpdate?: (status: string) => void): Promise<QAPair[]> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing");
  }

  const ai = new GoogleGenAI({ apiKey });
  const mimeType = videoFile.type || 'video/mp4';
  const sizeMB = (videoFile.size / (1024 * 1024)).toFixed(1);

  try {
    console.log(`Starting upload for ${videoFile.name}...`);
    if (onStatusUpdate) onStatusUpdate(`מעלה וידאו (${sizeMB} MB)... נא לא לסגור`);
    
    // 1. Upload
    const uploadResponse = await ai.files.upload({
      file: videoFile,
      config: { displayName: videoFile.name, mimeType },
    });
    
    // 2. Wait for processing
    if (onStatusUpdate) onStatusUpdate("הוידאו עלה! מתחיל עיבוד...");
    const file = await waitForFileActive(ai, uploadResponse.name, onStatusUpdate);

    // 3. Generate Content
    if (onStatusUpdate) onStatusUpdate("מנתח שאלות ותשובות עם בינה מלאכותית...");
    const prompt = "Analyze this video. Return a JSON array of questions and answers. For each item, provide 'question' (string), 'answer' (string), and 'startTime' (number, seconds).";

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", // Switched to Flash for better accessibility and speed
      contents: [
        {
          role: "user",
          parts: [
            { fileData: { fileUri: file.uri, mimeType: mimeType } },
            { text: prompt },
          ],
        },
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              answer: { type: Type.STRING },
              startTime: { type: Type.NUMBER }
            },
            required: ["question", "answer", "startTime"]
          }
        }
      },
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No data from Gemini");

    const rawData = JSON.parse(jsonText);
    
    // Map to QAPair structure with intelligent guesses for end times
    return rawData.map((item: any, index: number) => {
       const start = item.startTime || 0;
       return {
          id: `q-${videoId}-${index}-${Date.now()}`,
          videoId: videoId,
          question: item.question,
          answer: item.answer,
          qStart: start,
          qEnd: start + 5, // Default guess: question takes 5s
          aStart: start + 5, // Default guess: answer starts after question
          aEnd: start + 15, // Default guess: answer takes 10s
          timestampStr: formatTime(start)
       };
    });

  } catch (error) {
    console.error("Error analyzing video:", error);
    throw error;
  }
};

const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};
