import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

/** 서버 컴포넌트에서도 쓸 수 있는 로그아웃 버튼 (폼 POST) */
export function SignOutButton() {
  return (
    <form action="/auth/signout" method="post">
      <Button type="submit" variant="ghost" size="icon" aria-label="로그아웃">
        <LogOut className="size-5" />
      </Button>
    </form>
  );
}
