import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind 클래스를 충돌 없이 합치는 shadcn/ui 표준 헬퍼 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
