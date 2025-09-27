import type React from "react";
import { X } from "lucide-react";

interface ErrorViewProps {
  onDismiss: () => void;
  error?: string;
}

const ErrorView: React.FC<ErrorViewProps> = ({ onDismiss, error }) => {
  return (
    <div className="bg-background min-h-screen flex flex-col items-center">
      <div className="text-center py-4">
        <h1 className="text-sm font-light text-primary/40 mb-2">quik</h1>
      </div>

      <div className="border-2 border-dashed rounded-sm p-6 mb-6 max-w-md w-full text-center bg-zinc-900/40 border-red-500/40">
        <div className="mb-4">
          <X className="w-6 h-6 text-red-400 mx-auto" />
        </div>

        <h2 className="text-lg font-medium text-red-400 mb-2">
          An error occured.
        </h2>
        <pre className="selectable text-zinc-400 text-sm text-start overflow-auto">
          {error ? `Error: ${error}` : "Error: Invalid API Key"}
        </pre>
        <button
          onClick={onDismiss}
          className="w-full mt-6 cursor-pointer !bg-background hover:!bg-zinc-400/5 border border-zinc-400/40 active:scale-99 text-primary py-2 px-8 rounded-md transition-all"
        >
          OK
        </button>
      </div>
    </div>
  );
};

export default ErrorView;
