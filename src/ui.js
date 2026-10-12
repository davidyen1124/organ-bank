const $ = (s) => document.querySelector(s);

export function createUI({ organs, onSelect, onStep, onBack, onSound }) {
  const ui = $('#ui');
  const index = $('#index');
  const card = $('#card');
  const frames = [...card.querySelectorAll('.frames i')];
  const about = $('#about');
  let shown = -1;
  let frame = -1;

  organs.forEach((o, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'idx';
    b.style.setProperty('--c', o.color);
    b.setAttribute('aria-label', `${o.no} ${o.latin}, ${o.name}`);
    b.innerHTML = `<span class="no">${o.no}</span><span class="la">${o.latin}</span><span class="en">${o.name}</span><i class="dot"></i>`;
    b.addEventListener('click', () => onSelect(i));
    index.append(b);
  });

  $('#prev').addEventListener('click', () => onStep(-1));
  $('#next').addEventListener('click', () => onStep(1));
  $('#back').addEventListener('click', onBack);
  $('#info').addEventListener('click', () => about.showModal());
  about.addEventListener('click', (e) => { if (e.target === about) about.close(); });
  $('#snd').addEventListener('click', (e) => {
    const on = onSound();
    e.currentTarget.setAttribute('aria-pressed', String(on));
    e.currentTarget.textContent = on ? 'Sound on' : 'Sound off';
  });

  return {
    progress(p) {
      $('#boot-bar').style.width = `${Math.round(p * 100)}%`;
    },
    ready() {
      $('#boot').classList.add('done');
      ui.classList.remove('booting');
    },
    fail(msg) {
      $('#boot-msg').textContent = msg;
    },
    hintOff() {
      $('#hint').classList.add('off');
    },
    get modal() {
      return about.open;
    },
    setFocus(i) {
      if (i === shown) return;
      shown = i;
      frame = -1;
      ui.classList.toggle('focused', i >= 0);
      card.hidden = i < 0;
      if (i < 0) return;
      const o = organs[i];
      card.style.setProperty('--c', o.color);
      $('#c-no').textContent = o.no;
      $('#c-latin').textContent = o.latin;
      $('#c-name').textContent = o.name;
      $('#c-loop').textContent = o.loop;
      $('#c-tube').textContent = o.tube;
      $('#c-phos').textContent = o.phosphor;
      $('#c-text').textContent = o.text;
    },
    setFrame(n) {
      if (n === frame) return;
      frame = n;
      $('#c-frame').textContent = n + 1;
      frames.forEach((f, i) => f.classList.toggle('on', i === n));
    },
  };
}
