package net.ninjapp.keycloak.phone;

import org.jboss.logging.Logger;
import org.keycloak.models.AuthenticationExecutionModel;
import org.keycloak.models.AuthenticationExecutionModel.Requirement;
import org.keycloak.models.AuthenticationFlowModel;
import org.keycloak.models.ClientModel;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;

/**
 * What a realm needs for the account by phone, put in place once and left
 * alone after: the customers' browser sign-in flow, and the direct-grant
 * flow of the customers' app, which signs in on its own screens. The flows
 * keep their first aliases ("customer browser", "customer direct grant"): a
 * realm finds them by those, and a new alias would build a second flow
 * beside the first.
 *
 * The browser flow is Keycloak's own with one step added: after the session
 * cookie and the business's Google or Apple, and before the username and
 * password form, the phone's code. It is bound to the customers' web app
 * only, so the staff's apps sign in exactly as before; and the step stands
 * aside unless the app named a number and a code can be sent, so the
 * customers' own sign-in is as it was until then.
 */
final class PhoneFlowSetup {
    private PhoneFlowSetup() {
    }

    private static final Logger LOG = Logger.getLogger(PhoneFlowSetup.class);

    static final String FLOW = "customer browser";
    static final String DIRECT_FLOW = "customer direct grant";
    private static final String BASIC_FLOW = "basic-flow";

    static void ensure(KeycloakSession session, RealmModel realm) {
        try {
            for (String clientId : Phone.BROWSER_CLIENTS) {
                ClientModel client = realm.getClientByClientId(clientId);
                if (client == null) {
                    continue;
                }
                AuthenticationFlowModel flow = realm.getFlowByAlias(FLOW);
                if (flow == null) {
                    flow = createFlow(realm);
                    LOG.infof("Customer sign-in flow created in realm %s", realm.getName());
                }
                if (!flow.getId().equals(client.getAuthenticationFlowBindingOverride("browser"))) {
                    client.setAuthenticationFlowBindingOverride("browser", flow.getId());
                }
            }

            for (String clientId : Phone.DIRECT_GRANT_CLIENTS) {
                ClientModel app = realm.getClientByClientId(clientId);
                if (app == null) {
                    continue;
                }
                AuthenticationFlowModel direct = realm.getFlowByAlias(DIRECT_FLOW);
                if (direct == null) {
                    direct = createDirectFlow(realm);
                    LOG.infof("Customer app sign-in flow created in realm %s", realm.getName());
                }
                if (!direct.getId().equals(app.getAuthenticationFlowBindingOverride("direct_grant"))) {
                    app.setAuthenticationFlowBindingOverride("direct_grant", direct.getId());
                }
            }
        } catch (RuntimeException e) {
            // A realm without it signs in as before; the others are still set up
            LOG.errorf(e, "Could not set up the phone sign-in in realm %s", realm.getName());
        }
    }

    /**
     * cookie | Google or Apple | the phone's code | ( username and password,
     * then the two-step code when the account has one ): the built-in
     * browser flow's shape.
     */
    private static AuthenticationFlowModel createFlow(RealmModel realm) {
        AuthenticationFlowModel flow = addFlow(realm, FLOW, "The customers' sign-in: the browser flow, with a phone number's code before the password", true);
        addStep(realm, flow, "auth-cookie", Requirement.ALTERNATIVE, 10);
        addStep(realm, flow, "identity-provider-redirector", Requirement.ALTERNATIVE, 20);
        addStep(realm, flow, Phone.AUTHENTICATOR_ID, Requirement.ALTERNATIVE, 25);

        AuthenticationFlowModel forms = addFlow(realm, FLOW + " forms", "Username, password and the two-step code", false);
        addSubFlow(realm, flow, forms, Requirement.ALTERNATIVE, 30);
        addStep(realm, forms, "auth-username-password-form", Requirement.REQUIRED, 10);

        AuthenticationFlowModel otp = addFlow(realm, FLOW + " conditional otp", "The two-step code, for an account that has one", false);
        addSubFlow(realm, forms, otp, Requirement.CONDITIONAL, 20);
        addStep(realm, otp, "conditional-user-configured", Requirement.REQUIRED, 10);
        addStep(realm, otp, "auth-otp-form", Requirement.REQUIRED, 20);
        return flow;
    }

    /**
     * The customers' app's own sign-in, Keycloak's direct grant with the
     * phone let in: ( a phone number and its code | username, password and
     * the two-step code when the account has one ).
     */
    private static AuthenticationFlowModel createDirectFlow(RealmModel realm) {
        AuthenticationFlowModel flow = addFlow(realm, DIRECT_FLOW, "The customers' app's sign-in: the direct grant, with a phone number's code in place of the password", true);
        addStep(realm, flow, PhoneDirectGrant.ID, Requirement.ALTERNATIVE, 10);

        AuthenticationFlowModel password = addFlow(realm, DIRECT_FLOW + " password", "Username, password and the two-step code", false);
        addSubFlow(realm, flow, password, Requirement.ALTERNATIVE, 20);
        addStep(realm, password, "direct-grant-validate-username", Requirement.REQUIRED, 10);
        addStep(realm, password, "direct-grant-validate-password", Requirement.REQUIRED, 20);

        AuthenticationFlowModel otp = addFlow(realm, DIRECT_FLOW + " conditional otp", "The two-step code, for an account that has one", false);
        addSubFlow(realm, password, otp, Requirement.CONDITIONAL, 30);
        addStep(realm, otp, "conditional-user-configured", Requirement.REQUIRED, 10);
        addStep(realm, otp, "direct-grant-validate-otp", Requirement.REQUIRED, 20);
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
