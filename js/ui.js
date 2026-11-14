// Draws the view that app.js describes. Text always goes in through
// textContent (never as HTML), so nothing in a lesson can run as code.

const TEXT = {
  installNote: "On iPhone, use this site from your Home Screen so your progress is kept: tap Share, then Add to Home Screen, and open it from there. Progress made in Safari doesn't carry over.",
  saveFailed: "This browser isn't saving progress (private browsing?). Rounds still work, but marks won't be kept.",
  someMissing: "Some lessons couldn't be loaded. They'll appear next time you're online.",
  noLessons: 'No lessons yet. Open the site once with a signal to download them.',
  footer: 'Progress is kept on this phone only.',
};

const INSTRUCTION = {
  meaning: 'What does this mean?',
  arabic: 'Which is the Arabic?',
  reply: 'Which is a reply?',
  form: 'Which form?',
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

function statsList(stats) {
  const items = stats.lessons.map((l) => el('li', { text: `${l.title} · ${l.remembered} of ${l.total} remembered · ${l.percent}%` }));
  if (stats.lessons.length >= 2) {
    const o = stats.overall;
    items.push(el('li', { text: `Overall · ${o.remembered} of ${o.total} remembered · ${o.percent}%` }));
  }
  return el('ul', { class: 'stats' }, items);
}

function topbar(position, total, act) {
  return el('div', { class: 'topbar' },
    el('span', { text: `${position} of ${total}` }),
    el('button', { type: 'button', onClick: () => act.goHome() }, 'Home'));
}

function home(view, act) {
  const hasLessons = view.stats.lessons.length > 0;
  const content = el('div', { class: 'content' },
    el('h1', { tabindex: '-1', 'data-focus': true }, 'Arabic revision'),
    view.installNote && el('div', { class: 'notice', role: 'note' },
      el('p', { text: TEXT.installNote }),
      el('button', { type: 'button', onClick: () => act.dismissInstallNote() }, 'OK')),
    view.saveFailed && el('p', { class: 'notice', text: TEXT.saveFailed }),
    hasLessons ? statsList(view.stats) : el('p', { text: TEXT.noLessons }),
    hasLessons && view.problems.length > 0 && el('p', { class: 'notice', text: TEXT.someMissing }),
    hasLessons && el('fieldset', {},
      el('legend', { text: 'Revise' }),
      el('div', { class: 'scope' }, view.scopes.map((s) => el('label', {},
        el('input', { type: 'radio', name: 'scope', value: s.id, checked: s.id === view.scope,
          onChange: () => act.setScope(s.id) }),
        el('span', { text: s.label }))))),
    el('p', { class: 'muted footer', text: TEXT.footer }));

  const actions = el('div', { class: 'actions' },
    el('button', { type: 'button', class: 'primary', disabled: !hasLessons, onClick: () => act.startCards('en-ar') },
      'English → Arabic', el('span', { class: 'sub', text: 'Counts towards remembered' })),
    el('button', { type: 'button', disabled: !hasLessons, onClick: () => act.startCards('ar-en') }, 'Arabic → English'),
    el('button', { type: 'button', disabled: !hasLessons, onClick: () => act.startQuiz() }, 'Quiz'));

  return [content, actions];
}

function card(view, act) {
  const { front, back } = view;
  let face;
  if (!view.flipped) {
    face = el('button', { type: 'button', class: 'card', 'data-focus': true, 'aria-label': 'Show answer', onClick: () => act.flip() },
      el('span', { class: 'big', text: front.text }),
      front.hint && el('span', { class: 'hint', text: front.hint }));
  } else {
    face = el('div', { class: 'card', tabindex: '-1', 'data-focus': true },
      el('p', { class: 'asked', text: front.hint ? `${front.text} ${front.hint}` : front.text }),
      el('p', { class: 'big', text: back.text }));
  }

  const content = el('div', { class: 'content' },
    topbar(view.position, view.total, act),
    face,
    view.flipped && back.set.length > 1 && el('ul', { class: 'set', 'aria-label': 'The whole set' },
      back.set.map((f) => el('li', { class: f.current ? 'current' : undefined },
        el('span', { class: 'ar', text: f.ar }), ' — ', el('span', { text: f.en })))),
    view.flipped && back.note && el('p', { class: 'note', text: back.note }),
    view.saveFailed && el('p', { class: 'notice', text: TEXT.saveFailed }));

  const actions = el('div', { class: 'actions' },
    view.flipped
      ? el('div', { class: 'row' },
        el('button', { type: 'button', class: 'wrong', onClick: () => act.mark(false) }, 'Wrong'),
        el('button', { type: 'button', class: 'right', onClick: () => act.mark(true) }, 'Right'))
      : el('button', { type: 'button', class: 'primary', onClick: () => act.flip() }, 'Show answer'));

  return [content, actions];
}

function quiz(view, act) {
  const q = view.question;
  const answered = view.chosen !== null;
  const options = q.options.map((text, i) => {
    let cls;
    if (answered && i === q.answer) cls = 'is-answer';
    else if (answered && i === view.chosen) cls = 'is-wrong';
    return el('button', { type: 'button', class: cls, disabled: answered, onClick: () => act.choose(i) }, text);
  });
  let feedback = '';
  if (answered) feedback = view.chosen === q.answer ? 'Right' : `The answer is ${q.options[q.answer]}`;

  const content = el('div', { class: 'content' },
    topbar(view.position, view.total, act),
    el('p', { class: 'instruction', text: INSTRUCTION[q.type] }),
    el('div', { class: 'card', tabindex: '-1', 'data-focus': true },
      el('p', { class: 'big', text: q.prompt }),
      q.hint && el('p', { class: 'hint', text: q.hint })),
    el('div', { class: 'options' }, options),
    el('p', { class: 'feedback', 'aria-live': 'polite', text: feedback }));

  const actions = el('div', { class: 'actions' },
    answered && el('button', { type: 'button', class: 'primary', onClick: () => act.next() }, 'Next'));

  return [content, actions];
}

function done(view, act) {
  const again = view.kind === 'cards' ? () => act.startCards(view.dir) : () => act.startQuiz();
  const content = el('div', { class: 'content' },
    el('h2', { tabindex: '-1', 'data-focus': true, text: `${view.right} of ${view.total} right` }),
    view.missed.length > 0 && el('h3', { text: 'Look at these again' }),
    view.missed.length > 0 && el('ul', { class: 'missed' },
      view.missed.map((m) => el('li', {}, el('span', { class: 'ar', text: m.ar }), ' — ', el('span', { text: m.en })))),
    statsList(view.stats));

  const actions = el('div', { class: 'actions' },
    el('button', { type: 'button', class: 'primary', onClick: again }, 'Another round'),
    el('button', { type: 'button', onClick: () => act.goHome() }, 'Home'));

  return [content, actions];
}

const SCREENS = { home, card, quiz, done };

export function render(root, view, act) {
  root.replaceChildren(...SCREENS[view.screen](view, act).filter(Boolean));
}
