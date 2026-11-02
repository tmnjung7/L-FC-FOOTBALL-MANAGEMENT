"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

// shadcn/ui Sonner — 화면 위쪽 토스트 알림 (하단 탭과 겹치지 않게 top-center)
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      position="top-center"
      richColors
      closeButton
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
