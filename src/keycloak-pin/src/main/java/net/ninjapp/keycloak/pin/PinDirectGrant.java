package net.ninjapp.keycloak.pin;

import java.util.List;

import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.core.Response;

import org.keycloak.Config;
import org.keycloak.authentication.AuthenticationFlowContext;
import org.keycloak.authentication.AuthenticationFlowError;
import org.keycloak.authentication.Authenticator;
import org.keycloak.authentication.AuthenticatorFactory;
import org.keycloak.credential.CredentialProvider;
import org.keycloak.events.Errors;
import org.keycloak.events.EventType;
import org.keycloak.models.AuthenticationExecutionModel.Requirement;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.KeycloakSessionFactory;
import org.keycloak.models.RealmModel;
import org.keycloak.models.UserCredentialModel;
import org.keycloak.models.UserModel;
import org.keycloak.provider.ProviderConfigProperty;
import org.keycloak.representations.idm.OAuth2ErrorRepresentation;

/**
 * The PIN on the till app's own sign-in. The app signs in by sending the
 * username and password to the token endpoint (Keycloak's direct grant), and
 * a cashier taking over the till sends their username and PIN the same way:
 * the app has its own PIN pad and no browser page to wait for, which a
 * tablet locked to the till could not open anyway. Keycloak still does all
 * of it: the PIN is checked against the hash it keeps, wrong tries are
 * counted by its brute-force detection, and the tokens are its ordinary ones.
 *
 * Two steps of the till app's direct-grant flow (TillFlowSetup):
 * {@link Check} takes a PIN in place of the password, and {@link Choose},
 * last, lets someone who has just proved their password set their PIN in the
 * same request.
 */
public final class PinDirectGrant {
    private PinDirectGrant() {
    }

    static final String CHECK_ID = "ninja-pin-direct-grant";
    static final String CHOOSE_ID = "ninja-pin-choose-direct-grant";

    /** The request's fields, beside the grant's own username and password */
    private static final String PIN = "pin";
    private static final String NEW_PIN = "new_pin";
    private static final String PASSWORD = "password";

    /** What the app is told, as the error's description: it has a sentence for each */
    static final String PIN_UNAVAILABLE = "pin_unavailable";
    static final String PIN_WRONG = "pin_wrong";
    static final String PIN_NEEDS_PASSWORD = "pin_needs_password";
    static final String PIN_FORMAT = "pin_format";
    static final String PIN_GUESSABLE = "pin_guessable";

    private static Response error(Response.Status status, String error, String description) {
        return Response.status(status)
                .entity(new OAuth2ErrorRepresentation(error, description))
                .type(MediaType.APPLICATION_JSON_TYPE)
                .build();
    }

    private static PinCredentialProvider provider(KeycloakSession session) {
        return (PinCredentialProvider) session.getProvider(CredentialProvider.class, PinCredentialProviderFactory.ID);
    }

    /**
     * Takes a PIN in place of the password. With no PIN in the request it
     * steps aside and the password step takes the sign-in, as it always did.
     */
    public static final class Check extends Step {
        @Override
        public void authenticate(AuthenticationFlowContext context) {
            MultivaluedMap<String, String> form = context.getHttpRequest().getDecodedFormParameters();
            String typed = form.getFirst(PIN);
            if (typed == null) {
                context.attempted();
                return;
            }

            KeycloakSession session = context.getSession();
            RealmModel realm = context.getRealm();
            UserModel user = context.getUser();
            // No PIN to ask for, or no tries left: said without counting a wrong try, the password is the way in
            if (user == null || !provider(session).isConfiguredFor(realm, user, Pin.TYPE) || !Pin.triesLeft(session, realm, user)) {
                context.challenge(error(Response.Status.UNAUTHORIZED, "invalid_grant", PIN_UNAVAILABLE));
                return;
            }

            if (!user.credentialManager().isValid(new UserCredentialModel(null, Pin.TYPE, typed))) {
                context.getEvent().user(user).error(Errors.INVALID_USER_CREDENTIALS);
                context.failure(AuthenticationFlowError.INVALID_CREDENTIALS,
                        error(Response.Status.UNAUTHORIZED, "invalid_grant", PIN_WRONG));
                return;
            }
            context.success();
        }

        @Override
        public String getId() {
            return CHECK_ID;
        }

        @Override
        public String getDisplayType() {
            return "Till PIN (direct grant)";
        }

        @Override
        public String getHelpText() {
            return "Takes the 'pin' field in place of the password; steps aside when the request has none.";
        }

        @Override
        public Requirement[] getRequirementChoices() {
            return new Requirement[] {Requirement.ALTERNATIVE, Requirement.DISABLED};
        }
    }

    /**
     * Sets the PIN of whoever has just signed in with their password, when
     * the request carries a new one. Never on the strength of the old PIN:
     * a PIN somebody watched being typed must not be enough to replace it.
     */
    public static final class Choose extends Step {
        @Override
        public void authenticate(AuthenticationFlowContext context) {
            MultivaluedMap<String, String> form = context.getHttpRequest().getDecodedFormParameters();
            String chosen = form.getFirst(NEW_PIN);
            if (chosen == null) {
                context.success();
                return;
            }
            String problem = form.containsKey(PIN) || !form.containsKey(PASSWORD) ? PIN_NEEDS_PASSWORD
                    : !Pin.wellFormed(chosen) ? PIN_FORMAT
                    : Pin.guessable(chosen) ? PIN_GUESSABLE
                    : null;
            if (problem != null) {
                context.challenge(error(Response.Status.BAD_REQUEST, "invalid_request", problem));
                return;
            }
            provider(context.getSession()).setPin(context.getRealm(), context.getUser(), chosen);
            context.getEvent().clone().event(EventType.UPDATE_CREDENTIAL).user(context.getUser())
                    .detail("credential_type", Pin.TYPE).success();
            context.success();
        }

        @Override
        public String getId() {
            return CHOOSE_ID;
        }

        @Override
        public String getDisplayType() {
            return "Choose till PIN (direct grant)";
        }

        @Override
        public String getHelpText() {
            return "Sets the 'new_pin' field as the PIN of someone who signed in with their password in this request.";
        }

        @Override
        public Requirement[] getRequirementChoices() {
            return new Requirement[] {Requirement.REQUIRED, Requirement.DISABLED};
        }
    }

    /** What the two steps share: each is its own factory, has nothing to configure and acts on the user the flow found. */
    public abstract static class Step implements Authenticator, AuthenticatorFactory {
        @Override
        public Authenticator create(KeycloakSession session) {
            return this;
        }

        @Override
        public void action(AuthenticationFlowContext context) {
            authenticate(context);
        }

        @Override
        public boolean requiresUser() {
            return true;
        }

        @Override
        public boolean configuredFor(KeycloakSession session, RealmModel realm, UserModel user) {
            return true;
        }

        @Override
        public void setRequiredActions(KeycloakSession session, RealmModel realm, UserModel user) {
        }

        @Override
        public String getReferenceCategory() {
            return Pin.TYPE;
        }

        @Override
        public boolean isConfigurable() {
            return false;
        }

        @Override
        public boolean isUserSetupAllowed() {
            return false;
        }

        @Override
        public List<ProviderConfigProperty> getConfigProperties() {
            return List.of();
        }

        @Override
        public void init(Config.Scope config) {
        }

        @Override
        public void postInit(KeycloakSessionFactory factory) {
        }

        @Override
        public void close() {
        }
    }
}
