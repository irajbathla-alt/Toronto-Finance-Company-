const app = document.querySelector('#app');
const toast = document.querySelector('#toast');

function notify(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

function replayMotion() {
  if (!app) return;
  app.classList.remove('tfc-spa-enter');
  void app.offsetWidth;
  requestAnimationFrame(() => app.classList.add('tfc-spa-enter'));
}

const tfcHomeProducts=[
  {
    "id": "term",
    "title": "Business Term Loans",
    "short": "Term Loans",
    "range": "$10,000 – $500,000",
    "description": "Business capital with structured, predictable repayments.",
    "intro": "Access a lump sum of business capital with scheduled repayment over an agreed term. Funding may be suitable for expansion, inventory, equipment and operating needs.",
    "features": [
      [
        "More choice",
        "Compare available lenders and financing structures."
      ],
      [
        "Repayment options",
        "Scheduled payments and terms vary by lender."
      ],
      [
        "Clear financing costs",
        "Review borrowing costs and repayment obligations before accepting."
      ]
    ],
    "uses": [
      "Business expansion and renovations",
      "Inventory and equipment purchases",
      "Working capital and operating expenses"
    ],
    "criteria": [
      "Established business revenue and recent bank statements",
      "Personal credit and existing obligations reviewed",
      "Final eligibility depends on the selected lender"
    ],
    "note": "Funding ranges are indicative, not guaranteed. Rates, repayment terms, approval and documentation vary by lending partner."
  },
  {
    "id": "loc",
    "title": "Business Lines of Credit",
    "short": "Lines of Credit",
    "range": "$10,000 – $500,000",
    "description": "Flexible access to working capital when you need it.",
    "intro": "A business line of credit can offer approved access to funds for ongoing cash-flow needs, subject to the facility structure and lender terms.",
    "features": [
      [
        "Access funds as needed",
        "Use available credit for eligible business expenses."
      ],
      [
        "Flexible repayments",
        "Available repayment structures depend on the lender."
      ],
      [
        "Pay for what you use",
        "Some revolving facilities charge interest on the outstanding amount."
      ]
    ],
    "uses": [
      "Seasonal or unexpected costs",
      "Inventory and supplier payments",
      "Recurring working-capital needs"
    ],
    "criteria": [
      "Established operating history and business banking",
      "Revenue, debt capacity and credit profile assessed",
      "Product availability and limits vary by lender"
    ],
    "note": "Not every business line of credit is revolving. Interest, draw conditions, security requirements and available credit depend on the specific offer."
  },
  {
    "id": "flex",
    "title": "Flex Funds Advance",
    "short": "Flex Funds",
    "range": "$5,000 – $500,000",
    "description": "Flexible business funding aligned with your sales.",
    "intro": "A Flex Funds Advance provides upfront business capital in exchange for future sales receivables. The financing cost and remittance structure depend on the agreement.",
    "features": [
      [
        "Revenue-focused",
        "Business sales and deposits are central to the assessment."
      ],
      [
        "Sales-aligned payments",
        "Some providers adjust remittances as sales change."
      ],
      [
        "Clear cost",
        "Understand the total agreed remittance amount upfront."
      ]
    ],
    "uses": [
      "Inventory and seasonal preparation",
      "Cash-flow gaps or expansion",
      "Equipment and staffing expenses"
    ],
    "criteria": [
      "Recent bank statements and consistent business activity",
      "Sales performance and current debt reviewed",
      "Each provider sets its own underwriting criteria"
    ],
    "note": "An advance of future receivables is not the same as a conventional loan. Review factor costs, total remittances and all contractual obligations."
  },
  {
    "id": "mca",
    "title": "Merchant Cash Advance",
    "short": "Merchant Cash Advance",
    "range": "Revenue-based funding",
    "description": "Working capital based on established business sales.",
    "intro": "Merchant cash advances can help eligible businesses access working capital based on their sales or receivables instead of a traditional term-loan structure.",
    "features": [
      [
        "Sales-focused",
        "Assessment considers business deposits and receivables."
      ],
      [
        "Fast application",
        "Digital applications may simplify initial review."
      ],
      [
        "Flexible use",
        "Funds may support day-to-day business priorities."
      ]
    ],
    "uses": [
      "Time-sensitive operating expenses",
      "Inventory and supplier costs",
      "Bridging temporary cash-flow needs"
    ],
    "criteria": [
      "Active business with documented bank deposits",
      "Existing lender payments and account activity reviewed",
      "Approval, cost and holdback structure vary by provider"
    ],
    "note": "MCA financing can be expensive and may involve frequent payments. Carefully review total cost, remittance terms and existing obligations before accepting."
  }
];

function landing(){
  app.innerHTML=`
    <section class="landing tfc-home">
      <nav class="nav tfc-vfc-nav" data-mobile-nav-ready="true" aria-label="Main navigation">
        <span class="brand">TORONTO FINANCE COMPANY</span>
        <div class="tfc-vfc-nav-actions">
          <button type="button" id="tfcHomeLanguageSwitch" lang="pa" aria-label="Switch language to Punjabi">ਪੰਜਾਬੀ</button>
          <a class="tfc-vfc-login" href="login.html">Log In ↗</a>
          <details class="tfc-vfc-menu">
            <summary aria-label="Open website menu">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
                <path d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            </summary>
            <div class="tfc-vfc-dropdown">
              <a href="experience.html">Experience</a>
              <a href="about.html">About Us</a>
              <a href="apply.html">Apply Now ↗</a>
              <a href="privacy.html">Privacy Policy</a>
              <a href="terms.html">Terms &amp; Conditions</a>
              <a href="mailto:info@torontofinancecompany.com">Contact Us ↗</a>
            </div>
          </details>
        </div>
      </nav>
      <div class="tfc-home-main">
        <header class="tfc-home-hero">
          <h1><span>TORONTO</span><span>FINANCE COMPANY</span></h1>
          <p>BUSINESS FINANCING SOLUTIONS</p>
        </header>
        <div class="tfc-home-screen" id="tfcHomeScreen" role="region" tabindex="0" aria-roledescription="carousel" aria-label="Business financing options">
          ${tfcHomeProducts.map((product,i)=>`
            <article class="tfc-home-slide${i===0?' is-active':''}" data-tfc-slide="${i}" aria-hidden="${i===0?'false':'true'}" aria-roledescription="slide" aria-label="${i+1} of ${tfcHomeProducts.length}: ${product.title}">
              <div class="tfc-home-slide-tag">${String(i+1).padStart(2,'0')} / BUSINESS FINANCING</div>
              <div class="tfc-home-slide-title">${product.title}</div>
              <div class="tfc-home-slide-amount">${product.range}</div>
              <p class="tfc-home-slide-description">${product.description}</p>
              <div class="tfc-home-slide-foot">
                <span>TORONTO FINANCE COMPANY</span>
                <button type="button" class="tfc-home-know" data-tfc-more="${product.id}" aria-label="Know more about ${product.title}">Know More ↗</button>
              </div>
            </article>`).join('')}
        </div>
        <div class="tfc-home-controls">
          <button type="button" id="tfcHomePrev" aria-label="Previous financing option">←</button>
          <span id="tfcHomeCount" role="status" aria-live="polite">01 / 04</span>
          <button type="button" id="tfcHomeNext" aria-label="Next financing option">→</button>
        </div>
        <div class="tfc-home-actions">
          <button type="button" class="btn btn-ghost" data-go="apply">Apply Now ↗</button>
          <button type="button" class="btn btn-gold">Check Eligibility</button>
        </div>
        <div class="tfc-home-proof" aria-label="Toronto Finance Company services">
          <span><strong>4</strong> Funding Solutions</span>
          <span><strong>5+</strong> Canadian Financing Partners</span>
          <span><strong>24 HRS</strong> Potential Initial Response</span>
        </div>
        <div class="tfc-home-contact" aria-label="Contact Toronto Finance Company">
          <div class="tfc-home-contact-actions">
            <a class="tfc-home-contact-item" href="tel:+16044459624" aria-label="Call Toronto Finance Company at +1 604 445 9624">
              <span class="tfc-home-contact-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 3.09 5.18 2 2 0 0 1 5.08 3h3a2 2 0 0 1 2 1.72c.12.95.35 1.89.68 2.78a2 2 0 0 1-.45 2.11L9.04 10.9a16 16 0 0 0 4.06 4.06l1.29-1.27a2 2 0 0 1 2.11-.45c.89.33 1.83.56 2.78.68a2 2 0 0 1 1.72 2Z"/>
                </svg>
              </span>
              <span class="tfc-home-contact-label">Call Us</span>
              <span class="tfc-home-contact-detail">+1 604 445 9624</span>
            </a>
            <a class="tfc-home-contact-item" href="mailto:info@torontofinancecompany.com" aria-label="Email Toronto Finance Company at info@torontofinancecompany.com">
              <span class="tfc-home-contact-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2"/>
                  <path d="m22 7-10 7L2 7"/>
                </svg>
              </span>
              <span class="tfc-home-contact-label">Email Us</span>
              <span class="tfc-home-contact-detail">info@torontofinancecompany.com</span>
            </a>
          </div>
        </div>
        <footer class="tfc-home-footer">All approvals are subject to lender’s discretion &amp; due diligence.</footer>
      </div>
      ${tfcHomeProducts.map(product=>`
        <dialog class="tfc-home-detail" id="tfcHomeDetail-${product.id}" aria-labelledby="tfcHomeTitle-${product.id}">
          <button type="button" class="tfc-home-close" aria-label="Close lender information">×</button>
          <div class="tfc-home-detail-tag">BUSINESS FINANCING · TORONTO FINANCE COMPANY</div>
          <h2 id="tfcHomeTitle-${product.id}">${product.title}</h2>
          <div class="tfc-home-detail-amount">${product.range}</div>
          <p>${product.intro}</p>
          <div class="tfc-home-features">${product.features.map(f=>`<section><h3>${f[0]}</h3><p>${f[1]}</p></section>`).join('')}</div>
          <h3>Put funding to work</h3>
          <ul>${product.uses.map(x=>`<li>${x}</li>`).join('')}</ul>
          <h3>Indicative eligibility</h3>
          <ul>${product.criteria.map(x=>`<li>${x}</li>`).join('')}</ul>
          <p class="tfc-home-detail-note"><span>${product.note}</span> <span>Toronto Finance Company arranges financing through participating lenders and does not guarantee approval.</span></p>
          <div class="tfc-home-detail-actions">
            <a href="apply.html">Apply Now ↗</a>
            <a href="eligibility.html">Check Eligibility ↗</a>
          </div>
        </dialog>`).join('')}
    </section>`;
  wire();
  initTfcHomeCarousel();
  initTfcHomeLanguage();
  replayMotion();
}

function initTfcHomeCarousel(){
  const scope=document.querySelector('.tfc-home');
  if(!scope)return;
  const screen=scope.querySelector('#tfcHomeScreen');
  const slides=[...scope.querySelectorAll('[data-tfc-slide]')];
  const counter=scope.querySelector('#tfcHomeCount');
  let current=0;
  let autoplay=null;
  let touchStart=null;
  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const render=()=>{
    const total=slides.length;
    slides.forEach((slide,i)=>{
      const active=i===current;
      slide.classList.toggle('is-active',active);
      slide.classList.toggle('is-previous',!active&&i===(current+total-1)%total);
      slide.classList.toggle('is-next',!active&&i===(current+1)%total);
      slide.classList.toggle('is-hidden',!active&&i!==(current+total-1)%total&&i!==(current+1)%total);
      slide.setAttribute('aria-hidden',String(!active));
      slide.querySelector('.tfc-home-know').tabIndex=active?0:-1;
    });
    counter.textContent=String(current+1).padStart(2,'0')+' / '+String(total).padStart(2,'0');
  };
  const stop=()=>{if(autoplay){clearInterval(autoplay);autoplay=null}};
  const start=()=>{
    stop();
    if(reduceMotion||document.visibilityState==='hidden'||scope.querySelector('dialog[open]'))return;
    autoplay=setInterval(()=>{if(!scope.isConnected){stop();return}current=(current+1)%slides.length;render()},4800);
  };
  const move=direction=>{current=(current+direction+slides.length)%slides.length;render();start()};
  scope.querySelector('#tfcHomePrev').addEventListener('click',()=>move(-1));
  scope.querySelector('#tfcHomeNext').addEventListener('click',()=>move(1));
  screen.addEventListener('touchstart',event=>{touchStart=event.touches[0]?.clientX??null},{passive:true});
  screen.addEventListener('touchend',event=>{
    if(touchStart===null)return;
    const distance=(event.changedTouches[0]?.clientX??touchStart)-touchStart;
    touchStart=null;
    if(Math.abs(distance)>35)move(distance<0?1:-1);
  },{passive:true});
  screen.addEventListener('keydown',event=>{
    if(event.key==='ArrowRight'||event.key==='ArrowLeft'){
      event.preventDefault();
      move(event.key==='ArrowRight'?1:-1);
    }
  });
  scope.addEventListener('click',event=>{
    const button=event.target.closest('[data-tfc-more]');
    if(!button)return;
    const dialog=scope.querySelector('#tfcHomeDetail-'+button.dataset.tfcMore);
    if(!dialog)return;
    stop();
    dialog.showModal();
  });
  scope.querySelectorAll('.tfc-home-detail').forEach(dialog=>{
    dialog.querySelector('.tfc-home-close').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',event=>{
      if(event.target!==dialog)return;
      const r=dialog.getBoundingClientRect();
      if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();
    });
    dialog.addEventListener('close',start);
  });
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')start();else stop()});
  screen.addEventListener('mouseenter',stop);
  screen.addEventListener('mouseleave',start);
  screen.addEventListener('focusin',stop);
  screen.addEventListener('focusout',event=>{if(!screen.contains(event.relatedTarget))start()});
  render();start();
}

const tfcHomePunjabi={
  "Log In ↗": "ਲੌਗ ਇਨ ↗",
  "Experience": "ਐਕਸਪੀਰੀਅੰਸ",
  "About Us": "ਸਾਡੇ ਬਾਰੇ",
  "Apply Now ↗": "ਅਪਲਾਈ ਨਾਓ ↗",
  "Privacy Policy": "ਪ੍ਰਾਈਵੇਸੀ ਪਾਲਿਸੀ",
  "Terms & Conditions": "ਟਰਮਜ਼ ਅਤੇ ਕੰਡੀਸ਼ਨਜ਼",
  "Contact Us ↗": "ਸੰਪਰਕ ਕਰੋ ↗",
  "BUSINESS FINANCING SOLUTIONS": "ਬਿਜ਼ਨਸ ਫਾਈਨੈਂਸਿੰਗ ਸਲਿਊਸ਼ਨਜ਼",
  "01 / BUSINESS FINANCING": "01 / ਬਿਜ਼ਨਸ ਫਾਈਨੈਂਸਿੰਗ",
  "02 / BUSINESS FINANCING": "02 / ਬਿਜ਼ਨਸ ਫਾਈਨੈਂਸਿੰਗ",
  "03 / BUSINESS FINANCING": "03 / ਬਿਜ਼ਨਸ ਫਾਈਨੈਂਸਿੰਗ",
  "04 / BUSINESS FINANCING": "04 / ਬਿਜ਼ਨਸ ਫਾਈਨੈਂਸਿੰਗ",
  "Business Term Loans": "ਬਿਜ਼ਨਸ ਟਰਮ ਲੋਨਜ਼",
  "Business Lines of Credit": "ਬਿਜ਼ਨਸ ਲਾਈਨਜ਼ ਆਫ਼ ਕ੍ਰੈਡਿਟ",
  "Flex Funds Advance": "ਫਲੈਕਸ ਫੰਡਜ਼ ਐਡਵਾਂਸ",
  "Merchant Cash Advance": "ਮਰਚੈਂਟ ਕੈਸ਼ ਐਡਵਾਂਸ",
  "BUSINESS FINANCING · TORONTO FINANCE COMPANY": "ਬਿਜ਼ਨਸ ਫਾਈਨੈਂਸਿੰਗ · TORONTO FINANCE COMPANY",
  "Know More ↗": "ਹੋਰ ਜਾਣਕਾਰੀ ↗",
  "Check Eligibility": "ਐਲੀਜੀਬਿਲਟੀ ਚੈੱਕ ਕਰੋ",
  "Check Eligibility ↗": "ਐਲੀਜੀਬਿਲਟੀ ਚੈੱਕ ਕਰੋ ↗",
  "Call Us": "ਕਾਲ ਕਰੋ",
  "Email Us": "ਈਮੇਲ ਕਰੋ",
  "Funding Solutions": "ਫੰਡਿੰਗ ਸਲਿਊਸ਼ਨਜ਼",
  "Canadian Financing Partners": "ਕੈਨੇਡੀਅਨ ਫਾਈਨੈਂਸਿੰਗ ਪਾਰਟਨਰਜ਼",
  "Potential Initial Response": "ਸ਼ੁਰੂਆਤੀ ਜਵਾਬ ਦੀ ਸੰਭਾਵਨਾ",
  "All approvals are subject to lender’s discretion & due diligence.": "ਸਾਰੀਆਂ ਅਪਰੂਵਲਜ਼ ਲੈਂਡਰ ਦੇ ਫੈਸਲੇ ਅਤੇ ਡਿਊ ਡਿਲੀਜੈਂਸ 'ਤੇ ਨਿਰਭਰ ਹਨ।",
  "Business capital with structured, predictable repayments.": "ਬਿਜ਼ਨਸ ਕੈਪੀਟਲ, ਤੈਅ ਅਤੇ ਪ੍ਰਿਡਿਕਟੇਬਲ ਰੀਪੇਮੈਂਟਸ ਦੇ ਨਾਲ।",
  "Flexible access to working capital when you need it.": "ਜਦੋਂ ਲੋੜ ਹੋਵੇ, ਵਰਕਿੰਗ ਕੈਪੀਟਲ ਲਈ ਫਲੈਕਸੀਬਲ ਐਕਸੈੱਸ।",
  "Flexible business funding aligned with your sales.": "ਤੁਹਾਡੀਆਂ ਸੇਲਜ਼ ਦੇ ਮੁਤਾਬਕ ਫਲੈਕਸੀਬਲ ਬਿਜ਼ਨਸ ਫੰਡਿੰਗ।",
  "Working capital based on established business sales.": "ਬਿਜ਼ਨਸ ਦੀਆਂ ਸੇਲਜ਼ ਦੇ ਆਧਾਰ 'ਤੇ ਵਰਕਿੰਗ ਕੈਪੀਟਲ।",
  "More choice": "ਹੋਰ ਆਪਸ਼ਨਜ਼",
  "Repayment options": "ਰੀਪੇਮੈਂਟ ਆਪਸ਼ਨਜ਼",
  "Clear financing costs": "ਕਲੀਅਰ ਫਾਈਨੈਂਸਿੰਗ ਕੌਸਟ",
  "Put funding to work": "ਫੰਡਿੰਗ ਦੀ ਵਰਤੋਂ",
  "Indicative eligibility": "ਐਲੀਜੀਬਿਲਟੀ ਗਾਈਡਲਾਈਨਜ਼",
  "Access funds as needed": "ਲੋੜ ਮੁਤਾਬਕ ਫੰਡਜ਼",
  "Flexible repayments": "ਫਲੈਕਸੀਬਲ ਰੀਪੇਮੈਂਟਸ",
  "Pay for what you use": "ਵਰਤੀ ਰਕਮ 'ਤੇ ਚਾਰਜ",
  "Revenue-focused": "ਰੈਵੇਨਿਊ-ਫੋਕਸਡ",
  "Sales-aligned payments": "ਸੇਲਜ਼ ਮੁਤਾਬਕ ਪੇਮੈਂਟਸ",
  "Clear cost": "ਕਲੀਅਰ ਕੌਸਟ",
  "Sales-focused": "ਸੇਲਜ਼-ਫੋਕਸਡ",
  "Fast application": "ਫਾਸਟ ਐਪਲੀਕੇਸ਼ਨ",
  "Flexible use": "ਫਲੈਕਸੀਬਲ ਵਰਤੋਂ",
  "Compare available lenders and financing structures.": "ਉਪਲਬਧ ਲੈਂਡਰਾਂ ਅਤੇ ਫਾਈਨੈਂਸਿੰਗ ਸਟਰਕਚਰਜ਼ ਦੀ ਤੁਲਨਾ ਕਰੋ।",
  "Scheduled payments and terms vary by lender.": "ਸ਼ੈਡਿਊਲਡ ਪੇਮੈਂਟਸ ਅਤੇ ਟਰਮਜ਼ ਲੈਂਡਰ ਮੁਤਾਬਕ ਬਦਲਦੀਆਂ ਹਨ।",
  "Review borrowing costs and repayment obligations before accepting.": "ਅਕਸੈਪਟ ਕਰਨ ਤੋਂ ਪਹਿਲਾਂ ਬੋਰੋਇੰਗ ਕੌਸਟ ਅਤੇ ਰੀਪੇਮੈਂਟ ਦੀਆਂ ਸ਼ਰਤਾਂ ਚੈੱਕ ਕਰੋ।",
  "Business expansion and renovations": "ਬਿਜ਼ਨਸ ਐਕਸਪੈਂਸ਼ਨ ਅਤੇ ਰੈਨੋਵੇਸ਼ਨਜ਼",
  "Inventory and equipment purchases": "ਇਨਵੈਂਟਰੀ ਅਤੇ ਇਕੁਇਪਮੈਂਟ ਖਰੀਦਣਾ",
  "Working capital and operating expenses": "ਵਰਕਿੰਗ ਕੈਪੀਟਲ ਅਤੇ ਓਪਰੇਟਿੰਗ ਖਰਚੇ",
  "Established business revenue and recent bank statements": "ਐਸਟੈਬਲਿਸ਼ਡ ਬਿਜ਼ਨਸ ਰੈਵੇਨਿਊ ਅਤੇ ਰੀਸੈਂਟ ਬੈਂਕ ਸਟੇਟਮੈਂਟਸ",
  "Personal credit and existing obligations reviewed": "ਪਰਸਨਲ ਕ੍ਰੈਡਿਟ ਅਤੇ ਮੌਜੂਦਾ ਕਰਜ਼ਿਆਂ ਦੀ ਰਿਵਿਊ",
  "Final eligibility depends on the selected lender": "ਫਾਈਨਲ ਐਲੀਜੀਬਿਲਟੀ ਚੁਣੇ ਹੋਏ ਲੈਂਡਰ 'ਤੇ ਨਿਰਭਰ ਹੈ",
  "Use available credit for eligible business expenses.": "ਐਲੀਜੀਬਲ ਬਿਜ਼ਨਸ ਖਰਚਿਆਂ ਲਈ ਉਪਲਬਧ ਕ੍ਰੈਡਿਟ ਵਰਤੋ।",
  "Available repayment structures depend on the lender.": "ਰੀਪੇਮੈਂਟ ਸਟਰਕਚਰ ਲੈਂਡਰ ਮੁਤਾਬਕ ਹੁੰਦੇ ਹਨ।",
  "Some revolving facilities charge interest on the outstanding amount.": "ਕੁਝ ਰਿਵਾਲਵਿੰਗ ਫੈਸਿਲਿਟੀਆਂ ਵਿੱਚ ਸਿਰਫ਼ ਬਕਾਇਆ ਰਕਮ 'ਤੇ ਇੰਟਰੈਸਟ ਲੱਗਦਾ ਹੈ।",
  "Seasonal or unexpected costs": "ਸੀਜ਼ਨਲ ਜਾਂ ਅਚਾਨਕ ਖਰਚੇ",
  "Inventory and supplier payments": "ਇਨਵੈਂਟਰੀ ਅਤੇ ਸਪਲਾਇਰ ਪੇਮੈਂਟਸ",
  "Recurring working-capital needs": "ਲਗਾਤਾਰ ਵਰਕਿੰਗ ਕੈਪੀਟਲ ਦੀਆਂ ਲੋੜਾਂ",
  "Established operating history and business banking": "ਬਿਜ਼ਨਸ ਦੀ ਓਪਰੇਟਿੰਗ ਹਿਸਟਰੀ ਅਤੇ ਬਿਜ਼ਨਸ ਬੈਂਕਿੰਗ",
  "Revenue, debt capacity and credit profile assessed": "ਰੈਵੇਨਿਊ, ਡੈੱਟ ਕੈਪੇਸਿਟੀ ਅਤੇ ਕ੍ਰੈਡਿਟ ਪ੍ਰੋਫਾਈਲ ਦੀ ਅਸੈਸਮੈਂਟ",
  "Product availability and limits vary by lender": "ਪ੍ਰੋਡਕਟ ਦੀ ਅਵੇਲੇਬਿਲਿਟੀ ਅਤੇ ਲਿਮਿਟ ਲੈਂਡਰ ਮੁਤਾਬਕ",
  "Business sales and deposits are central to the assessment.": "ਬਿਜ਼ਨਸ ਸੇਲਜ਼ ਅਤੇ ਡਿਪਾਜ਼ਿਟ ਅਸੈਸਮੈਂਟ ਦਾ ਮੁੱਖ ਹਿੱਸਾ ਹਨ।",
  "Some providers adjust remittances as sales change.": "ਕੁਝ ਪ੍ਰੋਵਾਈਡਰ ਸੇਲਜ਼ ਮੁਤਾਬਕ ਰੀਮਿਟੈਂਸ ਬਦਲਦੇ ਹਨ।",
  "Understand the total agreed remittance amount upfront.": "ਕੁੱਲ ਤੈਅ ਰੀਮਿਟੈਂਸ ਰਕਮ ਪਹਿਲਾਂ ਸਮਝੋ।",
  "Inventory and seasonal preparation": "ਇਨਵੈਂਟਰੀ ਅਤੇ ਸੀਜ਼ਨਲ ਤਿਆਰੀ",
  "Cash-flow gaps or expansion": "ਕੈਸ਼ ਫਲੋ ਗੈਪ ਜਾਂ ਐਕਸਪੈਂਸ਼ਨ",
  "Equipment and staffing expenses": "ਇਕੁਇਪਮੈਂਟ ਅਤੇ ਸਟਾਫਿੰਗ ਖਰਚੇ",
  "Recent bank statements and consistent business activity": "ਰੀਸੈਂਟ ਬੈਂਕ ਸਟੇਟਮੈਂਟਸ ਅਤੇ ਨਿਯਮਤ ਬਿਜ਼ਨਸ ਐਕਟੀਵਿਟੀ",
  "Sales performance and current debt reviewed": "ਸੇਲਜ਼ ਪਰਫਾਰਮੈਂਸ ਅਤੇ ਮੌਜੂਦਾ ਡੈੱਟ ਦੀ ਰਿਵਿਊ",
  "Each provider sets its own underwriting criteria": "ਹਰ ਪ੍ਰੋਵਾਈਡਰ ਦੀ ਆਪਣੀ ਅੰਡਰਰਾਈਟਿੰਗ ਕ੍ਰਾਈਟੇਰੀਆ ਹੈ",
  "Assessment considers business deposits and receivables.": "ਅਸੈਸਮੈਂਟ ਵਿੱਚ ਬਿਜ਼ਨਸ ਡਿਪਾਜ਼ਿਟ ਅਤੇ ਰਿਸੀਵੇਬਲਜ਼ ਵੇਖੇ ਜਾਂਦੇ ਹਨ।",
  "Digital applications may simplify initial review.": "ਡਿਜੀਟਲ ਐਪਲੀਕੇਸ਼ਨ ਸ਼ੁਰੂਆਤੀ ਰਿਵਿਊ ਆਸਾਨ ਕਰ ਸਕਦੀ ਹੈ।",
  "Funds may support day-to-day business priorities.": "ਫੰਡਜ਼ ਰੋਜ਼ਾਨਾ ਦੀਆਂ ਬਿਜ਼ਨਸ ਲੋੜਾਂ ਲਈ ਵਰਤੇ ਜਾ ਸਕਦੇ ਹਨ।",
  "Time-sensitive operating expenses": "ਜਲਦੀ ਲੋੜੀਂਦੇ ਓਪਰੇਟਿੰਗ ਖਰਚੇ",
  "Inventory and supplier costs": "ਇਨਵੈਂਟਰੀ ਅਤੇ ਸਪਲਾਇਰ ਕੌਸਟ",
  "Bridging temporary cash-flow needs": "ਅਸਥਾਈ ਕੈਸ਼ ਫਲੋ ਦੀਆਂ ਲੋੜਾਂ ਪੂਰੀਆਂ ਕਰਨਾ",
  "Active business with documented bank deposits": "ਐਕਟਿਵ ਬਿਜ਼ਨਸ ਅਤੇ ਬੈਂਕ ਡਿਪਾਜ਼ਿਟ ਦਾ ਰਿਕਾਰਡ",
  "Existing lender payments and account activity reviewed": "ਮੌਜੂਦਾ ਲੈਂਡਰ ਪੇਮੈਂਟਸ ਅਤੇ ਅਕਾਊਂਟ ਐਕਟੀਵਿਟੀ ਦੀ ਰਿਵਿਊ",
  "Approval, cost and holdback structure vary by provider": "ਅਪਰੂਵਲ, ਕੌਸਟ ਅਤੇ ਹੋਲਡਬੈਕ ਸਟਰਕਚਰ ਪ੍ਰੋਵਾਈਡਰ ਮੁਤਾਬਕ ਬਦਲਦੇ ਹਨ",
  "Access a lump sum of business capital with scheduled repayment over an agreed term. Funding may be suitable for expansion, inventory, equipment and operating needs.": "ਇੱਕ ਵਾਰ ਵਿੱਚ ਬਿਜ਼ਨਸ ਕੈਪੀਟਲ ਲਵੋ ਅਤੇ ਤੈਅ ਟਰਮ ਦੌਰਾਨ ਸ਼ੈਡਿਊਲਡ ਰੀਪੇਮੈਂਟ ਕਰੋ। ਇਹ ਫੰਡਿੰਗ ਐਕਸਪੈਂਸ਼ਨ, ਇਨਵੈਂਟਰੀ, ਇਕੁਇਪਮੈਂਟ ਅਤੇ ਓਪਰੇਟਿੰਗ ਲੋੜਾਂ ਲਈ ਹੋ ਸਕਦੀ ਹੈ।",
  "A business line of credit can offer approved access to funds for ongoing cash-flow needs, subject to the facility structure and lender terms.": "ਬਿਜ਼ਨਸ ਲਾਈਨ ਆਫ਼ ਕ੍ਰੈਡਿਟ ਨਾਲ ਕੈਸ਼ ਫਲੋ ਦੀਆਂ ਲਗਾਤਾਰ ਲੋੜਾਂ ਲਈ ਅਪਰੂਵਡ ਫੰਡਜ਼ ਮਿਲ ਸਕਦੇ ਹਨ। ਇਹ ਫੈਸਿਲਿਟੀ ਸਟਰਕਚਰ ਅਤੇ ਲੈਂਡਰ ਦੀਆਂ ਟਰਮਜ਼ 'ਤੇ ਨਿਰਭਰ ਹੈ।",
  "A Flex Funds Advance provides upfront business capital in exchange for future sales receivables. The financing cost and remittance structure depend on the agreement.": "ਫਲੈਕਸ ਫੰਡਜ਼ ਐਡਵਾਂਸ ਭਵਿੱਖ ਦੀਆਂ ਸੇਲਜ਼ ਰਿਸੀਵੇਬਲਜ਼ ਦੇ ਬਦਲੇ ਅਪਫਰੰਟ ਬਿਜ਼ਨਸ ਕੈਪੀਟਲ ਦਿੰਦਾ ਹੈ। ਫਾਈਨੈਂਸਿੰਗ ਕੌਸਟ ਅਤੇ ਰੀਮਿਟੈਂਸ ਐਗਰੀਮੈਂਟ ਮੁਤਾਬਕ ਹਨ।",
  "Merchant cash advances can help eligible businesses access working capital based on their sales or receivables instead of a traditional term-loan structure.": "ਮਰਚੈਂਟ ਕੈਸ਼ ਐਡਵਾਂਸ ਰਾਹੀਂ ਐਲੀਜੀਬਲ ਬਿਜ਼ਨਸ ਆਪਣੀਆਂ ਸੇਲਜ਼ ਜਾਂ ਰਿਸੀਵੇਬਲਜ਼ ਦੇ ਆਧਾਰ 'ਤੇ ਵਰਕਿੰਗ ਕੈਪੀਟਲ ਲੈ ਸਕਦੇ ਹਨ, ਬਿਨਾਂ ਰਵਾਇਤੀ ਟਰਮ ਲੋਨ ਸਟਰਕਚਰ ਦੇ।",
  "Funding ranges are indicative, not guaranteed. Rates, repayment terms, approval and documentation vary by lending partner.": "ਫੰਡਿੰਗ ਰੇਂਜ ਸਿਰਫ਼ ਅੰਦਾਜ਼ੇ ਲਈ ਹੈ, ਗਾਰੰਟੀ ਨਹੀਂ। ਰੇਟਸ, ਰੀਪੇਮੈਂਟ ਟਰਮਜ਼, ਅਪਰੂਵਲ ਅਤੇ ਡੌਕੂਮੈਂਟਸ ਲੈਂਡਿੰਗ ਪਾਰਟਨਰ ਮੁਤਾਬਕ ਬਦਲਦੇ ਹਨ।",
  "Not every business line of credit is revolving. Interest, draw conditions, security requirements and available credit depend on the specific offer.": "ਹਰ ਬਿਜ਼ਨਸ ਲਾਈਨ ਆਫ਼ ਕ੍ਰੈਡਿਟ ਰਿਵਾਲਵਿੰਗ ਨਹੀਂ ਹੁੰਦੀ। ਇੰਟਰੈਸਟ, ਡਰਾਅ ਕੰਡੀਸ਼ਨਜ਼, ਸਕਿਉਰਿਟੀ ਅਤੇ ਕ੍ਰੈਡਿਟ ਲਿਮਿਟ ਖਾਸ ਆਫ਼ਰ 'ਤੇ ਨਿਰਭਰ ਹਨ।",
  "An advance of future receivables is not the same as a conventional loan. Review factor costs, total remittances and all contractual obligations.": "ਫਿਊਚਰ ਰਿਸੀਵੇਬਲਜ਼ ਐਡਵਾਂਸ ਇੱਕ ਆਮ ਲੋਨ ਨਹੀਂ ਹੈ। ਫੈਕਟਰ ਕੌਸਟ, ਕੁੱਲ ਰੀਮਿਟੈਂਸ ਅਤੇ ਸਾਰੀਆਂ ਐਗਰੀਮੈਂਟ ਸ਼ਰਤਾਂ ਚੈੱਕ ਕਰੋ।",
  "MCA financing can be expensive and may involve frequent payments. Carefully review total cost, remittance terms and existing obligations before accepting.": "MCA ਫਾਈਨੈਂਸਿੰਗ ਮਹਿੰਗੀ ਹੋ ਸਕਦੀ ਹੈ ਅਤੇ ਵਾਰ-ਵਾਰ ਪੇਮੈਂਟਸ ਹੋ ਸਕਦੀਆਂ ਹਨ। ਅਕਸੈਪਟ ਕਰਨ ਤੋਂ ਪਹਿਲਾਂ ਕੁੱਲ ਕੌਸਟ, ਰੀਮਿਟੈਂਸ ਟਰਮਜ਼ ਅਤੇ ਮੌਜੂਦਾ ਕਰਜ਼ੇ ਵੇਖੋ।",
  "Toronto Finance Company arranges financing through participating lenders and does not guarantee approval.": "ਟੋਰਾਂਟੋ ਫਾਈਨੈਂਸ ਕੰਪਨੀ ਪਾਰਟਨਰ ਲੈਂਡਰਾਂ ਰਾਹੀਂ ਫਾਈਨੈਂਸਿੰਗ ਅਰੇਂਜ ਕਰਦੀ ਹੈ ਅਤੇ ਅਪਰੂਵਲ ਦੀ ਗਾਰੰਟੀ ਨਹੀਂ ਦਿੰਦੀ।"
};
function initTfcHomeLanguage(){
  const root=document.querySelector('.tfc-home');
  const switchButton=root?.querySelector('#tfcHomeLanguageSwitch');
  if(!root||!switchButton)return;
  const translations=tfcHomePunjabi;
  const reverse=new Map(Object.entries(translations).map(([english,punjabi])=>[punjabi,english]));
  const setLanguage=(lang)=>{
    const punjabi=lang==='pa';
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{
      acceptNode(node){
        if(!node.parentElement||node.parentElement.closest('script,style,svg,#tfcHomeLanguageSwitch'))return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    while(walker.nextNode()){
      const node=walker.currentNode;
      const original=node.nodeValue;
      const text=original.trim();
      const mapped=punjabi?translations[text]:reverse.get(text);
      if(mapped&&mapped!==text)node.nodeValue=original.replace(text,mapped);
    }
    document.documentElement.lang=punjabi?'pa':'en';
    root.classList.toggle('is-punjabi',punjabi);
    switchButton.textContent=punjabi?'English':'ਪੰਜਾਬੀ';
    switchButton.lang=punjabi?'en':'pa';
    switchButton.setAttribute('aria-label',punjabi?'Switch language to English':'Switch language to Punjabi');
    const menu=root.querySelector('.tfc-vfc-menu>summary');
    if(menu)menu.setAttribute('aria-label',punjabi?'ਵੈੱਬਸਾਈਟ ਮੀਨੂ ਖੋਲ੍ਹੋ':'Open website menu');
    try{localStorage.setItem('tfc-home-language',punjabi?'pa':'en')}catch(_){}
  };
  switchButton.addEventListener('click',()=>setLanguage(document.documentElement.lang==='pa'?'en':'pa'));
  let saved='en';
  try{if(localStorage.getItem('tfc-home-language')==='pa')saved='pa'}catch(_){}
  setLanguage(saved);
  // The existing eligibility integration may replace its button text once
  // after the homepage renders. Keep the selected language consistent.
  const eligibility=root.querySelector('.tfc-home-actions .btn-gold');
  if(eligibility&&typeof MutationObserver!=='undefined'){
    new MutationObserver(()=>{
      if(document.documentElement.lang==='pa'&&eligibility.textContent.trim()==='Check Eligibility'){
        eligibility.textContent=translations['Check Eligibility'];
      }
    }).observe(eligibility,{childList:true});
  }
}

function apply() {
  app.innerHTML = `
    <section class="page">
      <nav class="lightnav">
        <span>TORONTO FINANCE COMPANY</span>
        <div class="steps"><span class="step active">Create Account</span></div>
        <button class="linkbtn" data-go="landing">Exit</button>
      </nav>

      <div class="formwrap">
        <h2>Create Your Account</h2>
        <p>Create your secure client account. After account creation, you will be guided through two steps: review and sign your application, then upload six bank statements.</p>

        <div class="grid">
          <div class="field full">
            <label>Full Name</label>
            <input id="name" autocomplete="name" placeholder="Your full legal name" required>
          </div>
          <div class="field full">
            <label>Email Address</label>
            <input id="email" type="email" autocomplete="email" placeholder="name@company.com" required>
          </div>
          <div class="field full">
            <label>Phone Number</label>
            <input id="phone" type="tel" autocomplete="tel" inputmode="tel" placeholder="+1 416-555-0123" required>
          </div>
          <div class="field full">
            <label>Create Password</label>
            <input id="password" type="password" autocomplete="new-password" placeholder="Minimum 8 characters" minlength="8" required>
          </div>
        </div>

        <p style="font-size:12px;line-height:1.6;color:#786f65;margin-top:18px">
          By creating an account, you agree to Toronto Finance Company’s <a href="terms.html">Terms & Conditions</a> and acknowledge its <a href="privacy.html">Privacy Policy</a>.
        </p>

        <div class="form-actions">
          <button class="linkbtn" data-go="landing">Back Home</button>
          <button class="darkbtn" id="createAccountBtn">Create Account</button>
        </div>
        <div id="accountMessage" style="font-size:12px;margin-top:14px"></div>
      </div>
    </section>`;
  wire();
  replayMotion();
}

function wire() {
  document.querySelectorAll('[data-page]').forEach(element => {
    element.onclick = () => { window.location.href = element.dataset.page; };
  });

  document.querySelectorAll('[data-go]').forEach(element => {
    element.onclick = () => {
      const destination = element.dataset.go;
      if (destination === 'apply') window.location.href = 'apply.html';
      else if (destination === 'dashboard') window.location.href = 'login.html';
      else landing();
    };
  });
}

const params = new URLSearchParams(window.location.search);
if (params.get('apply') === '1') window.location.replace('apply.html');
else landing();