const app = document.querySelector('#app');
const toast = document.querySelector('#toast');

function notify(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

function landing() {
  app.innerHTML = `
    <section class="landing">
      <nav class="nav">
        <div class="brand">TORONTO FINANCE COMPANY</div>
        <div class="navlinks">
          <button data-go="landing">Experience</button>
          <button data-go="apply">About</button>
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
      </div>
    </section>`;
  wire();
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
}

function wire() {
  document.querySelectorAll('[data-go]').forEach(element => {
    element.onclick = () => {
      const destination = element.dataset.go;
      if (destination === 'apply') apply();
      else if (destination === 'dashboard') window.location.href = 'client-dashboard.html';
      else landing();
    };
  });
}

landing();