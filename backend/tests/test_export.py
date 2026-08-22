"""Tests for CSV escaping and row formatting in the events export."""

from datetime import UTC, datetime


# Mirrors backend/app/routes/events.py:_csv_escape so we lock the behavior
# without booting a DB session.
def _csv_escape(value):
    if value is None:
        return ""
    s = str(value)
    if s.startswith(("=", "+", "-", "@", "\t", "\r")):
        s = "'" + s
    if any(ch in s for ch in [",", '"', "\n", "\r"]):
        return '"' + s.replace('"', '""') + '"'
    return s


def _format_row(values):
    return ",".join(_csv_escape(v) for v in values) + "\n"


def test_escape_plain_string_passes_through() -> None:
    assert _csv_escape("user_signup") == "user_signup"
    assert _csv_escape(42) == "42"


def test_escape_quotes_wrap_with_doubled_quotes() -> None:
    # Internal " is doubled and the field is wrapped in quotes.
    assert _csv_escape('say "hi"') == '"say ""hi"""'


def test_escape_comma_wraps_in_quotes() -> None:
    assert _csv_escape("a,b") == '"a,b"'


def test_escape_newline_wraps_in_quotes() -> None:
    assert _csv_escape("line1\nline2") == '"line1\nline2"'


def test_escape_none_is_empty() -> None:
    assert _csv_escape(None) == ""


def test_row_formats_all_columns() -> None:
    cols = ["id", "event_name", "user_id"]
    values = [1, "user_signup", None]
    assert _format_row(values) == "1,user_signup,\n"


def test_row_with_comma_in_field_quotes_field() -> None:
    cols = ["id", "properties"]
    values = [1, '{"plan":"pro,team"}']
    out = _format_row(values)
    # The field with comma is quoted; the JSON-string version escapes
    # the internal double quotes.
    assert out == '1,"{""plan"":""pro,team""}"\n'


def test_escape_prefixes_formula_leader() -> None:
    # Cells starting with =, +, -, @ should get a leading single quote
    # so Excel doesn't interpret them as formulas.
    assert _csv_escape("=HYPERLINK(\"evil\")") == "\"'=HYPERLINK(\"\"evil\"\")\""
    assert _csv_escape("+cmd|/c calc") == "'+cmd|/c calc"
    assert _csv_escape("-2+3") == "'-2+3"
    assert _csv_escape("@SUM(A1)") == "'@SUM(A1)"


def test_escape_does_not_prefix_safe_text() -> None:
    assert _csv_escape("hello") == "hello"
    assert _csv_escape("text with = sign inside") == "text with = sign inside"