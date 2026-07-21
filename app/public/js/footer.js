(function () {
  document.addEventListener('DOMContentLoaded', function () {
    var el = document.createElement('div');
    el.className = 'app-version';
    document.body.appendChild(el);

    fetch('/api/version')
      .then(function (res) { return res.json(); })
      .then(function (data) { el.textContent = data.version ? 'v' + data.version : ''; })
      .catch(function () {});
  });
})();
