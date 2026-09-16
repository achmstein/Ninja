import {
  useCanGoBack,
  useNavigate,
  useRouter,
  type LinkProps,
} from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

/**
 * Pushed-page header: back button + page title (mobile-app parity).
 * Back goes to the page the user came from, like the app's back gesture;
 * `to` is where it leads when there is no such page (a link opened fresh)
 * — the profile tab for its sub-pages.
 */
export function BackHeader({
  title,
  to = "/profile",
}: {
  title: string;
  to?: LinkProps["to"];
}) {
  const t = useT();
  const navigate = useNavigate();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  return (
    <div className="flex items-center gap-2 pt-2">
      <Button
        variant="ghost"
        size="icon"
        className="-ms-2"
        aria-label={t("back")}
        onClick={() => (canGoBack ? router.history.back() : navigate({ to }))}
      >
        <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
      </Button>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
    </div>
  );
}
