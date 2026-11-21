package net.ninjapp.keycloak.pin;

import org.jboss.logging.Logger;
import org.keycloak.models.AuthenticationExecutionModel;
import org.keycloak.models.AuthenticationExecutionModel.Requirement;
import org.keycloak.models.AuthenticationFlowModel;
import org.keycloak.models.ClientModel;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;
import org.keycloak.models.RequiredActionProviderModel;

/**
 * What a realm needs for the till's PIN, put in place once and left alone
 * after: the action in which a cashier chooses their PIN, and a sign-in flow
 * for the till alone.
 *
 * The till's flow is Keycloak's browser flow with one step added: after the
 * session cookie and before the username and password form, the PIN form.
 * It is bound to the tills' clients only (the web till and the app), so the admin, the kitchen screen
 * and the customers' apps sign in exactly as before. Password sign-in on the
 * till keeps its two-step code.
 */
final class TillFlowSetup {
    private TillFlowSetup() {
    }

    private static final Logger LOG = Logger.getLogger(TillFlowSetup.class);

    static final String FLOW = "till browser";
    static final String DIRECT_FLOW = "till direct grant";
    private static final String FORMS = "till browser forms";
    private static final String OTP = "till browser conditional otp";
    private static final String BASIC_FLOW = "basic-flow";

    static void ensure(KeycloakSession session, RealmModel realm) {
        java.util.List<ClientModel> tills = Pin.TILL_CLIENTS.stream()
                .map(realm::getClientByClientId)
                .filter(java.util.Objects::nonNull)
                .toList();
        if (tills.isEmpty()) {
            return;
        }
        try {
            ensureRequiredAction(realm);
            AuthenticationFlowModel flow = realm.getFlowByAlias(FLOW);
            if (flow == null) {
                flow = createFlow(realm);
                LOG.infof("Till sign-in flow created in realm %s", realm.getName());
            }
            for (ClientModel till : tills) {
                if (!flow.getId().equals(till.getAuthenticationFlowBindingOverride("browser"))) {
                    till.setAuthenticationFlowBindingOverride("browser", flow.getId());
                }
            }

            ClientModel app = realm.getClientByClientId(Pin.TILL_APP_CLIENT);
            if (app != null) {
                AuthenticationFlowModel direct = realm.getFlowByAlias(DIRECT_FLOW);
                if (direct == null) {
                    direct = createDirectFlow(realm);
                    LOG.infof("Till app sign-in flow created in realm %s", realm.getName());
                }
                if (!direct.getId().equals(app.getAuthenticationFlowBindingOverride("direct_grant"))) {
                    app.setAuthenticationFlowBindingOverride("direct_grant", direct.getId());
                }
            }
        } catch (RuntimeException e) {
            // A realm without the PIN signs in with passwords as before; the others are still set up
            LOG.errorf(e, "Could not set up the till PIN in realm %s", realm.getName());
        }
    }

    private static void ensureRequiredAction(RealmModel realm) {
        if (realm.getRequiredActionProviderByAlias(Pin.REQUIRED_ACTION_ID) != null) {
            return;
        }
        RequiredActionProviderModel action = new RequiredActionProviderModel();
        action.setAlias(Pin.REQUIRED_ACTION_ID);
        action.setProviderId(Pin.REQUIRED_ACTION_ID);
        action.setName("Set a till PIN");
        action.setEnabled(true);
        action.setDefaultAction(false);
        action.setPriority(1000);
        realm.addRequiredActionProvider(action);
    }

    /**
     * cookie | PIN form | ( username and password, then the two-step code
     * when the account has one ): the built-in browser flow's shape.
     */
    private static AuthenticationFlowModel createFlow(RealmModel realm) {
        AuthenticationFlowModel flow = addFlow(realm, FLOW, "The till's sign-in: the browser flow, with a cashier's PIN before the password", true);
        addStep(realm, flow, "auth-cookie", Requirement.ALTERNATIVE, 10);
        addStep(realm, flow, Pin.AUTHENTICATOR_ID, Requirement.ALTERNATIVE, 20);

        AuthenticationFlowModel forms = addFlow(realm, FORMS, "Username, password and the two-step code", false);
        addSubFlow(realm, flow, forms, Requirement.ALTERNATIVE, 30);
        addStep(realm, forms, "auth-username-password-form", Requirement.REQUIRED, 10);

        AuthenticationFlowModel otp = addFlow(realm, OTP, "The two-step code, for an account that has one", false);
        addSubFlow(realm, forms, otp, Requirement.CONDITIONAL, 20);
        addStep(realm, otp, "conditional-user-configured", Requirement.REQUIRED, 10);
        addStep(realm, otp, "auth-otp-form", Requirement.REQUIRED, 20);
        return flow;
    }

    /**
     * The till app's own sign-in, Keycloak's direct grant with the PIN let
     * in: username, then ( PIN | password and the two-step code when the
     * account has one ), then the PIN being chosen, when one was sent.
     */
    private static AuthenticationFlowModel createDirectFlow(RealmModel realm) {
        AuthenticationFlowModel flow = addFlow(realm, DIRECT_FLOW, "The till app's sign-in: the direct grant, with a PIN in place of the password", true);
        addStep(realm, flow, "direct-grant-validate-username", Requirement.REQUIRED, 10);

        AuthenticationFlowModel credential = addFlow(realm, DIRECT_FLOW + " credential", "A PIN, or the password", false);
        addSubFlow(realm, flow, credential, Requirement.REQUIRED, 20);
        addStep(realm, credential, PinDirectGrant.CHECK_ID, Requirement.ALTERNATIVE, 10);

        AuthenticationFlowModel password = addFlow(realm, DIRECT_FLOW + " password", "The password and the two-step code", false);
        addSubFlow(realm, credential, password, Requirement.ALTERNATIVE, 20);
        addStep(realm, password, "direct-grant-validate-password", Requirement.REQUIRED, 10);

        AuthenticationFlowModel otp = addFlow(realm, DIRECT_FLOW + " conditional otp", "The two-step code, for an account that has one", false);
        addSubFlow(realm, password, otp, Requirement.CONDITIONAL, 20);
        addStep(realm, otp, "conditional-user-configured", Requirement.REQUIRED, 10);
        addStep(realm, otp, "direct-grant-validate-otp", Requirement.REQUIRED, 20);

        addStep(realm, flow, PinDirectGrant.CHOOSE_ID, Requirement.REQUIRED, 30);
        return flow;
    }

    private static AuthenticationFlowModel addFlow(RealmModel realm, String alias, String description, boolean topLevel) {
        AuthenticationFlowModel flow = new AuthenticationFlowModel();
        flow.setAlias(alias);
        flow.setDescription(description);
        flow.setProviderId(BASIC_FLOW);
        flow.setTopLevel(topLevel);
        flow.setBuiltIn(false);
        return realm.addAuthenticationFlow(flow);
    }

    private static void addStep(RealmModel realm, AuthenticationFlowModel parent, String authenticator, Requirement requirement, int priority) {
        AuthenticationExecutionModel execution = new AuthenticationExecutionModel();
        execution.setParentFlow(parent.getId());
        execution.setAuthenticator(authenticator);
        execution.setAuthenticatorFlow(false);
        execution.setRequirement(requirement);
        execution.setPriority(priority);
        realm.addAuthenticatorExecution(execution);
    }

    private static void addSubFlow(RealmModel realm, AuthenticationFlowModel parent, AuthenticationFlowModel child, Requirement requirement, int priority) {
        AuthenticationExecutionModel execution = new AuthenticationExecutionModel();
        execution.setParentFlow(parent.getId());
        execution.setFlowId(child.getId());
        execution.setAuthenticatorFlow(true);
        execution.setRequirement(requirement);
        execution.setPriority(priority);
        realm.addAuthenticatorExecution(execution);
    }
}
