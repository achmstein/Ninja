package net.ninjapp.keycloak.pin;

import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.core.Response;

import org.keycloak.Config;
import org.keycloak.authentication.InitiatedActionSupport;
import org.keycloak.authentication.RequiredActionContext;
import org.keycloak.authentication.RequiredActionFactory;
import org.keycloak.authentication.RequiredActionProvider;
import org.keycloak.credential.CredentialProvider;
import org.keycloak.events.EventType;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.KeycloakSessionFactory;
import org.keycloak.models.UserModel;

/**
 * Where a cashier chooses their PIN: asked for by the till ("Set my PIN",
 * as kc_action) after they have signed in with their password, so nobody
 * but the cashier ever knows it, and nobody sets one for somebody else.
 *
 * An owner or admin has none to set: their account is never opened by a PIN.
 */
public class PinRequiredAction implements RequiredActionProvider, RequiredActionFactory {

    private static final String FORM = "ninja-pin-config.ftl";

    @Override
    public String getId() {
        return Pin.REQUIRED_ACTION_ID;
    }

    @Override
    public String getDisplayText() {
        return "Set a till PIN";
    }

    @Override
    public InitiatedActionSupport initiatedActionSupport() {
        return InitiatedActionSupport.SUPPORTED;
    }

    @Override
    public void evaluateTriggers(RequiredActionContext context) {
    }

    @Override
    public void requiredActionChallenge(RequiredActionContext context) {
        if (Pin.privileged(context.getRealm(), context.getUser())) {
            context.challenge(page(context, "ninjaPinNotForRole", true));
            return;
        }
        context.challenge(page(context, null, false));
    }

    @Override
    public void processAction(RequiredActionContext context) {
        UserModel user = context.getUser();
        if (Pin.privileged(context.getRealm(), user)) {
            // Shown the reason; pressing on only leaves
            user.removeRequiredAction(Pin.REQUIRED_ACTION_ID);
            context.success();
            return;
        }

        MultivaluedMap<String, String> form = context.getHttpRequest().getDecodedFormParameters();
        String pin = form.getFirst("pin");
        String again = form.getFirst("pinConfirm");
        String error = !Pin.wellFormed(pin) ? "ninjaPinFormat"
                : Pin.guessable(pin) ? "ninjaPinGuessable"
                : !pin.equals(again) ? "ninjaPinMismatch"
                : null;
        if (error != null) {
            context.challenge(page(context, error, false));
            return;
        }

        PinCredentialProvider provider = (PinCredentialProvider) context.getSession()
                .getProvider(CredentialProvider.class, PinCredentialProviderFactory.ID);
        provider.setPin(context.getRealm(), user, pin);
        context.getEvent().event(EventType.UPDATE_CREDENTIAL).detail("credential_type", Pin.TYPE).success();
        context.success();
    }

    private Response page(RequiredActionContext context, String error, boolean refused) {
        var form = context.form()
                .setAttribute("pinMinDigits", Pin.MIN_DIGITS)
                .setAttribute("pinMaxDigits", Pin.MAX_DIGITS)
                .setAttribute("pinRefused", refused);
        if (error != null) {
            form.setError(error, Pin.MIN_DIGITS, Pin.MAX_DIGITS);
        }
        return form.createForm(FORM);
    }

    @Override
    public RequiredActionProvider create(KeycloakSession session) {
        return this;
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
