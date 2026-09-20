<#import "template.ftl" as layout>
<#import "user-profile-commons.ftl" as userProfileCommons>
<#import "register-commons.ftl" as registerCommons>
<#--
  Registration mirrors the client app's form: Name, Email, Phone number,
  Password, Confirm password, all required. The first three come from the
  realm's user profile (order, labels and validation live there); the password
  pair follows them instead of sitting under the email as the base theme does.
  `novalidate` leaves validation to Keycloak so every error is rendered inline
  by the theme rather than as a browser tooltip.
-->
<#macro passwordField id label invalid>
    <div class="${properties.kcFormGroupClass!}">
        <div class="${properties.kcLabelWrapperClass!}">
            <label for="${id}" class="${properties.kcLabelClass!}">${label}</label> *
        </div>
        <div class="${properties.kcInputWrapperClass!}">
            <div class="${properties.kcInputGroup!}" dir="ltr">
                <input type="password" id="${id}" name="${id}" class="${properties.kcInputClass!}"
                       autocomplete="new-password" aria-invalid="<#if invalid>true</#if>"/>
                <button class="${properties.kcFormPasswordVisibilityButtonClass!}" type="button" aria-label="${msg('showPassword')}"
                        aria-controls="${id}" data-password-toggle
                        data-icon-show="${properties.kcFormPasswordVisibilityIconShow!}" data-icon-hide="${properties.kcFormPasswordVisibilityIconHide!}"
                        data-label-show="${msg('showPassword')}" data-label-hide="${msg('hidePassword')}">
                    <i class="${properties.kcFormPasswordVisibilityIconShow!}" aria-hidden="true"></i>
                </button>
            </div>
            <#if messagesPerField.existsError(id)>
                <span id="input-error-${id}" class="${properties.kcInputErrorMessageClass!}" aria-live="polite">
                    ${kcSanitize(messagesPerField.get(id))?no_esc}
                </span>
            </#if>
        </div>
    </div>
</#macro>

<@layout.registrationLayout displayMessage=messagesPerField.exists('global') displayInfo=true; section>
    <#if section = "header">
        <#if messageHeader??>
            ${kcSanitize(msg("${messageHeader}"))?no_esc}
        <#else>
            ${msg("registerTitle")}
        </#if>
    <#elseif section = "form">
        <form id="kc-register-form" class="${properties.kcFormClass!}" action="${url.registrationAction}" method="post" novalidate>
            <@userProfileCommons.userProfileFormFields/>

            <#if passwordRequired??>
                <@passwordField id="password" label=msg("password") invalid=messagesPerField.existsError('password', 'password-confirm')/>
                <@passwordField id="password-confirm" label=msg("passwordConfirm") invalid=messagesPerField.existsError('password-confirm')/>
            </#if>

            <@registerCommons.termsAcceptance/>

            <#if recaptchaRequired?? && (recaptchaVisible!false)>
                <div class="${properties.kcFormGroupClass!}">
                    <div class="g-recaptcha" data-size="compact" data-sitekey="${recaptchaSiteKey}" data-action="${recaptchaAction}"></div>
                </div>
            </#if>

            <div class="${properties.kcFormGroupClass!}">
                <#if recaptchaRequired?? && !(recaptchaVisible!false)>
                    <script>
                        function onSubmitRecaptcha(token) {
                            document.getElementById("kc-register-form").requestSubmit();
                        }
                    </script>
                    <div id="kc-form-buttons" class="${properties.kcFormButtonsClass!}">
                        <button class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonBlockClass!} g-recaptcha"
                                data-sitekey="${recaptchaSiteKey}" data-callback="onSubmitRecaptcha" data-action="${recaptchaAction}" type="submit">
                            ${msg("doRegister")}
                        </button>
                    </div>
                <#else>
                    <div id="kc-form-buttons" class="${properties.kcFormButtonsClass!}">
                        <input class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonBlockClass!}" type="submit" value="${msg("doRegister")}"/>
                    </div>
                </#if>
            </div>
        </form>
        <script type="module" src="${url.resourcesPath}/js/passwordVisibility.js"></script>
    <#elseif section = "info">
        <div id="kc-registration">
            <span>${msg("alreadyHaveAccount")} <a href="${url.loginUrl}">${msg("doLogIn")}</a></span>
        </div>
    </#if>
</@layout.registrationLayout>
