import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "react-oidc-context";
import {
  CreditCard,
  Gamepad2,
  Loader2,
  LogOut,
  User,
  Users,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { type ReservationViewModel } from "@/api/spaces";
import { leaveSessionMutation } from "@/api/spaces/@tanstack/react-query.gen";
import {
  createServiceRequest,
  SERVICE_REQUEST,
  type ServiceRequestType,
} from "@/lib/services/notifications";
import { useLocalized, useT, type TranslationKey } from "@/lib/i18n";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

const COOLDOWN_SECONDS = 30;

function formatElapsed(start: string | null | undefined, now: number): string {
  if (!start) return "00:00:00";
  const seconds = Math.max(
    0,
    Math.floor((now - new Date(start).getTime()) / 1000),
  );
  const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

/** Full-tab view while the customer is playing: live timer, quick service
 *  requests with cooldowns, member list, and leave (mobile parity). */
export function ActiveSessionView({
  session,
}: {
  session: ReservationViewModel;
}) {
  const t = useT();
  const localized = useLocalized();
  const auth = useAuth();
  const queryClient = useQueryClient();

  // Only members who joined someone else's session can leave it — the
  // session owner has no exit; staff end the session (mobile parity)
  const canLeave =
    session.customerId != null &&
    session.customerId !== auth.user?.profile?.sub;

  // 1s clock driving the timer + cooldown countdowns (kept in state so
  // render stays pure)
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const [cooldowns, setCooldowns] = useState<Map<ServiceRequestType, number>>(
    new Map(),
  );
  const [pendingType, setPendingType] = useState<ServiceRequestType | null>(
    null,
  );

  const cooldownRemaining = (type: ServiceRequestType) =>
    Math.max(0, Math.ceil(((cooldowns.get(type) ?? 0) - now) / 1000));

  const sendRequest = async (
    type: ServiceRequestType,
    successKey: TranslationKey,
  ) => {
    if (cooldownRemaining(type) > 0) {
      toast.info(t("pleaseWaitBeforeRequest"));
      return;
    }
    setPendingType(type);
    try {
      await createServiceRequest({
        sessionId: Number(session.id),
        roomId: Number(session.roomId),
        roomName: session.roomName ?? {},
        requestType: type,
      });
      setCooldowns((map) =>
        new Map(map).set(type, Date.now() + COOLDOWN_SECONDS * 1000),
      );
      toast.success(t(successKey));
    } catch {
      toast.error(t("failedToSendRequest"));
    } finally {
      setPendingType(null);
    }
  };

  const leaveSession = useMutation({
    ...leaveSessionMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: "getMySessions" }] });
      queryClient.invalidateQueries({ queryKey: [{ _id: "listRooms" }] });
      toast.success(t("leftSession"));
    },
    onError: () => toast.error(t("failedToLeaveSession")),
  });

  const isSingle = session.currentPlayerMode !== "Multi";
  const quickActions: Array<{
    type: ServiceRequestType;
    label: TranslationKey;
    success: TranslationKey;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      type: SERVICE_REQUEST.callWaiter,
      label: "callWaiter",
      success: "waiterNotified",
      icon: User,
    },
    {
      type: SERVICE_REQUEST.controllerChange,
      label: "controller",
      success: "controllerRequestSent",
      icon: Gamepad2,
    },
    {
      type: SERVICE_REQUEST.receiptToPay,
      label: "getBill",
      success: "billRequestSent",
      icon: CreditCard,
    },
    isSingle
      ? {
          type: SERVICE_REQUEST.switchToMulti,
          label: "switchToMulti",
          success: "switchToMultiRequestSent",
          icon: Users,
        }
      : {
          type: SERVICE_REQUEST.switchToSingle,
          label: "switchToSingle",
          success: "switchToSingleRequestSent",
          icon: User,
        },
  ];

  const members = session.members ?? [];

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Session card */}
      <div className="from-primary to-primary/85 text-primary-foreground flex flex-col items-center gap-4 rounded-2xl bg-gradient-to-br p-6 shadow-lg">
        <div className="flex w-full items-center justify-between">
          <span className="text-xl font-bold">
            {localized(session.roomName)}
          </span>
          {session.currentPlayerMode && (
            <span className="rounded-full border border-white/30 bg-white/15 px-3 py-1 text-xs font-semibold">
              {isSingle ? t("playerModeSingle") : t("playerModeMulti")}
            </span>
          )}
        </div>
        <div className="text-4xl font-bold tracking-widest tabular-nums">
          {formatElapsed(session.actualStartTime, now)}
        </div>
        {members.length > 1 && (
          <div className="text-sm opacity-80">
            {t("memberCountFormat", { count: members.length })}
          </div>
        )}
      </div>

      {/* Quick service requests */}
      <h2 className="text-sm font-semibold">{t("needSomething")}</h2>
      <div className="grid grid-cols-2 gap-3">
        {quickActions.map((action) => {
          const remaining = cooldownRemaining(action.type);
          const Icon = action.icon;
          return (
            <Button
              key={action.type}
              variant="outline"
              className="h-auto flex-col gap-1.5 rounded-xl py-4"
              disabled={remaining > 0 || pendingType !== null}
              onClick={() => sendRequest(action.type, action.success)}
            >
              {pendingType === action.type ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Icon className="h-5 w-5" />
              )}
              <span className="text-xs font-medium">
                {t(action.label)}
                {remaining > 0 && ` (${remaining})`}
              </span>
            </Button>
          );
        })}
      </div>

      {/* Leave (non-owners only) */}
      {canLeave && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="lg"
              className="text-destructive w-full rounded-full"
              disabled={leaveSession.isPending}
            >
              <LogOut className="h-4 w-4" />
              {t("leaveSession")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("leaveSessionConfirmation")}
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("noKeep")}</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={() =>
                  leaveSession.mutate({
                    path: { sessionId: Number(session.id) },
                  })
                }
              >
                {t("yesLeave")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
