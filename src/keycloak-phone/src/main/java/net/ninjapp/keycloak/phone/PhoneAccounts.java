package net.ninjapp.keycloak.phone;

import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;
import org.keycloak.models.UserModel;

/**
 * Whose account a proved number is, and making one for a number that has
 * none.
 *
 * An account belongs to a number only when the number was proved for it:
 * the accounts made here (their username is the number), and any other
 * whose number was marked verified. An account that merely has the number
 * typed into its profile is not it: anyone can type any number there, and
 * signing the number's real owner in to that account would hand them, and
 * what they order, to whoever made it.
 */
final class PhoneAccounts {
    private PhoneAccounts() {
    }

    /** The enabled account this proved number signs in to, or null when it has none yet. */
    static UserModel find(KeycloakSession session, RealmModel realm, String number) {
        UserModel own = session.users().getUserByUsername(realm, number);
        if (own != null) {
            return own;
        }
        return session.users().searchForUserByUserAttributeStream(realm, Phone.ATTRIBUTE, number)
                .filter(user -> "true".equals(user.getFirstAttribute(Phone.VERIFIED_ATTRIBUTE)))
                .findFirst()
                .orElse(null);
    }

    /** A new account for a number just proved, with the name its owner gave. */
    static UserModel create(KeycloakSession session, RealmModel realm, String number, String firstName, String lastName) {
        UserModel user = session.users().addUser(realm, number);
        user.setEnabled(true);
        user.setFirstName(firstName);
        user.setLastName(lastName);
        user.setSingleAttribute(Phone.ATTRIBUTE, number);
        user.setSingleAttribute(Phone.VERIFIED_ATTRIBUTE, "true");
        return user;
    }

    /** A name's part as it is kept: trimmed, and null when nothing was given or it is too long to be one. */
    static String namePart(String text) {
        if (text == null) {
            return null;
        }
        String part = text.trim();
        return part.isEmpty() || part.length() > 100 ? null : part;
    }
}
