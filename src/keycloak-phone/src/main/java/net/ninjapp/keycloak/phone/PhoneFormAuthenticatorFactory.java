package net.ninjapp.keycloak.phone;

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

public class PhoneFormAuthenticatorFactory implements AuthenticatorFactory {

    /** How codes are sent, read once from the server's configuration; the direct grant's steps share it. */
    private static volatile CodeSender sender = new CodeSender.None();

    static CodeSender sender() {
        return sender;
    }

    @Override
    public String getId() {
        return Phone.AUTHENTICATOR_ID;
    }

    @Override
    public Authenticator create(KeycloakSession session) {
        return new PhoneFormAuthenticator(sender);
    }

    @Override
    public String getDisplayType() {
        return "Phone number and code";
    }

    @Override
    public String getHelpText() {
        return "Signs a customer in by a code sent to the phone number the app named (login_hint), making their account the first time. Steps aside when no number was named or no code can be sent.";
    }

    @Override
    public String getReferenceCategory() {
        return "phone";
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
        sender = CodeSender.from(config);
    }

    /**
     * Every realm with a customers' app gets its sign-in set up
     * (PhoneFlowSetup): the ones already there once the server is up, a new
     * one as it is created. No one has to click through the admin console
     * for a new business.
     */
    @Override
    public void postInit(KeycloakSessionFactory factory) {
        factory.register(event -> {
            if (event instanceof PostMigrationEvent) {
                KeycloakModelUtils.runJobInTransaction(factory, session ->
                        session.realms().getRealmsStream().toList().forEach(realm -> PhoneFlowSetup.ensure(session, realm)));
            } else if (event instanceof RealmModel.RealmPostCreateEvent created) {
                PhoneFlowSetup.ensure(created.getKeycloakSession(), created.getCreatedRealm());
            }
        });
    }

    @Override
    public void close() {
    }
}
