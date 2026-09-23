<#import "template.ftl" as layout>
<#import "password-commons.ftl" as passwordCommons>
<#--
  Authenticator setup, cut to what the step needs: the code to scan (or the
  key to type, one tap away), the code the app then shows, Continue. The base
  theme's numbered steps, its list of apps and the manual configuration values
  (the realm's policy is the apps' default: time-based, SHA1, 6 digits, 30 s)
  are gone. A device name is asked only when there is already one to tell it
  from, and "sign out other devices" only when the user chose to come here.
  Keycloak's "you need to set up…" warning restates the title and is not shown.
  The fields and hidden inputs are the ones Keycloak's handler reads.
-->
<@layout.registrationLayout displayRequiredFields=false displayMessage=!messagesPerField.existsError('totp','userLabel') && ((message.type)!'') != 'warning'; section>

    <#if section = "header">
        ${msg("loginTotpTitle")}
    <#elseif section = "form">
        <div class="nj-totp">
            <#if mode?? && mode = "manual">
                <p class="nj-note">${msg("loginTotpManualStep2")}</p>
                <code class="nj-totp-key" id="kc-totp-secret-key" dir="ltr">${totp.totpSecretEncoded}</code>
                <a href="${totp.qrUrl}" id="mode-barcode" class="nj-totp-switch">${msg("loginTotpScanBarcode")}</a>
            <#else>
                <p class="nj-note">${msg("loginTotpStep2")}</p>
                <img class="nj-totp-qr" id="kc-totp-secret-qr-code" src="data:image/png;base64, ${totp.totpSecretQrCode}" alt="${msg("loginTotpStep2")}">
                <a href="${totp.manualUrl}" id="mode-manual" class="nj-totp-switch">${msg("loginTotpUnableToScan")}</a>
            </#if>
        </div>

        <form action="${url.loginAction}" class="${properties.kcFormClass!}" id="kc-totp-settings-form" method="post" novalidate>
            <div class="${properties.kcFormGroupClass!}">
                <label for="totp" class="${properties.kcLabelClass!}">${msg("authenticatorCode")}</label>
                <div class="${properties.kcInputWrapperClass!}">
                    <input type="text" id="totp" name="totp" autocomplete="one-time-code" inputmode="numeric" dir="ltr" autofocus
                           maxlength="${totp.policy.digits}" class="${properties.kcInputClass!} nj-input-code"
                           aria-invalid="<#if messagesPerField.existsError('totp')>true</#if>"/>
                    <#if messagesPerField.existsError('totp')>
                        <span id="input-error-otp-code" class="${properties.kcInputErrorMessageClass!}" aria-live="polite">
                            ${kcSanitize(messagesPerField.get('totp'))?no_esc}
                        </span>
                    </#if>
                </div>
                <input type="hidden" id="totpSecret" name="totpSecret" value="${totp.totpSecret}"/>
                <#if mode??><input type="hidden" id="mode" name="mode" value="${mode}"/></#if>
            </div>

            <#if totp.otpCredentials?size gte 1>
                <div class="${properties.kcFormGroupClass!}">
                    <label for="userLabel" class="${properties.kcLabelClass!}">${msg("loginTotpDeviceName")}</label>
                    <div class="${properties.kcInputWrapperClass!}">
                        <input type="text" id="userLabel" name="userLabel" autocomplete="off" dir="auto" class="${properties.kcInputClass!}"
                               aria-invalid="<#if messagesPerField.existsError('userLabel')>true</#if>"/>
                        <#if messagesPerField.existsError('userLabel')>
                            <span id="input-error-otp-label" class="${properties.kcInputErrorMessageClass!}" aria-live="polite">
                                ${kcSanitize(messagesPerField.get('userLabel'))?no_esc}
                            </span>
                        </#if>
                    </div>
                </div>
            </#if>

            <#if isAppInitiatedAction??>
                <div class="${properties.kcFormGroupClass!}">
                    <@passwordCommons.logoutOtherSessions/>
                </div>
                <div class="${properties.kcFormButtonsClass!}">
                    <input type="submit" class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonBlockClass!}"
                           id="saveTOTPBtn" value="${msg("doSubmit")}"/>
                    <button type="submit" class="${properties.kcButtonClass!} ${properties.kcButtonDefaultClass!} ${properties.kcButtonBlockClass!}"
                            id="cancelTOTPBtn" name="cancel-aia" value="true">${msg("doCancel")}</button>
                </div>
            <#else>
                <input type="submit" class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonBlockClass!}"
                       id="saveTOTPBtn" value="${msg("doSubmit")}"/>
            </#if>
        </form>
    </#if>
</@layout.registrationLayout>
