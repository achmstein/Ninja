// The PIN pad types into the field, and the PIN goes in once it is all there
(function () {
  var form = document.getElementById('ninja-pin-form');
  var input = document.getElementById('pin');
  if (!form || !input) return;
  var digits = Number(form.getAttribute('data-digits')) || 0;
  var sent = false;

  function check() {
    input.value = input.value.replace(/\D/g, '');
    if (!sent && digits > 0 && input.value.length === digits) {
      sent = true;
      form.requestSubmit(document.getElementById('ninja-pin-submit'));
    }
  }

  input.addEventListener('input', check);
  form.querySelectorAll('[data-key]').forEach(function (key) {
    key.addEventListener('click', function () {
      var value = key.getAttribute('data-key');
      if (value === 'back') input.value = input.value.slice(0, -1);
      else if (input.value.length < input.maxLength) input.value += value;
      check();
    });
  });
})();
