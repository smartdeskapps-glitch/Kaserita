(function () {
  var header = document.querySelector('header');
  if (!header) return;
  function onScroll() {
    header.classList.toggle('is-scrolled', window.scrollY > 4);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

(function () {
  var wideShot = document.getElementById('wideShot');
  if (!wideShot) return;
  wideShot.addEventListener('scroll', function () {
    if (wideShot.scrollLeft > 12) wideShot.classList.add('scrolled');
  }, { passive: true });
})();
