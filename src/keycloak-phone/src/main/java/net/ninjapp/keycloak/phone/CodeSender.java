package net.ninjapp.keycloak.phone;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

import org.jboss.logging.Logger;
import org.keycloak.Config;

/**
 * How a code reaches a phone. The sign-in knows only this much: whether
 * there is a way at all, and whether one code went out. Which way (a text
 * message, WhatsApp) is chosen by the server's configuration and can change
 * without the sign-in changing:
 *
 * <pre>
 * NINJA_PHONE_SENDER=test
 * NINJA_PHONE_TEST_NUMBERS=+201000000001,+201000000002
 * NINJA_PHONE_TEST_CODE=482193
 * </pre>
 *
 * With no sender configured there is none, and the phone is never offered:
 * every sign-in goes on as it did before.
 */
interface CodeSender {

    /** Whether codes can be sent at all; false and the phone is not offered */
    boolean available();

    /**
     * The code this sender will have the phone receive: one it makes up
     * (the usual case, the caller's own random one is taken as it is), or
     * its own fixed one. Null when the number is one it cannot reach.
     */
    String codeFor(String number, String random);

    /** Sends it; false when it could not be sent */
    boolean send(String number, String code, String locale);

    static CodeSender from(Config.Scope config) {
        String kind = setting(config, "sender", "none");
        if ("test".equals(kind)) {
            return Test.from(config);
        }
        if (!"none".equals(kind)) {
            Logger.getLogger(CodeSender.class).warnf("Unknown phone code sender '%s': the phone sign-in is off", kind);
        }
        return new None();
    }

    /**
     * A setting of the phone sign-in: the server's own configuration for
     * this provider, or the plain environment variable of the same name
     * (NINJA_PHONE_SENDER, NINJA_PHONE_TEST_NUMBERS, NINJA_PHONE_TEST_CODE),
     * which is what a compose file sets most simply.
     */
    static String setting(Config.Scope config, String key, String otherwise) {
        String value = config.get(key);
        if (value == null || value.isBlank()) {
            value = System.getenv("NINJA_PHONE_" + key.toUpperCase().replace('-', '_'));
        }
        return value == null || value.isBlank() ? otherwise : value.trim();
    }

    /** No way to send a code: the phone sign-in is off. */
    final class None implements CodeSender {
        @Override
        public boolean available() {
            return false;
        }

        @Override
        public String codeFor(String number, String random) {
            return null;
        }

        @Override
        public boolean send(String number, String code, String locale) {
            return false;
        }
    }

    /**
     * Sends nothing. A few named numbers, which are nobody's, take one
     * fixed code, the way the phone sign-ins of the large providers have
     * test numbers: the whole flow can be tried on a live business without
     * a sending account, and no real number can be signed in to, since no
     * other number is ever given a code.
     */
    final class Test implements CodeSender {
        private static final Logger LOG = Logger.getLogger(Test.class);

        private final Set<String> numbers;
        private final String code;

        Test(Set<String> numbers, String code) {
            this.numbers = numbers;
            this.code = code;
        }

        static CodeSender from(Config.Scope config) {
            String code = setting(config, "test-code", "");
            Set<String> numbers = Arrays.stream(setting(config, "test-numbers", "").split(","))
                    .map(Phone::international)
                    .filter(java.util.Objects::nonNull)
                    .collect(Collectors.toUnmodifiableSet());
            if (!code.matches("[0-9]{" + Phone.CODE_DIGITS + "}") || numbers.isEmpty()) {
                LOG.warnf("The test phone sender needs test-numbers and a %d digit test-code: the phone sign-in is off", Phone.CODE_DIGITS);
                return new None();
            }
            LOG.infof("Phone sign-in is in test mode: %d test numbers, no code is sent to any other", numbers.size());
            return new Test(numbers, code);
        }

        @Override
        public boolean available() {
            return true;
        }

        @Override
        public String codeFor(String number, String random) {
            return numbers.contains(number) ? code : null;
        }

        @Override
        public boolean send(String number, String code, String locale) {
            return numbers.contains(number);
        }
    }
}
