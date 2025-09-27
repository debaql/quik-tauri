import { open } from "@tauri-apps/plugin-shell";
import React from "react";

interface BreakdownItem {
  term: string;
  reading: string;
  explanation: string;
}

interface SuccessViewProps {
  result: {
    original: string;
    meaning: string;
    breakdown: BreakdownItem[];
  };
  onDismiss: () => void;
}

const SuccessView: React.FC<SuccessViewProps> = ({ result, onDismiss }) => {
  const [highlightedIndex, setHighlightedIndex] = React.useState<number | null>(
    null
  );

  // Map breakdown terms to clickable spans in `original`
  const renderOriginalWithLinks = () => {
    let text = result.original;
    const parts: React.ReactNode[] = [];

    result.breakdown.forEach((item, idx) => {
      const splitIndex = text.indexOf(item.term);
      if (splitIndex === -1) return;

      // Text before the term
      if (splitIndex > 0) {
        const chunk = text.slice(0, splitIndex);

        if (chunk.trim() === "") {
          // whitespace only -> line break
          parts.push(<br key={`br-${idx}`} />);
        } else {
          parts.push(
            <span key={`pre-${idx}`} className="mr-1">
              {chunk}
            </span>
          );
        }
      }

      // The term itself as clickable
      parts.push(
        <button
          key={`term-${idx}`}
          onClick={() => {
            handleClickTerm(idx);
          }}
          className="mr-1 opacity-80 hover:opacity-100 underline decoration-dotted underline-offset-6 decoration-primary/60 hover:decoration-primary/100 cursor-pointer"
        >
          {item.term}
        </button>
      );

      // Update text to what's left after this term
      text = text.slice(splitIndex + item.term.length);
    });

    // Append any leftover text
    if (text.length > 0) {
      parts.push(<span key="last">{text}</span>);
    }

    return parts;
  };

  const handleClickTerm = (idx: number) => {
    // Scroll into view
    document
      .getElementById(`breakdown-${idx}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });

    // Highlight it briefly
    setHighlightedIndex(idx);
    setTimeout(
      () => setHighlightedIndex((prev) => (prev === idx ? null : prev)),
      800
    );
  };

  // Dismiss when ESC key is pressed
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onDismiss();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onDismiss]);

  return (
    <div className="bg-background min-h-screen flex flex-col items-center">
      <div className="text-center py-4">
        <h1 className="text-sm font-light text-primary/40 mb-2">quik</h1>
      </div>

      <div className="border-2 border-dashed rounded-sm p-6 mb-6 max-w-md w-full text-left bg-zinc-900/40 border-zinc-600/40">
        <div className="selectable space-y-6">
          <div>
            <h3 className="text-sm font-medium text-primary/60 mb-1">
              Original
            </h3>
            <p className="leading-[1.7] text-primary text-lg">
              {renderOriginalWithLinks()}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-primary/60 mb-1">
              Translation
            </h3>
            <p className="leading-[1.7] text-primary text-lg font-medium whitespace-pre-wrap">
              {result?.meaning}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-primary/60 mb-1">
              Breakdown
            </h3>
            <div className="text-zinc-300 text-sm space-y-2">
              {result.breakdown.map((item, index) => (
                <p
                  id={`breakdown-${index}`}
                  key={index}
                  className="leading-[1.7]"
                >
                  <button
                    onClick={async () => {
                      await open(
                        `https://jpdb.io/search?q=${item.term}&lang=english`
                      );
                    }}
                    className="hover:!underline underline-offset-4 cursor-pointer"
                  >
                    <span
                      className={`mr-1 font-medium
                    ${
                      highlightedIndex === index
                        ? "!text-accent-foreground"
                        : "!text-primary transition-colors duration-2000"
                    }`}
                    >
                      {item.term}
                    </span>
                  </button>
                  {item.reading ? `(${item.reading})` : ""}
                  <span className="ml-1">{item.explanation}</span>
                </p>
              ))}
            </div>
          </div>
        </div>
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

export default SuccessView;
