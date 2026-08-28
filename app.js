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

function landing() {
  app.innerHTML = `
    <section class="landing">
      <nav class="nav">
        <div class="brand">TORONTO FINANCE COMPANY</div>
        <div class="navlinks">
          <button data-page="experience.html">Experience</button>
          <button data-page="about.html">About</button>
          <button data-go="apply">Privacy</button>
          <button data-go="dashboard">Log In</button>
          <button class="pill" data-go="apply">Apply</button>
        </div>
      </nav>

      <div class="hero">
        <div class="eyebrow">Business Financing Solutions</div>
        <h1 class="serif">
          <span class="title-line">Toronto</span>
          <span class="title-line">Finance Company</span>
        </h1>
        <div class="sub">Term Loans | Business Lines of Credit | Flex Funds | Merchant Cash Advance</div>
        <div class="actions">
          <button class="btn btn-gold">Check Eligibility</button>
          <button class="btn btn-ghost" data-go="apply">Apply Now</button>
        </div>
        <div class="metrics">
          <div class="metric"><strong>$2M+</strong><span>Funding solutions available</span></div>
          <div class="metric"><strong>65+</strong><span>Canadian financing partners</span></div>
          <div class="metric"><strong>24 HRS</strong><span>Potential initial response</span></div>
        </div>
        <div class="contact-strip" aria-label="Contact Toronto Finance Company">
          <span class="contact-label">Contact Us</span>
          <a href="tel:+16044459624">+1 604 445 9624</a>
          <span class="contact-divider">|</span>
          <a href="mailto:info@torontofinancecompany.com">info@torontofinancecompany.com</a>
        </div>
      </div>
    </section>`;
  wire();
  replayMotion();
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
          By creating an account, you agree to Toronto Finance Company’s Terms & Conditions and acknowledge its Privacy Policy.
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
      if (destination === 'apply') apply();
      else if (destination === 'dashboard') window.location.href = 'client-dashboard.html?login=1&v=20260818-endpoint2';
      else landing();
    };
  });
}

const params = new URLSearchParams(window.location.search);
if (params.get('apply') === '1') apply();
else landing();