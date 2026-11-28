package net.ninjapp.keycloak.phone;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.HashMap;
import java.util.Map;

import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;
import org.keycloak.models.SingleUseObjectProvider;

/**
 * The codes on their way to phones: made, kept and checked here.
 *
 * A code lives in Keycloak's single-use store (the one its own action
 * tokens and device codes use, shared across the cluster and emptied by
 * itself), under the realm and the number it was sent to. It is gone once
 * it is used, once it has had its few wrong tries, or after its few
 * minutes. Two more entries beside it hold the wait between two sendings to
 * a number and the count of sendings in the hour.
 */
final class PhoneCodes {
    private static final SecureRandom RANDOM = new SecureRandom();

    private static final String CODE = "code";
    private static final String TRIES = "tries";
    private static final String COUNT = "count";

    enum Sent { OK, TOO_SOON, TOO_MANY, UNREACHABLE }

    enum Checked { RIGHT, WRONG, GONE }

    private final SingleUseObjectProvider store;
    private final String realmId;
    private final CodeSender sender;

    PhoneCodes(KeycloakSession session, RealmModel realm, CodeSender sender) {
        this.store = session.singleUseObjects();
        this.realmId = realm.getId();
        this.sender = sender;
    }

    private String key(String what, String number) {
        return "ninja-phone." + what + "." + realmId + "." + number;
    }

    /** Makes a code for the number and sends it, unless one went a moment ago or too many went this hour. */
    Sent send(String number, String locale) {
        String code = sender.codeFor(number, random());
        if (code == null) {
            return Sent.UNREACHABLE;
        }
        if (!store.putIfAbsent(key("wait", number), Phone.RESEND_WAIT)) {
            return Sent.TOO_SOON;
        }
        // The hour's count starts with the first sending and runs out an hour after it
        String countKey = key("sends", number);
        Map<String, String> count = store.get(countKey);
        int sends = count == null ? 0 : Integer.parseInt(count.getOrDefault(COUNT, "0"));
        if (sends >= Phone.MAX_SENDS_AN_HOUR) {
            return Sent.TOO_MANY;
        }
        if (count == null) {
            store.put(countKey, 60 * 60, Map.of(COUNT, "1"));
        } else {
            store.replace(countKey, Map.of(COUNT, String.valueOf(sends + 1)));
        }

        // A new code takes the place of the one before it: only the last one sent is good
        String codeKey = key("code", number);
        store.remove(codeKey);
        store.put(codeKey, Phone.CODE_LIFE, Map.of(CODE, code, TRIES, "0"));
        if (!sender.send(number, code, locale)) {
            store.remove(codeKey);
            return Sent.UNREACHABLE;
        }
        return Sent.OK;
    }

    /** Whether a code is waiting for the number: sent, not used, not run out. */
    boolean waiting(String number) {
        return store.contains(key("code", number));
    }

    /**
     * Checks what was typed against the number's code. Right, and the code
     * is spent. Wrong, and a try is counted, the code going void with the
     * last one.
     */
    Checked check(String number, String typed) {
        return check(number, typed, true);
    }

    /** As {@link #check(String, String)}; with {@code spend} false a right code is left good, to be sent again. */
    Checked check(String number, String typed, boolean spend) {
        String codeKey = key("code", number);
        Map<String, String> kept = store.get(codeKey);
        if (kept == null) {
            return Checked.GONE;
        }
        boolean right = typed != null && MessageDigest.isEqual(
                kept.get(CODE).getBytes(StandardCharsets.UTF_8),
                typed.trim().getBytes(StandardCharsets.UTF_8));
        if (right) {
            if (!spend) {
                return Checked.RIGHT;
            }
            // Removed first: of two requests with the right code, one signs in
            return store.remove(codeKey) != null ? Checked.RIGHT : Checked.GONE;
        }
        int tries = Integer.parseInt(kept.getOrDefault(TRIES, "0")) + 1;
        if (tries >= Phone.MAX_TRIES) {
            store.remove(codeKey);
            return Checked.GONE;
        }
        Map<String, String> next = new HashMap<>(kept);
        next.put(TRIES, String.valueOf(tries));
        store.replace(codeKey, next);
        return Checked.WRONG;
    }

    private static String random() {
        int bound = (int) Math.pow(10, Phone.CODE_DIGITS);
        return String.format("%0" + Phone.CODE_DIGITS + "d", RANDOM.nextInt(bound));
    }
}
