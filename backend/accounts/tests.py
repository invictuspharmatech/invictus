from django.test import SimpleTestCase

from accounts.guards import contains_markup, markup_error


class MarkupGuardTests(SimpleTestCase):
    def test_allows_normal_chat_punctuation(self):
        samples = [
            "I don't know what happened?",
            'He said "thanks" & left!',
            "Order #123 — can you help?",
            "Email me at name@example.com",
            "Path: C:\\Users\\me\\file",
            "Use {this} code",
            "It's 50% off, right?",
        ]
        for text in samples:
            self.assertFalse(contains_markup(text), text)
            self.assertIsNone(markup_error(text), text)

    def test_blocks_html_and_script(self):
        samples = [
            "<script>alert(1)</script>",
            "hello <b>world</b>",
            "click <a href=x>",
            "javascript:alert(1)",
            'x onerror=alert(1)',
            "＜img src=x＞",
        ]
        for text in samples:
            self.assertTrue(contains_markup(text), text)
            self.assertIsNotNone(markup_error(text), text)
