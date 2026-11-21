package net.ninjapp.keycloak.pin;

import java.util.regex.Pattern;

import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;
import org.keycloak.models.UserLoginFailureModel;
import org.keycloak.models.UserModel;

/**
 * The rules of the till's PIN, in one place.
 *
 * A PIN is a second, short credential a cashier types to take over a till
 * that someone else was selling on. Anyone who signs in to the till may
 * choose one, the owner included (the owner's decision, 2026-11-21). It is
 * weaker than a password by nature, so it is fenced in: it is offered by the
 * till's sign-in alone, only where Keycloak counts wrong tries, and only for
 * a few tries before the password is asked for again.
 *
 * Nothing here is its own cryptography or its own session: the PIN is hashed
 * by the realm's password hasher (PinCredentialProvider), wrong tries are
 * counted by Keycloak's brute-force detection, and signing in is Keycloak's
 * ordinary browser flow, which ends in the ordinary tokens.
 */
final class Pin {
    private Pin() {
    }

    /** The credential's type, as Keycloak stores it. */
    static final String TYPE = "ninja-pin";

    /** The sign-in step that asks for it. */
    static final String AUTHENTICATOR_ID = "ninja-pin-form";

    /** The action in which a cashier chooses theirs (also the kc_action the till asks for). */
    static final String REQUIRED_ACTION_ID = "ninja-configure-pin";

    /**
     * The tills' clients, the web one and the app: the only ones whose
     * sign-in offers the PIN. The app's is its browser sign-in (a cashier
     * taking over by name); its password sign-in is untouched.
     */
    static final java.util.List<String> TILL_CLIENTS = java.util.List.of("pos-web", "pos-app");

    /** The till app: it signs in on its own screens (PinDirectGrant), with its own PIN pad. */
    static final String TILL_APP_CLIENT = "pos-app";

    static final int MIN_DIGITS = 4;
    static final int MAX_DIGITS = 6;

    /**
     * Wrong tries (Keycloak's own count, of PINs and passwords alike) after
     * which the PIN is no longer asked for: the password is, and signing in
     * with it clears the count. Far below the realm's lock-out on purpose:
     * ten thousand PINs are few.
     */
    static final int MAX_FAILURES = 5;

    private static final Pattern DIGITS = Pattern.compile("\\d{" + MIN_DIGITS + "," + MAX_DIGITS + "}");

    static boolean wellFormed(String pin) {
        return pin != null && DIGITS.matcher(pin).matches();
    }

    /** 0000, 1234, 4321: the first ones anybody tries. */
    static boolean guessable(String pin) {
        boolean same = true;
        boolean up = true;
        boolean down = true;
        for (int i = 1; i < pin.length(); i++) {
            int step = pin.charAt(i) - pin.charAt(i - 1);
            same &= step == 0;
            up &= step == 1;
            down &= step == -1;
        }
        return same || up || down;
    }

    /**
     * Whether the PIN may be asked of this account now: the realm counts
     * wrong tries, the account is not locked, and it has tries left.
     */
    static boolean triesLeft(KeycloakSession session, RealmModel realm, UserModel user) {
        if (!realm.isBruteForceProtected()) {
            return false;
        }
        UserLoginFailureModel failures = session.loginFailures().getUserLoginFailure(realm, user.getId());
        return failures == null || failures.getNumFailures() < MAX_FAILURES;
    }
}
