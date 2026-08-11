"""
============================================================================
 analysis.py — URL anatomy + Threat DNA (signature explainability features)
============================================================================
 PhishGuard AI
----------------------------------------------------------------------------
 Two frontend-facing analyses are derived here from REAL extracted features
 and the model's OWN class statistics / importances:

 1. ``url_anatomy(url)``
    A transparent breakdown of a URL into protocol / subdomain / domain /
    path / query / fragment, each with a data-driven "why it matters" note.
    Purely structural — parsed from the string, never visited.

 2. ``threat_dna(features, meta)``
    Seven 0-100 category scores (URL Complexity, Domain Risk, Subdomain Risk,
    Keyword Suspicion, Security Indicators, Special Character Patterns,
    Structural Anomalies). Every score is an aggregation of the deviation of
    this URL from the typical *legitimate* sample toward the typical
    *phishing* sample, weighted by the model's feature importances.

    IMPORTANT (honesty): these are NOT official threat-intelligence scores.
    They are readable summaries of the same statistics the model itself was
    trained on — labelled as such in the UI.
============================================================================
"""

from __future__ import annotations

import math
from urllib.parse import urlparse

from ml.feature_extractor import (
    _domain_of,
    _hostname_of,
    _is_ipv4,
    _tld_of,
    normalize_url,
)

#: Which features feed each Threat DNA category (used to aggregate scores).
THREAT_DNA_FEATURES: dict[str, list[str]] = {
    "URL Complexity": [
        "url_length", "path_length", "query_length", "num_params", "digit_ratio",
    ],
    "Domain Risk": [
        "domain_length", "tld_length", "tld_is_suspicious", "has_hex_string",
    ],
    "Subdomain Risk": ["num_subdomains", "num_dots"],
    "Keyword Suspicion": [
        "has_suspicious_keywords", "suspicious_keywords_count",
    ],
    "Security Indicators": ["has_https", "has_ip_address", "is_shortened"],
    "Special Character Patterns": [
        "special_char_ratio", "num_special_chars", "num_at", "num_equals",
        "num_percent",
    ],
    "Structural Anomalies": [
        "num_at", "num_question_marks", "num_equals", "num_hash", "query_length",
    ],
}

#: What the presence of each anatomy component means (educational, static).
ANATOMY_NOTES: dict[str, str] = {
    "protocol": "The transport scheme. HTTPS indicates an encrypted connection, "
                "while HTTP transmits data in plain text.",
    "subdomain": "Extra host labels placed before the domain. Attackers stack "
                 "subdomains so the final 'domain' the eye lands on is misleading.",
    "domain": "The registrable domain name that the site owner actually bought.",
    "port": "A non-standard port can indicate a self-hosted or staged lookalike.",
    "path": "The resource location. Long, random or keyword-stuffed paths are "
            "common in phishing links.",
    "query": "URL parameters. Dense query strings can carry tracking or staged "
             "campaign tokens.",
    "fragment": "The part after '#'. Often ignored by users but can be abused "
                "to hide a payload.",
}


# ---------------------------------------------------------------------------
# URL anatomy
# ---------------------------------------------------------------------------
def url_anatomy(raw_url: str) -> dict:
    """
    Split a raw URL into its displayable components.

    Returns a dict with ``host``/``tld``/``protocol`` plus ``components`` — a
    list of {name, value, suspicious, note} items in visual reading order.
    The ``suspicious`` flag comes from the same rules the security cards use.
    """
    url = normalize_url(raw_url)
    parsed = urlparse(url)
    scheme = (parsed.scheme or "").lower()
    hostname = _hostname_of(parsed)
    tld = _tld_of(hostname)
    domain = _domain_of(hostname)

    components: list[dict] = []

    # Protocol ---------------------------------------------------------------
    protocol_value = f"{scheme}://" if scheme else "no-scheme"
    components.append({
        "name": "protocol",
        "value": protocol_value,
        "suspicious": bool(scheme) and scheme != "https",
        "note": ANATOMY_NOTES["protocol"],
    })

    # Host labels (subdomain / domain) ---------------------------------------
    if hostname:
        labels = hostname.split(".")
        if _is_ipv4(hostname):
            domain_value = hostname
            sub_value = ""
        else:
            domain_value = ".".join(labels[-2:]) if len(labels) >= 2 else hostname
            sub_value = ".".join(labels[:-2]) if len(labels) > 2 else ""
            if sub_value and sub_value.startswith("www."):
                sub_value = sub_value[4:]

        if sub_value:
            components.append({
                "name": "subdomain",
                "value": sub_value,
                "suspicious": sub_value.count(".") >= 2
                or any(k in sub_value.lower() for k in
                       ("login", "verify", "secure", "account", "update", "confirm", "sign")),
                "note": ANATOMY_NOTES["subdomain"],
            })
        components.append({
            "name": "domain",
            "value": domain_value,
            "suspicious": tld in _suspicious_tlds()
            or bool(_ipv4_host(hostname)),
            "note": ANATOMY_NOTES["domain"],
        })

    # Port -------------------------------------------------------------------
    try:
        port = parsed.port
    except ValueError:
        port = None
    if port:
        components.append({
            "name": "port",
            "value": str(port),
            "suspicious": port not in (80, 443, 8080),
            "note": ANATOMY_NOTES["port"],
        })

    # Path -------------------------------------------------------------------
    if parsed.path and parsed.path != "/":
        components.append({
            "name": "path",
            "value": parsed.path[:200],
            "suspicious": len(parsed.path) > 40
            or any(k in parsed.path.lower() for k in
                   ("login", "verify", "secure", "confirm", "signin", "update", "recover", "password")),
            "note": ANATOMY_NOTES["path"],
        })

    # Query ------------------------------------------------------------------
    if parsed.query:
        components.append({
            "name": "query",
            "value": parsed.query[:200],
            "suspicious": parsed.query.count("&") >= 3
            or len(parsed.query) > 60,
            "note": ANATOMY_NOTES["query"],
        })

    # Fragment ---------------------------------------------------------------
    if parsed.fragment:
        components.append({
            "name": "fragment",
            "value": parsed.fragment[:200],
            "suspicious": False,
            "note": ANATOMY_NOTES["fragment"],
        })

    return {
        "host": hostname,
        "tld": tld,
        "protocol": scheme,
        "components": components,
    }


def _suspicious_tlds() -> set[str]:
    from ml.feature_extractor import SUSPICIOUS_TLDS
    return set(SUSPICIOUS_TLDS)


def _ipv4_host(hostname: str) -> bool:
    return _is_ipv4(hostname)


# ---------------------------------------------------------------------------
# Threat DNA
# ---------------------------------------------------------------------------
def threat_dna(features: dict, meta: dict) -> dict:
    """
    Compute the seven 0-100 Threat DNA category scores.

    For every feature inside a category we measure how far the current URL
    deviates from the typical *legitimate* sample (in standard deviations) in
    the direction of the typical *phishing* sample, then weight that deviation
    by the model's feature importance. The weighted average is mapped onto
    0-100 (0 = indistinguishable from a typical legitimate URL in this
    category, 100 = extreme phishing-like profile).

    Returns ``{"categories": {name: score_0_100}, "max": 100}``.
    """
    try:
        stats = meta["class_stats"]
        imp = {i["name"]: i["importance"] for i in meta["feature_importance"]}
        legit_m = stats["legit_means"]
        phish_m = stats["phish_means"]
        stds = stats["stds"]
    except (KeyError, TypeError):
        # No metadata -> fall back to neutral scores (never fabricated).
        return {
            "categories": {name: 50.0 for name in THREAT_DNA_FEATURES},
            "max": 100,
        }

    categories: dict[str, float] = {}
    for name, cols in THREAT_DNA_FEATURES.items():
        weighted = 0.0
        total_w = 0.0
        for col in cols:
            if col not in features:
                continue
            w = imp.get(col, 0.0)
            total_w += w
            x = features[col]
            lm = legit_m.get(col, 0.0)
            pm = phish_m.get(col, 0.0)
            sd = stds.get(col, 1.0) or 1.0
            if sd == 0:
                sd = 1.0
            # Deviation from the legitimate average, in std units.
            d = (x - lm) / sd
            # Positive when the deviation points toward the phishing average.
            lean = 1.0 if (pm - lm) > 0 else (-1.0 if (pm - lm) < 0 else 0.0)
            contribution = math.tanh(d * lean) if lean else 0.0
            weighted += w * contribution
        if total_w > 0:
            raw = weighted / total_w
        else:
            raw = 0.0
        categories[name] = round((raw + 1.0) / 2.0 * 100.0, 1)

    return {"categories": categories, "max": 100}
