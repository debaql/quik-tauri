import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      // The result looks like "data:image/png;base64,xxxxxxxx..."
      // So strip the prefix and keep only the Base64 part.
      const base64String = (reader.result as string).split(",")[1];
      resolve(base64String);
    };
    reader.onerror = (error) => reject(error);
  });
};

// Removes the markdown backticks in response if present
export function safeParseTranslation(payload: string) {
  // 1. Trim whitespace
  let trimmed = payload.trim();

  // 2. Remove wrapping backticks if present
  if (trimmed.startsWith("```") && trimmed.endsWith("```")) {
    // Remove the first line if it's ```json or ``` (code block language hint)
    const lines = trimmed.split("\n");

    // Remove first line if it contains ``` (``` or ```json)
    if (lines[0].startsWith("```")) {
      lines.shift();
    }

    // Remove last line if it contains ```
    if (lines[lines.length - 1].startsWith("```")) {
      lines.pop();
    }

    trimmed = lines.join("\n").trim();
  }

  // 3. Parse JSON safely
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    console.error("Failed to parse JSON:", e, "Payload:", trimmed);
    throw Error("Failed to parse JSON");
  }
}
