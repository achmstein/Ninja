<#import "template.ftl" as layout>
<#--
  The account by phone, its last step for a number that is new here: the
  name the business will call the customer by. First and last, as the
  realm's profile keeps them; what the app already knew of it is filled in.
-->
<@layout.registrationLayout displayMessage=true; section>

    <#if section = "header">
        ${msg("ninjaPhoneNameTitle")}
    <#elseif section = "form">
        <link rel="stylesheet" href="${url.resourcesPath}/css/ninja-phone.css">
        <p class="nj-phone-hint">${msg("ninjaPhoneNameHint")}</p>
        <form action="${url.loginAction}" class="${properties.kcFormClass!}" method="post" novalidate>
            <div class="${properties.kcFormGroupClass!}">
                <label for="firstName" class="${properties.kcLabelClass!}">${msg("firstName")}</label>
                <div class="${properties.kcInputWrapperClass!}">
                    <input type="text" id="firstName" name="firstName" value="${phoneFirstName}" autocomplete="given-name" maxlength="100"
                           <#if !phoneFirstName?has_content>autofocus</#if> class="${properties.kcInputClass!}"/>
                </div>
            </div>
            <div class="${properties.kcFormGroupClass!}">
                <label for="lastName" class="${properties.kcLabelClass!}">${msg("lastName")}</label>
                <div class="${properties.kcInputWrapperClass!}">
                    <input type="text" id="lastName" name="lastName" value="${phoneLastName}" autocomplete="family-name" maxlength="100"
                           <#if phoneFirstName?has_content>autofocus</#if> class="${properties.kcInputClass!}"/>
                </div>
            </div>

            <div class="${properties.kcFormButtonsClass!}">
                <input type="submit" class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonBlockClass!}"
                       value="${msg("doContinue")}"/>
            </div>
        </form>
    </#if>
</@layout.registrationLayout>
