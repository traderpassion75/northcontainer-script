(function() {
  var API = "https://script.google.com/macros/s/AKfycbxRjRVFxUHg0fqu1iH46_b_OJkbOBE9snYeA40ka13Y2THYc0gb6Q7O2trqDCRTkq9Q/exec";

  var root = document.getElementById("nc-quotation");
  if (!root) return;
  
  var params = new URLSearchParams(window.location.search);
  var depart = params.get("filter-by-Port de départ") || "Shanghai";
  var destination = params.get("filter-by-Port d'arrivée") || "Le Havre";
  var container = params.get("filter-by-Type de conteneur") || "20 pieds";
  var codePostal = params.get("codePostal") || "76600";
  
  var status = root.querySelector("#nc-status");

  function showError(msg) {
    status.textContent = msg;
    status.className = "nc-status nc-error";
    status.style.display = "block";
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
    function renderFreight(key, priceId, transitId) {
      var o = fo[key] || {};
      var priceEl = root.querySelector("#" + priceId);
      if (!priceEl) return;

      var rawUsd = String(o.prix == null ? "" : o.prix).replace(/\s/g, "").replace("$", "").replace(",", ".");
      var usd = rawUsd === "" ? NaN : Number(rawUsd);

      if (!Number.isFinite(usd) || usd <= 0) {
        priceEl.innerHTML = "—";
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

      var usdFormatted = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(usd);
      priceEl.innerHTML = '<div class="nc-freight-usd">' + usdFormatted + '</div>' + eurHtml;
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

    status.style.display = "none";
    root.querySelector("#nc-result").style.display = "block";
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
