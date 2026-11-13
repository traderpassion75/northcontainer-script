/* ============================================================
   1. GESTION DE LA COTATION (AFFICHAGE, PROGRESSION, APPEL API)
   ============================================================ */
(function() {
  var API = "https://script.google.com/macros/s/AKfycbxRjRVFxUHg0fqu1iH46_b_OJkbOBE9snYeA40ka13Y2THYc0gb6Q7O2trqDCRTkq9Q/exec";

  var root = document.getElementById("nc-quotation");
  if (!root) return;
  
  var params = new URLSearchParams(window.location.search);
  var depart = params.get("filter-by-Port de départ") || "Shanghai";
  var destination = params.get("filter-by-Port d'arrivée") || "Le Havre";
  var container = params.get("filter-by-Type de conteneur") || "20 pieds";
  var codePostal = params.get("codePostal") || "";
  
  var statusEl = document.getElementById("nc-status");
  var progressContainer = document.getElementById("nc-status-container");
  var progressBar = document.getElementById("nc-progress-bar");

  // --- GESTION DU COMPTE À REBOURS (5 secondes) ---
  var secondsLeft = 5;
  var countdownInterval = setInterval(function() {
    secondsLeft--;
    if (secondsLeft > 0) {
      if (statusEl) statusEl.textContent = "Affichage de votre cotation dans " + secondsLeft + "...";
      // Barre qui part de la droite (0%) vers la gauche (100%)
      if (progressBar) progressBar.style.width = ((5 - secondsLeft) * 20) + "%";
    } else {
      clearInterval(countdownInterval);
      // Le temps est écoulé : on cache la barre et le texte
      if (progressContainer) progressContainer.style.display = "none";
    }
  }, 1000);

  function showError(msg) {
    clearInterval(countdownInterval);
    if (progressContainer) progressContainer.style.display = "none";
    if (statusEl) {
        statusEl.style.display = "block";
        statusEl.textContent = msg;
        statusEl.className = "nc-error";
    }
    var res = root.querySelector("#nc-result");
    if (res) res.style.display = "none";
  }
  
  function setValue(id, v) {
    var el = root.querySelector("#" + id);
    if (el) el.textContent = v;
  }
  
  function fmtEur(value) {
    if (value === null || value === undefined) return "—";
    var raw = String(value).replace(/\s/g, "").replace("€", "").replace(",", ".");
    if (raw === "") return "—";
    var n = Number(raw);
    if (!Number.isFinite(n)) return String(value);
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
  }

  if (!depart || !destination || !container) {
    showError("Les critères de votre cotation sont incomplets.");
    return;
  }

  var callbackName = "ncQuoteCallback_" + Date.now();
  var script = document.createElement("script");
  var timeout = setTimeout(function() {
    delete window[callbackName];
    script.remove();
    showError("La recherche prend trop de temps. Veuillez actualiser la page.");
  }, 20000);

  window[callbackName] = function(data) {
    clearTimeout(timeout);
    script.remove();
    delete window[callbackName];

    if (!data || !data.success) {
      showError(data && data.message ? data.message : "Aucune cotation trouvée pour cet itinéraire.");
      return;
    }

    setValue("nc-depart", data.depart || depart);
    setValue("nc-destination", data.destination || destination);
    setValue("nc-container", data.container || container);

    var fo = data.freightOptions || {};
    
    // 📸 ANNUAIRE DES LOGOS (Liens vers vos propres images hébergées sur GitHub)
    var logosTransporteurs = {
      "msc": "https://traderpassion75.github.io/northcontainer-script/m1s1c1.png",
      "maersk": "https://traderpassion75.github.io/northcontainer-script/m1a1e1r1s1k1.png",
      "cma cgm": "https://traderpassion75.github.io/northcontainer-script/c1m1a1.png",
      "hapag-lloyd": "https://traderpassion75.github.io/northcontainer-script/hapag.png"
    };

    function renderFreight(key, priceId, transitId) {
      var o = fo[key] || {};
      var priceEl = root.querySelector("#" + priceId);
      if (!priceEl) return;

      var rawUsd = String(o.prix == null ? "" : o.prix).replace(/\s/g, "").replace("$", "").replace(",", ".");
      var usd = rawUsd === "" ? NaN : Number(rawUsd);

      // Gestion du logo
      var logoHtml = "";
      if (o.transporteur) {
        var nomTransporteur = o.transporteur.toLowerCase().trim();
        var urlLogo = logosTransporteurs[nomTransporteur];
        
        if (urlLogo) {
          logoHtml = '<div class="nc-logo-container"><img src="' + urlLogo + '" alt="' + o.transporteur + '" class="nc-logo-img"></div>';
        } else {
          logoHtml = '<div class="nc-logo-container" style="font-size:12px; font-weight:bold; color:#e5a33d;">' + o.transporteur + '</div>';
        }
      }

      if (!Number.isFinite(usd) || usd <= 0) {
        priceEl.innerHTML = logoHtml + "—";
        setValue(transitId, o.transit ? "Transit : " + o.transit : "Transit : —");
        return;
      }

      var rate = data.usdToEurRate;
      var eurHtml = "";

      if (rate && Number.isFinite(rate)) {
        var eur = usd * rate;
        var eurFormatted = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(eur);
        eurHtml = '<div class="nc-freight-approx">≈</div><div class="nc-freight-eur">' + eurFormatted + '</div>';
      } else {
        eurHtml = '<div class="nc-freight-rate-error">Taux indisponible</div>';
      }

      // 🌟 FORMAT USD MODIFIÉ ICI : "1 600 US$"
      var usdFormatted = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(usd) + " US$";
      
      priceEl.innerHTML = logoHtml + '<div class="nc-freight-usd">' + usdFormatted + '</div>' + eurHtml;
      
      setValue(transitId, o.transit ? "Transit : " + o.transit : "Transit : —");
    }

    renderFreight("normal", "nc-freight-normal-price", "nc-freight-normal-transit");
    renderFreight("standard", "nc-freight-standard-price", "nc-freight-standard-transit");
    renderFreight("express", "nc-freight-express-price", "nc-freight-express-transit");

    var pf = data.portFees || {};
    setValue("nc-fee-arrivee", fmtEur(pf.fraisArrivee));
    setValue("nc-fee-douane", fmtEur(pf.formalitesDouane));
    setValue("nc-fee-bl", fmtEur(pf.fraisBL));
    setValue("nc-fee-dossier", fmtEur(pf.fraisDossier));
    setValue("nc-fee-courrier-fr", fmtEur(pf.courrierFrance));
    setValue("nc-fee-courrier-os", fmtEur(pf.courrierOverseas));

    var liv = data.livraison || null;
    var villeLiv = (data.villeLivraison && data.villeLivraison !== "") ? data.villeLivraison + (data.codePostalLivraison ? " (" + data.codePostalLivraison + ")" : "") : "";

    if (liv && liv.ville) {
      setValue("nc-delivery-title", "LIVRAISON FINALE À " + liv.ville.toUpperCase());
      setValue("nc-delivery-ville", liv.codePostal ? "Code postal : " + liv.codePostal : "");
      setValue("nc-delivery-price", fmtEur(liv.prix));
      setValue("nc-delivery-distance", liv.distance != null ? "Distance routière : " + Number(liv.distance).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " km" : "");
    } else if (villeLiv) {
      setValue("nc-delivery-title", "LIVRAISON FINALE À " + data.villeLivraison.toUpperCase());
      setValue("nc-delivery-ville", data.codePostalLivraison ? "Code postal : " + data.codePostalLivraison : "");
      setValue("nc-delivery-price", fmtEur(data.prixLivraison));
      setValue("nc-delivery-distance", data.distanceLivraisonKm != null ? "Distance routière : " + Number(data.distanceLivraisonKm).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " km" : "");
    } else {
      setValue("nc-delivery-title", "LIVRAISON FINALE");
      setValue("nc-delivery-ville", "Ville non renseignée");
      setValue("nc-delivery-price", data.livraisonMessage || "Code postal de livraison non renseigné");
      setValue("nc-delivery-distance", "");
    }

    // On affiche le résultat de la cotation
    var res = root.querySelector("#nc-result");
    if (res) res.style.display = "block";
    
    // On cache le texte de chargement, mais on laisse la barre de progression finir son animation
    if (statusEl) statusEl.style.display = "none";
  };

  var query = new URLSearchParams({
    depart: depart, destination: destination,
    container: container, codePostal: codePostal,
    callback: callbackName
  });

  script.onerror = function() {
    clearTimeout(timeout);
    delete window[callbackName];
    showError("Impossible de récupérer la cotation. Veuillez réessayer.");
  };

  script.src = API + "?" + query.toString();
  document.body.appendChild(script);
})();

/* ============================================================
   2. GESTION DU FORMULAIRE DE DEMANDE DÉTAILLÉE
   ============================================================ */
(function () {
  var form = document.getElementById("nc-request-form");
  if (!form) return;

  var message = document.getElementById("nc-form-message");
  var button = form.querySelector('button[type="submit"]');
  var params = new URLSearchParams(window.location.search);

  form.elements.depart.value = params.get("filter-by-Port de départ") || "";
  form.elements.destination.value = params.get("filter-by-Port d'arrivée") || "";
  form.elements.container.value = params.get("filter-by-Type de conteneur") || "";

  try {
    var emailAccueil = sessionStorage.getItem("northcontainer_email");
    if (emailAccueil) form.elements.email.value = emailAccueil;
  } catch (e) {}

  var waiting = false;
  var timer;

  window.addEventListener("message", function (event) {
    var data = event.data;
    if (!data || data.type !== "northcontainer-form-result") return;
    clearTimeout(timer);
    waiting = false;
    button.disabled = false;
    button.textContent = "Envoyer ma demande";
    if (data.success) {
      message.textContent = "Votre demande a bien été enregistrée. " + (data.dossier ? "Votre numéro de dossier : " + data.dossier : "");
      form.reset();
    } else {
      message.textContent = data.message || "Une erreur est survenue. Réessayez.";
    }
  });

  form.addEventListener("submit", function (event) {
    if (waiting) { event.preventDefault(); return; }
    var caracteres = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    var reference = "NC-";
    for (var i = 0; i < 8; i++) {
      reference += caracteres[Math.floor(Math.random() * caracteres.length)];
    }
    form.elements.dossier.value = reference;
    waiting = true;
    button.disabled = true;
    button.textContent = "Envoi en cours...";
    message.textContent = "Vous allez recevoir un e-mail de confirmation dans quelques instants. Votre numéro de dossier : " + reference + ".";
    timer = setTimeout(function () {
      if (!waiting) return;
      waiting = false;
      button.disabled = false;
      button.textContent = "Envoyer ma demande";
    }, 30000);
  });
})();
