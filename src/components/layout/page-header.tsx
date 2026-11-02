import type { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  /** 우측 액션 영역(예: + 버튼). admin 전용 버튼은 상위에서 조건부로 넘긴다. */
  action?: ReactNode;
};

/** 각 탭 화면 상단 제목 영역. sticky로 스크롤해도 제목이 보인다. */
export function PageHeader({ title, description, action }: Props) {
  return (
    <header className="bg-background/95 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex max-w-screen-md items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold">{title}</h1>
          {description && (
            <p className="text-muted-foreground truncate text-sm">{description}</p>
          )}
        </div>
        {action}
      </div>
    </header>
  );
}
