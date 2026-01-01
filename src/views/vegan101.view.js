export function renderVegan101View({ appEl, setView }) {
  appEl.innerHTML = `
    <div class="container">
      <div class="card">
        <div class="toolbar-header" style="align-items:flex-start;">
          <div>
            <h2 style="margin:0;">🌱 Vegan 101</h2>
          </div>
          <button class="btn btn--ghost" id="toListBtn" type="button" title="Zur Liste">☰</button>
        </div>

        <div class="row" style="gap:1rem; flex-wrap:wrap; margin-top:1rem;">
          <div class="card" style="flex:1; min-width:260px; padding: var(--s-4);">
            <div style="font-weight:900; margin-bottom:.35rem;">🥚 Ei</div>
            <div class="muted"><b>Bindung:</b> Leinsamen-Ei (1 EL + 3 EL Wasser) / Chia-Ei (1+3) / Apfelmus oder Banane (60–80 g)</div>
            <div class="muted" style="margin-top:.35rem;"><b>Aufschlagen:</b> Aquafaba</div>
            <div class="muted" style="margin-top:.35rem;"><b>Rührei:</b> Tofu + Kurkuma + Kala Namak</div>
          </div>

          <div class="card" style="flex:1; min-width:260px; padding: var(--s-4);">
            <div style="font-weight:900; margin-bottom:.35rem;">🥛 Milch & Sahne</div>
            <div class="muted"><b>Milch:</b> Soja (Allround), Hafer (cremig), Mandel (leicht), Kokos (sehr cremig)</div>
            <div class="muted" style="margin-top:.35rem;"><b>Sahne:</b> Cuisine (schnell) oder Cashew + Wasser (ultra cremig)</div>
          </div>

          <div class="card" style="flex:1; min-width:260px; padding: var(--s-4);">
            <div style="font-weight:900; margin-bottom:.35rem;">🧈 Butter</div>
            <div class="muted">Vegane Butter/Margarine (meist 1:1) · Öl in Kuchen (70–80%) · Kokosöl (knusprig, kokosig)</div>
          </div>

          <div class="card" style="flex:1; min-width:260px; padding: var(--s-4);">
            <div style="font-weight:900; margin-bottom:.35rem;">🧀 Käse</div>
            <div class="muted"><b>Geschmack:</b> Hefeflocken / Miso / Umami</div>
            <div class="muted" style="margin-top:.35rem;"><b>Schmelz:</b> Fett + Stärke (z.B. Cashew + Tapioka)</div>
            <div class="muted" style="margin-top:.35rem;"><b>Faustregel:</b> Geschmack = Umami · Schmelz = Fett+Stärke</div>
          </div>

          <div class="card" style="flex:1; min-width:260px; padding: var(--s-4);">
            <div style="font-weight:900; margin-bottom:.35rem;">🍖 Fleisch / Textur</div>
            <div class="muted">Granulat/Hack (Bolo/Chili) · Tofu (Würfel/Scramble) · Seitan (Gyros/Schnitzel) · Pilze/Linsen (Ragout)</div>
          </div>

          <div class="card" style="flex:1; min-width:260px; padding: var(--s-4);">
            <div style="font-weight:900; margin-bottom:.35rem;">🍯 / 🍮</div>
            <div class="muted"><b>Honig:</b> Ahorn / Agave / Dattel (meist 1:1)</div>
            <div class="muted" style="margin-top:.35rem;"><b>Gelatine:</b> Agar-Agar (aufkochen) / Pektin (Marmelade)</div>
          </div>

          <div class="card" style="flex:1; min-width:260px; padding: var(--s-4);">
            <div style="font-weight:900; margin-bottom:.35rem;">🧠 Vegan-Logik</div>
            <div class="muted"><b>Bindung?</b> Leinsamen/Chia/Stärke</div>
            <div class="muted"><b>Cremig?</b> Cashew/Kokos/Cuisine</div>
            <div class="muted"><b>Umami?</b> Hefe/Miso/Sojasauce/Pilze</div>
            <div class="muted"><b>Textur?</b> Tofu/Seitan/Pilze/Granulat</div>
          </div>
        </div>
      </div>
    </div>
  `;

  const toList = appEl.querySelector("#toListBtn");
  if (toList) toList.addEventListener("click", () => setView({ name: "list", selectedId: null, q: "" }));
}
