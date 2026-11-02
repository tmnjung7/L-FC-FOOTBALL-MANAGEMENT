import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  Home,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/** 하단 탭 5개. 순서를 바꾸면 모든 화면의 탭 순서가 함께 바뀐다. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "홈", icon: Home },
  { href: "/matches", label: "경기", icon: CalendarDays },
  { href: "/players", label: "선수", icon: Users },
  { href: "/stats", label: "통계", icon: BarChart3 },
  { href: "/tactics", label: "전술판", icon: ClipboardList },
];
