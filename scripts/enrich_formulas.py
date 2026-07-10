#!/usr/bin/env python3
"""Add Project XC formula/parameter scaffolds to every catalog record.

The important scientific rule is honesty: every record gets a visible formula
section, but generic/imported records are clearly labeled as generic or not yet
curated. Exact coefficients are only shown as numerical values when they are in
Project XC curated metadata or can be mechanically derived as zero/not-applicable.
"""
from __future__ import annotations
import argparse
import copy
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_VERSION = "project-xc-formula-1"

RUNG_VARIABLES = {
    "LDA": [
        {"symbol": "n_σ", "name": "spin density", "role": "density", "status": "generic-derived"},
        {"symbol": "ζ", "name": "spin polarization", "role": "spin-polarization", "status": "generic-derived"},
    ],
    "hybrid LDA": [
        {"symbol": "n_σ", "name": "spin density", "role": "density", "status": "generic-derived"},
        {"symbol": "K_x", "name": "exact-exchange operator", "role": "exact-exchange-operator", "status": "generic-derived"},
    ],
    "GGA": [
        {"symbol": "n_σ", "name": "spin density", "role": "density", "status": "generic-derived"},
        {"symbol": "∇n_σ", "name": "density gradient", "role": "density-gradient", "status": "generic-derived"},
    ],
    "hybrid GGA": [
        {"symbol": "n_σ", "name": "spin density", "role": "density", "status": "generic-derived"},
        {"symbol": "∇n_σ", "name": "density gradient", "role": "density-gradient", "status": "generic-derived"},
        {"symbol": "K_x", "name": "exact-exchange operator", "role": "exact-exchange-operator", "status": "generic-derived"},
    ],
    "range-separated hybrid GGA": [
        {"symbol": "n_σ", "name": "spin density", "role": "density", "status": "generic-derived"},
        {"symbol": "∇n_σ", "name": "density gradient", "role": "density-gradient", "status": "generic-derived"},
        {"symbol": "ω", "name": "range-separation parameter", "role": "range-separation-omega", "status": "generic-derived"},
        {"symbol": "K_x^SR/LR", "name": "short/long-range exact-exchange operator", "role": "exact-exchange-operator", "status": "generic-derived"},
    ],
    "meta-GGA": [
        {"symbol": "n_σ", "name": "spin density", "role": "density", "status": "generic-derived"},
        {"symbol": "∇n_σ", "name": "density gradient", "role": "density-gradient", "status": "generic-derived"},
        {"symbol": "τ_σ", "name": "kinetic-energy density", "role": "kinetic-energy-density", "status": "generic-derived"},
    ],
    "hybrid meta-GGA": [
        {"symbol": "n_σ", "name": "spin density", "role": "density", "status": "generic-derived"},
        {"symbol": "∇n_σ", "name": "density gradient", "role": "density-gradient", "status": "generic-derived"},
        {"symbol": "τ_σ", "name": "kinetic-energy density", "role": "kinetic-energy-density", "status": "generic-derived"},
        {"symbol": "K_x", "name": "exact-exchange operator", "role": "exact-exchange-operator", "status": "generic-derived"},
    ],
    "range-separated hybrid meta-GGA": [
        {"symbol": "n_σ", "name": "spin density", "role": "density", "status": "generic-derived"},
        {"symbol": "∇n_σ", "name": "density gradient", "role": "density-gradient", "status": "generic-derived"},
        {"symbol": "τ_σ", "name": "kinetic-energy density", "role": "kinetic-energy-density", "status": "generic-derived"},
        {"symbol": "ω", "name": "range-separation parameter", "role": "range-separation-omega", "status": "generic-derived"},
        {"symbol": "K_x^SR/LR", "name": "short/long-range exact-exchange operator", "role": "exact-exchange-operator", "status": "generic-derived"},
    ],
}

GENERIC_LATEX = {
    ("LDA", "exchange"): r"E_x^{LDA}[n] = \int n(\mathbf r)\,\epsilon_x(n_\alpha,n_\beta;p)\,d\mathbf r",
    ("LDA", "correlation"): r"E_c^{LDA}[n] = \int n(\mathbf r)\,\epsilon_c(n_\alpha,n_\beta;p)\,d\mathbf r",
    ("LDA", "exchange-correlation"): r"E_{xc}^{LDA}[n] = \int n(\mathbf r)\,\epsilon_{xc}(n_\alpha,n_\beta;p)\,d\mathbf r",
    ("GGA", "exchange"): r"E_x^{GGA}[n] = \int f_x(n_\sigma,\nabla n_\sigma;p)\,d\mathbf r",
    ("GGA", "correlation"): r"E_c^{GGA}[n] = \int f_c(n_\sigma,\nabla n_\sigma;p)\,d\mathbf r",
    ("GGA", "exchange-correlation"): r"E_{xc}^{GGA}[n] = \int f_{xc}(n_\sigma,\nabla n_\sigma;p)\,d\mathbf r",
    ("meta-GGA", "exchange"): r"E_x^{mGGA}[n] = \int f_x(n_\sigma,\nabla n_\sigma,\tau_\sigma;p)\,d\mathbf r",
    ("meta-GGA", "correlation"): r"E_c^{mGGA}[n] = \int f_c(n_\sigma,\nabla n_\sigma,\tau_\sigma;p)\,d\mathbf r",
    ("meta-GGA", "exchange-correlation"): r"E_{xc}^{mGGA}[n] = \int f_{xc}(n_\sigma,\nabla n_\sigma,\tau_\sigma;p)\,d\mathbf r",
    ("hybrid GGA", "exchange-correlation"): r"E_{xc}^{hyb} = a_x E_x^{HF} + \sum_i c_i E_{x,i}^{GGA} + \sum_j d_j E_{c,j}^{GGA} + E_{other}",
    ("hybrid meta-GGA", "exchange-correlation"): r"E_{xc}^{hyb-mGGA} = a_x E_x^{HF} + \sum_i c_i E_{x,i}^{mGGA} + \sum_j d_j E_{c,j}^{mGGA} + E_{other}",
    ("range-separated hybrid GGA", "exchange-correlation"): r"E_{xc}^{RSH} = a_{SR}E_{x,SR}^{HF}(\omega) + a_{LR}E_{x,LR}^{HF}(\omega) + E_{xc}^{semilocal}(\omega) + E_{other}",
    ("range-separated hybrid meta-GGA", "exchange-correlation"): r"E_{xc}^{RSH-mGGA} = a_{SR}E_{x,SR}^{HF}(\omega) + a_{LR}E_{x,LR}^{HF}(\omega) + E_{xc}^{mGGA}(\omega) + E_{other}",
}

CURATED_FORMULAS = {
    "lda-x-dirac": {
        "latex": r"E_x^{LDA}[n] = \int n(\mathbf r)\,\epsilon_x^{unif}(n_\alpha,n_\beta)\,d\mathbf r",
        "plain": "LDA exchange uses the uniform-electron-gas exchange energy density evaluated at the local spin density.",
        "exchange_component": "Dirac/Slater uniform-gas exchange",
        "correlation_component": "not applicable",
        "exact_exchange_fraction": 0.0,
    },
    "lda-c-vwn": {
        "latex": r"E_c^{VWN}[n] = \int n(\mathbf r)\,\epsilon_c^{VWN}(n_\alpha,n_\beta;p)\,d\mathbf r",
        "plain": "VWN is a local spin-density correlation parameterization of the uniform electron gas.",
        "exchange_component": "not applicable",
        "correlation_component": "VWN local correlation",
    },
    "lda-c-pz81": {
        "latex": r"E_c^{PZ81}[n] = \int n(\mathbf r)\,\epsilon_c^{PZ81}(n_\alpha,n_\beta;p)\,d\mathbf r",
        "plain": "PZ81 is a local correlation parameterization based on uniform-electron-gas data.",
        "exchange_component": "not applicable",
        "correlation_component": "PZ81 local correlation",
    },
    "b88": {
        "latex": r"E_x^{B88} = E_x^{LDA} + \int \Delta e_x^{B88}(n_\sigma,\nabla n_\sigma;\beta)\,d\mathbf r",
        "plain": "B88 exchange adds a gradient correction to LDA exchange.",
        "exchange_component": "B88 gradient-corrected exchange",
        "correlation_component": "not applicable",
        "exact_exchange_fraction": 0.0,
    },
    "lyp": {
        "latex": r"E_c^{LYP}[n] = \int f_c^{LYP}(n_\sigma,\nabla n_\sigma;p)\,d\mathbf r",
        "plain": "LYP is a GGA correlation functional derived from the Colle-Salvetti form.",
        "exchange_component": "not applicable",
        "correlation_component": "LYP correlation",
    },
    "blyp": {
        "latex": r"E_{xc}^{BLYP} = E_x^{B88} + E_c^{LYP}",
        "plain": "BLYP combines Becke 1988 exchange with Lee-Yang-Parr correlation.",
        "exchange_component": "B88 exchange",
        "correlation_component": "LYP correlation",
        "exact_exchange_fraction": 0.0,
    },
    "pbe": {
        "latex": r"E_{xc}^{PBE} = E_x^{PBE} + E_c^{PBE}",
        "plain": "PBE combines PBE exchange and PBE correlation in a nonempirical GGA.",
        "exchange_component": "PBE exchange",
        "correlation_component": "PBE correlation",
        "exact_exchange_fraction": 0.0,
    },
    "revpbe": {
        "latex": r"E_x^{revPBE} = \int f_x^{Zhang-Yang\ revised\ PBE}(n_\sigma,\nabla n_\sigma;p)\,d\mathbf r",
        "plain": "Zhang-Yang revised PBE exchange. Project XC keeps this distinct from RPBE.",
        "exchange_component": "Zhang-Yang revised PBE exchange",
        "correlation_component": "not applicable",
        "exact_exchange_fraction": 0.0,
    },
    "rpbe": {
        "latex": r"E_x^{RPBE} = \int f_x^{Hammer-Hansen-Nørskov\ RPBE}(n_\sigma,\nabla n_\sigma;p)\,d\mathbf r",
        "plain": "Hammer-Hansen-Nørskov RPBE exchange. Project XC keeps this distinct from Zhang-Yang revPBE.",
        "exchange_component": "RPBE exchange",
        "correlation_component": "not applicable",
        "exact_exchange_fraction": 0.0,
    },
    "b3lyp": {
        "latex": r"E_{xc}^{B3LYP}=E_x^{LDA}+a_0(E_x^{HF}-E_x^{LDA})+a_x\Delta E_x^{B88}+a_cE_c^{LYP}+(1-a_c)E_c^{VWN}",
        "plain": "B3LYP is a three-parameter hybrid. Common coefficients: a0=0.20 exact exchange, ax=0.72 B88 exchange correction, ac=0.81 LYP correlation; VWN convention is implementation-sensitive.",
        "exact_exchange_fraction": 0.20,
        "exchange_component": "LDA/B88 exchange mixture plus HF exchange",
        "correlation_component": "LYP/VWN mixture",
        "parameters": [
            {"name": "a0", "role": "exact-exchange-fraction", "value": 0.20, "unit": "fraction", "status": "seed-curated-common-value"},
            {"name": "a_x", "role": "B88-gradient-exchange-coefficient", "value": 0.72, "unit": "coefficient", "status": "seed-curated-common-value"},
            {"name": "a_c", "role": "LYP-correlation-coefficient", "value": 0.81, "unit": "coefficient", "status": "seed-curated-common-value"},
        ],
    },
    "b3lyp-vwn3": {
        "latex": r"E_{xc}^{B3LYP3}=E_x^{LDA}+0.20(E_x^{HF}-E_x^{LDA})+0.72\Delta E_x^{B88}+0.81E_c^{LYP}+0.19E_c^{VWN3}",
        "plain": "B3LYP variant using VWN3 convention for the local correlation remainder.",
        "exact_exchange_fraction": 0.20,
        "exchange_component": "LDA/B88 exchange mixture plus HF exchange",
        "correlation_component": "LYP plus VWN3 remainder",
    },
    "b3lyp-vwn5": {
        "latex": r"E_{xc}^{B3LYP5}=E_x^{LDA}+0.20(E_x^{HF}-E_x^{LDA})+0.72\Delta E_x^{B88}+0.81E_c^{LYP}+0.19E_c^{VWN5}",
        "plain": "B3LYP variant using VWN5 convention for the local correlation remainder.",
        "exact_exchange_fraction": 0.20,
        "exchange_component": "LDA/B88 exchange mixture plus HF exchange",
        "correlation_component": "LYP plus VWN5 remainder",
    },
    "pbe0": {
        "latex": r"E_{xc}^{PBE0}=0.25E_x^{HF}+0.75E_x^{PBE}+E_c^{PBE}",
        "plain": "PBE0 mixes 25% Hartree-Fock exchange with 75% PBE exchange and full PBE correlation.",
        "exact_exchange_fraction": 0.25,
        "exchange_component": "25% HF exchange + 75% PBE exchange",
        "correlation_component": "PBE correlation",
    },
    "cam-b3lyp": {
        "latex": r"E_{xc}^{CAM-B3LYP}=a_{SR}E_{x,SR}^{HF}(\omega)+a_{LR}E_{x,LR}^{HF}(\omega)+E_x^{B3LYP,SR/LR}+E_c^{B3LYP}",
        "plain": "CAM-B3LYP is a range-separated B3LYP-family hybrid with short-range and long-range exact-exchange fractions.",
        "short_range_exact_exchange_fraction": 0.19,
        "long_range_exact_exchange_fraction": 0.65,
        "range_separation_omega": 0.33,
        "range_separation_omega_units": "bohr^-1",
        "exchange_component": "range-separated B3LYP exchange plus HF exchange",
        "correlation_component": "B3LYP/LYP-style correlation",
    },
    "lc-wpbe": {
        "latex": r"E_{xc}^{LC-\omega PBE}=E_{x,LR}^{HF}(\omega)+E_{x,SR}^{PBE}(\omega)+E_c^{PBE}",
        "plain": "LC-wPBE is a long-range-corrected PBE-family hybrid. The exact omega and coefficients must be verified for the implementation/version.",
        "range_separated": True,
        "exchange_component": "long-range HF exchange + short-range PBE exchange",
        "correlation_component": "PBE correlation",
    },
    "wb97x-d": {
        "latex": r"E_{xc}^{\omega B97X-D}=E_{xc}^{range-separated\ hybrid}+E_{disp}^{D}",
        "plain": "ωB97X-D is a range-separated hybrid with an empirical dispersion term; parameter values and dispersion scope require source/primary-paper audit.",
        "range_separated": True,
        "exchange_component": "range-separated ωB97X exchange mixture",
        "correlation_component": "ωB97X correlation",
        "other_terms": [{"name": "empirical dispersion", "role": "dispersion", "status": "needs-implementation-scope-verification"}],
    },
    "scan": {
        "latex": r"E_{xc}^{SCAN}=\int f_{xc}^{SCAN}(n_\sigma,\nabla n_\sigma,\tau_\sigma;p)\,d\mathbf r",
        "plain": "SCAN is a nonempirical meta-GGA depending on density, density gradient, and kinetic-energy density.",
        "exact_exchange_fraction": 0.0,
        "exchange_component": "SCAN exchange",
        "correlation_component": "SCAN correlation",
    },
    "r2scan": {
        "latex": r"E_{xc}^{r2SCAN}=\int f_{xc}^{r2SCAN}(n_\sigma,\nabla n_\sigma,\tau_\sigma;p)\,d\mathbf r",
        "plain": "r2SCAN is a regularized-restored SCAN meta-GGA depending on density, gradient, and kinetic-energy density.",
        "exact_exchange_fraction": 0.0,
        "exchange_component": "r2SCAN exchange",
        "correlation_component": "r2SCAN correlation",
    },
    "m06-l": {
        "latex": r"E_{xc}^{M06-L}=\int f_{xc}^{M06-L}(n_\sigma,\nabla n_\sigma,\tau_\sigma;p)\,d\mathbf r",
        "plain": "M06-L is a local Minnesota meta-GGA with empirical parameters; no Hartree-Fock exact exchange.",
        "exact_exchange_fraction": 0.0,
        "exchange_component": "M06-L meta-GGA exchange",
        "correlation_component": "M06-L correlation",
    },
    "m06-2x": {
        "latex": r"E_{xc}^{M06-2X}=0.54E_x^{HF}+E_x^{M06-2X,semilocal}+E_c^{M06-2X}",
        "plain": "M06-2X is a high-exact-exchange Minnesota hybrid meta-GGA with 54% Hartree-Fock exchange in the standard definition.",
        "exact_exchange_fraction": 0.54,
        "exchange_component": "54% HF exchange plus M06-2X semilocal exchange",
        "correlation_component": "M06-2X correlation",
    },
    "wb97m-v": {
        "latex": r"E_{xc}^{\omega B97M-V}=E_{xc}^{range-separated\ hybrid\ meta-GGA}+E_c^{VV10}",
        "plain": "ωB97M-V is a range-separated hybrid meta-GGA with VV10 nonlocal correlation; coefficients and VV10 parameters need source/primary-paper audit.",
        "range_separated": True,
        "exchange_component": "range-separated ωB97M meta-GGA exchange mixture",
        "correlation_component": "ωB97M semilocal correlation + VV10 nonlocal correlation",
        "other_terms": [{"name": "VV10 nonlocal correlation", "role": "nonlocal-correlation", "status": "needs-implementation-scope-verification"}],
    },
}

RSH_TOKENS = ("LC_", "LC-", "LRC", "CAM", "CAMY", "HSE", "HJS", "WHPBE", "WB97", "RSH", "RANGE", "SCREEN", "YUKAWA", "ERF")


def amount(value=None, status="unknown-not-curated", unit="fraction", note="", expression=None):
    return {"value": value, "expression": expression, "unit": unit, "status": status, "note": note}


def channel_presence(kind):
    return {
        "exchange": {"present": kind in ("exchange", "exchange-correlation"), "presence_status": "machine-derived"},
        "correlation": {"present": kind in ("correlation", "exchange-correlation"), "presence_status": "machine-derived"},
        "kinetic": {"present": kind == "kinetic", "presence_status": "machine-derived"},
    }


def base_rung(rung):
    if rung in ("range-separated hybrid GGA", "hybrid GGA"):
        return "hybrid GGA"
    if rung in ("range-separated hybrid meta-GGA", "hybrid meta-GGA"):
        return "hybrid meta-GGA"
    return rung


def normalize_rung_for_template(rung):
    return (rung or "unknown").lower().replace(" ", "-")


def generic_latex(rung, kind):
    if kind == "kinetic":
        return r"T_s^{approx}[n] = \int f_t(relevant\ variables;p)\,d\mathbf r"
    return GENERIC_LATEX.get((rung, kind)) or GENERIC_LATEX.get((base_rung(rung), kind)) or r"E[n] = \int f(relevant\ variables;p)\,d\mathbf r"


def infer_range_separated(code, description, rung, params=None):
    params = params or {}
    if params.get("range_separated") or rung.startswith("range-separated"):
        return True, "curated-or-rung"
    blob = f"{code} {description}".upper()
    return any(tok in blob for tok in RSH_TOKENS), "heuristic-detected"


def infer_other_terms(code, description, params=None):
    params = params or {}
    terms = []
    for item in params.get("external_terms", []) or []:
        terms.append({
            "name": item.get("name", "external term"),
            "role": item.get("role") or ("nonlocal-correlation" if "VV10" in item.get("name", "").upper() else "dispersion" if "disp" in item.get("name", "").lower() else "other"),
            "status": item.get("status", "curated-partial"),
            "note": item.get("note", "")
        })
    blob = f"{code} {description}".upper()
    if "VV10" in blob and not any(t["role"] == "nonlocal-correlation" for t in terms):
        terms.append({"name": "VV10 nonlocal correlation", "role": "nonlocal-correlation", "status": "heuristic-detected", "note": "Detected from name/description; implementation scope needs audit."})
    if ("DISP" in blob or re.search(r"(^|_)D3?($|_)", blob)) and not any(t["role"] == "dispersion" for t in terms):
        terms.append({"name": "empirical dispersion", "role": "dispersion", "status": "heuristic-detected", "note": "Detected from name/description; may be outside XC kernel."})
    return terms


def default_exact_exchange(kind, rung, is_rsh, code):
    if kind in ("correlation", "kinetic"):
        return amount(None, "not-applicable", note="No exchange channel in this record.")
    if rung.startswith("hybrid") or rung.startswith("range-separated") or code.startswith("HYB_") or is_rsh:
        return amount(None, "unknown-not-curated", note="Hybrid/range-separated record; exact-exchange coefficient must be audited unless curated below.")
    return amount(0.0, "machine-derived", note="Non-hybrid exchange channel; no Hartree-Fock exact exchange term.")


def make_term(code, role, label, coefficient=None):
    return {
        "term_id": f"libxc:{code}" if code else label.lower().replace(" ", "_"),
        "role": role,
        "label": label,
        "expression_latex": label,
        "component_codes": [code] if code else [],
        "coefficient": coefficient or {"value": 1.0, "unit": "coefficient", "status": "derived-identity", "note": "Single imported component term."},
    }


def formula_for_imported(entry):
    code = entry.get("libxc_code", "")
    description = entry.get("description", "")
    kind = entry.get("kind", "exchange-correlation")
    rung = entry.get("rung", "unclassified")
    is_rsh, rsh_status = infer_range_separated(code, description, rung)
    display_rung = rung
    if is_rsh and rung == "hybrid GGA":
        display_rung = "range-separated hybrid GGA"
    elif is_rsh and rung == "hybrid meta-GGA":
        display_rung = "range-separated hybrid meta-GGA"
    terms = [make_term(code, kind if kind != "exchange-correlation" else "exchange-correlation", code)]
    other_terms = infer_other_terms(code, description)
    omega = amount(None, "not-applicable", unit="bohr^-1")
    sr = amount(None, "not-applicable")
    lr = amount(None, "not-applicable")
    if is_rsh:
        omega = amount(None, "unknown-not-curated", unit="bohr^-1", note=f"Range separation detected ({rsh_status}); omega is not available in the imported HTML snapshot.")
        sr = amount(None, "unknown-not-curated", note="Short-range exact-exchange fraction needs source/primary-paper audit.")
        lr = amount(None, "unknown-not-curated", note="Long-range exact-exchange fraction needs source/primary-paper audit.")
    return {
        "schema_version": SCHEMA_VERSION,
        "status": "generic-derived",
        "template_id": f"generic.{normalize_rung_for_template(display_rung)}.{kind}",
        "kind": kind,
        "rung": display_rung,
        "plain": f"Generic {display_rung} {kind} scaffold derived from Libxc classification. Full implemented formula and empirical constants are not curated in this imported record.",
        "latex": generic_latex(display_rung, kind),
        "variables": copy.deepcopy(RUNG_VARIABLES.get(display_rung) or RUNG_VARIABLES.get(base_rung(display_rung), [])),
        "terms": terms,
        "amounts": {
            "channels": channel_presence(kind),
            "exact_exchange": default_exact_exchange(kind, display_rung, is_rsh, code),
            "short_range_exact_exchange": sr,
            "long_range_exact_exchange": lr,
            "range_separation_omega": omega,
            "other_terms": other_terms,
        },
        "parameters": {
            "status": "unknown-not-curated",
            "values": [],
            "unknown_required": [{"name": "functional-specific formula constants", "status": "needs-primary-source-or-libxc-source-audit"}],
        },
        "provenance": [{"type": "source", "label": "Libxc public functionals page", "url": entry.get("source_url", "https://libxc.gitlab.io/functionals/")}],
        "caveats": ["This formula block is a generic scaffold, not a full audited mathematical implementation."],
    }


def formula_for_seed(entry):
    params = entry.get("parameters", {}) or {}
    slug = entry.get("slug")
    codes = [c.get("code") for c in entry.get("libxc", {}).get("components", []) if c.get("code")]
    primary = entry.get("libxc", {}).get("primary_code") or (codes[0] if codes else "")
    desc = entry.get("summary", "")
    kind = entry.get("kind", "exchange-correlation")
    rung = entry.get("rung", "unclassified")
    is_rsh, rsh_status = infer_range_separated(primary, desc, rung, params)
    display_rung = rung
    if is_rsh and rung == "hybrid GGA":
        display_rung = "range-separated hybrid GGA"
    elif is_rsh and rung == "hybrid meta-GGA":
        display_rung = "range-separated hybrid meta-GGA"
    curated = CURATED_FORMULAS.get(slug, {})
    exact_value = curated.get("exact_exchange_fraction", params.get("exact_exchange_fraction"))
    exact = default_exact_exchange(kind, display_rung, is_rsh, primary)
    if exact_value is not None:
        exact = amount(float(exact_value), "curated-partial", note="Project XC seed-curated exact-exchange fraction; verify primary source before marking final.")
    sr_value = curated.get("short_range_exact_exchange_fraction", params.get("short_range_exact_exchange_fraction"))
    lr_value = curated.get("long_range_exact_exchange_fraction", params.get("long_range_exact_exchange_fraction"))
    omega_value = curated.get("range_separation_omega")
    omega_units = curated.get("range_separation_omega_units", "bohr^-1")
    if omega_value is None and isinstance(params.get("range_separation"), dict):
        omega_value = params["range_separation"].get("omega")
        omega_units = params["range_separation"].get("omega_units", omega_units)
    sr = amount(None, "not-applicable")
    lr = amount(None, "not-applicable")
    omega = amount(None, "not-applicable", unit="bohr^-1")
    if is_rsh:
        sr = amount(float(sr_value), "curated-partial", note="Short-range exact-exchange fraction in seed record; audit primary source.") if sr_value is not None else amount(None, "unknown-not-curated", note="Short-range exact-exchange fraction needs audit.")
        lr = amount(float(lr_value), "curated-partial", note="Long-range exact-exchange fraction in seed record; audit primary source.") if lr_value is not None else amount(None, "unknown-not-curated", note="Long-range exact-exchange fraction needs audit.")
        omega = amount(float(omega_value), "curated-partial", unit=omega_units, note="Range-separation parameter in seed record; audit primary source.") if omega_value is not None else amount(None, "unknown-not-curated", unit="bohr^-1", note="Range-separation omega needs audit.")
    terms = []
    if exact_value is not None:
        terms.append({"term_id": "exact_exchange", "role": "exchange", "subrole": "exact-exchange", "label": "Hartree-Fock exact exchange", "expression_latex": "E_x^{HF}", "component_codes": [], "coefficient": exact})
    for code in codes:
        role = "exchange-correlation"
        if "_X_" in code or code.endswith("_X") or re.search(r"(^|_)X($|_)", code):
            role = "exchange"
        elif "_C_" in code or code.endswith("_C") or re.search(r"(^|_)C($|_)", code):
            role = "correlation"
        terms.append(make_term(code, role, code))
    other_terms = infer_other_terms(primary, desc, params)
    parameter_values = list(curated.get("parameters", []))
    for key, role, value in [
        ("exact_exchange_fraction", "exact-exchange-fraction", exact_value),
        ("short_range_exact_exchange_fraction", "short-range-exact-exchange-fraction", sr_value),
        ("long_range_exact_exchange_fraction", "long-range-exact-exchange-fraction", lr_value),
    ]:
        if value is not None and not any(p.get("role") == role for p in parameter_values):
            parameter_values.append({"name": key, "role": role, "value": float(value), "unit": "fraction", "status": "curated-partial"})
    if omega_value is not None:
        parameter_values.append({"name": "omega", "role": "range-separation-omega", "value": float(omega_value), "unit": omega_units, "status": "curated-partial"})
    status = "curated-partial" if curated or parameter_values else "generic-derived"
    unknown_required = []
    if display_rung.startswith("hybrid") and exact_value is None:
        unknown_required.append({"name": "exact_exchange_fraction", "status": "needs-primary-source-or-libxc-source-audit"})
    if is_rsh and omega_value is None:
        unknown_required.append({"name": "range_separation_omega", "status": "needs-primary-source-or-libxc-source-audit"})
    if not curated:
        unknown_required.append({"name": "full functional formula constants", "status": "needs-primary-source-audit"})
    return {
        "schema_version": SCHEMA_VERSION,
        "status": status,
        "template_id": f"generic.{normalize_rung_for_template(display_rung)}.{kind}",
        "kind": kind,
        "rung": display_rung,
        "plain": curated.get("plain") or f"Curated seed record with generic {display_rung} scaffold; full formula constants may still need audit.",
        "latex": curated.get("latex") or generic_latex(display_rung, kind),
        "variables": copy.deepcopy(RUNG_VARIABLES.get(display_rung) or RUNG_VARIABLES.get(base_rung(display_rung), [])),
        "terms": terms,
        "components": {
            "exchange": curated.get("exchange_component", "not curated"),
            "correlation": curated.get("correlation_component", "not curated"),
            "other": [t.get("name") for t in other_terms] or [],
        },
        "amounts": {
            "channels": channel_presence(kind),
            "exact_exchange": exact,
            "short_range_exact_exchange": sr,
            "long_range_exact_exchange": lr,
            "range_separation_omega": omega,
            "other_terms": curated.get("other_terms", []) + [t for t in other_terms if t not in curated.get("other_terms", [])],
        },
        "parameters": {
            "status": "curated-partial" if parameter_values else "unknown-not-curated",
            "values": parameter_values,
            "unknown_required": unknown_required,
        },
        "provenance": [{"type": "project-xc-seed", "label": "Project XC seed curation"}],
        "caveats": ["Formula/amount fields are displayed with status labels; do not treat partial seed curation as final benchmark-grade verification."] + entry.get("notes", []),
    }


def enrich_files(snapshot_path: Path, seed_path: Path) -> tuple[int, int]:
    snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))
    seed = json.loads(seed_path.read_text(encoding="utf-8"))
    for entry in snapshot:
        entry["formula"] = formula_for_imported(entry)
    for entry in seed:
        entry["formula"] = formula_for_seed(entry)
    snapshot_path.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    seed_path.write_text(json.dumps(seed, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return len(snapshot), len(seed)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--snapshot", default="data/libxc_snapshot.json")
    parser.add_argument("--seed", default="data/functionals.seed.json")
    args = parser.parse_args()
    n_snapshot, n_seed = enrich_files(ROOT / args.snapshot, ROOT / args.seed)
    print(f"enriched formulas: {n_snapshot} imported Libxc records, {n_seed} curated seed records")


if __name__ == "__main__":
    main()
