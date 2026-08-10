"""
============================================================================
 feature_extractor.py — URL feature extraction
============================================================================
 PhishGuard AI: Intelligent Phishing Website Detection

 This module is the SINGLE source of truth for URL feature engineering.

 IMPORTANT DESIGN RULE
 ---------------------
 The exact same function ``extract_features`` is used:
   1. during TRAINING  (to build the feature matrix from the dataset), and
   2. during PREDICTION (to convert a user-supplied URL into a feature row).

 Because both stages call the same code, the set of features seen by the
 trained model is guaranteed to match the features supplied at prediction
 time.  This is one of the key sources of bugs in ML projects (train/serve
 skew) and we deliberately avoid it here.

 How it works
 ------------
 The module only ever looks at the *string* of the URL.  It never visits
 the website, never opens a connection, never executes code and never
 downloads anything.  URLs are treated purely as untrusted *text*.  This
 is an important security property of the project: the model is trained to
 recognise patterns that are statistically common among phishing URLs.

 All values are plain integers / floats so they can be handed directly to
 scikit-learn classifiers.
============================================================================
"""

import re
from urllib.parse import urlparse

# ---------------------------------------------------------------------------
# Configuration tables (public so they can be inspected/shown on the UI)
# ---------------------------------------------------------------------------

#: Words that appear disproportionately often inside phishing URLs.  Attackers
#: craft links that LOOK like a trusted service (e.g. "login", "verify",
#: "secure", "update") to groom the victim.
SUSPICIOUS_KEYWORDS = [
    "login", "signin", "sign-in", "verify", "verification", "validate",
    "account", "secure", "security", "update", "confirm", "confirmation",
    "password", "passwd", "bank", "banking", "paypal", "webscr", "logon",
    "authentication", "credential", "wallet", "crypto", "bitcoin",
    "unlock", "authorize", "authorization", "recover", "ssl", "invoice",
    "microsoft", "outlook", "office365", "appleid", "apple", "ebay",
    "alibaba", "amazon", "netflix", "session", "access", "unusual",
]

#: Publicly known URL-shortening services.  Shorteners are not malicious by
#: themselves, but they are *routinely abused* by phishers because the short
#: link hides the actual destination from the victim.
SHORTENING_SERVICES = [
    "bit.ly", "tinyurl.com", "goo.gl", "is.gd", "ow.ly", "s.id",
    "lnkd.in", "rb.gy", "cutt.ly", "t.co", "bit.do", "soo.gd",
    "tiny.cc", "buff.ly", "t.ly", "shorturl.at", "rebrand.ly",
    "surl.li", "tiny.one", "chilp.it", "cur.lv", "qr.ae", "v.gd",
    "adf.ly", "bc.vc", "tr.im", "kutt.it", "carbon.now.sh", "ow.ly",
]

#: Top-level domains that are free/cheap to register and therefore frequently
#: abused for throwaway phishing infrastructure.
SUSPICIOUS_TLDS = {
    "tk", "ml", "ga", "cf", "gq", "xyz", "top", "club", "click",
    "link", "zip", "review", "work", "party", "gdn", "pw", "icu",
    "buzz", "download", "cam", "sbs", "loan", "wang", "men", "mom",
    "lol", "bid", "win", "trade", "date", "accountant", "science",
}

#: IPv4 pattern used to detect URLs that point directly at an IP address
#: instead of a human-readable domain name.
IPV4_RE = re.compile(
    r"^(\d{1,3}\.){3}\d{1,3}$"
)

_HEX_RE = re.compile(r"(0x[0-9a-f]{2,})|[0-9a-f]{20,}", re.IGNORECASE)

#: Explicit order in which features appear in the feature vector.
#: This list defines the canonical column ordering used everywhere else
#: (training, saved metadata, live prediction, MVC compatibility).
FEATURE_COLUMNS = [
    "url_length",            # total characters in the URL
    "hostname_length",       # characters in the hostname
    "domain_length",         # characters in the registrable-ish domain
    "tld_length",            # characters in the top-level domain
    "path_length",           # characters in the URL path
    "query_length",          # characters in the query string
    "num_params",            # number of key=value parameters in the query
    "num_dots",              # count of '.' anywhere in the URL
    "num_hyphens",           # count of '-'
    "num_underscores",       # count of '_'
    "num_slashes",           # count of '/'
    "num_question_marks",    # count of '?'
    "num_equals",            # count of '='
    "num_at",                # count of '@' (used by attackers to hide host)
    "num_and",               # count of '&'
    "num_percent",           # count of '%' (URL-encoding tricks)
    "num_hash",              # count of '#'
    "num_plus",              # count of '+'
    "num_special_chars",     # count of any non-alphanumeric character
    "num_digits",            # count of digits 0-9
    "num_letters",           # count of letters a-z, A-Z
    "num_subdomains",        # number of dot-separated host labels above the domain
    "has_https",             # 1 if scheme is https, else 0
    "has_ip_address",        # 1 if hostname is a raw IP address, else 0
    "has_at_symbol",         # 1 if URL contains '@', else 0
    "has_hex_string",        # 1 if a suspicious long hex blob appears, else 0
    "has_suspicious_keywords",          # 1 if any keyword matched, else 0
    "suspicious_keywords_count",        # total keyword occurrences
    "digit_ratio",           # num_digits / len(url)
    "special_char_ratio",    # num_special_chars / len(url)
    "is_shortened",          # 1 if hostname belongs to a URL shortener, else 0
    "tld_is_suspicious",     # 1 if the TLD is in the abusive list, else 0
]


# ---------------------------------------------------------------------------
# URL normalisation helpers
# ---------------------------------------------------------------------------
def normalize_url(raw_url: str) -> str:
    """
    Normalise a raw URL string so that ``urlparse`` can parse it.

    The public dataset we use stores URLs *without* a scheme ("example.com/path"),
    so a scheme is prepended when missing.  Handles whitespace stripping and
    basic %-decoding of spaces/tabs which appear in dirty scraped data.

    Args:
        raw_url: the untrusted URL text.

    Returns:
        A clean, parseable URL string.
    """
    if raw_url is None:
        return ""

    url = str(raw_url).strip()
    url = url.replace("\\", "/")

    # Some rows in raw datasets contain HTML entities like &amp; - decode
    # the common ones so the counts below are meaningful.
    url = (
        url.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
    )

    # Reject obvious garbage (whitespace blobs, binary junk).
    if not url or len(url) > 4096:
        return ""

    # If the URL is missing a scheme, add a neutral one so urllib can split
    # hostname / path / query correctly.  The *presence* of https is tracked
    # as its own feature (has_https), so fabricating "http://" never leaks
    # information.
    if "://" not in url:
        url = "http://" + url

    return url


def _is_ipv4(hostname: str) -> bool:
    """Return True if *hostname* looks like a raw dotted IPv4 address."""
    if not hostname:
        return False
    return bool(IPV4_RE.match(hostname))


def _hostname_of(parsed) -> str:
    """Extract the lowercase hostname from a parsed URL, or '' if none."""
    if not parsed.netloc:
        return ""
    # Guying: IPv6 uses square brackets.
    host = parsed.netloc
    if host.startswith("["):
        return host.split("]")[0].lower()
    host = host.rsplit("@", 1)[-1]  # strip any userinfo prefix (already counted)
    return host.lower()


def _domain_of(hostname: str) -> str:
    """
    Cheap approximation of the registrable domain.

    A proper public-suffix library would be more accurate, but for the
    feature we only need a coarse "domain-ish" string, so we keep the last
    two labels when the host is not an IP (e.g. "example.co.uk" -> "co.uk"
    label isn't perfect, yet still informative enough for a ratio feature).
    For the *feature vector* this only affects ``domain_length``.
    """
    if not hostname or _is_ipv4(hostname):
        return hostname
    labels = hostname.split(".")
    if len(labels) <= 2:
        return hostname
    return ".".join(labels[-2:])


def _tld_of(hostname: str) -> str:
    """Return the last dot-separated label (the top-level domain)."""
    if not hostname:
        return ""
    if hostname.startswith("[") or ":" in hostname:
        return ""
    labels = hostname.split(".")
    return labels[-1] if labels else ""


def _count_keywords(url_lower: str) -> int:
    """Count how many suspicious keyword occurrences appear in the URL."""
    total = 0
    for kw in SUSPICIOUS_KEYWORDS:
        total += url_lower.count(kw)
    return total


# ---------------------------------------------------------------------------
# THE main extraction function  (used by BOTH training and prediction)
# ---------------------------------------------------------------------------
def extract_features(raw_url: str) -> "dict[str, int | float]":
    """
    Extract the full feature vector for one URL.

    Args:
        raw_url: any URL-like string supplied by the user or from the dataset.

    Returns:
        A dict with exactly the keys listed in :data:`FEATURE_COLUMNS`, all
        values being ints or floats in the same order / scale regardless of
        whether this was called during training or prediction.

    Raises:
        ValueError: if the URL cannot be parsed at all (empty, malformed).
    """
    url = normalize_url(raw_url)
    if not url:
        raise ValueError("Invalid or empty URL.")

    parsed = urlparse(url)
    scheme = (parsed.scheme or "").lower()

    # ---------------------------------------------------------------
    # Scheme-normalization (CRITICAL)
    # ---------------------------------------------------------------
    # The public dataset stores URLs *without* a scheme ("example.com/path"),
    # so every training sample has has_https == 0.  If we left "https://" in
    # live input, the value of url_length/hostname_length and the has_https
    # flag would systematically differ between training and prediction
    # (train/serve skew) and the model would misjudge ordinary clean URLs.
    #
    # We therefore compute every *structural* feature on the scheme-stripped
    # URL (identical to the training representation), while has_https still
    # truthfully records whether the ORIGINAL input used a secure scheme.
    # Because has_https was ~constant during training, the model ignores it
    # and HTTPS remains a transparent rule-based indicator on the UI.
    # ---------------------------------------------------------------
    if scheme:
        url = url[len(scheme) + len("://"):]

    # urllib needs a scheme to tokenize host/path/query, so parse with a
    # neutral wrapper, while all *length* features count the stripped string.
    parsed = urlparse("http://" + url)
    hostname = _hostname_of(parsed)
    if not hostname:
        raise ValueError("URL does not contain a valid hostname.")

    path = parsed.path or ""
    query = parsed.query or ""
    fragment = parsed.fragment or ""

    url_lower = url.lower()
    tld = _tld_of(hostname)
    domain = _domain_of(hostname)

    # ---- character counts -------------------------------------------------
    num_digits = sum(c.isdigit() for c in url)
    num_letters = sum(c.isalpha() for c in url)
    num_total = len(url)
    num_special = sum(1 for c in url if not c.isalnum())

    # ---- derived statistics ----------------------------------------------
    def _ratio(part: int, whole: int) -> float:
        return round(part / whole, 6) if whole else 0.0

    # Subdomain count: number of dot-separated labels above the domain.
    host_labels = hostname.split(".") if not _is_ipv4(hostname) and ":" not in hostname else []
    num_subdomains = max(0, len(host_labels) - 2) if len(host_labels) >= 2 else 0

    # Number of query parameters (x=1&y=2 => 2).
    num_params = sum(1 for p in query.split("&") if p)

    has_at_symbol = url.count("@") > 0

    features = {
        "url_length": len(url),
        "hostname_length": len(hostname),
        "domain_length": len(domain),
        "tld_length": len(tld),
        "path_length": len(path),
        "query_length": len(query),
        "num_params": num_params,
        "num_dots": url.count("."),
        "num_hyphens": url.count("-"),
        "num_underscores": url.count("_"),
        "num_slashes": url.count("/"),
        "num_question_marks": url.count("?"),
        "num_equals": url.count("="),
        "num_at": url.count("@"),
        "num_and": url.count("&"),
        "num_percent": url.count("%"),
        "num_hash": fragment.count("#") + query.count("#"),
        "num_plus": url.count("+"),
        "num_special_chars": num_special,
        "num_digits": num_digits,
        "num_letters": num_letters,
        "num_subdomains": num_subdomains,
        "has_https": int(scheme == "https"),
        "has_ip_address": int(_is_ipv4(hostname) or ":" in hostname),
        "has_at_symbol": int(has_at_symbol),
        "has_hex_string": int(bool(_HEX_RE.search(url))),
        "has_suspicious_keywords": 0,
        "suspicious_keywords_count": 0,
        "digit_ratio": _ratio(num_digits, num_total),
        "special_char_ratio": _ratio(num_special, num_total),
        "is_shortened": 0,
        "tld_is_suspicious": int(tld in SUSPICIOUS_TLDS),
    }

    # Keep counting features separated so they are easy to reason about.
    kw_count = _count_keywords(url_lower)
    features["suspicious_keywords_count"] = kw_count
    features["has_suspicious_keywords"] = int(kw_count > 0)

    host_no_www = hostname[4:] if hostname.startswith("www.") else hostname
    for shortener in SHORTENING_SERVICES:
        if hostname == shortener or host_no_www == shortener or hostname.endswith("." + shortener):
            features["is_shortened"] = 1
            break

    # Guarantee the exact canonical ordering.
    return {col: features[col] for col in FEATURE_COLUMNS}


def extract_features_df(urls) -> "pd.DataFrame":
    """
    Vectorised wrapper: extract features for an iterable of URLs.

    Used at training time over the whole dataset.  Kept in the same module
    so that anyone building future code reuses the identical logic.

    Args:
        urls: an iterable of raw URL strings.

    Returns:
        A DataFrame whose columns are exactly :data:`FEATURE_COLUMNS`.
    """
    import pandas as pd

    rows = []
    skipped = 0
    for u in urls:
        try:
            rows.append(extract_features(u))
        except ValueError:
            skipped += 1
    df = pd.DataFrame(rows, columns=FEATURE_COLUMNS)
    df.attrs["skipped"] = skipped
    return df