import { GoogleGenerativeAI } from "@google/generative-ai";

export interface AIAnalysisResult {
  title: string;
  description: string;
  suggestedTags: string[];
  sensitiveAreas: Array<{ x: number, y: number, width: number, height: number, label: string }>;
}

export async function analyzeImage(file: File | Blob, apiKey: string, modelName: string, existingTags: string[]): Promise<AIAnalysisResult> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName || "gemini-1.5-flash" });

  const base64Data = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });

  const prompt = `
    この画像を分析して、以下の情報をJSON形式で返してください。
    
    1. title: 画像のタイトルを10文字以内で作成してください。
    2. description: 画像の内容を30文字程度で説明してください（おんJの民が検索しやすい言葉で）。
    3. suggestedTags: 画像の内容を表すタグを「3つから5つ程度」作成してください。
       既存のタグも参考にして良いですが、内容にふさわしい新しいタグを自由に生成することを推奨します。
       既存タグ: ${existingTags.join(", ")}
    4. sensitiveAreas: 画像内に個人情報（本名、住所、電話番号、メールアドレス、顔、特定のIDなど）が含まれる場合、その範囲を指定してください。
       範囲は画像全体を[0, 1000]の座標系とした数値で返してください。
       形式: [{ "x": 0, "y": 0, "width": 100, "height": 50, "label": "名前" }]
       ※何もなければ空の配列 [] を返してください。

    返答は純粋なJSONのみにしてください。
  `;

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        data: base64Data,
        mimeType: file.type
      }
    }
  ]);

  const response = await result.response;
  const text = response.text();
  
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(data.suggestedTags)) {
        data.suggestedTags = ['未分類'];
      }
      return data;
    }
    throw new Error("JSONの抽出に失敗しました");
  } catch (e) {
    console.error("AI Analysis failed:", text);
    return { title: "無題", description: "解析失敗", suggestedTags: ["未分類"], sensitiveAreas: [] };
  }
}

export async function getAvailableModels(apiKey: string): Promise<string[]> {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (!response.ok) return ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash-exp"];
    const data = await response.json();
    return data.models
      .filter((m: any) => m.supportedGenerationMethods.includes("generateContent"))
      .map((m: any) => m.name.replace('models/', ''));
  } catch (err) {
    return ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash-exp"];
  }
}

export async function redactImage(file: File | Blob, areas: AIAnalysisResult['sensitiveAreas']): Promise<Blob> {
  if (areas.length === 0) return file;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error("Canvas context error"));
      ctx.drawImage(img, 0, 0);
      areas.forEach(area => {
        const x = (area.x / 1000) * img.width;
        const y = (area.y / 1000) * img.height;
        const w = (area.width / 1000) * img.width;
        const h = (area.height / 1000) * img.height;
        ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = "white";
        ctx.font = `${Math.max(12, h/3)}px sans-serif`;
        ctx.fillText("AI PROTECTED", x + 5, y + h/2);
      });
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("toBlob error")), file.type);
    };
    img.onerror = () => reject(new Error("Image load error"));
  });
}
