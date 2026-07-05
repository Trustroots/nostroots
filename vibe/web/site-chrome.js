(function () {
  function formatUtcLabel(value) {
    if (!value) return '';
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    var y = date.getUTCFullYear();
    var m = String(date.getUTCMonth() + 1).padStart(2, '0');
    var d = String(date.getUTCDate()).padStart(2, '0');
    var h = String(date.getUTCHours()).padStart(2, '0');
    var min = String(date.getUTCMinutes()).padStart(2, '0');
    return y + '-' + m + '-' + d + ' ' + h + ':' + min;
  }

  var buildLink = document.getElementById('site-footer-build');
  var buildCommit = document.getElementById('site-footer-build-commit');
  if (!buildLink || !buildCommit) return;

  var script = document.currentScript;
  var metadataUrl = (script && script.getAttribute('data-deploy-metadata')) || 'deploy-metadata.json';

  fetch(metadataUrl, { cache: 'no-cache' })
    .then(function (response) { return response.ok ? response.json() : null; })
    .then(function (meta) {
      if (!meta || !meta.commitSha) return;
      var stamp = meta.deployTimestamp || meta.commitTimestamp;
      var label = formatUtcLabel(stamp) + ' UTC (' + meta.commitSha.slice(0, 7) + ')';
      buildLink.href = meta.commitUrl || ('https://github.com/Trustroots/nostroots/commit/' + meta.commitSha);
      buildLink.setAttribute('aria-label', 'Currently deployed code: ' + label);
      buildCommit.textContent = label;
    })
    .catch(function () {});
})();
