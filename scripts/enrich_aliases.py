#!/usr/bin/env python3
"""Enrich Project XC search aliases for Libxc/imported XC records.

This is a discoverability layer, not a scientific formula curation layer.  It
adds common QC spellings, delimiter variants, omega/w variants, and a few
component-composite search aliases so users can find records by names like
BHHLYP, HSE-06, omegaB97X-D, TPSSh, BP86, and SVWN.
"""
from __future__ import annotations
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PREFIX_RE = re.compile(r"^(?:HYB_)?(?:LDA|GGA|MGGA)_(?:XC|X|C|K)_")
STOP = {
    "the", "and", "for", "with", "from", "exchange", "correlation", "functional",
    "modified", "revised", "regularized", "hybrid", "screened", "range", "long",
    "short", "version", "mixture", "local", "kinetic", "minnesota", "becke",
}

MANUAL_BY_CODE = {
    "HYB_GGA_XC_BHANDHLYP": ["BHHLYP", "BH&HLYP", "BHandHLYP", "BHandH-LYP", "BHH-LYP", "Becke half-and-half LYP", "half-and-half LYP"],
    "HYB_GGA_XC_BHANDH": ["BHLYP", "BHH", "BH&H", "BHandH", "Becke half-and-half", "half-and-half Becke"],
    "HYB_GGA_XC_PBEH": ["PBE0", "PBEh", "PBEH", "PBE1PBE"],
    "HYB_GGA_XC_HSE03": ["HSE", "HSE03", "HSE-03", "HSE 03", "HSE2003"],
    "HYB_GGA_XC_HSE06": ["HSE", "HSE06", "HSE-06", "HSE 06", "HSE2006", "HSEH1PBE", "HSE-H1PBE"],
    "HYB_GGA_XC_HSE12": ["HSE12", "HSE-12", "HSE 12"],
    "HYB_GGA_XC_HSE12S": ["HSE12s", "HSE12-S", "HSE12 short range", "short-range HSE12"],
    "HYB_GGA_XC_HSE_SOL": ["HSEsol", "HSE-sol", "HSE_SOL"],
    "HYB_MGGA_XC_TPSSH": ["TPSSh", "TPSSH", "TPSS-h", "TPSS hybrid"],
    "HYB_MGGA_XC_TPSS0": ["TPSS0", "TPSS-0"],
    "HYB_MGGA_XC_REVTPSSH": ["revTPSSh", "revTPSSH", "revTPSS-h"],
    "HYB_MGGA_XC_R2SCAN0": ["r2SCAN0", "R2SCAN0", "r2SCAN-0"],
    "HYB_MGGA_XC_R2SCANH": ["r2SCANh", "R2SCANH", "r2SCAN-h"],
    "HYB_MGGA_XC_R2SCAN50": ["r2SCAN50", "R2SCAN50", "r2SCAN-50"],
    "HYB_GGA_XC_CAM_B3LYP": ["CAM-B3LYP", "CAMB3LYP", "CAM_B3LYP"],
    "HYB_GGA_XC_CAM_O3LYP": ["CAM-O3LYP", "CAMO3LYP", "CAM_O3LYP"],
    "HYB_GGA_XC_CAM_PBEH": ["CAM-PBEh", "CAMPBEH", "CAM-PBE0"],
    "HYB_GGA_XC_CAM_QTP_00": ["CAM-QTP-00", "CAMQTP00"],
    "HYB_GGA_XC_CAM_QTP_01": ["CAM-QTP-01", "CAMQTP01"],
    "HYB_GGA_XC_CAM_QTP_02": ["CAM-QTP-02", "CAMQTP02"],
    "HYB_GGA_XC_LC_BLYP": ["LC-BLYP", "LCBLYP"],
    "HYB_GGA_XC_LC_WPBE": ["LC-wPBE", "LC-ωPBE", "LCWPBE", "LComegaPBE", "LC-omegaPBE"],
    "HYB_GGA_XC_LRC_WPBE": ["LRC-wPBE", "LRC-ωPBE", "LRCWPBE", "LRComegaPBE", "LRC-omegaPBE"],
    "HYB_GGA_XC_LRC_WPBEH": ["LRC-wPBEh", "LRC-ωPBEh", "LRCWPBEH", "LRComegaPBEh", "LRC-omegaPBEh"],
    "HYB_GGA_XC_WB97": ["wB97", "ωB97", "omegaB97"],
    "HYB_GGA_XC_WB97X": ["wB97X", "ωB97X", "omegaB97X"],
    "HYB_GGA_XC_WB97X_D": ["wB97X-D", "ωB97X-D", "WB97X-D", "wB97XD", "ωB97XD", "omegaB97X-D", "omega-B97X-D"],
    "HYB_GGA_XC_WB97X_D3": ["wB97X-D3", "ωB97X-D3", "WB97X-D3", "wB97XD3", "omegaB97X-D3"],
    "HYB_GGA_XC_WB97X_V": ["wB97X-V", "ωB97X-V", "WB97X-V", "wB97XV", "omegaB97X-V"],
    "HYB_MGGA_XC_WB97M_V": ["wB97M-V", "ωB97M-V", "WB97M-V", "wB97MV", "omegaB97M-V"],
    "MGGA_XC_B97M_V": ["B97M-V", "B97M_V", "B97MV"],
    "GGA_XC_B97_D": ["B97-D", "B97D"],
    "GGA_XC_B97_3C": ["B97-3c", "B973c", "B97_3c"],
    "HYB_GGA_XC_B97_1": ["B97-1", "B971"],
    "HYB_GGA_XC_B97_2": ["B97-2", "B972"],
    "HYB_GGA_XC_B97_3": ["B97-3", "B973"],
    "HYB_GGA_XC_B3PW91": ["B3PW91", "B3-PW91"],
    "HYB_GGA_XC_B3P86": ["B3P86", "B3-P86"],
    "HYB_GGA_XC_B1LYP": ["B1LYP", "B1-LYP"],
    "HYB_GGA_XC_B1PW91": ["B1PW91", "B1-PW91"],
    "HYB_GGA_XC_B5050LYP": ["B5050LYP", "B50LYP", "B50-50LYP"],
    "HYB_GGA_XC_O3LYP": ["O3LYP"],
    "HYB_GGA_XC_X3LYP": ["X3LYP"],
    "HYB_GGA_XC_MPW1K": ["mPW1K", "MPW1K"],
    "HYB_GGA_XC_MPW1LYP": ["mPW1LYP", "MPW1LYP"],
    "HYB_GGA_XC_MPW1PBE": ["mPW1PBE", "MPW1PBE"],
    "HYB_GGA_XC_MPW1PW": ["mPW1PW", "mPW1PW91", "MPW1PW91"],
    "HYB_GGA_XC_MPW3LYP": ["mPW3LYP", "MPW3LYP"],
    "HYB_GGA_XC_MPW3PW": ["mPW3PW", "mPW3PW91", "MPW3PW91"],
    "GGA_X_PBE_SOL": ["PBEsol", "PBE-sol", "PBE_SOL"],
    "GGA_C_PBE_SOL": ["PBEsol", "PBE-sol", "PBE_SOL"],
    "GGA_X_B88": ["BP86", "B-P86", "B88P86", "B88-P86", "BPW91", "B-PW91", "B88PW91", "B88-PW91", "BLYP", "B-LYP", "B88LYP", "B88-LYP"],
    "GGA_C_P86": ["BP86", "B-P86", "B88P86", "B88-P86"],
    "GGA_C_PW91": ["BPW91", "B-PW91", "B88PW91", "B88-PW91", "PW91", "PW91PW91", "PW91-PW91"],
    "GGA_X_PW91": ["PW91", "PW91PW91", "PW91-PW91"],
    "GGA_X_OPTX": ["OLYP", "OPTX-LYP", "OPBE", "OPTX-PBE"],
    "GGA_C_LYP": ["OLYP", "OPTX-LYP", "BLYP", "B88-LYP"],
    "GGA_C_PBE": ["OPBE", "OPTX-PBE"],
    "LDA_X": ["LDA", "LSDA", "LSD", "SVWN", "SVWN3", "SVWN5", "Slater-VWN", "Slater VWN", "Xalpha", "X-alpha", "Xα", "Xa"],
    "LDA_C_VWN": ["SVWN", "SVWN5", "S-VWN", "Slater-VWN", "Slater VWN"],
    "LDA_C_VWN_3": ["SVWN3", "VWN3"],
    "MGGA_X_TPSS": ["TPSS"],
    "MGGA_C_TPSS": ["TPSS"],
    "MGGA_X_REVTPSS": ["revTPSS", "rev-TPSS"],
    "MGGA_C_REVTPSS": ["revTPSS", "rev-TPSS"],
    "MGGA_X_SCAN": ["SCAN", "SCAN-rVV10", "SCAN+RVV10", "SCAN-VV10"],
    "MGGA_C_SCAN": ["SCAN"],
    "MGGA_C_SCAN_RVV10": ["SCAN-rVV10", "SCAN+RVV10"],
    "MGGA_C_SCAN_VV10": ["SCAN-VV10"],
}

MANUAL_BY_SLUG = {
    "pbe0": ["PBEH", "PBE1PBE"],
    "cam-b3lyp": ["CAMB3LYP", "CAM_B3LYP"],
    "lc-wpbe": ["LC-ωPBE", "LComegaPBE", "LC-omegaPBE", "LCWPBE"],
    "wb97x-d": ["ωB97X-D", "wB97XD", "ωB97XD", "omegaB97X-D", "omega-B97X-D"],
    "wb97m-v": ["ωB97M-V", "wB97MV", "omegaB97M-V"],
    "revpbe": ["PBE_R", "PBE-R", "Zhang-Yang revised PBE"],
    "rpbe": ["Hammer-Hansen-Nørskov exchange", "Hammer-Hansen-Norskov exchange"],
}


def norm(value: str) -> str:
    s = unicodedata.normalize("NFKD", str(value)).lower()
    s = s.replace("ω", "w").replace("Ω", "w")
    s = re.sub(r"omega", "w", s)
    return re.sub(r"[^a-z0-9]", "", s)


def add_alias(aliases: list[str], seen: set[str], value: str) -> None:
    value = str(value or "").strip()
    if not value:
        return
    key = norm(value)
    if not key or key in seen:
        return
    aliases.append(value)
    seen.add(key)


def stem_from_code(code: str) -> str:
    return PREFIX_RE.sub("", code)


def casing_variants(alias: str) -> list[str]:
    out = []
    if alias.startswith("WB"):
        out.extend(["w" + alias[1:], "ω" + alias[1:], "omega" + alias[1:]])
    if alias.startswith("LC_W") or alias.startswith("LC-W"):
        tail = alias[3:]
        out.extend(["LC-w" + tail[1:], "LC-ω" + tail[1:], "LC-omega" + tail[1:]])
    if alias.startswith("LRC_W") or alias.startswith("LRC-W"):
        tail = alias[4:]
        out.extend(["LRC-w" + tail[1:], "LRC-ω" + tail[1:], "LRC-omega" + tail[1:]])
    return out


def description_tokens(description: str) -> list[str]:
    tokens: list[str] = []
    if not description:
        return tokens
    chunks = [description.split()[0].strip(",:;()[]")] if description.split() else []
    chunks += re.findall(r"\(([^()]{2,40})\)", description)
    chunks += [description.split(":", 1)[0]] if ":" in description else []
    for chunk in chunks:
        for part in re.split(r"[,;/]|\bi\.e\.\b", chunk):
            part = part.strip(" .,:;()[]")
            if not (2 <= len(part) <= 40):
                continue
            low = part.lower()
            if low in STOP:
                continue
            if any(c.isdigit() for c in part) or re.search(r"[A-Z]{2}", part) or "ω" in part or "Ω" in part:
                tokens.append(part)
    return tokens


def generated_aliases(entry: dict) -> list[str]:
    code = entry["libxc_code"]
    stem = stem_from_code(code)
    aliases: list[str] = []
    seen: set[str] = set()
    # Prefer human/common names for display, then keep raw Libxc identifiers.
    for value in MANUAL_BY_CODE.get(code, []):
        add_alias(aliases, seen, value)
    for value in description_tokens(entry.get("description", "")):
        add_alias(aliases, seen, value)
    for value in [code, f"libxc:{entry.get('libxc_id')}", f"libxc id {entry.get('libxc_id')}", stem, stem.replace("_", "-"), stem.replace("_", " "), stem.replace("_", "")]:
        add_alias(aliases, seen, value)
    if stem.startswith("M") and re.match(r"M\d+_", stem):
        add_alias(aliases, seen, stem.replace("_", "-"))
        add_alias(aliases, seen, stem.replace("_", ""))
    if stem.startswith("MN") or stem.startswith("N"):
        add_alias(aliases, seen, stem.replace("_", "-"))
        add_alias(aliases, seen, stem.replace("_", ""))
    if stem.startswith("HSE"):
        add_alias(aliases, seen, stem.replace("_", "-"))
        m = re.match(r"(HSE)(\d+)(S?)$", stem)
        if m:
            add_alias(aliases, seen, f"{m.group(1)}-{m.group(2)}{m.group(3).lower()}")
            add_alias(aliases, seen, f"{m.group(1)} {m.group(2)}{m.group(3).lower()}")
    for value in casing_variants(stem) + casing_variants(stem.replace("_", "-")):
        add_alias(aliases, seen, value)
    return aliases


def main() -> None:
    snapshot_path = ROOT / "data/libxc_snapshot.json"
    seed_path = ROOT / "data/functionals.seed.json"
    snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))
    seed = json.loads(seed_path.read_text(encoding="utf-8"))

    total_aliases = 0
    for entry in snapshot:
        aliases: list[str] = []
        seen: set[str] = set()
        # Rebuild imported-record aliases deterministically so preferred human names
        # appear before raw Libxc identifiers.
        for value in generated_aliases(entry):
            add_alias(aliases, seen, value)
        entry["aliases"] = aliases
        total_aliases += len(aliases)

    for entry in seed:
        aliases = []
        search_aliases = []
        seen: set[str] = set()
        search_seen: set[str] = set()
        # Keep curated-card aliases human-facing and stable. Broad component and
        # Libxc-code aliases live in search_aliases so default curated cards stay clean.
        for value in entry.get("aliases", []):
            if str(value).startswith(("HYB_", "LDA_", "GGA_", "MGGA_", "libxc")):
                continue
            add_alias(aliases, seen, value)
        primary = (entry.get("libxc") or {}).get("primary_code")
        if primary:
            fake = {"libxc_code": primary, "libxc_id": "", "description": entry.get("canonical_name", "")}
            for value in generated_aliases(fake):
                if not str(value).startswith("libxc"):
                    add_alias(search_aliases, search_seen, value)
        for value in MANUAL_BY_SLUG.get(entry.get("slug"), []):
            add_alias(aliases, seen, value)
            add_alias(search_aliases, search_seen, value)
        entry["aliases"] = aliases
        entry["search_aliases"] = search_aliases

    snapshot_path.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    seed_path.write_text(json.dumps(seed, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"enriched aliases for {len(snapshot)} Libxc records; total snapshot aliases={total_aliases}; curated records={len(seed)}")


if __name__ == "__main__":
    main()
