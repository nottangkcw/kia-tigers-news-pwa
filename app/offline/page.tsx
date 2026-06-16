import Link from "next/link";
import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-tiger-paper px-5 py-10">
      <section className="w-full max-w-sm rounded-lg border bg-card p-6 text-center shadow-soft">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-tiger-red text-white">
          <WifiOff className="size-7" aria-hidden />
        </div>
        <h1 className="text-2xl font-bold">지금은 오프라인입니다</h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground">
          마지막으로 열었던 뉴스는 홈 화면에서 다시 확인할 수 있습니다. 연결이 돌아오면 새 소식을 불러옵니다.
        </p>
        <Button asChild className="mt-6 h-12 w-full text-base">
          <Link href="/">홈으로 돌아가기</Link>
        </Button>
      </section>
    </main>
  );
}
