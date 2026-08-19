"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";

export function PasswordInput({
  placeholder,
  name,
  value,
  onChange,
}: {
  placeholder: string;
  name: string;
  value?: string;
  onChange?: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        name={name}
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        className="pr-12"
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
      />
      <button
        type="button"
        className="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground transition hover:text-primary"
        aria-label={visible ? "Hide password" : "Show password"}
        onClick={() => setVisible((value) => !value)}
      >
        {visible ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>
    </div>
  );
}
