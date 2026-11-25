package net.ninjapp.keycloak.pin;

import java.util.List;

import org.keycloak.Config;
import org.keycloak.authentication.Authenticator;
import org.keycloak.authentication.AuthenticatorFactory;
import org.keycloak.models.AuthenticationExecutionModel.Requirement;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.KeycloakSessionFactory;
import org.keycloak.models.RealmModel;
import org.keycloak.models.utils.KeycloakModelUtils;
import org.keycloak.models.utils.PostMigrationEvent;
import org.keycloak.provider.ProviderConfigProperty;

public class PinFormAuthenticatorFactory implements AuthenticatorFactory {

    private static final PinFormAuthenticator INSTANCE = new PinFormAuthenticator();

    @Override
    public String getId() {
        return Pin.AUTHENTICATOR_ID;
    }

    @Override
    public Authenticator create(KeycloakSession session) {
        return INSTANCE;
    }

    @Override
    public String getDisplayType() {
        return "Till PIN form";
    }

    @Override
    public String getHelpText() {
        return "Asks the cashier the till named (login_hint) for their PIN; steps aside for the password form when there is none to ask for.";
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
    public Requirement[] getRequirementChoices() {
        return new Requirement[] {Requirement.ALTERNATIVE, Requirement.DISABLED};
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

    /**
     * Every realm with a till gets its sign-in set up (PinFlowSetup): the
     * ones already there once the server is up, a new one as it is created.
     * No one has to click through the admin console for a new business.
     */
    @Override
    public void postInit(KeycloakSessionFactory factory) {
        factory.register(event -> {
            if (event instanceof PostMigrationEvent) {
                KeycloakModelUtils.runJobInTransaction(factory, session ->
                        session.realms().getRealmsStream().toList().forEach(realm -> PinFlowSetup.ensure(session, realm)));
            } else if (event instanceof RealmModel.RealmPostCreateEvent created) {
                PinFlowSetup.ensure(created.getKeycloakSession(), created.getCreatedRealm());
            }
        });
    }

    @Override
    public void close() {
    }
}
