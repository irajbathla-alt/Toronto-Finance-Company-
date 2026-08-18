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
      </div>
    </section>`;
  wire();
}

function apply() {
  window.location.href = 'apply.html?v=20260818-apply1';
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