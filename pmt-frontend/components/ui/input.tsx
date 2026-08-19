import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
}

export function Input({ className, icon, ...props }: InputProps) {
  return (
    <div className="relative">
      <input
        className={cn(
          "h-11 w-full rounded-md border border-border bg-input px-3.5 text-sm font-semibold text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20",
          icon && "pr-12",
          className,
        )}
        {...props}
      />
      {icon ? (
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
          {icon}
        </span>
      ) : null}
    </div>
  );
}
