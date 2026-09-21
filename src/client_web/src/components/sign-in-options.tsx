import { useAuth } from "react-oidc-context";
import { useTheme } from "@/context/theme-provider";
import { useLanguage } from "@/lib/i18n";
import { loginPageParams } from "@/lib/oidc";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useT } from "@/lib/i18n";

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.46a5.53 5.53 0 0 1-2.4 3.62v3h3.88c2.26-2.09 3.58-5.17 3.58-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.11A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.38-2.28V6.61H1.27a12 12 0 0 0 0 10.78l4.01-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.98 11.98 0 0 0 12 0 12 12 0 0 0 1.27 6.61l4.01 3.11C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg
      className="h-4 w-4 fill-current"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01ZM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25Z" />
    </svg>
  );
}

/**
 * Branded sign-in entry (option 3): Google and Apple skip the Keycloak form
 * entirely via kc_idp_hint — the user only sees the native provider prompt.
 * Email goes to the themed Keycloak page.
 */
export function SignInOptions() {
  const auth = useAuth();
  const t = useT();
  const { resolvedTheme } = useTheme();
  const language = useLanguage((state) => state.language);

  // The themed Keycloak page follows the app's language and colour scheme;
  // Google and Apple skip it through kc_idp_hint
  const signIn = (idpHint?: string) => {
    const { extraQueryParams } = loginPageParams(resolvedTheme, language);
    auth.signinRedirect({
      extraQueryParams: idpHint
        ? { ...extraQueryParams, kc_idp_hint: idpHint }
        : extraQueryParams,
    });
  };

  // mx-auto so the narrower max-width centres itself: in a plain block
  // container (the profile page) it would otherwise sit at the writing
  // direction start - left in English, right in Arabic. A no-op in the
  // flex items-center parents this also renders in.
  return (
    <div className="mx-auto flex w-full max-w-xs flex-col gap-2.5">
      <Button
        size="lg"
        variant="outline"
        className="w-full rounded-pill"
        onClick={() => signIn("google")}
      >
        <GoogleIcon />
        {t("continueWithGoogle")}
      </Button>
      <Button
        size="lg"
        className="bg-foreground text-background hover:bg-foreground/90 w-full rounded-pill"
        onClick={() => signIn("apple")}
      >
        <AppleIcon />
        {t("continueWithApple")}
      </Button>
      <div className="text-muted-foreground flex items-center gap-3 px-2 text-xs">
        <div className="bg-border h-px flex-1" />
        {t("orContinueWith")}
        <div className="bg-border h-px flex-1" />
      </div>
      <Button
        size="lg"
        variant="secondary"
        className="w-full rounded-pill"
        onClick={() => signIn()}
      >
        <Mail className="h-4 w-4" />
        {t("continueWithEmail")}
      </Button>
    </div>
  );
}

/** Bottom-sheet wrapper for triggers that live inside another layout
 * (header menu, cart bar, room cards). */
export function SignInSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col items-center pb-8">
        <DialogHeader className="text-center">
          <DialogTitle>{t("signIn")}</DialogTitle>
          <DialogDescription>{t("signInPrompt")}</DialogDescription>
        </DialogHeader>
        <SignInOptions />
      </DialogContent>
    </Dialog>
  );
}
