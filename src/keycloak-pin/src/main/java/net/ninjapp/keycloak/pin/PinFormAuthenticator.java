package net.ninjapp.keycloak.pin;

import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.core.Response;

import org.keycloak.authentication.AuthenticationFlowContext;
import org.keycloak.authentication.AuthenticationFlowError;
import org.keycloak.authentication.Authenticator;
import org.keycloak.authentication.authenticators.browser.AbstractUsernameFormAuthenticator;
import org.keycloak.credential.CredentialProvider;
import org.keycloak.events.Errors;
import org.keycloak.forms.login.LoginFormsProvider;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;
import org.keycloak.models.UserCredentialModel;
import org.keycloak.models.UserModel;
import org.keycloak.models.utils.KeycloakModelUtils;
import org.keycloak.protocol.oidc.OIDCLoginProtocol;
import org.keycloak.sessions.AuthenticationSessionModel;

/**
 * The step of the till's sign-in that asks a cashier for their PIN.
 *
 * It only ever offers itself: when the till named the cashier (login_hint,
 * the name they tapped), that account has a PIN, and tries are left. In every other case it steps aside and the next step, Keycloak's
 * own username and password form, takes the sign-in, as it does when the
 * cashier asks for their password instead.
 *
 * A wrong PIN is reported the way a wrong password is, so Keycloak's
 * brute-force detection counts it and the event log shows it.
 */
public class PinFormAuthenticator implements Authenticator {

    static final String FORM = "ninja-pin.ftl";
    static final String FIELD = "pin";
    /** Set once the cashier asks for their password: the PIN is not offered again in this sign-in. */
    private static final String NOTE_USE_PASSWORD = "ninja-pin-use-password";

    @Override
    public void authenticate(AuthenticationFlowContext context) {
        UserModel user = candidate(context);
        if (user == null) {
            context.attempted();
            return;
        }
        // Who a wrong try is counted against (Keycloak reads this note)
        context.getAuthenticationSession().setAuthNote(AbstractUsernameFormAuthenticator.ATTEMPTED_USERNAME, user.getUsername());
        context.challenge(page(context, user, null));
    }

    @Override
    public void action(AuthenticationFlowContext context) {
        MultivaluedMap<String, String> form = context.getHttpRequest().getDecodedFormParameters();
        if (form.containsKey("usePassword")) {
            context.getAuthenticationSession().setAuthNote(NOTE_USE_PASSWORD, "true");
            context.attempted();
            return;
        }

        UserModel user = candidate(context);
        if (user == null) {
            // Locked, out of tries or changed since the page was shown: the password form says which
            context.attempted();
            return;
        }

        String typed = form.getFirst(FIELD);
        boolean valid = typed != null && user.credentialManager().isValid(new UserCredentialModel(null, Pin.TYPE, typed));
        if (!valid) {
            context.getEvent().user(user).error(Errors.INVALID_USER_CREDENTIALS);
            context.failureChallenge(AuthenticationFlowError.INVALID_CREDENTIALS, page(context, user, "ninjaPinInvalid"));
            return;
        }

        context.setUser(user);
        context.success();
    }

    /** The cashier the till named, when the PIN may be asked of them now; null to step aside. */
    private UserModel candidate(AuthenticationFlowContext context) {
        AuthenticationSessionModel authSession = context.getAuthenticationSession();
        if ("true".equals(authSession.getAuthNote(NOTE_USE_PASSWORD))) {
            return null;
        }
        String hint = authSession.getClientNote(OIDCLoginProtocol.LOGIN_HINT_PARAM);
        if (hint == null || hint.isBlank()) {
            return null;
        }
        KeycloakSession session = context.getSession();
        RealmModel realm = context.getRealm();
        UserModel user = KeycloakModelUtils.findUserByNameOrEmail(session, realm, hint.trim());
        if (user == null || !user.isEnabled()) {
            return null;
        }
        if (!provider(session).isConfiguredFor(realm, user, Pin.TYPE)) {
            return null;
        }
        if (context.getProtector().isPermanentlyLockedOut(session, realm, user)
                || context.getProtector().isTemporarilyDisabled(session, realm, user)
                || !Pin.triesLeft(session, realm, user)) {
            return null;
        }
        return user;
    }

    private Response page(AuthenticationFlowContext context, UserModel user, String error) {
        LoginFormsProvider form = context.form()
                .setAttribute("pinName", displayName(user))
                .setAttribute("pinDigits", provider(context.getSession()).digits(user))
                .setAttribute("pinMaxDigits", Pin.MAX_DIGITS);
        if (error != null) {
            form.setError(error);
        }
        return form.createForm(FORM);
    }

    private static String displayName(UserModel user) {
        String first = user.getFirstName();
        return first == null || first.isBlank() ? user.getUsername() : first.trim();
    }

    private static PinCredentialProvider provider(KeycloakSession session) {
        return (PinCredentialProvider) session.getProvider(CredentialProvider.class, PinCredentialProviderFactory.ID);
    }

    @Override
    public boolean requiresUser() {
        return false;
    }

    @Override
    public boolean configuredFor(KeycloakSession session, RealmModel realm, UserModel user) {
        return true;
    }

    @Override
    public void setRequiredActions(KeycloakSession session, RealmModel realm, UserModel user) {
        // A PIN is the cashier's to choose (PinRequiredAction); it is never forced on them
    }

    @Override
    public void close() {
    }
}
