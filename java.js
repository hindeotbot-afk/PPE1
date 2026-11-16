/* ============ OUTILS ============ */
const $ = (id) => document.getElementById(id);
const read = (cle, defaut) => { try { return JSON.parse(localStorage.getItem(cle)) ?? defaut; } catch { return defaut; } };
const write = (cle, valeur) => localStorage.setItem(cle, JSON.stringify(valeur));
const euro = (n) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const on = (id, event, fn) => $(id)?.addEventListener(event, fn);   // n'agit que si l'élément existe sur la page
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const flash = (msg) => sessionStorage.setItem("flash", msg);        // message pour la page suivante
const showMsg = (msg) => { $("form-msg").textContent = msg; };

async function hash(texte) {   // mot de passe -> empreinte SHA-256
    const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texte));
    return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function toast(msg) {          // notification (stylée ici, donc visible même sans CSS)
    let t = $("toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
    t.textContent = msg;
    t.style.cssText = "position:fixed;top:80px;right:20px;z-index:10000;background:#800000;color:#ffe4c4;padding:12px 20px;border-radius:10px;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,.25);transition:opacity .3s;opacity:1";
    clearTimeout(t.timer);
    t.timer = setTimeout(() => (t.style.opacity = "0"), 2500);
}

/* ============ MENU ET RECHERCHE ============ */
function mobile() { $("nav").classList.toggle("responsive"); }

const champ = $("searchInput");

function filtrer(terme) {      // cache les produits qui ne correspondent pas
    let trouves = 0;
    document.querySelectorAll(".card").forEach((carte) => {
        const ok = carte.querySelector("h3").textContent.toLowerCase().includes(terme);
        carte.style.display = ok ? "flex" : "none";
        if (ok) trouves++;
    });
    if (terme && !trouves) toast("Aucun produit trouvé");
}

on("searchBtn", "click", () => {
    const ouvrir = champ.style.display === "none";
    champ.style.display = ouvrir ? "inline-block" : "none";
    if (ouvrir) champ.focus(); else { champ.value = ""; filtrer(""); }
});
on("searchInput", "input", (e) => filtrer(e.target.value.trim().toLowerCase()));
on("searchInput", "keydown", (e) => {   // hors accueil : Entrée lance la recherche sur l'accueil
    if (e.key === "Enter" && !$("recipes")) location.href = "index.html?q=" + encodeURIComponent(e.target.value.trim());
});
const recherche = new URLSearchParams(location.search).get("q");
if (recherche && champ && $("recipes")) {
    champ.style.display = "inline-block";
    champ.value = recherche;
    filtrer(recherche.toLowerCase());
    $("recipes").scrollIntoView();
}

/* ============ UTILISATEUR CONNECTÉ ============ */
const user = read("currentUser", null);
if (user && $("userLink")) {
    $("userLink").textContent = "👤 " + user.prenom;
    $("userLink").href = "compte.html";
    $("signupLink").parentElement.style.display = "none";
    $("logoutLi").style.display = "";
}
on("logout", "click", (e) => {
    e.preventDefault();
    localStorage.removeItem("currentUser");
    flash("Vous êtes déconnecté·e.");
    location.href = "index.html";
});

/* ============ PANIER ============ */
function updateCartBadge(animer) {
    let badge = $("cart-count");
    if (!badge) {              // crée la pastille si elle manque dans le menu
        const lien = document.querySelector('a[href="panier.html"]');
        if (!lien) return;
        badge = document.createElement("span");
        badge.id = "cart-count";
        badge.style.cssText = "display:inline-block;margin-left:6px;min-width:20px;padding:0 6px;border-radius:10px;background:#800000;color:#ffe4c4;font-size:12px;font-weight:bold;text-align:center;line-height:20px";
        lien.appendChild(badge);
    }
    const n = read("cart", []).reduce((total, i) => total + i.qty, 0);
    badge.textContent = n;
    badge.style.display = n ? "inline-block" : "none";
    if (animer) { badge.classList.remove("bump"); void badge.offsetWidth; badge.classList.add("bump"); }
}

function addToCart(name, price) {
    const cart = read("cart", []);
    const item = cart.find((i) => i.name === name);
    if (item) item.qty++; else cart.push({ name, price, qty: 1 });
    write("cart", cart);
    updateCartBadge(true);
    toast("✓ " + name + " ajouté au panier");
}

// Les boutons "Ajouter au panier" marchent sans onclick : le nom et le prix sont lus dans la carte du produit
document.addEventListener("click", (e) => {
    const btn = e.target.closest(".add-btn");
    if (!btn || btn.hasAttribute("onclick")) return;
    const carte = btn.closest(".card");
    addToCart(carte.querySelector("h3").textContent.trim(), parseFloat(carte.querySelector(".price").textContent.replace(",", ".")));
});

function changeQty(index, delta) {
    const cart = read("cart", []);
    cart[index].qty += delta;
    if (cart[index].qty <= 0) cart.splice(index, 1);
    write("cart", cart);
    renderCart();
}
function removeItem(index) {
    const cart = read("cart", []);
    cart.splice(index, 1);
    write("cart", cart);
    renderCart();
}

function renderCart() {        // dessine la liste dans panier.html
    if (!$("cart-items")) return;
    const cart = read("cart", []);
    let total = 0;
    $("cart-items").innerHTML = cart.length
        ? cart.map((i, idx) => {
              total += i.price * i.qty;
              return `<div class="cart-row">
                  <span>${esc(i.name)}</span>
                  <span class="qty">
                      <button onclick="changeQty(${idx}, -1)" aria-label="Moins">−</button>
                      <b>${i.qty}</b>
                      <button onclick="changeQty(${idx}, 1)" aria-label="Plus">+</button>
                  </span>
                  <span class="cart-price">${euro(i.price * i.qty)}</span>
                  <button class="remove" onclick="removeItem(${idx})" aria-label="Supprimer">✕</button>
              </div>`;
          }).join("")
        : `<p class="empty">Votre panier est vide. <a href="index.html#recipes">Découvrez nos recettes</a></p>`;
    $("total").textContent = euro(total);
}

on("checkout", "click", () => {
    const cart = read("cart", []);
    if (!cart.length) return showMsg("Votre panier est vide.");
    if (!user) { flash("Connectez-vous pour valider votre commande."); location.href = "connexion.html?next=panier"; return; }
    const orders = read("orders", []);
    orders.push({ email: user.email, date: new Date().toLocaleDateString("fr-FR"), total: cart.reduce((t, i) => t + i.price * i.qty, 0), items: cart });
    write("orders", orders);
    write("cart", []);
    flash("Merci " + user.prenom + ", votre commande est enregistrée !");
    location.href = "compte.html";
});

/* ============ INSCRIPTION ============ */
on("formInscription", "submit", async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    const email = d.email.trim().toLowerCase();
    if (d.mdp !== d.mdp2) return showMsg("Les mots de passe ne sont pas identiques.");
    const users = read("users", []);
    if (users.some((u) => u.email === email)) return showMsg("Cet e-mail est déjà utilisé.");
    const profil = {
        prenom: d.prenom.trim(), nom: d.nom.trim(), email,
        adresse: d.adresse.trim(), telephone: d.telephone.trim(),
        newsletter: !!d.newsletter,
        consentement: new Date().toISOString(),   // preuve du consentement (RGPD)
    };
    users.push({ ...profil, mdp: await hash(d.mdp) });
    write("users", users);
    write("currentUser", profil);
    flash("Bienvenue " + profil.prenom + " " + profil.nom + ", votre compte est créé !");
    location.href = "index.html";
});

/* ============ CONNEXION ============ */
on("formConnexion", "submit", async (e) => {
    e.preventDefault();
    const email = $("email").value.trim().toLowerCase();
    const h = await hash($("mdp").value);
    const trouve = read("users", []).find((u) => u.email === email && u.mdp === h);
    if (!trouve) return showMsg("E-mail ou mot de passe incorrect.");
    const { mdp, ...profil } = trouve;
    write("currentUser", profil);
    flash("Bonjour " + profil.prenom + " !");
    location.href = new URLSearchParams(location.search).get("next") === "panier" ? "panier.html" : "index.html";
});

/* ============ MON COMPTE (RGPD) ============ */
function renderAccount() {
    if (!$("account-info")) return;
    if (!user) { location.href = "connexion.html"; return; }
    $("welcome").textContent = "Bonjour " + user.prenom + " 👋";
    $("account-info").innerHTML = `<p><b>Nom :</b> ${esc(user.prenom)} ${esc(user.nom)}</p>
        <p><b>E-mail :</b> ${esc(user.email)}</p>
        <p><b>Adresse :</b> ${esc(user.adresse)}</p>
        <p><b>Téléphone :</b> ${esc(user.telephone)}</p>
        <p><b>Newsletter :</b> ${user.newsletter ? "oui" : "non"}</p>`;

    const commandes = read("orders", []).filter((o) => o.email === user.email);
    $("orders").innerHTML = commandes.map((o) => `<div class="order">
            <p><b>Commande du ${esc(o.date)}</b> — ${euro(o.total)}</p>
            ${o.items.map((i) => `<p>${esc(i.name)} × ${i.qty}</p>`).join("")}</div>`).join("")
        || `<p class="empty">Aucune commande pour le moment.</p>`;

    on("exportData", "click", () => {
        const lien = document.createElement("a");
        lien.href = URL.createObjectURL(new Blob([JSON.stringify({ profil: user, commandes }, null, 2)], { type: "application/json" }));
        lien.download = "mes-donnees-bookis.json";
        lien.click();
    });
    on("deleteAccount", "click", () => {
        if (!confirm("Supprimer définitivement votre compte et vos commandes ?")) return;
        write("users", read("users", []).filter((u) => u.email !== user.email));
        write("orders", read("orders", []).filter((o) => o.email !== user.email));
        localStorage.removeItem("currentUser");
        flash("Votre compte a bien été supprimé.");
        location.href = "index.html";
    });
}

/* ============ NEWSLETTER ET CONTACT ============ */
on("formNewsletter", "submit", (e) => {
    e.preventDefault();
    const email = e.target.email.value.trim().toLowerCase();
    const liste = read("newsletter", []);
    if (!liste.includes(email)) liste.push(email);
    write("newsletter", liste);
    toast("Merci pour votre inscription à la newsletter !");
    e.target.reset();
});
on("formContact", "submit", (e) => {
    e.preventDefault();
    toast("Message envoyé, merci !");
    e.target.reset();
});

/* ============ COOKIES (RGPD) ============ */
const banner = $("cookie-banner");
const CLE = "cookie-consent";

function saveChoice(valeur) {
    write(CLE, { valeur, expire: Date.now() + 1000 * 60 * 60 * 24 * 180 });   // choix gardé 6 mois
    if (banner) banner.style.display = "none";
    // if (valeur === "accepted") { ...lancer Google Analytics ici... }
}
const choix = read(CLE, null);
if (banner && !(choix && choix.expire > Date.now())) banner.style.display = "flex";
on("cookie-accept", "click", () => saveChoice("accepted"));
on("cookie-refuse", "click", () => saveChoice("refused"));
on("manageCookies", "click", (e) => { e.preventDefault(); localStorage.removeItem(CLE); banner.style.display = "flex"; });

/* ============ DÉMARRAGE ============ */
updateCartBadge(false);
renderCart();
renderAccount();
const message = sessionStorage.getItem("flash");
if (message) { sessionStorage.removeItem("flash"); toast(message); }
