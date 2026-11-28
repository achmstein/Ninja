package net.ninjapp.keycloak.phone;

import java.util.List;
import java.util.regex.Pattern;

/**
 * The rules of a customer's account by phone, in one place.
 *
 * A customer proves a number is theirs with a short code sent to it, and
 * that number is their account: no password, no email. It is a step of
 * Keycloak's ordinary sign-in and ends in Keycloak's ordinary tokens;
 * nothing here is its own cryptography or its own session. The code is made
 * by SecureRandom, kept in Keycloak's single-use store until it is used or
 * runs out (PhoneCodes), and how it reaches the phone is the sender's
 * business (CodeSender).
 *
 * A short code is weak by nature, so it is fenced in: few tries at each
 * code, a short life, a wait between two sendings, and a cap on how many go
 * to one number in an hour.
 */
final class Phone {
    private Phone() {
    }

    /** The sign-in step that asks for the code. */
    static final String AUTHENTICATOR_ID = "ninja-phone-form";

    /** The customers' web app: the only client whose browser sign-in offers the phone. */
    static final List<String> BROWSER_CLIENTS = List.of("client-web");

    /** The customers' app, which signs in on its own screens (PhoneDirectGrant). */
    static final List<String> DIRECT_GRANT_CLIENTS = List.of("mobile-app");

    /** The user attribute the business's apps read the number from, and the one that says it was proved. */
    static final String ATTRIBUTE = "phoneNumber";
    static final String VERIFIED_ATTRIBUTE = "phoneNumberVerified";

    static final int CODE_DIGITS = 6;

    /** How long a code is good for, seconds. */
    static final int CODE_LIFE = 5 * 60;

    /** Wrong tries at one code before it is void and another must be sent. */
    static final int MAX_TRIES = 5;

    /** Between two sendings to one number, seconds. */
    static final int RESEND_WAIT = 60;

    /** Codes sent to one number in an hour, at most. */
    static final int MAX_SENDS_AN_HOUR = 5;

    /** A number in the one form the apps send and keep it in: +201012345678. */
    private static final Pattern INTERNATIONAL = Pattern.compile("\\+[1-9][0-9]{7,14}");

    /**
     * The number the text spells when it is written the international way
     * (spaces and dashes aside); null otherwise. The apps read a number
     * against the business's country before they send it here, so nothing
     * else is expected: this never guesses a country.
     */
    static String international(String text) {
        if (text == null) {
            return null;
        }
        String number = text.replaceAll("[\\s().\\-]", "");
        return INTERNATIONAL.matcher(number).matches() ? number : null;
    }
}
