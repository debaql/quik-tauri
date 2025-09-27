import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./App.css";
import React from "react";
import NoApiKeyView from "./components/views/NoApiKeyView";
import IdleView from "./components/views/IdleView";
import ProcessingView from "./components/views/ProcessingView";
import SuccessView from "./components/views/SuccessView";
import ErrorView from "./components/views/ErrorView";
import { fileToBase64, safeParseTranslation } from "./lib/utils";
import { register, unregisterAll } from "@tauri-apps/plugin-global-shortcut";

// AppStates dictate what the UI look like
// NO_API_KEY: The initial screen to input the API key
// IDLE: The next screen after inputting the API key, waiting for user to paste an image
// PROCESSING: The image is being processed
// SUCCESS: The response has been returned with no errors
// ERROR: Occurs when there's an error
type AppState = "NO_API_KEY" | "IDLE" | "PROCESSING" | "SUCCESS" | "ERROR";

interface BreakdownItem {
  term: string;
  reading: string;
  explanation: string;
}

interface TranslationResult {
  original: string;
  meaning: string;
  breakdown: BreakdownItem[];
  error?: string;
}

function App() {
  const [appState, setAppState] = React.useState<AppState>("NO_API_KEY");
  const [apiKey, setApiKey] = React.useState<string | null>(null);
  const [model, setModel] = React.useState<string>("gemini-2.5-flash");
  const [thinkingMode, setThinkingMode] = React.useState<boolean>(true);
  const [translateShortcut, setTranslateShortcut] = React.useState("alt+e");
  const [toggleShortcut, setToggleShortcut] = React.useState("alt+q");
  const [result, setResult] = React.useState<TranslationResult | null>(null);

  // Defines how to get the values from store
  async function getApiKey() {
    try {
      const apiKey = await invoke<string | null>("load_setting", {
        key: "apiKey",
      });
      console.log("Loaded API key:", apiKey);
      return apiKey ?? "";
    } catch (err) {
      console.error("Failed to load API key:", err);
      return "";
    }
  }

  async function getModel() {
    try {
      const model = await invoke<string | null>("load_setting", {
        key: "model",
      });
      console.log("Loaded model:", model);
      return model ?? "";
    } catch (err) {
      console.error("Failed to load model:", err);
      return "";
    }
  }

  async function getThinkingMode() {
    try {
      const thinkingMode = await invoke<string | null>("load_setting", {
        key: "thinkingMode",
      });
      console.log("Loaded thinking mode:", thinkingMode);
      return thinkingMode === "true";
    } catch (err) {
      console.error("Failed to load thinking mode:", err);
      return false;
    }
  }

  async function getTranslateShortcut() {
    try {
      const translateShortcut = await invoke<string | null>("load_setting", {
        key: "shortcuts.translate",
      });
      console.log("Loaded thinking mode:", translateShortcut);
      return translateShortcut;
    } catch (err) {
      console.error("Failed to load translate shortcut:", err);
      return false;
    }
  }

  async function getToggleShortcut() {
    try {
      const toggleShortcut = await invoke<string | null>("load_setting", {
        key: "shortcuts.toggleWindow",
      });
      console.log("Loaded thinking mode:", toggleShortcut);
      return toggleShortcut;
    } catch (err) {
      console.error("Failed to load toggle shortcut:", err);
      return false;
    }
  }

  // Listens for events emitted from Rust to update the UI accordingly
  React.useEffect(() => {
    let unlisten: (() => void) | undefined;

    async function setupListener() {
      unlisten = await listen<string>("translation_status", (event) => {
        const payload = event.payload;
        console.log("Translation status:", payload);

        if (payload === "processing") {
          setAppState("PROCESSING");
        } else if (payload.startsWith("error:")) {
          setResult({
            error: payload,
            original: "",
            meaning: "",
            breakdown: [],
          });
          setAppState("ERROR");
        } else {
          try {
            const parsedResult = safeParseTranslation(
              payload
            ) as TranslationResult | null;
            setResult(parsedResult);
            setAppState("SUCCESS");
          } catch (err) {
            console.error("Failed to parse translation result:", err);
            setResult({
              error: "Invalid response from Rust",
              original: "",
              meaning: "",
              breakdown: [],
            });
            setAppState("ERROR");
          }
        }
      });
    }

    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // Gets the values from store on app start
  React.useEffect(() => {
    async function loadSettings() {
      const storedKey = await getApiKey();
      const storedModel = await getModel();
      const storedThinkingMode = await getThinkingMode();
      const storedTranslateShortcut = await getTranslateShortcut();
      const storedToggleShortcut = await getToggleShortcut();

      if (storedKey) {
        setApiKey(storedKey);
      }
      if (storedModel) {
        setModel(storedModel);
      }

      setThinkingMode(storedThinkingMode);

      if (storedTranslateShortcut) {
        setTranslateShortcut(storedTranslateShortcut);
      }

      if (storedToggleShortcut) {
        setToggleShortcut(storedToggleShortcut);
      }

      if (storedKey) {
        setAppState("IDLE");
      } else {
        setAppState("NO_API_KEY");
      }
    }

    loadSettings();
  }, []);

  // Registers shortcuts on app start/shortcut change
  React.useEffect(() => {
    async function setupShortcuts() {
      await register(translateShortcut, async (event) => {
        if (event.state === "Pressed") {
          await invoke("translate_from_clipboard");
        }
      });

      await register(toggleShortcut, async (event) => {
        if (event.state === "Pressed") {
          await invoke("toggle_window");
        }
      });
    }
    setupShortcuts();

    async function resetShortcuts() {
      await unregisterAll();
    }

    return () => {
      resetShortcuts();
    };
  }, [translateShortcut, toggleShortcut]);

  // Defines what to do when the user uploads an image
  const handleImageSubmit = async (imageFile: File) => {
    if (!apiKey) {
      console.error("API Key is not set.");
      return;
    }

    setAppState("PROCESSING");

    try {
      const imageData = await fileToBase64(imageFile);
      const jsonString: string = await invoke("call_gemini_api", {
        apiKey: apiKey,
        imageData: imageData,
        model: model,
        thinkingMode: thinkingMode.toString(),
      });

      const parsedResult = safeParseTranslation(
        jsonString
      ) as TranslationResult | null;

      setResult(parsedResult);
      setAppState("SUCCESS");
    } catch (err) {
      console.error("Error parsing JSON or from Rust:", err);
      setResult({
        error: err as string,
        original: "",
        meaning: "",
        breakdown: [],
      });
      setAppState("ERROR");
    }
  };

  // The render content based on appState
  const renderContent = () => {
    switch (appState) {
      case "NO_API_KEY":
        return (
          <NoApiKeyView
            apiKey={apiKey}
            setApiKey={setApiKey}
            onKeySubmit={() => {
              setAppState("IDLE");
            }}
          />
        );
      case "IDLE":
        return (
          <IdleView
            apiKey={apiKey}
            setApiKey={setApiKey}
            onImageSubmit={handleImageSubmit}
            model={model}
            setModel={setModel}
            thinkingMode={thinkingMode}
            setThinkingMode={setThinkingMode}
            translateShortcut={translateShortcut}
            setTranslateShortcut={setTranslateShortcut}
            toggleShortcut={toggleShortcut}
            setToggleShortcut={setToggleShortcut}
          />
        );
      case "PROCESSING":
        return <ProcessingView />;
      case "SUCCESS":
        return result ? (
          <SuccessView result={result} onDismiss={() => setAppState("IDLE")} />
        ) : null;

      case "ERROR":
        return result && result.error ? (
          <ErrorView
            error={result.error}
            onDismiss={() => setAppState("IDLE")}
          />
        ) : null;
      default:
        return null;
    }
  };

  return <div className="main-container dark">{renderContent()}</div>;
}

export default App;
