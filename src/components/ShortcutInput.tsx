import React from "react";
import { useRecordHotkeys } from "react-hotkeys-hook";

interface ShortcutInputProps {
  value: string;
  onChange: (shortcut: string) => void;
}

const ShortcutInput: React.FC<ShortcutInputProps> = ({ value, onChange }) => {
  const [keys, { start, stop, isRecording }] = useRecordHotkeys();

  React.useEffect(() => {
    if (!isRecording && keys.size > 0) {
      // Once user stops recording, combine keys into a string
      const combo = Array.from(keys).join("+").toLowerCase();
      onChange(combo);
    }
  }, [isRecording, keys, onChange]);

  return (
    <div>
      <input
        type="text"
        readOnly
        value={value}
        placeholder="Click to record"
        className="selection:!bg-accent-foreground/50 w-full px-3 py-1 bg-background border-accent-foreground/20 border rounded-md text-primary placeholder-primary/60 focus:outline-none focus:ring-1 focus:ring-accent-foreground"
        onFocus={start}
        onBlur={stop}
        onKeyUp={stop}
      />
    </div>
  );
};

export default ShortcutInput;
