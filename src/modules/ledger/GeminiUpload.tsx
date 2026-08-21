import React, { useState, useRef } from 'react';
import { UploadCloud, Loader2 } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

// In a real app this should be in an environment variable, 
// but for the sake of this test plugin module, we'll use a placeholder or prompt the user.
// The user provided their API key in the prompt.
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "AQ.Ab8RN6LFTCpcjODbE1MqpdHld4svqUtuySzzFEr4ueG-ziJsCQ";

const ai = new GoogleGenAI({ apiKey: API_KEY });

interface GeminiUploadProps {
  onDataExtracted: (data: { name: string; item: string; amount: number; timestamp: string }) => void;
  onCancel: () => void;
}

export function GeminiUpload({ onDataExtracted, onCancel }: GeminiUploadProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      const base64 = await convertToBase64(file);
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: file.type,
                  data: base64,
                }
              },
              {
                text: `Extract the following information from this receipt image. 
                Return ONLY a raw JSON object (no markdown, no backticks) with these exact keys:
                - "name" (string, the person who bought it or the store name if person not found)
                - "item" (string, a short summary of what was bought)
                - "amount" (number, total cost)
                - "timestamp" (string, ISO format date of the purchase, default to today if not found)
                `
              }
            ]
          }
        ]
      });

      const text = response.text || "{}";
      const cleanText = text.replace(/```json/gi, '').replace(/```/gi, '').trim();
      const data = JSON.parse(cleanText);

      onDataExtracted({
        name: data.name || 'Unknown',
        item: data.item || 'Various Items',
        amount: Number(data.amount) || 0,
        timestamp: data.timestamp || new Date().toISOString(),
      });
      
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to process image');
    } finally {
      setIsProcessing(false);
    }
  };

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Strip the data:image/jpeg;base64, prefix
        const base64Data = result.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = error => reject(error);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div 
        className="file-drop"
        onClick={() => !isProcessing && fileInputRef.current?.click()}
      >
        {isProcessing ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="animate-spin text-accent" size={32} />
            <p className="text-secondary">Processing image with Gemini...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <UploadCloud size={48} className="text-secondary" />
            <p className="font-medium">Click to upload receipt image</p>
            <p className="text-sm text-secondary">Gemini will automatically extract the details</p>
          </div>
        )}
        <input 
          type="file" 
          ref={fileInputRef}
          className="hidden" 
          accept="image/*"
          onChange={handleFileChange}
          disabled={isProcessing}
        />
      </div>
      
      {error && (
        <div className="text-danger text-sm mt-2">{error}</div>
      )}

      <div className="flex justify-end gap-2 mt-4">
        <button className="btn btn-outline" onClick={onCancel} disabled={isProcessing}>
          Cancel
        </button>
      </div>
    </div>
  );
}
