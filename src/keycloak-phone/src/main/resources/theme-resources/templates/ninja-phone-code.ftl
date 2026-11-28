<#import "template.ftl" as layout>
<#--
  The account by phone: a code went to the number the customer gave in the
  app, and they type it here. It goes in by itself once it is all typed (and
  the phone's own code suggestion fills it). Another code can be asked for
  after a minute; "sign in another way" hands the sign-in to the ordinary form.
-->
<@layout.registrationLayout displayMessage=true; section>

    <#if section = "header">
        ${msg("ninjaPhoneCodeTitle")}
    <#elseif section = "form">
        <link rel="stylesheet" href="${url.resourcesPath}/css/ninja-phone.css">
        <p class="nj-phone-hint">${msg("ninjaPhoneCodeHint")} <bdi dir="ltr"><strong>${phoneNumber}</strong></bdi></p>
        <form action="${url.loginAction}" class="${properties.kcFormClass!}" id="ninja-phone-form" method="post" novalidate
              data-digits="${phoneCodeDigits}" data-wait="${phoneResendWait}">
            <div class="${properties.kcFormGroupClass!}">
                <label for="code" class="${properties.kcLabelClass!}">${msg("ninjaPhoneCodeLabel")}</label>
                <div class="${properties.kcInputWrapperClass!}">
                    <input type="text" id="code" name="code" autocomplete="one-time-code" inputmode="numeric" pattern="[0-9]*" dir="ltr" autofocus
                           maxlength="${phoneCodeDigits}" class="${properties.kcInputClass!} nj-input-code"/>
                </div>
            </div>

            <div class="${properties.kcFormButtonsClass!}">
                <input type="submit" class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonBlockClass!}"
                       id="ninja-phone-submit" value="${msg("doContinue")}"/>
                <button type="submit" class="${properties.kcButtonClass!} ${properties.kcButtonLinkClass!}" id="ninja-phone-resend" name="resend" value="true" formnovalidate>
                    ${msg("ninjaPhoneResend")}
                </button>
                <button type="submit" class="${properties.kcButtonClass!} ${properties.kcButtonLinkClass!}" name="otherWay" value="true" formnovalidate>
                    ${msg("ninjaPhoneOtherWay")}
                </button>
            </div>
        </form>
        <script src="${url.resourcesPath}/js/ninja-phone.js"></script>
    </#if>
</@layout.registrationLayout>
