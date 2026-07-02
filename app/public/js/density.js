(function () {
  var html = document.documentElement;
  var compact = localStorage.getItem('density') === 'compact';

  function apply() {
    html.setAttribute('data-density', compact ? 'compact' : 'comfortable');
    var toggle = document.getElementById('densityToggle');
    if (toggle) toggle.checked = compact;
  }

  apply();

  document.addEventListener('DOMContentLoaded', function () {
    apply();
    var toggle = document.getElementById('densityToggle');
    if (toggle) {
      toggle.addEventListener('change', function () {
        compact = toggle.checked;
        localStorage.setItem('density', compact ? 'compact' : 'comfortable');
        apply();
      });
    }
  });
})();
