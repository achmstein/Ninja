package net.ninjapp.keycloak.pin;

import org.keycloak.common.util.Time;
import org.keycloak.credential.CredentialInput;
import org.keycloak.credential.CredentialInputValidator;
import org.keycloak.credential.CredentialModel;
import org.keycloak.credential.CredentialProvider;
import org.keycloak.credential.CredentialTypeMetadata;
import org.keycloak.credential.CredentialTypeMetadataContext;
import org.keycloak.credential.hash.PasswordHashProvider;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.PasswordPolicy;
import org.keycloak.models.RealmModel;
import org.keycloak.models.UserModel;
import org.keycloak.models.credential.PasswordCredentialModel;

/**
 * The PIN as a Keycloak credential, kept beside the account's password and
 * removable from the admin console like any other.
 *
 * It is hashed exactly as a password is: by the realm's password hasher,
 * with the realm's iterations, into the same stored form. Only the type
 * differs, so it is never mistaken for the password.
 */
public class PinCredentialProvider implements CredentialProvider<CredentialModel>, CredentialInputValidator {

    private static final String DIGITS_LABEL = " digits";

    private final KeycloakSession session;

    public PinCredentialProvider(KeycloakSession session) {
        this.session = session;
    }

    @Override
    public String getType() {
        return Pin.TYPE;
    }

    /** Replaces the account's PIN with this one. */
    public void setPin(RealmModel realm, UserModel user, String pin) {
        PasswordPolicy policy = realm.getPasswordPolicy();
        PasswordCredentialModel hashed = hasher(policy).encodedCredential(pin, policy.getHashIterations());

        CredentialModel model = new CredentialModel();
        model.setType(Pin.TYPE);
        model.setCreatedDate(Time.currentTimeMillis());
        model.setCredentialData(hashed.getCredentialData());
        model.setSecretData(hashed.getSecretData());
        // Only its length is kept readable, so the sign-in page knows when the PIN is all typed
        model.setUserLabel(pin.length() + DIGITS_LABEL);

        removePin(user);
        createCredential(realm, user, model);
    }

    /** The hasher the realm's passwords get: the policy's when it names one, Keycloak's default otherwise. */
    private PasswordHashProvider hasher(PasswordPolicy policy) {
        if (policy.getHashAlgorithm() != null) {
            PasswordHashProvider named = session.getProvider(PasswordHashProvider.class, policy.getHashAlgorithm());
            if (named != null) {
                return named;
            }
        }
        return session.getProvider(PasswordHashProvider.class);
    }

    public void removePin(UserModel user) {
        user.credentialManager().getStoredCredentialsByTypeStream(Pin.TYPE).toList()
                .forEach(stored -> user.credentialManager().removeStoredCredentialById(stored.getId()));
    }

    /** How many digits the account's PIN has, so the page knows when it is all typed; 0 without one. */
    public int digits(UserModel user) {
        return user.credentialManager().getStoredCredentialsByTypeStream(Pin.TYPE)
                .findFirst()
                .map(CredentialModel::getUserLabel)
                .map(PinCredentialProvider::parseDigits)
                .orElse(0);
    }

    private static int parseDigits(String label) {
        if (label == null || !label.endsWith(DIGITS_LABEL)) {
            return 0;
        }
        try {
            return Integer.parseInt(label.substring(0, label.length() - DIGITS_LABEL.length()));
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    @Override
    public CredentialModel createCredential(RealmModel realm, UserModel user, CredentialModel credentialModel) {
        return user.credentialManager().createStoredCredential(credentialModel);
    }

    @Override
    public boolean deleteCredential(RealmModel realm, UserModel user, String credentialId) {
        return user.credentialManager().removeStoredCredentialById(credentialId);
    }

    @Override
    public CredentialModel getCredentialFromModel(CredentialModel model) {
        return model;
    }

    @Override
    public CredentialTypeMetadata getCredentialTypeMetadata(CredentialTypeMetadataContext metadataContext) {
        return CredentialTypeMetadata.builder()
                .type(getType())
                .category(CredentialTypeMetadata.Category.BASIC_AUTHENTICATION)
                .displayName("ninjaPinDisplayName")
                .helpText("ninjaPinHelpText")
                .createAction(Pin.REQUIRED_ACTION_ID)
                .removeable(true)
                .build(session);
    }

    @Override
    public boolean supportsCredentialType(String credentialType) {
        return Pin.TYPE.equals(credentialType);
    }

    @Override
    public boolean isConfiguredFor(RealmModel realm, UserModel user, String credentialType) {
        return supportsCredentialType(credentialType)
                && user.credentialManager().getStoredCredentialsByTypeStream(Pin.TYPE).findAny().isPresent();
    }

    @Override
    public boolean isValid(RealmModel realm, UserModel user, CredentialInput input) {
        if (!supportsCredentialType(input.getType())) {
            return false;
        }
        String typed = input.getChallengeResponse();
        if (!Pin.wellFormed(typed)) {
            return false;
        }
        CredentialModel stored = user.credentialManager().getStoredCredentialsByTypeStream(Pin.TYPE).findFirst().orElse(null);
        if (stored == null) {
            return false;
        }
        // Read back as the password it was hashed as, and checked by the hasher that made it
        PasswordCredentialModel hashed = PasswordCredentialModel.createFromCredentialModel(stored);
        PasswordHashProvider hasher = session.getProvider(PasswordHashProvider.class,
                hashed.getPasswordCredentialData().getAlgorithm());
        return hasher != null && hasher.verify(typed, hashed);
    }
}
