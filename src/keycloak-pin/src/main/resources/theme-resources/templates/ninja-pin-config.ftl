<#import "template.ftl" as layout>
<#--
  Choosing the till's PIN: typed twice, by its owner, after their password.
-->
<@layout.registrationLayout displayMessage=true; section>

    <#if section = "header">
        ${msg("ninjaPinConfigTitle")}
    <#elseif section = "form">
        <form action="${url.loginAction}" class="${properties.kcFormClass!}" id="ninja-pin-config-form" method="post" novalidate>
                <p class="nj-note">${msg("ninjaPinConfigHint", pinMinDigits, pinMaxDigits)}</p>
                <div class="${properties.kcFormGroupClass!}">
                    <label for="pin" class="${properties.kcLabelClass!}">${msg("ninjaPinNew")}</label>
                    <div class="${properties.kcInputWrapperClass!}">
                        <input type="password" id="pin" name="pin" autocomplete="off" inputmode="numeric" pattern="[0-9]*" dir="ltr" autofocus
                               maxlength="${pinMaxDigits}" class="${properties.kcInputClass!} nj-input-code"/>
                    </div>
                </div>
                <div class="${properties.kcFormGroupClass!}">
                    <label for="pinConfirm" class="${properties.kcLabelClass!}">${msg("ninjaPinConfirm")}</label>
                    <div class="${properties.kcInputWrapperClass!}">
                        <input type="password" id="pinConfirm" name="pinConfirm" autocomplete="off" inputmode="numeric" pattern="[0-9]*" dir="ltr"
                               maxlength="${pinMaxDigits}" class="${properties.kcInputClass!} nj-input-code"/>
                    </div>
                </div>
                <div class="${properties.kcFormButtonsClass!}">
                    <input type="submit" class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonBlockClass!}"
                           value="${msg("doSubmit")}"/>
                    <#if isAppInitiatedAction??>
                        <button type="submit" class="${properties.kcButtonClass!} ${properties.kcButtonDefaultClass!} ${properties.kcButtonBlockClass!}"
                                name="cancel-aia" value="true" formnovalidate>${msg("doCancel")}</button>
                    </#if>
                </div>
        </form>
    </#if>
</@layout.registrationLayout>
