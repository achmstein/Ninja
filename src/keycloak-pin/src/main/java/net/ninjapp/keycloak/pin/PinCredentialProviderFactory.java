package net.ninjapp.keycloak.pin;

import org.keycloak.credential.CredentialProviderFactory;
import org.keycloak.models.KeycloakSession;

public class PinCredentialProviderFactory implements CredentialProviderFactory<PinCredentialProvider> {

    public static final String ID = Pin.TYPE;

    @Override
    public String getId() {
        return ID;
    }

    @Override
    public PinCredentialProvider create(KeycloakSession session) {
        return new PinCredentialProvider(session);
    }
}
