import { useState } from "react";
import { useToast } from "../shell/ToastProvider";

interface CopyButtonProps {
  value: string;
  label?: string;
  className?: string;
  /** What was copied, for the toast ("Site token copied"). */
  what?: string;
}

export function CopyButton({ value, label = "copy", className = "bc-btn-mini", what = "Copied" }: CopyButtonProps) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast(what === "Copied" ? "Copied" : `${what} copied`);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      toast("Could not copy. Select the text and copy it manually.", "error");
    }
  }

  return (
    <button type="button" className={className} onClick={copy}>
      {copied ? "copied" : label}
    </button>
  );
}
