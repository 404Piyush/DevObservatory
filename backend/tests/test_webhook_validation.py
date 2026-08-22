"""Tests for the webhook URL validation + SSRF guard."""

import pytest
from pydantic import ValidationError

from app.routes.webhooks import _ip_is_public
from app.schemas import WebhookCreate


def test_ip_is_public_rejects_loopback() -> None:
    assert _ip_is_public("localhost") is False
    assert _ip_is_public("127.0.0.1") is False
    assert _ip_is_public("::1") is False


def test_ip_is_public_rejects_private() -> None:
    assert _ip_is_public("10.0.0.1") is False
    assert _ip_is_public("192.168.1.1") is False
    assert _ip_is_public("172.16.0.1") is False


def test_ip_is_public_rejects_link_local_aws_metadata() -> None:
    assert _ip_is_public("169.254.169.254") is False


def test_ip_is_public_accepts_public_ips() -> None:
    assert _ip_is_public("8.8.8.8") is True
    assert _ip_is_public("1.1.1.1") is True


def test_schema_rejects_file_scheme() -> None:
    with pytest.raises(ValidationError) as exc:
        WebhookCreate(name="evil", url="file:///etc/passwd")
    assert "http://" in str(exc.value) or "https://" in str(exc.value)


def test_schema_rejects_javascript_scheme() -> None:
    with pytest.raises(ValidationError):
        WebhookCreate(name="evil", url="javascript:alert(1)")


def test_schema_rejects_url_without_scheme() -> None:
    with pytest.raises(ValidationError):
        WebhookCreate(name="bad", url="example.com/webhook")


def test_schema_rejects_url_without_hostname() -> None:
    with pytest.raises(ValidationError):
        WebhookCreate(name="bad", url="https:///path")


def test_schema_accepts_valid_https() -> None:
    wh = WebhookCreate(name="ok", url="https://example.com/webhook")
    assert wh.url == "https://example.com/webhook"


def test_schema_accepts_valid_http() -> None:
    wh = WebhookCreate(name="ok", url="http://example.com/hook")
    assert wh.url == "http://example.com/hook"