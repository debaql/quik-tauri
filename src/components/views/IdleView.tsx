import React from "react";
import { Upload, Settings, Pencil, Check } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "../ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { invoke } from "@tauri-apps/api/core";
import { Checkbox } from "../ui/checkbox";
import ShortcutInput from "../ShortcutInput";

interface IdleViewProps {
  apiKey: string | null;
  setApiKey: (apiKey: string) => void;
  onImageSubmit: (image: File) => void;
  model: string | null;
  setModel: (model: string) => void;
  thinkingMode: boolean;
  setThinkingMode: (thinkingMode: boolean) => void;
  translateShortcut: string;
  setTranslateShortcut: (shortcut: string) => void;
  toggleShortcut: string;
  setToggleShortcut: (shortcut: string) => void;
}

const IdleView: React.FC<IdleViewProps> = ({
  apiKey,
  setApiKey,
  onImageSubmit,
  model,
  setModel,
  thinkingMode,
  setThinkingMode,
  translateShortcut,
  setTranslateShortcut,
  toggleShortcut,
  setToggleShortcut,
}) => {
  const [dragActive, setDragActive] = React.useState(false);

  const [canModifyApiKey, setCanModifyApiKey] = React.useState(false);

  React.useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData) {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type.startsWith("image/")) {
            const file = item.getAsFile();
            if (file) {
              onImageSubmit(file);
            }
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, [onImageSubmit]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      const file = files[0];
      if (file.type.startsWith("image/")) {
        onImageSubmit(file);
      }
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      onImageSubmit(files[0]);
    }
  };

  const saveApiKey = async (apiKey: string) => {
    try {
      await invoke("save_setting", { key: "apiKey", value: apiKey });
      setApiKey(apiKey);
    } catch (error) {
      console.error("Failed to save API key:", error);
    }
  };

  const saveModel = async (model: string) => {
    try {
      await invoke("save_setting", { key: "model", value: model });
      setModel(model);
    } catch (error) {
      console.error("Failed to save model:", error);
    }
  };

  const saveThinkingMode = async (thinkingMode: boolean) => {
    try {
      await invoke("save_setting", {
        key: "thinkingMode",
        value: thinkingMode ? "true" : "false",
      });
      setThinkingMode(thinkingMode);
    } catch (error) {
      console.error("Failed to save thinking mode:", error);
    }
  };

  const saveShortcut = async (name: string, shortcut: string) => {
    try {
      await invoke("save_setting", {
        key: `shortcuts.${name}`,
        value: shortcut,
      });
      if (name === "translate") setTranslateShortcut(shortcut);
      if (name === "toggleWindow") setToggleShortcut(shortcut);
    } catch (error) {
      console.error("Failed to save shortcut:", error);
    }
  };

  return (
    <div className="bg-background min-h-screen flex flex-col items-center">
      <div className="text-center py-4">
        <h1 className="text-sm font-light text-primary/40 mb-2">quik</h1>
      </div>
      <div className="absolute top-2 right-2">
        <Sheet
          onOpenChange={(open) => {
            if (!open) {
              setCanModifyApiKey(false);
            }
          }}
        >
          <SheetTrigger asChild>
            <button className="cursor-pointer p-2 hover:!bg-zinc-400/10 active:!bg-zinc-400/20 rounded-full transition-colors">
              <Settings className="w-4 h-4" />
            </button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="dark bg-background border-accent-foreground/20 pb-8 overflow-auto"
          >
            <div className="space-y-6 pt-10 px-6">
              <div>
                <div className="flex items-center gap-2">
                  <label className="block text-sm font-medium text-primary/80">
                    API Key
                  </label>
                  <button
                    onClick={async () => {
                      if (canModifyApiKey) {
                        await saveApiKey(apiKey ?? "");
                      }
                      setCanModifyApiKey(!canModifyApiKey);
                    }}
                    className="cursor-pointer"
                  >
                    {canModifyApiKey ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Pencil className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <input
                  type="password"
                  value={apiKey ?? ""}
                  onChange={(e) => setApiKey(e.target.value)}
                  disabled={!canModifyApiKey}
                  className="mt-2 selection:!bg-accent-foreground/50 w-full px-3 py-1 bg-background border-accent-foreground/20 border rounded-md text-primary placeholder-primary/60 focus:outline-none focus:ring-1 focus:ring-accent-foreground disabled:blur-xs"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary/80 mb-2">
                  Model
                </label>
                <Select
                  value={model ?? "Gemini 1.5 Flash (Faster)"}
                  onValueChange={async (model: string) => {
                    await saveModel(model ?? "");
                  }}
                >
                  <SelectTrigger className="w-full bg-background border-accent-foreground/20 border">
                    <SelectValue placeholder="Select a model" className="" />
                  </SelectTrigger>
                  <SelectContent className="dark">
                    <SelectItem value="gemini-2.5-pro">
                      Gemini 2.5 Pro (Slower but smarter)
                    </SelectItem>
                    <SelectItem value="gemini-2.5-flash">
                      Gemini 2.5 Flash (Faster)
                    </SelectItem>
                    <SelectItem value="gemini-2.5-flash-lite">
                      Gemini 2.5 Flash Lite (Faster)
                    </SelectItem>
                    <SelectItem value="gemini-2.0-flash">
                      Gemini 2.0 Flash (Old model)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-primary/80 mb-2">
                  Thinking Mode
                </label>
                <Checkbox
                  checked={thinkingMode}
                  onCheckedChange={async (thinkingMode: boolean) => {
                    await saveThinkingMode(thinkingMode ?? "");
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary/80 mb-2">
                  Translate Shortcut
                </label>
                <ShortcutInput
                  value={translateShortcut}
                  onChange={(sc) => saveShortcut("translate", sc)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary/80 mb-2">
                  Toggle Window Shortcut
                </label>
                <ShortcutInput
                  value={toggleShortcut}
                  onChange={(sc) => saveShortcut("toggleWindow", sc)}
                />
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div
        className={`border-2 border-dashed rounded-sm p-6 max-w-md w-full text-center bg-zinc-900/40 transition-colors cursor-pointer ${
          dragActive
            ? "border-accent-foreground bg-accent-foreground/10"
            : "border-zinc-600/40 hover:border-zinc-500/60 active:border-zinc-500/80"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => document.getElementById("file-input")?.click()}
      >
        <div className="mb-4">
          <Upload className="w-6 h-6 text-primary mx-auto" />
        </div>

        <h2 className="text-lg font-medium text-white mb-2">
          Upload the image here
        </h2>
        <p className="text-zinc-400 text-sm">
          You can upload 1 image file.
          <br />
          Accepted JPEG, PNG.
        </p>

        <input
          id="file-input"
          type="file"
          accept="image/jpeg,image/png"
          onChange={handleFileInput}
          className="hidden"
        />
      </div>
      <p className="text-zinc-400 text-sm mt-4">
        Alternatively, paste the image here or use the shortcut
      </p>
    </div>
  );
};

export default IdleView;
