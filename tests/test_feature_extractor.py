"""
Tests for the URL feature extractor (ml.feature_extractor).

These are the most important tests in the project: they guard the invariant
that training and live prediction share one identical feature representation.
"""

from __future__ import annotations

import pytest

from ml.feature_extractor import (
    FEATURE_COLUMNS,
    SHORTENING_SERVICES,
    SUSPICIOUS_KEYWORDS,
    extract_features,
)


def test_feature_keys_exactly_match_canonical_order():
    f = extract_features("https://example.com")
    assert list(f.keys()) == FEATURE_COLUMNS


def test_https_flag_from_original_scheme():
    assert extract_features("https://example.com")["has_https"] == 1
    assert extract_features("http://example.com")["has_https"] == 0
    assert extract_features("example.com")["has_https"] == 0


def test_ip_detection():
    f = extract_features("http://192.168.10.25/admin")
    assert f["has_ip_address"] == 1
    assert f["num_digits"] > 0


def test_subdomain_count():
    assert extract_features("https://example.com")["num_subdomains"] == 0
    assert extract_features("https://www.example.com")["num_subdomains"] == 1
    assert extract_features("https://a.b.c.example.com")["num_subdomains"] == 3


def test_suspicious_keywords_detected():
    f = extract_features("https://secure-login-confirm-paypal.com/account/verify")
    assert f["suspicious_keywords_count"] > 0
    assert f["has_suspicious_keywords"] == 1


def test_shortener_detected():
    f = extract_features(f"https://{SHORTENING_SERVICES[0]}/shortlink")
    assert f["is_shortened"] == 1


def test_at_symbol_detected():
    assert extract_features("https://real-host.com@evil.com/path")["has_at_symbol"] == 1


def test_missing_protocol_is_tolerated():
    f = extract_features("example.com/path?q=1")
    assert f["hostname_length"] == len("example.com")
    assert f["query_length"] == len("q=1")


def test_scheme_not_double_counted_in_length():
    # The scheme should not inflate length features (consistency with the
    # scheme-less public dataset used for training).
    with_https = extract_features("https://example.com/a")
    bare = extract_features("example.com/a")
    assert with_https["url_length"] == bare["url_length"] == 13
    assert with_https["num_dots"] == bare["num_dots"] == 1


def test_invalid_empty_url_raises():
    with pytest.raises(ValueError):
        extract_features("")
    with pytest.raises(ValueError):
        extract_features("   ")


@pytest.mark.parametrize("col", FEATURE_COLUMNS)
def test_all_features_are_numeric(col):
    f = extract_features("https://www.paypal.com-verify-login.com/account?a=b&c=d")
    assert isinstance(f[col], (int, float))


def test_keyword_list_is_nonempty():
    assert SUSPICIOUS_KEYWORDS
    assert len(FEATURE_COLUMNS) >= 25