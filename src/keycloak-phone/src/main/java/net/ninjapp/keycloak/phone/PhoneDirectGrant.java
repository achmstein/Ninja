package net.ninjapp.keycloak.phone;

import java.util.List;

import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.core.Response;

import org.keycloak.Config;
import org.keycloak.authentication.AuthenticationFlowContext;
import org.keycloak.authentication.AuthenticationFlowError;
import org.keycloak.authentication.Authenticator;
import org.keycloak.authentication.AuthenticatorFactory;
import org.keycloak.events.Details;
import org.keycloak.events.Errors;
import org.keycloak.events.EventType;
import org.keycloak.models.AuthenticationExecutionModel.Requirement;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.KeycloakSessionFactory;
import org.keycloak.models.RealmModel;
import org.keycloak.models.UserModel;
import org.keycloak.provider.ProviderConfigProperty;
import org.keycloak.representations.idm.OAuth2ErrorRepresentation;

/**
 * The account by phone on the customers' app's own sign-in. The app signs
 * in by sending to the token endpoint (Keycloak's direct grant), on its own
 * screens, and a customer's number goes the same way, in two requests:
 *
 * <ol>
 * <li>{@code phone} alone: a code is sent to it, and the answer says so
 *     ({@code phone_code_sent}); no tokens.</li>
 * <li>{@code phone} and {@code code}: the right code signs the number's
 *     account in. A number with no account yet needs the name its owner
 *     gave too ({@code first_name}, {@code last_name}); without it the
 *     answer asks for it ({@code phone_name_needed}) and the code stays
 *     good, to be sent again with the name.</li>
 * </ol>
 *
 * With no {@code phone} in the request it steps aside and the username and
 * password take the sign-in, as they always did. Keycloak still does all of
 * it: the code is kept and counted in its own store, and the tokens are its
 * ordinary ones.
 */
public final class PhoneDirectGrant implements Authenticator, AuthenticatorFactory {

    static final String ID = "ninja-phone-direct-grant";

    private static final String PHONE = "phone";
    private static final String CODE = "code";
    private static final String FIRST_NAME = "first_name";
    private static final String LAST_NAME = "last_name";

    /** What the app is told, as the error's description: it has a sentence for each */
    static final String CODE_SENT = "phone_code_sent";
    static final String UNAVAILABLE = "phone_unavailable";
    static final String INVALID = "phone_invalid";
    static final String TOO_SOON = "phone_too_soon";
    static final String TOO_MANY = "phone_too_many";
    static final String CODE_WRONG = "phone_code_wrong";
    static final String CODE_GONE = "phone_code_gone";
    static final String NAME_NEEDED = "phone_name_needed";

    private static Response error(Response.Status status, String error, String description) {
        return Response.status(status)
                .entity(new OAuth2ErrorRepresentation(error, description))
                .type(MediaType.APPLICATION_JSON_TYPE)
                .build();
    }

    private static Response refused(String description) {
        return error(Response.Status.UNAUTHORIZED, "invalid_grant", description);
    }

    @Override
    public void authenticate(AuthenticationFlowContext context) {
        MultivaluedMap<String, String> form = context.getHttpRequest().getDecodedFormParameters();
        if (!form.containsKey(PHONE)) {
            context.attempted();
            return;
        }
        CodeSender sender = PhoneFormAuthenticatorFactory.sender();
        if (!sender.available()) {
            context.challenge(refused(UNAVAILABLE));
            return;
        }
        String number = Phone.international(form.getFirst(PHONE));
        if (number == null) {
            context.challenge(error(Response.Status.BAD_REQUEST, "invalid_request", INVALID));
            return;
        }

        KeycloakSession session = context.getSession();
        RealmModel realm = context.getRealm();
        PhoneCodes codes = new PhoneCodes(session, realm, sender);
        String typed = form.getFirst(CODE);
        if (typed == null) {
            String locale = session.getContext().resolveLocale(null).getLanguage();
            context.challenge(refused(switch (codes.send(number, locale)) {
                case OK -> CODE_SENT;
                case TOO_SOON -> TOO_SOON;
                case TOO_MANY -> TOO_MANY;
                case UNREACHABLE -> UNAVAILABLE;
            }));
            return;
        }

        UserModel user = PhoneAccounts.find(session, realm, number);
        String first = PhoneAccounts.namePart(form.getFirst(FIRST_NAME));
        String last = PhoneAccounts.namePart(form.getFirst(LAST_NAME));
        boolean named = first != null && last != null;
        // A number with no account and no name yet: the code is looked at and left, to come back with the name
        boolean spend = user != null || named;
        switch (codes.check(number, typed, spend)) {
            case WRONG -> {
                context.getEvent().detail(Details.USERNAME, number).error(Errors.INVALID_USER_CREDENTIALS);
                context.failure(AuthenticationFlowError.INVALID_CREDENTIALS, refused(CODE_WRONG));
            }
            case GONE -> context.challenge(refused(CODE_GONE));
            case RIGHT -> {
                if (user == null && !named) {
                    context.challenge(refused(NAME_NEEDED));
                    return;
                }
                if (user == null) {
                    user = PhoneAccounts.create(session, realm, number, first, last);
                    context.getEvent().clone().event(EventType.REGISTER).user(user)
                            .detail(Details.USERNAME, number)
                            .detail(Details.REGISTER_METHOD, "phone")
                            .success();
                } else if (!user.isEnabled()) {
                    context.getEvent().user(user).error(Errors.USER_DISABLED);
                    context.failure(AuthenticationFlowError.USER_DISABLED, error(Response.Status.BAD_REQUEST, "invalid_grant", "Account disabled"));
                    return;
                }
                context.setUser(user);
                context.success();
            }
        }
    }

    @Override
    public void action(AuthenticationFlowContext context) {
        authenticate(context);
    }

    @Override
    public String getId() {
        return ID;
    }

    @Override
    public Authenticator create(KeycloakSession session) {
        return this;
    }

    @Override
    public String getDisplayType() {
        return "Phone number and code (direct grant)";
    }

    @Override
    public String getHelpText() {
        return "Takes the 'phone' field: alone it sends a code, with 'code' it signs the number's account in. Steps aside when the request has no phone.";
    }

    @Override
    public String getReferenceCategory() {
        return "phone";
    }

    @Override
    public Requirement[] getRequirementChoices() {
        return new Requirement[] {Requirement.ALTERNATIVE, Requirement.DISABLED};
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
