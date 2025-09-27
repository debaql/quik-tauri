import React from "react";
import { Key } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

interface NoApiKeyViewProps {
  apiKey: string | null;
  setApiKey: (apiKey: string) => void;
  onKeySubmit: () => void;
}

const NoApiKeyView: React.FC<NoApiKeyViewProps> = ({
  apiKey,
  setApiKey,
  onKeySubmit,
}) => {
  const saveApiKey = async (apiKey: string) => {
    try {
      await invoke("save_setting", { key: "apiKey", value: apiKey });
    } catch (error) {
      console.error("Failed to save API key:", error);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey && apiKey.trim()) {
      saveApiKey(apiKey);
      onKeySubmit();
    }
  };

  return (
    <div className="bg-background min-h-screen">
      <div className="text-center py-4">
        <h1 className="text-sm font-light text-primary/40 mb-2">quik</h1>
      </div>
      <div className="flex flex-col items-center justify-center p-4">
        <div className="border-2 border-dashed bg-accent-foreground/5 border-accent-foreground/50 rounded-sm p-6 max-w-md w-full text-center">
          <div className="mb-4">
            <Key className="w-6 h-6 text-accent-foreground mx-auto" />
          </div>

          <h2 className="text-lg font-medium text-primary mb-2">
            Enter your API key
          </h2>
          <p className="text-primary/60 text-sm">
            You must enter your API key in order to use quik.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <input
              type="password"
              value={apiKey ?? ""}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your Gemini API key"
              className="selection:!bg-accent-foreground/50 w-full px-3 py-1 bg-background border-accent-foreground/20 border rounded-md text-primary placeholder-primary/60 focus:outline-none focus:ring-1 focus:ring-accent-foreground focus:border-transparent"
            />
            <button
              type="submit"
              className="cursor-pointer w-full !bg-accent-foreground hover:!bg-accent-foreground/80 active:scale-99 text-primary py-1 px-3 rounded-md transition-all"
            >
              Save API Key
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default NoApiKeyView;
