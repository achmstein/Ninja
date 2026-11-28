// The code goes in once it is all there, and another can be asked for after the wait
(function () {
  var form = document.getElementById('ninja-phone-form');
  var input = document.getElementById('code');
  var resend = document.getElementById('ninja-phone-resend');
  if (!form || !input) return;
  var digits = Number(form.getAttribute('data-digits')) || 0;
  var sent = false;

  input.addEventListener('input', function () {
    // Arabic-Indic and Persian digits are digits too
    input.value = input.value
      .replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); })
      .replace(/[۰-۹]/g, function (d) { return String(d.charCodeAt(0) - 0x06F0); })
      .replace(/\D/g, '');
    if (!sent && digits > 0 && input.value.length === digits) {
      sent = true;
      form.requestSubmit(document.getElementById('ninja-phone-submit'));
    }
  });

  if (!resend) return;
  var label = resend.textContent.trim();
  var left = Number(form.getAttribute('data-wait')) || 0;
  function tick() {
    resend.disabled = left > 0;
    resend.textContent = left > 0 ? label + ' (' + left + ')' : label;
    if (left > 0) {
      left -= 1;
      setTimeout(tick, 1000);
    }
  }
  tick();
})();
