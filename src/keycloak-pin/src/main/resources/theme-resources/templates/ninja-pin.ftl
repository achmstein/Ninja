<#import "template.ftl" as layout>
<#--
  The till's PIN: the cashier tapped their name on the till, and types their
  PIN here on the pad (or the keyboard). It goes in by itself once it is all
  typed. "Use my password" hands the sign-in to the ordinary form.
-->
<@layout.registrationLayout displayMessage=true; section>

    <#if section = "header">
        ${msg("ninjaPinTitle", pinName)}
    <#elseif section = "form">
        <link rel="stylesheet" href="${url.resourcesPath}/css/ninja-pin.css">
        <form action="${url.loginAction}" class="${properties.kcFormClass!}" id="ninja-pin-form" method="post" novalidate
              data-digits="${pinDigits}">
            <div class="${properties.kcFormGroupClass!}">
                <label for="pin" class="${properties.kcLabelClass!}">${msg("ninjaPinLabel")}</label>
                <div class="${properties.kcInputWrapperClass!}">
                    <input type="password" id="pin" name="pin" autocomplete="off" inputmode="numeric" pattern="[0-9]*" dir="ltr" autofocus
                           maxlength="${pinMaxDigits}" class="${properties.kcInputClass!} nj-input-code"/>
                </div>
            </div>

            <div class="nj-pin-pad" dir="ltr" aria-hidden="true">
                <#list 1..9 as digit>
                    <button type="button" class="${properties.kcButtonClass!} ${properties.kcButtonDefaultClass!} nj-pin-key" data-key="${digit}" tabindex="-1">${digit}</button>
                </#list>
                <span></span>
                <button type="button" class="${properties.kcButtonClass!} ${properties.kcButtonDefaultClass!} nj-pin-key" data-key="0" tabindex="-1">0</button>
                <button type="button" class="${properties.kcButtonClass!} ${properties.kcButtonDefaultClass!} nj-pin-key" data-key="back" tabindex="-1">&#9003;</button>
            </div>

            <div class="${properties.kcFormButtonsClass!}">
                <input type="submit" class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonBlockClass!}"
                       id="ninja-pin-submit" value="${msg("doLogIn")}"/>
                <button type="submit" class="${properties.kcButtonClass!} ${properties.kcButtonLinkClass!}" name="usePassword" value="true" formnovalidate>
                    ${msg("ninjaPinUsePassword")}
                </button>
            </div>
        </form>
        <script src="${url.resourcesPath}/js/ninja-pin.js"></script>
    </#if>
</@layout.registrationLayout>
