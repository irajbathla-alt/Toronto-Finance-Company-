(() => {
  const boot = () => {
    const sourceForm = document.getElementById('eligibilityForm');
    const page = document.getElementById('page1');
    const result = document.getElementById('result');
    if (!sourceForm || !page || !result || document.getElementById('guidedFlow')) return;

    sourceForm.classList.add('guided-source-form');
    const title = page.querySelector('h2');
    const flow = document.createElement('div');
    flow.id = 'guidedFlow';
    flow.className = 'guided-flow';
    sourceForm.parentNode.insertBefore(flow, sourceForm);

    const questions = [
      { id:'industry', kicker:'About your business', title:'What industry is your business in?', type:'select' },
      { id:'timeMonths', kicker:'Business history', title:'How long have you been in business?', type:'choice', options:[[3,'Under 6 months'],[8,'6 to 11 months'],[18,'12 to 23 months'],[30,'24 to 35 months'],[48,'36+ months']] },
      { id:'monthlyDeposits', kicker:'Business cash flow', title:'What are your average monthly business deposits?', help:'Use the average deposits shown on your business bank statements.', type:'money', placeholder:'35,000' },
      { id:'requestedAmount', kicker:'Funding request', title:'How much financing are you looking for?', type:'money', placeholder:'30,000' },
      { id:'credit', kicker:'Credit profile', title:'What is your estimated personal credit score?', type:'selectAsChoices' },
      { id:'nsf3m', kicker:'Banking history', title:'How many NSFs or returned payments have you had in the last 3 months?', type:'selectAsChoices' },
      { id:'negativeBalances', kicker:'Banking history', title:'Have you had recent negative or overdrawn balances?', type:'selectAsChoices' },
      { id:'activeFinancing', kicker:'Existing financing', title:'How many active business financing facilities do you currently have?', type:'selectAsChoices' },
      { id:'monthlyDebt', kicker:'Existing financing', title:'What are your approximate monthly business financing payments?', help:'Include regular loan, advance, lease or line-of-credit payments. Enter $0 if none.', type:'money', placeholder:'0', skip:()=>document.getElementById('activeFinancing').value==='0' },
      { id:'depositTrend', kicker:'Recent performance', title:'How are your recent sales or deposits trending?', type:'selectAsChoices' },
      { id:'statementMonths', kicker:'Documents', title:'How many months of business bank statements can you provide?', type:'selectAsChoices' }
    ];

    let index = 0;
    let moving = false;
    const source = id => document.getElementById(id);
    const moneyNumber = value => Number(String(value || '').replace(/[^0-9.]/g,'')) || 0;
    const moneyDisplay = value => {
      const n = moneyNumber(value);
      return n ? new Intl.NumberFormat('en-CA').format(n) : '';
    };
    const visible = () => questions.filter(q => !(q.skip && q.skip()));
    const actualPosition = q => visible().findIndex(x => x === q);
    const nextIndex = (from, direction) => {
      let i = from + direction;
      while (i >= 0 && i < questions.length && questions[i].skip && questions[i].skip()) i += direction;
      return i;
    };
    const valid = q => {
      const el = source(q.id);
      if (!el) return false;
      if (q.type === 'money') return q.id === 'requestedAmount'
        ? moneyNumber(el.value) >= 1000
        : el.value !== '' && moneyNumber(el.value) >= 0;
      return String(el.value || '').trim() !== '';
    };
    const optionPairs = q => {
      if (q.options) return q.options;
      const el = source(q.id);
      return Array.from(el.options).filter(o => o.value !== '').map(o => [o.value, o.textContent]);
    };
    const clearMotion = () => flow.classList.remove('enter-forward','enter-back','leave-forward','leave-back');
    const animateIn = direction => {
      clearMotion();
      flow.classList.add(direction < 0 ? 'enter-back' : 'enter-forward');
      setTimeout(() => flow.classList.remove('enter-forward','enter-back'), 310);
    };
    const transitionTo = (target, direction) => {
      if (moving) return;
      moving = true;
      clearMotion();
      flow.classList.add(direction < 0 ? 'leave-back' : 'leave-forward');
      setTimeout(() => {
        index = target;
        render(direction);
        moving = false;
      }, 170);
    };
    const finish = () => {
      if (moving) return;
      moving = true;
      flow.classList.add('leave-forward');
      setTimeout(() => {
        flow.classList.add('guided-complete');
        if (title) title.textContent = 'Your Options';
        sourceForm.dispatchEvent(new Event('submit', { bubbles:true, cancelable:true }));
        result.classList.add('guided-result-enter');
        setTimeout(() => result.classList.remove('guided-result-enter'), 450);
        moving = false;
      }, 170);
    };
    const advance = () => {
      const q = questions[index];
      if (!valid(q) || moving) return;
      if (q.id === 'activeFinancing' && source(q.id).value === '0') source('monthlyDebt').value = '0';
      const next = nextIndex(index, 1);
      if (next >= questions.length) return finish();
      transitionTo(next, 1);
    };
    const back = () => {
      if (moving) return;
      const prev = nextIndex(index, -1);
      if (prev < 0) {
        const backToIntro = document.getElementById('backToIntro');
        if (backToIntro) backToIntro.click();
        return;
      }
      transitionTo(prev, -1);
    };

    const render = direction => {
      clearMotion();
      const q = questions[index];
      const list = visible();
      const pos = actualPosition(q);
      const total = list.length;
      const progress = Math.max(8, ((pos + 1) / total) * 100);
      let control = '';

      if (q.type === 'choice' || q.type === 'selectAsChoices') {
        control = '<div class="guided-choices">' + optionPairs(q).map(pair => {
          const selected = String(source(q.id).value) === String(pair[0]);
          return '<button type="button" class="guided-choice' + (selected ? ' selected' : '') + '" data-value="' + String(pair[0]).replace(/"/g,'&quot;') + '">' + pair[1] + '</button>';
        }).join('') + '</div>';
      } else if (q.type === 'select') {
        control = '<select class="guided-select" id="guidedControl">' +
          Array.from(source(q.id).options).map(o =>
            '<option value="' + String(o.value).replace(/"/g,'&quot;') + '"' +
            (String(source(q.id).value)===String(o.value) ? ' selected' : '') + '>' + o.textContent + '</option>'
          ).join('') + '</select>';
      } else {
        control = '<div class="guided-money"><span>$</span><input id="guidedControl" inputmode="decimal" autocomplete="off" placeholder="' + (q.placeholder || '') + '" value="' + moneyDisplay(source(q.id).value) + '"></div>';
      }

      flow.innerHTML =
        '<div class="guided-head"><button type="button" class="guided-back">← Back</button><span>Question ' + (pos + 1) + ' of ' + total + '</span></div>' +
        '<div class="guided-progress"><i style="width:' + progress + '%"></i></div>' +
        '<div class="guided-question"><div class="guided-kicker">' + q.kicker + '</div><h3>' + q.title + '</h3>' +
        (q.help ? '<p>' + q.help + '</p>' : '') + control +
        '<div class="guided-actions"><button type="button" class="guided-next"' + (valid(q) ? '' : ' disabled') + '>' +
        (nextIndex(index,1) >= questions.length ? 'See My Options' : 'Continue') +
        '</button><small>Your answers are used for a preliminary financing assessment. Final eligibility is subject to verification and lender underwriting.</small></div></div>';

      flow.querySelector('.guided-back').onclick = back;
      const nextButton = flow.querySelector('.guided-next');
      nextButton.onclick = advance;

      if (q.type === 'choice' || q.type === 'selectAsChoices') {
        flow.querySelectorAll('.guided-choice').forEach(btn => btn.onclick = () => {
          if (moving) return;
          source(q.id).value = btn.dataset.value;
          flow.querySelectorAll('.guided-choice').forEach(x => {
            x.classList.toggle('selected', x === btn);
            x.disabled = true;
          });
          nextButton.disabled = false;
          setTimeout(advance, 190);
        });
      } else if (q.type === 'select') {
        const controlEl = flow.querySelector('#guidedControl');
        controlEl.onchange = () => {
          source(q.id).value = controlEl.value;
          nextButton.disabled = !valid(q);
        };
      } else {
        const controlEl = flow.querySelector('#guidedControl');
        controlEl.oninput = () => {
          source(q.id).value = String(moneyNumber(controlEl.value));
          controlEl.value = moneyDisplay(controlEl.value);
          nextButton.disabled = !valid(q);
          try { controlEl.setSelectionRange(controlEl.value.length, controlEl.value.length); } catch(e) {}
        };
        controlEl.onkeydown = e => {
          if (e.key === 'Enter' && valid(q)) {
            e.preventDefault();
            controlEl.blur();
            advance();
          }
        };
        controlEl.onfocus = () => setTimeout(() => {
          try { controlEl.scrollIntoView({behavior:'smooth',block:'center'}); } catch(e) {}
        }, 260);
      }

      requestAnimationFrame(() => animateIn(direction || 1));
    };

    render(1);

    const observer = new MutationObserver(() => {
      if (!result.classList.contains('hidden') && flow.classList.contains('guided-complete')) {
        flow.style.display = 'none';
      }
    });
    observer.observe(result, { attributes:true, attributeFilter:['class'] });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();