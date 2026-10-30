(() => {
  const boot = () => {
    const sourceForm = document.getElementById('eligibilityForm');
    const page = document.getElementById('page1');
    const result = document.getElementById('result');
    if (!sourceForm || !page || !result || document.getElementById('guidedFlow')) return;

    sourceForm.classList.add('guided-source-form');
    page.classList.add('guided-page');
    const title = page.querySelector('h2');
    const flow = document.createElement('div');
    flow.id = 'guidedFlow';
    flow.className = 'guided-flow';
    sourceForm.parentNode.insertBefore(flow, sourceForm);

    const amountOptions = {
      monthlyDeposits: [
        [2500,'Less than $5,000'],
        [7500,'$5,000 to $9,999'],
        [15000,'$10,000 to $19,999'],
        [22500,'$20,000 to $24,999'],
        [37500,'$25,000 to $49,999'],
        [75000,'$50,000 to $99,999'],
        [125000,'$100,000+']
      ],
      requestedAmount: [
        [7500,'Less than $10,000'],
        [17500,'$10,000 to $24,999'],
        [37500,'$25,000 to $49,999'],
        [75000,'$50,000 to $99,999'],
        [175000,'$100,000 to $249,999'],
        [300000,'$250,000+']
      ],
      monthlyDebt: [
        [0,'No monthly payments'],
        [500,'Less than $1,000'],
        [2000,'$1,000 to $2,999'],
        [4000,'$3,000 to $4,999'],
        [7500,'$5,000 to $9,999'],
        [12500,'$10,000+']
      ]
    };

    const questions = [
      { id:'industry', kicker:'About your business', title:'What industry is your business in?', type:'selectAsChoices', compact:true },
      { id:'timeMonths', kicker:'Business history', title:'How long have you been in business?', type:'choice', options:[[3,'Less than 6 months'],[8,'6 to 11 months'],[18,'1 to 2 years'],[30,'2 to 3 years'],[48,'More than 3 years']] },
      { id:'monthlyDeposits', kicker:'Business cash flow', title:'What are your average monthly business deposits?', help:'Choose the closest range, or enter the exact amount.', type:'amountChoice', options:amountOptions.monthlyDeposits },
      { id:'requestedAmount', kicker:'Funding request', title:'How much financing are you looking for?', help:'Choose the closest range, or enter the exact amount.', type:'amountChoice', options:amountOptions.requestedAmount },
      { id:'credit', kicker:'Credit profile', title:'What is your estimated personal credit score?', type:'selectAsChoices' },
      { id:'nsf3m', kicker:'Banking history', title:'How many NSFs or returned payments have you had in the last 3 months?', type:'selectAsChoices' },
      { id:'negativeBalances', kicker:'Banking history', title:'Have you had recent negative or overdrawn balances?', type:'selectAsChoices' },
      { id:'activeFinancing', kicker:'Existing financing', title:'How many active business financing facilities do you currently have?', type:'selectAsChoices' },
      { id:'monthlyDebt', kicker:'Existing financing', title:'What are your approximate monthly business financing payments?', help:'Choose the closest range, or enter the exact amount.', type:'amountChoice', options:amountOptions.monthlyDebt, skip:()=>document.getElementById('activeFinancing').value==='0' },
      { id:'depositTrend', kicker:'Recent performance', title:'How are your recent sales or deposits trending?', type:'selectAsChoices' },
      { id:'statementMonths', kicker:'Documents', title:'How many months of business bank statements can you provide?', type:'selectAsChoices' }
    ];

    let index = 0;
    let moving = false;
    const exactMode = {};
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
      if (q.type === 'amountChoice') {
        const n = moneyNumber(el.value);
        return q.id === 'requestedAmount' ? n >= 1000 : n >= 0 && String(el.value) !== '';
      }
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
    const chooseAndAdvance = (q, btn) => {
      if (moving) return;
      source(q.id).value = btn.dataset.value;
      flow.querySelectorAll('.guided-choice').forEach(x => {
        x.classList.toggle('selected', x === btn);
        x.disabled = true;
      });
      setTimeout(advance, 190);
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
        control = '<div class="guided-choices' + (q.compact ? ' compact' : '') + '">' + optionPairs(q).map(pair => {
          const selected = String(source(q.id).value) === String(pair[0]);
          return '<button type="button" class="guided-choice' + (selected ? ' selected' : '') + '" data-value="' + String(pair[0]).replace(/"/g,'&quot;') + '">' + pair[1] + '</button>';
        }).join('') + '</div>';
      } else if (q.type === 'amountChoice') {
        const current = Number(source(q.id).value || 0);
        const isPreset = q.options.some(pair => Number(pair[0]) === current) && !exactMode[q.id];
        control = '<div class="guided-choices amount-options">' + q.options.map(pair => {
          const selected = isPreset && Number(pair[0]) === current;
          return '<button type="button" class="guided-choice' + (selected ? ' selected' : '') + '" data-value="' + pair[0] + '">' + pair[1] + '</button>';
        }).join('') +
        '<button type="button" class="guided-choice exact-choice' + (exactMode[q.id] ? ' selected' : '') + '" data-exact="1">Enter exact amount</button></div>' +
        (exactMode[q.id] ? '<div class="guided-exact-wrap"><div class="guided-money"><span>$</span><input id="guidedExact" inputmode="decimal" autocomplete="off" placeholder="Enter amount" value="' + moneyDisplay(source(q.id).value) + '"></div><button type="button" class="guided-exact-go" aria-label="Use exact amount">→</button></div>' : '');
      }

      flow.innerHTML =
        '<div class="guided-head"><button type="button" class="guided-back" aria-label="Go to previous question">← Back</button><span>' + (pos + 1) + ' / ' + total + '</span></div>' +
        '<div class="guided-progress"><i style="width:' + progress + '%"></i></div>' +
        '<div class="guided-question"><div class="guided-kicker">' + q.kicker + '</div><h3>' + q.title + '</h3>' +
        (q.help ? '<p>' + q.help + '</p>' : '') + control +
        ((q.type === 'choice' || q.type === 'selectAsChoices' || q.type === 'amountChoice') ? '<div class="guided-tap-hint">Tap an option to continue</div>' : '') +
        '<div class="guided-footnote">Preliminary assessment only. Final eligibility is subject to verification and lender underwriting.</div></div>';

      flow.querySelector('.guided-back').onclick = back;

      if (q.type === 'choice' || q.type === 'selectAsChoices') {
        flow.querySelectorAll('.guided-choice').forEach(btn => btn.onclick = () => chooseAndAdvance(q, btn));
      } else if (q.type === 'amountChoice') {
        flow.querySelectorAll('.guided-choice[data-value]').forEach(btn => btn.onclick = () => {
          exactMode[q.id] = false;
          chooseAndAdvance(q, btn);
        });
        const exactBtn = flow.querySelector('.exact-choice');
        if (exactBtn) exactBtn.onclick = () => {
          if (moving) return;
          exactMode[q.id] = true;
          render(direction || 1);
          setTimeout(() => {
            const input = flow.querySelector('#guidedExact');
            if (input) input.focus();
          }, 40);
        };
        const exactInput = flow.querySelector('#guidedExact');
        const exactGo = flow.querySelector('.guided-exact-go');
        if (exactInput) {
          exactInput.oninput = () => {
            source(q.id).value = String(moneyNumber(exactInput.value));
            exactInput.value = moneyDisplay(exactInput.value);
            if (exactGo) exactGo.disabled = !valid(q);
            try { exactInput.setSelectionRange(exactInput.value.length, exactInput.value.length); } catch(e) {}
          };
          exactInput.onkeydown = e => {
            if (e.key === 'Enter' && valid(q)) {
              e.preventDefault();
              exactInput.blur();
              advance();
            }
          };
          setTimeout(() => {
            try { exactInput.scrollIntoView({behavior:'smooth',block:'center'}); } catch(e) {}
          }, 220);
        }
        if (exactGo) {
          exactGo.disabled = !valid(q);
          exactGo.onclick = () => {
            if (!valid(q)) return;
            if (exactInput) exactInput.blur();
            advance();
          };
        }
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