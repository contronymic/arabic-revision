// Draws the view that app.js describes. Text always goes in through
// textContent (never as HTML), so nothing in a lesson can run as code.

const TEXT = {
  installNote: "On iPhone, use this site from your Home Screen so your progress is kept: tap Share, then Add to Home Screen, and open it from there. Progress made in Safari doesn't carry over.",
  saveFailed: "This browser isn't saving progress (private browsing?). Rounds still work, but marks won't be kept.",
  someMissing: "Some lessons couldn't be loaded. They'll appear next time you're online.",
  noLessons: 'No lessons yet. Open the site once with a signal to download them.',
  progressNote: 'A phrase counts as remembered once you answer it correctly in the quiz on two different days.',
};

// Builds an element. props: class, text, on<Event> handlers, or any attribute.
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, String(value));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

function statsLine(l) {
  return `${l.title}: ${l.remembered} of ${l.total} phrases remembered · ${l.percent}%`;
}

// One line per lesson, and an overall line once there are two lessons or more.
function statsLines(stats) {
  const lines = [...stats.lessons];
  if (stats.lessons.length >= 2) lines.push({ title: 'Overall', ...stats.overall });
  // The bar only repeats the line, so screen readers skip it.
  return lines.map((l) => [el('h3', { class: 'stat', text: statsLine(l) }),
    el('progress', { class: 'bar', max: l.total || 1, value: l.remembered, 'aria-hidden': 'true' })]).flat();
}

function topbar(position, total, act) {
  return el('div', { class: 'topbar' },
    el('span', { class: 'count', text: `${position} of ${total}` }),
    el('button', { type: 'button', onClick: () => act.goHome() }, 'Home'));
}

function home(view, act) {
  const hasLessons = view.stats.lessons.length > 0;
  const mode = (label, sub, onClick, primary) => el('button', { type: 'button', class: primary ? 'mode primary' : 'mode', disabled: !hasLessons, onClick },
    label, sub && el('span', { class: 'sub', text: sub }));

  return [el('div', { class: 'content home' },
    el('div', { class: 'flag', role: 'img', 'aria-label': 'Flag of Palestine' }),
    el('h1', { tabindex: '-1', 'data-focus': true }, 'Palestinian Arabic Revision'),
    view.installNote && el('div', { class: 'notice', role: 'note' },
      el('p', { text: TEXT.installNote }),
      el('button', { type: 'button', onClick: () => act.dismissInstallNote() }, 'OK')),
    view.saveFailed && el('p', { class: 'notice', text: TEXT.saveFailed }),
    el('h2', { text: 'Progress:' }),
    hasLessons ? statsLines(view.stats) : el('p', { text: TEXT.noLessons }),
    hasLessons && el('p', { class: 'muted progress-note', text: TEXT.progressNote }),
    hasLessons && view.problems.length > 0 && el('p', { class: 'notice', text: TEXT.someMissing }),
    hasLessons && el('fieldset', {},
      el('legend', {}, el('h2', { text: 'What do you want to work on?' })),
      el('div', { class: 'scope' }, view.scopes.map((s) => el('label', {},
        el('input', { type: 'radio', name: 'scope', value: s.id, checked: s.id === view.scope,
          onChange: () => act.setScope(s.id) }),
        el('span', { class: s.summary ? 'choice' : 'choice lone' }, s.label, s.summary && el('span', { class: 'sub', text: s.summary })))))),
    el('div', { class: 'modes' },
      mode('English → Arabic', null, () => act.startCards('en-ar')),
      mode('Arabic → English', null, () => act.startCards('ar-en')),
      mode('Quiz', 'Counts towards progress', () => act.startQuiz(), true)))];
}

function question(view, act) {
  const q = view.question;
  const answered = view.chosen !== null;
  const options = q.options.map((text, i) => {
    let cls;
    if (answered && i === q.answer) cls = 'is-answer';
    else if (answered && i === view.chosen) cls = 'is-wrong';
    return el('button', { type: 'button', class: cls, disabled: answered, onClick: () => act.choose(i) }, text);
  });
  const right = answered && view.chosen === q.answer;
  let feedback = '';
  if (answered) feedback = right ? (view.praise ?? 'Right!') : `The answer is ${q.options[q.answer]}`;

  const content = el('div', { class: 'content' },
    topbar(view.position, view.total, act),
    el('div', { class: 'card', tabindex: '-1', 'data-focus': true },
      el('p', { class: 'ask' }, q.ask.map((part) => (part.strong ? el('strong', { text: part.text }) : part.text))),
      q.prompt && el('p', { class: 'big', text: q.prompt }),
      q.hint && el('p', { class: 'hint', text: q.hint })),
    el('div', { class: 'options' }, options),
    el('div', { 'aria-live': 'polite' },
      el('p', { class: right ? 'feedback praise' : 'feedback', text: feedback }),
      answered && (view.explain ?? []).map((line) => el('p', { class: 'explain', text: line }))),
    answered && view.set?.length > 1 && el('ul', { class: 'set', 'aria-label': 'The whole set' },
      view.set.map((f) => el('li', { class: f.current ? 'current' : undefined },
        el('span', { class: 'ar', text: f.ar }), ' — ', el('span', { text: f.en })))),
    answered && view.note && el('p', { class: 'note', text: view.note }),
    view.saveFailed && el('p', { class: 'notice', text: TEXT.saveFailed }));

  const actions = el('div', { class: 'actions' },
    answered && el('button', { type: 'button', class: 'primary', onClick: () => act.next() }, 'Next'));

  return [content, actions];
}

function done(view, act) {
  const again = view.kind === 'cards' ? () => act.startCards(view.dir) : () => act.startQuiz();
  const content = el('div', { class: 'content' },
    el('h2', { class: 'score', tabindex: '-1', 'data-focus': true, text: `${view.right} of ${view.total} right` }),
    view.missed.length > 0 && el('h3', { text: 'Look at these again' }),
    view.missed.length > 0 && el('ul', { class: 'missed' },
      view.missed.map((m) => el('li', {}, el('span', { class: 'ar', text: m.ar }), ' — ', el('span', { text: m.en })))));

  const actions = el('div', { class: 'actions' },
    el('button', { type: 'button', class: 'primary', onClick: again }, 'Another round'),
    el('button', { type: 'button', onClick: () => act.goHome() }, 'Home'));

  return [content, actions];
}

const SCREENS = { home, question, done };

export function render(root, view, act) {
  root.replaceChildren(...SCREENS[view.screen](view, act).filter(Boolean));
}
