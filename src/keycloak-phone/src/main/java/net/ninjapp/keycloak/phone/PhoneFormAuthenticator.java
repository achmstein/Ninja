package net.ninjapp.keycloak.phone;

import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.core.Response;

import org.keycloak.authentication.AuthenticationFlowContext;
import org.keycloak.authentication.AuthenticationFlowError;
import org.keycloak.authentication.Authenticator;
import org.keycloak.authentication.authenticators.browser.AbstractUsernameFormAuthenticator;
import org.keycloak.events.Details;
import org.keycloak.events.Errors;
import org.keycloak.events.EventType;
import org.keycloak.forms.login.LoginFormsProvider;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;
import org.keycloak.models.UserModel;
import org.keycloak.protocol.oidc.OIDCLoginProtocol;
import org.keycloak.sessions.AuthenticationSessionModel;

/**
 * The step of the customers' sign-in that takes a phone number for an
 * account.
 *
 * It only ever offers itself: when the app named the customer by their
 * number (login_hint, in the international form the apps keep numbers in)
 * and there is a way to send a code. Then a code goes to that number and
 * this page asks for it. The right code signs the number's account in, or
 * makes it: with the name the app passed along (what the customer gave for
 * their order), or with the name the next page asks for. In every other
 * case it steps aside and Keycloak's own form takes the sign-in, as it does
 * when the customer asks to sign in another way.
 */
public class PhoneFormAuthenticator implements Authenticator {

    static final String CODE_FORM = "ninja-phone-code.ftl";
    static final String NAME_FORM = "ninja-phone-name.ftl";

    /** The number the code went to. */
    private static final String NOTE_NUMBER = "ninja-phone-number";
    /** The number whose code was right, while the name of its new account is asked for. */
    private static final String NOTE_PROVED = "ninja-phone-proved";
    /** Set once the customer asks to sign in another way: the phone is not offered again in this sign-in. */
    private static final String NOTE_OTHER_WAY = "ninja-phone-other-way";

    /** What the apps pass along of what the customer already gave (the login theme reads the same two). */
    private static final String FIRST_NAME_PARAM = "client_request_param_nj_first";
    private static final String LAST_NAME_PARAM = "client_request_param_nj_last";

    private final CodeSender sender;

    PhoneFormAuthenticator(CodeSender sender) {
        this.sender = sender;
    }

    @Override
    public void authenticate(AuthenticationFlowContext context) {
        String number = asked(context);
        if (number == null) {
            context.attempted();
            return;
        }
        AuthenticationSessionModel authSession = context.getAuthenticationSession();
        if (number.equals(authSession.getAuthNote(NOTE_PROVED))) {
            context.challenge(namePage(context, null, null, null));
            return;
        }

        PhoneCodes codes = codes(context);
        String error = null;
        // The page shown again (a reload, a step back) asks for the code already sent, not for another
        if (!number.equals(authSession.getAuthNote(NOTE_NUMBER)) || !codes.waiting(number)) {
            PhoneCodes.Sent sent = codes.send(number, locale(context));
            if (sent == PhoneCodes.Sent.UNREACHABLE) {
                // No code can reach this number: the ordinary form takes the sign-in
                context.attempted();
                return;
            }
            error = sent == PhoneCodes.Sent.TOO_MANY ? "ninjaPhoneTooMany" : null;
        }
        authSession.setAuthNote(NOTE_NUMBER, number);
        context.challenge(codePage(context, number, error, null));
    }

    @Override
    public void action(AuthenticationFlowContext context) {
        AuthenticationSessionModel authSession = context.getAuthenticationSession();
        MultivaluedMap<String, String> form = context.getHttpRequest().getDecodedFormParameters();
        String number = authSession.getAuthNote(NOTE_NUMBER);
        if (number == null || !sender.available()) {
            authenticate(context);
            return;
        }
        if (form.containsKey("otherWay")) {
            authSession.setAuthNote(NOTE_OTHER_WAY, "true");
            context.attempted();
            return;
        }

        if (number.equals(authSession.getAuthNote(NOTE_PROVED))) {
            named(context, number, form.getFirst("firstName"), form.getFirst("lastName"));
            return;
        }

        PhoneCodes codes = codes(context);
        if (form.containsKey("resend")) {
            PhoneCodes.Sent sent = codes.send(number, locale(context));
            switch (sent) {
                case OK -> context.challenge(codePage(context, number, null, "ninjaPhoneSentAgain"));
                case TOO_SOON -> context.challenge(codePage(context, number, "ninjaPhoneTooSoon", null));
                default -> context.challenge(codePage(context, number, "ninjaPhoneTooMany", null));
            }
            return;
        }

        switch (codes.check(number, form.getFirst("code"))) {
            case RIGHT -> proved(context, number);
            case WRONG -> {
                // Counted against the number's account when it has one, as a wrong password is
                authSession.setAuthNote(AbstractUsernameFormAuthenticator.ATTEMPTED_USERNAME, number);
                context.getEvent().detail(Details.USERNAME, number).error(Errors.INVALID_USER_CREDENTIALS);
                context.failureChallenge(AuthenticationFlowError.INVALID_CREDENTIALS, codePage(context, number, "ninjaPhoneWrong", null));
            }
            default -> context.challenge(codePage(context, number, "ninjaPhoneGone", null));
        }
    }

    /** The code was right: the number's account signs in, or is made. */
    private void proved(AuthenticationFlowContext context, String number) {
        KeycloakSession session = context.getSession();
        RealmModel realm = context.getRealm();
        UserModel user = PhoneAccounts.find(session, realm, number);
        if (user != null) {
            if (!user.isEnabled()) {
                context.getEvent().user(user).error(Errors.USER_DISABLED);
                context.failureChallenge(AuthenticationFlowError.USER_DISABLED, codePage(context, number, "accountDisabledMessage", null));
                return;
            }
            context.setUser(user);
            context.success();
            return;
        }

        AuthenticationSessionModel authSession = context.getAuthenticationSession();
        String first = PhoneAccounts.namePart(authSession.getClientNote(FIRST_NAME_PARAM));
        String last = PhoneAccounts.namePart(authSession.getClientNote(LAST_NAME_PARAM));
        if (first != null && last != null) {
            register(context, number, first, last);
            return;
        }
        // The number is theirs; its account still needs the name the business will call them by
        authSession.setAuthNote(NOTE_PROVED, number);
        context.challenge(namePage(context, first, last, null));
    }

    /** The name page came back: the account is made once both parts are there. */
    private void named(AuthenticationFlowContext context, String number, String firstName, String lastName) {
        String first = PhoneAccounts.namePart(firstName);
        String last = PhoneAccounts.namePart(lastName);
        if (first == null || last == null) {
            context.challenge(namePage(context, firstName, lastName, "ninjaPhoneNameMissing"));
            return;
        }
        // Proved a moment ago, and someone else may have made the number's account since
        UserModel user = PhoneAccounts.find(context.getSession(), context.getRealm(), number);
        if (user != null) {
            context.setUser(user);
            context.success();
            return;
        }
        register(context, number, first, last);
    }

    private void register(AuthenticationFlowContext context, String number, String first, String last) {
        UserModel user = PhoneAccounts.create(context.getSession(), context.getRealm(), number, first, last);
        context.getEvent().clone().event(EventType.REGISTER).user(user)
                .detail(Details.USERNAME, number)
                .detail(Details.REGISTER_METHOD, "phone")
                .success();
        context.setUser(user);
        context.success();
    }

    /** The number the app named, when a code may be sent to it in this sign-in; null to step aside. */
    private String asked(AuthenticationFlowContext context) {
        if (!sender.available()) {
            return null;
        }
        AuthenticationSessionModel authSession = context.getAuthenticationSession();
        if ("true".equals(authSession.getAuthNote(NOTE_OTHER_WAY))) {
            return null;
        }
        return Phone.international(authSession.getClientNote(OIDCLoginProtocol.LOGIN_HINT_PARAM));
    }

    private PhoneCodes codes(AuthenticationFlowContext context) {
        return new PhoneCodes(context.getSession(), context.getRealm(), sender);
    }

    private static String locale(AuthenticationFlowContext context) {
        return context.getSession().getContext().resolveLocale(context.getUser()).getLanguage();
    }

    private Response codePage(AuthenticationFlowContext context, String number, String error, String info) {
        LoginFormsProvider form = context.form()
                .setAttribute("phoneNumber", number)
                .setAttribute("phoneCodeDigits", Phone.CODE_DIGITS)
                .setAttribute("phoneResendWait", Phone.RESEND_WAIT);
        if (error != null) {
            form.setError(error);
        } else if (info != null) {
            form.setInfo(info);
        }
        return form.createForm(CODE_FORM);
    }

    private Response namePage(AuthenticationFlowContext context, String first, String last, String error) {
        LoginFormsProvider form = context.form()
                .setAttribute("phoneFirstName", first == null ? "" : first)
                .setAttribute("phoneLastName", last == null ? "" : last);
        if (error != null) {
            form.setError(error);
        }
        return form.createForm(NAME_FORM);
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
    public void close() {
    }
}
