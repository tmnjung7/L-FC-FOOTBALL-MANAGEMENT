import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** 모바일에서는 OS 기본 선택 UI가 가장 편하므로 네이티브 <select> 를 shadcn 스타일로 감싼다 */
function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        data-slot="native-select"
        className={cn(
          "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-11 w-full appearance-none rounded-md border bg-transparent pr-9 pl-3 text-base shadow-xs outline-none focus-visible:ring-[3px] disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2" />
    </div>
  );
}

export { NativeSelect };
