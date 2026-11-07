/*
 * Wompi only accepts an https redirect, so a payment from the APK comes back here and
 * this page hands over to the app (luma://). It keeps only the order and the transaction
 * id, reads and stores nothing else, and says nothing about the result: the webhook
 * decides that, and the app asks the server when it opens or returns to the foreground.
 */
(function () {
  var SAFE = /^[0-9A-Za-z_-]{1,64}$/;
  var query = new URLSearchParams(location.search);
  var kept = new URLSearchParams();
  ['order', 'id'].forEach(function (name) {
    var value = query.get(name);
    if (value && SAFE.test(value)) kept.set(name, value);
  });
  var text = kept.toString();
  var target = 'luma://payments/return' + (text ? '?' + text : '');
  document.getElementById('open').href = target;
  // Some browsers refuse to leave without a tap: the button stays for them.
  location.replace(target);
})();
