<#import "footer.ftl" as loginFooter>
<#--
  The page frame every login-flow template renders into: the café's mark and
  name above a shadcn-style card, in the platform's slate palette. One theme
  serves every realm: the realm's display name is the café's name and its
  HTML display name is the café's mark (the control plane points it at the
  tenant's icon). Light or dark
  follows the app the user came from (the `theme` query parameter on the
  redirect, remembered in a cookie for the later pages of the flow), then
  the system preference. Language follows `ui_locales`.
-->
<#macro registrationLayout bodyClass="" displayInfo=false displayMessage=true displayRequiredFields=false>
<!DOCTYPE html>
<html class="${properties.kcHtmlClass!}" lang="${lang}"<#if realm.internationalizationEnabled> dir="${(locale.rtl)?then('rtl','ltr')}"</#if>>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light dark">
    <meta name="robots" content="noindex, nofollow">
    <title>${msg("loginTitle",(realm.displayName!'')?trim)}</title>
    <#-- The platform's N tile; the café's own icon is what the header shows -->
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%2318181b'/%3E%3Ctext x='32' y='45' text-anchor='middle' font-family='Inter,system-ui,sans-serif' font-size='36' font-weight='700' fill='%23fff'%3EN%3C/text%3E%3C/svg%3E">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Cairo:wght@400;500;600;700&display=swap" rel="stylesheet">
    <#if properties.styles?has_content>
        <#list properties.styles?split(' ') as style>
            <#-- Versioned: Keycloak's resource path never changes when the
                 theme does, and browsers keep the stylesheet for 30 days -->
            <link href="${url.resourcesPath}/${style}?v=${properties.themeVersion!'1'}" rel="stylesheet">
        </#list>
    </#if>
    <script>
        // Before first paint: the theme the app asked for, else the one
        // remembered earlier in this flow, else the system preference
        (function () {
            var asked = new URLSearchParams(location.search).get('theme');
            var theme = asked === 'light' || asked === 'dark' ? asked : null;
            if (theme) {
                document.cookie = 'nj_theme=' + theme + '; path=/; max-age=3600; SameSite=Lax';
            } else {
                var saved = document.cookie.match(/(?:^|; )nj_theme=(light|dark)/);
                theme = saved ? saved[1] : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
            }
            document.documentElement.dataset.theme = theme;
        })();
    </script>
    <script type="importmap">
        {
            "imports": {
                "rfc4648": "${url.resourcesCommonPath}/vendor/rfc4648/rfc4648.js"
            }
        }
    </script>
    <#if properties.scripts?has_content>
        <#list properties.scripts?split(' ') as script>
            <script src="${url.resourcesPath}/${script}" type="text/javascript"></script>
        </#list>
    </#if>
    <#if scripts??>
        <#list scripts as script>
            <script src="${script}" type="text/javascript"></script>
        </#list>
    </#if>
    <script type="module" src="${url.resourcesPath}/js/passwordVisibility.js"></script>
    <script type="module">
        import { startSessionPolling } from "${url.resourcesPath}/js/authChecker.js";
        startSessionPolling("${url.ssoLoginInOtherTabsUrl?no_esc}");
    </script>
    <script type="module">
        // A social button may be pressed once; the second press is ignored
        document.addEventListener("click", (event) => {
            const link = event.target.closest("a[data-once-link]");
            if (!link) return;
            if (link.getAttribute("aria-disabled") === "true") {
                event.preventDefault();
                return;
            }
            const { disabledClass } = link.dataset;
            if (disabledClass) link.classList.add(...disabledClass.trim().split(/\s+/));
            link.setAttribute("role", "link");
            link.setAttribute("aria-disabled", "true");
        });
    </script>
    <#if authenticationSession??>
        <script type="module">
            import { checkAuthSession } from "${url.resourcesPath}/js/authChecker.js";
            checkAuthSession("${authenticationSession.authSessionIdHash}");
        </script>
    </#if>
</head>

<body class="${properties.kcBodyClass!} ${bodyClass}" data-page-id="login-${pageId}">
<main class="nj-page">
    <header class="nj-brand">
        <#-- Keycloak hands back the display name when no HTML one is set, so a
             realm the control plane did not stamp gets a tile with its initial.
             The HTML is the platform's own (an <img> at the tenant's icon), so
             it is trusted as written. -->
        <#if (realm.displayNameHtml)?has_content && realm.displayNameHtml != realm.displayName>
            <div class="nj-mark">${realm.displayNameHtml?no_esc}</div>
        <#elseif realm.displayName?trim?has_content>
            <div class="nj-mark nj-mark-tile" aria-hidden="true">${realm.displayName?trim[0..0]?upper_case}</div>
        </#if>
        <span class="nj-brand-name">${(realm.displayName!'')?trim}</span>
    </header>

    <section class="nj-card">
        <div class="nj-card-header">
            <h1 class="nj-title" id="kc-page-title"><#nested "header"></h1>
        </div>

        <div class="nj-card-body">
            <#-- A flow past its first step shows who is signing in, with a way to start over -->
            <#if auth?has_content && auth.showUsername() && !auth.showResetCredentials()>
                <div class="nj-field">
                    <label class="nj-label" for="kc-attempted-username"><#if !realm.loginWithEmailAllowed>${msg("username")}<#elseif !realm.registrationEmailAsUsername>${msg("usernameOrEmail")}<#else>${msg("email")}</#if></label>
                    <div class="nj-input-group">
                        <input id="kc-attempted-username" class="nj-input nj-input-readonly" value="${auth.attemptedUsername}" readonly>
                        <a id="reset-login" class="nj-toggle" href="${url.loginRestartFlowUrl}" aria-label="${msg('restartLoginTooltip')}" title="${msg('restartLoginTooltip')}">
                            <i class="nj-icon nj-restart" aria-hidden="true"></i>
                        </a>
                    </div>
                </div>
                <#nested "show-username">
            </#if>

            <#if displayRequiredFields>
                <p class="nj-note"><span class="nj-required">*</span> ${msg("requiredFields")}</p>
            </#if>

            <#-- App-initiated actions should not see warnings about the need to complete the action -->
            <#if displayMessage && message?has_content && (message.type != 'warning' || !isAppInitiatedAction??)>
                <div class="${properties.kcAlertClass!} nj-alert-${message.type}" role="alert">
                    <span class="nj-alert-icon" aria-hidden="true"></span>
                    <span class="${properties.kcAlertTitleClass!} kc-feedback-text">${kcSanitize(message.summary)?no_esc}</span>
                </div>
            </#if>

            <#nested "form">

            <#if auth?has_content && auth.showTryAnotherWayLink()>
                <form id="kc-select-try-another-way-form" action="${url.loginAction}" method="post" novalidate="novalidate">
                    <input type="hidden" name="tryAnotherWay" value="on"/>
                    <a id="try-another-way" href="javascript:document.forms['kc-select-try-another-way-form'].requestSubmit()"
                       class="nj-button nj-button-outline nj-button-block nj-mt">
                        ${kcSanitize(msg("doTryAnotherWay"))?no_esc}
                    </a>
                </form>
            </#if>

            <#nested "socialProviders">

            <#if displayInfo>
                <div id="kc-info" class="nj-info">
                    <div id="kc-info-wrapper">
                        <#nested "info">
                    </div>
                </div>
            </#if>
        </div>
    </section>

    <footer class="nj-footer">
        <#if realm.internationalizationEnabled && locale.supported?size gt 1>
            <nav class="nj-lang" aria-label="${msg("languages")}">
                <#list locale.supported as l>
                    <#if l.languageTag == locale.currentLanguageTag>
                        <span class="nj-lang-current" aria-current="true">${l.label}</span>
                    <#else>
                        <a class="nj-lang-link" href="${l.url}" hreflang="${l.languageTag}">${l.label}</a>
                    </#if>
                </#list>
            </nav>
        </#if>
        <@loginFooter.content/>
    </footer>
</main>
</body>
</html>
</#macro>
