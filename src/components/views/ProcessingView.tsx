import type React from "react";
import { Loader2 } from "lucide-react";

const ProcessingView: React.FC = () => {
  return (
    <div className="bg-background min-h-screen flex flex-col items-center">
      <div className="text-center py-4">
        <h1 className="text-sm font-light text-primary/40 mb-2">quik</h1>
      </div>

      <div className="border-2 border-dashed rounded-sm p-6 max-w-md w-full text-center bg-zinc-900/40 border-zinc-600/40">
        <div className="mb-4">
          <Loader2 className="w-6 h-6 text-primary mx-auto animate-spin" />
        </div>

        <h2 className="text-lg font-medium text-white mb-2">Processing...</h2>
      </div>
    </div>
  );
};

export default ProcessingView;
