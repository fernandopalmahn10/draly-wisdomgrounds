// qtext.js · how every pin game writes a question (his rule 2026-10-24: "everything that's in the question… «here»…
// can go in red and in bold, and do include the tones in pinyin"). The tones come with the question (core/packs.js
// forGames); this draws it: DralyQ.fill(el, text) writes the text into el with each «…» part in red and bold
// (<b class="dq-ask">), the « » themselves plain. Text nodes only: nothing in a question is ever read as HTML.
// The red follows the card: the platform's red on a light card, a light red on a dark card (read from the card's own
// text colour, so every game's card keeps its contrast without its own rule). One file for every game, loaded by
// player.html and the projectors that show a question (host-halcon.html).
(function () {
  'use strict';
  const CSS = '.dq-ask{color:#d62839;font-weight:900}.dq-ask.dq-light{color:#ff8f8f}';
  function style() {
    if (document.getElementById('dq-style')) return;
    const s = document.createElement('style');
    s.id = 'dq-style';
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }
  // a card whose text is light is a dark card
  function onDark(el) {
    try {
      const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(getComputedStyle(el).color || '');
      if (!m) return false;
      const [r, g, b] = [m[1], m[2], m[3]].map(Number);
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.6;
    } catch (_) { return false; }
  }
  function fill(el, text) {
    if (!el) return;
    style();
    const t = String(text == null ? '' : text);
    el.textContent = '';
    const light = onDark(el);
    const re = /«([^«»]+)»/g;
    let last = 0, m;
    while ((m = re.exec(t))) {
      if (m.index > last) el.appendChild(document.createTextNode(t.slice(last, m.index)));
      const b = document.createElement('b');
      b.className = 'dq-ask' + (light ? ' dq-light' : '');
      b.textContent = m[1];
      el.append('«', b, '»');
      last = re.lastIndex;
    }
    if (last < t.length) el.appendChild(document.createTextNode(t.slice(last)));
  }
  window.DralyQ = { fill };
})();
