"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      closeButton
      richColors
      toastOptions={{
        classNames: {
          toast: "border-border bg-card text-card-foreground",
          description: "text-muted-foreground",
        },
      }}
      {...props}
    />
  );
}
